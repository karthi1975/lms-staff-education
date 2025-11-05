# Regional Admin Prompt Workflow E2E Tests

Comprehensive Playwright end-to-end tests verifying the integration between backend API and UI for the regional admin prompt approval workflow.

## Overview

This test suite validates:
- ✅ Regional admin access control (view/create prompts for assigned regions only)
- ✅ Super admin approval workflow (approve/reject all requests)
- ✅ Cross-region access prevention (403 errors for unauthorized access)
- ✅ Backend-UI integration (form submissions, API responses, database updates)
- ✅ Audit trail logging (all actions tracked)

## Test Coverage

### Suite 1: Regional Admin - View Prompts (6 tests)
1. Regional admin can log in
2. Assigned regions display in prompt-viewer.html
3. Course dropdown populates with accessible courses only
4. Default prompts display for Regular and Socratic modes
5. Prompt metadata (version, date, updated by) displays correctly
6. "Create Custom Prompt" button redirects to editor with courseId

### Suite 2: Regional Admin - Create Custom Prompt (7 tests)
1. Prompt editor loads with course pre-selected from URL
2. Mode selector (Regular/Socratic) works
3. Current active prompt loads as reference
4. Character counter updates in real-time
5. Validation errors show for invalid inputs
6. "Save as Draft" creates draft request successfully
7. "Submit for Approval" creates and submits request with request ID

### Suite 3: Super Admin - Approval Dashboard (6 tests)
1. Super admin can log in
2. Super admin sees ALL pending requests (not filtered by region)
3. Pending request cards show region information
4. Region filter dropdown works
5. Approve modal opens with request details
6. Reject modal opens with feedback requirement

### Suite 4: Cross-Region Access Control (4 tests)
1. Regional admin CANNOT see courses from other regions
2. Regional admin CANNOT create requests for other region courses (403)
3. Regional admin CANNOT see pending requests from other regions
4. Super admin CAN see all regions

### Suite 5: Backend-UI Integration Verification (4 tests)
1. Backend creates prompt → UI displays it correctly
2. UI submits form → Backend creates request in database
3. Backend approves request → UI shows updated version
4. Audit trail logs actions correctly

**Total: 27 E2E Tests**

## Prerequisites

### 1. Required Software
- Node.js 16+
- PostgreSQL database
- Playwright (already in devDependencies)

### 2. Database Setup
Ensure migrations are run:
```bash
# Run RBAC migration (creates regions, admin_regions tables)
psql -U teachers_user -d teachers_training -f database/migrations/010_create_rbac_tables_postgres.sql

# Run prompt approval migration (creates prompt tables)
psql -U teachers_user -d teachers_training -f database/migrations/006_dual_coaching_with_approval.sql
```

### 3. Environment Variables
Create `.env` file with:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=teachers_training
DB_USER=teachers_user
DB_PASSWORD=secure_password_123
BASE_URL=http://localhost:3000
```

## Setup Instructions

### Step 1: Install Dependencies
```bash
npm install
npx playwright install chromium
```

### Step 2: Start Server
```bash
# Terminal 1: Start application server
npm start
# Server should run on http://localhost:3000
```

### Step 3: Setup Test Data
```bash
# Terminal 2: Run test setup script
node tests/e2e/setup-regional-workflow-tests.js
```

This creates:
- **Regions**: Tanzania (TZ), Kenya (KE)
- **Test Admins**:
  - Super Admin: admin@school.edu / Admin123!
  - Regional Admin (Tanzania): regional.tz@school.edu / Regional123!
  - Regional Admin (Kenya): regional.ke@school.edu / Regional123!
- **Test Courses**:
  - Business Studies (Tanzania region)
  - ICT Training (Kenya region)
  - Mathematics for Teachers (Tanzania region)
- **Bot Configurations**: Default prompts for all courses

### Step 4: Run Tests
```bash
# Run all tests
npx playwright test tests/e2e/regional-admin-prompt-workflow.spec.js

# Run specific suite
npx playwright test tests/e2e/regional-admin-prompt-workflow.spec.js --grep "Suite 1"

