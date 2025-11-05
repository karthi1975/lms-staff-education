# PHASE 1: Read-Only Prompt Viewer
## Implementation Plan - APPROVED

**Status**: ✅ APPROVED FOR IMPLEMENTATION
**Timeline**: 3-4 days
**Pilot Region**: Tanzania
**Date Approved**: 2025-11-04

---

## Decisions from User Approval

### ✅ Confirmed Decisions:

1. **Approval Authority**: Regional admins can activate prompts without superadmin review ✅
2. **Pilot Testing**: Test Phase 1 with Tanzania region only first ✅
3. **Notifications**: In-app notifications only (no email) ✅
4. **A/B Testing**: Deferred to Phase 6 ✅
5. **Training**: Written guides only (no videos) ✅

### 🔴 CRITICAL RBAC CLARIFICATION:

**Corrected Permission Model:**
- **Admin (Superadmin)**: View, Edit, Approve, Activate
- **Regional Admin**: View, Submit, Edit (NO APPROVAL RIGHTS)
- **Content Creator**: View, Submit, Edit (NO APPROVAL RIGHTS)
- **Viewer**: View only

**Key Change**: Regional admins CANNOT approve - only submit and edit their own drafts.

---

## Phase 1 Objectives

Build a read-only prompt viewer that allows:
1. View current Regular & Socratic prompts
2. See version numbers and metadata
3. View version history
4. Filter by course (Tanzania region only for pilot)
5. Mobile-responsive design

**NO editing, approving, or activating in Phase 1** - read-only only.

---

## Updated RBAC Matrix for Phase 1

| Role | View Current Prompts | View History | Filter by Region | Access Tanzania Pilot |
|------|----------------------|--------------|------------------|----------------------|
| Superadmin | All courses | All versions | All regions | ✅ |
| Regional Admin (Tanzania) | Tanzania courses | Tanzania versions | Tanzania only | ✅ |
| Regional Admin (Other) | Own regions | Own versions | Own regions | ❌ (Not in pilot) |
| Content Creator (Tanzania) | Tanzania courses | Tanzania versions | Tanzania only | ✅ |
| Viewer (Tanzania) | Tanzania courses | Tanzania versions | Tanzania only | ✅ |

---

## Components to Build

### 1. Prompt Viewer UI (`/admin/prompt-viewer.html`)

**File Location**: `/public/admin/prompt-viewer.html`

**Features:**
- [ ] Header with course selector (Tanzania courses only)
- [ ] Side-by-side view: Regular Mode (left) | Socratic Mode (right)
- [ ] Metadata display (version, last updated, approved by)
- [ ] Syntax highlighting for prompt text
- [ ] Mobile-responsive layout
- [ ] Navigation breadcrumb
- [ ] Link to version history

**UI Mockup** (Final Design):
```
┌────────────────────────────────────────────────────────────┐
│ ← Dashboard  |  📖 Prompt Viewer                           │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ Course: [Business Studies Orientation ▼]                  │
│ Region: Tanzania (Pilot)                                   │
│                                                             │
│ ┌─────────────────────────┬─────────────────────────────┐ │
│ │ 📘 REGULAR MODE (v3)    │ 🤔 SOCRATIC MODE (v10)     │ │
│ ├─────────────────────────┼─────────────────────────────┤ │
│ │ [Prompt text with       │ [Prompt text with          │ │
│ │  syntax highlighting]   │  syntax highlighting]      │ │
│ │                         │                            │ │
│ │ You are an educational  │ You are a Socratic         │ │
│ │ assistant using Chain-  │ questioner. Your ONLY      │ │
│ │ of-Thought reasoning... │ output format is...        │ │
│ │                         │                            │ │
│ │ ## OUTPUT FORMAT:       │ 🚫 YOU ARE FORBIDDEN:      │ │
│ │ ### Direct Answer       │ - Give explanations        │ │
│ │ [1-2 sentences]         │ - Use words: "To"...       │ │
│ │ ...                     │ ...                        │ │
│ │                         │                            │ │
│ │ [Scrollable area]       │ [Scrollable area]          │ │
│ │                         │                            │ │
│ ├─────────────────────────┼─────────────────────────────┤ │
│ │ 📊 Metadata             │ 📊 Metadata                │ │
│ │ Version: 3              │ Version: 10                │ │
│ │ Updated: 2025-11-04     │ Updated: 2025-11-04        │ │
│ │ By: admin@school.edu    │ By: admin@school.edu       │ │
│ │ Status: ✅ Active       │ Status: ✅ Active          │ │
│ │ Length: 1737 chars      │ Length: 2574 chars         │ │
│ │                         │                            │ │
│ │ [📜 View History]       │ [📜 View History]          │ │
│ └─────────────────────────┴─────────────────────────────┘ │
│                                                             │
│ ℹ️ Read-only view | Phase 1 Pilot: Tanzania Region       │
└────────────────────────────────────────────────────────────┘
```

