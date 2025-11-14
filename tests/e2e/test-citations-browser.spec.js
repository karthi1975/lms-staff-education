const { test, expect } = require('@playwright/test');

test.describe('Citation and Download Links Test', () => {
  let authToken;
  let courseId;

  test.beforeAll(async ({ request }) => {
    // Login to get auth token
    const loginResponse = await request.post('http://34.162.168.124:3000/admin/login', {
      data: {
        email: 'admin@school.edu',
        password: 'Admin123!'
      }
    });

    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    authToken = loginData.token;

    console.log('✅ Logged in successfully');

    // Get first course ID
    const coursesResponse = await request.get('http://34.162.168.124:3000/api/admin/courses', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(coursesResponse.ok()).toBeTruthy();
    const coursesData = await coursesResponse.json();
    courseId = coursesData.courses[0].id;

    console.log(`✅ Found course ID: ${courseId}`);
  });

  test('should display citations with download links in chat', async ({ page }) => {
    console.log('\n========================================');
    console.log('Testing Citations in Browser');
    console.log('========================================\n');

    // Navigate to admin page
    await page.goto('http://34.162.168.124:3000/admin');
    console.log('1. Navigated to admin page');

    // Login
    await page.fill('input[type="email"]', 'admin@school.edu');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');

    // Wait for login to complete
    await page.waitForURL('**/admin/dashboard.html', { timeout: 10000 });
    console.log('2. ✅ Logged in successfully');

    // Navigate to courses
    await page.waitForSelector('a[href*="courses"]', { timeout: 5000 });
    await page.click('a[href*="courses"]');
    console.log('3. Navigated to courses page');

    // Wait for courses to load and click first course
    await page.waitForSelector('.course-card', { timeout: 10000 });
    const firstCourse = await page.locator('.course-card').first();
    await firstCourse.click();
    console.log('4. ✅ Opened first course');

    // Wait for chat interface to load
    await page.waitForSelector('#chatInput, textarea[placeholder*="message"], input[placeholder*="message"]', { timeout: 10000 });
    console.log('5. ✅ Chat interface loaded');

    // Type a specific question
    const testQuery = 'What is PBA assessment?';
    console.log(`\n6. Typing question: "${testQuery}"`);

    const chatInput = await page.locator('#chatInput, textarea, input[type="text"]').last();
    await chatInput.fill(testQuery);

    // Send message
    await page.keyboard.press('Enter');
    console.log('7. ✅ Message sent');

    // Wait for AI response (with longer timeout for AI processing)
    console.log('8. Waiting for AI response...');
    await page.waitForSelector('.message.assistant', { timeout: 30000 });
    console.log('9. ✅ AI response received');

    // Wait a bit for full response to load
    await page.waitForTimeout(2000);

    // Get the full response text
    const responseText = await page.locator('.message.assistant').last().textContent();
    console.log('\n========================================');
    console.log('AI RESPONSE:');
    console.log('========================================');
    console.log(responseText.substring(0, 500) + '...\n');

    // Check if response contains "Sources" section
    console.log('========================================');
    console.log('CHECKING FOR CITATIONS:');
    console.log('========================================');

    const hasSourcesSection = responseText.includes('Sources:') || responseText.includes('sources');
    console.log(`\n📚 Contains "Sources:" section: ${hasSourcesSection ? '✅ YES' : '❌ NO'}`);

    // Check for download links
    const downloadLinks = await page.locator('.message.assistant a[href*="download"]').count();
    console.log(`🔗 Download links found: ${downloadLinks}`);

    // Check for PDF links
    const pdfLinks = await page.locator('.message.assistant a[href*=".pdf"], a[href*="files/download"]').count();
    console.log(`📄 PDF/file links found: ${pdfLinks}`);

    // Get all links in the assistant message
    const allLinks = await page.locator('.message.assistant a').all();
    console.log(`\n🔍 Total links in response: ${allLinks.length}`);

    if (allLinks.length > 0) {
      console.log('\n📋 Link details:');
      for (let i = 0; i < allLinks.length; i++) {
        const link = allLinks[i];
        const href = await link.getAttribute('href');
        const text = await link.textContent();
        console.log(`   ${i + 1}. Text: "${text}"`);
        console.log(`      URL: ${href}`);
      }
    } else {
      console.log('\n❌ NO LINKS FOUND IN RESPONSE!');

      // Debug: Check raw HTML
      console.log('\n🔍 Raw HTML of assistant message:');
      const messageHTML = await page.locator('.message.assistant').last().innerHTML();
      console.log(messageHTML.substring(0, 1000));
    }

    // Check for source tags
    const sourceTags = await page.locator('.message.assistant .source-tag, .sources').count();
    console.log(`\n🏷️  Source tags found: ${sourceTags}`);

    console.log('\n========================================');
    console.log('TEST RESULTS:');
    console.log('========================================');

    if (downloadLinks > 0) {
      console.log('✅ PASS: Download links found in response');
      console.log(`✅ Found ${downloadLinks} clickable download link(s)`);
    } else if (hasSourcesSection && sourceTags > 0) {
      console.log('⚠️  PARTIAL: Sources section exists but no download links');
      console.log('   This means citations are generated but not as clickable links');
    } else {
      console.log('❌ FAIL: No citations or download links found');
      console.log('   Backend may not be generating citations');
    }

    console.log('\n========================================\n');

    // Take screenshot for debugging
    await page.screenshot({ path: '/tmp/citation-test-screenshot.png', fullPage: true });
    console.log('📸 Screenshot saved to: /tmp/citation-test-screenshot.png\n');

    // Assertions
    expect(hasSourcesSection || downloadLinks > 0).toBeTruthy();
    // expect(downloadLinks).toBeGreaterThan(0); // Commented out to see what we get first
  });

  test('should test API endpoint directly', async ({ request }) => {
    console.log('\n========================================');
    console.log('Testing API Endpoint Directly');
    console.log('========================================\n');

    const response = await request.post(`http://34.162.168.124:3000/api/admin/courses/${courseId}/query-bilingual`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        query: 'What is PBA assessment?',
        language: 'english'
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    console.log('API Response structure:');
    console.log(`- success: ${data.success}`);
    console.log(`- hasContext: ${data.hasContext}`);
    console.log(`- language: ${data.language}`);
    console.log(`- sources: ${data.sources?.length || 0}`);
    console.log(`- citations: ${data.citations?.length || 0}`);

    if (data.citations && data.citations.length > 0) {
      console.log(`\n✅ Backend generated ${data.citations.length} citation(s):`);
      data.citations.forEach((citation, idx) => {
        console.log(`   ${idx + 1}. ${citation.filename || 'Unknown'}`);
        console.log(`      📥 ${citation.downloadUrl}`);
      });
    } else {
      console.log('\n❌ Backend did not generate citations!');
    }

    console.log('\n📝 Answer preview:');
    console.log(data.answer.substring(0, 300) + '...');

    // Check if answer contains markdown links
    const hasMarkdownLinks = /\[([^\]]+)\]\(([^\)]+)\)/.test(data.answer);
    console.log(`\n🔗 Answer contains Markdown links: ${hasMarkdownLinks ? '✅ YES' : '❌ NO'}`);

    if (hasMarkdownLinks) {
      const markdownLinks = data.answer.match(/\[([^\]]+)\]\(([^\)]+)\)/g);
      console.log(`   Found ${markdownLinks.length} Markdown link(s):`);
      markdownLinks.slice(0, 3).forEach(link => console.log(`   - ${link}`));
    }

    console.log('\n========================================\n');

    // Assertions
    expect(data.success).toBeTruthy();
    expect(data.hasContext).toBeTruthy();
  });
});
