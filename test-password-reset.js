const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://34.162.168.124:3000';

async function testPasswordReset() {
  console.log('='.repeat(80));
  console.log('TEST: Password Reset for Admin Users');
  console.log('='.repeat(80));
  console.log();

  const browser = await chromium.launch({ headless: false, slowMo: 500 });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // ============================================
    // STEP 1: Login as Super Admin
    // ============================================
    console.log('📝 STEP 1: Login as Super Admin');
    console.log('-'.repeat(80));

    await page.goto(`${BASE_URL}/admin/login.html`);
    await page.fill('#email', 'Lynda@admin.com');
    await page.fill('#password', 'Admin123!');
    await page.click('button[type="submit"]');

    await page.waitForURL(/dashboard\.html/, { timeout: 10000 });
    const token = await page.evaluate(() => localStorage.getItem('adminToken'));
    const adminUser = await page.evaluate(() => localStorage.getItem('adminUser'));

    console.log('✅ Logged in successfully');
    console.log(`Token: ${token.substring(0, 20)}...`);
    console.log(`Admin User: ${adminUser}`);

    // Parse and check role
    try {
      const user = JSON.parse(adminUser);
      console.log(`  Name: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Role ID: ${user.role_id}`);
    } catch (e) {
      console.log('  Could not parse admin user');
    }
    console.log();

    // ============================================
    // STEP 2: Navigate to Admin Users & RBAC
    // ============================================
    console.log('📝 STEP 2: Navigate to Admin Users & RBAC');
    console.log('-'.repeat(80));

    await page.goto(`${BASE_URL}/admin/admin-users-rbac.html`);
    await page.waitForSelector('tbody tr', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const userCount = await page.locator('tbody tr').count();
    console.log(`✅ Page loaded with ${userCount} admin users`);
    console.log();

    // ============================================
    // STEP 3: Find test1 user
    // ============================================
    console.log('📝 STEP 3: Find test1 user');
    console.log('-'.repeat(80));

    const test1Row = page.locator('tbody tr', {
      hasText: 'test1@school.edu'
    });

    const test1Exists = await test1Row.count() > 0;
    console.log(`test1 user exists: ${test1Exists}`);

    if (!test1Exists) {
      console.log('❌ test1 user not found. Please create test1 user first.');
      await browser.close();
      process.exit(1);
    }
    console.log('✅ test1 user found');
    console.log();

    // ============================================
    // STEP 4: Open dropdown menu for test1
    // ============================================
    console.log('📝 STEP 4: Open dropdown menu for test1');
    console.log('-'.repeat(80));

    const dropdownToggle = test1Row.locator('.dropdown-toggle');
    await dropdownToggle.click();
    await page.waitForTimeout(500);

    const dropdownVisible = await page.locator('.dropdown-menu.show').isVisible();
    console.log(`Dropdown visible: ${dropdownVisible}`);

    if (!dropdownVisible) {
      console.log('❌ Dropdown did not open');
      await page.screenshot({ path: 'dropdown-not-visible.png', fullPage: true });
      await browser.close();
      process.exit(1);
    }

    console.log('✅ Dropdown menu opened');
    console.log();

    // Take screenshot of dropdown
    await page.screenshot({ path: 'dropdown-menu-visible.png', fullPage: true });
    console.log('📸 Screenshot: dropdown-menu-visible.png');
    console.log();

    // ============================================
    // STEP 5: Click "Reset Password"
    // ============================================
    console.log('📝 STEP 5: Click "Reset Password"');
    console.log('-'.repeat(80));

    // Set up dialog handler for confirmation
    page.on('dialog', async dialog => {
      console.log(`Confirmation dialog: ${dialog.message().substring(0, 50)}...`);
      await dialog.accept();
      console.log('✅ Confirmed password reset');
    });

    // Capture console errors
    const consoleMessages = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleMessages.push(msg.text());
      }
    });

    await page.click('button.dropdown-item:has-text("Reset Password")');
    await page.waitForTimeout(3000);

    // Check for error alerts
    const alertContainer = await page.textContent('#alertContainer').catch(() => '');
    if (alertContainer.trim()) {
      console.log(`Alert message: ${alertContainer}`);
    }

    // Check for console errors
    if (consoleMessages.length > 0) {
      console.log('Console errors:');
      consoleMessages.forEach(msg => console.log(`  - ${msg}`));
    }

    console.log();

    // ============================================
    // STEP 6: Verify password reset modal appears
    // ============================================
    console.log('📝 STEP 6: Verify password reset modal');
    console.log('-'.repeat(80));

    const modalVisible = await page.locator('#passwordResetModal.active').isVisible();
    console.log(`Modal visible: ${modalVisible}`);

    if (!modalVisible) {
      console.log('❌ Password reset modal did not appear');
      await page.screenshot({ path: 'modal-not-visible.png', fullPage: true });
      await browser.close();
      process.exit(1);
    }

    console.log('✅ Password reset modal appeared');
    console.log();

    // Get the generated password
    const generatedPassword = await page.textContent('#generatedPassword');
    console.log(`Generated password: ${generatedPassword}`);
    console.log();

    // Verify password format (should be like "Admin2025!Xyz")
    const passwordRegex = /^Admin\d{4}[!@#$%^&*][A-Za-z0-9]{3}$/;
    const isValidFormat = passwordRegex.test(generatedPassword);
    console.log(`Password format valid: ${isValidFormat}`);

    if (!isValidFormat) {
      console.log(`⚠️  Unexpected password format: ${generatedPassword}`);
    } else {
      console.log('✅ Password format matches expected pattern');
    }
    console.log();

    // Take screenshot of modal
    await page.screenshot({ path: 'password-reset-modal.png', fullPage: true });
    console.log('📸 Screenshot: password-reset-modal.png');
    console.log();

    // ============================================
    // STEP 7: Copy password to clipboard
    // ============================================
    console.log('📝 STEP 7: Copy password to clipboard');
    console.log('-'.repeat(80));

    await page.click('#copyPasswordBtn');
    await page.waitForTimeout(500);

    const copyBtnText = await page.textContent('#copyPasswordBtn');
    console.log(`Copy button text after click: "${copyBtnText}"`);

    if (copyBtnText.includes('Copied')) {
      console.log('✅ Password copied to clipboard');
    } else {
      console.log('⚠️  Copy button did not update');
    }
    console.log();

    // Wait to see the button change
    await page.waitForTimeout(2500);

    // ============================================
    // STEP 8: Close modal
    // ============================================
    console.log('📝 STEP 8: Close modal');
    console.log('-'.repeat(80));

    await page.click('button:has-text("Done")');
    await page.waitForTimeout(500);

    const modalStillVisible = await page.locator('#passwordResetModal.active').isVisible();
    if (!modalStillVisible) {
      console.log('✅ Modal closed successfully');
    } else {
      console.log('❌ Modal still visible');
    }
    console.log();

    // ============================================
    // STEP 9: Test login with new password
    // ============================================
    console.log('📝 STEP 9: Test login with new password');
    console.log('-'.repeat(80));

    // Logout
    await page.click('button:has-text("Logout")');
    await page.waitForURL(/login\.html/, { timeout: 5000 });
    console.log('✅ Logged out');

    // Try to login with new password
    await page.fill('#email', 'test1@school.edu');
    await page.fill('#password', generatedPassword);
    await page.click('button[type="submit"]');

    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    if (currentUrl.includes('dashboard.html')) {
      console.log('✅ Successfully logged in with new password!');
    } else {
      console.log(`⚠️  Login with new password failed or redirected to: ${currentUrl}`);
    }
    console.log();

    // ============================================
    // SUMMARY
    // ============================================
    console.log('='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    console.log('✅ Login as Super Admin successful');
    console.log('✅ Admin Users & RBAC page loaded');
    console.log(`✅ test1 user found`);
    console.log(`${dropdownVisible ? '✅' : '❌'} Dropdown menu opened`);
    console.log(`${modalVisible ? '✅' : '❌'} Password reset modal appeared`);
    console.log(`✅ Generated password: ${generatedPassword}`);
    console.log(`${isValidFormat ? '✅' : '⚠️'} Password format ${isValidFormat ? 'valid' : 'unexpected'}`);
    console.log(`${copyBtnText.includes('Copied') ? '✅' : '⚠️'} Copy to clipboard ${copyBtnText.includes('Copied') ? 'worked' : 'uncertain'}`);
    console.log(`${!modalStillVisible ? '✅' : '❌'} Modal closed`);
    console.log();

    if (dropdownVisible && modalVisible && isValidFormat && !modalStillVisible) {
      console.log('🎉 ALL TESTS PASSED!');
    } else {
      console.log('⚠️  Some tests had issues - check logs above');
    }
    console.log();

    await page.waitForTimeout(3000);
    await context.close();

  } catch (error) {
    console.error('\\n❌ TEST FAILED:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run test
testPasswordReset().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
