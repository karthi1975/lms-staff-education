const { test, expect } = require('@playwright/test');

/**
 * Admin Portal Endurance Test - 120 Minutes (REALISTIC USER SIMULATION)
 *
 * Simulates actual user behavior with:
 * - Mouse movements and hovers
 * - Natural typing with random delays
 * - Tab/Shift+Tab keyboard navigation
 * - Realistic click patterns
 * - Scroll behaviors
 * - Human-like delays and variations
 *
 * Tests all admin features:
 * - Login
 * - Dashboard navigation
 * - Course management
 * - User management
 * - Module chat with RAG
 * - Clean navigation (removed Content, Settings, etc.)
 * - Navigation verification
 *
 * Runs continuously for 120 minutes with logging
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://34.162.136.203:3000';
const ADMIN_EMAIL = 'admin@school.edu';
const ADMIN_PASSWORD = 'Admin123!';
const TEST_DURATION_MS = 120 * 60 * 1000; // 120 minutes
const MIN_DELAY = 2000; // 2 seconds minimum
const MAX_DELAY = 5000; // 5 seconds maximum

/**
 * Helper: Random delay between min and max ms (simulates human variation)
 */
function randomDelay(min = 50, max = 200) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Helper: Get random action delay (2-5 seconds)
 */
function getActionDelay() {
  return randomDelay(MIN_DELAY, MAX_DELAY);
}

/**
 * Helper: Get random page load delay (2-5 seconds)
 */
function getPageLoadDelay() {
  return randomDelay(MIN_DELAY, MAX_DELAY);
}

/**
 * Helper: Shuffle array (Fisher-Yates algorithm)
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Helper: Type text with human-like delays between keystrokes
 */
async function typeNaturally(page, selector, text) {
  await page.click(selector); // Focus the input
  await page.waitForTimeout(randomDelay(100, 300)); // Pause before typing

  for (const char of text) {
    await page.keyboard.type(char);
    await page.waitForTimeout(randomDelay(50, 150)); // Random delay between keys
  }

  await page.waitForTimeout(randomDelay(200, 500)); // Pause after typing
}

/**
 * Helper: Move mouse to element and click (simulates real mouse movement)
 */
async function moveAndClick(page, selector, options = {}) {
  const element = await page.locator(selector).first();
  const box = await element.boundingBox();

  if (box) {
    // Move mouse to element with slight randomness
    const targetX = box.x + box.width / 2 + randomDelay(-10, 10);
    const targetY = box.y + box.height / 2 + randomDelay(-5, 5);

    await page.mouse.move(targetX, targetY, { steps: 10 }); // Smooth movement
    await page.waitForTimeout(randomDelay(100, 300)); // Hover pause

    // Click
    await page.mouse.click(targetX, targetY, options);
    await page.waitForTimeout(randomDelay(150, 350)); // Post-click delay
  } else {
    // Fallback to regular click
    await element.click(options);
  }
}

/**
 * Helper: Hover over element (simulates mouse hover)
 */
async function hoverElement(page, selector) {
  const element = await page.locator(selector).first();
  const box = await element.boundingBox();

  if (box) {
    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;

    await page.mouse.move(targetX, targetY, { steps: 5 });
    await page.waitForTimeout(randomDelay(200, 400)); // Hover duration
  }
}

/**
 * Helper: Navigate using Tab key
 */
async function tabNavigate(page, times = 1) {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(randomDelay(100, 300));
  }
}

/**
 * Helper: Navigate using Shift+Tab
 */
async function shiftTabNavigate(page, times = 1) {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(randomDelay(100, 300));
  }
}

/**
 * Helper: Scroll page naturally
 */
async function scrollNaturally(page, direction = 'down', distance = 300) {
  const scrollAmount = direction === 'down' ? distance : -distance;

  // Scroll in small increments (like mouse wheel)
  const steps = 5;
  const stepAmount = scrollAmount / steps;

  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, stepAmount);
    await page.waitForTimeout(randomDelay(50, 150));
  }
}