**Mobile View** (Stacked):
```
┌──────────────────────────┐
│ ← Back | 📖 Prompts      │
├──────────────────────────┤
│                          │
│ Course: Business Studies │
│ Region: Tanzania         │
│                          │
│ [Regular Mode ▼]         │
│                          │
│ ┌──────────────────────┐ │
│ │ 📘 REGULAR MODE (v3) │ │
│ ├──────────────────────┤ │
│ │ [Prompt text]        │ │
│ │ You are an...        │ │
│ │ [Scrollable]         │ │
│ │                      │ │
│ ├──────────────────────┤ │
│ │ Version: 3           │ │
│ │ Updated: 2025-11-04  │ │
│ │ Status: ✅ Active    │ │
│ │ [📜 History]         │ │
│ └──────────────────────┘ │
│                          │
│ [Switch to Socratic ▼]  │
└──────────────────────────┘
```

### 2. Version History View (`/admin/prompt-history.html`)

**File Location**: `/public/admin/prompt-history.html`

**Features:**
- [ ] Timeline of versions for selected mode
- [ ] Version number, date, updated by
- [ ] Change reason display
- [ ] "View" button to see full prompt
- [ ] Highlight current version
- [ ] Filter by date range

**UI Mockup**:
```
┌────────────────────────────────────────────────────────┐
│ ← Prompt Viewer  |  📜 Version History                 │
├────────────────────────────────────────────────────────┤
│                                                         │
│ Course: Business Studies Orientation                   │
│ Mode: Socratic Mode                                    │
│ Date Range: [Last 30 Days ▼]                          │
│                                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Timeline                                         │   │
│ │                                                  │   │
│ │ ● v10 (Current) ────────────────────────────── │   │
│ │   2025-11-04 21:23:22                          │   │
│ │   By: admin@school.edu                         │   │
│ │   ✅ Active                                     │   │
│ │   Change: Numbered questions only, STOP        │   │
│ │   [👁️ View Prompt]                             │   │
│ │   ↓                                             │   │
│ │                                                  │   │
│ │ ○ v9 ──────────────────────────────────────── │   │
│ │   2025-11-04 21:06:39                          │   │
│ │   By: admin@school.edu                         │   │
│ │   📦 Archived                                   │   │
│ │   Change: Zero explanation allowed             │   │
│ │   [👁️ View Prompt]                             │   │
│ │   ↓                                             │   │
│ │                                                  │   │
│ │ ○ v8 ──────────────────────────────────────── │   │
│ │   2025-11-04 20:57:38                          │   │
│ │   By: admin@school.edu                         │   │
│ │   📦 Archived                                   │   │
│ │   Change: True experiential discovery          │   │
│ │   [👁️ View Prompt]                             │   │
│ │   ↓                                             │   │
│ │                                                  │   │
│ │ [Show Older Versions]                           │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ ℹ️ Read-only view | Phase 1 Pilot: Tanzania           │
└────────────────────────────────────────────────────────┘
```

### 3. API Endpoints

**File Location**: `/routes/admin.routes.js` (add new routes)

#### 3.1 Get Current Prompts
```javascript
/**
 * GET /api/admin/courses/:courseId/prompts
 * Get current active prompts for a course
 *
 * RBAC: All authenticated users (filtered by region)
 * Pilot: Tanzania region courses only
 */
router.get('/courses/:courseId/prompts',
  authenticateToken,
  checkRegionAccess, // Middleware: Tanzania only for pilot
  async (req, res) => {
    // Implementation
  }
);

// Response:
{
  courseId: 8,
  courseName: "Business Studies Orientation",
  region: "Tanzania",
  regular: {
    prompt: "You are an educational assistant...",
    greeting: "Hello! I'm here to help...",
    helpText: "I provide direct answers...",
    version: 3,
    lastUpdated: "2025-11-04T21:23:22Z",
    updatedBy: {
      id: 1,
      name: "Admin User",
      email: "admin@school.edu"
    },
    status: "active",
    characterCount: 1737
  },
  socratic: {
    prompt: "You are a Socratic questioner...",
    greeting: "Hello! Let's discover...",
    helpText: "I guide you with questions...",
    version: 10,
    lastUpdated: "2025-11-04T21:23:33Z",
    updatedBy: {
      id: 1,
      name: "Admin User",
      email: "admin@school.edu"
    },
    status: "active",
    characterCount: 2574
  }
}
```

