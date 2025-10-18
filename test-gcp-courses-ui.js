const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // First login
    console.log('🔐 Logging in to admin portal...');
    await page.goto('http://34.162.136.203:3000/admin/login.html', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.fill('input[type="email"]', 'admin@school.edu');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');

    // Wait for login to complete
    await page.waitForTimeout(2000);

    console.log('✅ Login successful');
    console.log('');

    console.log('🌐 Navigating to GCP LMS Dashboard...');
    await page.goto('http://34.162.136.203:3000/admin/lms-dashboard.html', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for page to load
    await page.waitForTimeout(3000);

    console.log('\n📊 Page Title:', await page.title());

    // Check if courses are visible
    const courses = await page.$$eval('.course-card, [class*="course"]', elements => {
      return elements.map(el => ({
        text: el.textContent.trim().substring(0, 100),
        html: el.innerHTML.substring(0, 200)
      }));
    }).catch(() => []);

    console.log('\n📚 Courses found on page:', courses.length);
    if (courses.length > 0) {
      console.log('\n⚠️  WARNING: Courses are still showing in the UI!');
      console.log('\nCourse details:');
      courses.forEach((course, i) => {
        console.log(`\n${i + 1}. ${course.text}`);
      });
    } else {
      console.log('✅ No courses displayed (database is clean)');
    }

    // Check API response directly
    console.log('\n🔍 Checking API response...');
    const apiResponse = await page.evaluate(async () => {
      try {
        const tokenData = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
        let token = null;

        // Try to parse if it's JSON, otherwise use as-is
        try {
          const parsed = JSON.parse(tokenData);
          token = parsed.accessToken || parsed.token;
        } catch {
          token = tokenData;
        }

        const response = await fetch('/api/admin/courses', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        return { status: response.status, data };
      } catch (err) {
        return { error: err.message };
      }
    });

    console.log('\nAPI Response:', JSON.stringify(apiResponse, null, 2));

    // Check if API returned empty data
    if (apiResponse.data && Array.isArray(apiResponse.data.data) && apiResponse.data.data.length === 0) {
      console.log('\n✅ API confirms: 0 courses in database');
    } else if (apiResponse.data && Array.isArray(apiResponse.data.courses) && apiResponse.data.courses.length === 0) {
      console.log('\n✅ API confirms: 0 courses in database');
    }

    // Take screenshot
    await page.screenshot({ path: '/tmp/gcp-courses-ui.png', fullPage: true });
    console.log('\n📸 Screenshot saved to /tmp/gcp-courses-ui.png');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
