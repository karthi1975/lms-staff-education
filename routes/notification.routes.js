/**
 * WhatsApp Notification Routes
 * Multi-Region RBAC System - WhatsApp Notification Management
 *
 * Features:
 * - Send individual notifications
 * - Send bulk notifications
 * - Bilingual support (English, Swahili, Both)
 * - Rate limiting (60 messages/minute)
 * - Notification history and logs
 * - Delivery status tracking
 * - Template-based messages
 */

const express = require('express');
const router = express.Router();
const whatsAppNotificationService = require('../services/whatsapp-region-notification.service');
const rbacService = require('../services/rbac.service');
const postgresService = require('../services/database/postgres.service');
const authMiddleware = require('../middleware/auth.middleware');
const rbacMiddleware = require('../middleware/rbac.middleware');
const logger = require('../utils/logger');

/**
 * @route POST /api/notifications/send
 * @desc Send a WhatsApp notification to a user
 * @access Admin+
 * @body { userId, messageType, courseId?, messageData, languagePreference? }
 */
router.post(
  '/send',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateRequiredFields(['userId', 'messageType', 'messageData']),
  async (req, res) => {
    try {
      const { userId, messageType, courseId, messageData, languagePreference } = req.body;

      // Validate user exists and admin has access
      const userQuery = 'SELECT u.*, c.region_id FROM users u LEFT JOIN courses c ON u.primary_region_id = c.region_id WHERE u.id = $1';
      const userResult = await postgresService.query(userQuery, [userId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const user = userResult.rows[0];

      // Check regional access
      const hasAccess = await rbacService.hasRegionAccess(req.user.id, user.primary_region_id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'You do not have access to send notifications to this user'
        });
      }

      // Send notification
      const result = await whatsAppNotificationService.sendNotification({
        userId: parseInt(userId),
        messageType,
        courseId: courseId ? parseInt(courseId) : null,
        messageData,
        sentBy: req.user.id,
        languagePreference: languagePreference || 'english'
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      logger.info(`Notification sent to user ${userId} by admin ${req.user.id}`);

      res.json({
        success: true,
        message: 'Notification sent successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error sending notification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send notification'
      });
    }
  }
);

/**
 * @route POST /api/notifications/bulk-send
 * @desc Send bulk notifications to multiple users
 * @access Admin+
 * @body { userIds: number[], messageType, courseId?, messageData, languagePreference? }
 */
router.post(
  '/bulk-send',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateRequiredFields(['userIds', 'messageType', 'messageData']),
  async (req, res) => {
    try {
      const { userIds, messageType, courseId, messageData, languagePreference } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'userIds must be a non-empty array'
        });
      }

      // Validate users and filter by admin's accessible regions
      const userQuery = `
        SELECT u.id, u.primary_region_id
        FROM users u
        WHERE u.id = ANY($1::int[]) AND u.is_active = TRUE
      `;
      const userResult = await postgresService.query(userQuery, [userIds]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No valid users found'
        });
      }

      // Filter users by regional access
      const accessibleUsers = [];
      for (const user of userResult.rows) {
        const hasAccess = await rbacService.hasRegionAccess(req.user.id, user.primary_region_id);
        if (hasAccess) {
          accessibleUsers.push(user.id);
        }
      }

      if (accessibleUsers.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'You do not have access to send notifications to any of these users'
        });
      }

      // Prepare notifications
      const notifications = accessibleUsers.map(userId => ({
        userId,
        messageType,
        courseId: courseId ? parseInt(courseId) : null,
        messageData,
        sentBy: req.user.id,
        languagePreference: languagePreference || 'english'
      }));

      // Send bulk notifications
      const result = await whatsAppNotificationService.sendBulkNotifications(notifications);

      logger.info(`Bulk notification: ${result.successful}/${notifications.length} sent by admin ${req.user.id}`);

      res.json({
        success: true,
        message: `${result.successful} notifications sent successfully`,
        data: result,
        requestedUsers: userIds.length,
        accessibleUsers: accessibleUsers.length
      });
    } catch (error) {
      logger.error('Error sending bulk notifications:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send bulk notifications'
      });
    }
  }
);

