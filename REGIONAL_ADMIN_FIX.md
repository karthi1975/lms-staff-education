# ✅ Regional Admin Prompt Access - FIXED

**Date**: 2025-11-05 04:00 UTC
**Status**: ✅ DEPLOYED TO GCP
**URL**: http://34.162.168.124:3000
**Commit**: a1e1aa5

---

## 🐛 Issue: "Error loading prompts: Failed to load prompts"

### Problem Description
Regional Admins (like test1@school.edu) were getting error when trying to view prompts:
- Could login successfully ✅
- Could see "View Prompts" navigation ✅
- Could select region (Tanzania) ✅
- Could select course ✅
- **BUT**: Got error "Error loading prompts: Failed to load prompts" ❌

### Root Cause
The `/api/prompt-approval/courses/:courseId/default-prompt` endpoint was missing the `attachAdminRegions` middleware in its chain.

**Middleware Chain Issue:**
```javascript
// BEFORE (Broken):
router.get('/prompt-approval/courses/:courseId/default-prompt',
  authMiddleware.authenticateToken,  // ✅ Sets req.user
  // ❌ MISSING: regionAccessMiddleware.attachAdminRegions
  regionAccessMiddleware.verifyCourseAccess((req) => req.params.courseId),
  async (req, res) => { ... }
);
```

**Why This Broke:**
1. `authenticateToken` middleware sets `req.user.id`, `req.user.role_id`, `req.user.email`
2. `verifyCourseAccess` middleware checks if `req.user.regions` includes the course's region_id (line 153)
3. **BUT**: `req.user.regions` is only populated by `attachAdminRegions` middleware!
4. Since `attachAdminRegions` was missing, `req.user.regions` was undefined
5. Access check at line 153 failed: `if (!req.user.regions || !req.user.regions.includes(course.region_id))`

---

## ✅ Solution

Added `attachAdminRegions` middleware before `verifyCourseAccess` in two routes:

### File: `routes/prompt-approval.routes.js`

**Route 1: GET default prompts**
```javascript
// AFTER (Fixed):
router.get('/prompt-approval/courses/:courseId/default-prompt',
  authMiddleware.authenticateToken,
  regionAccessMiddleware.attachAdminRegions,  // ✅ ADDED THIS
  regionAccessMiddleware.verifyCourseAccess((req) => req.params.courseId),
  async (req, res) => { ... }
);
```

**Route 2: POST create prompt change request**
```javascript
// AFTER (Fixed):
router.post('/prompt-approval/requests',
  authMiddleware.authenticateToken,
  regionAccessMiddleware.attachAdminRegions,  // ✅ ADDED THIS
  regionAccessMiddleware.verifyCourseAccess((req) => req.body.courseId),
  async (req, res) => { ... }
);
```

---

## 📊 Test Users

### Super Admin
- **Email**: admin@school.edu
- **Password**: Admin123!
- **Role ID**: 1 (Super Admin)
- **Regions**: All (region_id = 5 special access)
- **Expected**: Can see "All Regions" dropdown option

### Regional Admin (Tanzania)
- **Email**: test1@school.edu
- **Password**: Admin123!
- **Role ID**: 2 (Regional Admin)
- **Regions**: Tanzania (region_id = 1)
- **Expected**: Can ONLY see "Tanzania" in dropdown (no "All Regions")

### Alternative Regional Admin (Tanzania)
- **Email**: test.regional@school.edu
- **Password**: Admin123!
- **Role ID**: 2 (Regional Admin)
- **Regions**: Tanzania (region_id = 1)

---

## 🧪 Manual Testing Steps

### Test 1: Regional Admin Can Load Prompts

1. **Login** as Regional Admin:
   ```
   URL: http://34.162.168.124:3000/admin/login.html
   Email: test1@school.edu
   Password: Admin123!
   ```

2. **Navigate** to View Prompts:
   - Click "View Prompts" in left sidebar

3. **Verify Region Filter (RBAC)**:
   ```
   ✅ Should see: "Your Regions: Tanzania"
   ✅ Region dropdown should show ONLY: "Tanzania"
   ❌ Should NOT see: "All Regions" option
   ```

4. **Select Course**:
   - Region: Tanzania (should be auto-selected)
   - Course: "Business Studies Orientation (BS-ORIENT-001) [Tanzania]"

5. **Verify Prompts Load**:
   ```
   ✅ Should see two prompt cards:
      - Regular Mode (Version 3)
      - Socratic Mode (Version 10)

   ✅ Should see prompt text (not truncated)
   ✅ Should see "Last Updated" info
   ✅ Should see "Updated By: admin@school.edu"

   ❌ Should NOT see: "Error loading prompts"
   ❌ Should NOT see: "No Prompts Found"
   ```

### Test 2: Super Admin Can See All Regions

1. **Login** as Super Admin:
   ```
   URL: http://34.162.168.124:3000/admin/login.html
   Email: admin@school.edu
   Password: Admin123!
   ```

2. **Navigate** to View Prompts

3. **Verify Region Filter (RBAC)**:
   ```
   ✅ Should see: "All Regions" option in dropdown
   ✅ Should see all regions: Burundi, Kenya, Rwanda, Tanzania, Test Region
   ```

4. **Test Filtering**:
   - Select "Tanzania" → Only Tanzania courses show
   - Select "All Regions" → All courses show

---

## 🔍 Database Verification

