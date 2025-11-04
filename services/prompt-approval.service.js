/**
 * Prompt Approval Service
 * Manages the approval workflow for coaching bot prompt changes
 * Implements draft → pending → approved/rejected workflow with audit trail
 * Phase 2 of Dual Coaching Bot Feature
 */

const logger = require('../utils/logger');

class PromptApprovalService {
  constructor(postgresService) {
    this.postgresService = postgresService;

    // Workflow statuses
    this.STATUS = {
      DRAFT: 'draft',
      PENDING: 'pending_approval',
      APPROVED: 'approved',
      REJECTED: 'rejected'
    };

    // Coaching modes
    this.MODES = {
      REGULAR: 'regular',
      SOCRATIC: 'socratic'
    };

    // Validation constants
    this.MIN_PROMPT_LENGTH = 50;
    this.MAX_PROMPT_LENGTH = 5000;
    this.MIN_REASON_LENGTH = 20;
    this.MIN_FEEDBACK_LENGTH = 20;
  }

  /**
   * Verify user is Super Admin (role_id = 1)
   * @param {number} adminId - Admin user ID
   * @returns {Promise<boolean>} - True if Super Admin
   */
  async verifySuperAdmin(adminId) {
    try {
      const result = await this.postgresService.query(
        'SELECT role_id FROM admin_users WHERE id = $1 AND is_active = true',
        [adminId]
      );

      if (result.rows.length === 0) {
        logger.warn(`Admin user ${adminId} not found or inactive`);
        return false;
      }

      const isSuperAdmin = result.rows[0].role_id === 1;
      logger.debug(`Admin ${adminId} Super Admin check: ${isSuperAdmin}`);
      return isSuperAdmin;
    } catch (error) {
      logger.error('Error verifying Super Admin:', error);
      return false;
    }
  }

  /**
   * Validate prompt content
   * @param {string} prompt - Prompt text
   * @param {string} mode - Coaching mode
   * @returns {{valid: boolean, error?: string}}
   */
  validatePrompt(prompt, mode) {
    if (!prompt || typeof prompt !== 'string') {
      return { valid: false, error: 'Prompt is required and must be a string' };
    }

    const trimmed = prompt.trim();

    if (trimmed.length < this.MIN_PROMPT_LENGTH) {
      return {
        valid: false,
        error: `Prompt must be at least ${this.MIN_PROMPT_LENGTH} characters`
      };
    }

    if (trimmed.length > this.MAX_PROMPT_LENGTH) {
      return {
        valid: false,
        error: `Prompt must not exceed ${this.MAX_PROMPT_LENGTH} characters`
      };
    }

    if (!Object.values(this.MODES).includes(mode)) {
      return {
        valid: false,
        error: `Invalid mode. Must be one of: ${Object.values(this.MODES).join(', ')}`
      };
    }

    return { valid: true };
  }