/**
 * @route POST /api/notifications/enrollment/:userId/:courseId
 * @desc Send enrollment notification to a user
 * @access Admin+
 */
router.post(
  '/enrollment/:userId/:courseId',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const courseId = parseInt(req.params.courseId);

      // Validate enrollment exists and admin has access
      const enrollmentQuery = `
        SELECT cre.id, c.region_id
        FROM course_region_enrollments cre
        JOIN courses c ON cre.course_id = c.id
        WHERE cre.user_id = $1 AND cre.course_id = $2
      `;
      const enrollmentResult = await postgresService.query(enrollmentQuery, [userId, courseId]);

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

      // Send enrollment notification
      const result = await whatsAppNotificationService.sendEnrollmentNotification(
        userId,
        courseId,
        req.user.id
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      logger.info(`Enrollment notification sent for user ${userId} in course ${courseId} by admin ${req.user.id}`);

      res.json({
        success: true,
        message: 'Enrollment notification sent successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error sending enrollment notification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send enrollment notification'
      });
    }
  }
);

/**
 * @route GET /api/notifications/user/:userId/history
 * @desc Get notification history for a user
 * @access Admin+ (with regional access validation)
 */
router.get(
  '/user/:userId/history',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { limit = 50 } = req.query;

      // Check user exists and admin has access
      const userQuery = 'SELECT id, primary_region_id FROM users WHERE id = $1';
      const userResult = await postgresService.query(userQuery, [userId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const hasAccess = await rbacService.hasRegionAccess(
        req.user.id,
        userResult.rows[0].primary_region_id
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'You do not have access to this user'
        });
      }

      // Get notification history
      const history = await whatsAppNotificationService.getUserNotificationHistory(
        userId,
        parseInt(limit)
      );

      res.json({
        success: true,
        userId,
        data: history,
        totalNotifications: history.length
      });
    } catch (error) {
      logger.error(`Error fetching notification history for user ${req.params.userId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notification history'
      });
    }
  }
);

/**
 * @route GET /api/notifications/stats
 * @desc Get notification statistics
 * @access Admin+
 */
router.get(
  '/stats',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.attachRoleInfo,
  async (req, res) => {
    try {
      const { courseId, userId, messageType, startDate, endDate } = req.query;

      const filters = {};

      if (courseId) filters.courseId = parseInt(courseId);
      if (userId) filters.userId = parseInt(userId);
      if (messageType) filters.messageType = messageType;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      // For Regional Admins, filter by their courses
      if (req.userRole && !req.userRole.isSuperAdmin) {
        // This would require additional filtering logic based on courses in their region
        // For now, we'll get all stats and let the service handle it
      }

      const stats = await whatsAppNotificationService.getNotificationStats(filters);

      res.json({
        success: true,
        data: stats,
        filters: filters
      });
    } catch (error) {
      logger.error('Error fetching notification stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notification statistics'
      });
    }
  }
);

/**
 * @route GET /api/notifications/course/:courseId/stats
 * @desc Get notification statistics for a course
 * @access Admin+ (with course access validation)
 */
router.get(
  '/course/:courseId/stats',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateCourseAccess,
  async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);

      const stats = await whatsAppNotificationService.getNotificationStats({
        courseId
      });

      res.json({
        success: true,
        courseId,
        data: stats
      });
    } catch (error) {
      logger.error(`Error fetching notification stats for course ${req.params.courseId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch course notification statistics'
      });
    }
  }
);

/**
 * @route GET /api/notifications/region/:regionId/stats
 * @desc Get notification statistics for a region
 * @access Admin+ (with region access validation)
 */
