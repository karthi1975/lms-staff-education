/**
 * Coaching Mode Routes
 * API endpoints for dual coaching mode functionality
 *
 * User Endpoints: 8 endpoints
 * Admin Endpoints: 5 endpoints (RBAC protected)
 * Analytics Endpoints: 2 endpoints (RBAC protected)
 */

const express = require('express');
const router = express.Router();
const coachingModeService = require('../services/coaching/coaching-mode.service');
const promptTemplateService = require('../services/coaching/prompt-template.service');
const { authenticateToken } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/rbac.middleware');
const logger = require('../utils/logger');

// Initialize service
coachingModeService.initialize().catch(err => {
  logger.error('Failed to initialize CoachingModeService:', err);
});

// ============================================
// USER ENDPOINTS (8)
// ============================================

/**
 * GET /api/coaching-mode/config/:courseId
 * Get course bot configuration (public)
 */
router.get('/config/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;

    const config = await coachingModeService.getCourseConfig(parseInt(courseId));

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Course configuration not found'
      });
    }

    // Return public fields only
    res.json({
      success: true,
      data: {
        course_id: config.course_id,
        default_mode: config.default_mode,
        allow_mode_switching: config.allow_mode_switching,
        switch_cooldown_minutes: config.switch_cooldown_minutes,
        regular_greeting: config.regular_greeting,
        regular_help_text: config.regular_help_text,
        socratic_greeting: config.socratic_greeting,
        socratic_help_text: config.socratic_help_text
      }
    });
  } catch (error) {
    logger.error('Error getting course config:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving course configuration'
    });
  }
});

/**
 * POST /api/coaching-mode/switch
 * Switch user mode
 * Body: { userId, courseId, mode }
 */
router.post('/switch', async (req, res) => {
  try {
    const { userId, courseId, mode } = req.body;

    if (!userId || !courseId || !mode) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, courseId, mode'
      });
    }

    const result = await coachingModeService.switchMode(
      parseInt(userId),
      parseInt(courseId),
      mode
    );

    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    logger.error('Error switching mode:', error);
    res.status(500).json({
      success: false,
      message: 'Error switching mode'
    });
  }
});

/**
 * GET /api/coaching-mode/preference/:userId/:courseId
 * Get user preference
 */
router.get('/preference/:userId/:courseId', async (req, res) => {
  try {
    const { userId, courseId } = req.params;

    const preference = await coachingModeService.getUserPreference(
      parseInt(userId),
      parseInt(courseId)
    );

    if (!preference) {
      return res.status(404).json({
        success: false,
        message: 'User preference not found'
      });
    }

    res.json({
      success: true,
      data: preference
    });
  } catch (error) {
    logger.error('Error getting user preference:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving user preference'
    });
  }
});

/**
 * POST /api/coaching-mode/session/start
 * Start a coaching session
 * Body: { userId, courseId }
 */
router.post('/session/start', async (req, res) => {
  try {
    const { userId, courseId } = req.body;

    if (!userId || !courseId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, courseId'
      });
    }

    const session = await coachingModeService.startSession(
      parseInt(userId),
      parseInt(courseId)
    );

    res.status(201).json({
      success: true,
      message: 'Session started successfully',
      data: session
    });
  } catch (error) {
    logger.error('Error starting session:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting session'
    });
  }
});

/**
 * POST /api/coaching-mode/session/end
 * End a coaching session
 * Body: { sessionId, status, metrics }
 */
router.post('/session/end', async (req, res) => {
  try {
    const { sessionId, status = 'completed', metrics = {} } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: sessionId'
      });
    }

    const session = await coachingModeService.endSession(
      parseInt(sessionId),
      status,
      metrics
    );

    res.json({
      success: true,
      message: 'Session ended successfully',
      data: session
    });
  } catch (error) {
    logger.error('Error ending session:', error);
    res.status(500).json({
      success: false,
      message: 'Error ending session'
    });
  }
});

/**
 * POST /api/coaching-mode/session/message
 * Log a message in session
 * Body: { sessionId, isQuestion }
 */
router.post('/session/message', async (req, res) => {
  try {
    const { sessionId, isQuestion = false } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: sessionId'
      });
    }

    await coachingModeService.logSessionMessage(
      parseInt(sessionId),
      isQuestion
    );

    res.json({
      success: true,
      message: 'Message logged successfully'
    });
  } catch (error) {
    logger.error('Error logging session message:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging message'
    });
  }
});

/**
 * GET /api/coaching-mode/session/history/:userId
 * Get user's session history
 * Query params: ?courseId, ?limit, ?mode
 */
