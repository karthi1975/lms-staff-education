# Regional Admin Prompt Workflow - Impact Analysis & Implementation Plan

**Date**: 2025-11-04
**Feature**: Regional Admin Prompt Creation & Approval Workflow
**Complexity**: High
**Estimated Timeline**: 2-3 hours (with parallel agent execution)

---

## Executive Summary

Implement a complete workflow where Regional Admins can:
1. View DEFAULT prompts for courses in their assigned region(s)
2. Create NEW custom prompts for specific courses
3. Submit for Super Admin approval
4. Once approved → New prompt becomes active for that course

**Key Principle**: Regional Admins propose, Super Admins approve. Ensures quality control while enabling regional customization.

---

## Impact Analysis

### 1. Database Impact ✅ (No Changes Required)

**Existing Tables (Already Support This)**:
- `admin_regions` - Regional admin assignments ✓
- `courses` - Has region_id ✓
- `course_bot_configs` - Active prompts ✓
- `prompt_change_requests` - Approval workflow ✓
- `prompt_approval_history` - Audit trail ✓

**Verification**:
```sql
-- Courses already have region_id
SELECT c.id, c.title, c.region_id, r.name as region_name
FROM courses c
JOIN regions r ON c.region_id = r.id;

-- Admins already have region assignments
SELECT au.email, r.name as region_name
FROM admin_users au
JOIN admin_regions ar ON au.id = ar.admin_user_id
JOIN regions r ON ar.region_id = r.id;
```

**Conclusion**: ✅ **NO database migration needed**. Existing schema fully supports regional filtering.

---

### 2. Service Layer Impact 🟡 (Modifications Required)

**File**: `services/prompt-approval.service.js`

**New Methods Needed**:
```javascript
// 1. Get admin's assigned regions
async getAdminRegions(adminId)

// 2. Check if admin can access a course
async canAdminAccessCourse(adminId, courseId)

// 3. Get courses accessible to admin (filtered by region)
async getAccessibleCourses(adminId)

// 4. Get default prompt for a course
async getDefaultPrompt(courseId, mode)
```

**Modified Methods**:
```javascript
// Update to filter by region for non-Super Admins
async getPendingApprovals(adminId, filters = {})
  - If Super Admin (role_id=1): See all
  - If Regional Admin: Filter by assigned regions only

// Update to ensure regional admin can only create requests for their region's courses
async createDraftRequest({...})
  - Add region access validation
  - Verify course belongs to admin's region

// Update to filter by admin's regions
async getMyRequests(adminId, filters = {})
  - Filter results by accessible regions
```

**Impact Level**: 🟡 Medium - Add 4 new methods, modify 3 existing methods

---

### 3. Middleware Impact 🟢 (New File)

**File**: `middleware/region-access.middleware.js` (NEW)

**Purpose**: Attach admin's regions and validate access

```javascript
// 1. Attach admin's regions to req.user
async function attachAdminRegions(req, res, next)
  - Fetch admin's assigned regions
  - Add to req.user.regions = [...]
  - Add req.user.isSuperAdmin = (role_id === 1)

// 2. Verify course access
async function verifyCourseAccess(courseId)
  - Return middleware function
  - Check if admin can access courseId
  - Throw 403 if not allowed

// 3. Get admin region filter
function getRegionFilter(req)
  - If Super Admin: null (see all)
  - If Regional Admin: array of region IDs
```

**Impact Level**: 🟢 Low - New file, no existing code changes

---

### 4. API Routes Impact 🟡 (Modifications Required)

**File**: `routes/prompt-approval.routes.js`

**New Routes**:
```javascript
// Get default prompt for a course
GET /api/prompt-approval/courses/:courseId/default-prompt?mode=regular|socratic

// Get courses accessible to current admin
GET /api/prompt-approval/accessible-courses

// Get admin's assigned regions
GET /api/prompt-approval/my-regions
```

**Modified Routes**:
```javascript
// Add region filtering middleware
GET /api/prompt-approval/pending
  - Use attachAdminRegions middleware
  - Filter by req.user.regions

// Add course access validation
POST /api/prompt-approval/requests
  - Use verifyCourseAccess middleware
  - Validate admin can access the course

// Already working (no changes)
POST /api/prompt-approval/requests/:id/submit
POST /api/prompt-approval/requests/:id/approve (Super Admin only)
POST /api/prompt-approval/requests/:id/reject (Super Admin only)
```

**Impact Level**: 🟡 Medium - Add 3 new routes, modify 2 existing routes

---

### 5. Frontend Impact 🔴 (Major Changes)

**New Pages**:

#### A. Regional Admin Prompt Viewer
**File**: `public/admin/prompt-viewer.html` (NEW)

