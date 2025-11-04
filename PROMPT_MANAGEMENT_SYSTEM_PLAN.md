# Prompt Management & Approval Workflow System
## Comprehensive Analysis & Phased Implementation Plan

**Date**: 2025-11-04
**Project**: Teachers Training Platform
**Feature**: Prompt Management with RBAC & Approval Workflow

---

## Executive Summary

This document outlines a complete system for managing coaching bot prompts with role-based access control, approval workflows, and audit trails. The system allows:
- **Read-only viewing** of current prompts
- **Modification interface** for proposing changes
- **Approval workflow** with regional admin and superadmin review
- **Version control** and audit history
- **Testing & deployment** capabilities

---

## Current State Analysis

### ✅ What Already Exists:

#### 1. Database Infrastructure (COMPLETE)

**Tables:**
```sql
-- Core prompt storage
course_bot_configs (
  id, course_id,
  regular_prompt, regular_greeting, regular_help_text, regular_version,
  socratic_prompt, socratic_greeting, socratic_help_text, socratic_version,
  default_mode, allow_mode_switching,
  created_by, last_approved_by, last_approved_at
)

-- Change request system
prompt_change_requests (
  id, course_id, mode,
  new_prompt, new_greeting, new_help_text,
  change_reason, change_description,
  status (draft/pending_approval/approved/rejected/archived),
  requested_by, reviewed_by,
  version_number, replaces_version,
  activated_at
)

-- Audit trail
prompt_approval_history (
  id, request_id, course_id,
  action (submitted/approved/rejected/activated/archived),
  actor_id, actor_role,
  notes, previous_status, new_status,
  ip_address, user_agent
)
```

#### 2. Role-Based Access Control (COMPLETE)

**Roles:**
- **superadmin**: Full access to all regions/courses
- **regional_admin**: Access to assigned regions only
- **content_creator**: Can propose changes, cannot approve
- **viewer**: Read-only access

**Region Assignment:**
```sql
admin_regions (
  admin_user_id, region_id,
  assigned_by, assigned_at
)
```

#### 3. UI Components (PARTIAL)

**Existing:**
- `/admin/prompt-approvals.html` - Approval dashboard (UI exists)

**Missing:**
- Read-only prompt viewer
- Modification/editor interface
- Comparison/diff view
- Testing sandbox

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PROMPT MANAGEMENT SYSTEM                  │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐          ┌────▼────┐         ┌─────▼─────┐
   │  VIEW   │          │  MODIFY │         │  APPROVE  │
   │ (Read)  │          │ (Draft) │         │ (Review)  │
   └────┬────┘          └────┬────┘         └─────┬─────┘
        │                    │                     │
        │                    │                     │
   ┌────▼────────────────────▼─────────────────────▼─────┐
   │          ROLE-BASED ACCESS CONTROL (RBAC)           │
   ├──────────────────────────────────────────────────────┤
   │  Superadmin:      All regions, All permissions       │
   │  Regional Admin:  Assigned regions, Approve          │
   │  Content Creator: Assigned regions, Propose          │
   │  Viewer:          Assigned regions, Read-only        │
   └──────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐          ┌────▼────┐         ┌─────▼─────┐
   │ Version │          │  Audit  │         │  Testing  │
   │ Control │          │  Trail  │         │  Sandbox  │
   └─────────┘          └─────────┘         └───────────┘
```

---

## 📍 System Prompt Locations

### Current Production Prompts

**Database Location:**
```
Table: course_bot_configs
Course ID: 8 (Business Studies Orientation)

Regular Mode (v3):
- Prompt: course_bot_configs.regular_prompt
- Version: course_bot_configs.regular_version = 3
- Last Updated: 2025-11-04
- Approved By: superadmin (ID: 1)

Socratic Mode (v10):
- Prompt: course_bot_configs.socratic_prompt
- Version: course_bot_configs.socratic_version = 10
- Last Updated: 2025-11-04
- Approved By: superadmin (ID: 1)
```

**Code Location (Runtime):**
```
services/vertexai.service.js:368
- generateEducationalResponse() receives customPrompt parameter
- Passed from course-orchestrator.service.js:734
- Retrieved via bot-config.service.js:getPromptForMode()
```

**Security Layer:**
```
services/prompt-injection-protection.service.js:474
- fortifySystemPrompt() wraps prompts with security rules
- Detects Socratic mode and applies appropriate directives
```

### Modification Areas

**For Proposing Changes:**
```
UI: /admin/prompt-editor.html (TO BE CREATED)
API: POST /api/admin/prompt-change-requests
Database: prompt_change_requests table (status='draft')
```

**For Approval:**
```
UI: /admin/prompt-approvals.html (EXISTS)
API: POST /api/admin/prompt-change-requests/:id/approve
Database: prompt_change_requests (status='pending_approval')
```

**For Activation:**
```
API: POST /api/admin/prompt-change-requests/:id/activate
Database:
  - course_bot_configs updated with new prompt
  - regular_version or socratic_version incremented
  - prompt_change_requests (status='approved', activated_at=NOW())