### Check Regional Admin User
```sql
SELECT id, name, email, role_id
FROM admin_users
WHERE email = 'test1@school.edu';

-- Expected:
-- id: 12
-- name: test1
-- email: test1@school.edu
-- role_id: 2 (Regional Admin)
```

### Check Region Assignment
```sql
SELECT ar.admin_user_id, au.email, ar.region_id, r.name as region_name
FROM admin_regions ar
JOIN admin_users au ON ar.admin_user_id = au.id
JOIN regions r ON ar.region_id = r.id
WHERE au.email = 'test1@school.edu';

-- Expected:
-- admin_user_id: 12
-- email: test1@school.edu
-- region_id: 1
-- region_name: Tanzania
```

### Check Course Region
```sql
SELECT id, title, code, region_id
FROM courses
WHERE id = 8;  -- Business Studies Orientation

-- Expected:
-- id: 8
-- title: Business Studies Orientation
-- code: BS-ORIENT-001
-- region_id: 1 (Tanzania)
```

### Check Prompts Exist
```sql
SELECT course_id, regular_version, socratic_version,
       last_approved_at, last_approved_by
FROM course_bot_configs
WHERE course_id = 8;

-- Expected:
-- course_id: 8
-- regular_version: 3
-- socratic_version: 10
-- last_approved_at: 2025-11-04 21:21:52
-- last_approved_by: 1
```

---

## 🚀 Deployment Log

```bash
# Step 1: Fix routes
git add routes/prompt-approval.routes.js

# Step 2: Commit
git commit -m "fix: Add attachAdminRegions middleware to prompt routes"

# Step 3: Push to GitHub
git push origin feature/multi-region-rbac

# Step 4: Deploy to GCP
gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant" \
  --command "cd /home/karthi/teachers_training && \
             git pull origin feature/multi-region-rbac && \
             docker-compose restart app"

# Step 5: Verify containers
docker ps
# ✅ teachers_training_app_1 - Running (restarted 2 min ago)
# ✅ teachers_training_postgres_1 - Healthy
# ✅ teachers_training_neo4j_1 - Running
# ✅ chromadb - Running
```

---

## 📝 Related Previous Fixes

This fix completes the Regional Admin RBAC implementation:

1. **Fix #1** (Commit: c087983): API returns both Regular and Socratic prompts
2. **Fix #2** (Commit: 732a234): Prompt Approvals localStorage keys fixed
3. **Fix #3** (Commit: 8e4e892): Cascading Region → Course dropdown
4. **Fix #4** (Commit: fd3a02e): Show complete prompts (no truncation)
5. **Fix #5** (Commit: ffecbcc): Details modal instead of 404 page
6. **Fix #6** (Commit: 4f085fe): RBAC region filtering in both pages
7. **Fix #7** (Commit: abc1457): Split navigation (Prompt Management vs Administration)
8. **Fix #8** (Commit: a1e1aa5): **THIS FIX** - Add attachAdminRegions middleware ✅

---

## ✅ Success Criteria

- [x] Regional Admin can login
- [x] Regional Admin can see "View Prompts" navigation
- [x] Regional Admin can ONLY see assigned regions (no "All Regions")
- [x] Regional Admin can select region
- [x] Regional Admin can select courses in that region
- [x] Regional Admin can load prompts without errors
- [x] Both Regular and Socratic prompts display
- [x] Prompts show version numbers, timestamps, and updater name
- [x] Super Admin can still see "All Regions" option (RBAC preserved)

---

## 🎯 Technical Details

### Middleware Chain Flow (Fixed)

```
HTTP Request → GET /api/prompt-approval/courses/:courseId/default-prompt
     ↓
1. authMiddleware.authenticateToken
   ├─ Validates JWT token
   ├─ Loads user from database
   └─ Sets: req.user = { id, email, role_id, ... }
     ↓
2. regionAccessMiddleware.attachAdminRegions  ← ADDED THIS
   ├─ If Super Admin: Skip (sets req.user.regions = [])
   ├─ If Regional Admin: Load from admin_regions table
   └─ Sets: req.user.regions = [1] (Tanzania)
     ↓
3. regionAccessMiddleware.verifyCourseAccess
   ├─ Load course from database
   ├─ Check: course.region_id (1) in req.user.regions ([1])
   ├─ ✅ Access granted!
   └─ Continue to handler
     ↓
4. Route Handler
   ├─ Call promptApprovalService.getAllDefaultPrompts(courseId)
   ├─ Return { success: true, prompts: { regular, socratic } }
   └─ HTTP 200 with prompts
```

### Before Fix (Broken)
```
req.user = { id: 12, role_id: 2, email: "test1@school.edu" }
req.user.regions = undefined  ← Missing!

verifyCourseAccess check:
if (!req.user.regions || !req.user.regions.includes(course.region_id)) {
  // undefined fails check → 403 Forbidden
}
```

### After Fix (Working)
```
req.user = { id: 12, role_id: 2, email: "test1@school.edu" }
req.user.regions = [1]  ← Populated by attachAdminRegions!

verifyCourseAccess check:
if (!req.user.regions || !req.user.regions.includes(course.region_id)) {
  // [1].includes(1) → true ✅ → Access granted
}
```

---

*Fix deployed and verified on GCP*
*Branch: feature/multi-region-rbac*
*All Regional Admin RBAC features now working!*
