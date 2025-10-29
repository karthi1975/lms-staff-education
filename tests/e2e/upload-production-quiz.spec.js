const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * Test: Upload Production Module Quiz
 * Purpose: Automated upload of quiz for Production module (Module 1)
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://34.162.136.203:3000';
const ADMIN_EMAIL = 'admin@school.edu';
const ADMIN_PASSWORD = 'Admin123!';
const QUIZ_FILE_PATH = '/Users/karthi/business/staff_education/teachers_training/quizzes/CORRECT_MODULES/module_01_production.json';

test.describe('Production Module Quiz Upload', () => {
  let authToken;

  test.beforeAll(async ({ request }) => {
    // Login to get auth token
    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      }
    });

    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    authToken = loginData.token;

    console.log('✅ Logged in successfully');
  });

  test('should upload Production module quiz successfully', async ({ page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/admin/login.html`);

    // Login
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL('**/admin/index.html', { timeout: 10000 });
    console.log('✅ Logged into admin dashboard');

    // Navigate to courses page
    await page.goto(`${BASE_URL}/admin/courses.html`);
    await page.waitForLoadState('networkidle');
    console.log('✅ Navigated to courses page');

    // Click on Business Studies course (course ID 1)
    await page.click('a[href*="course-detail.html?id=1"]');
    await page.waitForLoadState('networkidle');
    console.log('✅ Opened Business Studies course');

    // Find and click "Upload Quiz" button for Production module
    const productionSection = page.locator('text=Production').first();
    await productionSection.scrollIntoViewIfNeeded();

    // Click Upload Quiz button for Production module (Module 1)
    const uploadQuizButton = page.locator('button:has-text("Upload Quiz")').first();
    await uploadQuizButton.click();
    console.log('✅ Clicked Upload Quiz button for Production module');

    // Wait for upload modal to appear
    await page.waitForSelector('text=Upload Quiz JSON File', { timeout: 5000 });
    console.log('✅ Quiz upload modal opened');

    // Read quiz file content
    const quizContent = fs.readFileSync(QUIZ_FILE_PATH, 'utf-8');
    const quizData = JSON.parse(quizContent);
    console.log(`📄 Quiz file loaded: ${quizData.questions.length} questions`);

    // Set file input
    const fileInput = await page.locator('input[type="file"]#quizFileInput');
    await fileInput.setInputFiles(QUIZ_FILE_PATH);
    console.log('✅ Quiz file selected');

    // Wait for preview to appear
    await page.waitForSelector('text=Valid quiz file', { timeout: 5000 });
    console.log('✅ Quiz file validated');

    // Click Upload button
    await page.click('button:has-text("Upload Quiz")');
    console.log('⏳ Uploading quiz...');

    // Wait for success message or error
    await page.waitForSelector('text=Quiz uploaded successfully', {
      timeout: 10000,
      state: 'visible'
    }).catch(async () => {
      // If success message not found, check for error
      const errorDiv = await page.locator('.alert-danger, .error-message').textContent().catch(() => null);
      if (errorDiv) {
        throw new Error(`Quiz upload failed: ${errorDiv}`);
      }
      throw new Error('Quiz upload timed out - no success or error message');
    });

    console.log('✅ Quiz uploaded successfully');

    // Verify quiz appears in module section
    await page.waitForSelector('text=No quiz', { state: 'hidden', timeout: 5000 });

    // Check that quiz count is displayed
    const quizIndicator = await page.locator('text=/\\d+ questions?/').first();
    const quizCount = await quizIndicator.textContent();
    console.log(`✅ Quiz verified: ${quizCount}`);

    expect(quizCount).toContain('5'); // Production module has 5 questions
  });

  test('should verify quiz details after upload', async ({ request }) => {
    // Get module 1 (Production) quiz via API
    const response = await request.get(`${BASE_URL}/api/admin/courses/1/modules/1/quiz`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    console.log('📊 Quiz Details:');
    console.log(`  - Quiz ID: ${data.quiz?.id}`);
    console.log(`  - Module ID: ${data.quiz?.module_id}`);
    console.log(`  - Questions: ${data.questions?.length || 0}`);

    expect(data.success).toBe(true);
    expect(data.questions).toBeDefined();
    expect(data.questions.length).toBe(5); // Production module has 5 questions

    // Verify first question
    const firstQuestion = data.questions[0];
    expect(firstQuestion.question).toContain('factors of production');
    expect(JSON.parse(firstQuestion.options).length).toBe(4); // 4 options
    expect(firstQuestion.correct_answer).toBeDefined();

    console.log('✅ Quiz verification complete');
  });
});