#### 3.2 Get Version History
```javascript
/**
 * GET /api/admin/courses/:courseId/prompts/:mode/history
 * Get version history for a specific mode
 *
 * RBAC: All authenticated users (filtered by region)
 * Pilot: Tanzania region courses only
 */
router.get('/courses/:courseId/prompts/:mode/history',
  authenticateToken,
  checkRegionAccess,
  async (req, res) => {
    // Implementation
  }
);

// Response:
{
  courseId: 8,
  mode: "socratic",
  versions: [
    {
      version: 10,
      prompt: "You are a Socratic questioner...",
      updatedAt: "2025-11-04T21:23:33Z",
      updatedBy: {
        id: 1,
        name: "Admin User",
        email: "admin@school.edu"
      },
      changeReason: "Numbered questions only, STOP instruction",
      status: "active",
      characterCount: 2574
    },
    {
      version: 9,
      prompt: "You are a Socratic...",
      updatedAt: "2025-11-04T21:06:39Z",
      updatedBy: {
        id: 1,
        name: "Admin User"
      },
      changeReason: "Zero explanation allowed",
      status: "archived",
      characterCount: 2403
    },
    // ... more versions
  ]
}
```

#### 3.3 Get Specific Version
```javascript
/**
 * GET /api/admin/courses/:courseId/prompts/:mode/versions/:version
 * Get full details of a specific prompt version
 *
 * RBAC: All authenticated users (filtered by region)
 * Pilot: Tanzania region courses only
 */
router.get('/courses/:courseId/prompts/:mode/versions/:version',
  authenticateToken,
  checkRegionAccess,
  async (req, res) => {
    // Implementation
  }
);

// Response:
{
  courseId: 8,
  mode: "socratic",
  version: 9,
  prompt: "You are a Socratic teaching assistant...",
  greeting: "Hello! Let's discover...",
  helpText: "I guide you with questions...",
  metadata: {
    createdAt: "2025-11-04T21:06:39Z",
    updatedBy: {
      id: 1,
      name: "Admin User",
      email: "admin@school.edu",
      role: "superadmin"
    },
    changeReason: "Zero explanation allowed",
    changeDescription: "Added explicit STOP instruction after questions",
    status: "archived",
    characterCount: 2403,
    replacedBy: 10
  }
}
```

#### 3.4 Get Pilot Courses (Tanzania Only)
```javascript
/**
 * GET /api/admin/courses/pilot
 * Get list of courses in Tanzania region for pilot
 *
 * RBAC: All authenticated users
 * Returns: Tanzania region courses only
 */
router.get('/courses/pilot',
  authenticateToken,
  async (req, res) => {
    // Implementation
  }
);

// Response:
{
  region: "Tanzania",
  courses: [
    {
      id: 8,
      code: "BS-ORIENT-001",
      title: "Business Studies Orientation",
      moduleCount: 1,
      hasPrompts: true,
      regularVersion: 3,
      socraticVersion: 10
    }
    // More Tanzania courses if they exist
  ]
}
```

### 4. Middleware Components

**File Location**: `/middleware/rbac.middleware.js` (add new middleware)

