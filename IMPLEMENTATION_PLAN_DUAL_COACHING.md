# DUAL COACHING BOT - IMPLEMENTATION EXECUTION PLAN

**Status:** Ready to Start
**Timeline:** 4-5 weeks
**Complexity:** Medium-High
**Priority:** High

---

## 🚀 **PHASE-BY-PHASE IMPLEMENTATION**

### **WEEK 1: Foundation (Database + Approval Service)**

#### **Day 1-2: Database Migration**
- [ ] Create `database/migrations/006_dual_coaching_with_approval.sql`
- [ ] Add 6 tables with proper indexes and constraints
- [ ] Create views: `pending_prompt_approvals`, `active_course_prompts`
- [ ] Test migration on local PostgreSQL
- [ ] Seed default data for existing courses
- [ ] Verify foreign keys and cascades

**Files:** `006_dual_coaching_with_approval.sql`

#### **Day 3-4: Prompt Approval Service**
- [ ] Create `services/prompt-approval.service.js` (600+ lines)
- [ ] Implement workflow methods:
  - `createDraftRequest()` - Admin creates draft
  - `submitForApproval()` - Submit to Super Admin
  - `approveRequest()` - Super Admin approves (activates)
  - `rejectRequest()` - Super Admin rejects (with feedback)
  - `getPendingApprovals()` - Get approval queue
  - `getApprovalHistory()` - Audit trail
- [ ] Add Super Admin verification
- [ ] Implement audit logging
- [ ] Add notification triggers

**Files:** `services/prompt-approval.service.js`

#### **Day 5: Unit Tests**
- [ ] Create `tests/unit/prompt-approval.service.test.js`
- [ ] Test all workflow state transitions
- [ ] Test Super Admin role enforcement
- [ ] Test validation rules (min 20 char feedback, etc.)
- [ ] Test concurrent request handling

**Files:** `tests/unit/prompt-approval.service.test.js`

---

### **WEEK 2: Backend Services + APIs**

#### **Day 1-2: Coaching Mode Service**
- [ ] Create `services/coaching-mode.service.js`
- [ ] Implement mode-specific prompt fetching
- [ ] Add user preference management
- [ ] Add session tracking
- [ ] Integrate with prompt approval service
- [ ] Ensure approved prompts are always used

**Files:** `services/coaching-mode.service.js`

#### **Day 3-4: API Endpoints**
- [ ] Create `routes/prompt-approval.routes.js`
- [ ] Admin endpoints:
  - `POST /api/prompt-approval/requests` - Create draft
  - `POST /api/prompt-approval/requests/:id/submit` - Submit for approval
  - `GET /api/prompt-approval/requests/my` - My requests
- [ ] Super Admin endpoints:
  - `GET /api/prompt-approval/pending` - Pending queue
  - `POST /api/prompt-approval/requests/:id/approve` - Approve
  - `POST /api/prompt-approval/requests/:id/reject` - Reject
  - `GET /api/prompt-approval/requests/:id` - View details
  - `GET /api/prompt-approval/stats` - Approval statistics

**Files:** `routes/prompt-approval.routes.js`

#### **Day 5: API Tests**
- [ ] Create `tests/integration/approval-workflow.test.js`
- [ ] Test full approval workflow (draft → pending → approved)
- [ ] Test rejection workflow with revision
- [ ] Test RBAC enforcement
- [ ] Test concurrent approvals

**Files:** `tests/integration/approval-workflow.test.js`

---

### **WEEK 3: Frontend UI**

#### **Day 1-2: Super Admin Approval Dashboard**
- [ ] Create `public/admin/prompt-approvals.html`
- [ ] Build approval queue UI:
  - Pending requests list
  - Request details modal
  - Approve/Reject buttons
  - Review notes textarea
- [ ] Add statistics dashboard:
  - Pending count
  - Approved count (30 days)
  - Rejected count (30 days)
  - Average review time
- [ ] Add filters (course, mode)
- [ ] Add recent reviews section

**Files:** `public/admin/prompt-approvals.html`

#### **Day 3-4: Bot Config Editor Updates**
- [ ] Update `public/admin/bot-config.html`
- [ ] Add draft/submit workflow UI:
  - "Save Draft" button
  - "Submit for Approval" button
  - Status indicators (Draft, Pending, Approved, Rejected)
  - Rejection feedback display
  - "Revise & Resubmit" button
- [ ] Disable editing when approval pending
- [ ] Add version history view
- [ ] Add prompt comparison view (old vs new)

