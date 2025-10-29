/**
 * Coaching Analytics Navigation Test
 * Verify navigation from dashboard to coaching analytics page
 */

const { test, expect } = require('@playwright/test');

const TEST_BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

test.describe('Coaching Analytics Navigation', () => {
  test('should navigate from dashboard to coaching analytics', async ({ page }) => {
    // Step 1: Go to login page
    console.log('Step 1: Navigate to login page');
    await page.goto(`${TEST_BASE_URL}/admin/login.html`);
    await page.waitForLoadState('networkidle');

    // Step 2: Login
    console.log('Step 2: Login as admin');
    await page.fill('input[type="email"]', 'admin@school.edu');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(/dashboard\.html/, { timeout: 10000 });
    console.log(`✅ Redirected to: ${page.url()}`);

    // Verify we're on dashboard
    expect(page.url()).toContain('dashboard.html');

    // Step 3: Verify coaching analytics link exists in sidebar
    console.log('Step 3: Verify coaching analytics link exists');
    const coachingLink = page.locator('a[href="coaching-analytics.html"]');
    await expect(coachingLink).toBeVisible({ timeout: 5000 });
    console.log('✅ Coaching analytics link found in sidebar');

    // Step 4: Click coaching analytics link
    console.log('Step 4: Click coaching analytics link');
    await coachingLink.click();

    // Wait for navigation
    await page.waitForLoadState('networkidle');
    console.log(`Current URL after click: ${page.url()}`);

    // Step 5: Verify we're on coaching analytics page
    console.log('Step 5: Verify we reached coaching analytics page');

    // Check if we got redirected back to login
    if (page.url().includes('login.html')) {
      console.log('❌ FAIL: Redirected to login page');
      throw new Error('Coaching analytics page redirected to login');
    }

    // Check if we got redirected back to dashboard
    if (page.url().includes('dashboard.html') && !page.url().includes('coaching')) {
      console.log('❌ FAIL: Bounced back to dashboard');
      throw new Error('Coaching analytics page bounced back to dashboard');
    }

    // Verify we're on coaching analytics page
    await expect(page).toHaveURL(/coaching-analytics\.html/, { timeout: 5000 });
    console.log('✅ Successfully navigated to coaching analytics page');

    // Step 6: Verify page content
    console.log('Step 6: Verify coaching analytics page content');

    // Check for header
    const header = page.locator('h1:has-text("Coaching Analytics")');
    await expect(header).toBeVisible({ timeout: 5000 });
    console.log('✅ Header "Coaching Analytics" found');

    // Check for stats cards
    const statsCards = page.locator('.stat-card');
    const statsCount = await statsCards.count();
    console.log(`Found ${statsCount} stat cards`);
    expect(statsCount).toBeGreaterThan(0);
    console.log('✅ Stats cards loaded');

    // Check for tabs
    const tabs = page.locator('.tab');
    const tabsCount = await tabs.count();
    console.log(`Found ${tabsCount} tabs`);
    expect(tabsCount).toBeGreaterThanOrEqual(3);
    console.log('✅ Tabs found');

    // Step 7: Verify back button works
    console.log('Step 7: Test back to dashboard button');
    const backButton = page.locator('a:has-text("Back to Dashboard")');
    await expect(backButton).toBeVisible();
    console.log('✅ Back button found');

    await backButton.click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('dashboard.html');
    console.log('✅ Back button navigates to dashboard');

    // Step 8: Navigate back to coaching analytics
    console.log('Step 8: Navigate back to coaching analytics via sidebar');
    await page.locator('a[href="coaching-analytics.html"]').click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/coaching-analytics\.html/);
    console.log('✅ Successfully navigated back to coaching analytics');

    console.log('\n✅ ALL TESTS PASSED: Navigation flow works correctly');
  });

  test('should handle direct navigation to coaching analytics', async ({ page }) => {
    console.log('Test: Direct navigation to coaching analytics (logged out)');

    // Try to access coaching analytics directly without login
    await page.goto(`${TEST_BASE_URL}/admin/coaching-analytics.html`);
    await page.waitForLoadState('networkidle');

    // Should redirect to login
    console.log(`Current URL: ${page.url()}`);
    expect(page.url()).toContain('login.html');
    console.log('✅ Correctly redirected to login when not authenticated');
  });

  test('should maintain authentication state', async ({ page }) => {
    console.log('Test: Authentication state persistence');

    // Step 1: Login
    await page.goto(`${TEST_BASE_URL}/admin/login.html`);
    await page.fill('input[type="email"]', 'admin@school.edu');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard\.html/);

    // Step 2: Check localStorage has token
    const token = await page.evaluate(() => localStorage.getItem('adminToken'));
    console.log(`Token in localStorage: ${token ? 'Present' : 'Missing'}`);
    expect(token).toBeTruthy();
    console.log('✅ Auth token stored in localStorage');

    // Step 3: Navigate to coaching analytics
    await page.goto(`${TEST_BASE_URL}/admin/coaching-analytics.html`);
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to login
    expect(page.url()).toContain('coaching-analytics.html');
    console.log('✅ Direct navigation works when authenticated');

    // Step 4: Verify token is still present
    const tokenAfter = await page.evaluate(() => localStorage.getItem('adminToken'));
    expect(tokenAfter).toBeTruthy();
    console.log('✅ Auth token persisted after navigation');
  });
});