router.get('/session/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { courseId, limit = 10, mode } = req.query;

    const postgresService = require('../services/database/postgres.service');

    let query = `
      SELECT * FROM coaching_sessions
      WHERE user_id = $1
    `;
    const params = [parseInt(userId)];
    let paramIndex = 2;

    if (courseId) {
      query += ` AND course_id = $${paramIndex}`;
      params.push(parseInt(courseId));
      paramIndex++;
    }

    if (mode) {
      query += ` AND mode_used = $${paramIndex}`;
      params.push(mode);
      paramIndex++;
    }

    query += ` ORDER BY session_start DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await postgresService.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    logger.error('Error getting session history:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving session history'
    });
  }
});

/**
 * GET /api/coaching-mode/commands
 * Get available WhatsApp commands
 */
router.get('/commands', async (req, res) => {
  try {
    const commands = coachingModeService.getAvailableCommands();

    res.json({
      success: true,
      data: commands
    });
  } catch (error) {
    logger.error('Error getting commands:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving commands'
    });
  }
});

// ============================================
// ADMIN ENDPOINTS (5) - RBAC Protected
// ============================================

/**
 * POST /api/admin/coaching-mode/config
 * Create or update course bot configuration
 * Body: { courseId, config }
 * Requires: Admin role
 */
router.post('/admin/config', authenticateToken, checkRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { courseId, config } = req.body;
    const adminId = req.user.id;

    if (!courseId || !config) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: courseId, config'
      });
    }

    const result = await coachingModeService.setCourseConfig(
      parseInt(courseId),
      config,
      adminId
    );

    res.status(201).json({
      success: true,
      message: 'Configuration created/updated successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error creating/updating config:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving configuration'
    });
  }
});

/**
 * PUT /api/admin/coaching-mode/config/:id
 * Update course bot configuration by ID
 * Body: { config }
 * Requires: Admin role
 */
router.put('/admin/config/:id', authenticateToken, checkRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { config } = req.body;
    const adminId = req.user.id;

    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: config'
      });
    }

    // Get existing config to find courseId
    const postgresService = require('../services/database/postgres.service');
    const existing = await postgresService.query(
      'SELECT course_id FROM course_bot_configs WHERE id = $1',
      [parseInt(id)]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found'
      });
    }

    const courseId = existing.rows[0].course_id;

    const result = await coachingModeService.setCourseConfig(
      courseId,
      config,
      adminId
    );

    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error updating config:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating configuration'
    });
  }
});

/**
 * GET /api/admin/coaching-mode/config/:courseId
 * Get full course bot configuration (including prompts)
 * Requires: Admin role
 */
router.get('/admin/config/:courseId', authenticateToken, checkRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { courseId } = req.params;

    const config = await coachingModeService.getCourseConfig(parseInt(courseId));

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Course configuration not found'
      });
    }

    // Return all fields for admins
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Error getting config:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving configuration'
    });
  }
});

/**
 * DELETE /api/admin/coaching-mode/config/:id
 * Delete course bot configuration
 * Requires: Super Admin role
 */
router.delete('/admin/config/:id', authenticateToken, checkRole(['super_admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const postgresService = require('../services/database/postgres.service');
    const result = await postgresService.query(
      'DELETE FROM course_bot_configs WHERE id = $1 RETURNING *',
      [parseInt(id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found'
      });
    }

    res.json({
      success: true,
      message: 'Configuration deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error deleting config:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting configuration'
    });
  }
});

/**
 * POST /api/admin/coaching-mode/seed-defaults
 * Seed default configurations for all active courses
 * Requires: Super Admin role
 */
router.post('/admin/seed-defaults', authenticateToken, checkRole(['super_admin']), async (req, res) => {
  try {
    const postgresService = require('../services/database/postgres.service');
    const adminId = req.user.id;

    // Get all active courses without configs
    const coursesQuery = `
      SELECT c.id, c.title, c.code
      FROM courses c
      WHERE c.is_active = TRUE
        AND c.id NOT IN (SELECT course_id FROM course_bot_configs)
    `;

    const courses = await postgresService.query(coursesQuery);

    if (courses.rows.length === 0) {
      return res.json({
        success: true,
        message: 'All active courses already have configurations',
        count: 0
      });
    }

    // Insert default configs
    const insertQuery = `
      INSERT INTO course_bot_configs (course_id, created_by)
      SELECT id, $1 FROM courses
      WHERE is_active = TRUE
        AND id NOT IN (SELECT course_id FROM course_bot_configs)
      RETURNING *
    `;

    const result = await postgresService.query(insertQuery, [adminId]);

    res.json({
      success: true,
      message: `Default configurations created for ${result.rows.length} courses`,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error seeding defaults:', error);
    res.status(500).json({
      success: false,
      message: 'Error seeding default configurations'
    });
  }
});

// ============================================
// ANALYTICS ENDPOINTS (2) - RBAC Protected
// ============================================

/**
 * GET /api/admin/coaching-mode/analytics/:courseId
 * Get mode analytics for a course
 * Query params: ?startDate, ?endDate
 * Requires: Admin role
 */
router.get('/admin/analytics/:courseId', authenticateToken, checkRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { courseId } = req.params;
    const { startDate, endDate } = req.query;

    // Default to last 30 days if not specified
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end - 30 * 24 * 60 * 60 * 1000);

    const analytics = await coachingModeService.generateModeAnalytics(
      parseInt(courseId),
      start,
      end
    );

    res.json({
      success: true,
      data: {
        course_id: parseInt(courseId),
        period: {
          start: start.toISOString(),
          end: end.toISOString()
        },
        analytics: analytics
      }
    });
  } catch (error) {
    logger.error('Error getting analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving analytics'
    });
  }
});

/**
 * POST /api/admin/coaching-mode/analytics/generate
 * Generate and save analytics for a period
 * Body: { courseId, startDate, endDate }
 * Requires: Admin role
 */
router.post('/admin/analytics/generate', authenticateToken, checkRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { courseId, startDate, endDate } = req.body;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: courseId'
      });
    }

    // Default to last 30 days if not specified
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end - 30 * 24 * 60 * 60 * 1000);

    const analytics = await coachingModeService.saveModeAnalytics(
      parseInt(courseId),
      start,
      end
    );

    res.status(201).json({
      success: true,
      message: 'Analytics generated and saved successfully',
      data: {
        course_id: parseInt(courseId),
        period: {
          start: start.toISOString(),
          end: end.toISOString()
        },
        analytics: analytics
      }
    });
  } catch (error) {
    logger.error('Error generating analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating analytics'
    });
  }
});

module.exports = router;
