const { chromium } = require('playwright');

async function captureScreenshots() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const BASE_URL = 'http://34.162.168.124:3000';

  console.log('=========================================');
  console.log('Capturing UI Screenshots');
  console.log('=========================================\n');

  try {
    // Step 1: Login
    console.log('📝 Step 1: Logging in...');
    await page.goto(`${BASE_URL}/admin/login.html`);
    await page.fill('#email', 'Lynda@admin.com');
    await page.fill('#password', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    console.log('✅ Login successful\n');

    // Step 2: User Management Page - WhatsApp User Modal
    console.log('📝 Step 2: Capturing user-management.html...');
    await page.goto(`${BASE_URL}/admin/user-management.html`);
    await page.waitForTimeout(2000);

    // Take screenshot of the page
    await page.screenshot({ path: '/tmp/01-user-management-page.png', fullPage: true });
    console.log('   ✅ Saved: /tmp/01-user-management-page.png');

    // Click Add User button
    await page.click('button:has-text("Add User")');
    await page.waitForTimeout(1000);

    // Take screenshot of WhatsApp User tab
    await page.screenshot({ path: '/tmp/02-user-management-whatsapp-modal.png', fullPage: true });
    console.log('   ✅ Saved: /tmp/02-user-management-whatsapp-modal.png');

    // Click Admin User tab
    const adminTab = await page.locator('button:has-text("Admin User")');
    if (await adminTab.count() > 0) {
      await adminTab.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: '/tmp/03-user-management-admin-modal.png', fullPage: true });
      console.log('   ✅ Saved: /tmp/03-user-management-admin-modal.png');
    }

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    console.log('');

    // Step 3: Admin Users RBAC Page
    console.log('📝 Step 3: Capturing admin-users-rbac.html...');
    await page.goto(`${BASE_URL}/admin/admin-users-rbac.html`);
    await page.waitForTimeout(3000); // Wait for JavaScript to show button

    // Take screenshot of the page
    await page.screenshot({ path: '/tmp/04-admin-users-rbac-page.png', fullPage: true });
    console.log('   ✅ Saved: /tmp/04-admin-users-rbac-page.png');

    // Check if Create Admin User button is visible
    const createBtn = await page.locator('#createAdminBtn').isVisible();
    console.log(`   Create Admin User button visible: ${createBtn ? '✅ YES' : '❌ NO'}`);

    if (createBtn) {
      // Click Create Admin User button
      await page.click('#createAdminBtn');
      await page.waitForTimeout(1000);

      // Take screenshot of empty modal
      await page.screenshot({ path: '/tmp/05-admin-create-modal-empty.png', fullPage: true });
      console.log('   ✅ Saved: /tmp/05-admin-create-modal-empty.png');

      // Fill in some sample data
      await page.fill('#adminEmail', 'test.admin@school.edu');
      await page.fill('#adminName', 'Test Administrator');
      await page.click('button:has-text("Generate")'); // Generate password
      await page.waitForTimeout(500);

      // Take screenshot with Super Admin role
      await page.selectOption('#adminRole', 'super_admin');
      await page.waitForTimeout(500);
      await page.screenshot({ path: '/tmp/06-admin-create-modal-superadmin.png', fullPage: true });
      console.log('   ✅ Saved: /tmp/06-admin-create-modal-superadmin.png');

      // Change to Regional Admin
      await page.selectOption('#adminRole', 'admin');
      await page.waitForTimeout(1000); // Wait for region selection to appear

      // Check regions
      const regionSelection = await page.locator('#regionSelection').isVisible();
      console.log(`   Region selection visible: ${regionSelection ? '✅ YES' : '❌ NO'}`);

      if (regionSelection) {
        // Select Tanzania region
        await page.check('input[value="1"]'); // Tanzania = region_id 1
        await page.waitForTimeout(500);
        await page.screenshot({ path: '/tmp/07-admin-create-modal-regional.png', fullPage: true });
        console.log('   ✅ Saved: /tmp/07-admin-create-modal-regional.png');
      }
    } else {
      console.log('   ⚠️  Create Admin User button not visible - may be permissions issue');

      // Check the page source
      const buttonHTML = await page.locator('#createAdminBtn').evaluate(el => {
        return {
          exists: !!el,
          display: el.style.display,
          innerHTML: el.innerHTML
        };
      });
      console.log('   Button state:', buttonHTML);
    }

    console.log('\n=========================================');
    console.log('✅ Screenshot Capture Complete');
    console.log('=========================================');
    console.log('\nScreenshots saved to /tmp/');
    console.log('View them with: open /tmp/01-user-management-page.png\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: '/tmp/error-screenshot.png', fullPage: true });
    console.log('Error screenshot saved to /tmp/error-screenshot.png');
  } finally {
    // Keep browser open for 5 seconds to review
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

captureScreenshots();
