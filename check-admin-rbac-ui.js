const { chromium } = require('playwright');

async function checkAdminRBACUI() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const BASE_URL = 'http://34.162.168.124:3000';

  console.log('=========================================');
  console.log('Checking Admin Users RBAC UI');
  console.log('=========================================\n');

  try {
    // Step 1: Login
    console.log('Step 1: Logging in as Super Admin...');
    await page.goto(`${BASE_URL}/admin/login.html`);
    await page.fill('#email', 'Lynda@admin.com');
    await page.fill('#password', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    console.log('Login successful\n');

    // Step 2: Go to Admin Users RBAC page
    console.log('Step 2: Navigating to admin-users-rbac.html...');
    await page.goto(`${BASE_URL}/admin/admin-users-rbac.html`);
    await page.waitForTimeout(3000);

    // Take screenshot of full page
    await page.screenshot({ path: '/tmp/rbac-01-page.png', fullPage: true });
    console.log('Saved: /tmp/rbac-01-page.png\n');

    // Check button state
    console.log('Step 3: Checking Create Admin User button...');
    const button = await page.locator('#createAdminBtn');
    const buttonExists = await button.count() > 0;
    console.log('Button exists in DOM:', buttonExists);

    if (buttonExists) {
      const isVisible = await button.isVisible();
      console.log('Button is visible:', isVisible);

      const buttonStyle = await button.evaluate(el => ({
        display: el.style.display,
        visibility: window.getComputedStyle(el).visibility,
        opacity: window.getComputedStyle(el).opacity
      }));
      console.log('Button styles:', buttonStyle);

      if (isVisible) {
        // Button is visible, click it
        console.log('\nStep 4: Clicking Create Admin User button...');
        await button.click();
        await page.waitForTimeout(1000);

        // Check if modal appeared
        const modal = await page.locator('#createAdminModal');
        const modalVisible = await modal.isVisible();
        console.log('Modal visible:', modalVisible);

        if (modalVisible) {
          // Take screenshot of modal
          await page.screenshot({ path: '/tmp/rbac-02-modal-empty.png', fullPage: true });
          console.log('Saved: /tmp/rbac-02-modal-empty.png\n');

          // Fill in sample data
          console.log('Step 5: Testing Super Admin creation form...');
          await page.fill('#adminEmail', 'test.super@school.edu');
          await page.fill('#adminName', 'Test Super Administrator');

          // Click generate password button
          const generateBtn = await page.locator('button:has-text("Generate")');
          if (await generateBtn.count() > 0) {
            await generateBtn.first().click();
            await page.waitForTimeout(500);
          }

          await page.selectOption('#adminRole', 'super_admin');
          await page.waitForTimeout(500);
          await page.screenshot({ path: '/tmp/rbac-03-modal-superadmin.png', fullPage: true });
          console.log('Saved: /tmp/rbac-03-modal-superadmin.png\n');

          // Test Regional Admin
          console.log('Step 6: Testing Regional Admin creation form...');
          await page.selectOption('#adminRole', 'admin');
          await page.waitForTimeout(1000);

          const regionSelection = await page.locator('#regionSelection').isVisible();
          console.log('Region selection visible:', regionSelection);

          if (regionSelection) {
            // Check Tanzania checkbox
            const tanzaniaCheckbox = await page.locator('input[type="checkbox"][value="1"]');
            if (await tanzaniaCheckbox.count() > 0) {
              await tanzaniaCheckbox.check();
              await page.waitForTimeout(500);
              await page.screenshot({ path: '/tmp/rbac-04-modal-regional.png', fullPage: true });
              console.log('Saved: /tmp/rbac-04-modal-regional.png\n');
            }
          }
        }
      } else {
        console.log('\nButton exists but is NOT visible');
        console.log('This might be a permissions issue or JavaScript not executing\n');
      }
    }

    console.log('=========================================');
    console.log('UI Check Complete');
    console.log('=========================================\n');

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: '/tmp/rbac-error.png', fullPage: true });
    console.log('Error screenshot saved to /tmp/rbac-error.png');
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

checkAdminRBACUI();
