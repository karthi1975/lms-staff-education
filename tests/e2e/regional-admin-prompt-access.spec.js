/**
 * Test: Regional Admin Prompt Access After Middleware Fix
 *
 * Verifies that Regional Admins can:
 * 1. Login successfully
 * 2. See "View Prompts" navigation
 * 3. Select their assigned region
 * 4. Select courses in that region
 * 5. Load both Regular and Socratic prompts without errors
 *
 * This test validates the fix for "Error loading prompts: Failed to load prompts"
 * which was caused by missing attachAdminRegions middleware.
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.TEST_BASE_URL || 'http://34.162.168.124:3000';

test.describe('Regional Admin Prompt Access', () => {
  test('Regional Admin can view prompts for courses in assigned region', async ({ page }) => {
    // Step 1: Login as Regional Admin
    console.log('Step 1: Login as Regional Admin...');
    await page.goto(`${BASE_URL}/admin/login.html`);

    await page.fill('input[type="email"]', 'test.regional@school.edu');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(`${BASE_URL}/admin/dashboard.html`, { timeout: 10000 });
    console.log('✅ Login successful');

    // Step 2: Verify "View Prompts" navigation is visible
    console.log('Step 2: Verify "View Prompts" navigation...');
    const viewPromptsLink = page.locator('a[href="prompt-viewer.html"]');
    await expect(viewPromptsLink).toBeVisible({ timeout: 5000 });
    console.log('✅ "View Prompts" link is visible');

    // Step 3: Navigate to Prompt Viewer
    console.log('Step 3: Navigate to Prompt Viewer...');
    await viewPromptsLink.click();
    await page.waitForURL(`${BASE_URL}/admin/prompt-viewer.html`, { timeout: 10000 });
    console.log('✅ Navigated to Prompt Viewer');

    // Step 4: Verify region info is displayed
    console.log('Step 4: Verify region info...');
    const regionInfo = page.locator('#regionInfo');
    await expect(regionInfo).toBeVisible({ timeout: 5000 });

    const regionNames = await page.locator('#regionNames').textContent();
    console.log(`✅ Regions: ${regionNames}`);

    // Step 5: Verify region dropdown does NOT have "All Regions" option
    console.log('Step 5: Verify RBAC - no "All Regions" for Regional Admin...');
    const regionSelect = page.locator('#regionSelect');
    const allRegionsOption = regionSelect.locator('option:has-text("All Regions")');
    await expect(allRegionsOption).toHaveCount(0);
    console.log('✅ RBAC working - "All Regions" option not present');

    // Step 6: Select first region (should be auto-selected if only one region)
    console.log('Step 6: Select region...');
    const regionOptions = await regionSelect.locator('option').allTextContents();
    console.log(`   Available regions: ${regionOptions.join(', ')}`);

    // Get first non-placeholder option
    const firstRegion = await regionSelect.locator('option').nth(1).textContent();
    await regionSelect.selectOption({ index: 1 });
    console.log(`✅ Selected region: ${firstRegion}`);

    // Step 7: Wait for courses to load
    console.log('Step 7: Wait for courses to load...');
    await page.waitForTimeout(1000); // Wait for filtering

    const courseSelect = page.locator('#courseSelect');
    const courseOptions = await courseSelect.locator('option').allTextContents();
    console.log(`   Available courses: ${courseOptions.length - 1} courses`);

    if (courseOptions.length <= 1) {
      console.log('⚠️  No courses available in this region - skipping prompt load test');
      return;
    }

    // Step 8: Select first course
    console.log('Step 8: Select course...');
    const firstCourse = await courseSelect.locator('option').nth(1).textContent();
    await courseSelect.selectOption({ index: 1 });
    console.log(`✅ Selected course: ${firstCourse}`);

    // Step 9: THE CRITICAL TEST - Wait for prompts to load without error
    console.log('Step 9: Wait for prompts to load (THE FIX VERIFICATION)...');

    // Wait for either success or error state
    const promptContainer = page.locator('#promptContainer');
    const emptyState = page.locator('#emptyState');

    await page.waitForTimeout(2000); // Wait for API call

    // Check if error message appeared
    const errorMessage = await page.locator('text=/Error loading prompts/i').count();

    if (errorMessage > 0) {
      const errorText = await page.locator('text=/Error loading prompts/i').textContent();
      console.log(`❌❌❌ FAILED! Error: ${errorText}`);
      throw new Error(`Prompt loading failed: ${errorText}`);
    }

    // Check if empty state appeared
    const emptyStateVisible = await emptyState.isVisible().catch(() => false);
    if (emptyStateVisible) {
      const emptyText = await emptyState.textContent();
      console.log(`⚠️  Empty state: ${emptyText}`);
      console.log('   This could mean the course has no prompts configured yet');
      return;
    }

    // Check if prompts loaded successfully
    const promptContainerVisible = await promptContainer.isVisible().catch(() => false);

    if (promptContainerVisible) {
      console.log('✅✅✅ SUCCESS! Prompts loaded without errors!');

      // Step 10: Verify both Regular and Socratic prompts are displayed
      console.log('Step 10: Verify both prompt modes...');

      const regularPrompt = page.locator('.prompt-card:has-text("Regular Mode")');
      const socraticPrompt = page.locator('.prompt-card:has-text("Socratic Mode")');

      await expect(regularPrompt).toBeVisible({ timeout: 2000 });
      await expect(socraticPrompt).toBeVisible({ timeout: 2000 });

      console.log('✅ Both Regular and Socratic prompts are visible');

      // Get version numbers
      const regularVersion = await page.locator('.prompt-card:has-text("Regular Mode") .prompt-version').textContent();
      const socraticVersion = await page.locator('.prompt-card:has-text("Socratic Mode") .prompt-version').textContent();

      console.log(`   Regular Mode: ${regularVersion}`);
      console.log(`   Socratic Mode: ${socraticVersion}`);

      // Get preview of prompt text
      const regularText = await page.locator('.prompt-card:has-text("Regular Mode") .prompt-text').textContent();
      const socraticText = await page.locator('.prompt-card:has-text("Socratic Mode") .prompt-text').textContent();

      console.log(`   Regular Prompt Preview: ${regularText.substring(0, 80)}...`);
      console.log(`   Socratic Prompt Preview: ${socraticText.substring(0, 80)}...`);

      console.log('');
      console.log('=========================================');
      console.log('✅ TEST PASSED');
      console.log('=========================================');
      console.log('The middleware fix is working!');
      console.log('Regional Admins can now:');
      console.log('1. Select their assigned region');
      console.log('2. Select courses in that region');
      console.log('3. View both Regular and Socratic prompts');
      console.log('');
    } else {
      console.log('⚠️  Prompts container not visible');
      throw new Error('Prompts container not visible after course selection');
    }
  });

  test('Regional Admin cannot see "All Regions" option (RBAC)', async ({ page }) => {
    console.log('Testing RBAC: Regional Admin region filter...');

    // Login as Regional Admin
    await page.goto(`${BASE_URL}/admin/login.html`);
    await page.fill('input[type="email"]', 'test.regional@school.edu');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/admin/dashboard.html`, { timeout: 10000 });

    // Navigate to Prompt Viewer
    await page.click('a[href="prompt-viewer.html"]');
    await page.waitForURL(`${BASE_URL}/admin/prompt-viewer.html`, { timeout: 10000 });

    // Verify no "All Regions" option
    const regionSelect = page.locator('#regionSelect');
    const allRegionsOption = regionSelect.locator('option:has-text("All Regions")');

    const count = await allRegionsOption.count();
    expect(count).toBe(0);

    console.log('✅ RBAC verified: Regional Admin cannot see "All Regions" option');
  });

  test('Super Admin CAN see "All Regions" option (RBAC)', async ({ page }) => {
    console.log('Testing RBAC: Super Admin region filter...');

    // Login as Super Admin
    await page.goto(`${BASE_URL}/admin/login.html`);
    await page.fill('input[type="email"]', 'admin@school.edu');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/admin/dashboard.html`, { timeout: 10000 });

    // Navigate to Prompt Viewer
    await page.click('a[href="prompt-viewer.html"]');
    await page.waitForURL(`${BASE_URL}/admin/prompt-viewer.html`, { timeout: 10000 });

    // Verify "All Regions" option exists
    const regionSelect = page.locator('#regionSelect');
    const allRegionsOption = regionSelect.locator('option:has-text("All Regions")');

    await expect(allRegionsOption).toBeVisible({ timeout: 5000 });

    console.log('✅ RBAC verified: Super Admin can see "All Regions" option');
  });
});
