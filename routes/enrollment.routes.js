/**
 * Enrollment Management Routes
 * Multi-Region RBAC System - Enrollment Control
 *
 * Features:
 * - Individual user enrollment
 * - Bulk enrollment operations
 * - Enrollment status management
 * - Enrollment history and audit trail
 * - Regional enrollment filtering
 */

const express = require('express');
const router = express.Router();
const regionEnrollmentService = require('../services/region-enrollment.service');
const rbacService = require('../services/rbac.service');
const postgresService = require('../services/database/postgres.service');
const authMiddleware = require('../middleware/auth.middleware');
const rbacMiddleware = require('../middleware/rbac.middleware');
const logger = require('../utils/logger');

/**
 * @route POST /api/enrollments
 * @desc Enroll a user in a course
 * @access Admin+ (with enrollment permission validation)
 * @body { userId, courseId, enrollmentMethod? }
 */
router.post(
  '/',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateRequiredFields(['userId', 'courseId']),
  rbacMiddleware.validateEnrollmentAccess,
  async (req, res) => {
    try {
      const { userId, courseId, enrollmentMethod = 'manual' } = req.body;

      const result = await regionEnrollmentService.enrollUser({
        userId: parseInt(userId),
        courseId: parseInt(courseId),
        enrolledBy: req.user.id,
        enrollmentMethod
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      logger.info(`User ${userId} enrolled in course ${courseId} by admin ${req.user.id}`);
      res.status(201).json(result);
    } catch (error) {
      logger.error('Error enrolling user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to enroll user'
      });
    }
  }
);

/**
 * @route POST /api/enrollments/bulk
 * @desc Bulk enroll multiple users in a course
 * @access Admin+ (with enrollment permission validation)
 * @body { userIds: number[], courseId, targetRegionId?, enrollmentMethod? }
 */
router.post(
  '/bulk',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateRequiredFields(['userIds', 'courseId']),
  async (req, res) => {
    try {
      const { userIds, courseId, targetRegionId, enrollmentMethod = 'bulk' } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'userIds must be a non-empty array'
        });
      }

      // Validate admin can enroll in this course
      const canEnroll = await rbacService.canEnrollInCourse(req.user.id, courseId);
      if (!canEnroll.canEnroll) {
        return res.status(403).json({
          success: false,
          error: canEnroll.reason
        });
      }

      // Determine target region
      let effectiveRegionId = targetRegionId;
      if (!effectiveRegionId) {
        const adminRole = await rbacService.getAdminUserRole(req.user.id);
        if (adminRole && adminRole.role_id === rbacService.ROLES.ADMIN) {
          effectiveRegionId = adminRole.primary_region_id;
        }
      }

      const enrollments = userIds.map(userId => ({
        userId: parseInt(userId),
        courseId: parseInt(courseId),
        enrolledBy: req.user.id,
        enrollmentMethod
      }));

      const result = await regionEnrollmentService.bulkEnrollUsers(
        enrollments,
        effectiveRegionId
      );

      logger.info(`Bulk enrollment: ${result.successful}/${enrollments.length} users in course ${courseId} by admin ${req.user.id}`);

      res.json(result);
    } catch (error) {
      logger.error('Error bulk enrolling users:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to bulk enroll users'
      });
    }
  }
);

/**
 * @route GET /api/enrollments/:enrollmentId
 * @desc Get enrollment details by ID
 * @access Admin+ (with access validation)
 */
