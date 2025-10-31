/**
 * Statistics and Reporting Routes
 * Multi-Region RBAC System - Analytics & Insights
 *
 * Features:
 * - Dashboard overview statistics
 * - Regional performance metrics
 * - Course enrollment analytics
 * - User progress tracking
 * - Admin activity reports
 * - CSV upload analytics
 * - Notification delivery metrics
 * - Time-series analytics
 */

const express = require('express');
const router = express.Router();
const postgresService = require('../services/database/postgres.service');
const rbacService = require('../services/rbac.service');
const csvProcessorService = require('../services/csv-processor.service');
const whatsAppNotificationService = require('../services/whatsapp-region-notification.service');
const authMiddleware = require('../middleware/auth.middleware');
const rbacMiddleware = require('../middleware/rbac.middleware');
const logger = require('../utils/logger');

/**
 * @route GET /api/statistics/dashboard
 * @desc Get dashboard overview statistics
 * @access Admin+ (filtered by accessible regions)
 */
router.get(
  '/dashboard',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.attachRoleInfo,
  async (req, res) => {
    try {
      const isSuperAdmin = req.userRole?.isSuperAdmin || false;
      const assignedRegions = req.assignedRegions || [];

      // Build region filter
      let regionFilter = '';
      const params = [];
      if (!isSuperAdmin && assignedRegions.length > 0) {
        regionFilter = 'WHERE c.region_id = ANY($1::int[])';
        params.push(assignedRegions);
      }

      // Get total courses
      const coursesQuery = `SELECT COUNT(*) as count FROM courses c ${regionFilter}`;
      const coursesResult = await postgresService.query(coursesQuery, params);

      // Get total enrollments
      const enrollmentsQuery = `
        SELECT COUNT(*) as count
        FROM course_region_enrollments cre
        JOIN courses c ON cre.course_id = c.id
        ${regionFilter}
      `;
      const enrollmentsResult = await postgresService.query(enrollmentsQuery, params);

      // Get active enrollments
      const activeQuery = `
        SELECT COUNT(*) as count
        FROM course_region_enrollments cre
        JOIN courses c ON cre.course_id = c.id
        ${regionFilter.replace('WHERE', 'WHERE cre.status = \'active\' AND')}
      `;
      const activeResult = await postgresService.query(activeQuery, params);

      // Get total users
      const usersQuery = isSuperAdmin
        ? 'SELECT COUNT(*) as count FROM users WHERE is_active = TRUE'
        : 'SELECT COUNT(*) as count FROM users WHERE is_active = TRUE AND primary_region_id = ANY($1::int[])';
      const usersResult = await postgresService.query(usersQuery, isSuperAdmin ? [] : params);

      // Get regions count (Super Admin only)
      let regionsCount = 0;
      if (isSuperAdmin) {
        const regionsQuery = 'SELECT COUNT(*) as count FROM regions WHERE is_active = TRUE';
        const regionsResult = await postgresService.query(regionsQuery);
        regionsCount = parseInt(regionsResult.rows[0].count);
      } else {
        regionsCount = assignedRegions.length;
      }

      // Get recent activity (last 7 days)
      const recentEnrollmentsQuery = `
        SELECT COUNT(*) as count
        FROM course_region_enrollments cre
        JOIN courses c ON cre.course_id = c.id
        WHERE cre.enrolled_at >= NOW() - INTERVAL '7 days'
        ${regionFilter ? 'AND ' + regionFilter.replace('WHERE ', '') : ''}
      `;
      const recentEnrollmentsResult = await postgresService.query(recentEnrollmentsQuery, params);

      res.json({
        success: true,
        data: {
          totalCourses: parseInt(coursesResult.rows[0].count),
          totalEnrollments: parseInt(enrollmentsResult.rows[0].count),
          activeEnrollments: parseInt(activeResult.rows[0].count),
          totalUsers: parseInt(usersResult.rows[0].count),
          totalRegions: regionsCount,
          recentEnrollments: parseInt(recentEnrollmentsResult.rows[0].count),
          userRole: req.userRole
        }
      });
    } catch (error) {
      logger.error('Error fetching dashboard statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard statistics'
      });
    }
  }
);