**Features**:
- Show admin's assigned regions in header
- Display accessible courses (filtered by region)
- Course selector dropdown
- Side-by-side view: Regular Mode | Socratic Mode
- Show current active prompt (read-only)
- Show current version number
- Show last updated date/admin
- Button: "Create Custom Prompt" → Opens editor

**Mockup**:
```
┌────────────────────────────────────────────────────────┐
│ 📖 Prompt Viewer - Regional Admin                     │
│ Your Regions: Tanzania, Kenya                          │
├────────────────────────────────────────────────────────┤
│ Course: [Business Studies Orientation ▼]              │
│                                                         │
│ ┌─ Regular Mode (Active) ───┐ ┌─ Socratic Mode ─────┐│
│ │ Version 3                  │ │ Version 10          ││
│ │ Last Updated: 2025-11-04   │ │ Last Updated: ...   ││
│ │ By: admin@school.edu       │ │ By: ...             ││
│ │                            │ │                     ││
│ │ [Prompt text displayed]    │ │ [Prompt text...]    ││
│ │                            │ │                     ││
│ │                            │ │                     ││
│ └────────────────────────────┘ └─────────────────────┘│
│                                                         │
│ [📝 Create Custom Prompt for This Course]             │
└────────────────────────────────────────────────────────┘
```

#### B. Regional Admin Prompt Editor
**File**: `public/admin/prompt-editor.html` (NEW)

