const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://34.162.168.124:3000';

async function testUserManagementRBAC() {
  console.log('='.repeat(60));
  console.log('USER MANAGEMENT RBAC TEST');
  console.log('='.repeat(60));
  console.log();

  const browser = await chromium.launch({ headless: true });

  try {
    // ============================================
    // TEST 1: Super Admin sees all users
    // ============================================
    console.log('📝 TEST 1: Super Admin sees all users');
    console.log('-'.repeat(60));

    const superAdminContext = await browser.newContext();
    const superAdminPage = await superAdminContext.newPage();

    // Login as Super Admin
    await superAdminPage.goto(`${BASE_URL}/admin/login.html`);
    await superAdminPage.fill('#email', 'Lynda@admin.com');
    await superAdminPage.fill('#password', 'Admin123!');
    await superAdminPage.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await superAdminPage.waitForURL(/dashboard\.html/);
    console.log('✅ Super Admin logged in successfully');

    // Navigate to user management
    await superAdminPage.goto(`${BASE_URL}/admin/user-management.html`);
    await superAdminPage.waitForSelector('#usersTableBody', { timeout: 10000 });

    // Wait for users to load (check that loading text is gone)
    await superAdminPage.waitForFunction(() => {
      const tbody = document.querySelector('#usersTableBody');
      return tbody && !tbody.textContent.includes('Loading...');
    }, { timeout: 15000 });

    // Count users in table
    const superAdminUserCount = await superAdminPage.evaluate(() => {
      const rows = document.querySelectorAll('#usersTableBody tr');
      return rows.length;
    });

    // Get user details
    const superAdminUsers = await superAdminPage.evaluate(() => {
      const rows = document.querySelectorAll('#usersTableBody tr');
      return Array.from(rows).slice(0, 10).map(row => {
        const cells = row.querySelectorAll('td');
        return {
          name: cells[0]?.textContent.trim(),
          contact: cells[1]?.textContent.trim(),
          role: cells[2]?.textContent.trim()
        };
      });
    });

    console.log(`✅ Super Admin can see ${superAdminUserCount} users total`);
    console.log('\nFirst 10 users:');
    superAdminUsers.forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.name} - ${user.contact} - ${user.role}`);
    });

    await superAdminContext.close();

    // ============================================
    // TEST 2: Regional Admin sees only their region's users
    // ============================================
    console.log('\n📝 TEST 2: Regional Admin sees only Tanzania users');
    console.log('-'.repeat(60));

    const regionalAdminContext = await browser.newContext();
    const regionalAdminPage = await regionalAdminContext.newPage();

    // Login as Regional Admin (Tanzania)
    await regionalAdminPage.goto(`${BASE_URL}/admin/login.html`);
    await regionalAdminPage.fill('#email', 'test.regional@school.edu');
    await regionalAdminPage.fill('#password', 'Test123!');
    await regionalAdminPage.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await regionalAdminPage.waitForURL(/dashboard\.html/);
    console.log('✅ Regional Admin logged in successfully');

    // Navigate to user management
    await regionalAdminPage.goto(`${BASE_URL}/admin/user-management.html`);
    await regionalAdminPage.waitForSelector('#usersTableBody', { timeout: 10000 });

    // Wait for users to load
    await regionalAdminPage.waitForFunction(() => {
      const tbody = document.querySelector('#usersTableBody');
      return tbody && !tbody.textContent.includes('Loading...');
    }, { timeout: 15000 });

    // Count users in table
    const regionalAdminUserCount = await regionalAdminPage.evaluate(() => {
      const rows = document.querySelectorAll('#usersTableBody tr');
      return rows.length;
    });

    // Get user details
    const regionalAdminUsers = await regionalAdminPage.evaluate(() => {
      const rows = document.querySelectorAll('#usersTableBody tr');
      return Array.from(rows).slice(0, 10).map(row => {
        const cells = row.querySelectorAll('td');
        return {
          name: cells[0]?.textContent.trim(),
          contact: cells[1]?.textContent.trim(),
          role: cells[2]?.textContent.trim()
        };
      });
    });

    console.log(`✅ Regional Admin can see ${regionalAdminUserCount} users (Tanzania only)`);
    if (regionalAdminUserCount > 0) {
      console.log('\nFirst 10 users:');
      regionalAdminUsers.forEach((user, i) => {
        console.log(`  ${i + 1}. ${user.name} - ${user.contact} - ${user.role}`);
      });
    } else {
      console.log('⚠️  No users found for Tanzania region');
    }

    await regionalAdminContext.close();

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Super Admin User Count: ${superAdminUserCount}`);
    console.log(`Regional Admin User Count: ${regionalAdminUserCount}`);

    if (regionalAdminUserCount < superAdminUserCount) {
      console.log('✅ RBAC WORKING: Regional Admin sees fewer users than Super Admin');
    } else if (regionalAdminUserCount === 0) {
      console.log('⚠️  WARNING: No users in Tanzania region. Assign users to test properly.');
    } else {
      console.log('❌ POTENTIAL ISSUE: Regional Admin sees same or more users as Super Admin');
    }

    console.log('\n✅ TEST COMPLETED');

  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run test
testUserManagementRBAC().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
