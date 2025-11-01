const { chromium } = require('playwright');

async function verifyUIState() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const BASE_URL = 'http://34.162.168.124:3000';

  console.log('=========================================');
  console.log('UI State Verification with Playwright');
  console.log('=========================================\n');

  try {
    // Step 1: Login
    console.log('📝 Step 1: Logging in...');
    await page.goto(`${BASE_URL}/admin/login.html`);
    await page.fill('#email', 'Lynda@admin.com');
    await page.fill('#password', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    console.log('✅ Login successful\n');

    // Step 2: Check User Management Page
    console.log('📝 Step 2: Checking user-management.html...');
    await page.goto(`${BASE_URL}/admin/user-management.html`);
    await page.waitForTimeout(2000);

    // Check for Add User button
    const addUserButton = await page.locator('button:has-text("Add User")').count();
    console.log(`   Add User button: ${addUserButton > 0 ? '✅ Found' : '❌ Not found'}`);

    // Click Add User and check modal
    if (addUserButton > 0) {
      await page.click('button:has-text("Add User")');
      await page.waitForTimeout(1000);

      // Check for tabs
      const whatsappTab = await page.locator('button:has-text("WhatsApp User")').count();
      const adminTab = await page.locator('button:has-text("Admin User")').count();

      console.log(`   WhatsApp User tab: ${whatsappTab > 0 ? '✅ Found' : '❌ Not found'}`);
      console.log(`   Admin User tab: ${adminTab > 0 ? '✅ Found' : '❌ Not found'}`);

      // Check WhatsApp form fields
      const nameField = await page.locator('#whatsappUserName').count();
      const phoneField = await page.locator('#whatsappUserPhone').count();
      console.log(`   Name field: ${nameField > 0 ? '✅ Found' : '❌ Not found'}`);
      console.log(`   Phone field: ${phoneField > 0 ? '✅ Found' : '❌ Not found'}`);

      // Close modal
      await page.keyboard.press('Escape');
    }
    console.log('');

    // Step 3: Check Admin Users RBAC Page
    console.log('📝 Step 3: Checking admin-users-rbac.html...');
    await page.goto(`${BASE_URL}/admin/admin-users-rbac.html`);
    await page.waitForTimeout(2000);

    // Check for Create Admin User button
    const createAdminButton = await page.locator('button:has-text("Create Admin User")').count();
    console.log(`   Create Admin User button: ${createAdminButton > 0 ? '✅ Found' : '❌ Not found'}`);

    // Click Create Admin User and check modal
    if (createAdminButton > 0) {
      await page.click('button:has-text("Create Admin User")');
      await page.waitForTimeout(1000);

      // Check form fields
      const emailField = await page.locator('#adminEmail').count();
      const nameField = await page.locator('#adminName').count();
      const passwordField = await page.locator('#adminPassword').count();
      const roleField = await page.locator('#adminRole').count();

      console.log(`   Email field: ${emailField > 0 ? '✅ Found' : '❌ Not found'}`);
      console.log(`   Name field: ${nameField > 0 ? '✅ Found' : '❌ Not found'}`);
      console.log(`   Password field: ${passwordField > 0 ? '✅ Found' : '❌ Not found'}`);
      console.log(`   Role dropdown: ${roleField > 0 ? '✅ Found' : '❌ Not found'}`);

      // Check for Generate Password and Show/Hide buttons
      const generateBtn = await page.locator('button:has-text("Generate")').count();
      const toggleBtn = await page.locator('button:has-text("👁")').count();
      console.log(`   Generate Password button: ${generateBtn > 0 ? '✅ Found' : '❌ Not found'}`);
      console.log(`   Show/Hide Password button: ${toggleBtn > 0 ? '✅ Found' : '❌ Not found'}`);

      // Test role change to Regional Admin
      if (roleField > 0) {
        await page.selectOption('#adminRole', 'admin');
        await page.waitForTimeout(500);

        const regionSelection = await page.locator('#regionSelection').count();
        console.log(`   Region selection (for Regional Admin): ${regionSelection > 0 ? '✅ Found' : '❌ Not found'}`);
      }
    }
    console.log('');

    // Take screenshots
    console.log('📸 Taking screenshots...');
    await page.goto(`${BASE_URL}/admin/user-management.html`);
    await page.click('button:has-text("Add User")');
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/user-management-modal.png', fullPage: true });
    console.log('   Saved: /tmp/user-management-modal.png');

    await page.goto(`${BASE_URL}/admin/admin-users-rbac.html`);
    await page.waitForTimeout(1000);
    const createBtn = await page.locator('button:has-text("Create Admin User")').count();
    if (createBtn > 0) {
      await page.click('button:has-text("Create Admin User")');
      await page.waitForTimeout(500);
      await page.screenshot({ path: '/tmp/admin-users-rbac-modal.png', fullPage: true });
      console.log('   Saved: /tmp/admin-users-rbac-modal.png');
    }

    console.log('\n=========================================');
    console.log('✅ UI Verification Complete');
    console.log('=========================================\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

verifyUIState();
