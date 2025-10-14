const { test, expect } = require('@playwright/test');

test.describe('Course Creation UI Flow', () => {

  test('should create course and show it in the UI', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err));

    console.log('🔍 Starting course creation test...');

    // 1. Navigate to login page
    console.log('Step 1: Navigating to login...');
    await page.goto('http://localhost:3000/admin/login.html');
    await page.waitForLoadState('networkidle');

    // 2. Login
    console.log('Step 2: Logging in...');
    await page.fill('input[type="email"]', 'admin@school.edu');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('**/admin/lms-dashboard.html', { timeout: 10000 });
    console.log('✅ Login successful, redirected to dashboard');

    // 3. Wait for courses to load
    console.log('Step 3: Waiting for courses to load...');
    await page.waitForTimeout(2000);

    // Take screenshot of initial state
    await page.screenshot({ path: 'tests/screenshots/01-dashboard-initial.png', fullPage: true });
    console.log('📸 Screenshot: 01-dashboard-initial.png');

    // Check if courses are visible
    const coursesVisible = await page.locator('.course-card, .courses-grid, [class*="course"]').count();
    console.log(`Found ${coursesVisible} course elements`);

    // 4. Click "Add Course" button
    console.log('Step 4: Looking for Add Course button...');

    // Try multiple selectors
    const addCourseButton = page.locator('button:has-text("Add Course"), a:has-text("Add Course"), [class*="add-course"]').first();
    const buttonExists = await addCourseButton.count();

    if (buttonExists === 0) {
      console.log('❌ Add Course button not found!');
      await page.screenshot({ path: 'tests/screenshots/02-no-button.png', fullPage: true });

      // Log all buttons on page
      const allButtons = await page.locator('button, a.button, [role="button"]').allTextContents();
      console.log('All buttons/links found:', allButtons);

      throw new Error('Add Course button not found');
    }

    console.log('✅ Found Add Course button, clicking...');
    await addCourseButton.click();
    await page.waitForTimeout(1000);

    // 5. Wait for modal to appear
    console.log('Step 5: Waiting for course creation modal...');
    await page.screenshot({ path: 'tests/screenshots/03-after-click.png', fullPage: true });

    // Check for modal
    const modal = page.locator('.modal, [class*="modal"], dialog, [role="dialog"]').first();
    const modalVisible = await modal.isVisible().catch(() => false);

    if (!modalVisible) {
      console.log('❌ Modal did not appear!');

      // Check if there's a form or other creation UI
      const formExists = await page.locator('form, [class*="form"], [class*="create"]').count();
      console.log(`Found ${formExists} form elements`);

      throw new Error('Course creation modal not visible');
    }

    console.log('✅ Modal appeared');

    // 6. Fill course form
    console.log('Step 6: Filling course form...');

    const timestamp = Date.now();
    const courseCode = `TEST-${timestamp}`;

    // Try different input selectors
    await page.fill('input[name="course_name"], input[id*="courseName"], input[placeholder*="name"]',
      'Test Course via Playwright');
    await page.fill('input[name="course_code"], input[id*="courseCode"], input[placeholder*="code"]',
      courseCode);
    await page.fill('textarea[name="description"], textarea[id*="description"]',
      'Automated test course created by Playwright');

    await page.screenshot({ path: 'tests/screenshots/04-form-filled.png', fullPage: true });
    console.log('✅ Form filled');

    // 7. Submit form
    console.log('Step 7: Submitting form...');
    await page.click('button:has-text("Create"), button[type="submit"]');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/05-after-submit.png', fullPage: true });
    console.log('📸 Screenshot: 05-after-submit.png');

    // 8. Check for success message or course list update
    console.log('Step 8: Checking result...');

    // Wait for modal to close or success message
    const modalClosed = await modal.isVisible().then(v => !v).catch(() => true);
    console.log(`Modal closed: ${modalClosed}`);

    // Check for alert/notification
    const alertText = await page.locator('[class*="alert"], [class*="notification"], [class*="message"]')
      .allTextContents()
      .catch(() => []);
    console.log('Alerts/Messages:', alertText);

    // Wait for courses to reload
    await page.waitForTimeout(2000);

    // 9. Verify course appears in list
    console.log('Step 9: Checking if course appears in list...');

    const finalCourseCount = await page.locator('.course-card, .courses-grid > *, [class*="course-item"]').count();
    console.log(`Course elements after creation: ${finalCourseCount}`);

    // Look for the new course code
    const newCourseVisible = await page.locator(`text=${courseCode}`).count();
    console.log(`New course "${courseCode}" visible: ${newCourseVisible > 0}`);

    await page.screenshot({ path: 'tests/screenshots/06-final-state.png', fullPage: true });
    console.log('📸 Screenshot: 06-final-state.png');

    // 10. Get network logs
    console.log('Step 10: Checking network activity...');

    // Assertions
    if (newCourseVisible === 0) {
      console.log('❌ New course NOT visible in UI after creation!');
      console.log('This is the issue - course created but UI not updating');
    } else {
      console.log('✅ New course IS visible in UI!');
    }

    expect(newCourseVisible).toBeGreaterThan(0);
  });

  test('check initial page load and course list', async ({ page }) => {
    console.log('🔍 Testing initial course list load...');

    // Login first
    await page.goto('http://localhost:3000/admin/login.html');
    await page.fill('input[type="email"]', 'admin@school.edu');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/lms-dashboard.html');

    // Wait for page load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check page structure
    console.log('Checking page structure...');

    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);

    const coursesSection = await page.locator('#coursesTab, [class*="courses"], main').count();
    console.log('Courses section elements:', coursesSection);

    // Get all text content
    const pageText = await page.locator('body').textContent();
    const hasCourseText = pageText.includes('course') || pageText.includes('Course');
    console.log('Page mentions "course":', hasCourseText);

    // Check if courses are loaded via API
    const apiResponse = await page.evaluate(async () => {
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      const response = await fetch('/api/admin/portal/courses', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.json();
    });

    console.log('API Response:', JSON.stringify(apiResponse, null, 2));

    await page.screenshot({ path: 'tests/screenshots/initial-state.png', fullPage: true });
  });

});