  /**
   * Create draft prompt change request
   * @param {object} params - Request parameters
   * @param {number} params.courseId - Course ID
   * @param {string} params.mode - Coaching mode (regular/socratic)
   * @param {string} params.newPrompt - New prompt text
   * @param {string} params.changeReason - Reason for change
   * @param {string} params.changeDescription - Detailed description
   * @param {number} params.requestedBy - Admin user ID
   * @returns {Promise<object>} - Created request
   */
  async createDraftRequest({ courseId, mode, newPrompt, changeReason, changeDescription, requestedBy }) {
    try {
      // Validate inputs
      const promptValidation = this.validatePrompt(newPrompt, mode);
      if (!promptValidation.valid) {
        throw new Error(promptValidation.error);
      }

      if (!changeReason || changeReason.trim().length < this.MIN_REASON_LENGTH) {
        throw new Error(`Change reason must be at least ${this.MIN_REASON_LENGTH} characters`);
      }

      // Verify course exists
      const courseCheck = await this.postgresService.query(
        'SELECT id, title FROM courses WHERE id = $1',
        [courseId]
      );

      if (courseCheck.rows.length === 0) {
        throw new Error(`Course ${courseId} not found`);
      }

      // Get current prompt version from course_bot_configs
      const currentPromptResult = await this.postgresService.query(
        `SELECT ${mode}_version as current_version
         FROM course_bot_configs WHERE course_id = $1`,
        [courseId]
      );

      const currentVersion = currentPromptResult.rows.length > 0
        ? currentPromptResult.rows[0].current_version
        : 0;

      // Create draft request (matching actual schema)
      const result = await this.postgresService.query(
        `INSERT INTO prompt_change_requests (
          course_id, mode, new_prompt, change_reason, change_description,
          requested_by, status, version_number, replaces_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          courseId, mode, newPrompt, changeReason, changeDescription || '',
          requestedBy, this.STATUS.DRAFT, currentVersion + 1, currentVersion
        ]
      );

      const request = result.rows[0];

      logger.info(`Draft request created: ${request.id} (course: ${courseId}, mode: ${mode})`);

      return {
        success: true,
        request: this.formatRequest(request),
        message: 'Draft prompt change request created successfully'
      };
    } catch (error) {
      logger.error('Error creating draft request:', error);
      throw error;
    }
  }

  /**
   * Submit draft request for Super Admin approval
   * @param {number} requestId - Request ID
   * @param {number} adminId - Admin user ID (must be request creator)
   * @returns {Promise<object>} - Updated request
   */
  async submitForApproval(requestId, adminId) {
    try {
      // Get current request
      const requestResult = await this.postgresService.query(
        'SELECT * FROM prompt_change_requests WHERE id = $1',
        [requestId]
      );

      if (requestResult.rows.length === 0) {
        throw new Error(`Request ${requestId} not found`);
      }

      const request = requestResult.rows[0];

      // Verify requester is the creator
      if (request.requested_by !== adminId) {
        throw new Error('Only the request creator can submit for approval');
      }

      // Verify status is draft
      if (request.status !== this.STATUS.DRAFT) {
        throw new Error(`Cannot submit request with status: ${request.status}`);
      }

      // Update status to pending (no submitted_at column, using requested_at)
      const updateResult = await this.postgresService.query(
        `UPDATE prompt_change_requests
         SET status = $1
         WHERE id = $2
         RETURNING *`,
        [this.STATUS.PENDING, requestId]
      );

      const updatedRequest = updateResult.rows[0];

      // Log submission to approval history
      await this.postgresService.query(
        `INSERT INTO prompt_approval_history (
          request_id, course_id, action, actor_id, actor_role,
          notes, previous_status, new_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          requestId, request.course_id, 'submitted', adminId, 'admin',
          'Request submitted for Super Admin approval',
          this.STATUS.DRAFT, this.STATUS.PENDING
        ]
      );

      // Notify Super Admins
      await this.notifySuperAdmins(updatedRequest);

      logger.info(`Request ${requestId} submitted for approval`);

      return {
        success: true,
        request: this.formatRequest(updatedRequest),
        message: 'Request submitted for approval successfully'
      };
    } catch (error) {
      logger.error('Error submitting request for approval:', error);
      throw error;
    }
  }

