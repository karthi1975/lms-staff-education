const express = require('express');
const router = express.Router();
const coachingEngine = require('../services/coaching/coaching-engine.service');
const nudgingService = require('../services/coaching/nudging.service');
const reflectionService = require('../services/coaching/reflection.service');
const authMiddleware = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

// ==================== NUDGING ENDPOINTS ====================

/**
 * @route POST /api/coaching/nudges/send-all
 * @desc Trigger nudge check for all users (manual trigger)
 * @access Admin
 */
router.post('/nudges/send-all', authMiddleware.authenticateToken, async (req, res) => {
  try {
    logger.info('Manual nudge trigger initiated by admin');

    const results = await nudgingService.checkAndSendNudges();

    res.json({
      success: true,
      message: `Nudge check completed. ${results.total_sent} nudges sent.`,
      data: results
    });
  } catch (error) {
    logger.error('Error sending nudges:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/coaching/nudges/send/:userId
 * @desc Send personalized nudge to a specific user
 * @access Admin
 */
router.post('/nudges/send/:userId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { nudgeType, variables } = req.body;

    const UserModel = require('../models/user.model');
    const user = await UserModel.findById(parseInt(userId));

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const sent = await nudgingService.sendNudge(user, nudgeType || 'welcome_back', variables || {});

    if (sent) {
      res.json({
        success: true,
        message: `Nudge sent to ${user.name}`,
        data: { userId: user.id, nudgeType }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to send nudge'
      });
    }
  } catch (error) {
    logger.error('Error sending nudge to user:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/coaching/nudges/milestone/:userId
 * @desc Celebrate a milestone for a user
 * @access Admin
 */
router.post('/nudges/milestone/:userId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { milestone } = req.body;

    if (!milestone) {
      return res.status(400).json({
        success: false,
        error: 'Milestone description is required'
      });
    }

    const sent = await nudgingService.celebrateMilestone(parseInt(userId), milestone);

    if (sent) {
      res.json({
        success: true,
        message: 'Milestone celebration sent',
        data: { userId, milestone }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to send milestone celebration'
      });
    }
  } catch (error) {
    logger.error('Error celebrating milestone:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/coaching/nudges/stats
 * @desc Get nudging statistics
 * @access Admin
 */
router.get('/nudges/stats', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const neo4jService = require('../services/neo4j.service');

    // Get nudge statistics from Neo4j
    const stats = await neo4jService.getNudgeStatistics();

    res.json({
      success: true,
      data: stats || {
        total_nudges_sent: 0,
        nudges_by_type: {},
        response_rate: 0,
        average_time_to_response: 0
      }
    });
  } catch (error) {
    logger.error('Error fetching nudge stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== REFLECTION ENDPOINTS ====================

/**
 * @route POST /api/coaching/reflections/prompt/:userId
 * @desc Generate and send a reflection prompt to a user
 * @access Admin
 */
router.post('/reflections/prompt/:userId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { context } = req.body;

    const promptData = await reflectionService.generateReflectionPrompt(
      parseInt(userId),
      context || {}
    );

    res.json({
      success: true,
      message: 'Reflection prompt generated',
      data: promptData
    });
  } catch (error) {
    logger.error('Error generating reflection prompt:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/coaching/reflections/submit/:userId
 * @desc Process a user's reflection response
 * @access Admin or User
 */
router.post('/reflections/submit/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { reflection, promptType } = req.body;

    if (!reflection) {
      return res.status(400).json({
        success: false,
        error: 'Reflection text is required'
      });
    }

    const result = await reflectionService.processReflection(
      parseInt(userId),
      reflection,
      promptType || 'general'
    );

    res.json({
      success: true,
      message: 'Reflection processed successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error processing reflection:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/coaching/reflections/history/:userId
 * @desc Get reflection history for a user
 * @access Admin
 */
router.get('/reflections/history/:userId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const history = await reflectionService.getReflectionHistory(parseInt(userId), limit);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error('Error fetching reflection history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/coaching/reflections/report/:userId
 * @desc Generate comprehensive progress report with reflections
 * @access Admin
 */
router.get('/reflections/report/:userId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const report = await reflectionService.generateProgressReport(parseInt(userId));

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Error generating progress report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/coaching/reflections/schedule/:userId
 * @desc Schedule reflection reminders for a user
 * @access Admin
 */
router.post('/reflections/schedule/:userId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { frequency } = req.body;

    if (!frequency || !['weekly', 'biweekly', 'monthly', 'module_end'].includes(frequency)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid frequency. Must be: weekly, biweekly, monthly, or module_end'
      });
    }

    const config = await reflectionService.scheduleReflectionReminders(
      parseInt(userId),
      frequency
    );

    res.json({
      success: true,
      message: `Reflection reminders scheduled: ${frequency}`,
      data: config
    });
  } catch (error) {
    logger.error('Error scheduling reflection reminders:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== COACHING ENGINE ENDPOINTS ====================

/**
 * @route GET /api/coaching/engagement/:userId
 * @desc Analyze user engagement and get coaching insights
 * @access Admin
 */
router.get('/engagement/:userId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const engagement = await coachingEngine.analyzeEngagement(parseInt(userId));

    res.json({
      success: true,
      data: engagement
    });
  } catch (error) {
    logger.error('Error analyzing engagement:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/coaching/recommendations/:userId
 * @desc Get personalized learning recommendations
 * @access Admin
 */
router.get('/recommendations/:userId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const recommendations = await coachingEngine.getRecommendations(parseInt(userId));

    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    logger.error('Error getting recommendations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/coaching/adaptive/:userId
 * @desc Provide adaptive coaching based on user behavior
 * @access Admin
 */
router.post('/adaptive/:userId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { context } = req.body;

    const coaching = await coachingEngine.provideAdaptiveCoaching(
      parseInt(userId),
      context || {}
    );

    res.json({
      success: true,
      data: coaching
    });
  } catch (error) {
    logger.error('Error providing adaptive coaching:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/coaching/analytics/overview
 * @desc Get coaching analytics overview for all users
 * @access Admin
 */
router.get('/analytics/overview', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const neo4jService = require('../services/neo4j.service');

    // Get overall coaching analytics
    const analytics = await neo4jService.getCoachingAnalytics();

    res.json({
      success: true,
      data: analytics || {
        total_users: 0,
        engagement_distribution: {},
        reflection_stats: {},
        nudge_effectiveness: {}
      }
    });
  } catch (error) {
    logger.error('Error fetching coaching analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/coaching/analytics/trends
 * @desc Get engagement and coaching trends over time
 * @access Admin
 */
router.get('/analytics/trends', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { days } = req.query;
    const daysBack = parseInt(days) || 30;

    const neo4jService = require('../services/neo4j.service');
    const trends = await neo4jService.getEngagementTrends(daysBack);

    res.json({
      success: true,
      data: trends || {
        daily_engagement: [],
        nudge_response_rates: [],
        reflection_frequency: []
      }
    });
  } catch (error) {
    logger.error('Error fetching coaching trends:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
