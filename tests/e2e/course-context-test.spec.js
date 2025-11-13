const { test, expect } = require('@playwright/test');

test.describe('Course Context Tests', () => {
  let page;
  let context;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should understand course context and answer about course itself', async () => {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';

    // Login
    console.log('1. Logging in...');
    await page.goto(`${baseURL}/admin/login.html`);
    await page.fill('input[type="email"]', 'admin@school.edu');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard.html', { timeout: 10000 });
    console.log('✅ Login successful');

    // Navigate to chat
    console.log('2. Navigating to AI Assistant Chat...');
    await page.goto(`${baseURL}/admin/chat.html`);
    await page.waitForSelector('#courseSelect', { timeout: 5000 });

    // Select course and module
    console.log('3. Selecting Business Studies Orientation...');
    await page.selectOption('#courseSelect', { label: 'Business Studies Orientation' });
    await page.waitForTimeout(1000);

    const firstModule = await page.locator('.module-item').first();
    await firstModule.click();
    await page.waitForTimeout(1000);
    console.log('✅ Module selected');

    // Test 1: Ask about the course itself
    console.log('\n📝 TEST 1: Asking "What is Business Studies Orientation?"');
    await page.locator('#messageInput').fill('What is Business Studies Orientation?');
    await page.locator('#sendButton').click();

    await page.waitForSelector('.message.assistant', { timeout: 30000 });

    const assistantMessages1 = await page.locator('.message.assistant').all();
    const lastMessage1 = assistantMessages1[assistantMessages1.length - 1];
    const messageText1 = await lastMessage1.locator('.message-text').textContent();

    console.log('📝 Response preview:', messageText1.substring(0, 200));

    // Assertions
    expect(messageText1).toBeTruthy();
    expect(messageText1.length).toBeGreaterThan(100);
    expect(messageText1.toLowerCase()).not.toContain("don't have specific information");
    expect(messageText1.toLowerCase()).not.toContain("i don't have");

    console.log('✅ TEST 1 PASSED: AI understands course context\n');

    // Test 2: Ask about pedagogical standards
    console.log('📝 TEST 2: Asking "What are the 3 pedagogical standards of business studies?"');
    await page.waitForTimeout(2000); // Wait for previous response to complete

    await page.locator('#messageInput').fill('What are the 3 pedagogical standards of business studies?');
    await page.locator('#sendButton').click();

    // Wait for new assistant message
    await page.waitForTimeout(2000);
    const assistantMessages2 = await page.locator('.message.assistant').all();
    const lastMessage2 = assistantMessages2[assistantMessages2.length - 1];
    const messageText2 = await lastMessage2.locator('.message-text').textContent();

    console.log('📝 Response preview:', messageText2.substring(0, 200));

    // Assertions
    expect(messageText2).toBeTruthy();
    expect(messageText2.length).toBeGreaterThan(100);
    expect(messageText2.toLowerCase()).not.toContain("don't have specific information");

    // Check if response contains relevant content
    const hasRelevantContent =
      messageText2.toLowerCase().includes('pedagog') ||
      messageText2.toLowerCase().includes('standard') ||
      messageText2.toLowerCase().includes('business') ||
      messageText2.toLowerCase().includes('cbc');

    expect(hasRelevantContent).toBe(true);

    console.log('✅ TEST 2 PASSED: AI provides relevant answer about pedagogical standards');

    console.log('\n✅✅✅ ALL COURSE CONTEXT TESTS PASSED! ✅✅✅');
  });
});