#### 4.1 Region Access Check (Tanzania Pilot)
```javascript
/**
 * Middleware: Check if user has access to Tanzania region
 * For Phase 1 pilot, only allow Tanzania region access
 */
async function checkRegionAccess(req, res, next) {
  try {
    const courseId = req.params.courseId;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Superadmins have access to all regions
    if (userRole === 'superadmin') {
      return next();
    }

    // Get course region
    const course = await pool.query(
      'SELECT region_id FROM courses WHERE id = $1',
      [courseId]
    );

    if (course.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const courseRegionId = course.rows[0].region_id;

    // Check if region is Tanzania (region_id = 1)
    const region = await pool.query(
      'SELECT name FROM regions WHERE id = $1',
      [courseRegionId]
    );

    if (region.rows.length === 0) {
      return res.status(404).json({ error: 'Region not found' });
    }

    const regionName = region.rows[0].name;

    // PILOT RESTRICTION: Only Tanzania allowed
    if (regionName !== 'Tanzania') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Phase 1 pilot is limited to Tanzania region only'
      });
    }

    // Check if user is assigned to this region
    const assignment = await pool.query(
      'SELECT 1 FROM admin_regions WHERE admin_user_id = $1 AND region_id = $2',
      [userId, courseRegionId]
    );

    if (assignment.rows.length === 0) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You are not assigned to this region'
      });
    }

    next();
  } catch (error) {
    console.error('Region access check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### 5. Frontend JavaScript

**File Location**: `/public/admin/js/prompt-viewer.js`

**Features:**
- [ ] Fetch and display current prompts
- [ ] Syntax highlighting for prompt text
- [ ] Toggle between Regular and Socratic view (mobile)
- [ ] Load version history
- [ ] Handle API errors gracefully
- [ ] Display loading states
- [ ] XSS protection (DOMPurify)

**Key Functions:**
```javascript
// Load current prompts
async function loadCurrentPrompts(courseId) {
  showLoading();
  try {
    const response = await fetch(`/api/admin/courses/${courseId}/prompts`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load prompts');
    }

    const data = await response.json();
    displayPrompts(data);
  } catch (error) {
    showError('Failed to load prompts. Please try again.');
    console.error(error);
  } finally {
    hideLoading();
  }
}

// Display prompts with syntax highlighting
function displayPrompts(data) {
  const regularContainer = document.getElementById('regular-prompt');
  const socraticContainer = document.getElementById('socratic-prompt');

  // Sanitize and display
  regularContainer.innerHTML = DOMPurify.sanitize(
    formatPromptText(data.regular.prompt)
  );

  socraticContainer.innerHTML = DOMPurify.sanitize(
    formatPromptText(data.socratic.prompt)
  );

  // Update metadata
  updateMetadata('regular', data.regular);
  updateMetadata('socratic', data.socratic);
}

