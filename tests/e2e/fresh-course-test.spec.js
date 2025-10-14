const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@school.edu';
const ADMIN_PASSWORD = 'Admin123!';

test.describe('Fresh Course Creation and Viewing', () => {
  let authToken;

  test('should login, create course, and view it without errors', async ({ page }) => {
    // Enable console logging to catch JavaScript errors
    const consoleErrors = [];
    const consoleMessages = [];

    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(text);
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Step 1: Login
    console.log('🔐 Step 1: Login to admin portal...');
    await page.goto(`${BASE_URL}/admin/login.html`);

    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/admin/lms-dashboard.html', { timeout: 10000 });
    console.log('✅ Login successful');

    // Get auth token
    authToken = await page.evaluate(() => {
      return localStorage.getItem('adminToken') || localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    });

    if (!authToken) {
      console.log('❌ No auth token found in storage');
      throw new Error('Authentication failed - no token found');
    } else {
      console.log(`✅ Auth token retrieved: ${authToken.substring(0, 20)}...`);
    }

    // Step 2: Wait for page to load completely
    console.log('⏳ Step 2: Waiting for page to load...');
    await page.waitForTimeout(2000);

    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/01-dashboard-loaded.png', fullPage: true });
    console.log('📸 Screenshot: 01-dashboard-loaded.png');

    // Check for any JavaScript errors
    if (consoleErrors.length > 0) {
      console.log('⚠️  JavaScript errors detected (may be benign):');
      consoleErrors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('✅ No JavaScript errors detected');
    }

    // Step 3: Navigate to Courses tab
    console.log('📂 Step 3: Navigating to Courses tab...');
    const coursesNavTab = page.locator('a.nav-tab', { hasText: 'Courses' });
    await coursesNavTab.click();
    await page.waitForTimeout(1000);
    console.log('✅ Clicked Courses tab');

    // Step 4: Check if courses are displayed
    console.log('📋 Step 4: Checking current courses...');
    const coursesGrid = await page.locator('#coursesGrid');
    await expect(coursesGrid).toBeVisible({ timeout: 5000 });

    const courseCards = await page.locator('.module-card').count();
    console.log(`Found ${courseCards} existing courses`);

    // Step 5: Click Add Course button
    console.log('➕ Step 5: Opening Add Course modal...');
    const addCourseBtn = page.locator('button:has-text("Add Course")');

    // Wait for button to be visible
    await addCourseBtn.waitFor({ state: 'visible', timeout: 10000 });
    await addCourseBtn.click();
    console.log('✅ Clicked Add Course button');

    await page.waitForTimeout(1000);

    // Step 6: Choose manual course creation
    console.log('📝 Step 6: Selecting manual course creation...');
    const manualOption = page.locator('div', { hasText: 'Create Manually' }).first();
    await manualOption.waitFor({ state: 'visible', timeout: 5000 });
    await manualOption.click();
    console.log('✅ Clicked Create Manually option');

    await page.waitForTimeout(1000);

    // Step 7: Fill in course details
    console.log('✏️  Step 7: Filling course details...');
    const timestamp = Date.now();
    const courseCode = `TEST-${timestamp}`;
    const courseName = `Test Course ${timestamp}`;

    await page.fill('#manualCourseName', courseName);
    await page.fill('#manualCourseCode', courseCode);
    await page.fill('#manualCourseDescription', 'Automated test course created by Playwright');
    await page.fill('#manualCourseCategory', 'Testing');

    console.log(`Course: ${courseName} (${courseCode})`);

    await page.screenshot({ path: 'test-results/02-course-form-filled.png', fullPage: true });

    // Step 8: Submit the form
    console.log('💾 Step 8: Submitting course creation form...');
    const submitBtn = page.locator('button:has-text("Create Course")');
    await submitBtn.click();
    console.log('✅ Clicked Create Course');

    // Wait for the course to be created and page to update
    await page.waitForTimeout(3000);

    // Check for any new JavaScript errors after submission
    if (consoleErrors.length > 0) {
      console.log('❌ JavaScript errors after submission:');
      consoleErrors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('✅ No JavaScript errors after submission');
    }

    await page.screenshot({ path: 'test-results/03-after-course-creation.png', fullPage: true });

    // Step 9: Verify course appears in the list
    console.log('🔍 Step 9: Verifying course appears in list...');
    await page.waitForTimeout(2000);

    const updatedCourseCards = await page.locator('.module-card').count();
    console.log(`Now found ${updatedCourseCards} courses (was ${courseCards})`);

    // Look for our specific course
    const newCourseCard = page.locator('.module-card', { hasText: courseCode });
    await expect(newCourseCard).toBeVisible({ timeout: 5000 });
    console.log(`✅ Course ${courseCode} is visible in the list`);

    // Step 10: Verify we can view the course modules
    console.log('👁️  Step 10: Testing View Modules button...');
    const viewModulesBtn = newCourseCard.locator('button:has-text("View Modules")');
    await expect(viewModulesBtn).toBeVisible();
    console.log('✅ View Modules button is visible');

    await page.screenshot({ path: 'test-results/04-course-visible-in-list.png', fullPage: true });

    // Step 11: Click View Modules to ensure no errors
    console.log('📂 Step 11: Clicking View Modules...');
    await viewModulesBtn.click();
    await page.waitForTimeout(2000);

    // Check for JavaScript errors after viewing modules
    if (consoleErrors.length > 0) {
      console.log('❌ JavaScript errors when viewing modules:');
      consoleErrors.forEach(err => console.log(`  - ${err}`));
      throw new Error('JavaScript errors detected when viewing modules');
    } else {
      console.log('✅ No JavaScript errors when viewing modules');
    }

    await page.screenshot({ path: 'test-results/05-modules-view.png', fullPage: true });

    console.log('');
    console.log('🎉 SUCCESS! Course creation and viewing workflow completed without errors!');
    console.log('');
    console.log('Summary:');
    console.log(`  ✅ Login successful`);
    console.log(`  ✅ Created course: ${courseName}`);
    console.log(`  ✅ Course code: ${courseCode}`);
    console.log(`  ✅ Course visible in list`);
    console.log(`  ✅ View Modules button works`);
    console.log(`  ✅ No JavaScript errors`);
    console.log('');
  });
});