/**
 * @route GET /api/statistics/regions
 * @desc Get statistics for all regions
 * @access Admin+ (filtered by accessible regions)
 */
router.get(
  '/regions',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.attachRoleInfo,
  async (req, res) => {
    try {
      const isSuperAdmin = req.userRole?.isSuperAdmin || false;
      const assignedRegions = req.assignedRegions || [];

      let query = `
        SELECT
          r.id,
          r.name,
          r.code,
          COUNT(DISTINCT c.id) AS total_courses,
          COUNT(DISTINCT u.id) AS total_users,
          COUNT(DISTINCT cre.id) AS total_enrollments,
          COUNT(DISTINCT CASE WHEN cre.status = 'active' THEN cre.id END) AS active_enrollments,
          COUNT(DISTINCT CASE WHEN cre.status = 'completed' THEN cre.id END) AS completed_enrollments
        FROM regions r
        LEFT JOIN courses c ON r.id = c.region_id
        LEFT JOIN users u ON r.id = u.primary_region_id AND u.is_active = TRUE
        LEFT JOIN course_region_enrollments cre ON c.id = cre.course_id
        WHERE r.is_active = TRUE
      `;

      const params = [];
      if (!isSuperAdmin && assignedRegions.length > 0) {
        query += ' AND r.id = ANY($1::int[])';
        params.push(assignedRegions);
      }

      query += ' GROUP BY r.id, r.name, r.code ORDER BY r.name';

      const result = await postgresService.query(query, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Error fetching region statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch region statistics'
      });
    }
  }
);

/**
 * @route GET /api/statistics/courses
 * @desc Get enrollment statistics for all courses
 * @access Admin+ (filtered by accessible regions)
 */
router.get(
  '/courses',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.attachRoleInfo,
  async (req, res) => {
    try {
      const isSuperAdmin = req.userRole?.isSuperAdmin || false;
      const assignedRegions = req.assignedRegions || [];

      let query = `
        SELECT
          c.id,
          c.title,
          c.code,
          c.region_id,
          r.name AS region_name,
          COUNT(DISTINCT cre.id) AS total_enrollments,
          COUNT(DISTINCT CASE WHEN cre.status = 'active' THEN cre.id END) AS active_enrollments,
          COUNT(DISTINCT CASE WHEN cre.status = 'completed' THEN cre.id END) AS completed_enrollments,
          AVG(cre.progress_percentage) AS avg_progress
        FROM courses c
        LEFT JOIN regions r ON c.region_id = r.id
        LEFT JOIN course_region_enrollments cre ON c.id = cre.course_id
      `;

      const params = [];
      if (!isSuperAdmin && assignedRegions.length > 0) {
        query += ' WHERE c.region_id = ANY($1::int[])';
        params.push(assignedRegions);
      }

      query += ' GROUP BY c.id, r.name ORDER BY total_enrollments DESC';

      const result = await postgresService.query(query, params);

      res.json({
        success: true,
        data: result.rows,
        totalCourses: result.rows.length
      });
    } catch (error) {
      logger.error('Error fetching course statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch course statistics'
      });
    }
  }
);

/**
 * @route GET /api/statistics/enrollment-trends
 * @desc Get enrollment trends over time
 * @access Admin+ (filtered by accessible regions)
 */
