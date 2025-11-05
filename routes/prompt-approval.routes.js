/**
 * Prompt Approval Routes
 * API endpoints for coaching bot prompt approval workflow
 * Phase 2 of Dual Coaching Bot Feature
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/auth.middleware');
const regionAccessMiddleware = require('../middleware/region-access.middleware');
const postgresService = require('../services/database/postgres.service');
const PromptApprovalService = require('../services/prompt-approval.service');

// Initialize service
const promptApprovalService = new PromptApprovalService(postgresService);

/**
 * Admin Routes - Prompt change request management
 */

/**
 * GET /api/prompt-approval/accessible-courses
 * Get courses accessible to current admin (filtered by region)
 * Access: Any authenticated admin
 */
router.get('/prompt-approval/accessible-courses', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const courses = await promptApprovalService.getAccessibleCourses(req.user.id);

    res.json({
      success: true,
      count: courses.length,
      courses: courses
    });
  } catch (error) {
    logger.error('Error getting accessible courses:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get accessible courses'
    });
  }
});

/**
 * GET /api/prompt-approval/my-regions
 * Get admin's assigned regions with region details
 * Access: Any authenticated admin
 */
router.get('/prompt-approval/my-regions', authMiddleware.authenticateToken, async (req, res) => {
  try {
    // Check if Super Admin
    if (req.user.role_id === 1) {
      // Super Admin has access to all regions
      const allRegions = await postgresService.query(
        'SELECT id, code, name, description FROM regions WHERE is_active = true ORDER BY name'
      );

      return res.json({
        success: true,
        isSuperAdmin: true,
        regions: allRegions.rows,
        message: 'Super Admin has access to all regions'
      });
    }

    // Regional Admin: get assigned regions
    const query = `
      SELECT
        ar.region_id,
        r.code,
        r.name,
        r.description,
        ar.assigned_at,
        ar.assigned_by,
        assigner.name as assigned_by_name
      FROM admin_regions ar
      JOIN regions r ON ar.region_id = r.id
      LEFT JOIN admin_users assigner ON ar.assigned_by = assigner.id
      WHERE ar.admin_user_id = $1 AND r.is_active = true
      ORDER BY r.name
    `;

    const result = await postgresService.query(query, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'No regions assigned to your account. Contact Super Admin.'
      });
    }

    res.json({
      success: true,
      isSuperAdmin: false,
      count: result.rows.length,
      regions: result.rows
    });
  } catch (error) {
    logger.error('Error getting admin regions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get admin regions'
    });
  }
});

/**
 * GET /api/prompt-approval/courses/:courseId/default-prompt
 * Get current active prompt(s) for a course
 * Query param: mode=regular|socratic (optional - if not provided, returns both)
 * Access: Any authenticated admin with course access
 */
router.get('/prompt-approval/courses/:courseId/default-prompt',
  authMiddleware.authenticateToken,
  regionAccessMiddleware.verifyCourseAccess((req) => req.params.courseId),
  async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      const mode = req.query.mode;

      // If no mode specified, return both prompts
      if (!mode) {
        const result = await promptApprovalService.getAllDefaultPrompts(courseId);
        return res.json(result);
      }

      // If mode specified, return single prompt
      if (!['regular', 'socratic'].includes(mode)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid mode. Must be "regular" or "socratic"'
        });
      }

      const result = await promptApprovalService.getDefaultPrompt(courseId, mode);

      res.json(result);
    } catch (error) {
      logger.error('Error getting default prompt:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get default prompt'
      });
    }
  }
);

/**
 * POST /api/prompt-approval/requests
 * Create draft prompt change request
 * Access: Any authenticated admin with course access
 */
router.post('/prompt-approval/requests',
  authMiddleware.authenticateToken,
  regionAccessMiddleware.verifyCourseAccess((req) => req.body.courseId),
  async (req, res) => {
  try {
    const { courseId, mode, newPrompt, changeReason, changeDescription } = req.body;

    // Validate required fields
    if (!courseId || !mode || !newPrompt || !changeReason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: courseId, mode, newPrompt, changeReason'
      });
    }

    const result = await promptApprovalService.createDraftRequest({
      courseId: parseInt(courseId),
      mode,
      newPrompt,
      changeReason,
      changeDescription: changeDescription || '',
      requestedBy: req.user.id
    });

    res.json(result);
  } catch (error) {
    logger.error('Error creating draft request:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create draft request'
    });
  }
});

/**
 * POST /api/prompt-approval/requests/:id/submit
 * Submit draft request for Super Admin approval
 * Access: Request creator only
 */
router.post('/prompt-approval/requests/:id/submit', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);

    const result = await promptApprovalService.submitForApproval(requestId, req.user.id);

    res.json(result);
  } catch (error) {
    logger.error('Error submitting request for approval:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to submit request'
    });
  }
});

/**
 * GET /api/prompt-approval/requests/my
 * Get admin's own prompt change requests
 * Access: Any authenticated admin
 */
router.get('/prompt-approval/requests/my', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      courseId: req.query.courseId ? parseInt(req.query.courseId) : undefined
    };

    const result = await promptApprovalService.getMyRequests(req.user.id, filters);

    res.json(result);
  } catch (error) {
    logger.error('Error getting admin requests:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get requests'
    });
  }
});