router.get(
  '/region/:regionId/stats',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateRegionAccess,
  async (req, res) => {
    try {
      const regionId = parseInt(req.params.regionId);

      // Get all course IDs in this region
      const coursesQuery = 'SELECT id FROM courses WHERE region_id = $1';
      const coursesResult = await postgresService.query(coursesQuery, [regionId]);

      const courseIds = coursesResult.rows.map(row => row.id);

      if (courseIds.length === 0) {
        return res.json({
          success: true,
          regionId,
          data: {
            total: 0,
            pending: 0,
            sent: 0,
            delivered: 0,
            failed: 0
          }
        });
      }

      // Get stats for all courses in region
      const statsQuery = `
        SELECT delivery_status, COUNT(*) as count
        FROM whatsapp_notifications
        WHERE course_id = ANY($1::int[])
        GROUP BY delivery_status
      `;
      const statsResult = await postgresService.query(statsQuery, [courseIds]);

      const stats = {
        total: 0,
        pending: 0,
        sent: 0,
        delivered: 0,
        failed: 0
      };

      statsResult.rows.forEach(row => {
        stats[row.delivery_status] = parseInt(row.count);
        stats.total += parseInt(row.count);
      });

      res.json({
        success: true,
        regionId,
        data: stats
      });
    } catch (error) {
      logger.error(`Error fetching notification stats for region ${req.params.regionId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch region notification statistics'
      });
    }
  }
);

/**
 * @route GET /api/notifications/templates
 * @desc Get available notification templates
 * @access Admin+
 */
router.get(
  '/templates',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          messageTypes: [
            {
              value: 'enrollment',
              label: 'Enrollment Notification',
              description: 'Sent when a user is enrolled in a course',
              requiresCourse: true
            },
            {
              value: 'course_update',
              label: 'Course Update',
              description: 'Notify users about course changes or updates',
              requiresCourse: true
            },
            {
              value: 'reminder',
              label: 'Reminder',
              description: 'Send reminders to complete modules or activities',
              requiresCourse: true
            },
            {
              value: 'custom',
              label: 'Custom Message',
              description: 'Send a custom message',
              requiresCourse: false
            }
          ],
          languageOptions: [
            {
              value: 'english',
              label: 'English Only'
            },
            {
              value: 'swahili',
              label: 'Swahili Only (Kiswahili)'
            },
            {
              value: 'bilingual',
              label: 'Bilingual (English & Swahili)'
            }
          ],
          rateLimits: {
            messagesPerMinute: 60,
            windowMs: 60000
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching notification templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notification templates'
      });
    }
  }
);

/**
 * @route GET /api/notifications/recent
 * @desc Get recent notifications (admin's accessible regions)
 * @access Admin+
 */
router.get(
  '/recent',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.attachRoleInfo,
  async (req, res) => {
    try {
      const { limit = 50 } = req.query;

      let query = `
        SELECT
          wn.*,
          u.name AS user_name,
          u.whatsapp_id,
          c.title AS course_title,
          c.region_id,
          a.name AS sent_by_name
        FROM whatsapp_notifications wn
        JOIN users u ON wn.user_id = u.id
        LEFT JOIN courses c ON wn.course_id = c.id
        LEFT JOIN admin_users a ON wn.sent_by = a.id
        WHERE 1=1
      `;

      const params = [];

      // Filter by accessible regions for Regional Admins
      if (req.userRole && !req.userRole.isSuperAdmin && req.assignedRegions) {
        query += ' AND (c.region_id = ANY($1::int[]) OR c.region_id IS NULL)';
        params.push(req.assignedRegions);
      }

      query += ` ORDER BY wn.sent_at DESC LIMIT $${params.length + 1}`;
      params.push(parseInt(limit));

      const result = await postgresService.query(query, params);

      res.json({
        success: true,
        data: result.rows,
        totalNotifications: result.rows.length
      });
    } catch (error) {
      logger.error('Error fetching recent notifications:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch recent notifications'
      });
    }
  }
);

module.exports = router;