# Run in headed mode (see browser)
npx playwright test tests/e2e/regional-admin-prompt-workflow.spec.js --headed

# Run with debug mode
npx playwright test tests/e2e/regional-admin-prompt-workflow.spec.js --debug
```

## Test Data

### Test Users

| Role | Email | Password | Region Access | Course Access |
|------|-------|----------|---------------|---------------|
| Super Admin | admin@school.edu | Admin123! | All regions | All courses |
| Regional Admin (TZ) | regional.tz@school.edu | Regional123! | Tanzania only | TZ courses only |
| Regional Admin (KE) | regional.ke@school.edu | Regional123! | Kenya only | KE courses only |

### Test Courses

| Course | Code | Region | Description |
|--------|------|--------|-------------|
| Business Studies | BUS101 | Tanzania (1) | Introduction to Business |
| ICT Training | ICT101 | Kenya (2) | ICT fundamentals |
| Mathematics for Teachers | MATH101 | Tanzania (1) | Advanced Math |

## Test Execution

### Expected Behavior

#### Regional Admin (Tanzania)
- ✅ Can log in
- ✅ Sees Tanzania region in viewer
- ✅ Sees Business Studies and Mathematics courses in dropdown
- ✅ Can create prompt requests for TZ courses
- ✅ Cannot access Kenya courses (403 error)

#### Regional Admin (Kenya)
- ✅ Can log in
- ✅ Sees Kenya region in viewer
- ✅ Sees ICT Training course in dropdown
- ✅ Can create prompt requests for KE courses
- ✅ Cannot access Tanzania courses (403 error)

#### Super Admin
- ✅ Can log in
- ✅ Sees ALL regions (Tanzania, Kenya, Rwanda, Burundi, All Regions)
- ✅ Sees ALL courses regardless of region
- ✅ Can approve/reject ALL pending requests
- ✅ Can filter requests by region

### Success Criteria

All tests should **PASS** with:
- ✅ No 500 errors (backend crashes)
- ✅ 403 errors for cross-region access (correct)
- ✅ All UI elements render correctly
- ✅ Form submissions create database records
- ✅ API responses match UI state
- ✅ Screenshots saved on failures

## Screenshots

Test screenshots are saved to:
```
tests/screenshots/regional-workflow/
```

### Screenshot Types

1. **Login Screenshots**:
   - `login-success-super-admin.png`
   - `login-success-regional-tz.png`
   - `login-success-regional-ke.png`

2. **UI Verification Screenshots**:
   - `regional-admin-regions-display.png`
   - `course-dropdown-populated.png`
   - `both-prompts-displayed.png`
   - `prompt-metadata-display.png`

3. **Workflow Screenshots**:
   - `editor-preselected-course.png`
   - `character-counter.png`
   - `validation-error-short-prompt.png`
   - `draft-saved-success.png`
   - `submit-approval-success.png`

4. **Access Control Screenshots**:
   - `cross-region-403-error.png`
   - `super-admin-all-regions.png`

5. **Failure Screenshots** (only on test failures):
   - `FAILED-{test-name}.png`

## Troubleshooting

### Common Issues

#### 1. Server Not Running
**Error**: `page.goto: net::ERR_CONNECTION_REFUSED`

**Solution**:
```bash
# Start server
npm start
# Wait for: "Server running on port 3000"
```

#### 2. Database Connection Failed
**Error**: `ECONNREFUSED 127.0.0.1:5432`

**Solution**:
```bash
# Check PostgreSQL is running
sudo service postgresql status

# Verify credentials in .env match database
psql -U teachers_user -d teachers_training
```

#### 3. Test Users Don't Exist
**Error**: `Invalid credentials` during login

**Solution**:
```bash
# Re-run setup script
node tests/e2e/setup-regional-workflow-tests.js
```

#### 4. Migrations Not Run
**Error**: `relation "regions" does not exist`

**Solution**:
```bash
# Run migrations
psql -U teachers_user -d teachers_training -f database/migrations/010_create_rbac_tables_postgres.sql
psql -U teachers_user -d teachers_training -f database/migrations/006_dual_coaching_with_approval.sql
```

#### 5. Tests Timeout
**Error**: `Test timeout of 60000ms exceeded`

**Solution**:
```bash
# Increase timeout in playwright.config.js
timeout: 120000 # 2 minutes

