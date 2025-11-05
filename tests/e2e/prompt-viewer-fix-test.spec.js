/**
 * Playwright test to verify Super Admin can see courses in prompt viewer
 * Tests the fix for region_id=5 ("All Regions") handling
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.TEST_BASE_URL || 'http://34.162.168.124:3000';

test.describe('Prompt Viewer - Super Admin Course Access', () => {

  test('Super Admin can login and see accessible courses', async ({ page }) => {
    // Step 1: Login as Super Admin
    await page.goto(`${BASE_URL}/admin/login.html`);

    await page.fill('input[type="email"]', 'admin@school.edu');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(/dashboard\.html/, { timeout: 10000 });

    console.log('✅ Login successful');

    // Step 2: Navigate to Prompt Viewer
    await page.goto(`${BASE_URL}/admin/prompt-viewer.html`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    console.log('✅ Navigated to prompt viewer');

    // Step 3: Wait for courses to load
    await page.waitForTimeout(2000); // Give time for API call

    // Step 4: Check for error message (should NOT appear)
    const errorMessage = await page.locator('text=No accessible courses found').count();
    expect(errorMessage).toBe(0);

    console.log('✅ No error message displayed');

    // Step 5: Check course dropdown has options
    const courseDropdown = page.locator('select#courseDropdown');
    await expect(courseDropdown).toBeVisible({ timeout: 5000 });

    // Get all options
    const options = await courseDropdown.locator('option').count();
    console.log(`Found ${options} options in dropdown`);

    // Should have more than just the placeholder
    expect(options).toBeGreaterThan(1);

    console.log('✅ Course dropdown has options');

    // Step 6: Select a course
    await courseDropdown.selectOption({ index: 1 }); // Select first real course

    console.log('✅ Selected a course');

    // Step 7: Wait for prompts to load
    await page.waitForTimeout(2000);

    // Step 8: Verify prompt cards are displayed
    const promptContainer = page.locator('#promptContainer');
    await expect(promptContainer).toBeVisible({ timeout: 10000 });

    console.log('✅ Prompt container is visible');

    // Step 9: Take screenshot for verification
    await page.screenshot({ path: 'tests/screenshots/prompt-viewer-success.png', fullPage: true });

    console.log('✅ Screenshot saved');

    // Step 10: Verify both Regular and Socratic prompts are shown
    const regularPrompt = page.locator('text=Regular Mode');
    const socraticPrompt = page.locator('text=Socratic Mode');

    await expect(regularPrompt).toBeVisible();
    await expect(socraticPrompt).toBeVisible();

    console.log('✅ Both prompt modes are visible');
  });

  test('API endpoint returns courses for Super Admin', async ({ request }) => {
    // Step 1: Login via API
    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'admin@school.edu',
        password: 'Admin123!'
      }
    });

    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    const token = loginData.token;

    console.log('✅ Got auth token via API');

    // Step 2: Call accessible-courses endpoint
    const coursesResponse = await request.get(`${BASE_URL}/api/prompt-approval/accessible-courses`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    expect(coursesResponse.ok()).toBeTruthy();
    const coursesData = await coursesResponse.json();

    console.log('API Response:', JSON.stringify(coursesData, null, 2));

    // Step 3: Verify response structure
    expect(coursesData.success).toBe(true);
    expect(coursesData.count).toBeGreaterThan(0);
    expect(coursesData.courses).toBeDefined();
    expect(Array.isArray(coursesData.courses)).toBe(true);
    expect(coursesData.courses.length).toBeGreaterThan(0);

    console.log(`✅ API returned ${coursesData.count} course(s)`);

    // Step 4: Verify course has required fields
    const firstCourse = coursesData.courses[0];
    expect(firstCourse.id).toBeDefined();
    expect(firstCourse.title).toBeDefined();
    expect(firstCourse.code).toBeDefined();
    expect(firstCourse.region_id).toBeDefined();

    console.log(`✅ First course: ${firstCourse.title} (${firstCourse.code})`);
  });

  test('API endpoint returns regions for Super Admin', async ({ request }) => {
    // Step 1: Login via API
    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'admin@school.edu',
        password: 'Admin123!'
      }
    });

    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    const token = loginData.token;

    // Step 2: Call my-regions endpoint
    const regionsResponse = await request.get(`${BASE_URL}/api/prompt-approval/my-regions`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    expect(regionsResponse.ok()).toBeTruthy();
    const regionsData = await regionsResponse.json();

    console.log('Regions API Response:', JSON.stringify(regionsData, null, 2));

    // Step 3: Verify response
    expect(regionsData.success).toBe(true);
    expect(regionsData.isSuperAdmin).toBe(true);
    expect(regionsData.regions).toBeDefined();
    expect(Array.isArray(regionsData.regions)).toBe(true);

    console.log(`✅ Super Admin has access to ${regionsData.regions.length} regions`);
  });
});