router.get(
  '/:enrollmentId',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  async (req, res) => {
    try {
      const enrollmentId = parseInt(req.params.enrollmentId);

      const query = `
        SELECT
          cre.*,
          u.name AS user_name,
          u.whatsapp_id,
          c.title AS course_title,
          c.code AS course_code,
          c.region_id,
          r.name AS region_name,
          a.name AS enrolled_by_name
        FROM course_region_enrollments cre
        JOIN users u ON cre.user_id = u.id
        JOIN courses c ON cre.course_id = c.id
        LEFT JOIN regions r ON c.region_id = r.id
        LEFT JOIN admin_users a ON cre.enrolled_by = a.id
        WHERE cre.id = $1
      `;

      const result = await postgresService.query(query, [enrollmentId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Enrollment not found'
        });
      }

      const enrollment = result.rows[0];

      // Check if admin has access to this enrollment's region
      const hasAccess = await rbacService.hasRegionAccess(req.user.id, enrollment.region_id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'You do not have access to this enrollment'
        });
      }

      res.json({
        success: true,
        data: enrollment
      });
    } catch (error) {
      logger.error(`Error fetching enrollment ${req.params.enrollmentId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch enrollment details'
      });
    }
  }
);

/**
 * @route GET /api/enrollments/:enrollmentId/history
 * @desc Get enrollment history (audit trail)
 * @access Admin+ (with access validation)
 */
router.get(
  '/:enrollmentId/history',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  async (req, res) => {
    try {
      const enrollmentId = parseInt(req.params.enrollmentId);

      // First check enrollment exists and admin has access
      const enrollmentQuery = `
        SELECT c.region_id
        FROM course_region_enrollments cre
        JOIN courses c ON cre.course_id = c.id
        WHERE cre.id = $1
      `;
      const enrollmentResult = await postgresService.query(enrollmentQuery, [enrollmentId]);

      if (enrollmentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Enrollment not found'
        });
      }

      const hasAccess = await rbacService.hasRegionAccess(
        req.user.id,
        enrollmentResult.rows[0].region_id
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'You do not have access to this enrollment'
        });
      }

      // Get history
      const historyQuery = `
        SELECT
          eh.*,
          a.name AS performed_by_name
        FROM course_region_enrollment_history eh
        LEFT JOIN admin_users a ON eh.performed_by = a.id
        WHERE eh.enrollment_id = $1
        ORDER BY eh.changed_at DESC
      `;

      const historyResult = await postgresService.query(historyQuery, [enrollmentId]);

      res.json({
        success: true,
        enrollmentId,
        data: historyResult.rows,
        totalEvents: historyResult.rows.length
      });
    } catch (error) {
      logger.error(`Error fetching enrollment history ${req.params.enrollmentId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch enrollment history'
      });
    }
  }
);

/**
 * @route PUT /api/enrollments/:enrollmentId/status
 * @desc Update enrollment status
 * @access Admin+ (with access validation)
 * @body { status, reason? }
 */
router.put(
  '/:enrollmentId/status',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateRequiredFields(['status']),
  async (req, res) => {
    try {
      const enrollmentId = parseInt(req.params.enrollmentId);
      const { status, reason } = req.body;

      // Validate status
      const validStatuses = ['active', 'completed', 'suspended', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      // Check enrollment exists and admin has access
      const enrollmentQuery = `
        SELECT cre.id, c.region_id
        FROM course_region_enrollments cre
        JOIN courses c ON cre.course_id = c.id
        WHERE cre.id = $1
      `;
      const enrollmentResult = await postgresService.query(enrollmentQuery, [enrollmentId]);

      if (enrollmentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Enrollment not found'
        });
      }

      const hasAccess = await rbacService.hasRegionAccess(
        req.user.id,
        enrollmentResult.rows[0].region_id
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'You do not have access to this enrollment'
        });
      }

      // Update status
      const result = await regionEnrollmentService.updateEnrollmentStatus(
        enrollmentId,
        status,
        req.user.id,
        reason
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      logger.info(`Enrollment ${enrollmentId} status updated to ${status} by admin ${req.user.id}`);
      res.json(result);
    } catch (error) {
      logger.error(`Error updating enrollment status ${req.params.enrollmentId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to update enrollment status'
      });
    }
  }
);

/**
 * @route GET /api/enrollments/course/:courseId
 * @desc Get all enrollments for a course
 * @access Admin+ (with course access validation)
 */
router.get(
  '/course/:courseId',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateCourseAccess,
  async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      const { status, limit = 100, offset = 0 } = req.query;

      let query = `
        SELECT
          cre.*,
          u.name AS user_name,
          u.whatsapp_id,
          a.name AS enrolled_by_name
        FROM course_region_enrollments cre
        JOIN users u ON cre.user_id = u.id
        LEFT JOIN admin_users a ON cre.enrolled_by = a.id
        WHERE cre.course_id = $1
      `;

      const params = [courseId];
      let paramCount = 2;

      if (status) {
        query += ` AND cre.status = $${paramCount++}`;
        params.push(status);
      }

      query += ` ORDER BY cre.enrolled_at DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await postgresService.query(query, params);

      // Get total count
      const countQuery = status
        ? 'SELECT COUNT(*) as count FROM course_region_enrollments WHERE course_id = $1 AND status = $2'
        : 'SELECT COUNT(*) as count FROM course_region_enrollments WHERE course_id = $1';
      const countParams = status ? [courseId, status] : [courseId];
      const countResult = await postgresService.query(countQuery, countParams);

      res.json({
        success: true,
        courseId,
        data: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: parseInt(countResult.rows[0].count)
        }
      });
    } catch (error) {
      logger.error(`Error fetching course enrollments ${req.params.courseId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch course enrollments'
      });
    }
  }
);

/**
 * @route GET /api/enrollments/user/:userId
 * @desc Get all enrollments for a user
 * @access Admin+ (with regional filtering)
 */
router.get(
  '/user/:userId',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.attachRoleInfo,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);

      let query = `
        SELECT
          cre.*,
          c.title AS course_title,
          c.code AS course_code,
          c.region_id,
          r.name AS region_name,
          a.name AS enrolled_by_name
        FROM course_region_enrollments cre
        JOIN courses c ON cre.course_id = c.id
        LEFT JOIN regions r ON c.region_id = r.id
        LEFT JOIN admin_users a ON cre.enrolled_by = a.id
        WHERE cre.user_id = $1
      `;

      const params = [userId];

      // Filter by accessible regions for Regional Admins
      if (req.userRole && !req.userRole.isSuperAdmin && req.assignedRegions) {
        query += ' AND c.region_id = ANY($2::int[])';
        params.push(req.assignedRegions);
      }

      query += ' ORDER BY cre.enrolled_at DESC';

      const result = await postgresService.query(query, params);

      res.json({
        success: true,
        userId,
        data: result.rows,
        totalEnrollments: result.rows.length
      });
    } catch (error) {
      logger.error(`Error fetching user enrollments ${req.params.userId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user enrollments'
      });
    }
  }
);