```

---

## Phase-by-Phase Implementation Plan

---

## 🔵 PHASE 1: Read-Only Prompt Viewer

**Goal**: Allow all roles to view current prompts and history

### Components to Build:

#### 1.1 Prompt Viewer UI (`/admin/prompt-viewer.html`)

**Features:**
- Display current Regular and Socratic prompts
- Show version numbers
- Display last updated date and by whom
- Show approval status
- Filter by course/region
- Mobile-responsive design

**Mockup:**
```
┌────────────────────────────────────────────────────────┐
│ 📖 Prompt Viewer - Business Studies Orientation        │
├────────────────────────────────────────────────────────┤
│                                                         │
│ [Regular Mode v3] ──────────────────── [Socratic Mode v10]
│                                                         │
│ ┌─ Regular Prompt ─────────────────────────────────┐  │
│ │ You are an educational assistant using            │  │
│ │ Chain-of-Thought reasoning...                     │  │
│ │                                                    │  │
│ │ ## OUTPUT FORMAT:                                 │  │
│ │ ### Direct Answer                                 │  │
│ │ [1-2 sentence answer]                            │  │
│ │ ...                                               │  │
│ └───────────────────────────────────────────────────┘  │
│                                                         │
│ 📊 Metadata:                                           │
│   Version: 3                                           │
│   Updated: 2025-11-04 21:23:22                        │
│   By: admin@school.edu (Superadmin)                   │
│   Status: ✅ Active                                    │
│   Length: 1737 characters                             │
│                                                         │
│ [📝 Propose Change] [📜 View History] [🔄 Compare]    │
└────────────────────────────────────────────────────────┘
```

#### 1.2 Version History View

**Features:**
- List all previous versions
- Show what changed between versions
- Display approval trail
- Rollback capability (superadmin only)

#### 1.3 API Endpoints

```javascript
// Get current prompts
GET /api/admin/courses/:courseId/prompts
Response: {
  regular: { prompt, greeting, helpText, version, lastUpdated, approvedBy },
  socratic: { prompt, greeting, helpText, version, lastUpdated, approvedBy }
}

// Get version history
GET /api/admin/courses/:courseId/prompts/history
Response: [
  { version, mode, prompt, updatedAt, updatedBy, changeReason }
]

