# E2E Test Architecture: Regional Admin Prompt Workflow

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          E2E TEST ENVIRONMENT                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐ │
│  │   Playwright     │────▶│  Browser (Chrome)│────▶│   Screenshots   │ │
│  │   Test Runner    │     │   Headless/Head  │     │   (20+ images)  │ │
│  └────────┬─────────┘     └──────────────────┘     └─────────────────┘ │
│           │                                                              │
│           │ HTTP Requests                                               │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     Web Application                               │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │  │
│  │  │  login.html│  │prompt-     │  │prompt-     │  │prompt-     │  │  │
│  │  │            │  │viewer.html │  │editor.html │  │approvals.  │  │  │
│  │  │            │  │            │  │            │  │html        │  │  │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  │  │
│  │        │               │               │               │          │  │
│  │        └───────────────┴───────────────┴───────────────┘          │  │
│  │                            │                                       │  │
│  │                            │ AJAX Requests                         │  │
│  │                            ▼                                       │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │                     API Routes                                │ │  │
│  │  │  /api/prompt-approval/accessible-courses                     │ │  │
│  │  │  /api/prompt-approval/my-regions                             │ │  │
│  │  │  /api/prompt-approval/courses/:id/default-prompt             │ │  │
│  │  │  /api/prompt-approval/requests (POST)                        │ │  │
│  │  │  /api/prompt-approval/requests/:id/submit                    │ │  │
│  │  │  /api/prompt-approval/pending (GET)                          │ │  │
│  │  │  /api/prompt-approval/requests/:id/approve                   │ │  │
│  │  │  /api/prompt-approval/requests/:id/reject                    │ │  │
│  │  └────────────────────────┬─────────────────────────────────────┘ │  │
│  │                            │                                       │  │
│  │                            ▼                                       │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │              Middleware & Services                            │ │  │
│  │  │  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐ │ │  │
│  │  │  │   Auth     │  │    Region    │  │  Prompt Approval     │ │ │  │
│  │  │  │ Middleware │  │    Access    │  │     Service          │ │ │  │
│  │  │  │            │  │  Middleware  │  │                      │ │ │  │
│  │  │  └────────────┘  └──────────────┘  └──────────────────────┘ │ │  │
│  │  └────────────────────────┬─────────────────────────────────────┘ │  │
│  └───────────────────────────┼──────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     PostgreSQL Database                           │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │  │
│  │  │  regions   │  │admin_users │  │  courses   │  │admin_      │  │  │
│  │  │            │  │            │  │            │  │regions     │  │  │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘  │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                  │  │
│  │  │course_bot_ │  │prompt_     │  │prompt_     │                  │  │
│  │  │configs     │  │change_     │  │approval_   │                  │  │
│  │  │            │  │requests    │  │history     │                  │  │
│  │  └────────────┘  └────────────┘  └────────────┘                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Test Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TEST EXECUTION FLOW                              │
└─────────────────────────────────────────────────────────────────────────┘

   START
     │
     ▼
┌─────────────────────┐
│ 1. Setup Phase      │
│ ─────────────────   │
│ • Load .env         │
│ • Connect to DB     │
│ • Run setup script  │
│ • Create test data  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 2. Verification     │
│ ─────────────────   │
│ • Check regions     │
│ • Check admins      │
│ • Check courses     │
│ • Check tables      │
└──────────┬──────────┘
           │
           ├─────────────────────────────────────────────────────────┐
           │                                                          │
           ▼                                                          ▼
┌─────────────────────┐                                    ┌─────────────────────┐
│ 3. Suite 1          │                                    │ 6. Suite 4          │
│ ─────────────────   │                                    │ ─────────────────   │
│ View Prompts        │                                    │ Access Control      │
│                     │                                    │                     │
│ Test 1: Login       │──┐                                 │ Test 1: Visibility  │
│ Test 2: Regions     │  │                                 │ Test 2: 403 Error   │
│ Test 3: Dropdown    │  │                                 │ Test 3: Filtering   │
│ Test 4: Dual Mode   │  │                                 │ Test 4: Super Admin │
│ Test 5: Metadata    │  │                                 └──────────┬──────────┘
│ Test 6: Create Btn  │  │                                            │
└──────────┬──────────┘  │                                            │
           │             │                                            │
           ▼             │                                            │
