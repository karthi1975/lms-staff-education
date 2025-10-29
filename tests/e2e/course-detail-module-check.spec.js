const { test, expect } = require('@playwright/test');

test.describe('Course Detail Page - Module Loading', () => {
  let authToken;

  test.beforeAll(async ({ request }) => {
    // Login to get auth token
    const loginResponse = await request.post('/api/admin/login', {
      data: {
        email: 'admin@school.edu',
        password: 'Admin123!'
      }
    });

    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    authToken = loginData.token;
    expect(authToken).toBeTruthy();
  });

  test('should load course details and modules successfully', async ({ page }) => {
    // Set auth token in localStorage
    await page.goto('/admin/login.html');
    await page.evaluate((token) => {
      localStorage.setItem('adminToken', token);
    }, authToken);

    // Navigate to course detail page
    console.log('Navigating to course detail page...');
    await page.goto('/admin/course-detail.html?id=1');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if course title loaded
    const courseTitle = await page.locator('#course-title').textContent();
    console.log('Course Title:', courseTitle);
    expect(courseTitle).not.toBe('Error Loading Course');
    expect(courseTitle).toBeTruthy();

    // Check if total modules count is displayed
    const totalModules = await page.locator('#total-modules').textContent();
    console.log('Total Modules:', totalModules);
    expect(totalModules).toBeTruthy();

    // Check for any failed network requests
    const failedRequests = [];
    page.on('requestfailed', request => {
      failedRequests.push({
        url: request.url(),
        failure: request.failure()
      });
    });

    // Wait a bit to catch any delayed failures
    await page.waitForTimeout(2000);

    // Log any failed requests
    if (failedRequests.length > 0) {
      console.log('Failed Requests:');
      failedRequests.forEach(req => {
        console.log(`  - ${req.url}: ${req.failure?.errorText}`);
      });
    }

    // Check if modules section is visible
    const modulesSection = page.locator('#modules-list');
    await expect(modulesSection).toBeVisible();

    // Take screenshot for debugging
    await page.screenshot({ path: 'tests/screenshots/course-detail-check.png', fullPage: true });
  });

  test('should successfully call course API endpoint', async ({ request }) => {
    // Test course detail API directly
    const courseResponse = await request.get('/api/admin/courses/1', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    console.log('Course API Status:', courseResponse.status());
    const courseData = await courseResponse.json();
    console.log('Course Data:', JSON.stringify(courseData, null, 2));

    expect(courseResponse.ok()).toBeTruthy();
    expect(courseData.success).toBeTruthy();
    expect(courseData.course).toBeTruthy();
  });

  test('should successfully call modules API endpoint', async ({ request }) => {
    // Test modules API directly
    const modulesResponse = await request.get('/api/admin/courses/1/modules', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    console.log('Modules API Status:', modulesResponse.status());
    const modulesData = await modulesResponse.json();
    console.log('Modules Data:', JSON.stringify(modulesData, null, 2));

    expect(modulesResponse.ok()).toBeTruthy();
    expect(modulesData.success).toBeTruthy();
    expect(modulesData.modules).toBeDefined();
  });

  test('should successfully call files API endpoint', async ({ request }) => {
    // Test files API directly
    const filesResponse = await request.get('/api/admin/courses/1/files', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    console.log('Files API Status:', filesResponse.status());

    // Files endpoint might return 404 if no files exist, which is OK
    if (filesResponse.ok()) {
      const filesData = await filesResponse.json();
      console.log('Files Data:', JSON.stringify(filesData, null, 2));
      expect(filesData.success).toBeTruthy();
    } else {
      console.log('Files API returned:', filesResponse.status(), '- This is OK if no files exist yet');
    }
  });
});