/**
 * Helper: Read page as if human is scanning content
 */
async function scanPage(page, duration = 2000) {
  console.log('   👁️ Scanning page content...');

  // Random mouse movements to simulate reading
  for (let i = 0; i < 3; i++) {
    const x = randomDelay(100, 800);
    const y = randomDelay(100, 600);
    await page.mouse.move(x, y, { steps: 3 });
    await page.waitForTimeout(randomDelay(300, 700));
  }

  await page.waitForTimeout(duration);
}

test.describe('Admin Portal Endurance Test - 120 Minutes (Realistic)', () => {
  let authToken;
  let startTime;
  let iterationCount = 0;

  test.beforeAll(async ({ request }) => {
    console.log('🚀 Starting 120-minute Admin Portal Endurance Test (REALISTIC MODE)');
    console.log('⏰ Start time:', new Date().toLocaleString());
    console.log('🎭 Simulating real user behavior with:');
    console.log('   - Mouse movements and hovers');
    console.log('   - Natural typing patterns');
    console.log('   - Tab/Shift+Tab navigation');
    console.log('   - Realistic delays and variations');
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

  test('should run admin portal tests for 120 minutes with realistic interactions', async ({ page }) => {
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
      // 1. TEST DASHBOARD (with realistic interactions)
      // ============================================================
      console.log('📊 [1/7] Testing Dashboard...');
      await page.goto(`${BASE_URL}/admin/dashboard.html`);
      const dashboardLoadDelay = getPageLoadDelay();
      console.log(`   ⏱️ Waiting ${dashboardLoadDelay}ms for page load...`);
      await page.waitForTimeout(dashboardLoadDelay);

      // Verify dashboard loaded - wait for navigation to complete
      await page.waitForLoadState('networkidle');
      console.log('   ✅ Dashboard loaded successfully');

      // Scan the dashboard like a real user
      await scanPage(page, randomDelay(1500, 2500));

      // Scroll down to see more content
      await scrollNaturally(page, 'down', randomDelay(150, 250));
      await page.waitForTimeout(randomDelay(500, 1000));

      // Scroll back up
      await scrollNaturally(page, 'up', randomDelay(150, 250));
      await page.waitForTimeout(getActionDelay());

      // ============================================================
      // 2. TEST COURSE MANAGEMENT (with mouse movements)
      // ============================================================
      console.log('📚 [2/7] Testing Course Management...');
      await page.goto(`${BASE_URL}/admin/courses.html`);
      await page.waitForTimeout(getPageLoadDelay());

      // Wait for courses to load
      const courseCards = await page.$$('.course-card, .card');
      console.log(`   ✅ Found ${courseCards.length} courses`);
      await page.waitForTimeout(getActionDelay());

      // Click a random course (not always first - more realistic!)
      if (courseCards.length > 0) {
        const randomCourseIndex = Math.floor(Math.random() * courseCards.length);
        const courseSelector = `.course-card:nth-child(${randomCourseIndex + 1}), .card:nth-child(${randomCourseIndex + 1})`;
        const selectedCourse = await page.locator('.course-card, .card').nth(randomCourseIndex);
        const courseName = await selectedCourse.textContent();
        console.log(`   📖 Opening random course #${randomCourseIndex + 1}:`, courseName.substring(0, 50));

        // Hover over course card first
        await hoverElement(page, courseSelector);
        console.log('   🖱️ Hovering over course card...');
        await page.waitForTimeout(randomDelay(400, 800));

        // Click with mouse movement
        await moveAndClick(page, courseSelector);
        console.log('   🖱️ Clicked course card');
        await page.waitForTimeout(getPageLoadDelay());

        // Verify course detail page
        const url = page.url();
        if (url.includes('course-detail')) {
          console.log('   ✅ Course detail page loaded');

          // Scan the course details
          await scanPage(page, randomDelay(1500, 2500));

          // Scroll to see uploaded files
          await scrollNaturally(page, 'down', randomDelay(250, 350));
          await page.waitForTimeout(randomDelay(700, 1200));

          // Check for uploaded files
          const uploadedFiles = await page.$$('.file-row, tr');
          console.log(`   📁 Found ${uploadedFiles.length} uploaded files`);

          // Scroll back up
          await scrollNaturally(page, 'up', randomDelay(250, 350));
        }
        await page.waitForTimeout(getActionDelay());
      }

      // ============================================================
      // 3. TEST USER MANAGEMENT (with keyboard navigation)
      // ============================================================
      console.log('👥 [3/7] Testing User Management...');
      await page.goto(`${BASE_URL}/admin/user-management.html`);
      await page.waitForTimeout(getPageLoadDelay());

      // Wait for user table
      const userRows = await page.$$('tbody tr, .user-row');
      console.log(`   ✅ Found ${userRows.length} users`);

      // Scan the user list
      await scanPage(page, randomDelay(1200, 2000));

      // Try keyboard navigation (Tab through elements) - random number of tabs
      const tabCount = randomDelay(2, 5);
      console.log(`   ⌨️ Testing Tab navigation (${tabCount} tabs)...`);
      await tabNavigate(page, tabCount);
      await page.waitForTimeout(randomDelay(400, 800));

      // Navigate back with Shift+Tab
      const shiftTabCount = randomDelay(1, 3);
      console.log(`   ⌨️ Testing Shift+Tab navigation (${shiftTabCount} times)...`);
      await shiftTabNavigate(page, shiftTabCount);

      await page.waitForTimeout(getActionDelay());

      // ============================================================
      // 4. TEST MODULE CHAT ASSISTANT (with natural typing)
      // ============================================================
      console.log('💬 [4/7] Testing Module Chat Assistant...');
      await page.goto(`${BASE_URL}/admin/chat.html`);
      await page.waitForTimeout(getPageLoadDelay());

      // Wait for modules to load
      await page.waitForSelector('.module-list .module-item', { timeout: 15000 });
      const modules = await page.$$('.module-list .module-item');
      console.log(`   ✅ Found ${modules.length} training modules`);
      await page.waitForTimeout(getActionDelay());

      // Select a random module with realistic interaction
      if (modules.length > 0) {
        const randomModuleIndex = Math.floor(Math.random() * modules.length);
        const moduleSelector = `.module-list .module-item:nth-child(${randomModuleIndex + 1})`;
        const selectedModule = await page.locator(moduleSelector).first();
        const moduleName = await selectedModule.textContent();
        const moduleNameClean = moduleName.trim();

        console.log(`   📝 Selecting module: ${moduleNameClean}`);

        // Hover over module first
        await hoverElement(page, moduleSelector);
        console.log('   🖱️ Hovering over module...');
        await page.waitForTimeout(randomDelay(400, 900));

        // Click with mouse movement
        await moveAndClick(page, moduleSelector);
        console.log('   🖱️ Clicked module');
        await page.waitForTimeout(getActionDelay());

        // Wait for welcome message
        await page.waitForSelector('.message .message-content', { timeout: 10000 });
        console.log('   ✅ Welcome message displayed');

        // Read the welcome message
        await scanPage(page, randomDelay(1200, 2000));

        // Ask a question with natural typing
        const question = businessQuestions[questionIndex % businessQuestions.length];
        questionIndex++;

        console.log(`   💬 Asking: "${question}"`);
        console.log('   ⌨️ Typing naturally...');

        // Type the question naturally (character by character with delays)
        await typeNaturally(page, '#messageInput', question);

        console.log('   ✅ Question typed');
        await page.waitForTimeout(randomDelay(600, 1200));

        // Press Enter to send (or click send button) - randomize method
        const sendOption = Math.random() > 0.5 ? 'enter' : 'click';

        if (sendOption === 'enter') {
          console.log('   ⌨️ Pressing Enter to send...');
          await page.keyboard.press('Enter');
        } else {
          console.log('   🖱️ Clicking Send button...');
          await moveAndClick(page, '#sendButton');
        }

        console.log('   📤 Message sent, waiting for response...');
        await page.waitForTimeout(getActionDelay());

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

        // Read the response like a human would
        console.log('   👁️ Reading AI response...');
        await scanPage(page, randomDelay(1800, 3000));

        // Scroll to see sources if present
        if (hasSources) {
          await scrollNaturally(page, 'down', randomDelay(180, 250));
          await page.waitForTimeout(randomDelay(1200, 2200));
          await scrollNaturally(page, 'up', randomDelay(180, 250));
        }

        await page.waitForTimeout(getActionDelay());
      }

      // ============================================================
      // 5. TEST NAVIGATION MENU
      // ============================================================
      console.log('📁 [5/7] Testing Clean Navigation Menu...');
      await page.goto(`${BASE_URL}/admin/dashboard.html`);
      await page.waitForTimeout(getPageLoadDelay());

      // Verify clean navigation items (removed placeholder items)
      const dashboardNav = await page.$('text=Dashboard').catch(() => null);
      const coursesNav = await page.$('text=Courses').catch(() => null);
      const usersNav = await page.$('text=Users').catch(() => null);
      const aiNav = await page.$('text=AI Assistant').catch(() => null);

      if (dashboardNav && coursesNav && usersNav && aiNav) {
        console.log('   ✅ Clean navigation verified (4 items)');
        console.log('   ✅ Dashboard, Courses, Users, AI Assistant');
      } else {
        console.log('   ⚠️ Some navigation items missing');
      }

      // Verify removed items are NOT present
      const contentRemoved = !(await page.$('text=Content Library').catch(() => false));
      const settingsRemoved = !(await page.$('text=Settings').catch(() => false));

      if (contentRemoved && settingsRemoved) {
        console.log('   ✅ Placeholder items removed (Content, Settings, etc.)');
      }

      await page.waitForTimeout(getActionDelay());

      // ============================================================
      // 6. TEST COURSES NAVIGATION
      // ============================================================
      console.log('📚 [6/7] Testing Courses Navigation...');

      // Click on Courses in nav
      await page.click('text=Courses');
      await page.waitForTimeout(getPageLoadDelay());
      await page.waitForLoadState('networkidle');
      console.log('   ✅ Courses page loaded');

      // Scan the page
      await scanPage(page, 1500);
      await page.waitForTimeout(getActionDelay());

      // ============================================================
      // 7. TEST USERS NAVIGATION
      // ============================================================
      console.log('👥 [7/7] Testing Users Navigation...');

      // Click on Users in nav
      await page.click('text=Users');
      await page.waitForTimeout(getPageLoadDelay());
      await page.waitForLoadState('networkidle');
      console.log('   ✅ Users page loaded');

      // Scan the page
      await scanPage(page, 1500);
      await page.waitForTimeout(getActionDelay());

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
    console.log('🏁 ENDURANCE TEST COMPLETE (REALISTIC MODE)');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log(`⏱️ Total time: ${totalTime} minutes`);
    console.log(`🔄 Total iterations: ${iterationCount}`);
    console.log(`📊 Average time per iteration: ${Math.round(totalTime / iterationCount * 60)}s`);
    console.log(`⏰ End time: ${new Date().toLocaleString()}`);
    console.log('');
    console.log('✅ All admin portal features tested with realistic user interactions!');
    console.log('');
    console.log('🎭 Interaction Summary:');
    console.log('   - Mouse movements and hovers: ✅');
    console.log('   - Natural typing patterns: ✅');
    console.log('   - Tab/Shift+Tab navigation: ✅');
    console.log('   - Realistic scrolling: ✅');
    console.log('   - Human-like delays: ✅');
    console.log('');
  });
});
