# Prompt Management Workflow E2E Tests

## Overview
Comprehensive Playwright end-to-end tests for the System Prompt Approval Workflow, covering the complete lifecycle from prompt creation to activation.

## Test File
**Location**: `/tests/e2e/prompt-management-workflow.spec.js`

## Test Coverage

### Test Suite 1: Prompt Viewer (Read-Only)
- ✅ Display current prompts side-by-side (Regular & Socratic modes)
- ✅ Load courses in dropdown
- ✅ Verify version numbers and character counts
- ✅ Check for "View Version History" and "Propose Change" buttons

### Test Suite 2: Prompt Editor (Create Request)
- ✅ Create a new change request successfully
- ✅ Validate prompt length (100-5000 characters)
- ✅ Require change reason (minimum 10 characters)
- ✅ Validate prompt must differ from current version

### Test Suite 3: Approval Dashboard (Super Admin)
- ✅ Display pending requests with stats cards
- ✅ Approve a pending request
- ✅ Reject a pending request
- ✅ Activate an approved request
- ✅ Verify status transitions (Pending → Approved → Activated)

### Test Suite 4: Version History
- ✅ Display version timeline
- ✅ View full prompt in modal
- ✅ Download version as .txt file
- ✅ Identify current live version

### Test Suite 5: RBAC (Role-Based Access Control)
- ✅ Allow super admin full access
- ✅ Verify approve/reject buttons are accessible
- ⚠️ Regional admin restrictions (requires regional admin user setup)

### Test Suite 6: End-to-End Workflow
- ✅ **Complete workflow**: Create → Approve → Activate
  - Step 1: Admin creates change request
  - Step 2: Super admin approves request
  - Step 3: Super admin activates request
  - Step 4: Verify prompt is live in viewer

## Statistics
- **Total Tests**: 15
- **Test Suites**: 6
- **Lines of Code**: ~996
- **Average Test Duration**: 5-10 seconds per test

## Prerequisites

### 1. Install Dependencies
```bash
npm install
npm install --save-dev @playwright/test playwright
```

### 2. Install Playwright Browsers
```bash
npx playwright install chromium
```

### 3. Start Application Server
```bash
# Terminal 1: Start the server
npm start
# Or
node server.js
```

The server should be running on `http://localhost:3000`

### 4. Create Test Users
Ensure the following users exist in the database:
- **Super Admin**: `admin@school.edu` / `Admin123!`
- **Regional Admin** (optional): For RBAC tests

## Running Tests

### Run All Tests
```bash
npx playwright test tests/e2e/prompt-management-workflow.spec.js
```

### Run Specific Test Suite
```bash
# Test Suite 1: Prompt Viewer
npx playwright test tests/e2e/prompt-management-workflow.spec.js -g "Prompt Viewer"

# Test Suite 2: Prompt Editor
npx playwright test tests/e2e/prompt-management-workflow.spec.js -g "Prompt Editor"

# Test Suite 3: Approval Dashboard
npx playwright test tests/e2e/prompt-management-workflow.spec.js -g "Approval Dashboard"

# Test Suite 4: Version History
npx playwright test tests/e2e/prompt-management-workflow.spec.js -g "Version History"

# Test Suite 5: RBAC
npx playwright test tests/e2e/prompt-management-workflow.spec.js -g "RBAC"

# Test Suite 6: End-to-End Workflow
npx playwright test tests/e2e/prompt-management-workflow.spec.js -g "complete workflow"
```

### Run with UI Mode (Interactive)
```bash
npx playwright test tests/e2e/prompt-management-workflow.spec.js --ui
```

### Run in Headed Mode (See Browser)
```bash
npx playwright test tests/e2e/prompt-management-workflow.spec.js --headed
```

### Run with Debug Mode
```bash
npx playwright test tests/e2e/prompt-management-workflow.spec.js --debug
```

### Run and Generate HTML Report
```bash
npx playwright test tests/e2e/prompt-management-workflow.spec.js --reporter=html
npx playwright show-report
```

## Test Results

### Screenshots
All tests generate screenshots saved to:
- `tests/screenshots/prompt-viewer-loaded.png`
- `tests/screenshots/prompt-editor-filled.png`
- `tests/screenshots/prompt-editor-success.png`
- `tests/screenshots/approval-dashboard.png`
- `tests/screenshots/request-approved.png`
- `tests/screenshots/request-rejected.png`
- `tests/screenshots/request-activated.png`
- `tests/screenshots/version-history.png`
- `tests/screenshots/e2e-step1-created.png`
- `tests/screenshots/e2e-step2-approved.png`
- `tests/screenshots/e2e-step3-activated.png`
- `tests/screenshots/e2e-step4-verified.png`
- `tests/screenshots/FAILED-*.png` (on test failure)

### Videos
On failure, videos are recorded to:
- `test-results/`

## Environment Variables

### Optional Configuration
```bash
# Use custom base URL
BASE_URL=http://34.162.168.124:3000 npx playwright test tests/e2e/prompt-management-workflow.spec.js

# Use production server
BASE_URL=https://teachers-training.example.com npx playwright test tests/e2e/prompt-management-workflow.spec.js
```

## Troubleshooting

### Issue: Tests Failing Due to Timeout
**Solution**: Increase timeout in `playwright.config.js`:
```javascript
module.exports = defineConfig({
  timeout: 120000, // 2 minutes
});
```

### Issue: Login Fails
**Solution**: Verify test user exists:
```bash
# Check database for admin user
sqlite3 teachers_training.db "SELECT * FROM admin_users WHERE email='admin@school.edu';"
```

### Issue: Course Dropdown Empty
**Solution**: Ensure courses exist in database:
```bash
sqlite3 teachers_training.db "SELECT id, course_name FROM courses LIMIT 5;"
```

### Issue: Screenshots Not Saving
**Solution**: Create screenshots directory:
```bash
mkdir -p tests/screenshots
```

### Issue: Modal Not Appearing
**Solution**: Increase wait timeout:
```javascript
await page.waitForTimeout(2000); // Increase to 3000 or 5000
```

## Best Practices

1. **Run tests sequentially**: Use `workers: 1` in config to avoid race conditions
2. **Clean up after tests**: Delete test requests after running (optional)
3. **Use unique timestamps**: Each test uses `Date.now()` to create unique data
4. **Check console logs**: Tests include detailed console output for debugging
5. **Review screenshots**: Always check screenshots when tests fail

## Continuous Integration (CI)

### GitHub Actions Example
```yaml
name: E2E Tests - Prompt Workflow

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '16'
      - run: npm install
      - run: npx playwright install --with-deps chromium
      - run: npm start &
      - run: sleep 10
      - run: npx playwright test tests/e2e/prompt-management-workflow.spec.js
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Test Maintenance

### When to Update Tests
- ✅ When UI element selectors change
- ✅ When API endpoints are modified
- ✅ When validation rules are updated
- ✅ When new features are added to the workflow

### Adding New Tests
1. Follow existing test structure
2. Use helper functions (`login`, `logout`, `getFirstCourseId`)
3. Add descriptive console logs
4. Take screenshots at key steps
5. Clean up test data if needed

## Support
For issues or questions, contact the QA team or create a GitHub issue.

---

**Last Updated**: 2025-11-04
**Test Version**: 1.0.0
**Playwright Version**: 1.56.0