# Or run with slower network
npx playwright test --slow-mo=1000
```

### Debug Mode

Run tests with verbose logging:
```bash
# Enable debug logs
DEBUG=pw:api npx playwright test tests/e2e/regional-admin-prompt-workflow.spec.js

# Interactive debug mode
npx playwright test tests/e2e/regional-admin-prompt-workflow.spec.js --debug --headed
```

## Cleanup

### Remove Test Data
```bash
# SQL script to clean up test data
psql -U teachers_user -d teachers_training << EOF
DELETE FROM admin_regions WHERE admin_user_id IN (
  SELECT id FROM admin_users WHERE email LIKE '%@school.edu'
);
DELETE FROM course_bot_configs WHERE course_id IN (
  SELECT id FROM courses WHERE code IN ('BUS101', 'ICT101', 'MATH101')
);
DELETE FROM courses WHERE code IN ('BUS101', 'ICT101', 'MATH101');
DELETE FROM admin_users WHERE email IN (
  'admin@school.edu',
  'regional.tz@school.edu',
  'regional.ke@school.edu'
);
EOF
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests - Regional Workflow

on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_DB: teachers_training
          POSTGRES_USER: teachers_user
          POSTGRES_PASSWORD: secure_password_123
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '16'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Run migrations
        run: |
          psql -h localhost -U teachers_user -d teachers_training -f database/migrations/010_create_rbac_tables_postgres.sql
          psql -h localhost -U teachers_user -d teachers_training -f database/migrations/006_dual_coaching_with_approval.sql

      - name: Setup test data
        run: node tests/e2e/setup-regional-workflow-tests.js

      - name: Start server
        run: npm start &
        env:
          NODE_ENV: test

      - name: Wait for server
        run: npx wait-on http://localhost:3000

      - name: Run E2E tests
        run: npx playwright test tests/e2e/regional-admin-prompt-workflow.spec.js

      - name: Upload screenshots
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-screenshots
          path: tests/screenshots/regional-workflow/
```

## Test Maintenance

### Adding New Tests

1. Add test to appropriate suite in `regional-admin-prompt-workflow.spec.js`
2. Update test count in this README
3. Add new test data to `setup-regional-workflow-tests.js` if needed
4. Document expected screenshot in Screenshots section

### Updating Test Data

Edit `setup-regional-workflow-tests.js`:
```javascript
const TEST_DATA = {
  regions: [...],
  admins: [...],
  courses: [...]
};
```

Run setup again:
```bash
node tests/e2e/setup-regional-workflow-tests.js
```

## Contributing

### Test Conventions

1. **Test Names**: Use descriptive names starting with "should"
   ```javascript
   test('should display region information in request cards', async ({ page }) => {
     // ...
   });
   ```

2. **Screenshots**: Take screenshots at key verification points
   ```javascript
   await page.screenshot({
     path: path.join(SCREENSHOT_DIR, 'descriptive-name.png'),
     fullPage: true
   });
   ```

3. **Assertions**: Use clear assertion messages
   ```javascript
   expect(hasRegionInfo).toBeTruthy(); // Good
   expect(hasRegionInfo).toBe(true);   // Better with message
   ```

4. **Retries**: Handle flaky elements with retries
   ```javascript
   await page.waitForSelector('.element', { timeout: 5000 });
   await page.waitForLoadState('networkidle');
   ```

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Test Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Tests](https://playwright.dev/docs/debug)
- [CI/CD Integration](https://playwright.dev/docs/ci)

## Support

For issues or questions:
1. Check Troubleshooting section above
2. Review test output and screenshots
3. Enable debug mode: `--debug --headed`
4. Check server logs for backend errors
5. Verify database state manually

---

**Last Updated**: 2025-11-04
**Test Suite Version**: 1.0.0
**Total Tests**: 27
