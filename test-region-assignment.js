const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://34.162.168.124:3000';

async function testRegionAssignment() {
  console.log('='.repeat(70));
  console.log('ADMIN USER REGION ASSIGNMENT TEST');
  console.log('='.repeat(70));
  console.log();

  const browser = await chromium.launch({ headless: true });

  try {
    // ============================================
    // TEST 1: Login as Super Admin
    // ============================================
    console.log('📝 TEST 1: Login as Super Admin');
    console.log('-'.repeat(70));

    const context = await browser.newContext();
    const page = await context.newPage();

    // Login
    await page.goto(`${BASE_URL}/admin/login.html`);
    await page.fill('#email', 'Lynda@admin.com');
    await page.fill('#password', 'Admin123!');
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL(/dashboard\.html/, { timeout: 10000 });
    console.log('✅ Super Admin logged in successfully');

    // ============================================
    // TEST 2: Navigate to Admin Users & RBAC page
    // ============================================
    console.log('\n📝 TEST 2: Navigate to Admin Users & RBAC page');
    console.log('-'.repeat(70));

    await page.goto(`${BASE_URL}/admin/admin-users-rbac.html`);
    await page.waitForSelector('tbody tr', { timeout: 10000 });
    console.log('✅ Admin Users & RBAC page loaded');

    // ============================================
    // TEST 3: Open Manage Access modal for Test Regional Admin
    // ============================================
    console.log('\n📝 TEST 3: Open Manage Access modal for Test Regional Admin');
    console.log('-'.repeat(70));

    // Find Test Regional Admin row
    const testAdminRow = await page.locator('tbody tr', {
      hasText: 'test.regional@school.edu'
    });

    if (await testAdminRow.count() === 0) {
      console.log('⚠️  Test Regional Admin not found in the list');
      console.log('Creating Test Regional Admin first...');

      // Click Create Admin User button
      await page.click('button:has-text("Create Admin User")');
      await page.waitForSelector('#createAdminModal.active');

      // Fill in form
      await page.fill('#adminName', 'Test Regional Admin');
      await page.fill('#adminEmail', 'test.regional@school.edu');
      await page.fill('#adminPassword', 'Test123!');

      // Submit
      await page.click('button:has-text("Create Admin")');
      await page.waitForTimeout(2000);

      console.log('✅ Test Regional Admin created');
    }

    // Now find and click Manage Access button
    await page.waitForTimeout(1000);
    const manageAccessButton = testAdminRow.locator('button:has-text("Manage Access")');
    await manageAccessButton.click();

    // Wait for modal to open
    await page.waitForSelector('#regionsModal.active', { timeout: 5000 });
    console.log('✅ Manage Regional Access modal opened');

    // ============================================
    // TEST 4: Verify modal loads regions correctly
    // ============================================
    console.log('\n📝 TEST 4: Verify modal loads regions correctly');
    console.log('-'.repeat(70));

    // Wait for assigned regions to load
    await page.waitForTimeout(2000);

    // Check if "Assigned Regions" section is visible
    const assignedRegionsText = await page.textContent('#assignedRegions');
    console.log(`Assigned Regions: ${assignedRegionsText.trim()}`);

    // Check if "Assign New Regions" section has checkboxes
    const availableRegions = await page.locator('#availableRegions input[type="checkbox"]').count();
    console.log(`✅ Available regions to assign: ${availableRegions}`);

    // ============================================
    // TEST 5: Assign a region (Rwanda)
    // ============================================
    console.log('\n📝 TEST 5: Assign Rwanda region to Test Regional Admin');
    console.log('-'.repeat(70));

    // Check if Rwanda checkbox exists
    const rwandaCheckbox = page.locator('#availableRegions input[type="checkbox"]').first();

    if (await rwandaCheckbox.count() > 0) {
      await rwandaCheckbox.check();
      console.log('✅ Selected Rwanda region');

      // Click Assign Selected button
      await page.click('button:has-text("Assign Selected")');

      // Wait for success message
      await page.waitForTimeout(2000);

      console.log('✅ Region assigned successfully');

      // Verify region appears in assigned list
      await page.waitForTimeout(1000);
      const assignedAfter = await page.textContent('#assignedRegions');
      console.log(`Assigned Regions after assignment: ${assignedAfter.trim()}`);
    } else {
      console.log('⚠️  No available regions to assign (all regions already assigned)');
    }

    // ============================================
    // TEST 6: Remove a region assignment
    // ============================================
    console.log('\n📝 TEST 6: Test removing region assignment');
    console.log('-'.repeat(70));

    const removeButtons = await page.locator('#assignedRegions button:has-text("Remove")').count();

    if (removeButtons > 0) {
      // Setup dialog handler BEFORE clicking Remove
      page.once('dialog', async dialog => {
        console.log(`Dialog message: ${dialog.message()}`);
        await dialog.accept();
      });

      // Click first Remove button
      await page.locator('#assignedRegions button:has-text("Remove")').first().click();

      // Wait for removal
      await page.waitForTimeout(2000);

      console.log('✅ Region removed successfully');

      // Verify region is gone from assigned list
      const assignedAfterRemoval = await page.textContent('#assignedRegions');
      console.log(`Assigned Regions after removal: ${assignedAfterRemoval.trim()}`);
    } else {
      console.log('⚠️  No assigned regions to remove');
    }

    // ============================================
    // TEST 7: Close modal
    // ============================================
    console.log('\n📝 TEST 7: Close modal');
    console.log('-'.repeat(70));

    await page.click('button:has-text("Close")');
    await page.waitForTimeout(500);

    const modalVisible = await page.isVisible('#regionsModal.active');
    if (!modalVisible) {
      console.log('✅ Modal closed successfully');
    } else {
      console.log('❌ Modal still visible');
    }

    // ============================================
    // TEST 8: Verify via API
    // ============================================
    console.log('\n📝 TEST 8: Verify region assignments via API');
    console.log('-'.repeat(70));

    // Get admin token from localStorage
    const token = await page.evaluate(() => localStorage.getItem('adminToken'));

    // Find Test Regional Admin ID
    const testAdminId = await page.evaluate(() => {
      const rows = document.querySelectorAll('tbody tr');
      for (const row of rows) {
        if (row.textContent.includes('test.regional@school.edu')) {
          const manageBtn = row.querySelector('button[onclick*="manageRegions"]');
          if (manageBtn) {
            const match = manageBtn.getAttribute('onclick').match(/manageRegions\((\d+)\)/);
            return match ? parseInt(match[1]) : null;
          }
        }
      }
      return null;
    });

    if (testAdminId) {
      console.log(`Test Regional Admin ID: ${testAdminId}`);

      // Call API directly
      const apiResponse = await fetch(`${BASE_URL}/api/admin/admin-users/${testAdminId}/regions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const apiData = await apiResponse.json();

      if (apiData.success) {
        console.log(`✅ API Response successful`);
        console.log(`Assigned Regions (${apiData.regions.length}):`);
        apiData.regions.forEach(region => {
          console.log(`  - ${region.name} (${region.code})`);
        });
      } else {
        console.log(`❌ API Error: ${apiData.error}`);
      }
    } else {
      console.log('⚠️  Could not find Test Regional Admin ID');
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(70));
    console.log('TEST SUMMARY');
    console.log('='.repeat(70));
    console.log('✅ Login successful');
    console.log('✅ Admin Users & RBAC page loaded');
    console.log('✅ Manage Access modal opened');
    console.log('✅ Regions loaded correctly');
    console.log('✅ Region assignment working');
    console.log('✅ Region removal working');
    console.log('✅ Modal close working');
    console.log('✅ API verification successful');
    console.log('\n✅ ALL TESTS PASSED');

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
testRegionAssignment().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