// Get specific version
GET /api/admin/courses/:courseId/prompts/:mode/versions/:version
Response: { prompt, greeting, helpText, metadata }
```

#### 1.4 RBAC Permissions

| Role | View Current | View History | Filter by Region |
|------|--------------|--------------|------------------|
| Superadmin | All courses | All history | All regions |
| Regional Admin | Assigned regions | Assigned regions | Assigned only |
| Content Creator | Assigned regions | Assigned regions | Assigned only |
| Viewer | Assigned regions | Assigned regions | Assigned only |

### Acceptance Criteria:

- [ ] All roles can view current prompts for their accessible courses
- [ ] Version history displays correctly with metadata
- [ ] Regional admins only see their assigned regions
- [ ] Mobile-responsive design works on phones
- [ ] Load time < 2 seconds for prompt display
- [ ] XSS protection in place for prompt display

### Estimated Effort: **3-4 days**

---

## 🟢 PHASE 2: Modification Interface

**Goal**: Allow authorized users to propose prompt changes

### Components to Build:

#### 2.1 Prompt Editor UI (`/admin/prompt-editor.html`)

**Features:**
- Rich text editor with markdown support
- Live preview of prompt
- Character count
- Validation rules
- Template suggestions
- Save as draft
- Submit for approval

**Mockup:**
```
┌────────────────────────────────────────────────────────┐
│ ✏️ Prompt Editor - Business Studies Orientation        │
├────────────────────────────────────────────────────────┤
│                                                         │
│ Mode: [Regular Mode ▼]                                │
│ Current Version: v3 → New Version: v4                  │
│                                                         │
│ ┌─ Edit Prompt ───────────────────────────────────┐   │
│ │ You are an educational assistant using...        │   │
│ │                                                   │   │
│ │ [Markdown editor with syntax highlighting]       │   │
│ │                                                   │   │
│ │                                                   │   │
│ └──────────────────────────────────────────────────┘   │
│ Character Count: 1850 / 5000                           │
│                                                         │
│ ┌─ Live Preview ──────────────────────────────────┐   │
│ │ [Rendered prompt with formatting]                │   │
│ └──────────────────────────────────────────────────┘   │
│                                                         │
│ Change Reason: (Required)                              │
│ ┌──────────────────────────────────────────────────┐   │
│ │ Updated to include better examples for...        │   │
│ └──────────────────────────────────────────────────┘   │
│                                                         │
│ Change Description: (Optional)                         │
│ ┌──────────────────────────────────────────────────┐   │
│ │ - Added 3 new question patterns                  │   │
│ │ - Removed "To understand" phrase                 │   │
│ │ - Increased emphasis on STOP instruction         │   │
│ └──────────────────────────────────────────────────┘   │
│                                                         │
│ [💾 Save as Draft] [📤 Submit for Approval] [❌ Cancel]│
└────────────────────────────────────────────────────────┘
```

#### 2.2 Validation Rules

**Automatic Checks:**
- [ ] Prompt length: 100 - 5000 characters
- [ ] No empty required fields
- [ ] Change reason provided
- [ ] Forbidden phrases check (optional warning)
- [ ] Grammar/spelling check (optional)

**Socratic Mode Specific:**
- [ ] Warning if contains "To understand..."
- [ ] Warning if contains "Let's consider..."
- [ ] Warning if missing STOP instruction
- [ ] Suggestion to use numbered format

**Regular Mode Specific:**
- [ ] Warning if missing structure sections
- [ ] Suggestion to include examples

#### 2.3 Draft Management

**Features:**
- Save work-in-progress
- Auto-save every 30 seconds
- Resume editing drafts
- Delete drafts
- View all my drafts

#### 2.4 API Endpoints

```javascript
// Create new change request (draft)
POST /api/admin/prompt-change-requests
Body: {
  courseId, mode, newPrompt, newGreeting, newHelpText,
  changeReason, changeDescription
}
Response: { requestId, status: 'draft' }

// Update draft
PATCH /api/admin/prompt-change-requests/:id
Body: { newPrompt, changeReason, changeDescription }
Response: { success: true }

// Submit for approval
POST /api/admin/prompt-change-requests/:id/submit
Response: { success: true, status: 'pending_approval' }

// Get my drafts
GET /api/admin/prompt-change-requests/my-drafts
Response: [{ id, courseId, mode, createdAt, status }]