router.get(
  '/enrollment-trends',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.attachRoleInfo,
  async (req, res) => {
    try {
      const { days = 30 } = req.query;
      const isSuperAdmin = req.userRole?.isSuperAdmin || false;
      const assignedRegions = req.assignedRegions || [];

      let query = `
        SELECT
          DATE(cre.enrolled_at) AS date,
          COUNT(*) AS enrollments
        FROM course_region_enrollments cre
        JOIN courses c ON cre.course_id = c.id
        WHERE cre.enrolled_at >= NOW() - INTERVAL '${parseInt(days)} days'
      `;

      const params = [];
      if (!isSuperAdmin && assignedRegions.length > 0) {
        query += ' AND c.region_id = ANY($1::int[])';
        params.push(assignedRegions);
      }

      query += ' GROUP BY DATE(cre.enrolled_at) ORDER BY date';

      const result = await postgresService.query(query, params);

      res.json({
        success: true,
        data: result.rows,
        period: `${days} days`
      });
    } catch (error) {
      logger.error('Error fetching enrollment trends:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch enrollment trends'
      });
    }
  }
);

/**
 * @route GET /api/statistics/csv-uploads
 * @desc Get CSV upload analytics
 * @access Admin+
 */
router.get(
  '/csv-uploads',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.attachRoleInfo,
  async (req, res) => {
    try {
      const { courseId, regionId, startDate, endDate } = req.query;
      const isSuperAdmin = req.userRole?.isSuperAdmin || false;

      const filters = {
        uploadedBy: isSuperAdmin ? undefined : req.user.id
      };

      if (courseId) filters.courseId = parseInt(courseId);
      if (regionId) filters.regionId = parseInt(regionId);
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const stats = await csvProcessorService.getCSVUploadStats(filters);

      res.json({
        success: true,
        data: stats,
        filters: filters
      });
    } catch (error) {
      logger.error('Error fetching CSV upload analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch CSV upload analytics'
      });
    }
  }
);

/**
 * @route GET /api/statistics/notifications
 * @desc Get notification delivery analytics
 * @access Admin+ (filtered by accessible regions)
 */
router.get(
  '/notifications',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.attachRoleInfo,
  async (req, res) => {
    try {
      const { courseId, messageType, startDate, endDate } = req.query;
      const isSuperAdmin = req.userRole?.isSuperAdmin || false;
      const assignedRegions = req.assignedRegions || [];

      const filters = {};
      if (courseId) filters.courseId = parseInt(courseId);
      if (messageType) filters.messageType = messageType;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const stats = await whatsAppNotificationService.getNotificationStats(filters);

      // If Regional Admin, also get region-specific breakdown
      let regionBreakdown = null;
      if (!isSuperAdmin && assignedRegions.length > 0) {
        const query = `
          SELECT
            c.region_id,
            r.name AS region_name,
            COUNT(*) AS total,
            COUNT(CASE WHEN wn.delivery_status = 'sent' THEN 1 END) AS sent,
            COUNT(CASE WHEN wn.delivery_status = 'delivered' THEN 1 END) AS delivered,
            COUNT(CASE WHEN wn.delivery_status = 'failed' THEN 1 END) AS failed
          FROM whatsapp_notifications wn
          JOIN courses c ON wn.course_id = c.id
          JOIN regions r ON c.region_id = r.id
          WHERE c.region_id = ANY($1::int[])
          GROUP BY c.region_id, r.name
        `;
        const result = await postgresService.query(query, [assignedRegions]);
        regionBreakdown = result.rows;
      }

      res.json({
        success: true,
        data: {
          overall: stats,
          regionBreakdown
        },
        filters: filters
      });
    } catch (error) {
      logger.error('Error fetching notification analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notification analytics'
      });
    }
  }
);

/**
 * @route GET /api/statistics/admin-activity
 * @desc Get admin activity statistics
 * @access Super Admin only
 */
