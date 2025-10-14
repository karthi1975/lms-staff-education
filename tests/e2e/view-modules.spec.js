const { test, expect } = require('@playwright/test');

test.describe('View Modules Flow', () => {
  let authToken;
  let courseId;

  test.beforeAll(async ({ request }) => {
    // 1. Login as admin
    const loginResponse = await request.post('http://localhost:3000/api/admin/auth/login', {
      data: {
        email: 'admin@school.edu',
        password: 'Admin123!'
      }
    });
    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    authToken = loginData.token;
    console.log('✓ Admin logged in successfully');

    // 2. Create a test course
    const courseResponse = await request.post('http://localhost:3000/api/admin/courses', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      data: {
        title: 'Test Course for Modules',
        code: 'TEST-MODULES-001',
        description: 'A test course to verify module viewing',
        category: 'Teacher Professional Development',
        difficulty_level: 'beginner',
        duration_weeks: 4,
        sequence_order: 1
      }
    });
    expect(courseResponse.ok()).toBeTruthy();
    const courseData = await courseResponse.json();
    courseId = courseData.data.id;
    console.log(`✓ Test course created with ID: ${courseId}`);

    // 3. Add a module to the course
    const moduleResponse = await request.post(`http://localhost:3000/api/admin/portal/courses/${courseId}/modules`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      data: {
        module_name: 'Introduction Module',
        module_code: 'TEST-MOD-001',
        description: 'First test module',
        sequence_order: 1,
        duration_weeks: 1
      }
    });
    expect(moduleResponse.ok()).toBeTruthy();
    console.log('✓ Test module created');
  });

  test.afterAll(async ({ request }) => {
    // Cleanup: Delete the test course (cascade will delete modules)
    if (courseId && authToken) {
      await request.delete(`http://localhost:3000/api/admin/courses/${courseId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      console.log('✓ Test course deleted');
    }
  });

  test('should show error when endpoint is incorrect', async ({ page }) => {
    // Login to admin portal
    await page.goto('http://localhost:3000/admin/login.html');
    await page.fill('#email', 'admin@school.edu');
    await page.fill('#password', 'Admin123!');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('**/lms-dashboard.html');
    await page.waitForTimeout(1000);

    // Navigate to Courses tab
    await page.click('text=Courses');
    await page.waitForTimeout(1000);

    // Click on "View Modules" button for the first course
    const viewModulesButton = page.locator('button:has-text("View Modules")').first();
    await viewModulesButton.click();

    // Wait for the modal to appear
    await page.waitForSelector('.modal.active', { timeout: 5000 });

    // Check if error message appears (the bug we're testing)
    const modalContent = await page.textContent('.modal-body');
    console.log('Modal content:', modalContent);

    // The bug: should show "Error loading modules" because endpoint is wrong
    // After fix: should show module list or "No modules yet"
  });

  test('should successfully load modules after fix', async ({ page }) => {
    // Login to admin portal
    await page.goto('http://localhost:3000/admin/login.html');
    await page.fill('#email', 'admin@school.edu');
    await page.fill('#password', 'Admin123!');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('**/lms-dashboard.html');
    await page.waitForTimeout(1000);

    // Navigate to Courses tab
    await page.click('text=Courses');
    await page.waitForTimeout(1000);

    // Click on "View Modules" button
    const viewModulesButton = page.locator('button:has-text("View Modules")').first();
    await viewModulesButton.click();

    // Wait for the modal to appear
    await page.waitForSelector('.modal.active', { timeout: 5000 });

    // After fix: Should see either modules list or "No modules yet" message
    const modalBody = page.locator('.modal-body');
    await expect(modalBody).toBeVisible();

    // Check that it's not showing an error
    const hasError = await modalBody.locator('text=Error loading modules').count();
    expect(hasError).toBe(0);

    console.log('✓ View Modules modal loaded successfully without errors');
  });
});