// Delete draft
DELETE /api/admin/prompt-change-requests/:id
Response: { success: true }
```

#### 2.5 RBAC Permissions

| Role | Create Draft | Edit Own Draft | Delete Own Draft | Submit for Approval |
|------|--------------|----------------|------------------|---------------------|
| Superadmin | ✅ | ✅ | ✅ | ✅ (auto-approve) |
| Regional Admin | ✅ | ✅ | ✅ | ✅ |
| Content Creator | ✅ | ✅ | ✅ | ✅ |
| Viewer | ❌ | ❌ | ❌ | ❌ |

### Acceptance Criteria:

- [ ] Editor supports markdown formatting
- [ ] Live preview updates in real-time
- [ ] Validation rules work correctly
- [ ] Auto-save prevents data loss
- [ ] Character count updates dynamically
- [ ] Submit button disabled until required fields filled
- [ ] Regional admins can only create requests for their regions
- [ ] XSS protection in editor

### Estimated Effort: **5-6 days**

---

## 🟡 PHASE 3: Approval Workflow

**Goal**: Review and approve/reject prompt changes

### Components to Build:

#### 3.1 Approval Dashboard (Enhance Existing)

**File**: `/admin/prompt-approvals.html` (EXISTS - needs enhancement)

**Features:**
- List all pending approvals
- Filter by status/course/region
- Quick approve/reject
- Detailed review view
- Bulk actions (superadmin only)
- Notification badges

**Enhanced Mockup:**
```
┌────────────────────────────────────────────────────────┐
│ ⏳ Prompt Approvals (3 Pending)                        │
├────────────────────────────────────────────────────────┤
│                                                         │
│ Filters: [All Courses ▼] [Pending ▼] [This Month ▼]  │
│                                                         │
│ ┌─ Request #42 ──────────────────────────────────────┐│
│ │ 🟡 Pending Approval                                 ││
│ │ Course: Business Studies Orientation                ││
│ │ Mode: Socratic → v11                               ││
│ │ Requested by: content@school.edu (Content Creator) ││
│ │ Submitted: 2025-11-05 10:30 AM                     ││
│ │ Reason: Fixed "To understand" issue                ││
│ │                                                     ││
│ │ [👁️ Review] [✅ Quick Approve] [❌ Reject]         ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ ┌─ Request #41 ──────────────────────────────────────┐│
│ │ 🔵 Draft                                            ││
│ │ Course: Business Studies Orientation                ││
│ │ Mode: Regular → v4                                 ││
│ │ Requested by: admin@school.edu (You)               ││
│ │ Created: 2025-11-04 3:00 PM                        ││
│ │ Reason: Add more examples                          ││
│ │                                                     ││
│ │ [✏️ Edit] [📤 Submit for Approval] [🗑️ Delete]    ││
│ └─────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────┘
```

#### 3.2 Detailed Review View

**Features:**
- Side-by-side comparison (old vs new)
- Highlighted differences
- Change reason and description
- Version history
- Comments/feedback section
- Approve/Reject with notes

**Mockup:**
```
┌────────────────────────────────────────────────────────┐
│ 🔍 Review Request #42 - Socratic Mode v10 → v11       │
├────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─ Current (v10) ────────┐ ┌─ Proposed (v11) ────────┐│
│ │ You are a Socratic     │ │ You are a Socratic     ││
│ │ questioner. Your ONLY  │ │ questioner. Your ONLY  ││
│ │ output format is       │ │ output format is       ││
│ │ numbered questions.    │ │ numbered questions.    ││
│ │                        │ │                        ││
│ │ 🚫 YOU ARE FORBIDDEN: │ │ 🚫 YOU ARE FORBIDDEN: ││
│ │ - Give explanations    │ │ - Give explanations    ││
│ │ - Use words: "To",     │ │ - Use words: "To",     ││
│ │   "Let's", "Consider"  │ │   "Let's", "Consider", ││
│ │                        │ │   "Imagine a scenario" ││
│ │                        │ │ + "Think about this"   ││ ← NEW
│ └────────────────────────┘ └────────────────────────┘│
│                                                         │
│ 📝 Change Summary:                                     │
│   - Added forbidden phrase: "Think about this"         │
│   - Character count: 2574 → 2605 (+31 chars)          │
│   - Lines changed: 1                                   │
│                                                         │
│ 💬 Change Reason:                                      │
│   "Bot was still using 'Think about this' in v10,     │
│    adding to forbidden list"                           │
│                                                         │
│ 📋 Review Notes: (Optional)                            │
│ ┌──────────────────────────────────────────────────┐   │
│ │ Good catch! This phrase was appearing...          │   │
│ └──────────────────────────────────────────────────┘   │
│                                                         │
│ [✅ Approve & Activate] [✅ Approve Only] [❌ Reject]  │
└────────────────────────────────────────────────────────┘
```

#### 3.3 Approval Workflow States

```
Draft ──→ Pending Approval ──→ Approved ──→ Activated
           ↓                      ↓
        Rejected              Archived
```

**State Transitions:**
1. **Draft**: Content creator saves work
2. **Pending Approval**: Creator submits for review
3. **Approved**: Regional admin or superadmin approves
4. **Activated**: Prompt goes live in production
5. **Rejected**: Reviewer rejects with feedback
6. **Archived**: Old versions after new one activated

#### 3.4 Notification System

**Email Notifications:**
- [ ] When request submitted → notify regional admin
- [ ] When request approved → notify requestor
- [ ] When request rejected → notify requestor with feedback
- [ ] When request activated → notify requestor

**In-App Notifications:**
- [ ] Badge count on approval dashboard
- [ ] Real-time updates using WebSocket (optional)
- [ ] Dashboard widget showing pending count

#### 3.5 API Endpoints

```javascript
// Get pending approvals
GET /api/admin/prompt-change-requests/pending
Query: { courseId?, status?, region? }
Response: [{ id, courseId, mode, requestedBy, requestedAt, status }]

// Get request details with comparison
GET /api/admin/prompt-change-requests/:id/review
Response: {
  request: { id, courseId, mode, newPrompt, changeReason },
  current: { prompt, version },
  diff: { added: [], removed: [], changed: [] }
}

// Approve request
POST /api/admin/prompt-change-requests/:id/approve
Body: { reviewNotes, activateNow: boolean }
Response: { success: true, newStatus: 'approved' }

