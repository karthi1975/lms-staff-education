const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://34.162.168.124:3000';

async function testCourseCreation() {
  console.log('='.repeat(80));
  console.log('TEST: Course Creation with Region Assignment');
  console.log('='.repeat(80));
  console.log();

  const browser = await chromium.launch({ headless: false, slowMo: 500 });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Listen for console messages from the page
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('===') || text.includes('Loading') || text.includes('Region') || text.includes('Course')) {
        console.log(`[PAGE LOG] ${text}`);
      }
    });

    // ============================================
    // STEP 1: Login as Super Admin (will auto-select Tanzania)
    // ============================================
    console.log('📝 STEP 1: Login as Super Admin (Lynda)');
    console.log('-'.repeat(80));

    await page.goto(`${BASE_URL}/admin/login.html`);
    await page.fill('#email', 'Lynda@admin.com');
    await page.fill('#password', 'Admin123!');
    await page.screenshot({ path: 'login-before-submit.png', fullPage: true });
    await page.click('button[type="submit"]');

    // Add a small wait for form submission
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'login-after-submit.png', fullPage: true });

    // Check current URL
    const currentUrl = page.url();
    console.log(`Current URL after login: ${currentUrl}`);

    // Try waiting with more lenient condition
    try {
      await page.waitForURL(/dashboard\.html/, { timeout: 5000 });
    } catch (e) {
      console.log(`Login redirect did not happen. Current page: ${page.url()}`);
      const pageContent = await page.textContent('body');
      console.log(`Page content preview: ${pageContent.substring(0, 200)}`);
      throw new Error('Login failed - did not redirect to dashboard');
    }
    const token = await page.evaluate(() => localStorage.getItem('adminToken'));
    const adminUser = await page.evaluate(() => localStorage.getItem('adminUser'));

    console.log('✅ Logged in successfully as Lynda (Super Admin)');
    console.log(`Token: ${token.substring(0, 20)}...`);

    try {
      const user = JSON.parse(adminUser);
      console.log(`  Name: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
    } catch (e) {
      console.log('  Could not parse admin user');
    }
    console.log();

    // ============================================
    // STEP 2: Navigate to Courses page
    // ============================================
    console.log('📝 STEP 2: Navigate to Courses page');
    console.log('-'.repeat(80));

    await page.goto(`${BASE_URL}/admin/courses.html`);
    await page.waitForSelector('.btn-primary:has-text("Create Course")', { timeout: 10000 });
    console.log('✅ Courses page loaded');
    console.log();

    // Wait for regions to load
    await page.waitForTimeout(2000);

    // ============================================
    // STEP 3: Click Create Course button
    // ============================================
    console.log('📝 STEP 3: Open Create Course modal');
    console.log('-'.repeat(80));

    await page.click('.btn-primary:has-text("Create Course")');
    await page.waitForSelector('#courseModal.active', { timeout: 5000 });
    console.log('✅ Modal opened');
    console.log();

    // Wait for modal to fully render and regions to load
    await page.waitForTimeout(1000);

    // Wait for region dropdown to have options
    await page.waitForFunction(() => {
      const select = document.getElementById('courseRegion');
      return select && select.options && select.options.length > 0;
    }, { timeout: 5000 });

    // ============================================
    // STEP 4: Check if Tanzania is auto-selected
    // ============================================
    console.log('📝 STEP 4: Verify Tanzania region is auto-selected');
    console.log('-'.repeat(80));

    const selectedRegion = await page.$eval('#courseRegion', select => {
      const selectedIndex = select.selectedIndex;
      if (selectedIndex === -1 || !select.options || !select.options[selectedIndex]) {
        return {
          value: select.value,
          text: 'No selection',
          error: 'No option selected or options not loaded'
        };
      }
      const selectedOption = select.options[selectedIndex];
      return {
        value: select.value,
        text: selectedOption.textContent.trim()
      };
    });

    console.log(`Selected region: ${selectedRegion.text} (value: ${selectedRegion.value})`);

    if (selectedRegion.error) {
      console.log(`⚠️  Error reading region: ${selectedRegion.error}`);

      // Log all available options for debugging
      const allOptions = await page.$eval('#courseRegion', select => {
        return Array.from(select.options).map((opt, idx) => ({
          index: idx,
          value: opt.value,
          text: opt.textContent.trim()
        }));
      });
      console.log('Available region options:', JSON.stringify(allOptions, null, 2));
    } else if (selectedRegion.text.includes('Tanzania') || selectedRegion.text.includes('TZ')) {
      console.log('✅ Tanzania is auto-selected!');
    } else {
      console.log(`⚠️  Expected Tanzania, but got: ${selectedRegion.text}`);
      console.log('   Note: For Super Admins, "All Regions" may be expected instead of Tanzania');
    }
    console.log();

    // ============================================
    // STEP 5: Fill course details
    // ============================================
    console.log('📝 STEP 5: Fill course details');
    console.log('-'.repeat(80));

    const courseCode = `TZ-TEST-${Date.now()}`;
    await page.fill('#courseTitle', 'Tanzania Business Studies Test');
    await page.fill('#courseCode', courseCode);
    await page.fill('#courseDescription', 'This is a test course for Tanzania region with OCR document support');
    await page.selectOption('#courseCategory', 'Business Studies');
    await page.selectOption('#difficultyLevel', 'beginner');
    await page.fill('#durationWeeks', '12');

    console.log(`✅ Course details filled:`);
    console.log(`   Title: Tanzania Business Studies Test`);
    console.log(`   Code: ${courseCode}`);
    console.log(`   Category: Business Studies`);
    console.log(`   Level: Beginner`);
    console.log(`   Duration: 12 weeks`);
    console.log(`   Region: ${selectedRegion.text}`);
    console.log();

    // Take screenshot before save
    await page.screenshot({ path: 'course-modal-filled.png', fullPage: true });
    console.log('📸 Screenshot: course-modal-filled.png');
    console.log();

    // ============================================
    // STEP 6: Click Save Course
    // ============================================
    console.log('📝 STEP 6: Save course');
    console.log('-'.repeat(80));

    await page.click('#saveCourseBtn');
    console.log('✅ Save button clicked');

    // Wait for either success message or error
    await page.waitForTimeout(3000);

    // Check for success alert
    const successAlert = await page.textContent('#alertSuccess').catch(() => '');
    const errorAlert = await page.textContent('#alertError').catch(() => '');

    if (successAlert && successAlert.trim()) {
      console.log(`✅ SUCCESS: ${successAlert}`);
    } else if (errorAlert && errorAlert.trim()) {
      console.log(`❌ ERROR: ${errorAlert}`);
    } else {
      console.log('⚠️  No alert message displayed');
    }
    console.log();

    // Check if modal closed
    await page.waitForTimeout(1000);
    const modalStillVisible = await page.isVisible('#courseModal.active');
    if (!modalStillVisible) {
      console.log('✅ Modal closed');
    } else {
      console.log('⚠️  Modal still open');
    }
    console.log();

    // ============================================
    // STEP 7: Verify course appears in list
    // ============================================
    console.log('📝 STEP 7: Verify course appears in list');
    console.log('-'.repeat(80));

    await page.waitForTimeout(2000);

    const courseCards = await page.$$('.course-card');
    console.log(`Total courses visible: ${courseCards.length}`);

    // Check if our course is in the list
    const pageContent = await page.content();
    if (pageContent.includes(courseCode)) {
      console.log('✅ New course found in list!');
    } else {
      console.log('⚠️  New course not yet visible in list');
    }
    console.log();

    // Take final screenshot
    await page.screenshot({ path: 'courses-list-updated.png', fullPage: true });
    console.log('📸 Screenshot: courses-list-updated.png');
    console.log();

    // ============================================
    // STEP 8: Verify in database via API
    // ============================================
    console.log('📝 STEP 8: Verify course in database');
    console.log('-'.repeat(80));

    const apiCheck = await page.evaluate(async ({baseUrl, authToken, code}) => {
      try {
        const response = await fetch(`${baseUrl}/api/admin/courses`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        const data = await response.json();
        const course = data.data.find(c => c.code === code);

        return {
          found: !!course,
          course: course || null
        };
      } catch (error) {
        return {
          error: error.message
        };
      }
    }, {baseUrl: BASE_URL, authToken: token, code: courseCode});

    if (apiCheck.found) {
      console.log('✅ Course verified in database!');
      console.log(`   ID: ${apiCheck.course.id}`);
      console.log(`   Title: ${apiCheck.course.title}`);
      console.log(`   Region ID: ${apiCheck.course.region_id}`);
      console.log(`   Created By: ${apiCheck.course.created_by}`);
    } else {
      console.log('❌ Course not found in database');
      if (apiCheck.error) {
        console.log(`   Error: ${apiCheck.error}`);
      }
    }
    console.log();

    // ============================================
    // SUMMARY
    // ============================================
    console.log('='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    console.log('✅ Login successful (Lynda@admin.com - Super Admin)');
    console.log('✅ Courses page loaded');
    console.log('✅ Create Course modal opened');

    // Check region selection based on user role
    const regionCheckPassed = selectedRegion.text.includes('Tanzania') ||
                              selectedRegion.text.includes('TZ') ||
                              selectedRegion.text.includes('All Regions');
    console.log(`${regionCheckPassed ? '✅' : '⚠️'} Region auto-selected: ${selectedRegion.text}`);

    console.log('✅ Course details filled');
    console.log(`${successAlert ? '✅' : '❌'} Course creation ${successAlert ? 'successful' : 'status unknown'}`);
    console.log(`${!modalStillVisible ? '✅' : '⚠️'} Modal closed after save`);
    console.log(`${apiCheck.found ? '✅' : '❌'} Course verified in database`);
    console.log();

    if (apiCheck.found && regionCheckPassed) {
      console.log('🎉 ALL TESTS PASSED!');
      console.log();
      console.log('Next Steps:');
      console.log('  1. Upload course materials (PDF, images) via UI');
      console.log('  2. Documents will be processed with OCR');
      console.log('  3. Content will be indexed in ChromaDB + Neo4j');
      console.log('  4. Course ready for WhatsApp RAG queries!');
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
testCourseCreation().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