  /**
   * Approve prompt change request (Super Admin only)
   * @param {object} params - Approval parameters
   * @param {number} params.requestId - Request ID
   * @param {number} params.superAdminId - Super Admin user ID
   * @param {string} params.reviewNotes - Optional review notes
   * @returns {Promise<object>} - Approved request
   */
  async approveRequest({ requestId, superAdminId, reviewNotes = '' }) {
    try {
      // Verify Super Admin
      const isSuperAdmin = await this.verifySuperAdmin(superAdminId);
      if (!isSuperAdmin) {
        throw new Error('Only Super Admins can approve prompt changes');
      }

      // Get current request
      const requestResult = await this.postgresService.query(
        'SELECT * FROM prompt_change_requests WHERE id = $1',
        [requestId]
      );

      if (requestResult.rows.length === 0) {
        throw new Error(`Request ${requestId} not found`);
      }

      const request = requestResult.rows[0];

      // Verify status is pending
      if (request.status !== this.STATUS.PENDING) {
        throw new Error(`Cannot approve request with status: ${request.status}`);
      }

      // Begin transaction - approve request and activate prompt
      await this.postgresService.query('BEGIN');

      try {
        const newVersion = request.version_number;

        // Update request status to approved
        await this.postgresService.query(
          `UPDATE prompt_change_requests
           SET status = $1, reviewed_by = $2, reviewed_at = NOW(),
               review_notes = $3, activated_at = NOW(), updated_at = NOW()
           WHERE id = $4`,
          [this.STATUS.APPROVED, superAdminId, reviewNotes, requestId]
        );

        // Update course_bot_configs with new approved prompt
        const modeColumn = request.mode === this.MODES.REGULAR ? 'regular' : 'socratic';

        await this.postgresService.query(
          `UPDATE course_bot_configs
           SET ${modeColumn}_prompt = $1,
               ${modeColumn}_version = $2,
               last_approved_at = NOW(),
               last_approved_by = $3,
               updated_at = NOW()
           WHERE course_id = $4`,
          [request.new_prompt, newVersion, superAdminId, request.course_id]
        );

        // Log to approval history (matching actual schema)
        await this.postgresService.query(
          `INSERT INTO prompt_approval_history (
            request_id, course_id, action, actor_id, actor_role,
            notes, previous_status, new_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            requestId, request.course_id, 'approved', superAdminId, 'super_admin',
            reviewNotes || `Approved version ${newVersion}`,
            this.STATUS.PENDING, this.STATUS.APPROVED
          ]
        );

        // Log activation to history
        await this.postgresService.query(
          `INSERT INTO prompt_approval_history (
            request_id, course_id, action, actor_id, actor_role,
            notes, previous_status, new_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            requestId, request.course_id, 'activated', superAdminId, 'super_admin',
            `Activated ${request.mode} prompt version ${newVersion}`,
            this.STATUS.APPROVED, this.STATUS.APPROVED
          ]
        );

        await this.postgresService.query('COMMIT');

        // Notify the requesting admin
        await this.notifyAdmin({
          adminId: request.requested_by,
          action: 'approved',
          requestId: requestId,
          reviewNotes: reviewNotes
        });

        logger.info(`Request ${requestId} approved by Super Admin ${superAdminId}`);

        return {
          success: true,
          message: 'Prompt change approved and activated successfully',
          newVersion: newVersion
        };
      } catch (error) {
        await this.postgresService.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      logger.error('Error approving request:', error);
      throw error;
    }
  }

  /**
   * Reject prompt change request (Super Admin only)
   * @param {object} params - Rejection parameters
   * @param {number} params.requestId - Request ID
   * @param {number} params.superAdminId - Super Admin user ID
   * @param {string} params.rejectionFeedback - Detailed feedback (required)
   * @returns {Promise<object>} - Rejected request
   */
  async rejectRequest({ requestId, superAdminId, rejectionFeedback }) {
    try {
      // Verify Super Admin
      const isSuperAdmin = await this.verifySuperAdmin(superAdminId);
      if (!isSuperAdmin) {
        throw new Error('Only Super Admins can reject prompt changes');
      }

      // Validate feedback
      if (!rejectionFeedback || rejectionFeedback.trim().length < this.MIN_FEEDBACK_LENGTH) {
        throw new Error(`Rejection feedback must be at least ${this.MIN_FEEDBACK_LENGTH} characters`);
      }

      // Get current request
      const requestResult = await this.postgresService.query(
        'SELECT * FROM prompt_change_requests WHERE id = $1',
        [requestId]
      );

      if (requestResult.rows.length === 0) {
        throw new Error(`Request ${requestId} not found`);
      }

      const request = requestResult.rows[0];

      // Verify status is pending
      if (request.status !== this.STATUS.PENDING) {
        throw new Error(`Cannot reject request with status: ${request.status}`);
      }

      // Update request status to rejected
      const updateResult = await this.postgresService.query(
        `UPDATE prompt_change_requests
         SET status = $1, reviewed_by = $2, reviewed_at = NOW(),
             review_notes = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [this.STATUS.REJECTED, superAdminId, rejectionFeedback, requestId]
      );

      const rejectedRequest = updateResult.rows[0];

      // Log to approval history (matching actual schema)
      await this.postgresService.query(
        `INSERT INTO prompt_approval_history (
          request_id, course_id, action, actor_id, actor_role,
          notes, previous_status, new_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          requestId, request.course_id, 'rejected', superAdminId, 'super_admin',
          rejectionFeedback, this.STATUS.PENDING, this.STATUS.REJECTED
        ]
      );

      // Notify the requesting admin
      await this.notifyAdmin({
        adminId: request.requested_by,
        action: 'rejected',
        requestId: requestId,
        reviewNotes: rejectionFeedback
      });

      logger.info(`Request ${requestId} rejected by Super Admin ${superAdminId}`);

      return {
        success: true,
        request: this.formatRequest(rejectedRequest),
        message: 'Prompt change rejected. Admin has been notified.'
      };
    } catch (error) {
      logger.error('Error rejecting request:', error);
      throw error;
    }
  }

  /**
   * Get pending approval requests (Super Admin only)
   * @param {number} superAdminId - Super Admin user ID
   * @param {object} filters - Optional filters
   * @returns {Promise<object>} - Pending requests
   */
  async getPendingApprovals(superAdminId, filters = {}) {
    try {
      // Verify Super Admin
      const isSuperAdmin = await this.verifySuperAdmin(superAdminId);
      if (!isSuperAdmin) {
        throw new Error('Only Super Admins can view pending approvals');
      }

      let query = `
        SELECT
          pcr.*,
          c.title as course_title,
          c.code as course_code,
          au.name as requester_name,
          au.email as requester_email,
          EXTRACT(EPOCH FROM (NOW() - pcr.requested_at))/3600 as hours_pending
        FROM prompt_change_requests pcr
        JOIN courses c ON pcr.course_id = c.id
        JOIN admin_users au ON pcr.requested_by = au.id
        WHERE pcr.status = $1
      `;

      const params = [this.STATUS.PENDING];

      // Add filters
      if (filters.courseId) {
        params.push(filters.courseId);
        query += ` AND pcr.course_id = $${params.length}`;
      }

      if (filters.mode) {
        params.push(filters.mode);
        query += ` AND pcr.mode = $${params.length}`;
      }

      query += ' ORDER BY pcr.requested_at ASC';

      const result = await this.postgresService.query(query, params);

      const requests = result.rows.map(row => ({
        ...this.formatRequest(row),
        courseTitle: row.course_title,
        courseCode: row.course_code,
        requesterName: row.requester_name,
        requesterEmail: row.requester_email,
        hoursPending: parseFloat(row.hours_pending).toFixed(1)
      }));

      logger.info(`Retrieved ${requests.length} pending approvals for Super Admin ${superAdminId}`);

      return {
        success: true,
        count: requests.length,
        requests: requests
      };
    } catch (error) {
      logger.error('Error getting pending approvals:', error);
      throw error;
    }
  }

  /**
   * Get approval history for a course
   * @param {number} courseId - Course ID
   * @param {object} options - Query options
   * @returns {Promise<object>} - Approval history
   */
  async getApprovalHistory(courseId, options = {}) {
    try {
      const limit = options.limit || 50;
      const offset = options.offset || 0;

      const query = `
        SELECT
          pah.*,
          au.name as actor_name,
          au.email as actor_email
        FROM prompt_approval_history pah
        JOIN admin_users au ON pah.actor_id = au.id
        WHERE pah.course_id = $1
        ORDER BY pah.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await this.postgresService.query(query, [courseId, limit, offset]);

      const history = result.rows.map(row => ({
        id: row.id,
        requestId: row.request_id,
        action: row.action,
        actor: {
          id: row.actor_id,
          name: row.actor_name,
          email: row.actor_email,
          role: row.actor_role
        },
        notes: row.notes,
        previousStatus: row.previous_status,
        newStatus: row.new_status,
        createdAt: row.created_at
      }));

      logger.info(`Retrieved ${history.length} approval history records for course ${courseId}`);

      return {
        success: true,
        courseId: courseId,
        count: history.length,
        history: history
      };
    } catch (error) {
      logger.error('Error getting approval history:', error);
      throw error;
    }
  }

  /**
   * Get admin's own prompt change requests
   * @param {number} adminId - Admin user ID
   * @param {object} filters - Optional filters
   * @returns {Promise<object>} - Admin's requests
   */
  async getMyRequests(adminId, filters = {}) {
    try {
      let query = `
        SELECT
          pcr.*,
          c.title as course_title,
          c.code as course_code,
          reviewer.name as reviewer_name,
          reviewer.email as reviewer_email
        FROM prompt_change_requests pcr
        JOIN courses c ON pcr.course_id = c.id
        LEFT JOIN admin_users reviewer ON pcr.reviewed_by = reviewer.id
        WHERE pcr.requested_by = $1
      `;

      const params = [adminId];

      // Add filters
      if (filters.status) {
        params.push(filters.status);
        query += ` AND pcr.status = $${params.length}`;
      }

      if (filters.courseId) {
        params.push(filters.courseId);
        query += ` AND pcr.course_id = $${params.length}`;
      }

      query += ' ORDER BY pcr.created_at DESC';

      const result = await this.postgresService.query(query, params);

      const requests = result.rows.map(row => ({
        ...this.formatRequest(row),
        courseTitle: row.course_title,
        courseCode: row.course_code,
        reviewerName: row.reviewer_name,
        reviewerEmail: row.reviewer_email
      }));

      logger.info(`Retrieved ${requests.length} requests for admin ${adminId}`);

      return {
        success: true,
        count: requests.length,
        requests: requests
      };
    } catch (error) {
      logger.error('Error getting admin requests:', error);
      throw error;
    }
  }

  /**
   * Get approval statistics
   * @param {number} days - Number of days to look back (default 30)
   * @returns {Promise<object>} - Statistics
   */
  async getApprovalStats(days = 30) {
    try {
      const query = `
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending_approval') as pending_count,
          COUNT(*) FILTER (WHERE status = 'approved' AND reviewed_at >= NOW() - INTERVAL '${days} days') as approved_count,
          COUNT(*) FILTER (WHERE status = 'rejected' AND reviewed_at >= NOW() - INTERVAL '${days} days') as rejected_count,
          AVG(EXTRACT(EPOCH FROM (reviewed_at - requested_at))/3600) FILTER (WHERE status IN ('approved', 'rejected') AND reviewed_at IS NOT NULL) as avg_review_hours
        FROM prompt_change_requests
      `;

      const result = await this.postgresService.query(query);
      const stats = result.rows[0];

      return {
        success: true,
        period: `Last ${days} days`,
        stats: {
          pending: parseInt(stats.pending_count) || 0,
          approved: parseInt(stats.approved_count) || 0,
          rejected: parseInt(stats.rejected_count) || 0,
          averageReviewHours: stats.avg_review_hours ? parseFloat(stats.avg_review_hours).toFixed(1) : 0
        }
      };
    } catch (error) {
      logger.error('Error getting approval stats:', error);
      throw error;
    }
  }

  /**
   * Notify Super Admins of new approval request
   * @param {object} request - Request object
   * @returns {Promise<void>}
   */
  async notifySuperAdmins(request) {
    try {
      // Get all Super Admins
      const result = await this.postgresService.query(
        'SELECT id, email, name FROM admin_users WHERE role_id = 1 AND is_active = true'
      );

      const superAdmins = result.rows;

      logger.info(`Notifying ${superAdmins.length} Super Admins of request ${request.id}`);

      // TODO: Implement actual notification (email, in-app, etc.)
      // For now, just log
      for (const admin of superAdmins) {
        logger.info(`[NOTIFICATION] Super Admin ${admin.name} (${admin.email}): New prompt approval request #${request.id}`);
      }
    } catch (error) {
      logger.error('Error notifying Super Admins:', error);
      // Don't throw - notification failure shouldn't break main flow
    }
  }