/**
 * GET /api/prompt-approval/requests/:id
 * Get specific request details
 * Access: Request creator or Super Admin
 */
router.get('/prompt-approval/requests/:id', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);

    const result = await postgresService.query(
      `SELECT
        pcr.*,
        c.title as course_title,
        c.code as course_code,
        requester.name as requester_name,
        requester.email as requester_email,
        reviewer.name as reviewer_name,
        reviewer.email as reviewer_email
       FROM prompt_change_requests pcr
       JOIN courses c ON pcr.course_id = c.id
       JOIN admin_users requester ON pcr.requested_by = requester.id
       LEFT JOIN admin_users reviewer ON pcr.reviewed_by = reviewer.id
       WHERE pcr.id = $1`,
      [requestId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }

    const request = result.rows[0];

    // Check access: must be creator or Super Admin
    const isSuperAdmin = req.user.role_id === 1;
    const isCreator = request.requested_by === req.user.id;

    if (!isSuperAdmin && !isCreator) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own requests or must be a Super Admin.'
      });
    }

    res.json({
      success: true,
      request: {
        id: request.id,
        courseId: request.course_id,
        courseTitle: request.course_title,
        courseCode: request.course_code,
        mode: request.mode,
        currentPrompt: request.current_prompt,
        newPrompt: request.new_prompt,
        currentVersion: request.current_version,
        changeReason: request.change_reason,
        changeDescription: request.change_description,
        status: request.status,
        requester: {
          id: request.requested_by,
          name: request.requester_name,
          email: request.requester_email
        },
        reviewer: request.reviewed_by ? {
          id: request.reviewed_by,
          name: request.reviewer_name,
          email: request.reviewer_email
        } : null,
        submittedAt: request.submitted_at,
        reviewedAt: request.reviewed_at,
        reviewNotes: request.review_notes,
        createdAt: request.created_at,
        updatedAt: request.updated_at
      }
    });
  } catch (error) {
    logger.error('Error getting request details:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get request details'
    });
  }
});

/**
 * Super Admin Routes - Approval management
 */

/**
 * GET /api/prompt-approval/pending
 * Get pending approval requests
 * Access: Super Admin (all requests) or Regional Admin (filtered by region)
 */
router.get('/prompt-approval/pending',
  authMiddleware.authenticateToken,
  regionAccessMiddleware.attachAdminRegions,
  async (req, res) => {
    try {
      const filters = {
        courseId: req.query.courseId ? parseInt(req.query.courseId) : undefined,
        mode: req.query.mode
      };

      const result = await promptApprovalService.getPendingApprovals(req.user.id, filters);

      res.json(result);
    } catch (error) {
      logger.error('Error getting pending approvals:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get pending approvals'
      });
    }
  }
);

/**
 * POST /api/prompt-approval/requests/:id/approve
 * Approve prompt change request
 * Access: Super Admin only
 */
router.post('/prompt-approval/requests/:id/approve', authMiddleware.authenticateToken, async (req, res) => {
  try {
    // Verify Super Admin
    if (req.user.role_id !== 1) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only Super Admins can approve requests.'
      });
    }

    const requestId = parseInt(req.params.id);
    const { reviewNotes } = req.body;

    const result = await promptApprovalService.approveRequest({
      requestId,
      superAdminId: req.user.id,
      reviewNotes: reviewNotes || ''
    });

    res.json(result);
  } catch (error) {
    logger.error('Error approving request:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to approve request'
    });
  }
});

/**
 * POST /api/prompt-approval/requests/:id/reject
 * Reject prompt change request
 * Access: Super Admin only
 */
router.post('/prompt-approval/requests/:id/reject', authMiddleware.authenticateToken, async (req, res) => {
  try {
    // Verify Super Admin
    if (req.user.role_id !== 1) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only Super Admins can reject requests.'
      });
    }

    const requestId = parseInt(req.params.id);
    const { rejectionFeedback } = req.body;

    if (!rejectionFeedback) {
      return res.status(400).json({
        success: false,
        error: 'Rejection feedback is required (minimum 20 characters)'
      });
    }

    const result = await promptApprovalService.rejectRequest({
      requestId,
      superAdminId: req.user.id,
      rejectionFeedback
    });

    res.json(result);
  } catch (error) {
    logger.error('Error rejecting request:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to reject request'
    });
  }
});

/**
 * GET /api/prompt-approval/stats
 * Get approval statistics
 * Access: Super Admin only
 */
router.get('/prompt-approval/stats', authMiddleware.authenticateToken, async (req, res) => {
  try {
    // Verify Super Admin
    if (req.user.role_id !== 1) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only Super Admins can view statistics.'
      });
    }

    const days = req.query.days ? parseInt(req.query.days) : 30;

    const result = await promptApprovalService.getApprovalStats(days);

    res.json(result);
  } catch (error) {
    logger.error('Error getting approval stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get statistics'
    });
  }
});

/**
 * GET /api/prompt-approval/history/:courseId
 * Get approval history for a course
 * Access: Any authenticated admin
 */
router.get('/prompt-approval/history/:courseId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId);
    const options = {
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
      offset: req.query.offset ? parseInt(req.query.offset) : 0
    };

    const result = await promptApprovalService.getApprovalHistory(courseId, options);

    res.json(result);
  } catch (error) {
    logger.error('Error getting approval history:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get approval history'
    });
  }
});

module.exports = router;