**Files:** `public/admin/bot-config.html` (update)

#### **Day 5: E2E Tests**
- [ ] Create `tests/e2e/prompt-approval-flow.spec.js`
- [ ] Test complete user flows:
  - Admin creates draft → submits → Super Admin approves
  - Admin creates draft → submits → Super Admin rejects → Admin revises
  - Super Admin bulk approvals
- [ ] Test UI interactions (Playwright)

**Files:** `tests/e2e/prompt-approval-flow.spec.js`

---

### **WEEK 4: Integration + WhatsApp**

#### **Day 1-2: WhatsApp Integration**
- [ ] Update `services/whatsapp-handler.service.js`
- [ ] Add mode selection commands:
  - `/regular` - Switch to regular mode
  - `/socratic` - Switch to Socratic mode
  - `/mode` - Show current mode
- [ ] Fetch approved prompts only
- [ ] Track prompt version in sessions
- [ ] Add mode-specific response formatting

**Files:** `services/whatsapp-handler.service.js` (update)

#### **Day 3: Notification System**
- [ ] Create `services/notification.service.js` (if doesn't exist)
- [ ] Add email notifications:
  - Super Admin: "New approval request pending"
  - Admin: "Your prompt was approved"
  - Admin: "Your prompt was rejected - feedback provided"
- [ ] Add in-app notifications
- [ ] Test notification delivery

**Files:** `services/notification.service.js`

#### **Day 4-5: System Integration Testing**
- [ ] Test full end-to-end flow:
  - Admin creates prompt → Super Admin approves → Student uses it
- [ ] Test both modes (Regular & Socratic)
- [ ] Test mode switching
- [ ] Test prompt versioning
- [ ] Test audit trail completeness
- [ ] Performance testing (approval workflow latency)

---

### **WEEK 5: Deployment + Monitoring**

#### **Day 1: Staging Deployment**
- [ ] Deploy to staging environment
- [ ] Run all migrations
- [ ] Smoke test approval workflow
- [ ] Test with real Super Admin account
- [ ] Verify notifications work
- [ ] Load test approval API endpoints

#### **Day 2: Production Deployment**
- [ ] Backup production database
- [ ] Deploy database migration
- [ ] Deploy services and routes
- [ ] Deploy admin UI updates
- [ ] Verify Super Admin accounts (role_id = 1)
- [ ] Create initial bot configs for all courses
- [ ] Smoke test on production

#### **Day 3: Admin Training**
- [ ] Train admins on draft/submit workflow
- [ ] Train Super Admins on approval dashboard
- [ ] Provide documentation:
  - How to create effective prompts
  - How to submit for approval
  - How to revise after rejection
- [ ] Create prompt quality guidelines

#### **Day 4-5: Monitoring + Refinement**
- [ ] Monitor approval queue length
- [ ] Track average approval time
- [ ] Set up alerts:
  - Approval queue > 10 → Alert Super Admin
  - Approval time > 48 hours → Escalate
- [ ] Gather feedback from admins
- [ ] Optimize approval workflow based on feedback

---

## 📊 **SUCCESS METRICS**

### **Week 1 (After Deployment):**
- ✅ 100% of prompt changes go through approval
- ✅ Zero unauthorized prompt activations
- ✅ Complete audit trail for all changes
- ✅ Average approval time < 24 hours

### **Week 2:**
- ✅ Rejection rate < 30%
- ✅ Revision-and-approval rate > 70%
- ✅ Admin satisfaction with feedback quality
- ✅ Approval queue < 10 pending at all times

### **Month 1:**
- ✅ Compare prompt quality before/after approval
- ✅ Measure learning outcomes with approved prompts
- ✅ Survey Super Admin workload
- ✅ Identify common rejection reasons
- ✅ Create prompt quality guidelines

---

## 🛠️ **TECHNICAL CHECKLIST**

### **Database:**
- [ ] 6 tables created with proper indexes
- [ ] Views created for pending approvals
- [ ] Triggers for updated_at columns
- [ ] Foreign keys enforce cascades
- [ ] Default data seeded

### **Services:**
- [ ] PromptApprovalService (600+ lines)
  - [ ] createDraftRequest()
  - [ ] submitForApproval()
  - [ ] approveRequest()
  - [ ] rejectRequest()
  - [ ] getPendingApprovals()
  - [ ] getApprovalHistory()
  - [ ] verifySuperAdmin()
  - [ ] logAuditAction()
  - [ ] notifySuperAdmins()
  - [ ] notifyAdmin()
- [ ] CoachingModeService (500+ lines)
  - [ ] getActivePrompt()
  - [ ] switchMode()
  - [ ] getUserPreference()
  - [ ] trackSession()
  - [ ] hasPendingChanges()

### **API Endpoints:**
- [ ] POST /api/prompt-approval/requests
- [ ] POST /api/prompt-approval/requests/:id/submit
- [ ] GET /api/prompt-approval/requests/my
- [ ] GET /api/prompt-approval/pending (Super Admin)
- [ ] POST /api/prompt-approval/requests/:id/approve (Super Admin)
- [ ] POST /api/prompt-approval/requests/:id/reject (Super Admin)
- [ ] GET /api/prompt-approval/requests/:id
- [ ] GET /api/prompt-approval/stats (Super Admin)

### **Admin UI:**
- [ ] prompt-approvals.html (Super Admin dashboard)
  - [ ] Pending approval cards
  - [ ] Approve/Reject modals
  - [ ] Statistics dashboard
  - [ ] Filters (course, mode)
  - [ ] Recent reviews section
- [ ] bot-config.html (updated)
  - [ ] Draft mode
  - [ ] Submit for approval
  - [ ] Status indicators
  - [ ] Rejection feedback display
  - [ ] Revision UI

### **WhatsApp Integration:**
- [ ] Mode selection commands
- [ ] Approved prompts fetching
- [ ] Session tracking with prompt version
- [ ] Mode-specific response formatting

### **Testing:**
- [ ] 20+ unit tests (PromptApprovalService)
- [ ] 15+ integration tests (approval workflow)
- [ ] 10+ E2E tests (UI flows)
- [ ] Performance tests (approval latency)

### **Deployment:**
- [ ] Migration tested on staging
- [ ] Code deployed to production
- [ ] Super Admin accounts verified
- [ ] Notifications configured
- [ ] Monitoring alerts set up
- [ ] Admin training completed
- [ ] Documentation published

---

## 🚨 **RISK MITIGATION**

| Risk | Impact | Mitigation |
|------|--------|------------|
| Approval bottleneck | High | Multiple Super Admins, SLA monitoring, auto-reminders |
| Malicious prompt injection | Critical | Super Admin training, audit trail, automated checks |
| Slow approval times | Medium | Email notifications, dashboard alerts, escalation |
| Admin frustration from rejections | Medium | Clear guidelines, constructive feedback, revision support |
| Unauthorized approvals | Critical | Role verification on every action, audit logging |
| Lost approval requests | High | Database backups, transaction safety, retry logic |
| Poor prompt quality | Medium | Quality guidelines, examples, approval feedback |

---

## 📝 **QUESTIONS TO ANSWER BEFORE STARTING**

1. **Super Admin Assignment:** Who are the initial Super Admins?
   - Need at least 2-3 Super Admins for coverage
   - Should be experienced educators/managers

2. **Approval SLA:** What's acceptable turnaround time?
   - Recommended: 24 hours for normal requests
   - Emergency: 2 hours for critical fixes?

3. **Rejection Policy:** Unlimited revision attempts?
   - Recommended: Yes, with quality feedback

4. **Notification Method:** Email, in-app, or both?
   - Recommended: Both for redundancy

5. **Emergency Override:** Allow emergency approval bypass?
   - Recommended: No - maintain security
   - Alternative: Fast-track process for emergencies

6. **Audit Retention:** How long to keep approval history?
   - Recommended: Indefinitely for compliance

---

## 📅 **TIMELINE SUMMARY**

**Total Duration:** 4-5 weeks
**Team Size:** 1-2 developers
**Effort:** ~160-200 hours

- **Week 1:** Foundation (Database + Approval Service)
- **Week 2:** Backend (APIs + Services)
- **Week 3:** Frontend (UI + UX)
- **Week 4:** Integration (WhatsApp + Notifications)
- **Week 5:** Deployment + Training

---

## 🎯 **NEXT STEPS**

Ready to start implementation? Here's the recommended approach:

1. **Review Plan** - Go through this implementation plan with team
2. **Answer Questions** - Decide on Super Admins, SLA, notification method
3. **Setup Environment** - Prepare local dev environment
4. **Create Branch** - `git checkout -b feature/dual-coaching-bot`
5. **Start Week 1** - Begin with database migration
6. **Daily Standups** - Track progress against this plan
7. **Weekly Reviews** - Adjust timeline as needed

---

**Let me know when you're ready to begin, and I'll start with Phase 1: Database Migration!** 🚀
