const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://34.162.168.124:3000';

async function testAssignedRegionsInTable() {
  console.log('='.repeat(80));
  console.log('TEST: Assigned Regions Display in Table');
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
    console.log('✅ Logged in successfully');
    console.log();

    // ============================================
    // STEP 2: Go to Admin Users & RBAC page
    // ============================================
    console.log('📝 STEP 2: Navigate to Admin Users & RBAC');
    console.log('-'.repeat(80));

    await page.goto(`${BASE_URL}/admin/admin-users-rbac.html`);
    await page.waitForSelector('tbody tr', { timeout: 10000 });
    await page.waitForTimeout(2000); // Wait for data to load
    console.log('✅ Page loaded');
    console.log();

    // ============================================
    // STEP 3: Check current assigned regions in table
    // ============================================
    console.log('📝 STEP 3: Check "Assigned Regions" column for all users');
    console.log('-'.repeat(80));

    const usersWithRegions = await page.evaluate(() => {
      const rows = document.querySelectorAll('tbody tr');
      return Array.from(rows).map(row => {
        const cells = row.querySelectorAll('td');
        const nameDiv = cells[0]?.querySelector('div:first-child');
        const emailDiv = cells[0]?.querySelector('div:last-child');
        const regionsCell = cells[2];

        return {
          name: nameDiv?.textContent.trim(),
          email: emailDiv?.textContent.trim(),
          assignedRegions: regionsCell?.textContent.trim()
        };
      });
    });

    console.log('Current table data:');
    console.log();
    usersWithRegions.forEach((user, i) => {
      console.log(`${i + 1}. ${user.name || 'Unknown'}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Assigned Regions: ${user.assignedRegions}`);
      console.log();
    });

    // ============================================
    // STEP 4: Assign Tanzania to test1
    // ============================================
    console.log('📝 STEP 4: Assign Tanzania region to test1');
    console.log('-'.repeat(80));

    // Find test1 row
    const test1Row = page.locator('tbody tr', {
      hasText: 'test1@school.edu'
    });

    // Click Manage Access
    await test1Row.locator('button:has-text("Manage Access")').click();
    await page.waitForSelector('#regionsModal.active', { timeout: 5000 });
    console.log('✅ Modal opened');

    // Wait for regions to load
    await page.waitForTimeout(2000);

    // Find Tanzania checkbox
    const tanzaniaCheckbox = page.locator('#availableRegions input[type="checkbox"]', {
      has: page.locator('text=/Tanzania/i')
    }).first();

    if (await tanzaniaCheckbox.count() > 0) {
      await tanzaniaCheckbox.check();
      console.log('✅ Selected Tanzania');

      // Click Assign Selected
      await page.click('button:has-text("Assign Selected")');
      await page.waitForTimeout(2000);
      console.log('✅ Region assigned');

      // Close modal
      await page.click('button:has-text("Close")');
      await page.waitForTimeout(500);
      console.log('✅ Modal closed');
    } else {
      console.log('⚠️  Tanzania checkbox not found (may already be assigned)');
      await page.click('button:has-text("Close")');
      await page.waitForTimeout(500);
    }
    console.log();

    // ============================================
    // STEP 5: Refresh page to see updated regions
    // ============================================
    console.log('📝 STEP 5: Refresh page to see updated table');
    console.log('-'.repeat(80));

    await page.reload();
    await page.waitForSelector('tbody tr', { timeout: 10000 });
    await page.waitForTimeout(3000); // Wait for data to fully load
    console.log('✅ Page refreshed');
    console.log();

    // ============================================
    // STEP 6: Verify assigned regions show in table
    // ============================================
    console.log('📝 STEP 6: Verify assigned regions now show in table');
    console.log('-'.repeat(80));

    const updatedUsers = await page.evaluate(() => {
      const rows = document.querySelectorAll('tbody tr');
      return Array.from(rows).map(row => {
        const cells = row.querySelectorAll('td');
        const nameDiv = cells[0]?.querySelector('div:first-child');
        const emailDiv = cells[0]?.querySelector('div:last-child');
        const regionsCell = cells[2];
        const regionTags = regionsCell?.querySelectorAll('.region-tag');

        return {
          name: nameDiv?.textContent.trim(),
          email: emailDiv?.textContent.trim(),
          assignedRegions: regionsCell?.textContent.trim(),
          regionTagsHTML: regionsCell?.innerHTML,
          regionCount: regionTags ? regionTags.length : 0,
          regionTexts: regionTags ? Array.from(regionTags).map(t => t.textContent.trim()) : []
        };
      });
    });

    console.log('Updated table data:');
    console.log();

    let test1Found = false;
    let test1HasRegions = false;

    updatedUsers.forEach((user, i) => {
      console.log(`${i + 1}. ${user.name || 'Unknown'}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Assigned Regions: ${user.assignedRegions}`);
      console.log(`   Region Tags: [${user.regionTexts.join(', ')}]`);

      if (user.email === 'test1@school.edu') {
        test1Found = true;
        test1HasRegions = !user.assignedRegions.includes('No regions');
        console.log(`   ✅ test1 found!`);
        console.log(`   ${test1HasRegions ? '✅' : '❌'} Has regions: ${test1HasRegions}`);
      }
      console.log();
    });

    // ============================================
    // STEP 7: Take screenshot
    // ============================================
    console.log('📝 STEP 7: Take screenshot of table');
    console.log('-'.repeat(80));

    await page.screenshot({
      path: 'admin-users-rbac-with-regions.png',
      fullPage: true
    });
    console.log('✅ Screenshot saved: admin-users-rbac-with-regions.png');
    console.log();

    // ============================================
    // SUMMARY
    // ============================================
    console.log('='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Login successful`);
    console.log(`✅ Admin Users & RBAC page loaded`);
    console.log(`${test1Found ? '✅' : '❌'} test1 user found`);
    console.log(`${test1HasRegions ? '✅' : '❌'} test1 has assigned regions showing`);
    console.log();

    if (test1HasRegions) {
      console.log('🎉 SUCCESS: Assigned regions are now showing in the table!');
    } else {
      console.log('❌ ISSUE: Assigned regions still not showing in table');
      console.log();
      console.log('Possible causes:');
      console.log('  1. Backend not returning assigned_regions field');
      console.log('  2. Frontend not parsing the field correctly');
      console.log('  3. Database has no regions assigned');
      console.log();
      console.log('Debug: Check API response');
      const token = await page.evaluate(() => localStorage.getItem('adminToken'));
      console.log('Run: curl -H "Authorization: Bearer ' + token.substring(0, 20) + '..." http://34.162.168.124:3000/api/admin/admin-users');
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
testAssignedRegionsInTable().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