**Features**:
- Select course (filtered by admin's regions)
- Select mode (Regular / Socratic)
- Show CURRENT prompt for reference (read-only box)
- Editor for NEW prompt (textarea with validation)
- Character count (50-5000)
- Change reason (required, min 20 chars)
- Change description (optional)
- Preview pane
- Validation warnings (Socratic-specific, Regular-specific)
- Buttons:
  - "Save as Draft" (status: draft)
  - "Submit for Approval" (status: pending_approval)
  - "Cancel"

**Mockup**:
```
┌────────────────────────────────────────────────────────┐
│ ✏️ Create Custom Prompt - Regional Admin               │
├────────────────────────────────────────────────────────┤
│ Course: [Business Studies Orientation ▼]              │
│ Mode: [○ Regular  ● Socratic]                         │
│                                                         │
│ ┌─ Current Active Prompt (Reference) ───────────────┐ │
│ │ Version 10 (Read-only)                            │ │
│ │ You are a Socratic questioner...                  │ │
│ └───────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─ New Custom Prompt ────────────────────────────────┐│
│ │ [Rich text editor with markdown support]          ││
│ │                                                    ││
│ │ You are a Socratic teaching assistant...          ││
│ │                                                    ││
│ └────────────────────────────────────────────────────┘│
│ Character Count: 1850 / 5000 ✓                        │
│                                                         │
│ Change Reason: (Required)*                             │
│ ┌──────────────────────────────────────────────────┐   │
│ │ Tanzania teachers need more culturally relevant   │   │
│ │ examples for entrepreneurship...                  │   │
│ └──────────────────────────────────────────────────┘   │
│                                                         │
│ Change Description: (Optional)                         │
│ ┌──────────────────────────────────────────────────┐   │
│ │ - Added local business examples                   │   │
│ │ - Changed question style to fit cultural context │   │
│ └──────────────────────────────────────────────────┘   │
│                                                         │
│ [💾 Save as Draft] [📤 Submit for Approval] [❌ Cancel]│
└────────────────────────────────────────────────────────┘
```

#### C. Update Existing Super Admin Dashboard
**File**: `public/admin/prompt-approvals.html` (MODIFY)

**Changes**:
- Add "Region" column to pending request cards
- Show which region the request is from
- Add region filter dropdown
- No functional changes (already works)

**Impact Level**: 🔴 High - 2 new pages, 1 modified page

---

### 6. Navigation Impact 🟢 (Minor)

**Files to Update**:
- All admin pages with sidebar navigation

**Changes**:
```html
<!-- Add to nav menu -->
<a href="prompt-viewer.html" class="nav-item">
  <span class="nav-icon">📖</span>
  <span>View Prompts</span>
</a>
```

**Impact Level**: 🟢 Low - Add 1 nav link to ~10 pages

---

### 7. Security Impact ✅ (Already Secure)

**Existing Security Measures**:
- ✅ JWT authentication on all routes
- ✅ RBAC role checks (Super Admin vs Admin)
- ✅ CSRF protection via tokens
- ✅ XSS protection (DOMPurify in UI)
- ✅ SQL injection prevention (parameterized queries)

**New Security Measures Needed**:
- ✅ Regional access control (new middleware)
- ✅ Course ownership validation
- ✅ Audit trail logging (already in place)

**Impact Level**: ✅ No new vulnerabilities introduced

---

### 8. Testing Impact 🔴 (Major)

**New Tests Required**:

#### Unit Tests
- `tests/unit/prompt-approval.service.test.js` - Add 10+ new tests
  - Test getAdminRegions()
  - Test canAdminAccessCourse()
  - Test regional filtering in getPendingApprovals()

#### Integration Tests
- `tests/integration/regional-prompt-workflow.test.js` (NEW)
  - Test regional admin creates draft
  - Test regional admin submits for approval
  - Test cross-region access denied
  - Test Super Admin sees all regions

#### E2E Tests (Playwright)
- `tests/e2e/regional-admin-prompt-workflow.spec.js` (NEW)
  - Test complete workflow:
    1. Regional admin logs in
    2. Views default prompts
    3. Creates custom prompt
    4. Submits for approval
    5. Super admin reviews and approves
    6. Prompt becomes active
  - Test cross-agent verification:
    - Backend creates data → UI displays correctly
    - UI submits form → Backend processes correctly

**Impact Level**: 🔴 High - 1 new test file, 10+ new tests

---

## Implementation Plan

### Phase 1: Backend Agent (Parallel Execution)

**Agent Type**: `general-purpose`
**Focus**: Service layer + Routes + Middleware
**Estimated Time**: 45-60 minutes

**Tasks**:
1. Create `middleware/region-access.middleware.js`
   - attachAdminRegions()
   - verifyCourseAccess()
   - getRegionFilter()

2. Update `services/prompt-approval.service.js`
   - Add getAdminRegions()
   - Add canAdminAccessCourse()
   - Add getAccessibleCourses()
   - Add getDefaultPrompt()
   - Modify getPendingApprovals() with region filtering
   - Modify createDraftRequest() with region validation

3. Update `routes/prompt-approval.routes.js`
   - Add GET /api/prompt-approval/courses/:courseId/default-prompt
   - Add GET /api/prompt-approval/accessible-courses
   - Add GET /api/prompt-approval/my-regions
   - Apply region middleware to existing routes

4. Write unit tests for new functionality

**Deliverables**:
- middleware/region-access.middleware.js
- Updated services/prompt-approval.service.js
- Updated routes/prompt-approval.routes.js
- tests/unit/prompt-approval.service.test.js (updated)

---

### Phase 2: UI Agent (Parallel Execution)

**Agent Type**: `general-purpose`
**Focus**: Frontend pages + Navigation
**Estimated Time**: 45-60 minutes

**Tasks**:
1. Create `public/admin/prompt-viewer.html`
   - Show admin's regions
   - Course selector (filtered)
   - Side-by-side prompt display
   - "Create Custom Prompt" button

2. Create `public/admin/prompt-editor.html`
   - Course selector
   - Mode selector
   - Current prompt reference
   - New prompt editor
   - Change reason/description
   - Save/Submit buttons
   - Validation

3. Update `public/admin/prompt-approvals.html`
   - Add region column
   - Add region filter

4. Update navigation in all admin pages
   - Add "View Prompts" link

**Deliverables**:
- public/admin/prompt-viewer.html
- public/admin/prompt-editor.html
- Updated public/admin/prompt-approvals.html
- Updated navigation in ~10 admin pages

---

### Phase 3: Cross-Verification Agent (Sequential)

**Agent Type**: `general-purpose`
**Focus**: Playwright E2E tests
**Estimated Time**: 30-45 minutes

**Tasks**:
1. Create `tests/e2e/regional-admin-prompt-workflow.spec.js`
   - Test: Regional admin views prompts
   - Test: Regional admin creates custom prompt
   - Test: Regional admin submits for approval
   - Test: Super admin approves
   - Test: Prompt becomes active
   - Test: Cross-region access denied

2. Test backend-UI integration
   - Backend creates test data → UI displays correctly
   - UI submits forms → Backend processes correctly
   - Verify audit trail logging

**Deliverables**:
- tests/e2e/regional-admin-prompt-workflow.spec.js
- Test report with screenshots

---

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   REGIONAL ADMIN WORKFLOW                │
└─────────────────────────────────────────────────────────┘

1. Regional Admin logs in
   ↓
2. Views "Prompt Viewer" page
   - Sees only courses in assigned region(s)
   - Views current DEFAULT prompts (Regular + Socratic)
   ↓
3. Clicks "Create Custom Prompt"
   ↓
4. Opens "Prompt Editor"
   - Selects course (filtered by region)
   - Selects mode (Regular or Socratic)
   - Sees current prompt as reference
   - Writes NEW custom prompt
   - Provides change reason (required)
   - Provides description (optional)
   ↓
5. Saves as DRAFT (status: draft)
   OR
   Submits for Approval (status: pending_approval)
   ↓
6. If submitted → Goes to Super Admin Dashboard
   ↓
7. Super Admin reviews:
   - See course name + region
   - See current prompt vs new prompt
   - See change reason
   - Approve or Reject
   ↓
8. If APPROVED:
   - New prompt becomes ACTIVE for that course
   - Version number increments
   - Audit trail logged
   - Regional admin notified
   ↓
9. If REJECTED:
   - Regional admin receives feedback
   - Can revise and resubmit
```

---

## Data Flow

```
Frontend (prompt-editor.html)
  │
  │ POST /api/prompt-approval/requests
  │ {
  │   courseId: 8,
  │   mode: "socratic",
  │   newPrompt: "You are...",
  │   changeReason: "Tanzania teachers need...",
  │   changeDescription: "Added local examples"
  │ }
  ↓
Middleware (region-access.middleware.js)
  │
  │ attachAdminRegions(req, res, next)
  │ → Fetches admin's regions
  │ → Adds to req.user.regions = [1, 2]
  │
  │ verifyCourseAccess(courseId)
  │ → Checks if course.region_id IN req.user.regions
  │ → Throws 403 if not allowed
  ↓
Service (prompt-approval.service.js)
  │
  │ canAdminAccessCourse(adminId, courseId)
  │ → Query: JOIN courses ON region_id
  │ → Return true/false
  │
  │ createDraftRequest({...})
  │ → Validate access
  │ → Insert into prompt_change_requests
  │ → Return request object
  ↓
Database (PostgreSQL)
  │
  │ INSERT INTO prompt_change_requests
  │ (course_id, mode, new_prompt, change_reason,
  │  status, requested_by)
  │ VALUES (8, 'socratic', '...', '...', 'draft', 5)
  │
  │ INSERT INTO prompt_approval_history
  │ (request_id, action, actor_id, actor_role)
  │ VALUES (123, 'created', 5, 'regional_admin')
  ↓
Response
  {
    success: true,
    request: { id: 123, status: 'draft', ... }
  }
```

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Regional admin creates poor quality prompt | High | Super Admin approval required before activation |
| Cross-region access | High | Middleware validation + service-level checks |
| Database performance with region joins | Medium | Indexed columns (region_id, admin_user_id) |
| UI/Backend integration bugs | High | Playwright cross-verification tests |
| Conflicting prompt versions | Medium | Atomic transactions + version locking |

---

## Success Metrics

**After 1 Week**:
- ✅ Regional admins can view prompts for their region's courses
- ✅ Regional admins can create custom prompts
- ✅ Super Admin approval workflow works end-to-end
- ✅ Cross-region access is blocked (tested)
- ✅ All Playwright tests passing

**After 1 Month**:
- 📊 Number of custom prompts created by region
- 📊 Approval rate (% approved vs rejected)
- 📊 Time to approval (median, p95)
- 📊 Regional admin satisfaction survey

---

## Agent Execution Plan

### Step 1: Launch Backend Agent
```bash
Task: Implement regional admin prompt approval backend
Agent: general-purpose
Prompt: "Implement complete backend for regional admin prompt workflow:
1. Create middleware/region-access.middleware.js
2. Update services/prompt-approval.service.js
3. Update routes/prompt-approval.routes.js
4. Write unit tests
Ensure regional admins can only access courses in their assigned regions."
```

### Step 2: Launch UI Agent (Parallel)
```bash
Task: Implement regional admin prompt approval UI
Agent: general-purpose
Prompt: "Implement complete frontend for regional admin prompt workflow:
1. Create public/admin/prompt-viewer.html
2. Create public/admin/prompt-editor.html
3. Update public/admin/prompt-approvals.html
4. Update navigation in all admin pages
Use Material Design 3 theme, ensure XSS protection."
```

### Step 3: Launch Playwright Agent (Sequential)
```bash
Task: Create Playwright tests for cross-verification
Agent: general-purpose
Prompt: "Create comprehensive Playwright tests in tests/e2e/regional-admin-prompt-workflow.spec.js:
1. Test regional admin views prompts
2. Test regional admin creates custom prompt
3. Test Super Admin approves
4. Test cross-region access denied
5. Verify backend-UI integration
Use BASE_URL=http://localhost:3000"
```

---

## Ready for Implementation

All analysis complete. Ready to launch agents in parallel.

**Next Steps**:
1. Launch Backend Agent
2. Launch UI Agent (parallel)
3. Wait for both to complete
4. Launch Playwright Agent
5. Run tests
6. Deploy to GCP

---

*Document Created: 2025-11-04*
*Status: READY FOR IMPLEMENTATION*