// Reject request
POST /api/admin/prompt-change-requests/:id/reject
Body: { reviewNotes }
Response: { success: true, newStatus: 'rejected' }

// Activate approved request
POST /api/admin/prompt-change-requests/:id/activate
Response: { success: true, newVersion: 11 }
```

#### 3.6 RBAC Permissions

| Role | View Pending | Review | Approve | Reject | Activate |
|------|--------------|--------|---------|--------|----------|
| Superadmin | All | ✅ | ✅ | ✅ | ✅ |
| Regional Admin | Assigned regions | ✅ | ✅ | ✅ | ✅ |
| Content Creator | Own requests | ✅ | ❌ | ❌ | ❌ |
| Viewer | Assigned regions | ✅ | ❌ | ❌ | ❌ |

### Acceptance Criteria:

- [ ] Approval dashboard shows pending requests correctly
- [ ] Regional admins only see their assigned regions
- [ ] Side-by-side comparison highlights differences
- [ ] Approval/rejection triggers audit trail entry
- [ ] Email notifications sent correctly
- [ ] Badge count updates in real-time
- [ ] Rollback prevents accidental activation
- [ ] Comments/feedback stored in history

### Estimated Effort: **6-7 days**

---

## 🟣 PHASE 4: Version Control & Audit Trail

**Goal**: Track all changes and enable rollback

### Components to Build:

#### 4.1 Version History View

**Features:**
- Timeline of all versions
- Diff between any two versions
- Metadata for each version
- Rollback capability
- Export version history

**Mockup:**
```
┌────────────────────────────────────────────────────────┐
│ 📜 Version History - Socratic Mode                     │
├────────────────────────────────────────────────────────┤
│                                                         │
│ Timeline: [All Time ▼] Course: Business Studies       │
│                                                         │
│ ┌─ v10 (Current) ───────────────────────────────────┐ │
│ │ ✅ Active | 2025-11-04 21:23:22                    │ │
│ │ Updated by: admin@school.edu                       │ │
│ │ Change: Numbered questions only, STOP instruction  │ │
│ │ Approved by: Superadmin                            │ │
│ │ [👁️ View] [🔄 Compare with v9]                    │ │
│ └───────────────────────────────────────────────────┘ │
│          ↓                                             │
│ ┌─ v9 ──────────────────────────────────────────────┐ │
│ │ 📦 Archived | 2025-11-04 21:06:39                 │ │
│ │ Updated by: admin@school.edu                       │ │
│ │ Change: Zero explanation allowed                   │ │
│ │ [👁️ View] [🔄 Compare with v10] [↩️ Rollback]    │ │
│ └───────────────────────────────────────────────────┘ │
│          ↓                                             │
│ ┌─ v8 ──────────────────────────────────────────────┐ │
│ │ 📦 Archived | 2025-11-04 20:57:38                 │ │
│ │ Updated by: admin@school.edu                       │ │
│ │ Change: True experiential discovery                │ │
│ │ [👁️ View] [🔄 Compare]                            │ │
│ └───────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

#### 4.2 Audit Trail View

**Features:**
- Complete action log
- Who did what when
- IP address tracking
- User agent tracking
- Filter by action/actor/date
- Export to CSV

**Mockup:**
```
┌────────────────────────────────────────────────────────┐
│ 📊 Audit Trail - Prompt Management                     │
├────────────────────────────────────────────────────────┤
│                                                         │
│ Filter: [All Actions ▼] [All Users ▼] [Last 7 Days ▼]│
│                                                         │
│ Date/Time         Action      Actor            Request │
│ ───────────────────────────────────────────────────────│
│ 11/04 21:23:22   Activated   admin@school.edu   #45   │
│ 11/04 21:23:15   Approved    admin@school.edu   #45   │
│ 11/04 21:20:10   Submitted   admin@school.edu   #45   │
│ 11/04 21:06:39   Activated   admin@school.edu   #44   │
│ 11/04 20:57:38   Activated   admin@school.edu   #43   │
│ 11/03 15:30:22   Rejected    regional@tz.edu    #42   │
│   └─ Notes: "Needs more examples before approval"     │
│ 11/03 14:15:10   Submitted   content@school.edu #42   │
│ 11/03 10:05:33   Created     content@school.edu #42   │
│                                                         │
│ [📥 Export to CSV] [🔍 Advanced Search]               │
└────────────────────────────────────────────────────────┘
```

#### 4.3 Rollback System

**Features:**
- One-click rollback to previous version
- Confirmation dialog with preview
- Rollback creates new version (not destructive)
- Audit trail entry for rollback
- Superadmin only

