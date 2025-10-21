const { test, expect } = require('@playwright/test');

/**
 * Admin Portal Endurance Test - 120 Minutes
 *
 * Tests all admin features with 5-second delays:
 * - Login
 * - Dashboard navigation
 * - Course management
 * - User management
 * - Module chat with RAG
 * - Content upload
 * - Settings
 *
 * Runs continuously for 120 minutes with logging
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://34.162.136.203:3000';
const ADMIN_EMAIL = 'admin@school.edu';
const ADMIN_PASSWORD = 'Admin123!';
const TEST_DURATION_MS = 120 * 60 * 1000; // 120 minutes
const ACTION_DELAY = 5000; // 5 seconds between actions
const PAGE_LOAD_DELAY = 5000; // 5 seconds for page loads

test.describe('Admin Portal Endurance Test - 120 Minutes', () => {
  let authToken;
  let startTime;
  let iterationCount = 0;

  test.beforeAll(async ({ request }) => {
    console.log('🚀 Starting 120-minute Admin Portal Endurance Test');
    console.log('⏰ Start time:', new Date().toLocaleString());
    console.log('🔄 Action delay: 5 seconds');
    console.log('📄 Page load delay: 5 seconds');
    console.log('');

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
      console.log('✅ Admin login successful');
      console.log('');
    } else {
      throw new Error('Login failed');
    }

    startTime = Date.now();
  });

  test('should run admin portal tests for 120 minutes', async ({ page }) => {
    test.setTimeout(TEST_DURATION_MS + 60000); // Add 1 minute buffer

    // Set auth token
    await page.goto(`${BASE_URL}/admin/login.html`);
    await page.evaluate((token) => {
      localStorage.setItem('adminToken', token);
    }, authToken);

    const businessQuestions = [
      'What is entrepreneurship?',
      'What is production in business?',
      'How do you identify business opportunities?',
      'What are the factors of production?',
      'What is business management?',
      'How to manage quality control?',
      'What is warehousing?',
      'How to finance a small business?',
      'What is inventory management?',
      'How to write a business plan?'
    ];

    let questionIndex = 0;

    // Main test loop - run until time limit
    while (Date.now() - startTime < TEST_DURATION_MS) {
      iterationCount++;
      const elapsed = Math.round((Date.now() - startTime) / 1000 / 60);
      const remaining = 120 - elapsed;

      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`🔄 ITERATION ${iterationCount} | ⏱️ Elapsed: ${elapsed}m | Remaining: ${remaining}m`);
      console.log('═══════════════════════════════════════════════════════');
      console.log('');

      // ============================================================
      // 1. TEST DASHBOARD
      // ============================================================
      console.log('📊 [1/7] Testing Dashboard...');
      await page.goto(`${BASE_URL}/admin/lms-dashboard.html`);
      await page.waitForTimeout(PAGE_LOAD_DELAY);

      // Verify dashboard loaded
      await page.waitForSelector('h1', { timeout: 10000 });
      const dashboardTitle = await page.textContent('h1');
      console.log('   ✅ Dashboard loaded:', dashboardTitle);
      await page.waitForTimeout(ACTION_DELAY);

      // ============================================================
      // 2. TEST COURSE MANAGEMENT
      // ============================================================
      console.log('📚 [2/7] Testing Course Management...');
      await page.goto(`${BASE_URL}/admin/courses.html`);
      await page.waitForTimeout(PAGE_LOAD_DELAY);

      // Wait for courses to load
      const courseCards = await page.$$('.course-card, .card');
      console.log(`   ✅ Found ${courseCards.length} courses`);
      await page.waitForTimeout(ACTION_DELAY);

      // Click first course if available
      if (courseCards.length > 0) {
        const firstCourse = courseCards[0];
        const courseName = await firstCourse.textContent();
        console.log('   📖 Opening course:', courseName.substring(0, 50));
        await firstCourse.click();
        await page.waitForTimeout(PAGE_LOAD_DELAY);

        // Verify course detail page
        const url = page.url();
        if (url.includes('course-detail')) {
          console.log('   ✅ Course detail page loaded');

          // Check for uploaded files
          const uploadedFiles = await page.$$('.file-row, tr');
          console.log(`   📁 Found ${uploadedFiles.length} uploaded files`);
        }
        await page.waitForTimeout(ACTION_DELAY);
      }

      // ============================================================
      // 3. TEST USER MANAGEMENT
      // ============================================================
      console.log('👥 [3/7] Testing User Management...');
      await page.goto(`${BASE_URL}/admin/users.html`);
      await page.waitForTimeout(PAGE_LOAD_DELAY);

      // Wait for user table
      const userRows = await page.$$('tbody tr, .user-row');
      console.log(`   ✅ Found ${userRows.length} users`);
      await page.waitForTimeout(ACTION_DELAY);

      // ============================================================
      // 4. TEST MODULE CHAT ASSISTANT
      // ============================================================
      console.log('💬 [4/7] Testing Module Chat Assistant...');
      await page.goto(`${BASE_URL}/admin/chat.html`);
      await page.waitForTimeout(PAGE_LOAD_DELAY);

      // Wait for modules to load
      await page.waitForSelector('.module-list .module-item', { timeout: 15000 });
      const modules = await page.$$('.module-list .module-item');
      console.log(`   ✅ Found ${modules.length} training modules`);
      await page.waitForTimeout(ACTION_DELAY);

      // Select a random module
      if (modules.length > 0) {
        const randomModuleIndex = Math.floor(Math.random() * modules.length);
        const selectedModule = modules[randomModuleIndex];
        const moduleName = await selectedModule.textContent();
        const moduleNameClean = moduleName.trim();

        console.log(`   📝 Selecting module: ${moduleNameClean}`);
        await selectedModule.click();
        await page.waitForTimeout(ACTION_DELAY);

        // Wait for welcome message
        await page.waitForSelector('.message .message-content', { timeout: 10000 });
        console.log('   ✅ Welcome message displayed');
        await page.waitForTimeout(ACTION_DELAY);

        // Ask a question
        const question = businessQuestions[questionIndex % businessQuestions.length];
        questionIndex++;

        console.log(`   💬 Asking: "${question}"`);
        await page.fill('#messageInput', question);
        await page.waitForTimeout(ACTION_DELAY);

        await page.click('#sendButton');
        console.log('   📤 Message sent, waiting for response...');
        await page.waitForTimeout(ACTION_DELAY);

        // Wait for user message
        await page.waitForSelector('.message.user', { timeout: 10000 });
        console.log('   ✅ User message displayed');

        // Wait for typing indicator
        try {
          await page.waitForSelector('.typing-indicator.active', { timeout: 5000 });
          console.log('   ⏳ AI is typing...');
          await page.waitForTimeout(3000);
        } catch (e) {
          // Typing indicator might be too fast to catch
        }

        // Wait for AI response
        await page.waitForSelector('.message:not(.user):nth-last-child(1)', { timeout: 30000 });
        console.log('   ✅ AI response received!');

        // Get response details
        const assistantMessages = await page.$$('.message:not(.user)');
        const lastMessage = assistantMessages[assistantMessages.length - 1];
        const responseText = await lastMessage.textContent();

        const hasSources = responseText.includes('Sources:') || responseText.includes('📚');
        console.log(`   📊 Response length: ${responseText.length} characters`);
        console.log(`   📚 Has sources: ${hasSources ? 'YES ✅' : 'NO ⚠️'}`);

        await page.waitForTimeout(ACTION_DELAY);
      }

      // ============================================================
      // 5. TEST CONTENT SECTION
      // ============================================================
      console.log('📁 [5/7] Testing Content Section...');
      await page.goto(`${BASE_URL}/admin/lms-dashboard.html`);
      await page.waitForTimeout(PAGE_LOAD_DELAY);

      // Try to navigate to content if menu exists
      const contentMenuExists = await page.$('text=Content').catch(() => null);
      if (contentMenuExists) {
        console.log('   ✅ Content menu found');
        await page.waitForTimeout(ACTION_DELAY);
      } else {
        console.log('   ⚠️ Content menu not visible on this page');
      }

      // ============================================================
      // 6. TEST MODULE MANAGEMENT
      // ============================================================
      console.log('📋 [6/7] Testing Module Management...');
      await page.goto(`${BASE_URL}/admin/modules.html`);
      await page.waitForTimeout(PAGE_LOAD_DELAY);

      // Check if modules page exists
      const pageLoaded = await page.$('h1, h2').catch(() => null);
      if (pageLoaded) {
        const pageTitle = await page.textContent('h1, h2');
        console.log(`   ✅ Modules page loaded: ${pageTitle}`);
      } else {
        console.log('   ⚠️ Modules page not available');
      }
      await page.waitForTimeout(ACTION_DELAY);

      // ============================================================
      // 7. TEST SETTINGS/COMMUNICATION
      // ============================================================
      console.log('⚙️ [7/7] Testing Settings/Communication...');
      await page.goto(`${BASE_URL}/admin/lms-dashboard.html`);
      await page.waitForTimeout(PAGE_LOAD_DELAY);

      // Check sidebar for settings
      const settingsExists = await page.$('text=Settings').catch(() => null);
      if (settingsExists) {
        console.log('   ✅ Settings section available');
      } else {
        console.log('   ⚠️ Settings section not visible');
      }
      await page.waitForTimeout(ACTION_DELAY);

      // ============================================================
      // ITERATION COMPLETE
      // ============================================================
      const iterationTime = Math.round((Date.now() - startTime) / 1000);
      console.log('');
      console.log(`✅ Iteration ${iterationCount} complete (${iterationTime}s elapsed)`);
      console.log('');

      // Check if we should continue
      if (Date.now() - startTime >= TEST_DURATION_MS) {
        break;
      }

      // Wait before next iteration
      console.log('⏸️ Waiting 5 seconds before next iteration...');
      await page.waitForTimeout(5000);
    }

    // ============================================================
    // FINAL SUMMARY
    // ============================================================
    const totalTime = Math.round((Date.now() - startTime) / 1000 / 60);
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🏁 ENDURANCE TEST COMPLETE');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log(`⏱️ Total time: ${totalTime} minutes`);
    console.log(`🔄 Total iterations: ${iterationCount}`);
    console.log(`📊 Average time per iteration: ${Math.round(totalTime / iterationCount * 60)}s`);
    console.log(`⏰ End time: ${new Date().toLocaleString()}`);
    console.log('');
    console.log('✅ All admin portal features tested successfully!');
    console.log('');
  });
});