router.get(
  '/admin-activity',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireSuperAdmin,
  async (req, res) => {
    try {
      const { days = 30 } = req.query;

      const query = `
        SELECT
          a.id,
          a.name,
          a.email,
          ar.role_name,
          r.name AS primary_region,
          COUNT(DISTINCT cre.id) AS enrollments_created,
          COUNT(DISTINCT cl.id) AS csv_uploads,
          COUNT(DISTINCT wn.id) AS notifications_sent
        FROM admin_users a
        LEFT JOIN admin_user_roles aur ON a.id = aur.admin_user_id
        LEFT JOIN admin_roles ar ON aur.role_id = ar.id
        LEFT JOIN regions r ON aur.primary_region_id = r.id
        LEFT JOIN course_region_enrollments cre ON a.id = cre.enrolled_by
          AND cre.enrolled_at >= NOW() - INTERVAL '${parseInt(days)} days'
        LEFT JOIN csv_upload_logs cl ON a.id = cl.uploaded_by
          AND cl.uploaded_at >= NOW() - INTERVAL '${parseInt(days)} days'
        LEFT JOIN whatsapp_notifications wn ON a.id = wn.sent_by
          AND wn.sent_at >= NOW() - INTERVAL '${parseInt(days)} days'
        WHERE a.is_active = TRUE
        GROUP BY a.id, a.name, a.email, ar.role_name, r.name
        ORDER BY enrollments_created DESC
      `;

      const result = await postgresService.query(query);

      res.json({
        success: true,
        data: result.rows,
        period: `${days} days`
      });
    } catch (error) {
      logger.error('Error fetching admin activity statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch admin activity statistics'
      });
    }
  }
);

/**
 * @route GET /api/statistics/user-engagement
 * @desc Get user engagement metrics
 * @access Admin+ (filtered by accessible regions)
 */
router.get(
  '/user-engagement',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.attachRoleInfo,
  async (req, res) => {
    try {
      const isSuperAdmin = req.userRole?.isSuperAdmin || false;
      const assignedRegions = req.assignedRegions || [];

      let query = `
        SELECT
          COUNT(DISTINCT u.id) AS total_users,
          COUNT(DISTINCT CASE WHEN cre.id IS NOT NULL THEN u.id END) AS enrolled_users,
          COUNT(DISTINCT CASE WHEN cre.status = 'active' THEN u.id END) AS active_users,
          COUNT(DISTINCT CASE WHEN cre.status = 'completed' THEN u.id END) AS completed_users,
          AVG(CASE WHEN cre.id IS NOT NULL THEN cre.progress_percentage END) AS avg_progress
        FROM users u
        LEFT JOIN course_region_enrollments cre ON u.id = cre.user_id
        WHERE u.is_active = TRUE
      `;

      const params = [];
      if (!isSuperAdmin && assignedRegions.length > 0) {
        query += ' AND u.primary_region_id = ANY($1::int[])';
        params.push(assignedRegions);
      }

      const result = await postgresService.query(query, params);

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Error fetching user engagement metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user engagement metrics'
      });
    }
  }
);

/**
 * @route GET /api/statistics/regional-performance
 * @desc Get detailed regional performance comparison
 * @access Super Admin only
 */
router.get(
  '/regional-performance',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireSuperAdmin,
  async (req, res) => {
    try {
      const query = `
        SELECT
          r.id,
          r.name,
          r.code,
          COUNT(DISTINCT c.id) AS courses,
          COUNT(DISTINCT u.id) AS users,
          COUNT(DISTINCT cre.id) AS enrollments,
          COUNT(DISTINCT CASE WHEN cre.status = 'completed' THEN cre.id END) AS completions,
          AVG(cre.progress_percentage) AS avg_progress,
          COUNT(DISTINCT cl.id) AS csv_uploads,
          SUM(cl.successful_enrollments) AS csv_enrollments,
          COUNT(DISTINCT wn.id) AS notifications_sent
        FROM regions r
        LEFT JOIN courses c ON r.id = c.region_id
        LEFT JOIN users u ON r.id = u.primary_region_id AND u.is_active = TRUE
        LEFT JOIN course_region_enrollments cre ON c.id = cre.course_id
        LEFT JOIN csv_upload_logs cl ON r.id = cl.target_region_id
        LEFT JOIN whatsapp_notifications wn ON c.id = wn.course_id
        WHERE r.is_active = TRUE
        GROUP BY r.id, r.name, r.code
        ORDER BY enrollments DESC
      `;

      const result = await postgresService.query(query);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Error fetching regional performance:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch regional performance'
      });
    }
  }
);