**Process:**
1. Select version to rollback to
2. Preview changes (current → selected)
3. Confirm rollback
4. System creates new version (copy of selected)
5. Activates new version
6. Logs rollback action

#### 4.4 Comparison Tool

**Features:**
- Select any two versions
- Side-by-side or unified diff view
- Syntax highlighting
- Character-level diff
- Export comparison as PDF

#### 4.5 API Endpoints

```javascript
// Get version history
GET /api/admin/courses/:courseId/prompts/:mode/versions
Response: [
  { version, prompt, updatedAt, updatedBy, changeReason, status }
]

// Get specific version
GET /api/admin/courses/:courseId/prompts/:mode/versions/:version
Response: { version, prompt, greeting, helpText, metadata }

// Compare two versions
GET /api/admin/courses/:courseId/prompts/:mode/versions/:v1/compare/:v2
Response: {
  v1: { version, prompt },
  v2: { version, prompt },
  diff: { added: [], removed: [], changed: [] }
}

// Rollback to version (superadmin only)
POST /api/admin/courses/:courseId/prompts/:mode/rollback
Body: { toVersion, reason }
Response: { success: true, newVersion: 12 }

// Get audit trail
GET /api/admin/audit-trail/prompts
Query: { action?, actorId?, startDate?, endDate?, courseId? }
Response: [
  { timestamp, action, actorName, actorRole, requestId, notes, ipAddress }
]

// Export audit trail
GET /api/admin/audit-trail/prompts/export
Query: { format: 'csv'|'json', filters }
Response: CSV/JSON file download
```

#### 4.6 RBAC Permissions

| Role | View History | View Audit Trail | Compare Versions | Rollback |
|------|--------------|------------------|------------------|----------|
| Superadmin | All | All | All | ✅ |
| Regional Admin | Assigned regions | Assigned regions | Assigned regions | ❌ |
| Content Creator | Assigned regions | Own actions | Assigned regions | ❌ |
| Viewer | Assigned regions | ❌ | Assigned regions | ❌ |

### Acceptance Criteria:

- [ ] Version history displays all versions chronologically
- [ ] Diff view accurately highlights changes
- [ ] Rollback creates new version (not destructive)
- [ ] Audit trail captures all actions with metadata
- [ ] Export to CSV works correctly
- [ ] Regional admins only see their data
- [ ] Rollback requires superadmin confirmation

### Estimated Effort: **5-6 days**

---

## 🔴 PHASE 5: Testing & Deployment

**Goal**: Safe testing and gradual rollout

### Components to Build:

#### 5.1 Sandbox Testing Environment

**Features:**
- Test prompts in isolated environment
- Send test messages to bot
- Preview responses
- A/B testing capability
- Performance monitoring

**Mockup:**
```
┌────────────────────────────────────────────────────────┐
│ 🧪 Prompt Testing Sandbox                              │
├────────────────────────────────────────────────────────┤
│                                                         │
│ Testing: Socratic Mode v11 (Draft)                    │
│                                                         │
│ ┌─ Test Console ──────────────────────────────────────┐│
│ │ User Question:                                       ││
│ │ ┌──────────────────────────────────────────────────┐││
│ │ │ What is entrepreneurship?                         │││
│ │ └──────────────────────────────────────────────────┘││
│ │ [🚀 Send Test Message]                              ││
│ │                                                      ││
│ │ Bot Response:                                        ││
│ │ ┌──────────────────────────────────────────────────┐││
│ │ │ 1. Have you ever started something from scratch? │││
│ │ │ 2. What motivated you to take that risk?         │││
│ │ └──────────────────────────────────────────────────┘││
│ │                                                      ││
│ │ ⏱️ Response Time: 1.2s                              ││
│ │ 📏 Length: 98 characters                            ││
│ │ ✅ Format: Valid (2 numbered questions)             ││
│ │ ⚠️ Warning: None                                    ││
│ └──────────────────────────────────────────────────────┘│
│                                                         │
│ ┌─ Test History (Last 5) ─────────────────────────────┐│
│ │ "What is market research?" → 2 questions, 1.1s     ││
│ │ "Tell me about planning" → 2 questions, 0.9s       ││
│ │ "What is classroom mgmt?" → 2 questions, 1.3s      ││
│ └──────────────────────────────────────────────────────┘│
│                                                         │
│ [💾 Save Test Results] [✅ Tests Passed - Submit]      │
└────────────────────────────────────────────────────────┘
```

#### 5.2 A/B Testing

