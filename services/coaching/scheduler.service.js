/**
 * Coaching Scheduler Service
 * Handles automated nudge delivery and reflection reminders
 */

const nudgingService = require('./nudging.service');
const logger = require('../../utils/logger');

class CoachingScheduler {
  constructor() {
    this.timers = {};
    this.config = {
      // Check for nudges every 6 hours
      nudgeCheckInterval: parseInt(process.env.NUDGE_CHECK_INTERVAL_HOURS || '6') * 60 * 60 * 1000,

      // Send daily tips at 9 AM
      dailyTipHour: parseInt(process.env.DAILY_TIP_HOUR || '9'),

      // Enabled by default
      enabled: process.env.COACHING_SCHEDULER_ENABLED !== 'false'
    };
  }

  /**
   * Start all scheduled tasks
   */
  start() {
    if (!this.config.enabled) {
      logger.info('Coaching scheduler is disabled');
      return;
    }

    logger.info('Starting coaching scheduler...');

    // 1. Schedule nudge checks (every 6 hours)
    this.scheduleNudgeChecks();

    // 2. Schedule daily tips (once per day at specified hour)
    this.scheduleDailyTips();

    logger.info('Coaching scheduler started successfully');
  }

  /**
   * Stop all scheduled tasks
   */
  stop() {
    logger.info('Stopping coaching scheduler...');

    Object.keys(this.timers).forEach(key => {
      if (this.timers[key]) {
        clearInterval(this.timers[key]);
        clearTimeout(this.timers[key]);
      }
    });

    this.timers = {};
    logger.info('Coaching scheduler stopped');
  }

  /**
   * Schedule periodic nudge checks
   */
  scheduleNudgeChecks() {
    // Run immediately on startup
    this.runNudgeCheck();

    // Then run every X hours
    this.timers.nudgeCheck = setInterval(() => {
      this.runNudgeCheck();
    }, this.config.nudgeCheckInterval);

    logger.info(`Nudge checks scheduled every ${this.config.nudgeCheckInterval / (60 * 60 * 1000)} hours`);
  }

