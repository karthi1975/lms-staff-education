/**
 * Course RBAC Management Routes
 * Multi-Region RBAC System - Course Access Control
 *
 * Features:
 * - Course-region assignment management
 * - Regional course access control
 * - Course permission validation
 * - Accessible courses retrieval
 */

const express = require('express');
const router = express.Router();
const rbacService = require('../services/rbac.service');
const postgresService = require('../services/database/postgres.service');
const authMiddleware = require('../middleware/auth.middleware');
const rbacMiddleware = require('../middleware/rbac.middleware');
const logger = require('../utils/logger');

/**
 * @route GET /api/courses/accessible
 * @desc Get all courses accessible by current admin (filtered by region)
 * @access Admin+
 */
router.get(
  '/accessible',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.attachRoleInfo,
  async (req, res) => {
    try {
      const courses = await rbacService.getAccessibleCourses(req.user.id);

      res.json({
        success: true,
        data: courses,
        userRole: req.userRole,
        totalCourses: courses.length
      });
    } catch (error) {
      logger.error('Error fetching accessible courses:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch accessible courses'
      });
    }
  }
);

/**
 * @route GET /api/courses/:courseId/access
 * @desc Check if current admin can manage a specific course
 * @access Admin+
 */
router.get(
  '/:courseId/access',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      const result = await rbacService.canManageCourse(req.user.id, courseId);

      res.json({
        success: true,
        courseId,
        canManage: result.canManage,
        reason: result.reason || 'Access granted'
      });
    } catch (error) {
      logger.error(`Error checking course access ${req.params.courseId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to check course access'
      });
    }
  }
);

/**
 * @route PUT /api/courses/:courseId/region
 * @desc Assign course to a region (Super Admin only)
 * @access Super Admin only
 * @body { regionId }
 */
router.put(
  '/:courseId/region',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireSuperAdmin,
  rbacMiddleware.validateRequiredFields(['regionId']),
  async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      const { regionId } = req.body;

      // Validate course exists
      const courseQuery = 'SELECT id, title, code FROM courses WHERE id = $1';
      const courseResult = await postgresService.query(courseQuery, [courseId]);

      if (courseResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Course not found'
        });
      }

      // Validate region exists
      const regionQuery = 'SELECT id, name, code FROM regions WHERE id = $1 AND is_active = TRUE';
      const regionResult = await postgresService.query(regionQuery, [regionId]);

      if (regionResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Region not found or inactive'
        });
      }

      // Update course region
      const updateQuery = 'UPDATE courses SET region_id = $1 WHERE id = $2 RETURNING *';
      const updateResult = await postgresService.query(updateQuery, [regionId, courseId]);

      logger.info(`Course ${courseId} assigned to region ${regionId} by admin ${req.user.id}`);

      res.json({
        success: true,
        message: 'Course region updated successfully',
        data: {
          course: updateResult.rows[0],
          region: regionResult.rows[0]
        }
      });
    } catch (error) {
      logger.error(`Error assigning course ${req.params.courseId} to region:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to assign course to region'
      });
    }
  }
);

/**
 * @route DELETE /api/courses/:courseId/region
 * @desc Remove region assignment from course (Super Admin only)
 * @access Super Admin only
 */
router.delete(
  '/:courseId/region',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireSuperAdmin,
  async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);

      // Check if course has enrollments
      const enrollmentQuery = 'SELECT COUNT(*) as count FROM course_region_enrollments WHERE course_id = $1';
      const enrollmentResult = await postgresService.query(enrollmentQuery, [courseId]);

      if (parseInt(enrollmentResult.rows[0].count) > 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot remove region from course with existing enrollments',
          suggestion: 'Deactivate the course instead'
        });
      }

      // Remove region assignment
      const updateQuery = 'UPDATE courses SET region_id = NULL WHERE id = $1 RETURNING *';
      const updateResult = await postgresService.query(updateQuery, [courseId]);

      if (updateResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Course not found'
        });
      }

      logger.info(`Region assignment removed from course ${courseId} by admin ${req.user.id}`);

      res.json({
        success: true,
        message: 'Region assignment removed successfully',
        data: updateResult.rows[0]
      });
    } catch (error) {
      logger.error(`Error removing region from course ${req.params.courseId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove region assignment'
      });
    }
  }
);

/**
 * @route GET /api/courses/:courseId/enrollment-eligibility/:userId
 * @desc Check if a user can enroll in a course (region-based)
 * @access Admin+
 */
router.get(
  '/:courseId/enrollment-eligibility/:userId',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      const userId = parseInt(req.params.userId);

      // Check admin's permission to enroll in this course
      const adminCanEnroll = await rbacService.canEnrollInCourse(req.user.id, courseId);

      if (!adminCanEnroll.canEnroll) {
        return res.status(403).json({
          success: false,
          error: adminCanEnroll.reason
        });
      }

      // Get user's region
      const userQuery = 'SELECT id, name, primary_region_id FROM users WHERE id = $1';
      const userResult = await postgresService.query(userQuery, [userId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const user = userResult.rows[0];

      // Get course region
      const courseQuery = 'SELECT id, title, region_id FROM courses WHERE id = $1';
      const courseResult = await postgresService.query(courseQuery, [courseId]);

      if (courseResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Course not found'
        });
      }

      const course = courseResult.rows[0];

      // Check if user's region matches course region
      const eligible = user.primary_region_id === course.region_id;

      res.json({
        success: true,
        eligible,
        userId,
        courseId,
        userRegion: user.primary_region_id,
        courseRegion: course.region_id,
        reason: eligible
          ? 'User is eligible to enroll in this course'
          : 'User region does not match course region'
      });
    } catch (error) {
      logger.error('Error checking enrollment eligibility:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check enrollment eligibility'
      });
    }
  }
);

/**
 * @route GET /api/courses/region/:regionId
 * @desc Get all courses in a specific region
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

      const query = `
        SELECT
          c.*,
          r.name AS region_name,
          r.code AS region_code,
          COUNT(DISTINCT cre.id) AS total_enrollments,
          COUNT(DISTINCT CASE WHEN cre.status = 'active' THEN cre.id END) AS active_enrollments
        FROM courses c
        LEFT JOIN regions r ON c.region_id = r.id
        LEFT JOIN course_region_enrollments cre ON c.id = cre.course_id
        WHERE c.region_id = $1
        GROUP BY c.id, r.name, r.code
        ORDER BY c.sequence_order, c.title
      `;

      const result = await postgresService.query(query, [regionId]);

      res.json({
        success: true,
        regionId,
        data: result.rows,
        totalCourses: result.rows.length
      });
    } catch (error) {
      logger.error(`Error fetching courses for region ${req.params.regionId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch region courses'
      });
    }
  }
);