  /**
   * Notify admin of approval/rejection
   * @param {object} params - Notification parameters
   * @returns {Promise<void>}
   */
  async notifyAdmin({ adminId, action, requestId, reviewNotes }) {
    try {
      const adminResult = await this.postgresService.query(
        'SELECT email, name FROM admin_users WHERE id = $1',
        [adminId]
      );

      if (adminResult.rows.length === 0) {
        logger.warn(`Cannot notify admin ${adminId}: not found`);
        return;
      }

      const admin = adminResult.rows[0];

      logger.info(`[NOTIFICATION] Admin ${admin.name} (${admin.email}): Request #${requestId} ${action}`);
      if (reviewNotes) {
        logger.info(`[NOTIFICATION] Review notes: ${reviewNotes}`);
      }

      // TODO: Implement actual notification (email, in-app, etc.)
    } catch (error) {
      logger.error('Error notifying admin:', error);
      // Don't throw - notification failure shouldn't break main flow
    }
  }

  /**
   * Format request object for API response
   * @param {object} row - Database row
   * @returns {object} - Formatted request
   */
  formatRequest(row) {
    return {
      id: row.id,
      courseId: row.course_id,
      mode: row.mode,
      newPrompt: row.new_prompt,
      newGreeting: row.new_greeting,
      newHelpText: row.new_help_text,
      versionNumber: row.version_number,
      replacesVersion: row.replaces_version,
      changeReason: row.change_reason,
      changeDescription: row.change_description,
      requestedBy: row.requested_by,
      status: row.status,
      requestedAt: row.requested_at,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      reviewNotes: row.review_notes,
      activatedAt: row.activated_at,
      createdAt: row.created_at
    };
  }
}

module.exports = PromptApprovalService;