┌─────────────────────┐  │                                            │
│ 4. Suite 2          │  │                                            │
│ ─────────────────   │  │                                            │
│ Create Prompt       │  │                                            │
│                     │  │                                            │
│ Test 1: Pre-select  │  │                                            │
│ Test 2: Mode Switch │  │                                            │
│ Test 3: Reference   │  │                                            │
│ Test 4: Counter     │  │                                            │
│ Test 5: Validation  │  │                                            │
│ Test 6: Draft       │  │                                            │
│ Test 7: Submit      │  │                                            │
└──────────┬──────────┘  │                                            │
           │             │                                            │
           ▼             │                                            │
┌─────────────────────┐  │                                            │
│ 5. Suite 3          │  │                                            │
│ ─────────────────   │  │                                            │
│ Approval Dashboard  │  │                                            │
│                     │  │                                            │
│ Test 1: Login       │  │                                            │
│ Test 2: All Pending │  │                                            │
│ Test 3: Region Info │  │                                            │
│ Test 4: Filter      │  │                                            │
│ Test 5: Approve     │  │                                            │
│ Test 6: Reject      │  │                                            │
└──────────┬──────────┘  │                                            │
           │             │                                            │
           ▼             │                                            │
┌─────────────────────┐  │                                            │
│ 7. Suite 5          │  │                                            │
│ ─────────────────   │  │                                            │
│ Integration         │  │                                            │
│                     │  │                                            │
│ Test 1: BE→UI       │  │                                            │
│ Test 2: UI→DB       │  │                                            │
│ Test 3: Approval    │  │                                            │
│ Test 4: Audit Trail │  │                                            │
└──────────┬──────────┘  │                                            │
           │             │                                            │
           └─────────────┴────────────────────────────────────────────┤
                                                                      │
                                                                      ▼
                                                           ┌─────────────────────┐
                                                           │ 8. Reporting        │
                                                           │ ─────────────────   │
                                                           │ • HTML report       │
                                                           │ • Screenshots       │
                                                           │ • Pass/Fail summary │
                                                           └──────────┬──────────┘
                                                                      │
                                                                      ▼
                                                                    END
```

## Test Data Relationships

```
                              ┌─────────────────┐
                              │   Super Admin   │
                              │ admin@school.edu│
                              └────────┬────────┘
                                       │
                                       │ role_id = 1
                                       │ primary_region_id = 5 (ALL)
                                       │
        ┌──────────────────────────────┴──────────────────────────────┐
        │                                                              │
        │ Has Access To:                                               │
        │                                                              │
┌───────▼────────┐                                          ┌──────────▼────────┐
│ Tanzania (TZ)  │                                          │   Kenya (KE)      │
│ region_id: 1   │                                          │   region_id: 2    │
└───────┬────────┘                                          └──────────┬────────┘
        │                                                              │
        │ Assigned To:                                                 │ Assigned To:
        │                                                              │
┌───────▼────────────┐                                      ┌──────────▼──────────┐
│ Regional Admin TZ  │                                      │ Regional Admin KE   │
│regional.tz@school  │                                      │regional.ke@school   │
│                    │                                      │                     │
│ role_id: 2         │                                      │ role_id: 2          │
│ primary_region_id:1│                                      │ primary_region_id:2 │
└────────┬───────────┘                                      └──────────┬──────────┘
         │                                                             │
         │ Can Access:                                                 │ Can Access:
         │                                                             │
    ┌────▼─────────────┐                                          ┌────▼──────────┐
    │ Business Studies │                                          │ ICT Training  │
    │ (BUS101)         │                                          │ (ICT101)      │
    │ region_id: 1     │                                          │ region_id: 2  │
    └────┬─────────────┘                                          └────┬──────────┘
         │                                                             │
    ┌────▼─────────────┐                                              │
    │ Mathematics      │                                              │
    │ (MATH101)        │                                              │
    │ region_id: 1     │                                              │
    └──────────────────┘                                              │
                                                                      │
         Both Courses Have:                                           │
              │                                                       │
              ▼                                                       ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │                    course_bot_configs                                │
    │  ┌───────────────┐              ┌───────────────┐                   │
    │  │ Regular Mode  │              │ Socratic Mode │                   │
    │  │ Prompt        │              │ Prompt        │                   │
    │  │ Version: 1    │              │ Version: 1    │                   │
    │  └───────────────┘              └───────────────┘                   │
    └──────────────────────────────────────────────────────────────────────┘
