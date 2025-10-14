const { chromium } = require('playwright');

// Test configuration
const TEST_DURATION_MINUTES = 60;
const TEST_INTERVAL_MINUTES = 5;
const TOTAL_RUNS = TEST_DURATION_MINUTES / TEST_INTERVAL_MINUTES;

// Test results tracking
const testResults = {
  runs: [],
  totalTests: 0,
  passed: 0,
  failed: 0
};

async function runSingleTest(runNumber) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const runResults = {
    runNumber,
    timestamp: new Date().toISOString(),
    tests: [],
    errors: []
  };

  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`RUN #${runNumber} - ${new Date().toLocaleString()}`);
    console.log('='.repeat(80));

    // Navigate and login
    await page.goto('http://localhost:3000/admin/user-management.html');
    await page.waitForTimeout(1000);

    if (page.url().includes('login.html')) {
      await page.fill('#email', 'admin@school.edu');
      await page.fill('#password', 'Admin123!');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
      await page.goto('http://localhost:3000/admin/user-management.html');
      await page.waitForTimeout(2000);
    }

    // Get all user rows
    const rows = await page.$$('tbody tr');
    console.log(`\n📋 Found ${rows.length} users\n`);

    // Test WhatsApp User (User 9129)
    console.log('🧪 Testing WhatsApp User: User 9129');
    const whatsappTest = await testUserToggle(page, 'User 9129', 'whatsapp');
    runResults.tests.push(whatsappTest);
    testResults.totalTests++;
    if (whatsappTest.passed) testResults.passed++;
    else testResults.failed++;

    await page.waitForTimeout(2000);

    // Test Admin User (Lynda Kigera)
    console.log('\n🧪 Testing Admin User: Lynda Kigera');
    const adminTest = await testUserToggle(page, 'Lynda Kigera', 'admin');
    runResults.tests.push(adminTest);
    testResults.totalTests++;
    if (adminTest.passed) testResults.passed++;
    else testResults.failed++;

    await page.waitForTimeout(2000);

    // Pick a random admin user to test
    const adminUsers = ['John Williams', 'Lisa Chen', 'Robert Johnson', 'Sarah Miller', 'Emily Davis'];
    const randomAdmin = adminUsers[Math.floor(Math.random() * adminUsers.length)];
    console.log(`\n🎲 Testing Random Admin User: ${randomAdmin}`);
    const randomTest = await testUserToggle(page, randomAdmin, 'admin');
    runResults.tests.push(randomTest);
    testResults.totalTests++;
    if (randomTest.passed) testResults.passed++;
    else testResults.failed++;

    // Summary for this run
    const passedCount = runResults.tests.filter(t => t.passed).length;
    const failedCount = runResults.tests.filter(t => !t.passed).length;

    console.log(`\n${'─'.repeat(80)}`);
    console.log(`Run #${runNumber} Summary: ${passedCount} passed, ${failedCount} failed`);
    console.log('─'.repeat(80));

  } catch (error) {
    console.error(`❌ Run #${runNumber} Error:`, error.message);
    runResults.errors.push(error.message);
    testResults.failed++;
  } finally {
    await browser.close();
    testResults.runs.push(runResults);
  }

  return runResults;
}

