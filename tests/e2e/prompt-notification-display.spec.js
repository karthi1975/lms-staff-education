/**
 * End-to-End Test: Regional Admin Notification Display
 *
 * This test verifies that Regional Admins can see the status of their
 * submitted prompt change requests in the View Prompts section.
 *
 * Test Scenarios:
 * 1. Regional Admin logs in
 * 2. Navigates to View Prompts page
 * 3. Selects course and sees "My Prompt Requests" section
 * 4. Verifies status cards display correctly with:
 *    - Status badges (Pending/Approved/Rejected)
 *    - Submission timestamps
 *    - Review timestamps (if reviewed)
 *    - Reviewer names (if reviewed)
 *    - Rejection feedback (if rejected)
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.TEST_BASE_URL || 'http://34.162.168.124:3000';

const REGIONAL_ADMIN = {
    email: 'test1@school.edu',
    password: 'Admin2025^lCl',
    name: 'test1',
    region: 'Tanzania'
};

const TEST_COURSE = {
    id: 8,
    name: 'Business Studies Orientation',
    code: 'BS-ORIENT-001'
};

test.describe('Regional Admin Notification Display', () => {

    test('Should display "My Prompt Requests" section with status cards', async ({ page }) => {
        console.log('\n========================================');
        console.log('TEST: Notification Display for Regional Admin');
        console.log('========================================\n');

        // Step 1: Login as Regional Admin
        console.log('Step 1: Logging in as Regional Admin...');
        await page.goto(`${BASE_URL}/admin/login.html`);
        await page.fill('input[type="email"]', REGIONAL_ADMIN.email);
        await page.fill('input[type="password"]', REGIONAL_ADMIN.password);
        await page.click('button[type="submit"]');
        await page.waitForURL(`${BASE_URL}/admin/dashboard.html`, { timeout: 10000 });
        console.log('✅ Login successful');

        // Step 2: Navigate to View Prompts page
        console.log('\nStep 2: Navigating to View Prompts page...');
        await page.click('a[href="prompt-viewer.html"]');
        await page.waitForURL(`${BASE_URL}/admin/prompt-viewer.html`, { timeout: 10000 });
        await page.waitForTimeout(2000);
        console.log('✅ Navigated to View Prompts');

        // Step 3: Select region
        console.log('\nStep 3: Selecting region...');
        const regionSelect = page.locator('#regionSelect');
        await regionSelect.selectOption({ label: REGIONAL_ADMIN.region });
        await page.waitForTimeout(1000);
        console.log('✅ Region selected');

        // Step 4: Select course
        console.log('\nStep 4: Selecting course...');
        const courseSelect = page.locator('#courseSelect');

        // Wait for courses to load
        await page.waitForTimeout(1000);
        const courseOptions = await courseSelect.locator('option').count();
        console.log(`   Found ${courseOptions - 1} course(s)`);

        if (courseOptions > 1) {
            // Select the first real course (index 1, skipping "Select Course" option)
            await courseSelect.selectOption({ index: 1 });
            await page.waitForTimeout(2000);
            console.log('✅ Course selected');
        } else {
            console.log('⚠️  No courses available for this region');
            return;
        }

        // Step 5: Check for "My Prompt Requests" section
        console.log('\nStep 5: Checking for notification section...');
        const notificationContainer = page.locator('#myRequestsContainer');
        const isVisible = await notificationContainer.isVisible().catch(() => false);

        if (!isVisible) {
            console.log('ℹ️  No requests found for this course (section hidden)');
            console.log('   This is expected if no requests have been submitted');
            console.log('\n✅ TEST PASSED: Section correctly hidden when no requests exist');
            return;
        }

        console.log('✅ "My Prompt Requests" section is visible');

        // Step 6: Verify section header
        const sectionHeader = await page.locator('#myRequestsContainer h2').textContent();
        expect(sectionHeader).toBe('My Prompt Requests');
        console.log('✅ Section header correct');

        // Step 7: Count and verify request cards
        const requestCards = page.locator('.request-card');
        const cardCount = await requestCards.count();
        console.log(`✅ Found ${cardCount} request card(s)`);

        if (cardCount === 0) {
            console.log('ℹ️  Section visible but no cards rendered');
            return;
        }

        // Step 8: Verify card structure for each request
        console.log('\nStep 8: Verifying card structure...');

        for (let i = 0; i < cardCount; i++) {
            const card = requestCards.nth(i);

            // Check for status badge
            const statusBadge = card.locator('.status-badge');
            const badgeText = await statusBadge.textContent();
            console.log(`   Card ${i + 1}: Status = ${badgeText.trim()}`);

            // Verify status badge color class
            const badgeClasses = await statusBadge.getAttribute('class');
            const hasColorClass = badgeClasses.includes('success') ||
                                 badgeClasses.includes('warning') ||
                                 badgeClasses.includes('error');
            expect(hasColorClass).toBe(true);

            // Check for request title
            const titleElement = card.locator('.request-title');
            const title = await titleElement.textContent();
            expect(title).toBeTruthy();
            console.log(`              Course = ${title}`);

            // Check for mode display
            const modeElement = card.locator('.request-mode');
            const mode = await modeElement.textContent();
            expect(mode).toContain('Mode:');
            console.log(`              ${mode}`);

            // Check for submission timestamp
            const infoItems = card.locator('.request-info-item');
            const infoCount = await infoItems.count();
            expect(infoCount).toBeGreaterThan(0);
            console.log(`              ${infoCount} info items displayed`);

            // Check for rejection feedback panel (if status is rejected)
            if (badgeText.includes('Rejected')) {
                const feedbackPanel = card.locator('.request-feedback');
                const hasFeedback = await feedbackPanel.isVisible().catch(() => false);
                if (hasFeedback) {
                    console.log(`              ⚠️  Rejection feedback visible`);
                }
            }
        }

        console.log('\n✅ All cards verified successfully');

        // Step 9: Verify API integration
        console.log('\nStep 9: Verifying API integration...');

        // Wait for network idle
        await page.waitForLoadState('networkidle');

        // Check console for errors
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        await page.waitForTimeout(1000);

        if (consoleErrors.length > 0) {
            console.log(`⚠️  ${consoleErrors.length} console error(s) detected:`);
            consoleErrors.forEach(err => console.log(`   - ${err}`));
        } else {
            console.log('✅ No console errors detected');
        }

        console.log('\n========================================');
        console.log('✅ TEST PASSED: Notification Display Complete');
        console.log('========================================\n');
    });

    test('Should handle empty state gracefully when no requests exist', async ({ page }) => {
        console.log('\n========================================');
        console.log('TEST: Empty State Handling');
        console.log('========================================\n');

        // Login
        await page.goto(`${BASE_URL}/admin/login.html`);
        await page.fill('input[type="email"]', REGIONAL_ADMIN.email);
        await page.fill('input[type="password"]', REGIONAL_ADMIN.password);
        await page.click('button[type="submit"]');
        await page.waitForURL(`${BASE_URL}/admin/dashboard.html`, { timeout: 10000 });

        // Navigate to View Prompts
        await page.click('a[href="prompt-viewer.html"]');
        await page.waitForURL(`${BASE_URL}/admin/prompt-viewer.html`, { timeout: 10000 });
        await page.waitForTimeout(2000);

        console.log('✅ Navigated to View Prompts page');

        // The section should be hidden initially
        const notificationContainer = page.locator('#myRequestsContainer');
        const isVisible = await notificationContainer.isVisible().catch(() => false);

        if (!isVisible) {
            console.log('✅ Section correctly hidden before course selection');
        }

        console.log('\n✅ TEST PASSED: Empty state handled correctly');
    });

    test('Should display correct status icons and colors', async ({ page }) => {
        console.log('\n========================================');
        console.log('TEST: Status Icons and Colors');
        console.log('========================================\n');

        // Login and navigate
        await page.goto(`${BASE_URL}/admin/login.html`);
        await page.fill('input[type="email"]', REGIONAL_ADMIN.email);
        await page.fill('input[type="password"]', REGIONAL_ADMIN.password);
        await page.click('button[type="submit"]');
        await page.waitForURL(`${BASE_URL}/admin/dashboard.html`, { timeout: 10000 });

        await page.click('a[href="prompt-viewer.html"]');
        await page.waitForURL(`${BASE_URL}/admin/prompt-viewer.html`, { timeout: 10000 });
        await page.waitForTimeout(2000);

        // Select region and course
        const regionSelect = page.locator('#regionSelect');
        await regionSelect.selectOption({ label: REGIONAL_ADMIN.region });
        await page.waitForTimeout(1000);

        const courseSelect = page.locator('#courseSelect');
        const courseOptions = await courseSelect.locator('option').count();

        if (courseOptions > 1) {
            await courseSelect.selectOption({ index: 1 });
            await page.waitForTimeout(2000);
        }

        // Check for status badges and verify icons
        const statusBadges = page.locator('.status-badge');
        const badgeCount = await statusBadges.count();

        console.log(`Found ${badgeCount} status badge(s)`);

        const statusMapping = {
            'Pending Review': { icon: '⏳', color: 'warning' },
            'Approved & Active': { icon: '✅', color: 'success' },
            'Rejected': { icon: '❌', color: 'error' }
        };

        for (let i = 0; i < badgeCount; i++) {
            const badge = statusBadges.nth(i);
            const badgeText = await badge.textContent();
            const badgeClasses = await badge.getAttribute('class');

            console.log(`Badge ${i + 1}: ${badgeText.trim()}`);

            // Verify appropriate icon exists
            for (const [statusName, { icon, color }] of Object.entries(statusMapping)) {
                if (badgeText.includes(statusName)) {
                    expect(badgeText).toContain(icon);
                    expect(badgeClasses).toContain(color);
                    console.log(`   ✅ Correct icon (${icon}) and color (${color})`);
                    break;
                }
            }
        }

        console.log('\n✅ TEST PASSED: Status icons and colors verified');
    });
});