// Format prompt text with syntax highlighting
function formatPromptText(text) {
  // Highlight sections like ## OUTPUT FORMAT
  return text
    .replace(/^##\s+(.+)$/gm, '<h3 class="prompt-heading">$1</h3>')
    .replace(/^###\s+(.+)$/gm, '<h4 class="prompt-subheading">$1</h4>')
    .replace(/^-\s+(.+)$/gm, '<li class="prompt-list-item">$1</li>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

// Load version history
async function loadVersionHistory(courseId, mode) {
  try {
    const response = await fetch(
      `/api/admin/courses/${courseId}/prompts/${mode}/history`,
      {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to load history');
    }

    const data = await response.json();
    displayVersionHistory(data);
  } catch (error) {
    showError('Failed to load version history.');
    console.error(error);
  }
}
```

### 6. CSS Styling

**File Location**: `/public/admin/css/prompt-viewer.css`

**Features:**
- [ ] Material Design 3 theme
- [ ] Responsive grid layout
- [ ] Syntax highlighting colors
- [ ] Mobile-friendly cards
- [ ] Loading states
- [ ] Error states

**Key Styles:**
```css
/* Prompt viewer container */
.prompt-viewer-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  padding: 24px;
}

/* Mobile: stack vertically */
@media (max-width: 768px) {
  .prompt-viewer-container {
    grid-template-columns: 1fr;
  }
}

/* Prompt card */
.prompt-card {
  background: var(--md-sys-color-surface);
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--md-sys-elevation-1);
}

/* Prompt text area */
.prompt-text {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  max-height: 500px;
  overflow-y: auto;
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;
}

/* Syntax highlighting */
.prompt-heading {
  color: #1976d2;
  font-weight: 600;
  margin: 16px 0 8px 0;
}

.prompt-subheading {
  color: #0288d1;
  font-weight: 500;
  margin: 12px 0 6px 0;
}

.prompt-list-item {
  color: #424242;
  margin-left: 20px;
}

/* Metadata section */
.metadata {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
  font-size: 13px;
  color: #666;
}

.metadata-item {
  display: flex;
  justify-content: space-between;
  margin: 8px 0;
}

/* Version badge */
.version-badge {
  display: inline-block;
  padding: 4px 12px;
  background: #4caf50;
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

/* Loading state */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #1976d2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

---

## Implementation Steps

### Day 1: Backend API + Middleware

**Tasks:**
1. ✅ Create `/routes/admin.routes.js` endpoints
   - `GET /api/admin/courses/:courseId/prompts`
   - `GET /api/admin/courses/:courseId/prompts/:mode/history`
   - `GET /api/admin/courses/:courseId/prompts/:mode/versions/:version`
   - `GET /api/admin/courses/pilot`

2. ✅ Create middleware `/middleware/rbac.middleware.js`
   - `checkRegionAccess()` - Tanzania pilot restriction

3. ✅ Write unit tests for API endpoints
   - Test successful prompt fetch
   - Test region access denial
   - Test version history
   - Test pilot course list

4. ✅ Test with Postman/curl
   - Verify Tanzania region access
   - Verify other regions blocked
   - Verify superadmin access

**Deliverable**: Working API endpoints with Tanzania pilot restriction

---

### Day 2: Frontend UI (Desktop)

**Tasks:**
1. ✅ Create `/public/admin/prompt-viewer.html`
   - Header with course selector
   - Side-by-side prompt display
   - Metadata sections
   - Version history link

2. ✅ Create `/public/admin/js/prompt-viewer.js`
   - `loadCurrentPrompts()`
   - `displayPrompts()`
   - `formatPromptText()`
   - Error handling

3. ✅ Create `/public/admin/css/prompt-viewer.css`
   - Desktop grid layout
   - Syntax highlighting
   - Material Design 3 theme

4. ✅ Integrate with existing sidebar navigation
   - Add "Prompts" menu item
   - Update breadcrumbs

**Deliverable**: Working desktop UI displaying prompts

---

### Day 3: Version History + Mobile

**Tasks:**
1. ✅ Create `/public/admin/prompt-history.html`
   - Timeline view
   - Version cards
   - Date filtering

2. ✅ Update `/public/admin/js/prompt-viewer.js`
   - `loadVersionHistory()`
   - `displayVersionHistory()`
   - Navigate between views

3. ✅ Add mobile responsive CSS
   - Stacked layout for mobile
   - Mode switcher dropdown
   - Touch-friendly buttons

4. ✅ Add loading and error states
   - Spinner overlay
   - Error messages
   - Empty state handling

**Deliverable**: Complete UI with version history and mobile support

---

### Day 4: Testing + Documentation

**Tasks:**
1. ✅ Integration testing
   - Superadmin can view all Tanzania courses
   - Regional admin (Tanzania) can view assigned courses
   - Regional admin (Other) blocked from pilot
   - Version history displays correctly

2. ✅ Browser testing
   - Chrome, Firefox, Safari
   - Mobile: iOS Safari, Android Chrome
   - Tablet: iPad, Android tablet

3. ✅ Security testing
   - XSS protection with DOMPurify
   - RBAC enforcement
   - SQL injection prevention

4. ✅ Documentation
   - User guide: "How to View Prompts"
   - Admin guide: "Phase 1 Pilot - Tanzania"
   - API documentation
   - Troubleshooting guide

**Deliverable**: Tested, documented, production-ready Phase 1

---

## Testing Checklist

### Unit Tests
- [ ] API endpoint: Get current prompts
- [ ] API endpoint: Get version history
- [ ] API endpoint: Get specific version
- [ ] Middleware: Tanzania region check
- [ ] Middleware: Region assignment check
- [ ] Middleware: Superadmin bypass

### Integration Tests
- [ ] Superadmin views Tanzania course prompts
- [ ] Tanzania regional admin views assigned course
- [ ] Kenya regional admin blocked from pilot
- [ ] Content creator views Tanzania course
- [ ] Viewer views Tanzania course
- [ ] Unauthenticated user blocked

### UI Tests
- [ ] Prompts display correctly (Regular & Socratic)
- [ ] Metadata displays correctly
- [ ] Version history loads and displays
- [ ] Course selector filters Tanzania only
- [ ] Mobile view stacks properly
- [ ] Loading states show during API calls
- [ ] Error messages display on failures

### Security Tests
- [ ] XSS attempt in prompt text blocked
- [ ] SQL injection in courseId parameter blocked
- [ ] JWT token required for all endpoints
- [ ] Invalid JWT token rejected
- [ ] Expired JWT token rejected
- [ ] RBAC enforced on all endpoints

### Browser Compatibility
- [ ] Chrome (desktop & mobile)
- [ ] Firefox (desktop & mobile)
- [ ] Safari (desktop & mobile)
- [ ] Edge (desktop)

---

## Success Criteria

Phase 1 is considered successful when:

1. ✅ **Functionality**
   - All Tanzania region users can view prompts
   - Version history displays correctly
   - Mobile layout works properly
   - No JavaScript errors in console

2. ✅ **Security**
   - RBAC enforced (Tanzania pilot restriction)
   - XSS protection in place
   - SQL injection prevented
   - JWT authentication required

3. ✅ **Performance**
   - Page load time < 2 seconds
   - API response time < 500ms
   - No memory leaks
   - Responsive UI (no lag)

4. ✅ **User Experience**
   - Intuitive navigation
   - Clear error messages
   - Loading states visible
   - Mobile-friendly

5. ✅ **Documentation**
   - User guide complete
   - API docs complete
   - Code comments clear
   - Troubleshooting guide ready

---

## Rollout Plan

### Week 1: Development (Days 1-4)
- Build backend API
- Build frontend UI
- Write tests
- Create documentation

### Week 1, Day 5: Staging Deployment
- Deploy to staging environment
- Test with Tanzania test users
- Verify RBAC works correctly
- Check mobile compatibility

### Week 1, Day 6-7: User Acceptance Testing (UAT)
- Invite 3-5 Tanzania users to test
- Collect feedback
- Fix any bugs found
- Make UI adjustments if needed

### Week 2, Day 1: Production Deployment
- Deploy to production (http://34.162.168.124:3000)
- Monitor for errors
- Support users during rollout
- Collect usage metrics

### Week 2, Day 2-5: Monitoring Period
- Monitor API performance
- Check error logs daily
- Gather user feedback
- Prepare Phase 2 planning

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Tanzania users find UI confusing | Medium | Medium | Provide in-app tooltips and user guide |
| API performance slow | Low | High | Add database indexes, caching |
| Mobile layout issues | Medium | Medium | Test on multiple devices before launch |
| RBAC not enforcing correctly | Low | High | Comprehensive integration tests |
| XSS vulnerability | Low | High | DOMPurify and CSP headers |

---

## Metrics to Track

### Usage Metrics
- Number of users accessing prompt viewer
- Number of prompt views per day
- Number of version history views
- Most viewed courses

### Performance Metrics
- API response time (p50, p95, p99)
- Page load time
- Time to interactive
- Error rate

### User Feedback
- Satisfaction score (1-5)
- Feature requests
- Bug reports
- Usability issues

---

## Phase 1 Deliverables

At the end of Phase 1, you will have:

1. ✅ **Working Prompt Viewer**
   - Read-only view of current prompts
   - Version history timeline
   - Mobile-responsive design

2. ✅ **API Endpoints**
   - GET current prompts
   - GET version history
   - GET specific version
   - GET pilot courses

3. ✅ **Security**
   - Tanzania pilot restriction
   - RBAC enforcement
   - XSS protection

4. ✅ **Documentation**
   - User guide
   - API documentation
   - Admin guide

5. ✅ **Tested System**
   - Unit tests
   - Integration tests
   - Security tests
   - Browser compatibility

---

## Next Steps After Phase 1

Once Phase 1 is complete and verified:

1. **Collect Feedback** (1 week)
   - User satisfaction survey
   - Feature requests
   - Pain points identified

2. **Plan Phase 2** (2-3 days)
   - Review feedback
   - Prioritize features
   - Update mockups based on feedback
   - Present Phase 2 plan for approval

3. **Phase 2 Development** (5-6 days)
   - Build prompt editor
   - Add draft management
   - Implement validation rules
   - Deploy to pilot

---

## Questions Before Starting

Before I start implementation, please confirm:

1. ✅ **Database Access**: Do I have permission to add indexes if needed?

2. ✅ **Deployment**: Should I deploy to staging first or directly to production?

3. ✅ **Test Users**: Can you provide 2-3 Tanzania region test accounts for UAT?

4. ✅ **Monitoring**: Should I add Google Analytics or similar tracking?

5. ✅ **Notifications**: Where should in-app notifications appear (top right corner)?

---

## READY TO START IMPLEMENTATION

Phase 1 plan approved and detailed.

**Shall I begin Day 1 implementation (Backend API + Middleware)?**

---

*Document Created: 2025-11-04*
*Phase: 1 of 5*
*Status: APPROVED - READY FOR IMPLEMENTATION*
*Pilot Region: Tanzania*
*Timeline: 3-4 days*
