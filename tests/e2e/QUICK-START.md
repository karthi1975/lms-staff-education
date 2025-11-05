# Quick Start Guide: Regional Admin Workflow E2E Tests

## 🚀 Run Tests in 3 Steps

### Step 1: Setup Test Data
```bash
npm run test:setup:regional
```

Expected output:
```
✓ TEST DATA SETUP COMPLETE
✓ Active regions: 2
✓ Active admins: 3
✓ Active courses: 3
```

### Step 2: Start Server
```bash
# Terminal 1
npm start
```

Wait for: `Server running on port 3000`

### Step 3: Run Tests
```bash
# Terminal 2 - Run all tests
npm run test:e2e:regional

# OR with browser visible
npm run test:e2e:regional:headed

# OR debug mode
npm run test:e2e:regional:debug
```

---

## ✅ Verify Setup

```bash
node tests/e2e/verify-test-setup.js
```

Should show:
- ✓ Regions: 2
- ✓ Test Admin Users: 3
- ✓ Admin-Region Assignments: 2
- ✓ Test Courses: 3
- ✓ Bot Configurations: 3
- ✓ Required Tables: 5

---

## 📊 Test Suite Overview

| Suite | Tests | Focus |
|-------|-------|-------|
| 1. View Prompts | 6 | Regional admin UI access |
| 2. Create Prompt | 7 | Form functionality & validation |
| 3. Approval Dashboard | 6 | Super admin workflow |
| 4. Access Control | 4 | Cross-region security (403s) |
| 5. Integration | 4 | Backend-UI data flow |
| **TOTAL** | **27** | **Full workflow coverage** |

---

## 🔑 Test Users

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@school.edu | Admin123! |
| Regional Admin (TZ) | regional.tz@school.edu | Regional123! |
| Regional Admin (KE) | regional.ke@school.edu | Regional123! |

---

## 📸 Screenshots Location

```
tests/screenshots/regional-workflow/
├── login-success-*.png
├── course-dropdown-populated.png
├── validation-error-*.png
├── cross-region-403-error.png
└── FAILED-*.png (if any test fails)
```

---

## 🐛 Troubleshooting

### Server Not Running
```bash
# Error: net::ERR_CONNECTION_REFUSED
npm start
```

### Database Connection Failed
```bash
# Error: role "teachers_user" does not exist
# Check if PostgreSQL is running in Docker
docker-compose ps
docker-compose up -d postgres
```

### Test Users Don't Exist
```bash
# Error: Invalid credentials
npm run test:setup:regional
```

### Tests Timeout
```bash
# Increase timeout in playwright.config.js
timeout: 120000
```

---

## 📝 Quick Commands Reference

```bash
# Full workflow
npm run test:setup:regional        # 1. Setup test data
npm start                            # 2. Start server (Terminal 1)
npm run test:e2e:regional           # 3. Run tests (Terminal 2)

# Individual steps
node tests/e2e/verify-test-setup.js  # Verify setup
npx playwright test --headed         # Run with browser visible
npx playwright test --debug          # Interactive debug
npx playwright show-report           # View HTML report

# Cleanup
docker-compose down                  # Stop all services
```

---

## 📚 Full Documentation

For detailed information, see:
- `README-REGIONAL-WORKFLOW-TESTS.md` - Complete guide
- `TEST-EXECUTION-SUMMARY.md` - Test coverage report
- `regional-admin-prompt-workflow.spec.js` - Test source code

---

**Need Help?**
1. Check test output for specific error
2. Review screenshots in `tests/screenshots/regional-workflow/`
3. Enable debug mode: `npm run test:e2e:regional:debug`
4. Check server logs for backend errors