/**
 * @route GET /api/statistics/top-courses
 * @desc Get top performing courses by enrollments
 * @access Admin+ (filtered by accessible regions)
 */
router.get(
  '/top-courses',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.attachRoleInfo,
  async (req, res) => {
    try {
      const { limit = 10 } = req.query;
      const isSuperAdmin = req.userRole?.isSuperAdmin || false;
      const assignedRegions = req.assignedRegions || [];

      let query = `
        SELECT
          c.id,
          c.title,
          c.code,
          r.name AS region_name,
          COUNT(DISTINCT cre.id) AS total_enrollments,
          COUNT(DISTINCT CASE WHEN cre.status = 'completed' THEN cre.id END) AS completions,
          AVG(cre.progress_percentage) AS avg_progress,
          ROUND(
            (COUNT(DISTINCT CASE WHEN cre.status = 'completed' THEN cre.id END)::decimal /
             NULLIF(COUNT(DISTINCT cre.id), 0) * 100), 2
          ) AS completion_rate
        FROM courses c
        LEFT JOIN regions r ON c.region_id = r.id
        LEFT JOIN course_region_enrollments cre ON c.id = cre.course_id
      `;

      const params = [];
      if (!isSuperAdmin && assignedRegions.length > 0) {
        query += ' WHERE c.region_id = ANY($1::int[])';
        params.push(assignedRegions);
      }

      query += ` GROUP BY c.id, c.title, c.code, r.name ORDER BY total_enrollments DESC LIMIT $${params.length + 1}`;
      params.push(parseInt(limit));

      const result = await postgresService.query(query, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Error fetching top courses:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch top courses'
      });
    }
  }
);

/**
 * @route GET /api/statistics/export
 * @desc Export statistics report (CSV format)
 * @access Admin+
 */
router.get(
  '/export',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.attachRoleInfo,
  async (req, res) => {
    try {
      const { reportType = 'overview' } = req.query;
      const isSuperAdmin = req.userRole?.isSuperAdmin || false;
      const assignedRegions = req.assignedRegions || [];

      let csvData = '';
      let filename = `report_${Date.now()}.csv`;

      switch (reportType) {
        case 'enrollments':
          // Export enrollments report
          let query = `
            SELECT
              cre.id,
              u.name AS user_name,
              u.whatsapp_id,
              c.title AS course_title,
              r.name AS region_name,
              cre.status,
              cre.progress_percentage,
              cre.enrolled_at,
              a.name AS enrolled_by
            FROM course_region_enrollments cre
            JOIN users u ON cre.user_id = u.id
            JOIN courses c ON cre.course_id = c.id
            LEFT JOIN regions r ON c.region_id = r.id
            LEFT JOIN admin_users a ON cre.enrolled_by = a.id
          `;

          const params = [];
          if (!isSuperAdmin && assignedRegions.length > 0) {
            query += ' WHERE c.region_id = ANY($1::int[])';
            params.push(assignedRegions);
          }

          query += ' ORDER BY cre.enrolled_at DESC';

          const result = await postgresService.query(query, params);

          // Generate CSV
          csvData = 'ID,User Name,WhatsApp Number,Course,Region,Status,Progress %,Enrolled At,Enrolled By\n';
          result.rows.forEach(row => {
            csvData += `${row.id},"${row.user_name}",${row.whatsapp_id},"${row.course_title}","${row.region_name}",${row.status},${row.progress_percentage || 0},"${row.enrolled_at}","${row.enrolled_by}"\n`;
          });

          filename = `enrollments_report_${Date.now()}.csv`;
          break;

        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid report type'
          });
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.send(csvData);
    } catch (error) {
      logger.error('Error exporting statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export statistics'
      });
    }
  }
);

module.exports = router;
