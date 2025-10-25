/**
 * Playwright E2E Test: Course Detail Page
 * Tests the course detail UI with modules and file upload
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.TEST_BASE_URL || 'http://34.162.136.203:3000';
const ADMIN_EMAIL = 'admin@school.edu';
const ADMIN_PASSWORD = 'Admin123!';

test.describe('Course Detail Page', () => {
  let page;
  let browser;

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
  });

  test.beforeEach(async ({ page: p }) => {
    page = p;

    // Login as admin
    await page.goto(`${BASE_URL}/admin/login.html`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('**/admin/dashboard.html', { timeout: 10000 });
  });

  test('should load course detail page with purple gradient UI', async () => {
    // Click on first course
    await page.click('.course-card');

    // Wait for course detail page
    await page.waitForURL('**/admin/course-detail.html?id=*', { timeout: 10000 });

    // Verify purple gradient background
    const body = await page.locator('body');
    const bgGradient = await body.evaluate(el =>
      window.getComputedStyle(el).backgroundImage
    );
    expect(bgGradient).toContain('linear-gradient');

    // Verify page loaded
    await expect(page.locator('#course-title')).toBeVisible({ timeout: 5000 });

    // Take screenshot
    await page.screenshot({ path: 'screenshots/course-detail-loaded.png', fullPage: true });
  });

  test('should display course details correctly', async () => {
    // Click on first course (Business Studies Course - ID 2)
    await page.click('.course-card');

    // Wait for course detail page
    await page.waitForURL('**/admin/course-detail.html?id=*', { timeout: 10000 });

    // Wait for course title to load
    await page.waitForSelector('#course-title', { timeout: 10000 });

    const courseTitle = await page.locator('#course-title').textContent();
    const courseCode = await page.locator('#course-code').textContent();

    expect(courseTitle).toBeTruthy();
    expect(courseTitle).not.toBe('Loading...');
    expect(courseCode).toBeTruthy();

    console.log(`Course: ${courseTitle} (${courseCode})`);

    // Take screenshot
    await page.screenshot({ path: 'screenshots/course-details-displayed.png', fullPage: true });
  });

  test('should display modules list without "undefined" text', async () => {
    // Click on first course
    await page.click('.course-card');

    // Wait for course detail page
    await page.waitForURL('**/admin/course-detail.html?id=*', { timeout: 10000 });

    // Wait for modules section
    await page.waitForSelector('#modulesList', { timeout: 10000 });

    // Wait a bit for modules to load
    await page.waitForTimeout(2000);

    // Get modules HTML
    const modulesHTML = await page.locator('#modulesList').innerHTML();

    // Verify no "undefined" text appears
    expect(modulesHTML).not.toContain('undefined, undefined');
    expect(modulesHTML).not.toContain('undefined.');

    // If modules exist, verify structure
    const moduleCards = await page.locator('.module-card').count();
    if (moduleCards > 0) {
      const firstModuleText = await page.locator('.module-card').first().textContent();
      console.log(`First module: ${firstModuleText}`);

      // Should have module number and title
      expect(firstModuleText).toMatch(/\d+\./); // Should have "1." or "2." etc
    }

    // Take screenshot
    await page.screenshot({ path: 'screenshots/modules-list.png', fullPage: true });
  });

  test('should display uploaded files section without errors', async () => {
    // Click on first course
    await page.click('.course-card');

    // Wait for course detail page
    await page.waitForURL('**/admin/course-detail.html?id=*', { timeout: 10000 });

    // Wait for files section
    await page.waitForSelector('#uploadedFilesList', { timeout: 10000 });

    // Wait for files to load
    await page.waitForTimeout(2000);

    // Get files section HTML
    const filesHTML = await page.locator('#uploadedFilesList').innerHTML();

    // Verify no error message
    expect(filesHTML).not.toContain('Error Loading Files');
    expect(filesHTML).not.toContain('Unexpected token');

    // Should show either empty state or file list
    const hasErrorIcon = await page.locator('#uploadedFilesList .empty-state-icon:has-text("❌")').count();
    expect(hasErrorIcon).toBe(0);

    // Take screenshot
    await page.screenshot({ path: 'screenshots/files-section.png', fullPage: true });
  });

  test('should display drag and drop upload zone', async () => {
    // Click on first course
    await page.click('.course-card');

    // Wait for course detail page
    await page.waitForURL('**/admin/course-detail.html?id=*', { timeout: 10000 });

    // Verify upload zone exists
    await expect(page.locator('#dropZone')).toBeVisible({ timeout: 5000 });

    const dropZoneText = await page.locator('#dropZone').textContent();
    expect(dropZoneText).toContain('Drag & Drop Files Here');

    // Take screenshot
    await page.screenshot({ path: 'screenshots/upload-zone.png', fullPage: true });
  });

  test('should show status badges correctly', async () => {
    // Click on first course
    await page.click('.course-card');

    // Wait for course detail page
    await page.waitForURL('**/admin/course-detail.html?id=*', { timeout: 10000 });

    // Wait for upload summary section
    await page.waitForSelector('.upload-summary', { timeout: 10000 });

    // Verify status badges exist
    await expect(page.locator('#count-uploaded')).toBeVisible();
    await expect(page.locator('#count-processing')).toBeVisible();
    await expect(page.locator('#count-completed')).toBeVisible();
    await expect(page.locator('#count-failed')).toBeVisible();

    // Get counts
    const uploaded = await page.locator('#count-uploaded').textContent();
    const processing = await page.locator('#count-processing').textContent();
    const completed = await page.locator('#count-completed').textContent();
    const failed = await page.locator('#count-failed').textContent();

    console.log(`File status - Uploaded: ${uploaded}, Processing: ${processing}, Completed: ${completed}, Failed: ${failed}`);

    // All should be numbers
    expect(uploaded).toMatch(/^\d+$/);
    expect(processing).toMatch(/^\d+$/);
    expect(completed).toMatch(/^\d+$/);
    expect(failed).toMatch(/^\d+$/);

    // Take screenshot
    await page.screenshot({ path: 'screenshots/status-badges.png', fullPage: true });
  });

  test('should have all key UI elements visible', async () => {
    // Click on first course
    await page.click('.course-card');

    // Wait for course detail page
    await page.waitForURL('**/admin/course-detail.html?id=*', { timeout: 10000 });

    // Verify all key sections are visible
    await expect(page.locator('#course-title')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.breadcrumb')).toBeVisible();
    await expect(page.locator('#dropZone')).toBeVisible();
    await expect(page.locator('#modulesList')).toBeVisible();
    await expect(page.locator('#uploadedFilesList')).toBeVisible();
    await expect(page.locator('.upload-summary')).toBeVisible();

    console.log('✅ All key UI elements are visible');

    // Take final screenshot
    await page.screenshot({ path: 'screenshots/all-elements-visible.png', fullPage: true });
  });
});