**Features:**
- Split traffic between two prompt versions
- Collect metrics (response time, user satisfaction, completion rate)
- Statistical analysis
- Automatic winner selection

**Configuration:**
```
A/B Test: Socratic v10 vs v11
Duration: 7 days
Split: 50% / 50%
Metrics:
  - Average response time
  - User engagement (questions asked)
  - Session completion rate
  - User feedback ratings
Winner criteria: Statistical significance p < 0.05
```

#### 5.3 Gradual Rollout

**Features:**
- Roll out to percentage of users
- Monitor error rates
- Automatic rollback on errors
- Manual stop/pause

**Rollout Plan:**
```
Phase 1: 10% of users (Day 1-2)
  → Monitor for errors
Phase 2: 25% of users (Day 3-4)
  → Collect metrics
Phase 3: 50% of users (Day 5-6)
  → Compare with baseline
Phase 4: 100% rollout (Day 7)
  → Full activation
```

#### 5.4 Performance Monitoring

**Metrics to Track:**
- Response time (p50, p95, p99)
- Error rate
- User satisfaction
- Prompt length vs response quality
- Token usage / cost

#### 5.5 API Endpoints

```javascript
// Create test session
POST /api/admin/prompt-testing/sessions
Body: { courseId, mode, promptVersion }
Response: { sessionId, sandboxUrl }

// Send test message
POST /api/admin/prompt-testing/sessions/:id/test
Body: { message }
Response: { response, responseTime, tokenCount, warnings }

// Get test results
GET /api/admin/prompt-testing/sessions/:id/results
Response: {
  tests: [{ message, response, responseTime, valid }],
  summary: { avgResponseTime, passRate }
}

// Start A/B test
POST /api/admin/prompt-testing/ab-test
Body: {
  courseId, mode,
  variantA: { version: 10 },
  variantB: { version: 11 },
  duration: 7,
  splitRatio: 0.5
}
Response: { testId, startedAt }

// Get A/B test results
GET /api/admin/prompt-testing/ab-test/:id
Response: {
  variantA: { metrics },
  variantB: { metrics },
  winner: 'A'|'B'|'inconclusive'
}

// Start gradual rollout
POST /api/admin/prompt-testing/rollout
Body: { requestId, phases: [10, 25, 50, 100] }
Response: { rolloutId, currentPhase: 1 }
```

### Acceptance Criteria:

- [ ] Sandbox allows testing without affecting production
- [ ] Test console displays responses correctly
- [ ] A/B testing splits traffic accurately
- [ ] Gradual rollout progresses through phases
- [ ] Automatic rollback triggers on high error rate
- [ ] Performance metrics collected and displayed
- [ ] All tests pass before allowing activation

### Estimated Effort: **6-7 days**

---

## Security Considerations

### 1. XSS Protection
- Sanitize all prompt text before display
- Use DOMPurify or similar library
- CSP headers in place

### 2. SQL Injection
- Parameterized queries only
- ORM/Query builder usage
- Input validation

### 3. RBAC Enforcement
- Server-side permission checks
- JWT token validation
- Region assignment verification

### 4. Audit Trail
- Log all sensitive actions
- IP address tracking
- Session information

### 5. Prompt Injection
- Already implemented in `prompt-injection-protection.service.js`
- Continue validation on new prompts

---

## Database Migration Plan

### New Tables (Already Exist):
✅ `course_bot_configs`
✅ `prompt_change_requests`
✅ `prompt_approval_history`

### Additional Indexes Needed:
```sql
-- Performance optimization
CREATE INDEX idx_prompt_requests_course_status
  ON prompt_change_requests(course_id, status);

CREATE INDEX idx_prompt_history_created_at
  ON prompt_approval_history(created_at DESC);

CREATE INDEX idx_bot_configs_course_version
  ON course_bot_configs(course_id, regular_version, socratic_version);
```

### Data Migration:
```sql
-- Backfill version history for existing prompts
INSERT INTO prompt_change_requests (
  course_id, mode, new_prompt, change_reason,
  status, requested_by, version_number, activated_at
)
SELECT
  id, 'regular', regular_prompt, 'Initial version',
  'approved', created_by, regular_version, created_at
FROM course_bot_configs;
```

---

## API Documentation

### Authentication
All endpoints require JWT token in Authorization header:
```
Authorization: Bearer <token>
```