async function testUserToggle(page, userName, userType) {
  const test = {
    userName,
    userType,
    passed: false,
    steps: [],
    error: null
  };

  try {
    // Find user row
    const rows = await page.$$('tbody tr');
    let userRow = null;

    for (const row of rows) {
      const name = await row.$eval('td:nth-child(1)', el => el.textContent.trim()).catch(() => '');
      if (name === userName) {
        userRow = row;
        break;
      }
    }

    if (!userRow) {
      test.error = `User "${userName}" not found`;
      console.log(`   ❌ ${userName}: Not found`);
      return test;
    }

    // Get initial status
    const initialStatus = await userRow.$eval('td:nth-child(6)', el => el.textContent.trim());
    test.steps.push({ step: 'initial_status', value: initialStatus });
    console.log(`   📊 Initial Status: ${initialStatus}`);

    // Find and click toggle button
    const activateBtn = await userRow.$('button:has-text("Activate")');
    const deactivateBtn = await userRow.$('button:has-text("Deactivate")');
    const toggleBtn = activateBtn || deactivateBtn;

    if (!toggleBtn) {
      test.error = 'No toggle button found';
      console.log(`   ❌ ${userName}: No toggle button`);
      return test;
    }

    const buttonText = await toggleBtn.textContent();
    test.steps.push({ step: 'button_text', value: buttonText });
    console.log(`   🖱️  Clicking: ${buttonText}`);

    // Click toggle
    await toggleBtn.click();
    await page.waitForTimeout(3000); // Wait for update

    // Reload to get fresh data
    await page.reload();
    await page.waitForTimeout(2000);

    // Find user row again after reload
    const rowsAfter = await page.$$('tbody tr');
    let userRowAfter = null;

    for (const row of rowsAfter) {
      const name = await row.$eval('td:nth-child(1)', el => el.textContent.trim()).catch(() => '');
      if (name === userName) {
        userRowAfter = row;
        break;
      }
    }

    if (!userRowAfter) {
      test.error = 'User not found after reload';
      console.log(`   ❌ ${userName}: Not found after reload`);
      return test;
    }

    // Get new status
    const newStatus = await userRowAfter.$eval('td:nth-child(6)', el => el.textContent.trim());
    test.steps.push({ step: 'new_status', value: newStatus });
    console.log(`   📊 New Status: ${newStatus}`);

    // Verify status changed
    const expectedStatus = buttonText === 'Activate' ? 'Active' : 'Inactive';
    const statusChanged = newStatus === expectedStatus;

    test.steps.push({ step: 'expected_status', value: expectedStatus });
    test.steps.push({ step: 'status_changed', value: statusChanged });

    if (statusChanged) {
      console.log(`   ✅ ${userName}: Status correctly changed to ${newStatus}`);
      test.passed = true;

      // Toggle back to original state
      console.log(`   🔄 Toggling back to ${initialStatus}...`);
      const toggleBackBtn = await userRowAfter.$(`button:has-text("${newStatus === 'Active' ? 'Deactivate' : 'Activate'}")`);
      if (toggleBackBtn) {
        await toggleBackBtn.click();
        await page.waitForTimeout(2000);
        console.log(`   ✅ ${userName}: Toggled back successfully`);
      }
    } else {
      test.error = `Status did not change. Expected: ${expectedStatus}, Got: ${newStatus}`;
      console.log(`   ❌ ${userName}: Status did not change correctly`);
      console.log(`      Expected: ${expectedStatus}`);
      console.log(`      Got: ${newStatus}`);
    }

  } catch (error) {
    test.error = error.message;
    console.log(`   ❌ ${userName}: Error - ${error.message}`);
  }

  return test;
}

async function runAllTests() {
  console.log('\n🚀 STARTING STRESS TEST');
  console.log(`⏱️  Duration: ${TEST_DURATION_MINUTES} minutes`);
  console.log(`🔁 Interval: ${TEST_INTERVAL_MINUTES} minutes`);
  console.log(`📊 Total Runs: ${TOTAL_RUNS}`);
  console.log('='.repeat(80));

  for (let i = 1; i <= TOTAL_RUNS; i++) {
    await runSingleTest(i);

    if (i < TOTAL_RUNS) {
      const waitMinutes = TEST_INTERVAL_MINUTES;
      console.log(`\n⏸️  Waiting ${waitMinutes} minutes until next run...`);
      console.log(`   Next run at: ${new Date(Date.now() + waitMinutes * 60 * 1000).toLocaleString()}`);
      await new Promise(resolve => setTimeout(resolve, waitMinutes * 60 * 1000));
    }
  }

  // Final report
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 FINAL TEST REPORT');
  console.log('='.repeat(80));
  console.log(`Total Runs: ${TOTAL_RUNS}`);
  console.log(`Total Tests: ${testResults.totalTests}`);
  console.log(`Passed: ${testResults.passed} (${((testResults.passed / testResults.totalTests) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${testResults.failed} (${((testResults.failed / testResults.totalTests) * 100).toFixed(1)}%)`);
  console.log('='.repeat(80));

  // Detailed results per run
  console.log('\n📋 DETAILED RESULTS:');
  testResults.runs.forEach((run, idx) => {
    console.log(`\nRun #${run.runNumber} (${run.timestamp}):`);
    run.tests.forEach(test => {
      const status = test.passed ? '✅' : '❌';
      console.log(`  ${status} ${test.userName} (${test.userType})`);
      if (test.error) {
        console.log(`     Error: ${test.error}`);
      }
    });
  });

  // Save results to file
  const fs = require('fs');
  const reportPath = `stress-test-report-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`\n💾 Full report saved to: ${reportPath}`);
}

// Start tests
runAllTests().catch(console.error);
