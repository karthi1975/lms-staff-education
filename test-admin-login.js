const { chromium } = require('playwright');

async function testAdminLogin() {
    console.log('=========================================');
    console.log('Testing Admin Login');
    console.log('=========================================\n');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // Step 1: Navigate to login page
        console.log('Step 1: Navigating to login page...');
        await page.goto('http://localhost:3000/admin/login.html');
        await page.waitForTimeout(2000);
        console.log('✅ Login page loaded\n');

        // Step 2: Fill in credentials
        console.log('Step 2: Entering credentials...');
        await page.fill('input[type="email"], input[name="email"]', 'admin@school.edu');
        await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
        console.log('✅ Credentials entered\n');

        // Step 3: Click login button
        console.log('Step 3: Clicking login button...');
        await page.click('button[type="submit"], button:has-text("Login")');

        // Wait for navigation or error
        await page.waitForTimeout(3000);

        const currentUrl = page.url();
        console.log('Current URL:', currentUrl);

        // Check if login was successful
        if (currentUrl.includes('dashboard') || currentUrl.includes('courses') || currentUrl.includes('lms-dashboard')) {
            console.log('\n✅ LOGIN SUCCESSFUL!');
            console.log('Redirected to:', currentUrl);

            // Take screenshot
            await page.screenshot({ path: 'login-success.png', fullPage: true });
            console.log('Screenshot saved: login-success.png');
        } else {
            console.log('\n❌ LOGIN FAILED');

            // Check for error message
            const errorMessage = await page.textContent('.error, .alert-danger, .message').catch(() => null);
            if (errorMessage) {
                console.log('Error message:', errorMessage);
            }

            // Take screenshot
            await page.screenshot({ path: 'login-failed.png', fullPage: true });
            console.log('Screenshot saved: login-failed.png');

            // Check network requests
            console.log('\nChecking what happened...');
            const content = await page.content();
            if (content.includes('Invalid')) {
                console.log('Found "Invalid" in page content - credentials might be wrong');
            }
        }

        // Keep browser open for 5 seconds so you can see
        await page.waitForTimeout(5000);

    } catch (error) {
        console.error('\n❌ Error during test:', error.message);
        await page.screenshot({ path: 'login-error.png', fullPage: true });
    } finally {
        await browser.close();
    }

    console.log('\n=========================================');
    console.log('Test Complete');
    console.log('=========================================');
}

// Run the test
testAdminLogin().catch(console.error);
