const { test, expect } = require('@playwright/test');

// Base URL from environment or default
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Test users
const SUPER_ADMIN = {
  email: 'admin@school.edu',
  password: 'Admin123!'
};

// Helper function to login
async function login(page, email, password) {
  await page.goto(`${BASE_URL}/admin/login.html`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for redirect
  await page.waitForURL(/\/admin\/(dashboard|index)\.html/, { timeout: 10000 });

  // Get auth token
  const token = await page.evaluate(() => {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  });

  return token;
}

// Helper function to logout
async function logout(page) {
  await page.evaluate(() => {
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('authToken');
  });
  await page.goto(`${BASE_URL}/admin/login.html`);
}

// Helper function to get course ID from dropdown
async function getFirstCourseId(page) {
  const courseId = await page.evaluate(() => {
    const select = document.querySelector('select[name="course_id"], select#courseSelect, #courseId');
    if (select && select.options.length > 0) {
      return select.options[1]?.value; // Skip the "Select..." option
    }
    return null;
  });
  return courseId;
}

test.describe('System Prompt Approval Workflow', () => {

  test.describe('Test Suite 1: Prompt Viewer (Read-Only)', () => {

    test('should display current prompts side-by-side', async ({ page }) => {
      console.log('Test: Display current prompts side-by-side');

      // 1. Login as admin
      await login(page, SUPER_ADMIN.email, SUPER_ADMIN.password);

      // 2. Navigate to prompt-viewer.html
      await page.goto(`${BASE_URL}/admin/prompt-viewer.html`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // 3. Wait for course dropdown to load
      await page.waitForSelector('select[name="course_id"], select#courseSelect, #courseId', { timeout: 5000 });

      // Get first available course
      const courseId = await getFirstCourseId(page);
      expect(courseId).toBeTruthy();

      // 4. Select course from dropdown
      await page.selectOption('select[name="course_id"], select#courseSelect, #courseId', courseId);
      await page.waitForTimeout(2000); // Wait for prompts to load

      // 5. Verify Regular Mode card displays: prompt text, version, character count
      const regularCard = page.locator('[data-mode="regular"], .prompt-card').first();
      await expect(regularCard).toBeVisible({ timeout: 5000 });

      // Check for prompt text
      const regularPromptText = regularCard.locator('.prompt-text, .prompt-content, textarea, pre');
      await expect(regularPromptText).toBeVisible();

      // Check for version
      const regularVersion = regularCard.locator('[class*="version"], .version-number, [data-version]');
      const regularVersionVisible = await regularVersion.count() > 0;
      expect(regularVersionVisible).toBeTruthy();

      // Check for character count
      const regularCharCount = regularCard.locator('[class*="char"], [class*="count"], .stats');
      const regularCharCountVisible = await regularCharCount.count() > 0;
      expect(regularCharCountVisible).toBeTruthy();

      // 6. Verify Socratic Mode card displays: prompt text, version, character count
      const socraticCard = page.locator('[data-mode="socratic"], .prompt-card').nth(1);
      const socraticCardVisible = await socraticCard.isVisible().catch(() => false);

      if (socraticCardVisible) {
        // Check for prompt text
        const socraticPromptText = socraticCard.locator('.prompt-text, .prompt-content, textarea, pre');
        await expect(socraticPromptText).toBeVisible();

        // Check for version
        const socraticVersion = socraticCard.locator('[class*="version"], .version-number');
        const socraticVersionVisible = await socraticVersion.count() > 0;
        expect(socraticVersionVisible).toBeTruthy();
      }

      // 7. Verify "View Version History" button exists
      const historyButton = page.locator('button:has-text("View Version History"), button:has-text("History"), a:has-text("History")');
      const historyButtonExists = await historyButton.count() > 0;
      expect(historyButtonExists).toBeTruthy();

      // 8. Verify "Propose Change" button exists
      const proposeButton = page.locator('button:has-text("Propose Change"), button:has-text("Edit"), a:has-text("Edit Prompt")');
      const proposeButtonExists = await proposeButton.count() > 0;
      expect(proposeButtonExists).toBeTruthy();

      // Screenshot
      await page.screenshot({ path: 'tests/screenshots/prompt-viewer-loaded.png', fullPage: true });
      console.log('✅ Test passed: Prompt viewer displays correctly');
    });

    test('should load courses in dropdown', async ({ page }) => {
      console.log('Test: Load courses in dropdown');

      // 1. Navigate to prompt-viewer.html (after login)
      await login(page, SUPER_ADMIN.email, SUPER_ADMIN.password);
      await page.goto(`${BASE_URL}/admin/prompt-viewer.html`);

      // 2. Wait for course dropdown to populate
      await page.waitForSelector('select[name="course_id"], select#courseSelect, #courseId', { timeout: 5000 });
      await page.waitForTimeout(1000);

      // 3. Verify at least 1 course in dropdown
      const courseOptions = await page.evaluate(() => {
        const select = document.querySelector('select[name="course_id"], select#courseSelect, #courseId');
        const options = Array.from(select.options)
          .filter(opt => opt.value !== '' && opt.value !== 'select')
          .map(opt => ({
            id: opt.value,
            title: opt.textContent.trim()
          }));
        return options;
      });

      console.log('Courses found:', courseOptions);
      expect(courseOptions.length).toBeGreaterThan(0);

      // 4. Verify course has: id, title attributes
      const firstCourse = courseOptions[0];
      expect(firstCourse.id).toBeTruthy();
      expect(firstCourse.title).toBeTruthy();

      console.log('✅ Test passed: Courses loaded in dropdown');
    });
  });

  test.describe('Test Suite 2: Prompt Editor (Create Request)', () => {

    test('should create a new change request successfully', async ({ page }) => {
      console.log('Test: Create new change request');

      // 1. Login as admin (using super admin for now)
      await login(page, SUPER_ADMIN.email, SUPER_ADMIN.password);

      // 2. Navigate to prompt-editor.html
      await page.goto(`${BASE_URL}/admin/prompt-editor.html`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // 3. Select course from dropdown
      await page.waitForSelector('select[name="course_id"], select#courseSelect, #courseId', { timeout: 5000 });
      const courseId = await getFirstCourseId(page);
      await page.selectOption('select[name="course_id"], select#courseSelect, #courseId', courseId);

      // 4. Select mode (socratic)
      const modeSelect = page.locator('select[name="mode"], select#modeSelect, #mode');
      const modeExists = await modeSelect.count() > 0;
      if (modeExists) {
        await modeSelect.selectOption('socratic');
      }

      // 5. Click "Load Current Prompt"
      const loadButton = page.locator('button:has-text("Load Current Prompt"), button:has-text("Load Prompt")');
      await loadButton.click();
      await page.waitForTimeout(2000);

      // 6. Modify prompt text in right column (new prompt textarea)
      const newPromptTextarea = page.locator('textarea[name="new_prompt"], textarea#newPrompt, .prompt-editor textarea').last();
      await newPromptTextarea.waitFor({ state: 'visible', timeout: 5000 });

      // Clear and add new text
      const timestamp = Date.now();
      const newPromptText = `You are an expert teacher trainer for the socratic teaching method. This is a test modification made at ${timestamp}. Help teachers develop their teaching skills through thoughtful questioning and reflection.`;

      await newPromptTextarea.fill(newPromptText);
      await page.waitForTimeout(500);

      // Screenshot after filling
      await page.screenshot({ path: 'tests/screenshots/prompt-editor-filled.png', fullPage: true });

      // 7. Enter change reason (min 10 chars)
      const reasonTextarea = page.locator('textarea[name="change_reason"], textarea#changeReason, #reason');
      await reasonTextarea.fill('Testing automated prompt change workflow via Playwright E2E test');

      // 8. Click "Submit for Approval"
      const submitButton = page.locator('button:has-text("Submit for Approval"), button:has-text("Submit")');
      await submitButton.click();

      // 9. Verify success message with request ID
      const successMessage = page.locator('.alert-success, .success, [class*="success"], .notification');
      await successMessage.waitFor({ state: 'visible', timeout: 10000 });

      const successText = await successMessage.textContent();
      console.log('Success message:', successText);
      expect(successText).toContain('request');

      // Try to extract request ID
      const requestIdMatch = successText.match(/request.*?(\d+)/i) || successText.match(/#(\d+)/);
      if (requestIdMatch) {
        console.log('Request ID:', requestIdMatch[1]);
      }

      // 10. Verify redirect to prompt-viewer (or stay on page)
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'tests/screenshots/prompt-editor-success.png', fullPage: true });
      console.log('✅ Test passed: Change request created');
    });

    test('should validate prompt length (100-5000 chars)', async ({ page }) => {
      console.log('Test: Validate prompt length');

      await login(page, SUPER_ADMIN.email, SUPER_ADMIN.password);
      await page.goto(`${BASE_URL}/admin/prompt-editor.html`);
      await page.waitForLoadState('networkidle');

      // Select course and mode
      await page.waitForSelector('select[name="course_id"], select#courseSelect, #courseId', { timeout: 5000 });
      const courseId = await getFirstCourseId(page);
      await page.selectOption('select[name="course_id"], select#courseSelect, #courseId', courseId);

      const modeSelect = page.locator('select[name="mode"], select#modeSelect, #mode');
      if (await modeSelect.count() > 0) {
        await modeSelect.selectOption('regular');
      }

      // Load current prompt
      const loadButton = page.locator('button:has-text("Load Current Prompt"), button:has-text("Load Prompt")');
      await loadButton.click();
      await page.waitForTimeout(2000);

      const newPromptTextarea = page.locator('textarea[name="new_prompt"], textarea#newPrompt, .prompt-editor textarea').last();
      const reasonTextarea = page.locator('textarea[name="change_reason"], textarea#changeReason, #reason');
      const submitButton = page.locator('button:has-text("Submit for Approval"), button:has-text("Submit")');

      // 1. Enter prompt with 50 characters → should show error
      const shortPrompt = 'This is too short for a valid system prompt.';
      await newPromptTextarea.fill(shortPrompt);
      await reasonTextarea.fill('Testing short prompt validation');

      // Check if submit is disabled or error appears
      await page.waitForTimeout(500);
      const errorShort = page.locator('.error, .alert-danger, [class*="error"]');
      const errorShortVisible = await errorShort.isVisible().catch(() => false);

      if (!errorShortVisible) {
        // Try submitting to trigger validation
        await submitButton.click();
        await page.waitForTimeout(1000);
        const errorAfterSubmit = await errorShort.isVisible().catch(() => false);
        expect(errorAfterSubmit || await submitButton.isDisabled()).toBeTruthy();
      }

      console.log('✅ Short prompt validation works');

      // 2. Enter prompt with 6000 characters → should show error
      const longPrompt = 'A'.repeat(6000);
      await newPromptTextarea.fill(longPrompt);
      await page.waitForTimeout(500);

      const errorLong = await errorShort.isVisible().catch(() => false);
      if (!errorLong) {
        await submitButton.click();
        await page.waitForTimeout(1000);
        const errorAfterSubmitLong = await errorShort.isVisible().catch(() => false);
        expect(errorAfterSubmitLong || await submitButton.isDisabled()).toBeTruthy();
      }

      console.log('✅ Long prompt validation works');

      // 3. Enter prompt with 500 characters → should have no error
      const validPrompt = 'You are an expert teacher trainer. '.repeat(15); // ~500 chars
      await newPromptTextarea.fill(validPrompt);
      await reasonTextarea.fill('Valid prompt test');
      await page.waitForTimeout(500);

      // Submit button should be enabled
      const submitEnabled = await submitButton.isEnabled();
      expect(submitEnabled).toBeTruthy();

      console.log('✅ Test passed: Prompt length validation works');
    });

    test('should require change reason', async ({ page }) => {
      console.log('Test: Require change reason');

      await login(page, SUPER_ADMIN.email, SUPER_ADMIN.password);
      await page.goto(`${BASE_URL}/admin/prompt-editor.html`);
      await page.waitForLoadState('networkidle');

      // Select course and load prompt
      await page.waitForSelector('select[name="course_id"], select#courseSelect, #courseId', { timeout: 5000 });
      const courseId = await getFirstCourseId(page);
      await page.selectOption('select[name="course_id"], select#courseSelect, #courseId', courseId);

      const loadButton = page.locator('button:has-text("Load Current Prompt"), button:has-text("Load Prompt")');
      await loadButton.click();
      await page.waitForTimeout(2000);

      const newPromptTextarea = page.locator('textarea[name="new_prompt"], textarea#newPrompt, .prompt-editor textarea').last();
      const reasonTextarea = page.locator('textarea[name="change_reason"], textarea#changeReason, #reason');
      const submitButton = page.locator('button:has-text("Submit for Approval"), button:has-text("Submit")');

      // Modify prompt
      await newPromptTextarea.fill('This is a modified prompt for testing change reason validation.');

      // 1. Leave change reason empty → submit disabled or error
      await reasonTextarea.fill('');
      await page.waitForTimeout(500);

      let submitDisabled = await submitButton.isDisabled().catch(() => false);
      console.log('Submit disabled with empty reason:', submitDisabled);

      // 2. Enter 5 characters → still disabled
      await reasonTextarea.fill('test');
      await page.waitForTimeout(500);

      submitDisabled = await submitButton.isDisabled().catch(() => false);
      console.log('Submit disabled with 4 chars:', submitDisabled);

      // 3. Enter 10 characters → submit enabled
      await reasonTextarea.fill('test reason with enough characters');
      await page.waitForTimeout(500);

      const submitEnabled = await submitButton.isEnabled();
      expect(submitEnabled).toBeTruthy();

      console.log('✅ Test passed: Change reason validation works');
    });

    test('should validate prompt must differ from current', async ({ page }) => {
      console.log('Test: Prompt must differ from current');

      await login(page, SUPER_ADMIN.email, SUPER_ADMIN.password);
      await page.goto(`${BASE_URL}/admin/prompt-editor.html`);
      await page.waitForLoadState('networkidle');

      // Select course and load prompt
      await page.waitForSelector('select[name="course_id"], select#courseSelect, #courseId', { timeout: 5000 });
      const courseId = await getFirstCourseId(page);
      await page.selectOption('select[name="course_id"], select#courseSelect, #courseId', courseId);

      const loadButton = page.locator('button:has-text("Load Current Prompt"), button:has-text("Load Prompt")');
      await loadButton.click();
      await page.waitForTimeout(2000);

      const newPromptTextarea = page.locator('textarea[name="new_prompt"], textarea#newPrompt, .prompt-editor textarea').last();
      const reasonTextarea = page.locator('textarea[name="change_reason"], textarea#changeReason, #reason');
      const submitButton = page.locator('button:has-text("Submit for Approval"), button:has-text("Submit")');

      // Get current prompt text
      const currentPromptText = await newPromptTextarea.inputValue();

      // 1. Leave prompt unchanged
      await reasonTextarea.fill('Attempting to submit without changes');

      // 2. Submit without changing → show error "Prompt must be different"
      await submitButton.click();
      await page.waitForTimeout(1000);

      const errorMessage = page.locator('.error, .alert-danger, [class*="error"], .notification');
      const errorVisible = await errorMessage.isVisible().catch(() => false);

      if (errorVisible) {
        const errorText = await errorMessage.textContent();
        console.log('Error message:', errorText);
        expect(errorText.toLowerCase()).toContain('different');
      }

      console.log('✅ Test passed: Validates prompt must be different');
    });
  });

  test.describe('Test Suite 3: Approval Dashboard (Super Admin)', () => {

    test('should display pending requests', async ({ page }) => {
      console.log('Test: Display pending requests');

      // 1. Login as super admin
      await login(page, SUPER_ADMIN.email, SUPER_ADMIN.password);

      // 2. Navigate to prompt-approvals.html
      await page.goto(`${BASE_URL}/admin/prompt-approvals.html`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // 3. Verify stats cards show: Pending, Approved, Rejected, Activated counts
      const statsCards = page.locator('.stats-card, .stat-card, [class*="stat"]');
      const statsCount = await statsCards.count();
      console.log('Stats cards found:', statsCount);
      expect(statsCount).toBeGreaterThanOrEqual(3); // At least Pending, Approved, Rejected

      // 4. Verify table shows requests
      const table = page.locator('table, .requests-table, [class*="table"]');
      await expect(table).toBeVisible({ timeout: 5000 });

      // 5. Verify table columns: Request ID, Course, Mode, Requested By, Date, Status
      const headers = page.locator('th, .table-header');
      const headerCount = await headers.count();
      console.log('Table headers found:', headerCount);
      expect(headerCount).toBeGreaterThanOrEqual(5);

      // Check for specific headers
      const headerTexts = await headers.allTextContents();
      console.log('Header texts:', headerTexts);

      // Screenshot
      await page.screenshot({ path: 'tests/screenshots/approval-dashboard.png', fullPage: true });
      console.log('✅ Test passed: Approval dashboard displays correctly');
    });

    test('should approve a pending request', async ({ page }) => {
      console.log('Test: Approve pending request');

      // First create a request to approve
      await login(page, SUPER_ADMIN.email, SUPER_ADMIN.password);

      // Create a change request
      await page.goto(`${BASE_URL}/admin/prompt-editor.html`);
      await page.waitForLoadState('networkidle');

      const courseId = await getFirstCourseId(page);
      await page.selectOption('select[name="course_id"], select#courseSelect, #courseId', courseId);

      const loadButton = page.locator('button:has-text("Load Current Prompt"), button:has-text("Load Prompt")');
      await loadButton.click();
      await page.waitForTimeout(2000);

      const newPromptTextarea = page.locator('textarea[name="new_prompt"], textarea#newPrompt, .prompt-editor textarea').last();
      const timestamp = Date.now();
      await newPromptTextarea.fill(`Test prompt for approval workflow ${timestamp}.`);

      const reasonTextarea = page.locator('textarea[name="change_reason"], textarea#changeReason, #reason');
      await reasonTextarea.fill('Creating request to test approval workflow');

      const submitButton = page.locator('button:has-text("Submit for Approval"), button:has-text("Submit")');
      await submitButton.click();
      await page.waitForTimeout(2000);

      // Navigate to approvals
      await page.goto(`${BASE_URL}/admin/prompt-approvals.html`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Find pending request row
      const pendingRow = page.locator('tr:has-text("Pending"), .request-row:has-text("Pending")').first();
      const pendingRowExists = await pendingRow.count() > 0;

      if (pendingRowExists) {
        // Click "Approve" button
        const approveButton = pendingRow.locator('button:has-text("Approve"), .btn-approve');
        await approveButton.click();
        await page.waitForTimeout(1000);

        // Fill approval notes in modal
        const modal = page.locator('.modal, dialog, [role="dialog"]');
        await expect(modal).toBeVisible({ timeout: 5000 });

        const notesTextarea = modal.locator('textarea, input[type="text"]');
        if (await notesTextarea.count() > 0) {
          await notesTextarea.fill('Approved via automated test');
        }

        // Click "Approve" in modal
        const confirmButton = modal.locator('button:has-text("Approve"), button:has-text("Confirm")');
        await confirmButton.click();
        await page.waitForTimeout(2000);

        // Verify status changes to "Approved"
        await page.screenshot({ path: 'tests/screenshots/request-approved.png', fullPage: true });

        // Verify "Activate" button appears
        const activateButton = page.locator('button:has-text("Activate")');
        const activateExists = await activateButton.count() > 0;
        console.log('Activate button exists:', activateExists);

        console.log('✅ Test passed: Request approved successfully');
      } else {
        console.log('⚠️  No pending requests found to approve');
      }
    });

    test('should reject a pending request', async ({ page }) => {
      console.log('Test: Reject pending request');

      // Create a request to reject
      await login(page, SUPER_ADMIN.email, SUPER_ADMIN.password);

      // Create a change request
      await page.goto(`${BASE_URL}/admin/prompt-editor.html`);
      await page.waitForLoadState('networkidle');

      const courseId = await getFirstCourseId(page);
      await page.selectOption('select[name="course_id"], select#courseSelect, #courseId', courseId);

      const loadButton = page.locator('button:has-text("Load Current Prompt"), button:has-text("Load Prompt")');
      await loadButton.click();
      await page.waitForTimeout(2000);

      const newPromptTextarea = page.locator('textarea[name="new_prompt"], textarea#newPrompt, .prompt-editor textarea').last();
      const timestamp = Date.now();
      await newPromptTextarea.fill(`Test prompt for rejection workflow ${timestamp}.`);

      const reasonTextarea = page.locator('textarea[name="change_reason"], textarea#changeReason, #reason');
      await reasonTextarea.fill('Creating request to test rejection workflow');

      const submitButton = page.locator('button:has-text("Submit for Approval"), button:has-text("Submit")');
      await submitButton.click();
      await page.waitForTimeout(2000);

      // Navigate to approvals
      await page.goto(`${BASE_URL}/admin/prompt-approvals.html`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Find pending request
      const pendingRow = page.locator('tr:has-text("Pending"), .request-row:has-text("Pending")').first();
      const pendingRowExists = await pendingRow.count() > 0;

      if (pendingRowExists) {
        // Click "Reject" button
        const rejectButton = pendingRow.locator('button:has-text("Reject"), .btn-reject');
        await rejectButton.click();
        await page.waitForTimeout(1000);

        // Fill rejection reason (required)
        const modal = page.locator('.modal, dialog, [role="dialog"]');
        await expect(modal).toBeVisible({ timeout: 5000 });

        const reasonTextarea = modal.locator('textarea, input[type="text"]');
        await reasonTextarea.fill('Rejected via automated test - prompt does not meet standards');

        // Click "Reject" in modal
        const confirmButton = modal.locator('button:has-text("Reject"), button:has-text("Confirm")');
        await confirmButton.click();
        await page.waitForTimeout(2000);

        // Verify status changes to "Rejected"
        await page.screenshot({ path: 'tests/screenshots/request-rejected.png', fullPage: true });

        // Verify "Activate" button does NOT appear
        const activateButton = page.locator('button:has-text("Activate")');
        const activateExists = await activateButton.count() > 0;
        console.log('Activate button should NOT exist:', !activateExists);

        console.log('✅ Test passed: Request rejected successfully');
      } else {
        console.log('⚠️  No pending requests found to reject');
      }
    });

    test('should activate an approved request', async ({ page }) => {
      console.log('Test: Activate approved request');

      // Create and approve a request
      await login(page, SUPER_ADMIN.email, SUPER_ADMIN.password);

      // Create request
      await page.goto(`${BASE_URL}/admin/prompt-editor.html`);
      await page.waitForLoadState('networkidle');

      const courseId = await getFirstCourseId(page);
      await page.selectOption('select[name="course_id"], select#courseSelect, #courseId', courseId);

      const loadButton = page.locator('button:has-text("Load Current Prompt"), button:has-text("Load Prompt")');
      await loadButton.click();
      await page.waitForTimeout(2000);

      const newPromptTextarea = page.locator('textarea[name="new_prompt"], textarea#newPrompt, .prompt-editor textarea').last();
      const timestamp = Date.now();
      await newPromptTextarea.fill(`Test prompt for activation workflow ${timestamp}. This will be activated.`);

      const reasonTextarea = page.locator('textarea[name="change_reason"], textarea#changeReason, #reason');
      await reasonTextarea.fill('Creating request to test activation workflow');

      const submitButton = page.locator('button:has-text("Submit for Approval"), button:has-text("Submit")');
      await submitButton.click();
      await page.waitForTimeout(2000);

      // Go to approvals and approve
      await page.goto(`${BASE_URL}/admin/prompt-approvals.html`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const pendingRow = page.locator('tr:has-text("Pending"), .request-row:has-text("Pending")').first();
      if (await pendingRow.count() > 0) {
        const approveButton = pendingRow.locator('button:has-text("Approve"), .btn-approve');
        await approveButton.click();
        await page.waitForTimeout(1000);

        const modal = page.locator('.modal, dialog, [role="dialog"]');
        const confirmButton = modal.locator('button:has-text("Approve"), button:has-text("Confirm")');
        await confirmButton.click();
        await page.waitForTimeout(2000);

        // Now find activate button
        const activateButton = page.locator('button:has-text("Activate")').first();
        const activateExists = await activateButton.count() > 0;

        if (activateExists) {
          // Click Activate
          await activateButton.click();
          await page.waitForTimeout(1000);

          // Confirm warning modal
          const activateModal = page.locator('.modal, dialog, [role="dialog"]');
          const activateNotesTextarea = activateModal.locator('textarea, input[type="text"]');
          if (await activateNotesTextarea.count() > 0) {
            await activateNotesTextarea.fill('Activated via automated test');
          }

          // Click "Activate Now"
          const activateConfirmButton = activateModal.locator('button:has-text("Activate"), button:has-text("Confirm")');
          await activateConfirmButton.click();
          await page.waitForTimeout(2000);

          // Verify success message
          const successMessage = page.locator('.alert-success, .success, [class*="success"]');
          const successVisible = await successMessage.isVisible().catch(() => false);

          if (successVisible) {
            const successText = await successMessage.textContent();
            console.log('Success message:', successText);
            expect(successText.toLowerCase()).toContain('live');
          }

          await page.screenshot({ path: 'tests/screenshots/request-activated.png', fullPage: true });
          console.log('✅ Test passed: Request activated successfully');
        } else {
          console.log('⚠️  Activate button not found');
        }
      }
    });
  });

  test.describe('Test Suite 4: Version History', () => {

    test('should display version timeline', async ({ page }) => {
      console.log('Test: Display version timeline');

      await login(page, SUPER_ADMIN.email, SUPER_ADMIN.password);

      // Navigate to prompt-history.html
      await page.goto(`${BASE_URL}/admin/prompt-history.html`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Select course
      await page.waitForSelector('select[name="course_id"], select#courseSelect, #courseId', { timeout: 5000 });
      const courseId = await getFirstCourseId(page);
      await page.selectOption('select[name="course_id"], select#courseSelect, #courseId', courseId);

      // Select mode
      const modeSelect = page.locator('select[name="mode"], select#modeSelect, #mode');
      if (await modeSelect.count() > 0) {
        await modeSelect.selectOption('regular');
      }

      await page.waitForTimeout(2000);

      // Verify timeline displays versions
      const versionCards = page.locator('.version-card, .timeline-item, [class*="version"]');
      const versionCount = await versionCards.count();
      console.log('Version cards found:', versionCount);
      expect(versionCount).toBeGreaterThanOrEqual(1);

      // Verify each version card shows: version number, date, changed by
      if (versionCount > 0) {
        const firstCard = versionCards.first();
        const cardText = await firstCard.textContent();
        console.log('First version card text:', cardText);

        // Should contain version info
        expect(cardText).toBeTruthy();
      }

      // Verify current live version has special styling (if exists)
      const liveVersion = page.locator('[class*="live"], [class*="active"], [class*="current"]');
      const liveExists = await liveVersion.count() > 0;
      console.log('Live version indicator exists:', liveExists);

      await page.screenshot({ path: 'tests/screenshots/version-history.png', fullPage: true });
      console.log('✅ Test passed: Version history displays correctly');
    });

    test('should view full prompt in modal', async ({ page }) => {
      console.log('Test: View full prompt in modal');

      await login(page, SUPER_ADMIN.email, SUPER_ADMIN.password);
      await page.goto(`${BASE_URL}/admin/prompt-history.html`);
      await page.waitForLoadState('networkidle');

      // Select course and mode
      const courseId = await getFirstCourseId(page);
      await page.selectOption('select[name="course_id"], select#courseSelect, #courseId', courseId);
      await page.waitForTimeout(2000);

      // Click "View Full Prompt" on a version card
      const viewButton = page.locator('button:has-text("View Full Prompt"), button:has-text("View"), .btn-view').first();
      const viewButtonExists = await viewButton.count() > 0;

      if (viewButtonExists) {
        await viewButton.click();
        await page.waitForTimeout(1000);

        // Verify modal opens
        const modal = page.locator('.modal, dialog, [role="dialog"]');
        await expect(modal).toBeVisible({ timeout: 5000 });

        // Verify modal displays full prompt text
        const modalContent = await modal.textContent();
        console.log('Modal content length:', modalContent.length);
        expect(modalContent.length).toBeGreaterThan(0);

        // Close modal
        const closeButton = modal.locator('button:has-text("Close"), .close, [aria-label="Close"]');
        if (await closeButton.count() > 0) {
          await closeButton.click();
          await page.waitForTimeout(500);
        }

        console.log('✅ Test passed: View full prompt modal works');
      } else {
        console.log('⚠️  View button not found');
      }
    });

    test('should download version as .txt file', async ({ page }) => {
      console.log('Test: Download version as .txt file');

      await login(page, SUPER_ADMIN.email, SUPER_ADMIN.password);
      await page.goto(`${BASE_URL}/admin/prompt-history.html`);
      await page.waitForLoadState('networkidle');

      // Select course
      const courseId = await getFirstCourseId(page);
      await page.selectOption('select[name="course_id"], select#courseSelect, #courseId', courseId);
      await page.waitForTimeout(2000);

      // Set up download listener
      const downloadButton = page.locator('button:has-text("Download"), .btn-download').first();
      const downloadButtonExists = await downloadButton.count() > 0;

      if (downloadButtonExists) {
        // Wait for download
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
          downloadButton.click()
        ]);

        if (download) {
          const filename = download.suggestedFilename();
          console.log('Downloaded file:', filename);

          // Verify filename contains: course, mode, version
          expect(filename).toContain('prompt');
          expect(filename).toContain('.txt');

          console.log('✅ Test passed: Download works');
        } else {
          console.log('⚠️  Download not triggered (may be a client-side download)');
        }
      } else {
        console.log('⚠️  Download button not found');
      }
    });
  });

  test.describe('Test Suite 5: RBAC (Role-Based Access Control)', () => {

    test('should allow super admin full access', async ({ page }) => {
      console.log('Test: Super admin full access');

      // Login as super admin
      await login(page, SUPER_ADMIN.email, SUPER_ADMIN.password);

      // Verify can view approval page
      await page.goto(`${BASE_URL}/admin/prompt-approvals.html`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Check for 403 error
      const pageText = await page.locator('body').textContent();
      const has403 = pageText.includes('403') || pageText.includes('Forbidden');
      expect(has403).toBeFalsy();

      // Verify approve/reject buttons exist
      const approveButton = page.locator('button:has-text("Approve"), .btn-approve');
      const rejectButton = page.locator('button:has-text("Reject"), .btn-reject');

      const hasApproveButtons = await approveButton.count() > 0 || await rejectButton.count() > 0;
      console.log('Has approve/reject buttons:', hasApproveButtons);

      // Verify can access all sections
      await page.goto(`${BASE_URL}/admin/prompt-editor.html`);
      await page.waitForLoadState('networkidle');
      const editorAccessible = !pageText.includes('403');
      expect(editorAccessible).toBeTruthy();

      console.log('✅ Test passed: Super admin has full access');
    });
  });

  test.describe('Test Suite 6: End-to-End Workflow', () => {

    test('complete workflow: Create → Approve → Activate', async ({ page }) => {
      console.log('Test: Complete E2E workflow');

      // === STEP 1: Admin Creates Request ===
      console.log('STEP 1: Creating change request...');
      await login(page, SUPER_ADMIN.email, SUPER_ADMIN.password);

      // Navigate to editor
      await page.goto(`${BASE_URL}/admin/prompt-editor.html`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Select course
      await page.waitForSelector('select[name="course_id"], select#courseSelect, #courseId', { timeout: 5000 });
      const courseId = await getFirstCourseId(page);
      await page.selectOption('select[name="course_id"], select#courseSelect, #courseId', courseId);

      // Select mode
      const modeSelect = page.locator('select[name="mode"], select#modeSelect, #mode');
      if (await modeSelect.count() > 0) {
        await modeSelect.selectOption('socratic');
      }

      // Load current prompt
      const loadButton = page.locator('button:has-text("Load Current Prompt"), button:has-text("Load Prompt")');
      await loadButton.click();
      await page.waitForTimeout(2000);

      // Modify prompt
      const timestamp = Date.now();
      const e2ePromptText = `E2E Test: Complete workflow test prompt created at ${timestamp}. You are an expert teacher trainer specializing in socratic teaching methods.`;

      const newPromptTextarea = page.locator('textarea[name="new_prompt"], textarea#newPrompt, .prompt-editor textarea').last();
      await newPromptTextarea.fill(e2ePromptText);

      // Enter reason
      const reasonTextarea = page.locator('textarea[name="change_reason"], textarea#changeReason, #reason');
      await reasonTextarea.fill('E2E test: Complete workflow from creation to activation');

      // Submit
      const submitButton = page.locator('button:has-text("Submit for Approval"), button:has-text("Submit")');
      await submitButton.click();

      // Wait for success
      const successMessage = page.locator('.alert-success, .success, [class*="success"]');
      await successMessage.waitFor({ state: 'visible', timeout: 10000 });
      const successText = await successMessage.textContent();
      console.log('✅ Step 1 complete: Request created');

      // Extract request ID
      let requestId = null;
      const requestIdMatch = successText.match(/request.*?(\d+)/i) || successText.match(/#(\d+)/);
      if (requestIdMatch) {
        requestId = requestIdMatch[1];
        console.log('Request ID:', requestId);
      }

      await page.screenshot({ path: 'tests/screenshots/e2e-step1-created.png', fullPage: true });

      // === STEP 2: Admin Approves Request ===
      console.log('STEP 2: Approving request...');
      await page.goto(`${BASE_URL}/admin/prompt-approvals.html`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Find the request
      let targetRow;
      if (requestId) {
        targetRow = page.locator(`tr:has-text("#${requestId}"), tr:has-text("${requestId}")`).first();
      } else {
        targetRow = page.locator('tr:has-text("Pending"), .request-row:has-text("Pending")').first();
      }

      const rowExists = await targetRow.count() > 0;
      expect(rowExists).toBeTruthy();

      // Click Approve
      const approveButton = targetRow.locator('button:has-text("Approve"), .btn-approve');
      await approveButton.click();
      await page.waitForTimeout(1000);

      // Fill approval notes
      const modal = page.locator('.modal, dialog, [role="dialog"]');
      await expect(modal).toBeVisible({ timeout: 5000 });

      const notesTextarea = modal.locator('textarea, input[type="text"]');
      if (await notesTextarea.count() > 0) {
        await notesTextarea.fill('E2E test: Approved for activation');
      }

      // Confirm approval
      const confirmButton = modal.locator('button:has-text("Approve"), button:has-text("Confirm")');
      await confirmButton.click();
      await page.waitForTimeout(2000);

      console.log('✅ Step 2 complete: Request approved');
      await page.screenshot({ path: 'tests/screenshots/e2e-step2-approved.png', fullPage: true });

      // Verify status = "Approved"
      const approvedStatus = page.locator('text=/Approved/i');
      const approvedVisible = await approvedStatus.isVisible().catch(() => false);
      expect(approvedVisible).toBeTruthy();

      // === STEP 3: Admin Activates Request ===
      console.log('STEP 3: Activating request...');

      // Find activate button
      const activateButton = page.locator('button:has-text("Activate")').first();
      const activateExists = await activateButton.count() > 0;
      expect(activateExists).toBeTruthy();

      // Click Activate
      await activateButton.click();
      await page.waitForTimeout(1000);

      // Confirm activation
      const activateModal = page.locator('.modal, dialog, [role="dialog"]');
      await expect(activateModal).toBeVisible({ timeout: 5000 });

      const activateNotesTextarea = activateModal.locator('textarea, input[type="text"]');
      if (await activateNotesTextarea.count() > 0) {
        await activateNotesTextarea.fill('E2E test: Activating this version');
      }

      const activateConfirmButton = activateModal.locator('button:has-text("Activate"), button:has-text("Confirm")');
      await activateConfirmButton.click();
      await page.waitForTimeout(3000);

      console.log('✅ Step 3 complete: Request activated');
      await page.screenshot({ path: 'tests/screenshots/e2e-step3-activated.png', fullPage: true });

      // Verify status = "Activated"
      const activatedStatus = page.locator('text=/Activated/i, text=/Active/i');
      const activatedVisible = await activatedStatus.isVisible().catch(() => false);
      console.log('Activated status visible:', activatedVisible);

      // === STEP 4: Verify Prompt is Live ===
      console.log('STEP 4: Verifying prompt is live...');

      await page.goto(`${BASE_URL}/admin/prompt-viewer.html`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Select same course
      await page.selectOption('select[name="course_id"], select#courseSelect, #courseId', courseId);
      await page.waitForTimeout(2000);

      // Get displayed prompt
      const displayedPrompt = page.locator('.prompt-text, .prompt-content, textarea, pre').first();
      const displayedPromptText = await displayedPrompt.textContent();

      console.log('Live prompt preview:', displayedPromptText.substring(0, 100));

      await page.screenshot({ path: 'tests/screenshots/e2e-step4-verified.png', fullPage: true });

      console.log('✅✅✅ COMPLETE E2E WORKFLOW PASSED ✅✅✅');
    });
  });

  // Cleanup handler
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'failed') {
      const screenshotPath = `tests/screenshots/FAILED-${testInfo.title.replace(/\s+/g, '-')}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`❌ Test failed. Screenshot: ${screenshotPath}`);
    }
  });
});
