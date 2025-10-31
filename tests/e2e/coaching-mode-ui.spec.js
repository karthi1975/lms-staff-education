/**
 * E2E Tests for Coaching Mode UI
 * Tests user workflows in bot configuration, analytics, and chat interfaces
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@school.edu';
const ADMIN_PASSWORD = 'Admin123!';

// Helper function to login
async function loginAsAdmin(page) {
  await page.goto(`${BASE_URL}/admin/login.html`);
  await page.fill('input[name="email"]', ADMIN_EMAIL);
  await page.fill('input[name="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForNavigation();
}

test.describe('Bot Configuration UI E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/admin/bot-config.html`);
  });

  test('1. Should load bot configuration page successfully', async ({ page }) => {
    // Verify page title
    await expect(page).toHaveTitle(/Bot Configuration/);

    // Verify main elements are visible
    await expect(page.locator('.page-title')).toContainText('Bot Configuration');
    await expect(page.locator('#courseSelect')).toBeVisible();
    await expect(page.locator('#regularPrompt')).toBeVisible();
    await expect(page.locator('#socraticPrompt')).toBeVisible();
  });

  test('2. Should load and display course list', async ({ page }) => {
    // Wait for courses to load
    await page.waitForSelector('#courseSelect option:not([value=""])', { timeout: 5000 });

    // Verify courses are loaded
    const options = await page.locator('#courseSelect option').count();
    expect(options).toBeGreaterThan(1); // At least "Select a course" + 1 course

    // Select first course
    await page.selectOption('#courseSelect', { index: 1 });

    // Verify configuration loads
    await page.waitForTimeout(1000); // Wait for API call
    const regularPrompt = await page.inputValue('#regularPrompt');
    expect(regularPrompt.length).toBeGreaterThan(0);
  });

  test('3. Should edit and save bot configuration', async ({ page }) => {
    // Select first course
    await page.waitForSelector('#courseSelect option:not([value=""])', { timeout: 5000 });
    await page.selectOption('#courseSelect', { index: 1 });
    await page.waitForTimeout(1000);

    // Edit regular mode prompt
    const newPrompt = `Test prompt updated at ${Date.now()}`;
    await page.fill('#regularPrompt', newPrompt);

    // Edit greeting
    await page.fill('#regularGreeting', 'Welcome to test mode!');

    // Save configuration
    await page.click('button:has-text("Save Configuration")');

    // Wait for success message
    await expect(page.locator('#validationMessage')).toContainText('success', { timeout: 5000 });

    // Verify prompt persisted
    await page.reload();
    await page.waitForSelector('#courseSelect option:not([value=""])', { timeout: 5000 });
    await page.selectOption('#courseSelect', { index: 1 });
    await page.waitForTimeout(1000);

    const savedPrompt = await page.inputValue('#regularPrompt');
    expect(savedPrompt).toBe(newPrompt);
  });

  test('4. Should show preview modal', async ({ page }) => {
    // Select course and fill some data
    await page.waitForSelector('#courseSelect option:not([value=""])', { timeout: 5000 });
    await page.selectOption('#courseSelect', { index: 1 });
    await page.waitForTimeout(1000);

    // Click preview button
    await page.click('button:has-text("Preview")');

    // Verify modal is visible
    await expect(page.locator('#previewModal')).toBeVisible();
    await expect(page.locator('.preview-content')).toBeVisible();

    // Verify preview content
    await expect(page.locator('#previewRegular')).not.toBeEmpty();
    await expect(page.locator('#previewSocratic')).not.toBeEmpty();
    await expect(page.locator('#previewSettings')).not.toBeEmpty();

    // Close modal
    await page.click('.close-preview');
    await expect(page.locator('#previewModal')).not.toBeVisible();
  });

  test('5. Should validate required fields', async ({ page }) => {
    // Select course
    await page.waitForSelector('#courseSelect option:not([value=""])', { timeout: 5000 });
    await page.selectOption('#courseSelect', { index: 1 });
    await page.waitForTimeout(1000);

    // Clear required fields
    await page.fill('#regularPrompt', '');
    await page.fill('#socraticPrompt', '');

    // Try to save
    await page.click('button:has-text("Save Configuration")');

    // Verify error message
    await expect(page.locator('#validationMessage')).toContainText('required', { timeout: 3000 });
  });

  test('6. Should update character counts in real-time', async ({ page }) => {
    const testText = 'This is a test prompt with some characters.';

    // Type in regular prompt
    await page.fill('#regularPrompt', testText);

    // Verify character count updates
    const charCount = await page.locator('#regularCharCount').textContent();
    expect(charCount).toContain(testText.length.toString());
  });
});

test.describe('Mode Analytics UI E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/admin/mode-analytics.html`);
  });

  test('7. Should load analytics page successfully', async ({ page }) => {
    // Verify page elements
    await expect(page.locator('.page-title')).toContainText('Mode Analytics');
    await expect(page.locator('#courseFilter')).toBeVisible();
    await expect(page.locator('#startDate')).toBeVisible();
    await expect(page.locator('#endDate')).toBeVisible();
  });

  test('8. Should load and display analytics data', async ({ page }) => {
    // Wait for courses to load
    await page.waitForSelector('#courseFilter option:not([value=""])', { timeout: 5000 });

    // Select first course
    await page.selectOption('#courseFilter', { index: 1 });

    // Click apply filters
    await page.click('button:has-text("Apply Filters")');

    // Wait for analytics to load
    await page.waitForTimeout(2000);

    // Verify analytics content is visible
    await expect(page.locator('#analyticsContent')).toBeVisible();
    await expect(page.locator('#totalSessions')).toBeVisible();
    await expect(page.locator('#activeUsers')).toBeVisible();
  });

  test('9. Should filter analytics by date range', async ({ page }) => {
    // Set custom date range
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const today = new Date();

    await page.fill('#startDate', yesterday.toISOString().split('T')[0]);
    await page.fill('#endDate', today.toISOString().split('T')[0]);

    // Select course
    await page.waitForSelector('#courseFilter option:not([value=""])', { timeout: 5000 });
    await page.selectOption('#courseFilter', { index: 1 });

    // Apply filters
    await page.click('button:has-text("Apply Filters")');
    await page.waitForTimeout(2000);

    // Verify data loaded for date range
    await expect(page.locator('#analyticsContent')).toBeVisible();
  });

  test('10. Should display charts correctly', async ({ page }) => {
    // Load analytics
    await page.waitForSelector('#courseFilter option:not([value=""])', { timeout: 5000 });
    await page.selectOption('#courseFilter', { index: 1 });
    await page.click('button:has-text("Apply Filters")');
    await page.waitForTimeout(2000);

    // Verify charts are rendered
    await expect(page.locator('#modeDistributionChart')).toBeVisible();
    await expect(page.locator('#sessionDurationChart')).toBeVisible();
    await expect(page.locator('#quizScoreChart')).toBeVisible();
    await expect(page.locator('#completionRateChart')).toBeVisible();
  });

  test('11. Should export analytics data', async ({ page }) => {
    // Load analytics
    await page.waitForSelector('#courseFilter option:not([value=""])', { timeout: 5000 });
    await page.selectOption('#courseFilter', { index: 1 });
    await page.click('button:has-text("Apply Filters")');
    await page.waitForTimeout(2000);

    // Set up download handler
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Export")')
    ]);

    // Verify download
    expect(download.suggestedFilename()).toContain('mode-analytics');
    expect(download.suggestedFilename()).toContain('.csv');
  });
});

test.describe('Chat UI with Mode Selector E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/admin/chat.html`);
  });

  test('12. Should display mode selector when module is selected', async ({ page }) => {
    // Initially mode selector should be hidden
    await expect(page.locator('#modeSelectorBar')).not.toBeVisible();

    // Select a module
    await page.waitForSelector('.module-item', { timeout: 5000 });
    await page.click('.module-item:first-child');

    // Verify mode selector appears
    await expect(page.locator('#modeSelectorBar')).toBeVisible();
    await expect(page.locator('#regularModeBtn')).toBeVisible();
    await expect(page.locator('#socraticModeBtn')).toBeVisible();
    await expect(page.locator('#modeHelp')).toBeVisible();
  });

  test('13. Should switch between Regular and Socratic modes', async ({ page }) => {
    // Select a module
    await page.waitForSelector('.module-item', { timeout: 5000 });
    await page.click('.module-item:first-child');
    await page.waitForTimeout(1000);

    // Verify Regular mode is active by default
    await expect(page.locator('#regularModeBtn')).toHaveClass(/active/);

    // Switch to Socratic mode
    await page.click('#socraticModeBtn');
    await page.waitForTimeout(1500);

    // Verify Socratic mode is now active
    await expect(page.locator('#socraticModeBtn')).toHaveClass(/active/);
    await expect(page.locator('#socraticModeBtn')).toHaveClass(/socratic/);
    await expect(page.locator('#modeIndicatorText')).toContainText('Socratic Mode Active');

    // Verify help text updated
    const helpText = await page.locator('#modeHelpText').textContent();
    expect(helpText).toContain('Socratic');

    // Verify system message in chat
    await expect(page.locator('.message.system')).toBeVisible();
    await expect(page.locator('.message.system')).toContainText('Switched to Socratic Mode');
  });

  test('14. Should update mode indicator when switching modes', async ({ page }) => {
    // Select a module
    await page.waitForSelector('.module-item', { timeout: 5000 });
    await page.click('.module-item:first-child');
    await page.waitForTimeout(1000);

    // Check initial state
    await expect(page.locator('#modeIndicatorDot')).not.toHaveClass(/socratic/);
    await expect(page.locator('#modeIndicatorText')).toContainText('Regular Mode Active');

    // Switch to Socratic
    await page.click('#socraticModeBtn');
    await page.waitForTimeout(1500);

    // Check updated state
    await expect(page.locator('#modeIndicatorDot')).toHaveClass(/socratic/);
    await expect(page.locator('#modeIndicatorText')).toContainText('Socratic Mode Active');

    // Switch back to Regular
    await page.click('#regularModeBtn');
    await page.waitForTimeout(1500);

    // Check state reverted
    await expect(page.locator('#modeIndicatorDot')).not.toHaveClass(/socratic/);
    await expect(page.locator('#modeIndicatorText')).toContainText('Regular Mode Active');
  });

  test('15. Should persist mode selection across module changes', async ({ page }) => {
    // Select first module
    await page.waitForSelector('.module-item', { timeout: 5000 });
    await page.click('.module-item:first-child');
    await page.waitForTimeout(1000);

    // Switch to Socratic mode
    await page.click('#socraticModeBtn');
    await page.waitForTimeout(1500);

    // Select second module (if exists)
    const moduleCount = await page.locator('.module-item').count();
    if (moduleCount > 1) {
      await page.click('.module-item:nth-child(2)');
      await page.waitForTimeout(1000);

      // Verify mode persists (should still be Socratic for same course)
      await expect(page.locator('#socraticModeBtn')).toHaveClass(/active/);
    }
  });
});

test.describe('Complete User Journey E2E Test', () => {
  test('16. Admin should configure bot, view analytics, and test chat with mode switching', async ({ page }) => {
    await loginAsAdmin(page);

    // Step 1: Configure bot
    await page.goto(`${BASE_URL}/admin/bot-config.html`);
    await page.waitForSelector('#courseSelect option:not([value=""])', { timeout: 5000 });
    await page.selectOption('#courseSelect', { index: 1 });
    await page.waitForTimeout(1000);

    const testPrompt = `E2E test prompt - ${Date.now()}`;
    await page.fill('#regularPrompt', testPrompt);
    await page.fill('#regularGreeting', 'E2E Test Welcome!');
    await page.click('button:has-text("Save Configuration")');
    await page.waitForSelector('#validationMessage:has-text("success")', { timeout: 5000 });

    // Step 2: View analytics
    await page.goto(`${BASE_URL}/admin/mode-analytics.html`);
    await page.waitForSelector('#courseFilter option:not([value=""])', { timeout: 5000 });
    await page.selectOption('#courseFilter', { index: 1 });
    await page.click('button:has-text("Apply Filters")');
    await page.waitForTimeout(2000);
    await expect(page.locator('#analyticsContent')).toBeVisible();
    await expect(page.locator('#totalSessions')).toBeVisible();

    // Step 3: Test chat with mode switching
    await page.goto(`${BASE_URL}/admin/chat.html`);
    await page.waitForSelector('.module-item', { timeout: 5000 });
    await page.click('.module-item:first-child');
    await page.waitForTimeout(1000);

    // Verify mode selector is visible
    await expect(page.locator('#modeSelectorBar')).toBeVisible();

    // Switch to Socratic mode
    await page.click('#socraticModeBtn');
    await page.waitForTimeout(1500);
    await expect(page.locator('#socraticModeBtn')).toHaveClass(/active/);

    // Send a test message
    await page.fill('#messageInput', 'What is classroom management?');
    await page.click('#sendButton');
    await page.waitForTimeout(1000);

    // Verify message appears
    await expect(page.locator('.message.user')).toBeVisible();

    // Switch back to Regular mode
    await page.click('#regularModeBtn');
    await page.waitForTimeout(1500);
    await expect(page.locator('#regularModeBtn')).toHaveClass(/active/);
    await expect(page.locator('.message.system')).toContainText('Regular Mode');
  });
});

module.exports = {
  name: 'Coaching Mode UI E2E Tests',
  description: 'End-to-end tests for bot configuration, analytics, and chat with mode switching'
};
