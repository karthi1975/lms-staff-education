const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://34.152.120.95:3000';

test.describe('Admin Login', () => {
  test('should load login page', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/login.html`);

    // Check page title
    await expect(page).toHaveTitle(/Login/i);

    // Check for login form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/login.html`);

    // Fill in credentials
    await page.fill('input[type="email"]', 'admin@school.edu');
    await page.fill('input[type="password"]', 'Admin123!');

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for navigation
    await page.waitForURL(/\/admin\/(index|dashboard)\.html/, { timeout: 10000 });

    // Check if redirected to dashboard
    expect(page.url()).toContain('/admin/');

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/login-success.png', fullPage: true });
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/login.html`);

    // Fill in invalid credentials
    await page.fill('input[type="email"]', 'wrong@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for error message
    await page.waitForSelector('.error, .alert, [role="alert"]', { timeout: 5000 });

    // Verify error is displayed
    const errorVisible = await page.locator('.error, .alert, [role="alert"]').isVisible();
    expect(errorVisible).toBeTruthy();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/login-error.png', fullPage: true });
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/login.html`);

    // Try to submit without filling fields
    await page.click('button[type="submit"]');

    // Check for HTML5 validation or error messages
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    // Verify required attributes or validation messages
    const emailRequired = await emailInput.getAttribute('required');
    const passwordRequired = await passwordInput.getAttribute('required');

    expect(emailRequired).not.toBeNull();
    expect(passwordRequired).not.toBeNull();
  });
});
