const { test, expect } = require('@playwright/test');

test.describe('Module Chat Assistant', () => {
  let page;
  let context;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should login, select module, and get AI response', async () => {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';
    
    // Step 1: Login
    console.log('1. Logging in...');
    await page.goto(`${baseURL}/admin/login.html`);
    await page.fill('input[type="email"]', 'admin@school.edu');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/admin/dashboard.html', { timeout: 10000 });
    console.log('✅ Login successful');
    
    // Step 2: Navigate to AI Assistant Chat
    console.log('2. Navigating to AI Assistant Chat...');
    await page.goto(`${baseURL}/admin/chat.html`);
    await page.waitForSelector('#courseSelect', { timeout: 5000 });
    console.log('✅ Chat page loaded');
    
    // Step 3: Select Course
    console.log('3. Selecting Business Studies Orientation course...');
    await page.selectOption('#courseSelect', { label: 'Business Studies Orientation' });
    await page.waitForTimeout(1000); // Wait for modules to load
    
    // Step 4: Select Module
    console.log('4. Selecting first module...');
    const firstModule = await page.locator('.module-item').first();
    await firstModule.click();
    await page.waitForTimeout(1000);
    console.log('✅ Module selected');
    
    // Step 5: Send test message
    console.log('5. Sending test query: "What is business studies?"...');
    const messageInput = await page.locator('#messageInput');
    await messageInput.fill('What is business studies?');
    
    const sendButton = await page.locator('#sendButton');
    await sendButton.click();
    
    // Step 6: Wait for AI response
    console.log('6. Waiting for AI response...');
    await page.waitForSelector('.message.assistant', { timeout: 30000 });
    
    // Step 7: Verify response
    const assistantMessages = await page.locator('.message.assistant').all();
    const lastMessage = assistantMessages[assistantMessages.length - 1];
    const messageText = await lastMessage.locator('.message-text').textContent();
    
    console.log('📝 AI Response preview:', messageText.substring(0, 200));
    
    // Assertions
    expect(messageText).toBeTruthy();
    expect(messageText.length).toBeGreaterThan(50); // Should have substantial content
    expect(messageText.toLowerCase()).not.toContain("don't have specific information"); // Should NOT be the error message
    
    // Check for language badge
    const hasBadge = await lastMessage.locator('.message-text').innerHTML();
    const hasLanguageBadge = hasBadge.includes('🇬🇧') || hasBadge.includes('English');
    console.log('✅ Language badge present:', hasLanguageBadge);
    
    // Check for sources
    const sourcesElement = await lastMessage.locator('.sources');
    const sourcesCount = await sourcesElement.count();
    console.log('📚 Sources found:', sourcesCount > 0 ? 'Yes' : 'No');
    
    console.log('✅ TEST PASSED: Chat is working!');
  });

  test('should switch between Regular and Socratic modes', async () => {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';
    
    console.log('Testing mode switching...');
    await page.goto(`${baseURL}/admin/chat.html`);
    
    // Select course and module first
    await page.selectOption('#courseSelect', { label: 'Business Studies Orientation' });
    await page.waitForTimeout(1000);
    await page.locator('.module-item').first().click();
    await page.waitForTimeout(1000);
    
    // Check mode selector is visible
    const modeSelectorBar = await page.locator('#modeSelectorBar');
    await expect(modeSelectorBar).toBeVisible();
    
    // Click Socratic Mode
    const socraticBtn = await page.locator('#socraticModeBtn');
    await socraticBtn.click();
    await page.waitForTimeout(2000); // Wait for mode switch
    
    // Check if mode changed
    const isActive = await socraticBtn.evaluate(el => el.classList.contains('active'));
    console.log('✅ Socratic mode active:', isActive);
    
    expect(isActive).toBe(true);
    
    console.log('✅ TEST PASSED: Mode switching works!');
  });
});