/**
 * @route GET /api/courses/unassigned
 * @desc Get all courses without region assignment (Super Admin only)
 * @access Super Admin only
 */
router.get(
  '/unassigned',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireSuperAdmin,
  async (req, res) => {
    try {
      const query = `
        SELECT
          c.*,
          COUNT(DISTINCT cre.id) AS total_enrollments
        FROM courses c
        LEFT JOIN course_region_enrollments cre ON c.id = cre.course_id
        WHERE c.region_id IS NULL
        GROUP BY c.id
        ORDER BY c.title
      `;

      const result = await postgresService.query(query);

      res.json({
        success: true,
        data: result.rows,
        totalUnassigned: result.rows.length
      });
    } catch (error) {
      logger.error('Error fetching unassigned courses:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch unassigned courses'
      });
    }
  }
);

/**
 * @route POST /api/courses/bulk-assign
 * @desc Bulk assign multiple courses to a region (Super Admin only)
 * @access Super Admin only
 * @body { courseIds: number[], regionId: number }
 */
router.post(
  '/bulk-assign',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireSuperAdmin,
  rbacMiddleware.validateRequiredFields(['courseIds', 'regionId']),
  async (req, res) => {
    try {
      const { courseIds, regionId } = req.body;

      if (!Array.isArray(courseIds) || courseIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'courseIds must be a non-empty array'
        });
      }

      // Validate region exists
      const regionQuery = 'SELECT id, name, code FROM regions WHERE id = $1 AND is_active = TRUE';
      const regionResult = await postgresService.query(regionQuery, [regionId]);

      if (regionResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Region not found or inactive'
        });
      }

      // Begin transaction
      const client = await postgresService.pool.connect();
      try {
        await client.query('BEGIN');

        const updateQuery = 'UPDATE courses SET region_id = $1 WHERE id = ANY($2::int[]) RETURNING id, title, code';
        const updateResult = await client.query(updateQuery, [regionId, courseIds]);

        await client.query('COMMIT');

        logger.info(`${updateResult.rows.length} courses bulk assigned to region ${regionId} by admin ${req.user.id}`);

        res.json({
          success: true,
          message: `${updateResult.rows.length} courses assigned successfully`,
          data: {
            updatedCourses: updateResult.rows,
            region: regionResult.rows[0],
            requestedCount: courseIds.length,
            updatedCount: updateResult.rows.length
          }
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error bulk assigning courses:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to bulk assign courses'
      });
    }
  }
);

/**
 * @route GET /api/courses/:courseId/stats
 * @desc Get course statistics (enrollments, completion, etc.)
 * @access Admin+ (with course access validation)
 */
router.get(
  '/:courseId/stats',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateCourseAccess,
  async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);

      const query = `
        SELECT
          c.id,
          c.title,
          c.code,
          c.region_id,
          r.name AS region_name,
          COUNT(DISTINCT cre.id) AS total_enrollments,
          COUNT(DISTINCT CASE WHEN cre.status = 'active' THEN cre.id END) AS active_enrollments,
          COUNT(DISTINCT CASE WHEN cre.status = 'completed' THEN cre.id END) AS completed_enrollments,
          COUNT(DISTINCT CASE WHEN cre.status = 'suspended' THEN cre.id END) AS suspended_enrollments,
          AVG(cre.progress_percentage) AS avg_progress
        FROM courses c
        LEFT JOIN regions r ON c.region_id = r.id
        LEFT JOIN course_region_enrollments cre ON c.id = cre.course_id
        WHERE c.id = $1
        GROUP BY c.id, r.name
      `;

      const result = await postgresService.query(query, [courseId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Course not found'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error(`Error fetching course stats ${req.params.courseId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch course statistics'
      });
    }
  }
);

module.exports = router;
