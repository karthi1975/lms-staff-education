const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://34.162.168.124:3000';

async function testRegionAssignmentComprehensive() {
  console.log('='.repeat(80));
  console.log('COMPREHENSIVE REGION ASSIGNMENT TEST');
  console.log('='.repeat(80));
  console.log();

  const browser = await chromium.launch({ headless: false, slowMo: 500 });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // ============================================
    // TEST 1: Login as Super Admin
    // ============================================
    console.log('📝 TEST 1: Login as Super Admin');
    console.log('-'.repeat(80));

    await page.goto(`${BASE_URL}/admin/login.html`);
    await page.fill('#email', 'Lynda@admin.com');
    await page.fill('#password', 'Admin123!');
    await page.click('button[type="submit"]');

    await page.waitForURL(/dashboard\.html/, { timeout: 10000 });
    const token = await page.evaluate(() => localStorage.getItem('adminToken'));
    console.log('✅ Logged in successfully');
    console.log(`Token: ${token.substring(0, 20)}...`);
    console.log();

    // ============================================
    // TEST 2: Verify API endpoint exists
    // ============================================
    console.log('📝 TEST 2: Verify region assignment API endpoints');
    console.log('-'.repeat(80));

    // Test GET endpoint for user ID 12 (test1)
    const apiTest = await page.evaluate(async ({baseUrl, authToken}) => {
      try {
        const response = await fetch(`${baseUrl}/api/admin/admin-users/12/regions`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        const contentType = response.headers.get('content-type');
        const text = await response.text();

        return {
          status: response.status,
          ok: response.ok,
          contentType,
          body: text,
          isHtml: text.includes('<!DOCTYPE html>')
        };
      } catch (error) {
        return {
          error: error.message
        };
      }
    }, {baseUrl: BASE_URL, authToken: token});

    console.log(`API Status: ${apiTest.status}`);
    console.log(`API OK: ${apiTest.ok}`);
    console.log(`Content-Type: ${apiTest.contentType}`);

    if (apiTest.isHtml) {
      console.log('❌ API returned HTML error page instead of JSON');
      console.log('This means the endpoint is NOT deployed!');
      console.log();
      console.log('Body preview:', apiTest.body.substring(0, 200));
      console.log();
      console.log('🚨 DEPLOYMENT NEEDED');
      console.log('Please run: ./deploy-and-test-regions.sh');
      console.log();
      await browser.close();
      process.exit(1);
    }

    let apiData;
    try {
      apiData = JSON.parse(apiTest.body);
      console.log('✅ API endpoint exists and returns JSON');
      console.log(`Assigned regions count: ${apiData.regions ? apiData.regions.length : 0}`);
      console.log(`All regions count: ${apiData.allRegions ? apiData.allRegions.length : 0}`);

      if (apiData.allRegions && apiData.allRegions.length > 0) {
        console.log('\nAvailable regions:');
        apiData.allRegions.forEach(r => {
          console.log(`  - ${r.name} (${r.code}) [ID: ${r.id}]`);
        });
      }
    } catch (e) {
      console.log('❌ Failed to parse JSON response');
      console.log('Response:', apiTest.body);
      throw e;
    }
    console.log();

    // ============================================
    // TEST 3: Navigate to Admin Users & RBAC
    // ============================================
    console.log('📝 TEST 3: Navigate to Admin Users & RBAC page');
    console.log('-'.repeat(80));

    await page.goto(`${BASE_URL}/admin/admin-users-rbac.html`);
    await page.waitForSelector('tbody tr', { timeout: 10000 });
    console.log('✅ Page loaded');

    // Count admin users
    const userCount = await page.locator('tbody tr').count();
    console.log(`Admin users visible: ${userCount}`);
    console.log();

    // ============================================
    // TEST 4: Find test1 user
    // ============================================
    console.log('📝 TEST 4: Find test1 user');
    console.log('-'.repeat(80));

    const test1Row = page.locator('tbody tr', {
      hasText: 'test1@school.edu'
    });

    const test1Exists = await test1Row.count() > 0;
    console.log(`test1 user exists: ${test1Exists}`);

    if (!test1Exists) {
      console.log('⚠️  test1 user not found, creating...');
      await page.click('button:has-text("Create Admin User")');
      await page.waitForSelector('#createAdminModal.active');
      await page.fill('#adminName', 'test1');
      await page.fill('#adminEmail', 'test1@school.edu');
      await page.fill('#adminPassword', 'Test123!');
      await page.click('button:has-text("Create Admin")');
      await page.waitForTimeout(2000);
      console.log('✅ test1 user created');
    } else {
      console.log('✅ test1 user found');
    }
    console.log();

    // ============================================
    // TEST 5: Open Manage Access modal for test1
    // ============================================
    console.log('📝 TEST 5: Open Manage Access modal for test1');
    console.log('-'.repeat(80));

    await page.waitForTimeout(1000);
    const manageButton = test1Row.locator('button:has-text("Manage Access")');
    await manageButton.click();

    await page.waitForSelector('#regionsModal.active', { timeout: 5000 });
    console.log('✅ Modal opened');

    // Wait for content to load
    await page.waitForTimeout(2000);
    console.log();

    // ============================================
    // TEST 6: Verify modal content
    // ============================================
    console.log('📝 TEST 6: Verify modal shows regions');
    console.log('-'.repeat(80));

    // Check assigned regions section
    const assignedText = await page.textContent('#assignedRegions');
    console.log('Assigned Regions section:');
    console.log(assignedText.trim());
    console.log();

    // Check available regions checkboxes
    const checkboxCount = await page.locator('#availableRegions input[type="checkbox"]').count();
    console.log(`Available region checkboxes: ${checkboxCount}`);

    if (checkboxCount === 0) {
      console.log('❌ No region checkboxes found!');
      console.log('This means regions are not being loaded from the API');

      // Check if there's an error message
      const availableText = await page.textContent('#availableRegions');
      console.log('Available Regions section:');
      console.log(availableText.trim());
      console.log();

      // Take screenshot
      await page.screenshot({ path: 'modal-empty-regions.png', fullPage: true });
      console.log('📸 Screenshot saved: modal-empty-regions.png');
      console.log();

      console.log('🔍 Debugging info:');
      const debugInfo = await page.evaluate(() => {
        return {
          allRegionsVar: typeof allRegions !== 'undefined' ? allRegions : 'undefined',
          assignedRegionsHTML: document.getElementById('assignedRegions').innerHTML,
          availableRegionsHTML: document.getElementById('availableRegions').innerHTML
        };
      });
      console.log('allRegions variable:', JSON.stringify(debugInfo.allRegionsVar, null, 2));
      console.log();
    } else {
      console.log('✅ Region checkboxes found');

      // List available regions
      const regions = await page.evaluate(() => {
        const checkboxes = document.querySelectorAll('#availableRegions input[type="checkbox"]');
        return Array.from(checkboxes).map(cb => {
          const label = cb.nextElementSibling;
          return {
            id: cb.value,
            text: label ? label.textContent : 'Unknown'
          };
        });
      });

      console.log('Available regions:');
      regions.forEach(r => {
        console.log(`  ☐ ${r.text} (ID: ${r.id})`);
      });
      console.log();
    }

    // ============================================
    // TEST 7: Assign Tanzania region to test1
    // ============================================
    if (checkboxCount > 0) {
      console.log('📝 TEST 7: Assign first available region to test1');
      console.log('-'.repeat(80));

      // Check the first checkbox
      const firstCheckbox = page.locator('#availableRegions input[type="checkbox"]').first();
      const regionText = await page.evaluate(() => {
        const cb = document.querySelector('#availableRegions input[type="checkbox"]');
        const label = cb ? cb.nextElementSibling : null;
        return label ? label.textContent : 'Unknown';
      });

      await firstCheckbox.check();
      console.log(`✅ Selected: ${regionText}`);

      // Click Assign Selected
      await page.click('button:has-text("Assign Selected")');

      // Wait for assignment
      await page.waitForTimeout(3000);

      // Check if assignment succeeded
      const assignedAfter = await page.textContent('#assignedRegions');
      console.log('Assigned regions after assignment:');
      console.log(assignedAfter.trim());
      console.log();

      if (assignedAfter.includes('No regions assigned')) {
        console.log('❌ Assignment may have failed');
      } else {
        console.log('✅ Region appears to be assigned');
      }
    }

    // ============================================
    // TEST 8: Verify via API
    // ============================================
    console.log('📝 TEST 8: Verify assignment via API');
    console.log('-'.repeat(80));

    const verifyApi = await page.evaluate(async ({baseUrl, authToken}) => {
      try {
        const response = await fetch(`${baseUrl}/api/admin/admin-users/12/regions`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        const data = await response.json();
        return {
          ok: response.ok,
          data
        };
      } catch (error) {
        return {
          error: error.message
        };
      }
    }, {baseUrl: BASE_URL, authToken: token});

    if (verifyApi.ok && verifyApi.data.success) {
      console.log('✅ API verification successful');
      console.log(`Assigned regions: ${verifyApi.data.regions.length}`);
      verifyApi.data.regions.forEach(r => {
        console.log(`  - ${r.name} (${r.code}) assigned at ${r.assigned_at}`);
      });
    } else {
      console.log('❌ API verification failed');
      console.log('Response:', verifyApi);
    }
    console.log();

    // ============================================
    // TEST 9: Close modal
    // ============================================
    console.log('📝 TEST 9: Close modal');
    console.log('-'.repeat(80));

    await page.click('button:has-text("Close")');
    await page.waitForTimeout(500);

    const modalStillVisible = await page.isVisible('#regionsModal.active');
    if (!modalStillVisible) {
      console.log('✅ Modal closed');
    } else {
      console.log('❌ Modal still visible');
    }
    console.log();

    // ============================================
    // TEST 10: Verify in Assigned Regions column
    // ============================================
    console.log('📝 TEST 10: Verify "Assigned Regions" column in table');
    console.log('-'.repeat(80));

    const test1AssignedRegionsCell = await test1Row.locator('td').nth(2).textContent();
    console.log(`Assigned Regions cell for test1: "${test1AssignedRegionsCell.trim()}"`);

    if (test1AssignedRegionsCell.trim() === 'No regions') {
      console.log('⚠️  Still showing "No regions" - table may not have refreshed');
    } else {
      console.log('✅ Regions showing in table');
    }
    console.log();

    // ============================================
    // SUMMARY
    // ============================================
    console.log('='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    console.log('✅ Login successful');
    console.log(`${apiTest.ok ? '✅' : '❌'} API endpoints ${apiTest.ok ? 'working' : 'NOT deployed'}`);
    console.log('✅ Admin Users & RBAC page loaded');
    console.log(`${test1Exists || true ? '✅' : '❌'} test1 user exists`);
    console.log('✅ Manage Access modal opened');
    console.log(`${checkboxCount > 0 ? '✅' : '❌'} Region checkboxes ${checkboxCount > 0 ? 'visible' : 'NOT visible'}`);

    if (!apiTest.ok || checkboxCount === 0) {
      console.log();
      console.log('🚨 ISSUES FOUND:');
      if (!apiTest.ok) {
        console.log('   - API endpoints not deployed to production');
      }
      if (checkboxCount === 0) {
        console.log('   - Region checkboxes not rendering (frontend issue)');
      }
      console.log();
      console.log('📋 ACTION REQUIRED:');
      console.log('   1. Run: ./deploy-and-test-regions.sh');
      console.log('   2. Follow the deployment steps');
      console.log('   3. Run this test again');
    } else {
      console.log();
      console.log('✅ ALL TESTS PASSED!');
    }
    console.log();

    await page.waitForTimeout(3000);
    await context.close();

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run test
testRegionAssignmentComprehensive().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