```

## Test User Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     REGIONAL ADMIN (Tanzania) FLOW                       │
└─────────────────────────────────────────────────────────────────────────┘

   START
     │
     ▼
[Login Page]
     │
     │ Enter: regional.tz@school.edu / Regional123!
     │
     ▼
[Dashboard]
     │
     │ Click: "View Prompts"
     │
     ▼
[Prompt Viewer]
     │
     │ See: Tanzania region only
     │ See: Business Studies, Mathematics in dropdown
     │ Select: Business Studies
     │
     ▼
[Display Prompts]
     │
     ├─────────────────┬─────────────────┐
     │                 │                 │
     ▼                 ▼                 ▼
[Regular Prompt]  [Socratic Prompt]  [Metadata]
 • Version 1       • Version 1        • Updated: ...
 • 250 chars       • 280 chars        • By: System
     │
     │ Click: "Create Custom Prompt"
     │
     ▼
[Prompt Editor]
     │
     │ Course: Business Studies (pre-selected)
     │ Mode: Regular (selected)
     │
     ├──────────────────┬──────────────────┐
     │                  │                  │
     ▼                  ▼                  ▼
[Current Prompt]   [New Prompt]      [Change Reason]
 (Reference)        (Textarea)        (Textarea)
                    • Type prompt      • Min 20 chars
                    • Min 50 chars     • Required
                    • Max 5000 chars
                    • Real-time counter
     │
     ├─────────────────┬─────────────────┐
     │                 │                 │
     ▼                 ▼                 ▼
[Save as Draft]   [Submit for        [Cancel]
                   Approval]
     │                 │
     │                 │ Success!
     │                 │
     ▼                 ▼
[Draft Saved]     [Request ID: 42]
                  [Status: Pending]

                       │
                       │ Wait for approval...
                       │
                       ▼
                [Super Admin Reviews]


┌─────────────────────────────────────────────────────────────────────────┐
│                        SUPER ADMIN FLOW                                  │
└─────────────────────────────────────────────────────────────────────────┘

   START
     │
     ▼
[Login Page]
     │
     │ Enter: admin@school.edu / Admin123!
     │
     ▼
[Dashboard]
     │
     │ Click: "Pending Approvals"
     │
     ▼
[Approval Dashboard]
     │
     │ See: ALL regions (Tanzania, Kenya)
     │ See: ALL pending requests
     │
     ├─────────────────┬─────────────────┐
     │                 │                 │
     ▼                 ▼                 ▼
[Filter by Region] [Request Card 1]  [Request Card 2]
 • All Regions      • BUS101           • ICT101
 • Tanzania         • Regular Mode     • Socratic Mode
 • Kenya            • By: TZ Admin     • By: KE Admin
                    • Region: Tanzania • Region: Kenya
     │
     │ Click: "Approve" on Request #42
     │
     ▼
[Approve Modal]
     │
     ├──────────────────┬──────────────────┐
     │                  │                  │
     ▼                  ▼                  ▼
[Request Details]  [Current Prompt]  [New Prompt]
 • Course: BUS101   • Version 1       • Version 2 (preview)
 • Mode: Regular    • 250 chars       • 315 chars
 • Requester: TZ    │                 │
 • Reason: ...      └─────────────────┘
     │
     ▼
[Review Notes]
 (Optional textarea)
     │
     ├─────────────────┬─────────────────┐
     │                 │                 │
     ▼                 ▼                 ▼
[Approve]         [Reject]          [Cancel]
     │                 │
     │                 │ Opens Reject Modal
     │                 │ • Feedback required (20+ chars)
     │                 │
     ▼                 ▼
[Approved!]       [Rejected!]
     │                 │
     │                 │
     ▼                 ▼
[Prompt Active]   [Feedback Sent]
 • Version: 2      • Requester notified
 • Activated: Now  • Can revise & resubmit
     │
     ▼
[Audit Trail Updated]
 • Action: Approved
 • Actor: admin@school.edu
 • Timestamp: 2025-11-04 10:30:00
 • Notes: ...
```

