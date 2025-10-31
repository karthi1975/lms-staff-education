# Dual Coaching Bot Implementation Plan (With Approval Workflow)

**Project:** Teachers Training System - Dual Coaching Mode Feature with Prompt Approval
**Created:** 2025-10-31
**Updated:** 2025-10-31 (Added Approval Workflow)
**Status:** Planning Complete - Ready for Implementation
**Estimated Timeline:** 4-5 weeks (extended for approval workflow)
**Complexity:** Medium-High

---

## Table of Contents
1. [Overview](#overview)
2. [Key Changes: Approval Workflow](#key-changes-approval-workflow)
3. [Phase 1: Database Schema (Extended)](#phase-1-database-schema--models)
4. [Phase 2: Approval Workflow Service](#phase-2-approval-workflow-service)
5. [Phase 3: Backend Services](#phase-3-backend-services--business-logic)
6. [Phase 4: API Endpoints (Extended)](#phase-4-api-endpoints)
7. [Phase 5: WhatsApp Integration](#phase-5-whatsapp-integration)
8. [Phase 6: Admin Portal UI (Extended)](#phase-6-admin-portal-ui)
9. [Phase 7: Testing & Validation](#phase-7-testing--validation)
10. [Phase 8: Deployment & Monitoring](#phase-8-deployment--monitoring)
11. [Implementation Checklist](#implementation-checklist)
12. [Success Metrics](#success-metrics)

---

## Overview

### Objective
Add dual coaching mode functionality with **Super Admin approval workflow** for all prompt changes:
- **Regular Mode (Direct Coach):** Provides direct answers, explanations, step-by-step solutions
- **Socratic Mode (Discovery Coach):** Uses only guiding questions, encourages self-discovery
- **Approval Workflow:** All prompt changes must be approved by Super Admin before going live

### Key Features
- Per-course mode configuration by admins
- **NEW:** Super Admin approval required for all prompt changes
- **NEW:** Draft, pending, approved, rejected workflow states
- **NEW:** Approval history and audit trail
- **NEW:** Email/notification for approval requests
- Per-user mode preference with persistence
- Easy mode switching via WhatsApp commands
- Mode-specific prompts and behaviors
- Analytics tracking mode effectiveness
- RBAC-protected admin configuration

### Architecture Integration
- Builds on existing RAG pipeline
- Integrates with current RBAC system (Super Admin role)
- Uses existing security measures
- Extends WhatsApp service
- Adds to admin portal
- **NEW:** Approval notification system

---

## Key Changes: Approval Workflow

### Problem Statement
System prompts directly control AI behavior. Allowing admins to change prompts without oversight creates risks:
- Malicious prompt injection
- Poor quality prompts reducing learning effectiveness
- Inconsistent teaching approaches across courses
- No audit trail for prompt changes

### Solution: Super Admin Approval Workflow

**Workflow States:**
1. **Draft** - Admin is editing prompt (not visible to users)
2. **Pending Approval** - Admin submitted for review
3. **Approved** - Super Admin approved (goes live immediately)
4. **Rejected** - Super Admin rejected (with feedback)
5. **Active** - Currently in use by students
6. **Archived** - Replaced by newer approved version

**Key Principles:**
- Only Super Admin role can approve/reject prompts
- Admins can create/edit drafts but cannot publish directly
- Students always use the latest **approved** prompt
- Full audit trail: who created, who approved, when, why
- Rejection includes feedback for improvement
- Approval notifications via email/dashboard

---

## Phase 1: Database Schema & Models

**Timeline:** Week 1, Days 1-3 (extended by 1 day for approval tables)
**Dependencies:** PostgreSQL access, existing RBAC tables

### 1.1 Database Tables

Create migration file: `database/migrations/006_dual_coaching_with_approval.sql`

```sql
-- ============================================
-- Course Bot Configurations (Base Table)
-- Stores active/approved configurations
-- ============================================
CREATE TABLE course_bot_configs (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

  -- Active Regular Mode Configuration (approved)
  regular_prompt TEXT NOT NULL DEFAULT 'You are a helpful teaching assistant...',
  regular_greeting TEXT DEFAULT 'Hello! I''m here to help you learn. Ask me anything!',
  regular_help_text TEXT DEFAULT 'I provide direct answers, explanations, and examples.',
  regular_version INTEGER DEFAULT 1,

  -- Active Socratic Mode Configuration (approved)
  socratic_prompt TEXT NOT NULL DEFAULT 'You are a Socratic teaching assistant...',
  socratic_greeting TEXT DEFAULT 'Hello! Let''s discover the answers together through questions.',
  socratic_help_text TEXT DEFAULT 'I guide you through questions to help you discover answers yourself.',
  socratic_version INTEGER DEFAULT 1,

  -- Mode Settings
  default_mode VARCHAR(20) DEFAULT 'regular' CHECK (default_mode IN ('regular', 'socratic')),
  allow_mode_switching BOOLEAN DEFAULT TRUE,
  switch_cooldown_minutes INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_approved_at TIMESTAMP,
  last_approved_by INTEGER REFERENCES admin_users(id),

  UNIQUE(course_id)
);

-- ============================================
-- Prompt Change Requests (Approval Workflow)
-- All prompt changes go through this workflow
-- ============================================
CREATE TABLE prompt_change_requests (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

  -- Prompt details
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('regular', 'socratic')),
  new_prompt TEXT NOT NULL,
  new_greeting TEXT,
  new_help_text TEXT,

  -- Change metadata
  change_reason TEXT NOT NULL, -- Why is this change needed?
  change_description TEXT, -- What's different?

  -- Workflow state
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'archived')),

  -- Requestor (Admin)
  requested_by INTEGER NOT NULL REFERENCES admin_users(id),
  requested_at TIMESTAMP DEFAULT NOW(),

  -- Approver (Super Admin only)
  reviewed_by INTEGER REFERENCES admin_users(id),
  reviewed_at TIMESTAMP,
  review_notes TEXT, -- Feedback for approval/rejection

  -- Versioning
  version_number INTEGER NOT NULL DEFAULT 1,
  replaces_version INTEGER, -- Which version is this replacing?

  -- Activation
  activated_at TIMESTAMP, -- When it went live

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Prompt Approval History (Audit Trail)
-- Complete history of all prompt approvals/rejections
-- ============================================
CREATE TABLE prompt_approval_history (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES prompt_change_requests(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id),

  -- Action details
  action VARCHAR(20) NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'activated', 'archived')),
  actor_id INTEGER NOT NULL REFERENCES admin_users(id),
  actor_role VARCHAR(20) NOT NULL, -- 'admin', 'super_admin'

  -- Context
  notes TEXT,
  previous_status VARCHAR(20),
  new_status VARCHAR(20),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- ============================================
-- User Bot Preferences
-- Tracks each user's mode selection per course
-- ============================================
CREATE TABLE user_bot_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

  -- Current mode selection
  selected_mode VARCHAR(20) DEFAULT 'regular' CHECK (selected_mode IN ('regular', 'socratic')),

  -- Switch tracking
  mode_switches_count INTEGER DEFAULT 0,
  last_switched_at TIMESTAMP,
  last_switched_from VARCHAR(20),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, course_id)
);

-- ============================================
-- Coaching Sessions
-- Individual chat sessions with mode tracking
-- ============================================
CREATE TABLE coaching_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id),

  -- Mode tracking
  mode_used VARCHAR(20) NOT NULL CHECK (mode_used IN ('regular', 'socratic')),
  prompt_version INTEGER NOT NULL, -- Which version of prompt was used?

  -- Session details
  session_start TIMESTAMP DEFAULT NOW(),
  session_end TIMESTAMP,
  message_count INTEGER DEFAULT 0,

  -- Engagement metrics
  user_satisfaction SMALLINT CHECK (user_satisfaction BETWEEN 1 AND 5),
  mode_switched_during_session BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Mode Analytics
-- Aggregated statistics for mode effectiveness
-- ============================================
CREATE TABLE mode_analytics (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('regular', 'socratic')),

  -- Usage stats
  total_users INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  avg_session_duration_minutes DECIMAL(10,2),

  -- Performance stats
  avg_quiz_score DECIMAL(5,2),
  completion_rate DECIMAL(5,2),
  retention_rate DECIMAL(5,2),
  avg_satisfaction DECIMAL(3,2),

  -- Preference stats
  user_preference_percentage DECIMAL(5,2),
  switch_to_mode_count INTEGER DEFAULT 0,
  switch_from_mode_count INTEGER DEFAULT 0,

  -- Time period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(course_id, mode, period_start, period_end)
);

-- ============================================
-- Indexes for Performance
-- ============================================
CREATE INDEX idx_course_bot_configs_course ON course_bot_configs(course_id);
CREATE INDEX idx_prompt_requests_course ON prompt_change_requests(course_id);
CREATE INDEX idx_prompt_requests_status ON prompt_change_requests(status);
CREATE INDEX idx_prompt_requests_requestor ON prompt_change_requests(requested_by);
CREATE INDEX idx_prompt_requests_reviewer ON prompt_change_requests(reviewed_by);
CREATE INDEX idx_prompt_history_request ON prompt_approval_history(request_id);
CREATE INDEX idx_prompt_history_actor ON prompt_approval_history(actor_id);
CREATE INDEX idx_user_bot_prefs_user_course ON user_bot_preferences(user_id, course_id);
CREATE INDEX idx_user_bot_prefs_mode ON user_bot_preferences(selected_mode);
CREATE INDEX idx_coaching_sessions_user ON coaching_sessions(user_id);
CREATE INDEX idx_coaching_sessions_course ON coaching_sessions(course_id);
CREATE INDEX idx_coaching_sessions_mode ON coaching_sessions(mode_used);
CREATE INDEX idx_coaching_sessions_start ON coaching_sessions(session_start);
CREATE INDEX idx_mode_analytics_course_period ON mode_analytics(course_id, period_start, period_end);

-- ============================================
-- Triggers for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_course_bot_configs_updated_at BEFORE UPDATE ON course_bot_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_requests_updated_at BEFORE UPDATE ON prompt_change_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_bot_preferences_updated_at BEFORE UPDATE ON user_bot_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Views for Convenience
-- ============================================

-- View: Pending approval requests (for Super Admin dashboard)
CREATE VIEW pending_prompt_approvals AS
SELECT
  pcr.id AS request_id,
  pcr.course_id,
  c.title AS course_title,
  pcr.mode,
  pcr.change_reason,
  pcr.requested_by,
  au_req.name AS requested_by_name,
  au_req.email AS requested_by_email,
  pcr.requested_at,
  pcr.status,
  LENGTH(pcr.new_prompt) AS prompt_length,
  pcr.version_number
FROM prompt_change_requests pcr
JOIN courses c ON pcr.course_id = c.id
JOIN admin_users au_req ON pcr.requested_by = au_req.id
WHERE pcr.status = 'pending_approval'
ORDER BY pcr.requested_at ASC;

-- View: Active prompts with version info
CREATE VIEW active_course_prompts AS
SELECT
  cbc.course_id,
  c.title AS course_title,
  cbc.regular_prompt,
  cbc.regular_version,
  cbc.socratic_prompt,
  cbc.socratic_version,
  cbc.default_mode,
  cbc.last_approved_at,
  au.name AS last_approved_by_name
FROM course_bot_configs cbc
JOIN courses c ON cbc.course_id = c.id
LEFT JOIN admin_users au ON cbc.last_approved_by = au.id;

-- ============================================
-- Default Data: Seed existing courses
-- ============================================
INSERT INTO course_bot_configs (course_id, regular_prompt, socratic_prompt, created_at, last_approved_at)
SELECT
  id,
  'You are a helpful teaching assistant for this course. Provide clear, direct answers with examples and explanations. Help students understand concepts quickly.',
  'You are a Socratic teaching assistant. NEVER give direct answers. ONLY ask guiding questions to help students discover answers themselves. Guide through inquiry and critical thinking.',
  NOW(),
  NOW() -- Mark as pre-approved (initial seed data)
FROM courses
WHERE id NOT IN (SELECT course_id FROM course_bot_configs);

-- ============================================
-- Comments for Documentation
-- ============================================
COMMENT ON TABLE course_bot_configs IS 'Stores active/approved bot configurations for both modes';
COMMENT ON TABLE prompt_change_requests IS 'Approval workflow for all prompt changes (draft → pending → approved/rejected)';
COMMENT ON TABLE prompt_approval_history IS 'Complete audit trail of all prompt approval actions';
COMMENT ON TABLE user_bot_preferences IS 'Tracks each user''s selected coaching mode preference';
COMMENT ON TABLE coaching_sessions IS 'Individual chat sessions with mode and version tracking';
COMMENT ON TABLE mode_analytics IS 'Aggregated statistics for measuring mode effectiveness';

COMMENT ON COLUMN prompt_change_requests.status IS 'Workflow state: draft, pending_approval, approved, rejected, archived';
COMMENT ON COLUMN prompt_change_requests.replaces_version IS 'Version number this change will replace if approved';
COMMENT ON COLUMN prompt_approval_history.action IS 'Action taken: submitted, approved, rejected, activated, archived';
```

### 1.2 Tasks

- [ ] Create migration file: `database/migrations/006_dual_coaching_with_approval.sql`
- [ ] Test migration on local PostgreSQL
- [ ] Verify foreign key constraints
- [ ] Test indexes performance
- [ ] Seed default data for existing courses
- [ ] Create views for pending approvals
- [ ] Document approval workflow states
- [ ] Test workflow state transitions

---

## Phase 2: Approval Workflow Service

**Timeline:** Week 1, Days 4-5 (NEW PHASE)
**Dependencies:** Phase 1 complete, RBAC system accessible

### 2.1 Prompt Approval Service

**File:** `services/prompt-approval.service.js`

```javascript
/**
 * Prompt Approval Service
 * Manages approval workflow for system prompt changes
 *
 * Workflow:
 * 1. Admin creates draft request
 * 2. Admin submits for approval (status: pending_approval)
 * 3. Super Admin reviews and approves/rejects
 * 4. If approved: Prompt activates immediately
 * 5. If rejected: Admin receives feedback, can revise
 *
 * Security:
 * - Only Super Admin can approve/reject
 * - Full audit trail maintained
 * - Email notifications on state changes
 */

const postgresService = require('./database/postgres.service');
const notificationService = require('./notification.service');
const logger = require('../utils/logger');

class PromptApprovalService {

  constructor() {
    // Workflow states
    this.STATES = {
      DRAFT: 'draft',
      PENDING: 'pending_approval',
      APPROVED: 'approved',
      REJECTED: 'rejected',
      ARCHIVED: 'archived'
    };

    // Actions for audit trail
    this.ACTIONS = {
      SUBMITTED: 'submitted',
      APPROVED: 'approved',
      REJECTED: 'rejected',
      ACTIVATED: 'activated',
      ARCHIVED: 'archived'
    };
  }

  /**
   * Create new prompt change request (draft state)
   * @param {number} courseId - Course ID
   * @param {string} mode - 'regular' or 'socratic'
   * @param {object} promptData - { new_prompt, new_greeting, new_help_text }
   * @param {string} changeReason - Why this change is needed
   * @param {number} requestedBy - Admin user ID
   * @returns {Promise<object>} Created request
   */
  async createDraftRequest(courseId, mode, promptData, changeReason, requestedBy) {
    try {
      // Validate mode
      if (!['regular', 'socratic'].includes(mode)) {
        throw new Error('Invalid mode. Must be "regular" or "socratic"');
      }

      // Validate change reason
      if (!changeReason || changeReason.trim().length < 20) {
        throw new Error('Change reason must be at least 20 characters');
      }

      // Get current version number for this mode
      const currentConfig = await this.getCurrentConfig(courseId);
      const currentVersion = mode === 'regular'
        ? currentConfig.regular_version
        : currentConfig.socratic_version;
      const newVersion = currentVersion + 1;

      // Insert draft request
      const result = await postgresService.query(`
        INSERT INTO prompt_change_requests (
          course_id, mode, new_prompt, new_greeting, new_help_text,
          change_reason, status, requested_by, version_number, replaces_version
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        courseId,
        mode,
        promptData.new_prompt,
        promptData.new_greeting || null,
        promptData.new_help_text || null,
        changeReason,
        this.STATES.DRAFT,
        requestedBy,
        newVersion,
        currentVersion
      ]);

      logger.info(`Draft prompt request created: ${result.rows[0].id} by admin ${requestedBy}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Create draft request error:', error);
      throw error;
    }
  }

  /**
   * Submit request for Super Admin approval
   * @param {number} requestId - Request ID
   * @param {number} adminId - Admin submitting (must be owner)
   * @returns {Promise<object>} Updated request
   */
  async submitForApproval(requestId, adminId) {
    try {
      // Verify admin owns this request
      const request = await this.getRequestById(requestId);
      if (request.requested_by !== adminId) {
        throw new Error('Only the request creator can submit for approval');
      }

      if (request.status !== this.STATES.DRAFT) {
        throw new Error(`Cannot submit request with status: ${request.status}`);
      }

      // Update status to pending
      const result = await postgresService.query(`
        UPDATE prompt_change_requests
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [this.STATES.PENDING, requestId]);

      // Log to audit trail
      await this.logAuditAction(
        requestId,
        this.ACTIONS.SUBMITTED,
        adminId,
        'admin',
        'Submitted for Super Admin approval',
        this.STATES.DRAFT,
        this.STATES.PENDING
      );

      // Notify Super Admins
      await this.notifySuperAdmins(request.course_id, requestId, 'new_approval_request');

      logger.info(`Request ${requestId} submitted for approval by admin ${adminId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Submit for approval error:', error);
      throw error;
    }
  }

  /**
   * Approve prompt change request (Super Admin only)
   * @param {number} requestId - Request ID
   * @param {number} superAdminId - Super Admin ID
   * @param {string} reviewNotes - Approval notes
   * @returns {Promise<object>} Approved and activated prompt
   */
  async approveRequest(requestId, superAdminId, reviewNotes = '') {
    try {
      // Verify Super Admin role
      await this.verifySuperAdmin(superAdminId);

      // Get request
      const request = await this.getRequestById(requestId);
      if (request.status !== this.STATES.PENDING) {
        throw new Error(`Cannot approve request with status: ${request.status}`);
      }

      // Begin transaction
      await postgresService.query('BEGIN');

      try {
        // 1. Mark request as approved
        await postgresService.query(`
          UPDATE prompt_change_requests
          SET
            status = $1,
            reviewed_by = $2,
            reviewed_at = NOW(),
            review_notes = $3,
            activated_at = NOW(),
            updated_at = NOW()
          WHERE id = $4
        `, [this.STATES.APPROVED, superAdminId, reviewNotes, requestId]);

        // 2. Activate prompt in course_bot_configs
        const updateField = request.mode === 'regular'
          ? 'regular_prompt = $1, regular_greeting = $2, regular_help_text = $3, regular_version = $4'
          : 'socratic_prompt = $1, socratic_greeting = $2, socratic_help_text = $3, socratic_version = $4';

        await postgresService.query(`
          UPDATE course_bot_configs
          SET ${updateField},
              last_approved_at = NOW(),
              last_approved_by = $5,
              updated_at = NOW()
          WHERE course_id = $6
        `, [
          request.new_prompt,
          request.new_greeting,
          request.new_help_text,
          request.version_number,
          superAdminId,
          request.course_id
        ]);

        // 3. Archive old requests for this mode
        await postgresService.query(`
          UPDATE prompt_change_requests
          SET status = $1
          WHERE course_id = $2 AND mode = $3 AND id != $4 AND status IN ($5, $6)
        `, [
          this.STATES.ARCHIVED,
          request.course_id,
          request.mode,
          requestId,
          this.STATES.APPROVED,
          this.STATES.REJECTED
        ]);

        // 4. Log audit actions
        await this.logAuditAction(
          requestId,
          this.ACTIONS.APPROVED,
          superAdminId,
          'super_admin',
          reviewNotes,
          this.STATES.PENDING,
          this.STATES.APPROVED
        );

        await this.logAuditAction(
          requestId,
          this.ACTIONS.ACTIVATED,
          superAdminId,
          'super_admin',
          'Prompt activated for student use',
          this.STATES.APPROVED,
          this.STATES.APPROVED
        );

        await postgresService.query('COMMIT');

        // 5. Notify admin who submitted
        await this.notifyAdmin(request.requested_by, 'prompt_approved', {
          courseId: request.course_id,
          mode: request.mode,
          reviewNotes
        });

        logger.info(`Request ${requestId} approved and activated by Super Admin ${superAdminId}`);

        return await this.getRequestById(requestId);
      } catch (error) {
        await postgresService.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      logger.error('Approve request error:', error);
      throw error;
    }
  }

  /**
   * Reject prompt change request (Super Admin only)
   * @param {number} requestId - Request ID
   * @param {number} superAdminId - Super Admin ID
   * @param {string} reviewNotes - Rejection reason/feedback
   * @returns {Promise<object>} Rejected request
   */
  async rejectRequest(requestId, superAdminId, reviewNotes) {
    try {
      // Verify Super Admin role
      await this.verifySuperAdmin(superAdminId);

      // Validate rejection notes
      if (!reviewNotes || reviewNotes.trim().length < 20) {
        throw new Error('Rejection feedback must be at least 20 characters');
      }

      // Get request
      const request = await this.getRequestById(requestId);
      if (request.status !== this.STATES.PENDING) {
        throw new Error(`Cannot reject request with status: ${request.status}`);
      }

      // Update status to rejected
      const result = await postgresService.query(`
        UPDATE prompt_change_requests
        SET
          status = $1,
          reviewed_by = $2,
          reviewed_at = NOW(),
          review_notes = $3,
          updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `, [this.STATES.REJECTED, superAdminId, reviewNotes, requestId]);

      // Log to audit trail
      await this.logAuditAction(
        requestId,
        this.ACTIONS.REJECTED,
        superAdminId,
        'super_admin',
        reviewNotes,
        this.STATES.PENDING,
        this.STATES.REJECTED
      );

      // Notify admin who submitted
      await this.notifyAdmin(request.requested_by, 'prompt_rejected', {
        courseId: request.course_id,
        mode: request.mode,
        reviewNotes
      });

      logger.info(`Request ${requestId} rejected by Super Admin ${superAdminId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Reject request error:', error);
      throw error;
    }
  }

  /**
   * Get pending approval requests (for Super Admin dashboard)
   * @param {object} filters - Optional filters
   * @returns {Promise<array>} Pending requests
   */
  async getPendingApprovals(filters = {}) {
    try {
      let query = 'SELECT * FROM pending_prompt_approvals WHERE 1=1';
      const params = [];

      if (filters.courseId) {
        params.push(filters.courseId);
        query += ` AND course_id = $${params.length}`;
      }

      if (filters.mode) {
        params.push(filters.mode);
        query += ` AND mode = $${params.length}`;
      }

      query += ' ORDER BY requested_at ASC';

      if (filters.limit) {
        params.push(filters.limit);
        query += ` LIMIT $${params.length}`;
      }

      const result = await postgresService.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Get pending approvals error:', error);
      throw error;
    }
  }

  /**
   * Get request by ID with full details
   * @param {number} requestId - Request ID
   * @returns {Promise<object>} Request details
   */
  async getRequestById(requestId) {
    try {
      const result = await postgresService.query(`
        SELECT
          pcr.*,
          c.title AS course_title,
          au_req.name AS requested_by_name,
          au_req.email AS requested_by_email,
          au_rev.name AS reviewed_by_name,
          au_rev.email AS reviewed_by_email
        FROM prompt_change_requests pcr
        JOIN courses c ON pcr.course_id = c.id
        JOIN admin_users au_req ON pcr.requested_by = au_req.id
        LEFT JOIN admin_users au_rev ON pcr.reviewed_by = au_rev.id
        WHERE pcr.id = $1
      `, [requestId]);

      if (result.rows.length === 0) {
        throw new Error(`Request ${requestId} not found`);
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Get request by ID error:', error);
      throw error;
    }
  }

  /**
   * Get approval history for a request
   * @param {number} requestId - Request ID
   * @returns {Promise<array>} Audit trail
   */
  async getApprovalHistory(requestId) {
    try {
      const result = await postgresService.query(`
        SELECT
          pah.*,
          au.name AS actor_name,
          au.email AS actor_email
        FROM prompt_approval_history pah
        JOIN admin_users au ON pah.actor_id = au.id
        WHERE pah.request_id = $1
        ORDER BY pah.created_at DESC
      `, [requestId]);

      return result.rows;
    } catch (error) {
      logger.error('Get approval history error:', error);
      throw error;
    }
  }

  /**
   * Get current active config for course
   * @param {number} courseId - Course ID
   * @returns {Promise<object>} Current config
   */
  async getCurrentConfig(courseId) {
    try {
      const result = await postgresService.query(
        'SELECT * FROM course_bot_configs WHERE course_id = $1',
        [courseId]
      );

      if (result.rows.length === 0) {
        throw new Error(`No config found for course ${courseId}`);
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Get current config error:', error);
      throw error;
    }
  }

  /**
   * Verify user is Super Admin
   * @param {number} userId - User ID to check
   * @throws {Error} If not Super Admin
   */
  async verifySuperAdmin(userId) {
    try {
      const result = await postgresService.query(`
        SELECT role_id FROM admin_users WHERE id = $1
      `, [userId]);

      if (result.rows.length === 0 || result.rows[0].role_id !== 1) {
        throw new Error('Only Super Admin can perform this action');
      }
    } catch (error) {
      logger.error('Verify Super Admin error:', error);
      throw error;
    }
  }

  /**
   * Log action to audit trail
   * @param {number} requestId - Request ID
   * @param {string} action - Action type
   * @param {number} actorId - Who performed action
   * @param {string} actorRole - Actor's role
   * @param {string} notes - Action notes
   * @param {string} previousStatus - Previous status
   * @param {string} newStatus - New status
   */
  async logAuditAction(requestId, action, actorId, actorRole, notes, previousStatus, newStatus) {
    try {
      await postgresService.query(`
        INSERT INTO prompt_approval_history (
          request_id, course_id, action, actor_id, actor_role,
          notes, previous_status, new_status
        )
        SELECT $1, course_id, $2, $3, $4, $5, $6, $7
        FROM prompt_change_requests
        WHERE id = $1
      `, [requestId, action, actorId, actorRole, notes, previousStatus, newStatus]);
    } catch (error) {
      logger.error('Log audit action error:', error);
      // Don't throw - audit logging failures shouldn't block operations
    }
  }

  /**
   * Notify Super Admins of new approval request
   * @param {number} courseId - Course ID
   * @param {number} requestId - Request ID
   * @param {string} type - Notification type
   */
  async notifySuperAdmins(courseId, requestId, type) {
    try {
      // Get all Super Admins
      const result = await postgresService.query(`
        SELECT id, name, email FROM admin_users WHERE role_id = 1
      `);

      for (const admin of result.rows) {
        await notificationService.sendNotification({
          userId: admin.id,
          type,
          title: 'New Prompt Approval Request',
          message: `A new prompt change request (#${requestId}) is pending your approval for course ${courseId}`,
          link: `/admin/prompt-approvals?request=${requestId}`
        });
      }
    } catch (error) {
      logger.error('Notify Super Admins error:', error);
      // Don't throw - notification failures shouldn't block operations
    }
  }

  /**
   * Notify admin of approval/rejection
   * @param {number} adminId - Admin to notify
   * @param {string} type - 'prompt_approved' or 'prompt_rejected'
   * @param {object} data - Notification data
   */
  async notifyAdmin(adminId, type, data) {
    try {
      const title = type === 'prompt_approved'
        ? '✅ Prompt Approved'
        : '❌ Prompt Rejected';

      const message = type === 'prompt_approved'
        ? `Your prompt change request for ${data.mode} mode has been approved and is now live!`
        : `Your prompt change request for ${data.mode} mode was rejected. Feedback: ${data.reviewNotes}`;

      await notificationService.sendNotification({
        userId: adminId,
        type,
        title,
        message,
        link: `/admin/bot-config?course=${data.courseId}`
      });
    } catch (error) {
      logger.error('Notify admin error:', error);
      // Don't throw - notification failures shouldn't block operations
    }
  }
}

module.exports = new PromptApprovalService();
```

### 2.2 Tasks

- [ ] Create `services/prompt-approval.service.js` (600+ lines)
- [ ] Implement full approval workflow (draft → pending → approved/rejected)
- [ ] Add Super Admin verification checks
- [ ] Implement audit trail logging
- [ ] Add notification triggers
- [ ] Write 15+ unit tests for approval logic
- [ ] Test workflow state transitions
- [ ] Test Super Admin role enforcement

---

## Phase 3: Backend Services & Business Logic

**Timeline:** Week 2, Days 1-3
**Dependencies:** Phase 1 & 2 complete

### 3.1 Coaching Mode Service

**File:** `services/coaching-mode.service.js`

*(Service implementation continues from original plan but now integrates with approval service)*

**Key Changes:**
- Always fetch approved prompts from `course_bot_configs`
- Track prompt version number in sessions
- Add methods to check if prompts are pending approval

```javascript
const promptApprovalService = require('./prompt-approval.service');

// ... (rest of service)

/**
 * Get active prompt for mode (always returns approved version)
 */
async getActivePrompt(courseId, mode) {
  const config = await promptApprovalService.getCurrentConfig(courseId);

  return {
    prompt: mode === 'regular' ? config.regular_prompt : config.socratic_prompt,
    greeting: mode === 'regular' ? config.regular_greeting : config.socratic_greeting,
    helpText: mode === 'regular' ? config.regular_help_text : config.socratic_help_text,
    version: mode === 'regular' ? config.regular_version : config.socratic_version
  };
}

/**
 * Check if there are pending changes for this course/mode
 */
async hasPendingChanges(courseId, mode) {
  const pending = await promptApprovalService.getPendingApprovals({ courseId, mode, limit: 1 });
  return pending.length > 0;
}
```

---

## Phase 4: API Endpoints (Extended)

**Timeline:** Week 2, Days 4-5
**Dependencies:** Phase 3 complete

### 4.1 Approval API Endpoints

**File:** `routes/prompt-approval.routes.js`

```javascript
const express = require('express');
const router = express.Router();
const promptApprovalService = require('../services/prompt-approval.service');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireSuperAdmin, requireAdmin } = require('../middleware/rbac.middleware');

// ============================================
// ADMIN ENDPOINTS (create/submit requests)
// ============================================

/**
 * POST /api/prompt-approval/requests
 * Create new draft prompt change request
 * Auth: Admin only
 */
router.post('/requests', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { courseId, mode, newPrompt, newGreeting, newHelpText, changeReason, changeDescription } = req.body;

    // Validation
    if (!courseId || !mode || !newPrompt || !changeReason) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: courseId, mode, newPrompt, changeReason'
      });
    }

    const request = await promptApprovalService.createDraftRequest(
      courseId,
      mode,
      { new_prompt: newPrompt, new_greeting: newGreeting, new_help_text: newHelpText },
      changeReason,
      req.user.id
    );

    res.json({
      success: true,
      message: 'Draft prompt request created',
      data: request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/prompt-approval/requests/:id/submit
 * Submit draft request for Super Admin approval
 * Auth: Admin (must own request)
 */
router.post('/requests/:id/submit', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);

    const updated = await promptApprovalService.submitForApproval(requestId, req.user.id);

    res.json({
      success: true,
      message: 'Request submitted for Super Admin approval',
      data: updated
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/prompt-approval/requests/my
 * Get all requests created by current admin
 * Auth: Admin only
 */
router.get('/requests/my', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await postgresService.query(`
      SELECT
        pcr.*,
        c.title AS course_title
      FROM prompt_change_requests pcr
      JOIN courses c ON pcr.course_id = c.id
      WHERE pcr.requested_by = $1
      ORDER BY pcr.created_at DESC
    `, [req.user.id]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// SUPER ADMIN ENDPOINTS (approve/reject)
// ============================================

/**
 * GET /api/prompt-approval/pending
 * Get all pending approval requests
 * Auth: Super Admin only
 */
router.get('/pending', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { courseId, mode, limit } = req.query;

    const pending = await promptApprovalService.getPendingApprovals({
      courseId: courseId ? parseInt(courseId) : null,
      mode,
      limit: limit ? parseInt(limit) : null
    });

    res.json({
      success: true,
      count: pending.length,
      data: pending
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/prompt-approval/requests/:id/approve
 * Approve prompt change request (activates immediately)
 * Auth: Super Admin only
 */
router.post('/requests/:id/approve', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { reviewNotes } = req.body;

    const approved = await promptApprovalService.approveRequest(
      requestId,
      req.user.id,
      reviewNotes
    );

    res.json({
      success: true,
      message: 'Prompt approved and activated',
      data: approved
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/prompt-approval/requests/:id/reject
 * Reject prompt change request with feedback
 * Auth: Super Admin only
 */
router.post('/requests/:id/reject', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { reviewNotes } = req.body;

    if (!reviewNotes || reviewNotes.length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Rejection feedback must be at least 20 characters'
      });
    }

    const rejected = await promptApprovalService.rejectRequest(
      requestId,
      req.user.id,
      reviewNotes
    );

    res.json({
      success: true,
      message: 'Prompt rejected',
      data: rejected
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/prompt-approval/requests/:id
 * Get detailed request info with history
 * Auth: Admin (own) or Super Admin (any)
 */
router.get('/requests/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);

    const request = await promptApprovalService.getRequestById(requestId);

    // Check access: Super Admin can see all, regular admin only their own
    if (req.user.role_id !== 1 && request.requested_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const history = await promptApprovalService.getApprovalHistory(requestId);

    res.json({
      success: true,
      data: {
        request,
        history
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/prompt-approval/stats
 * Get approval workflow statistics
 * Auth: Super Admin only
 */
router.get('/stats', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const result = await postgresService.query(`
      SELECT
        status,
        COUNT(*) AS count,
        AVG(EXTRACT(EPOCH FROM (reviewed_at - requested_at)) / 3600) AS avg_review_hours
      FROM prompt_change_requests
      WHERE requested_at > NOW() - INTERVAL '90 days'
      GROUP BY status
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
```

### 4.2 Update Existing Coaching Mode Routes

Add approval status checks to bot config endpoints:

```javascript
// In routes/coaching-mode.routes.js

/**
 * GET /api/coaching-mode/course/:courseId/config
 * Include pending approval status
 */
router.get('/course/:courseId/config', async (req, res) => {
  // ... existing code ...

  // Add pending approval info
  const pendingRegular = await promptApprovalService.getPendingApprovals({
    courseId,
    mode: 'regular',
    limit: 1
  });

  const pendingSocratic = await promptApprovalService.getPendingApprovals({
    courseId,
    mode: 'socratic',
    limit: 1
  });

  res.json({
    success: true,
    data: {
      ...config,
      hasPendingRegular: pendingRegular.length > 0,
      hasPendingSocratic: pendingSocratic.length > 0
    }
  });
});
```

---

## Phase 5: WhatsApp Integration

**Timeline:** Week 3, Days 1-2
**Dependencies:** Phases 1-4 complete

*(No changes to WhatsApp integration - users don't interact with approval workflow)*

Students always use approved prompts. Approval workflow is admin-only.

---

## Phase 6: Admin Portal UI (Extended)

**Timeline:** Week 3, Days 3-5 (extended by 2 days for approval UI)
**Dependencies:** Phases 1-5 complete

### 6.1 Prompt Editor with Approval Workflow

**File:** `public/admin/bot-config.html`

**New Features:**
- **Draft Mode:** Save prompt as draft without submitting
- **Submit Button:** Submit draft for Super Admin approval
- **Pending Indicator:** Show if approval is pending
- **Revision from Rejection:** If rejected, admin can revise and resubmit

**UI Flow for Admin:**
1. Select course and mode (Regular/Socratic)
2. Edit prompt, greeting, help text
3. Save as draft (no approval needed yet)
4. When ready: Submit for approval
5. Wait for Super Admin review
6. If rejected: View feedback, revise, resubmit
7. If approved: Prompt goes live automatically

### 6.2 Approval Dashboard (Super Admin Only)

**File:** `public/admin/prompt-approvals.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Prompt Approval Dashboard - Super Admin</title>
  <link rel="stylesheet" href="css/common.css">
  <style>
    .approval-card {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      background: white;
    }
    .approval-card.pending {
      border-left: 4px solid #ff9800;
    }
    .approval-card.approved {
      border-left: 4px solid #4caf50;
    }
    .approval-card.rejected {
      border-left: 4px solid #f44336;
    }
    .prompt-preview {
      max-height: 150px;
      overflow-y: auto;
      background: #f5f5f5;
      padding: 10px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      white-space: pre-wrap;
    }
    .approval-actions {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }
    .btn-approve {
      background: #4caf50;
      color: white;
    }
    .btn-reject {
      background: #f44336;
      color: white;
    }
    .review-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 1000;
    }
    .review-modal-content {
      background: white;
      max-width: 600px;
      margin: 100px auto;
      padding: 30px;
      border-radius: 8px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 8px;
      text-align: center;
    }
    .stat-value {
      font-size: 32px;
      font-weight: bold;
      margin: 10px 0;
    }
    .stat-label {
      font-size: 14px;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🔐 Prompt Approval Dashboard</h1>
      <p>Review and approve system prompt changes</p>
    </header>

    <!-- Statistics -->
    <div class="stats-grid" id="statsGrid">
      <div class="stat-card">
        <div class="stat-label">Pending Approval</div>
        <div class="stat-value" id="statPending">-</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%);">
        <div class="stat-label">Approved (30 days)</div>
        <div class="stat-value" id="statApproved">-</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #f44336 0%, #e57373 100%);">
        <div class="stat-label">Rejected (30 days)</div>
        <div class="stat-value" id="statRejected">-</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #2196f3 0%, #64b5f6 100%);">
        <div class="stat-label">Avg Review Time</div>
        <div class="stat-value" id="statAvgTime">-</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <select id="filterCourse">
        <option value="">All Courses</option>
      </select>
      <select id="filterMode">
        <option value="">Both Modes</option>
        <option value="regular">Regular Mode</option>
        <option value="socratic">Socratic Mode</option>
      </select>
      <button onclick="loadPendingApprovals()">🔄 Refresh</button>
    </div>

    <!-- Pending Approvals List -->
    <div id="pendingList">
      <h2>⏳ Pending Approvals</h2>
      <div id="pendingCards"></div>
    </div>

    <!-- Recent Reviews -->
    <div id="recentReviews" style="margin-top: 40px;">
      <h2>📋 Recent Reviews (Last 30 Days)</h2>
      <div id="recentCards"></div>
    </div>
  </div>

  <!-- Approval Modal -->
  <div id="approvalModal" class="review-modal">
    <div class="review-modal-content">
      <h2>✅ Approve Prompt</h2>
      <p>Are you sure you want to approve this prompt? It will go live immediately.</p>

      <label>Approval Notes (optional):</label>
      <textarea id="approvalNotes" rows="3" style="width: 100%; margin: 10px 0;"></textarea>

      <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
        <button onclick="closeModal()" class="btn-secondary">Cancel</button>
        <button onclick="confirmApproval()" class="btn-approve">✅ Approve & Activate</button>
      </div>
    </div>
  </div>

  <!-- Rejection Modal -->
  <div id="rejectionModal" class="review-modal">
    <div class="review-modal-content">
      <h2>❌ Reject Prompt</h2>
      <p>Provide detailed feedback for the admin to improve the prompt.</p>

      <label>Rejection Feedback (required, minimum 20 characters):</label>
      <textarea id="rejectionNotes" rows="5" style="width: 100%; margin: 10px 0;" required></textarea>
      <div id="rejectionError" style="color: #f44336; margin-top: 10px;"></div>

      <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
        <button onclick="closeModal()" class="btn-secondary">Cancel</button>
        <button onclick="confirmRejection()" class="btn-reject">❌ Reject</button>
      </div>
    </div>
  </div>

  <script>
    let currentRequestId = null;
    let allPending = [];
    let allRecent = [];

    // Load on page load
    document.addEventListener('DOMContentLoaded', async () => {
      await loadCourses();
      await loadStatistics();
      await loadPendingApprovals();
      await loadRecentReviews();
    });

    async function loadStatistics() {
      try {
        const response = await fetch('/api/prompt-approval/stats', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await response.json();

        if (result.success) {
          const stats = result.data;
          const pending = stats.find(s => s.status === 'pending_approval');
          const approved = stats.find(s => s.status === 'approved');
          const rejected = stats.find(s => s.status === 'rejected');

          document.getElementById('statPending').textContent = pending?.count || 0;
          document.getElementById('statApproved').textContent = approved?.count || 0;
          document.getElementById('statRejected').textContent = rejected?.count || 0;

          const avgHours = approved?.avg_review_hours || 0;
          document.getElementById('statAvgTime').textContent =
            avgHours < 1 ? `${Math.round(avgHours * 60)}m` : `${Math.round(avgHours)}h`;
        }
      } catch (error) {
        console.error('Load statistics error:', error);
      }
    }

    async function loadPendingApprovals() {
      try {
        const courseFilter = document.getElementById('filterCourse').value;
        const modeFilter = document.getElementById('filterMode').value;

        const params = new URLSearchParams();
        if (courseFilter) params.append('courseId', courseFilter);
        if (modeFilter) params.append('mode', modeFilter);

        const response = await fetch(`/api/prompt-approval/pending?${params}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await response.json();

        if (result.success) {
          allPending = result.data;
          renderPendingCards(allPending);
        }
      } catch (error) {
        console.error('Load pending approvals error:', error);
      }
    }

    function renderPendingCards(requests) {
      const container = document.getElementById('pendingCards');

      if (requests.length === 0) {
        container.innerHTML = '<p style="color: #666;">✅ No pending approvals</p>';
        return;
      }

      container.innerHTML = requests.map(req => `
        <div class="approval-card pending">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <h3>${req.mode === 'regular' ? '📚' : '🔍'} ${req.course_title} - ${req.mode.toUpperCase()} Mode</h3>
              <p style="color: #666; font-size: 14px;">
                Requested by: ${req.requested_by_name} (${req.requested_by_email})<br>
                Submitted: ${new Date(req.requested_at).toLocaleString()}<br>
                Version: ${req.version_number}
              </p>
            </div>
            <span style="background: #ff9800; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">
              PENDING
            </span>
          </div>

          <div style="margin: 15px 0;">
            <strong>Change Reason:</strong>
            <p style="margin: 5px 0;">${req.change_reason}</p>
          </div>

          <div style="margin: 15px 0;">
            <strong>New Prompt (${req.prompt_length} characters):</strong>
            <div class="prompt-preview">${escapeHtml(req.new_prompt || 'N/A')}</div>
          </div>

          <div class="approval-actions">
            <button onclick="viewFullRequest(${req.request_id})" class="btn-secondary">
              👁️ View Full Details
            </button>
            <button onclick="openApprovalModal(${req.request_id})" class="btn-approve">
              ✅ Approve
            </button>
            <button onclick="openRejectionModal(${req.request_id})" class="btn-reject">
              ❌ Reject
            </button>
          </div>
        </div>
      `).join('');
    }

    async function viewFullRequest(requestId) {
      try {
        const response = await fetch(`/api/prompt-approval/requests/${requestId}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await response.json();

        if (result.success) {
          // Show full request details in modal (implementation omitted for brevity)
          alert('Full request view: ' + JSON.stringify(result.data, null, 2));
        }
      } catch (error) {
        console.error('View request error:', error);
      }
    }

    function openApprovalModal(requestId) {
      currentRequestId = requestId;
      document.getElementById('approvalNotes').value = '';
      document.getElementById('approvalModal').style.display = 'block';
    }

    function openRejectionModal(requestId) {
      currentRequestId = requestId;
      document.getElementById('rejectionNotes').value = '';
      document.getElementById('rejectionError').textContent = '';
      document.getElementById('rejectionModal').style.display = 'block';
    }

    function closeModal() {
      document.getElementById('approvalModal').style.display = 'none';
      document.getElementById('rejectionModal').style.display = 'none';
      currentRequestId = null;
    }

    async function confirmApproval() {
      if (!currentRequestId) return;

      try {
        const notes = document.getElementById('approvalNotes').value;

        const response = await fetch(`/api/prompt-approval/requests/${currentRequestId}/approve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ reviewNotes: notes })
        });

        const result = await response.json();

        if (result.success) {
          alert('✅ Prompt approved and activated!');
          closeModal();
          await loadStatistics();
          await loadPendingApprovals();
          await loadRecentReviews();
        } else {
          alert('Error: ' + result.message);
        }
      } catch (error) {
        console.error('Approval error:', error);
        alert('Error approving prompt');
      }
    }

    async function confirmRejection() {
      if (!currentRequestId) return;

      const notes = document.getElementById('rejectionNotes').value.trim();

      if (notes.length < 20) {
        document.getElementById('rejectionError').textContent =
          'Feedback must be at least 20 characters to help the admin improve';
        return;
      }

      try {
        const response = await fetch(`/api/prompt-approval/requests/${currentRequestId}/reject`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ reviewNotes: notes })
        });

        const result = await response.json();

        if (result.success) {
          alert('❌ Prompt rejected. Feedback sent to admin.');
          closeModal();
          await loadStatistics();
          await loadPendingApprovals();
          await loadRecentReviews();
        } else {
          alert('Error: ' + result.message);
        }
      } catch (error) {
        console.error('Rejection error:', error);
        alert('Error rejecting prompt');
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Additional helper functions omitted for brevity
  </script>
</body>
</html>
```

### 6.3 Updated Bot Config Editor

Update `public/admin/bot-config.html` to include:

**New UI Elements:**
- "Save Draft" button (no approval needed)
- "Submit for Approval" button (sends to Super Admin)
- Status indicator: "Draft", "Pending Approval", "Approved", "Rejected"
- If rejected: Show rejection feedback and "Revise & Resubmit" button
- Disable editing if approval is pending

---

## Phase 7: Testing & Validation

**Timeline:** Week 4, Days 1-2
**Dependencies:** Phases 1-6 complete

### 7.1 Additional Tests for Approval Workflow

**New Test Files:**
- `tests/unit/prompt-approval.service.test.js` (20+ tests)
- `tests/integration/approval-workflow.test.js` (15+ tests)
- `tests/e2e/prompt-approval-flow.spec.js` (10+ tests)

**Test Scenarios:**
1. **Draft Creation**
   - Admin creates draft
   - Validation errors handled
   - Draft saved successfully

2. **Submission**
   - Admin submits for approval
   - Non-owner cannot submit
   - Pending status set correctly

3. **Super Admin Approval**
   - Super Admin approves prompt
   - Prompt activates immediately
   - Version number incremented
   - Audit trail logged
   - Notification sent

4. **Super Admin Rejection**
   - Super Admin rejects with feedback
   - Feedback validation (min 20 chars)
   - Admin receives notification
   - Admin can revise and resubmit

5. **Role-Based Access**
   - Regular admin cannot approve
   - Regular admin cannot reject
   - Regular admin can only see own requests
   - Super Admin can see all requests

6. **Concurrent Requests**
   - Multiple pending requests for same course/mode
   - Only latest approved version becomes active
   - Old approved requests archived

7. **Audit Trail**
   - All actions logged
   - History queryable
   - IP and user agent captured

---

## Phase 8: Deployment & Monitoring

**Timeline:** Week 4, Days 3-5
**Dependencies:** All phases complete

### 8.1 Deployment Checklist (Updated)

- [ ] **Database Migration**
  - [ ] Backup production database
  - [ ] Run migration on staging first
  - [ ] Test approval workflow on staging
  - [ ] Run migration on production
  - [ ] Verify all tables and indexes created
  - [ ] Seed initial data

- [ ] **Code Deployment**
  - [ ] Deploy approval service
  - [ ] Deploy approval routes
  - [ ] Deploy updated admin UI
  - [ ] Restart application servers

- [ ] **Super Admin Setup**
  - [ ] Verify Super Admin accounts exist (role_id = 1)
  - [ ] Test approval/rejection flows
  - [ ] Configure email notifications

- [ ] **Admin Training**
  - [ ] Document new approval workflow
  - [ ] Train admins on draft/submit process
  - [ ] Train Super Admins on approval dashboard

- [ ] **Monitoring**
  - [ ] Monitor approval queue length
  - [ ] Track average approval time
  - [ ] Alert if approval queue > 10
  - [ ] Alert if approval time > 48 hours

---

## Implementation Checklist (Updated)

### Week 1: Database & Approval Foundation ✅
- [ ] Create migration with 6 tables (added 3 approval tables)
- [ ] Run migration on dev environment
- [ ] Create PromptApprovalService (600+ lines)
- [ ] Create CoachingModeService (500+ lines)
- [ ] Write 25+ unit tests
- [ ] Test approval workflow states
- [ ] Test Super Admin role enforcement

### Week 2: Services & APIs ✅
- [ ] Create prompt-approval.routes.js (400+ lines)
- [ ] Implement admin endpoints (create/submit)
- [ ] Implement Super Admin endpoints (approve/reject)
- [ ] Update existing bot config routes
- [ ] Add approval status checks
- [ ] Test all API endpoints
- [ ] Write API documentation

### Week 3: WhatsApp & UI ✅
- [ ] Update WhatsApp service (no approval changes needed)
- [ ] Create prompt-approvals.html (Super Admin dashboard)
- [ ] Update bot-config.html (draft/submit UI)
- [ ] Add pending indicators
- [ ] Add rejection feedback display
- [ ] Write 20+ integration tests
- [ ] Write 10+ E2E tests

### Week 4: Testing & Deployment ✅
- [ ] Complete security review
- [ ] Test on staging environment
- [ ] Deploy to production
- [ ] Monitor approval metrics
- [ ] Gather Super Admin feedback
- [ ] Train all admins
- [ ] Documentation complete

---

## Success Metrics (Updated)

### After 2 Weeks of Production:

1. **Approval Workflow:**
   - ✅ Average approval time < 24 hours
   - ✅ 100% of prompt changes go through approval
   - ✅ Zero unauthorized prompt activations
   - ✅ Complete audit trail maintained

2. **Quality Control:**
   - ✅ Rejection rate < 30%
   - ✅ Revision-and-approval rate > 70%
   - ✅ Zero malicious prompts activated
   - ✅ Admin satisfaction with feedback quality

3. **System Health:**
   - ✅ Approval queue < 10 pending at all times
   - ✅ No approval workflow errors
   - ✅ Notifications delivered 100%

### After 1 Month:

1. **Effectiveness:**
   - Compare prompt quality before/after approval
   - Measure learning outcomes with approved prompts
   - Survey Super Admin workload

2. **Process Improvement:**
   - Identify common rejection reasons
   - Create prompt quality guidelines
   - Optimize approval turnaround time

---

## Risk Mitigation (Updated)

| Risk | Mitigation Strategy |
|------|---------------------|
| Approval bottleneck | Multiple Super Admins, SLA monitoring, escalation process |
| Malicious prompt injection | Super Admin training, automated checks, audit trail |
| Slow approval times | Email notifications, dashboard alerts, auto-reminders |
| Admin frustration from rejections | Clear guidelines, constructive feedback, revision support |
| Unauthorized approvals | Role verification on every action, audit logging |
| Lost approval requests | Database backups, transaction safety, retry logic |

---

## Timeline Summary

**Original Plan:** 3-4 weeks
**Updated Plan with Approval Workflow:** 4-5 weeks

- **Week 1:** Database + Approval Service (extended by 1 day)
- **Week 2:** Backend Services + APIs (extended by 1 day)
- **Week 3:** WhatsApp + Admin UI (extended by 2 days for approval dashboard)
- **Week 4:** Testing + Deployment (same timeline)
- **Week 5:** Buffer for refinement and admin training

---

## Key Files Summary

**New Files (Approval Workflow):**
1. `database/migrations/006_dual_coaching_with_approval.sql` - Database schema
2. `services/prompt-approval.service.js` - Approval workflow logic
3. `routes/prompt-approval.routes.js` - Approval API endpoints
4. `public/admin/prompt-approvals.html` - Super Admin approval dashboard
5. `tests/unit/prompt-approval.service.test.js` - Unit tests
6. `tests/integration/approval-workflow.test.js` - Integration tests
7. `tests/e2e/prompt-approval-flow.spec.js` - E2E tests

**Modified Files:**
1. `public/admin/bot-config.html` - Add draft/submit UI
2. `routes/coaching-mode.routes.js` - Add approval status checks
3. `services/coaching-mode.service.js` - Integrate with approval service
4. `middleware/rbac.middleware.js` - Add requireSuperAdmin middleware

**Total New Code:**
- ~800 lines SQL
- ~1,200 lines JavaScript (services)
- ~600 lines JavaScript (routes)
- ~800 lines HTML/JavaScript (UI)
- ~600 lines JavaScript (tests)
- **Total: ~4,000 lines of code**

---

## Post-Implementation: Phase 6 Features (Future)

After approval workflow is stable, add these enhancements:

1. **Batch Approvals** - Super Admin approve multiple requests at once
2. **Approval Templates** - Pre-approved prompt templates admins can customize
3. **Auto-Approval** - For minor changes (< 10% diff), optional auto-approve
4. **Collaborative Editing** - Multiple admins can contribute to one draft
5. **A/B Testing** - Compare two approved prompts with student cohorts
6. **Prompt Analytics** - Track which prompts lead to better learning outcomes
7. **Scheduled Activation** - Approve now, activate later (e.g., next semester)

---

## Questions for You

1. **Super Admin Assignment:** Who should be the initial Super Admins?
2. **Approval SLA:** What's an acceptable approval turnaround time? (24h? 48h?)
3. **Rejection Policy:** Should admins get unlimited revision attempts?
4. **Notification Method:** Email, in-app notifications, or both?
5. **Emergency Override:** Should there be an "emergency approval" for critical fixes?
6. **Audit Retention:** How long should approval history be retained?

---

**This updated plan ensures all system prompts are reviewed and approved before going live, maintaining quality control and security while still allowing admins to propose improvements.**

Let me know if you'd like me to start implementing this enhanced version with the approval workflow! 🚀
