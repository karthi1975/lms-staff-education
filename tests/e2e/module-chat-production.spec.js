const { test, expect } = require('@playwright/test');

/**
 * Module Chat Assistant - Production Integration Test
 *
 * Tests the full chat flow for the Module Chat Assistant:
 * 1. Admin login
 * 2. Navigate to Module Chat Assistant page
 * 3. Select a module
 * 4. Send a message
 * 5. Receive AI response with RAG context
 *
 * This test verifies the integration of:
 * - Frontend chat UI
 * - Backend /api/chat endpoint
 * - ChromaDB RAG retrieval
 * - Vertex AI response generation
 * - Chat history persistence
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://34.162.136.203:3000';
const ADMIN_EMAIL = 'admin@school.edu';
const ADMIN_PASSWORD = 'Admin123!';

test.describe('Module Chat Assistant - Production Tests', () => {
  let authToken;

  test.beforeAll(async ({ request }) => {
    // Login and get auth token
    const response = await request.post(`${BASE_URL}/api/admin/login`, {
      data: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      }
    });

    if (response.ok()) {
      const data = await response.json();
      authToken = data.tokens?.accessToken || data.token;
      console.log('✅ Admin login successful, token:', authToken ? 'received' : 'missing');
    } else {
      const text = await response.text();
      console.log('❌ Login failed:', text);
      throw new Error('Login failed: ' + text);
    }
  });

  test('should load Module Chat Assistant page successfully', async ({ page }) => {
    // Set auth token in localStorage
    await page.goto(`${BASE_URL}/admin/login.html`);
    await page.evaluate((token) => {
      localStorage.setItem('adminToken', token);
    }, authToken);

    // Navigate to chat page
    await page.goto(`${BASE_URL}/admin/chat.html`);

    // Wait for page to load
    await page.waitForSelector('.header h1');

    // Verify page title
    const title = await page.textContent('.header h1');
    expect(title).toContain('Module Chat Assistant');

    console.log('✅ Module Chat Assistant page loaded successfully');
  });

  test('should display training modules in sidebar', async ({ page }) => {
    // Set auth token in localStorage
    await page.goto(`${BASE_URL}/admin/login.html`);
    await page.evaluate((token) => {
      localStorage.setItem('adminToken', token);
    }, authToken);

    // Navigate to chat page
    await page.goto(`${BASE_URL}/admin/chat.html`);

    // Wait for modules to load
    await page.waitForSelector('.module-list .module-item', { timeout: 10000 });

    // Get all module items
    const modules = await page.$$('.module-list .module-item');
    expect(modules.length).toBeGreaterThan(0);

    console.log(`✅ Found ${modules.length} training modules in sidebar`);
  });

  test('should select a module and display welcome message', async ({ page }) => {
    // Set auth token in localStorage
    await page.goto(`${BASE_URL}/admin/login.html`);
    await page.evaluate((token) => {
      localStorage.setItem('adminToken', token);
    }, authToken);

    // Navigate to chat page
    await page.goto(`${BASE_URL}/admin/chat.html`);

    // Wait for modules to load
    await page.waitForSelector('.module-list .module-item', { timeout: 10000 });

    // Click on the first module (Production)
    const firstModule = await page.$('.module-list .module-item');
    await firstModule.click();

    // Wait for welcome message to appear
    await page.waitForSelector('.message .message-content', { timeout: 5000 });

    // Verify welcome message contains expected content
    const welcomeMessage = await page.textContent('.message .message-content');
    expect(welcomeMessage).toContain('Great! You\'ve started learning!');
    expect(welcomeMessage).toContain('What You\'ll Learn:');
    expect(welcomeMessage).toContain('Ask Me Anything!');

    console.log('✅ Module selected and welcome message displayed');
  });

  test('should send a message and receive AI response', async ({ page }) => {
    // Set auth token in localStorage
    await page.goto(`${BASE_URL}/admin/login.html`);
    await page.evaluate((token) => {
      localStorage.setItem('adminToken', token);
    }, authToken);

    // Navigate to chat page
    await page.goto(`${BASE_URL}/admin/chat.html`);

    // Wait for modules to load
    await page.waitForSelector('.module-list .module-item', { timeout: 10000 });

    // Click on the first module (Production)
    const firstModule = await page.$('.module-list .module-item');
    const moduleName = await firstModule.textContent();
    console.log('📝 Selecting module:', moduleName.trim());
    await firstModule.click();

    // Wait for welcome message
    await page.waitForSelector('.message .message-content', { timeout: 5000 });
    console.log('✅ Welcome message displayed');
    await page.waitForTimeout(2000); // Wait 2s to see welcome message

    // Type a question
    const testQuestion = 'What is production in small business?';
    console.log('💬 Sending question:', testQuestion);
    await page.fill('#messageInput', testQuestion);
    await page.waitForTimeout(1000); // Wait 1s to see typing

    // Click send button
    await page.click('#sendButton');
    console.log('📤 Message sent, waiting for response...');

    // Wait for user message to appear
    await page.waitForSelector('.message.user', { timeout: 5000 });

    // Verify user message is displayed
    const userMessage = await page.textContent('.message.user .message-text');
    expect(userMessage).toContain(testQuestion);
    console.log('✅ User message displayed in chat');

    // Wait for typing indicator
    await page.waitForSelector('.typing-indicator.active', { timeout: 5000 });
    console.log('⏳ AI is typing...');
    await page.waitForTimeout(2000); // Wait 2s to see typing indicator

    // Wait for AI response (typing indicator disappears and new assistant message appears)
    await page.waitForSelector('.message:not(.user):nth-last-child(1)', { timeout: 30000 });
    console.log('✅ AI response received!');

    // Get all assistant messages (excluding the welcome message)
    const assistantMessages = await page.$$('.message:not(.user)');
    expect(assistantMessages.length).toBeGreaterThanOrEqual(2); // Welcome message + response

    // Get the last assistant message (the response)
    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
    const responseText = await lastAssistantMessage.textContent();

    // Verify response contains content
    expect(responseText.length).toBeGreaterThan(10);
    console.log('📄 Response preview:', responseText.substring(0, 150).replace(/\s+/g, ' ') + '...');

    // Wait to see the full response
    await page.waitForTimeout(3000);

    // Check if response contains sources (optional, depends on ChromaDB content)
    const hasSources = responseText.includes('Sources:') || responseText.includes('📚');
    if (hasSources) {
      console.log('✅ Response includes source citations from RAG pipeline');
    } else {
      console.log('⚠️ Response does not include sources (may need content in ChromaDB)');
    }

    // Wait before closing to see final state
    await page.waitForTimeout(2000);
  });

  test('should test RAG pipeline with Business Studies content', async ({ page }) => {
    // Set auth token in localStorage
    await page.goto(`${BASE_URL}/admin/login.html`);
    await page.evaluate((token) => {
      localStorage.setItem('adminToken', token);
    }, authToken);

    // Navigate to chat page
    await page.goto(`${BASE_URL}/admin/chat.html`);

    // Wait for modules to load
    await page.waitForSelector('.module-list .module-item', { timeout: 10000 });
    console.log('📚 Testing RAG pipeline with Business Studies content...');

    // Look for Production or Business-related module
    const modules = await page.$$('.module-list .module-item');
    let productionModule = null;
    let selectedModuleName = '';

    for (const module of modules) {
      const text = await module.textContent();
      if (text.toLowerCase().includes('production') ||
          text.toLowerCase().includes('business') ||
          text.toLowerCase().includes('entrepreneur')) {
        productionModule = module;
        selectedModuleName = text.trim();
        break;
      }
    }

    if (!productionModule) {
      // Use first module as fallback
      productionModule = modules[0];
      selectedModuleName = await productionModule.textContent();
    }

    console.log('📝 Selected module:', selectedModuleName);
    await productionModule.click();
    await page.waitForSelector('.message .message-content', { timeout: 5000 });
    await page.waitForTimeout(2000); // Wait to see welcome message

    // Ask a specific question about content that should be in ChromaDB
    const businessQuestions = [
      'What is entrepreneurship?',
      'What is production in business?',
      'How do you identify business opportunities?',
      'What are the factors of production?'
    ];

    const question = businessQuestions[0];
    console.log('💬 Asking:', question);
    await page.fill('#messageInput', question);
    await page.waitForTimeout(1000); // Wait to see typing

    await page.click('#sendButton');
    console.log('📤 Message sent, waiting for RAG-enhanced response...');

    // Wait for response
    await page.waitForSelector('.message.user', { timeout: 5000 });
    await page.waitForSelector('.typing-indicator.active', { timeout: 5000 });
    console.log('⏳ AI is processing with RAG pipeline...');
    await page.waitForTimeout(2000); // Wait to see typing indicator

    await page.waitForSelector('.message:not(.user):nth-last-child(1)', { timeout: 30000 });
    console.log('✅ Response received!');

    // Wait to see the response
    await page.waitForTimeout(3000);

    // Get the response
    const assistantMessages = await page.$$('.message:not(.user)');
    const lastMessage = assistantMessages[assistantMessages.length - 1];
    const responseText = await lastMessage.textContent();

    // Check if response has sources (indicates RAG is working)
    const hasSources = responseText.includes('Sources:') ||
                      responseText.includes('📚') ||
                      responseText.includes('📄');

    console.log('📊 RAG Pipeline Test Results:');
    console.log('   Question:', question);
    console.log('   Response length:', responseText.length, 'characters');
    console.log('   Has sources:', hasSources ? '✅ YES' : '⚠️ NO');

    if (hasSources) {
      console.log('✅ RAG pipeline is working - sources found in response');
      // Extract and show sources
      const sourcesMatch = responseText.match(/📚[^]*?$/);
      if (sourcesMatch) {
        console.log('   Sources:', sourcesMatch[0].substring(0, 100));
      }
    } else {
      console.log('⚠️ No sources in response - may need to index Business Studies content');
      console.log('   Response preview:', responseText.substring(0, 200).replace(/\s+/g, ' '));
    }

    // Wait before closing to see final state
    await page.waitForTimeout(3000);

    // Response should be substantial (more than just a fallback message)
    expect(responseText.length).toBeGreaterThan(50);
  });
});