  /**
   * Run nudge check process
   */
  async runNudgeCheck() {
    try {
      logger.info('🔔 Running automated nudge check...');

      const startTime = Date.now();
      const results = await nudgingService.checkAndSendNudges();
      const duration = Date.now() - startTime;

      logger.info(`✅ Nudge check completed in ${duration}ms. Sent ${results.total_sent} nudges.`, {
        total_sent: results.total_sent,
        details: results.details,
        duration_ms: duration
      });

      // Track this event
      await this.logScheduledEvent('nudge_check', {
        total_sent: results.total_sent,
        duration_ms: duration,
        details: results.details
      });

    } catch (error) {
      logger.error('Error running nudge check:', error);
      await this.logScheduledEvent('nudge_check_error', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Schedule daily tips
   */
  scheduleDailyTips() {
    // Calculate time until next scheduled hour
    const now = new Date();
    const targetHour = this.config.dailyTipHour;
    const target = new Date(now);

    target.setHours(targetHour, 0, 0, 0);

    // If target is in the past, move to tomorrow
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    const timeUntilTarget = target.getTime() - now.getTime();

    logger.info(`Daily tips scheduled for ${target.toLocaleString()} (in ${Math.round(timeUntilTarget / 1000 / 60)} minutes)`);

    // Schedule first run
    this.timers.dailyTipInitial = setTimeout(() => {
      this.runDailyTips();

      // Then schedule every 24 hours
      this.timers.dailyTip = setInterval(() => {
        this.runDailyTips();
      }, 24 * 60 * 60 * 1000);

    }, timeUntilTarget);
  }

  /**
   * Run daily tips process
   */
  async runDailyTips() {
    try {
      logger.info('💡 Running automated daily tips...');

      const startTime = Date.now();

      // This would be called from nudgingService
      // For now, we'll just log it as a placeholder
      logger.info('Daily tips functionality ready (implement specific logic in nudgingService)');

      const duration = Date.now() - startTime;

      await this.logScheduledEvent('daily_tips', {
        duration_ms: duration
      });

    } catch (error) {
      logger.error('Error running daily tips:', error);
      await this.logScheduledEvent('daily_tips_error', {
        error: error.message
      });
    }
  }

  /**
   * Schedule reflection reminders (called when user opts in)
   */
  scheduleReflectionReminder(userId, frequency = 'weekly') {
    const intervals = {
      weekly: 7 * 24 * 60 * 60 * 1000,
      biweekly: 14 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000
    };

    const interval = intervals[frequency] || intervals.weekly;
    const timerKey = `reflection_${userId}`;

    // Clear existing timer if any
    if (this.timers[timerKey]) {
      clearInterval(this.timers[timerKey]);
    }

    // Schedule new timer
    this.timers[timerKey] = setInterval(async () => {
      await this.sendReflectionReminder(userId);
    }, interval);

    logger.info(`Reflection reminder scheduled for user ${userId}: ${frequency}`);

    return {
      userId,
      frequency,
      interval_ms: interval,
      next_reminder: new Date(Date.now() + interval).toISOString()
    };
  }

  /**
   * Send reflection reminder to user
   */
  async sendReflectionReminder(userId) {
    try {
      logger.info(`Sending reflection reminder to user ${userId}`);

      const reflectionService = require('./reflection.service');
      const UserModel = require('../../models/user.model');
      const whatsappService = require('../whatsapp.service');

      // Get user
      const user = await UserModel.findById(userId);
      if (!user) {
        logger.warn(`User ${userId} not found for reflection reminder`);
        return;
      }

      // Generate reflection prompt
      const promptData = await reflectionService.generateReflectionPrompt(userId, {
        scheduled: true
      });

      // Send via WhatsApp
      const message = `
📝 *Reflection Time!*

Hi ${user.name}! Time for your learning reflection.

${promptData.prompt}

Please take a few moments to reflect on your progress. Reply with your thoughts!
      `.trim();

      await whatsappService.sendMessage(user.whatsapp_id, message);

      logger.info(`Reflection reminder sent to user ${userId}`);

      await this.logScheduledEvent('reflection_reminder_sent', {
        user_id: userId,
        prompt_type: promptData.type
      });

    } catch (error) {
      logger.error(`Error sending reflection reminder to user ${userId}:`, error);
      await this.logScheduledEvent('reflection_reminder_error', {
        user_id: userId,
        error: error.message
      });
    }
  }

  /**
   * Cancel reflection reminder for a user
   */
  cancelReflectionReminder(userId) {
    const timerKey = `reflection_${userId}`;

    if (this.timers[timerKey]) {
      clearInterval(this.timers[timerKey]);
      delete this.timers[timerKey];
      logger.info(`Reflection reminder cancelled for user ${userId}`);
      return true;
    }

    return false;
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      active_timers: Object.keys(this.timers).length,
      configuration: {
        nudge_check_interval_hours: this.config.nudgeCheckInterval / (60 * 60 * 1000),
        daily_tip_hour: this.config.dailyTipHour
      },
      timers: Object.keys(this.timers).map(key => ({
        key,
        type: key.includes('reflection') ? 'reflection_reminder' : 'scheduled_task'
      }))
    };
  }

  /**
   * Log scheduled event for analytics
   */
  async logScheduledEvent(eventType, data) {
    try {
      const neo4jService = require('../neo4j.service');

      await neo4jService.logSystemEvent({
        event_type: eventType,
        timestamp: new Date().toISOString(),
        ...data
      });
    } catch (error) {
      // Don't fail on logging errors
      logger.warn('Failed to log scheduled event:', error.message);
    }
  }

  /**
   * Manual trigger for testing
   */
  async triggerNudgeCheckNow() {
    logger.info('Manual nudge check triggered');
    return await this.runNudgeCheck();
  }

  /**
   * Manual trigger for daily tips
   */
  async triggerDailyTipsNow() {
    logger.info('Manual daily tips triggered');
    return await this.runDailyTips();
  }
}

// Export singleton instance
module.exports = new CoachingScheduler();