/**
 * @route GET /api/enrollments/region/:regionId
 * @desc Get all enrollments in a region
 * @access Admin+ (with region access validation)
 */
router.get(
  '/region/:regionId',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateRegionAccess,
  async (req, res) => {
    try {
      const regionId = parseInt(req.params.regionId);
      const { status, limit = 100, offset = 0 } = req.query;

      let query = `
        SELECT
          cre.*,
          u.name AS user_name,
          u.whatsapp_id,
          c.title AS course_title,
          c.code AS course_code,
          a.name AS enrolled_by_name
        FROM course_region_enrollments cre
        JOIN users u ON cre.user_id = u.id
        JOIN courses c ON cre.course_id = c.id
        LEFT JOIN admin_users a ON cre.enrolled_by = a.id
        WHERE c.region_id = $1
      `;

      const params = [regionId];
      let paramCount = 2;

      if (status) {
        query += ` AND cre.status = $${paramCount++}`;
        params.push(status);
      }

      query += ` ORDER BY cre.enrolled_at DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await postgresService.query(query, params);

      // Get total count
      const countQuery = status
        ? 'SELECT COUNT(*) as count FROM course_region_enrollments cre JOIN courses c ON cre.course_id = c.id WHERE c.region_id = $1 AND cre.status = $2'
        : 'SELECT COUNT(*) as count FROM course_region_enrollments cre JOIN courses c ON cre.course_id = c.id WHERE c.region_id = $1';
      const countParams = status ? [regionId, status] : [regionId];
      const countResult = await postgresService.query(countQuery, countParams);

      res.json({
        success: true,
        regionId,
        data: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: parseInt(countResult.rows[0].count)
        }
      });
    } catch (error) {
      logger.error(`Error fetching region enrollments ${req.params.regionId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch region enrollments'
      });
    }
  }
);

/**
 * @route DELETE /api/enrollments/:enrollmentId
 * @desc Delete/cancel an enrollment
 * @access Admin+ (with access validation)
 */
router.delete(
  '/:enrollmentId',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  async (req, res) => {
    try {
      const enrollmentId = parseInt(req.params.enrollmentId);
      const { reason } = req.body;

      // Check enrollment exists and admin has access
      const enrollmentQuery = `
        SELECT cre.id, c.region_id, cre.status
        FROM course_region_enrollments cre
        JOIN courses c ON cre.course_id = c.id
        WHERE cre.id = $1
      `;
      const enrollmentResult = await postgresService.query(enrollmentQuery, [enrollmentId]);

      if (enrollmentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Enrollment not found'
        });
      }

      const enrollment = enrollmentResult.rows[0];

      const hasAccess = await rbacService.hasRegionAccess(req.user.id, enrollment.region_id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'You do not have access to this enrollment'
        });
      }

      // Update status to cancelled instead of hard delete
      const result = await regionEnrollmentService.updateEnrollmentStatus(
        enrollmentId,
        'cancelled',
        req.user.id,
        reason || 'Enrollment cancelled by administrator'
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      logger.info(`Enrollment ${enrollmentId} cancelled by admin ${req.user.id}`);
      res.json({
        success: true,
        message: 'Enrollment cancelled successfully',
        data: result.data
      });
    } catch (error) {
      logger.error(`Error cancelling enrollment ${req.params.enrollmentId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel enrollment'
      });
    }
  }
);

module.exports = router;
