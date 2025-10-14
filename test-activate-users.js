const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen to console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Browser Error:', msg.text());
    }
  });

  // Listen to network responses
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/admin/users/') && url.includes('/toggle-status')) {
      console.log(`\n📡 API Response: ${response.status()} ${url}`);
      try {
        const body = await response.text();
        console.log('Response body:', body.substring(0, 200));
      } catch (e) {
        console.log('Could not read response body');
      }
    }
  });

  try {
    console.log('🔍 Navigating to user management page...\n');
    await page.goto('http://localhost:3000/admin/user-management.html');
    await page.waitForTimeout(1000);

    // Check if we need to login
    const currentUrl = page.url();
    if (currentUrl.includes('login.html')) {
      console.log('🔐 Logging in...\n');
      await page.fill('#email', 'admin@school.edu');
      await page.fill('#password', 'Admin123!');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Navigate back to user management
      await page.goto('http://localhost:3000/admin/user-management.html');
      await page.waitForTimeout(2000);
    }

    console.log('📋 Page loaded. Looking for User 9129...\n');

    // Find User 9129 row
    const rows = await page.$$('tbody tr');
    let user9129Row = null;
    let user9129Index = -1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = await row.$eval('td:nth-child(1)', el => el.textContent.trim());

      if (name === 'User 9129') {
        user9129Row = row;
        user9129Index = i;
        console.log(`✅ Found User 9129 at row ${i + 1}`);

        const contact = await row.$eval('td:nth-child(2)', el => el.textContent.trim());
        const status = await row.$eval('td:nth-child(6)', el => el.textContent.trim());

        console.log(`   Contact: ${contact}`);
        console.log(`   Status: ${status}\n`);
        break;
      }
    }

    if (!user9129Row) {
      console.log('❌ User 9129 not found!');
      await browser.close();
      return;
    }

    // Find the Activate/Deactivate button
    const activateBtn = await user9129Row.$('button:has-text("Activate")');
    const deactivateBtn = await user9129Row.$('button:has-text("Deactivate")');

    if (!activateBtn && !deactivateBtn) {
      console.log('❌ No Activate/Deactivate button found for User 9129!');
      await browser.close();
      return;
    }

    const buttonToClick = activateBtn || deactivateBtn;
    const buttonText = await buttonToClick.textContent();

    console.log(`🖱️  Clicking "${buttonText}" button for User 9129...\n`);

    // Click the button
    await buttonToClick.click();

    // Wait for response
    await page.waitForTimeout(3000);

    // Check for alerts
    const alert = await page.$('#alert');
    if (alert) {
      const alertVisible = await alert.isVisible();
      if (alertVisible) {
        const alertText = await alert.textContent();
        console.log(`📢 Alert shown: ${alertText}\n`);
      }
    }

    // Reload the page to fetch fresh data
    console.log('🔄 Reloading page to get fresh data...\n');
    await page.reload();
    await page.waitForTimeout(2000);

    // Check console logs
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.text().includes('User 9129')) {
        consoleLogs.push(msg.text());
      }
    });

    // Check the updated status
    console.log('✅ Page reloaded. Checking updated status...\n');

    const updatedRows = await page.$$('tbody tr');
    for (let i = 0; i < updatedRows.length; i++) {
      const row = updatedRows[i];
      const name = await row.$eval('td:nth-child(1)', el => el.textContent.trim());

      if (name === 'User 9129') {
        const status = await row.$eval('td:nth-child(6)', el => el.textContent.trim());
        const newBtn = await row.$('button:has-text("Activate"), button:has-text("Deactivate")');
        const newBtnText = newBtn ? await newBtn.textContent() : 'N/A';

        console.log(`🔍 User 9129 after reload:`);
        console.log(`   Status: ${status}`);
        console.log(`   Button: ${newBtnText}\n`);
        break;
      }
    }

    // Print console logs from browser
    if (consoleLogs.length > 0) {
      console.log('🖥️  Browser Console Logs:');
      consoleLogs.forEach(log => console.log(`   ${log}`));
      console.log('');
    }

    console.log('📸 Taking screenshot...');
    await page.screenshot({ path: 'user-activate-test.png', fullPage: true });
    console.log('✅ Screenshot saved: user-activate-test.png\n');

    console.log('✨ Test completed! Browser will close in 5 seconds...');
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('❌ Test Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