## File Structure

```
tests/e2e/
│
├── regional-admin-prompt-workflow.spec.js  (1,067 lines)
│   ├── Import statements
│   ├── Test configuration
│   ├── Helper functions
│   │   ├── loginAs()
│   │   ├── logout()
│   │   ├── verifyAPIResponse()
│   │   └── getAccessibleCourses()
│   ├── Suite 1: View Prompts (6 tests)
│   ├── Suite 2: Create Prompt (7 tests)
│   ├── Suite 3: Approval Dashboard (6 tests)
│   ├── Suite 4: Access Control (4 tests)
│   ├── Suite 5: Integration (4 tests)
│   └── test.afterAll (summary)
│
├── setup-regional-workflow-tests.js        (282 lines)
│   ├── Database configuration
│   ├── Test data constants
│   ├── setupTestData() function
│   │   ├── Create regions
│   │   ├── Create admin users
│   │   ├── Assign regions to admins
│   │   ├── Create courses
│   │   ├── Initialize bot configs
│   │   └── Verification queries
│   └── Export module
│
├── verify-test-setup.js                    (150 lines)
│   ├── Database configuration
│   ├── verifySetup() function
│   │   ├── Check regions
│   │   ├── Check admins
│   │   ├── Check assignments
│   │   ├── Check courses
│   │   ├── Check configs
│   │   └── Check tables
│   ├── Print results
│   └── Export module
│
├── QUICK-START.md                          (2 pages)
│   ├── 3-step setup
│   ├── Verify setup
│   ├── Test suite overview
│   ├── Test users table
│   ├── Screenshots location
│   ├── Troubleshooting
│   └── Quick commands
│
├── README-REGIONAL-WORKFLOW-TESTS.md       (15 pages)
│   ├── Overview
│   ├── Test coverage
│   ├── Prerequisites
│   ├── Setup instructions
│   ├── Test data
│   ├── Test execution
│   ├── Screenshots
│   ├── Troubleshooting (10+ issues)
│   ├── Cleanup
│   ├── CI/CD integration
│   └── Contributing
│
├── TEST-EXECUTION-SUMMARY.md               (10 pages)
│   ├── Test statistics
│   ├── Coverage summary
│   ├── Workflow diagram
│   ├── Features tested
│   ├── Test data architecture
│   ├── Screenshot evidence
│   ├── Recommendations
│   ├── Issues found
│   └── Maintenance schedule
│
├── IMPLEMENTATION-COMPLETE.md              (12 pages)
│   ├── Deliverables summary
│   ├── Test coverage matrix
│   ├── Security validations
│   ├── Screenshot documentation
│   ├── Quick start
│   ├── Execution statistics
│   ├── Known issues
│   ├── Success metrics
│   └── Acceptance criteria
│
└── TEST-ARCHITECTURE.md                    (This file)
    ├── System architecture diagram
    ├── Test flow architecture
    ├── Test data relationships
    ├── User flow diagrams
    └── File structure
```

## Technology Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                        TECHNOLOGY STACK                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Frontend:                                                       │
│  • HTML5, CSS3, JavaScript                                       │
│  • Material Design 3 (M3 Theme)                                  │
│  • Vanilla JS (no framework)                                     │
│                                                                  │
│  Backend:                                                        │
│  • Node.js 16+                                                   │
│  • Express.js (API routes)                                       │
│  • PostgreSQL 14+ (database)                                     │
│                                                                  │
│  Testing:                                                        │
│  • Playwright 1.56.0 (E2E framework)                             │
│  • Chromium (browser engine)                                     │
│  • Node pg (database client)                                     │
│  • bcrypt (password hashing)                                     │
│                                                                  │
│  Authentication:                                                 │
│  • JWT (JSON Web Tokens)                                         │
│  • bcrypt (password hashing)                                     │
│                                                                  │
│  Middleware:                                                     │
│  • auth.middleware.js (JWT verification)                         │
│  • region-access.middleware.js (RBAC enforcement)                │
│                                                                  │
│  Services:                                                       │
│  • prompt-approval.service.js (business logic)                   │
│  • postgres.service.js (database queries)                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

**Created**: 2025-11-04
**Version**: 1.0.0
**Total Diagrams**: 6
**Total Lines**: 600+