### Error Responses
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Insufficient permissions",
    "details": "Regional admin can only access assigned regions"
  }
}
```

### Rate Limiting
- 100 requests per minute per user
- 1000 requests per hour per user
- Sandbox testing: 50 tests per hour

---

## Testing Strategy

### Unit Tests
- RBAC permission checks
- Validation rules
- Diff algorithm
- Approval workflow state transitions

### Integration Tests
- End-to-end approval flow
- Region-based filtering
- Version rollback
- Email notifications

### E2E Tests
- Create draft → Submit → Approve → Activate
- Regional admin can only see assigned regions
- Rollback creates new version
- Audit trail captures all actions

### Load Tests
- 100 concurrent users viewing prompts
- 50 concurrent approval actions
- Database query performance under load

---

## Deployment Plan

### Phase Rollout Schedule

**Week 1**: Phase 1 (Viewer)
- Deploy read-only viewer
- Test with superadmin
- Roll out to regional admins

**Week 2**: Phase 2 (Editor)
- Deploy editor interface
- Test with content creators
- Validate RBAC enforcement

**Week 3**: Phase 3 (Approval)
- Deploy approval workflow
- Test notifications
- Validate audit trail

**Week 4**: Phase 4 (Version Control)
- Deploy version history
- Test rollback
- Validate diff views

**Week 5**: Phase 5 (Testing)
- Deploy sandbox
- Test A/B testing
- Validate gradual rollout

**Week 6**: Production Ready
- Full system testing
- Documentation complete
- Training for admins

---

## Training & Documentation

### Admin Training Materials
1. **Video Tutorial**: How to propose prompt changes
2. **Step-by-Step Guide**: Approval workflow
3. **FAQ**: Common questions
4. **Best Practices**: Writing effective prompts

### User Guides
- **Superadmin Guide**: Full system access
- **Regional Admin Guide**: Review and approval
- **Content Creator Guide**: Creating and submitting changes
- **Viewer Guide**: Read-only access

---

## Success Metrics

### System Adoption
- Number of prompt change requests submitted
- Approval rate (% approved vs rejected)
- Time to approval (median, p95)
- Active users per role

### Quality Metrics
- Prompt improvement rate
- Bug reports related to prompts
- User satisfaction with prompts
- Response quality scores

### Performance Metrics
- Page load time < 2s
- API response time < 500ms
- Database query time < 100ms
- Zero downtime deployments

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Regional admin approves bad prompt | High | Medium | Superadmin review before activation |
| Database corruption during rollback | High | Low | Atomic transactions, backups |
| XSS attack via prompt injection | High | Medium | DOMPurify, CSP headers |
| Performance degradation with history | Medium | Medium | Indexing, pagination, caching |
| User confusion with complex UI | Medium | High | Training, tooltips, guided tour |

---

## Cost Estimate

### Development Time
- Phase 1: 3-4 days
- Phase 2: 5-6 days
- Phase 3: 6-7 days
- Phase 4: 5-6 days
- Phase 5: 6-7 days
**Total**: 25-30 days (5-6 weeks)

### Infrastructure Costs
- Database storage: ~5 GB (prompts + history)
- Compute: Existing infrastructure sufficient
- Email notifications: ~$10/month (100-500 emails)

### Maintenance
- Weekly monitoring: 2 hours/week
- Bug fixes: 4 hours/month
- Feature updates: 8 hours/quarter

---

## Next Steps for Approval

### ✅ AWAITING YOUR APPROVAL:

**Phase 1: Read-Only Prompt Viewer**
- [ ] Approve UI mockup
- [ ] Approve API endpoints
- [ ] Approve RBAC permissions
- [ ] Approve acceptance criteria

**Once Phase 1 approved, I will:**
1. Create detailed technical specification
2. Implement Phase 1 components
3. Test with your team
4. Deploy to production
5. Present Phase 2 for approval

---

## Questions for You

1. **Approval Authority**: Should regional admins be able to approve without superadmin review?
2. **Rollout Strategy**: Should we test Phase 1 with a pilot region first?
3. **Notification Preference**: Email only, or also in-app notifications?
4. **A/B Testing**: Is this feature required for MVP, or can it be Phase 6?
5. **Training**: Do you want video tutorials or written guides (or both)?

---

## Conclusion

This comprehensive system will provide:
- ✅ Read-only prompt viewing with version history
- ✅ Modification interface with validation
- ✅ Approval workflow with RBAC
- ✅ Complete audit trail
- ✅ Testing and safe deployment

**Ready for phased approval and implementation.**

**Please review and approve Phase 1 to begin implementation.**

---

*Document Created: 2025-11-04*
*Version: 1.0*
*Author: Claude Code AI Assistant*
*Status: AWAITING APPROVAL*
