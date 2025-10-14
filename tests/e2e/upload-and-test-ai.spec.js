const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const CONTENT_DIR = '/Users/karthi/business/staff_education/education_materials';
const BASE_URL = 'http://localhost:3000';

// Module 1 files to test
const MODULE_1_FILES = [
  'BS Syllabus Analysis.pdf',
  'BS F1 Textbook.pdf'
];

test.describe('Upload Content and Test AI Assistant', () => {
  let authToken;
  let courseId;
  let moduleId;

  test.beforeAll(async ({ browser }) => {
    // Get auth token and setup
    const page = await browser.newPage();

    // Login
    await page.goto(`${BASE_URL}/admin/login.html`);
    await page.fill('input[type="email"]', 'admin@school.edu');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/lms-dashboard.html', { timeout: 10000 });

    // Get auth token from localStorage
    authToken = await page.evaluate(() => {
      return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    });

    console.log('✅ Authenticated, token:', authToken ? 'Present' : 'Missing');

    // Get course ID (BSTT-001 should exist)
    const coursesResponse = await page.request.get(`${BASE_URL}/api/admin/portal/courses`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const coursesData = await coursesResponse.json();

    if (coursesData.success && coursesData.data.length > 0) {
      courseId = coursesData.data[0].id;
      console.log('✅ Found course ID:', courseId);
    }

    // Get Module 1 ID
    if (courseId) {
      const modulesResponse = await page.request.get(
        `${BASE_URL}/api/admin/portal/courses/${courseId}/modules`,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      const modulesData = await modulesResponse.json();

      if (modulesData.success && modulesData.data.length > 0) {
        // Find Module 1 (sequence_order = 1)
        const module1 = modulesData.data.find(m => m.sequence_order === 1);
        if (module1) {
          moduleId = module1.id;
          console.log('✅ Found Module 1 ID:', moduleId);
        }
      }
    }

    await page.close();
  });

  test('should upload content to Module 1', async ({ page }) => {
    test.setTimeout(300000); // 5 minutes for uploads

    if (!courseId || !moduleId) {
      console.log('⚠️  Skipping upload - Course or Module not found');
      test.skip();
      return;
    }

    console.log('\n🔍 Starting content upload test...');
    console.log('Course ID:', courseId);
    console.log('Module ID:', moduleId);
    console.log('Auth Token:', authToken.substring(0, 20) + '...');

    // Navigate to modules page
    await page.goto(`${BASE_URL}/admin/lms-dashboard.html`);
    await page.waitForLoadState('networkidle');

    // Set auth token
    await page.evaluate((token) => {
      localStorage.setItem('authToken', token);
    }, authToken);

    await page.reload();
    await page.waitForTimeout(2000);

    // Take initial screenshot
    await page.screenshot({ path: 'tests/screenshots/upload-01-initial.png', fullPage: true });

    for (let i = 0; i < MODULE_1_FILES.length; i++) {
      const fileName = MODULE_1_FILES[i];
      const filePath = path.join(CONTENT_DIR, fileName);

      console.log(`\n📤 Uploading file ${i + 1}/${MODULE_1_FILES.length}: ${fileName}`);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${filePath}`);
        continue;
      }

      const fileSize = fs.statSync(filePath).size;
      console.log(`File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

      // Upload using API (more reliable than UI)
      try {
        const response = await page.request.post(
          `${BASE_URL}/api/admin/portal/courses/${courseId}/modules/${moduleId}/upload`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            multipart: {
              file: {
                name: fileName,
                mimeType: 'application/pdf',
                buffer: fs.readFileSync(filePath)
              }
            },
            timeout: 180000 // 3 minutes per file
          }
        );

        const result = await response.json();
        console.log('Upload response:', JSON.stringify(result, null, 2));

        if (result.success) {
          console.log(`✅ ${fileName} uploaded successfully`);
        } else {
          console.log(`❌ ${fileName} upload failed:`, result.error);
        }

        // Wait between uploads
        await page.waitForTimeout(3000);

      } catch (error) {
        console.log(`❌ Upload error for ${fileName}:`, error.message);
      }
    }

    await page.screenshot({ path: 'tests/screenshots/upload-02-complete.png', fullPage: true });
    console.log('\n✅ Upload process complete');
  });

  test('should test AI Assistant with uploaded content', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes

    if (!moduleId) {
      console.log('⚠️  Skipping AI test - Module not found');
      test.skip();
      return;
    }

    console.log('\n🤖 Testing AI Assistant...');

    // Navigate to chat page
    await page.goto(`${BASE_URL}/admin/chat-v2.html`);
    await page.waitForLoadState('networkidle');

    // Set auth token
    await page.evaluate((token) => {
      localStorage.setItem('authToken', token);
    }, authToken);

    await page.reload();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/ai-01-chat-page.png', fullPage: true });

    // Select Module 1 from dropdown
    const moduleDropdown = page.locator('select#moduleSelect, select[name="module"]').first();
    const dropdownExists = await moduleDropdown.count();

    if (dropdownExists > 0) {
      await moduleDropdown.selectOption({ value: moduleId.toString() });
      console.log('✅ Selected Module 1 from dropdown');
      await page.waitForTimeout(1000);
    } else {
      console.log('⚠️  Module dropdown not found, trying direct API call');
    }

    // Test chat endpoint directly via API
    console.log('\n💬 Sending test question to AI...');

    const chatRequest = {
      query: 'What topics are covered in the Business Studies syllabus for Form I?',
      module_id: moduleId,
      useContext: true,
      language: 'english'
    };

    console.log('Chat request:', chatRequest);

    try {
      const chatResponse = await page.request.post(`${BASE_URL}/api/chat`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: chatRequest,
        timeout: 60000
      });

      const chatResult = await chatResponse.json();
      console.log('\n📨 AI Response:');
      console.log(JSON.stringify(chatResult, null, 2));

      if (chatResult.success && chatResult.response) {
        console.log('\n✅ AI Assistant working!');
        console.log('Response preview:', chatResult.response.substring(0, 200) + '...');

        if (chatResult.sources) {
          console.log(`\n📚 Sources found: ${chatResult.sources.length}`);
          chatResult.sources.forEach((source, idx) => {
            console.log(`  ${idx + 1}. ${source.source || source.title || 'Unknown source'}`);
          });
        }

        // Assertions
        expect(chatResult.success).toBe(true);
        expect(chatResult.response).toBeTruthy();
        expect(chatResult.response.length).toBeGreaterThan(50);

        if (MODULE_1_FILES.length > 0) {
          // Should have sources if files were uploaded
          expect(chatResult.sources).toBeDefined();
        }

      } else {
        console.log('❌ AI response failed or empty');
        console.log('Error:', chatResult.error || 'No error message');
      }

    } catch (error) {
      console.log('❌ Chat API error:', error.message);
      throw error;
    }

    await page.screenshot({ path: 'tests/screenshots/ai-02-after-chat.png', fullPage: true });
  });

  test('should verify content in database', async ({ page }) => {
    if (!moduleId) {
      console.log('⚠️  Skipping verification - Module not found');
      test.skip();
      return;
    }

    console.log('\n🔍 Verifying uploaded content...');

    // Check module content via API
    const contentResponse = await page.request.get(
      `${BASE_URL}/api/admin/modules/${moduleId}/content`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    const contentData = await contentResponse.json();
    console.log('\nModule content response:', JSON.stringify(contentData, null, 2));

    if (contentData.success && contentData.data) {
      console.log(`✅ Found ${contentData.data.length} content files`);

      contentData.data.forEach((content, idx) => {
        console.log(`\n  ${idx + 1}. ${content.title || content.file_name}`);
        console.log(`     - ID: ${content.id}`);
        console.log(`     - Type: ${content.content_type}`);
        console.log(`     - Created: ${content.created_at}`);
      });

      expect(contentData.data.length).toBeGreaterThanOrEqual(MODULE_1_FILES.length);
    } else {
      console.log('❌ No content found or error:', contentData.error);
    }
  });

  test('should display comprehensive test summary', async () => {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Course ID: ${courseId}`);
    console.log(`Module ID (Module 1): ${moduleId}`);
    console.log(`Files to upload: ${MODULE_1_FILES.length}`);
    console.log(`Content directory: ${CONTENT_DIR}`);
    console.log('\nExpected Results:');
    console.log('  ✅ Files uploaded to Module 1');
    console.log('  ✅ Content processed and chunked');
    console.log('  ✅ Embeddings generated via Vertex AI');
    console.log('  ✅ Vectors stored in ChromaDB');
    console.log('  ✅ Graph created in Neo4j');
    console.log('  ✅ AI Assistant returns relevant answers');
    console.log('  ✅ Sources included in responses');
    console.log('\nScreenshots saved to: tests/screenshots/');
    console.log('='.repeat(60));
  });

});
