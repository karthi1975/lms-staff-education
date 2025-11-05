/**
 * Region Access Middleware
 * Provides regional access control for prompt approval workflow
 *
 * Implements defense-in-depth security:
 * - Super Admins can access ALL regions/courses
 * - Regional Admins can ONLY access courses in their assigned regions
 * - Validates access at middleware layer (before hitting service layer)
 */

const logger = require('../utils/logger');
const postgresService = require('../services/database/postgres.service');

/**
 * Attach admin's assigned regions to req.user.regions
 * Fetches from admin_regions table and enriches req.user object
 *
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next middleware
 */
const attachAdminRegions = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Super Admin has access to all regions (no filtering needed)
    if (req.user.role_id === 1) {
      req.user.regions = null; // null = ALL regions
      req.user.isSuperAdmin = true;
      logger.debug(`Super Admin ${req.user.id} - access to ALL regions`);
      return next();
    }

    // Regional Admin: fetch assigned regions
    const query = `
      SELECT
        ar.region_id,
        r.code AS region_code,
        r.name AS region_name
      FROM admin_regions ar
      JOIN regions r ON ar.region_id = r.id
      WHERE ar.admin_user_id = $1 AND r.is_active = TRUE
      ORDER BY r.name
    `;

    const result = await postgresService.query(query, [req.user.id]);

    if (result.rows.length === 0) {
      logger.warn(`Regional Admin ${req.user.id} has no assigned regions`);
      return res.status(403).json({
        success: false,
        error: 'No regions assigned to your account. Contact Super Admin.'
      });
    }

    // Attach regions to req.user
    req.user.regions = result.rows.map(r => r.region_id);
    req.user.regionDetails = result.rows;
    req.user.isSuperAdmin = false;

    logger.debug(`Regional Admin ${req.user.id} - access to regions: ${req.user.regions.join(', ')}`);

    next();
  } catch (error) {
    logger.error('Error attaching admin regions:', error);
    return res.status(500).json({
      success: false,
      error: 'Error validating region access'
    });
  }
};

/**
 * Verify admin can access the specified course's region
 * Returns middleware function that validates course access
 *
 * @param {number|function} courseIdExtractor - Course ID or function to extract it
 * @returns {function} Express middleware
 */
const verifyCourseAccess = (courseIdExtractor) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Extract course ID
      let courseId;
      if (typeof courseIdExtractor === 'function') {
        courseId = courseIdExtractor(req);
      } else if (typeof courseIdExtractor === 'number') {
        courseId = courseIdExtractor;
      } else {
        // Auto-detect from req.body or req.params
        courseId = req.body.courseId || req.params.courseId || req.params.id;
      }

      courseId = parseInt(courseId);

      if (!courseId || isNaN(courseId)) {
        return res.status(400).json({
          success: false,
          error: 'Valid course ID is required'
        });
      }

      // Super Admin can access all courses
      if (req.user.role_id === 1) {
        req.courseAccess = {
          canAccess: true,
          courseId: courseId,
          reason: 'Super Admin access'
        };
        return next();
      }

      // Regional Admin: validate course is in assigned region
      // Get course region
      const courseQuery = `
        SELECT id, title, region_id, code
        FROM courses
        WHERE id = $1
      `;
      const courseResult = await postgresService.query(courseQuery, [courseId]);

      if (courseResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: `Course ${courseId} not found`
        });
      }

      const course = courseResult.rows[0];

      // Check if course has a region assigned
      if (!course.region_id) {
        logger.warn(`Course ${courseId} has no region assigned`);
        return res.status(403).json({
          success: false,
          error: 'Course not assigned to any region. Contact Super Admin.'
        });
      }

      // Check if admin has access to course's region
      if (!req.user.regions || !req.user.regions.includes(course.region_id)) {
        logger.warn(`Admin ${req.user.id} attempted to access course ${courseId} in unauthorized region ${course.region_id}`);
        return res.status(403).json({
          success: false,
          error: `Access denied. Course "${course.title}" is not in your assigned regions.`
        });
      }

      // Access granted
      req.courseAccess = {
        canAccess: true,
        courseId: courseId,
        course: course,
        reason: 'Region access granted'
      };

      logger.debug(`Admin ${req.user.id} granted access to course ${courseId} (region ${course.region_id})`);

      next();
    } catch (error) {
      logger.error('Error verifying course access:', error);
      return res.status(500).json({
        success: false,
        error: 'Error validating course access'
      });
    }
  };
};

/**
 * Get region filter for queries
 * Returns null for Super Admin (no filtering)
 * Returns array of region IDs for Regional Admin
 *
 * @param {object} req - Express request with req.user
 * @returns {null|Array<number>} - null for Super Admin, array of region IDs for Regional Admin
 */
const getRegionFilter = (req) => {
  // Super Admin: no filtering (null)
  if (req.user.role_id === 1 || req.user.isSuperAdmin) {
    return null;
  }

  // Regional Admin: return assigned regions
  return req.user.regions || [];
};

/**
 * Log access attempt for audit trail
 *
 * @param {object} req - Express request
 * @param {string} action - Action attempted
 * @param {string} resource - Resource accessed
 * @param {boolean} granted - Whether access was granted
 */
const logAccessAttempt = async (req, action, resource, granted) => {
  try {
    const logEntry = {
      adminId: req.user?.id,
      adminEmail: req.user?.email,
      action: action,
      resource: resource,
      granted: granted,
      timestamp: new Date().toISOString(),
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent']
    };

    logger.info(`Access Attempt: ${JSON.stringify(logEntry)}`);

    // TODO: Store in audit log table if needed
  } catch (error) {
    logger.error('Error logging access attempt:', error);
    // Don't throw - logging failure shouldn't break main flow
  }
};

module.exports = {
  attachAdminRegions,
  verifyCourseAccess,
  getRegionFilter,
  logAccessAttempt
};
