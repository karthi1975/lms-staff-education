/**
 * User Bot Preferences Service
 * Manages user mode preferences and tracking (Regular vs Socratic)
 */

const postgresService = require('./database/postgres.service');
const botConfigService = require('./bot-config.service');
const logger = require('../utils/logger');

class UserBotPreferencesService {
  /**
   * Get or create user bot preference for a course
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @returns {Object} User bot preference
   */
  async getOrCreatePreference(userId, courseId) {
    try {
      // Try to get existing preference
      const result = await postgresService.query(`
        SELECT * FROM user_bot_preferences
        WHERE user_id = $1 AND course_id = $2
      `, [userId, courseId]);

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // No preference exists, create one with course default mode
      const botSettings = await botConfigService.getBotSettings(courseId);

      const insertResult = await postgresService.query(`
        INSERT INTO user_bot_preferences (
          user_id,
          course_id,
          selected_mode,
          mode_switches_count,
          regular_mode_sessions,
          regular_mode_time_minutes,
          socratic_mode_sessions,
          socratic_mode_time_minutes
        )
        VALUES ($1, $2, $3, 0, 0, 0, 0, 0)
        RETURNING *
      `, [userId, courseId, botSettings.defaultMode]);

      logger.info(`✅ Created bot preference for user ${userId}, course ${courseId}: ${botSettings.defaultMode} mode`);

      return insertResult.rows[0];
    } catch (error) {
      logger.error(`Failed to get/create bot preference for user ${userId}, course ${courseId}:`, error);
      throw error;
    }
  }

  /**
   * Get user's current mode for a course
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @returns {string} Current mode ('regular' or 'socratic')
   */
  async getUserMode(userId, courseId) {
    try {
      const preference = await this.getOrCreatePreference(userId, courseId);
      return preference.selected_mode;
    } catch (error) {
      logger.error(`Failed to get user mode for user ${userId}, course ${courseId}:`, error);
      // Return default mode as fallback
      return 'regular';
    }
  }

  /**
   * Switch user's mode (with cooldown check)
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @param {string} newMode - 'regular' or 'socratic'
   * @returns {Object} Result with success status and message
   */
  async switchMode(userId, courseId, newMode) {
    try {
      // Validate mode
      if (!['regular', 'socratic'].includes(newMode)) {
        return {
          success: false,
          error: 'Invalid mode. Must be "regular" or "socratic".'
        };
      }

      // Get bot settings
      const botSettings = await botConfigService.getBotSettings(courseId);

      // Check if mode switching is allowed
      if (!botSettings.allowModeSwitching) {
        return {
          success: false,
          error: 'Mode switching is not enabled for this course.'
        };
      }

      // Get current preference
      const preference = await this.getOrCreatePreference(userId, courseId);

      // Check if already in requested mode
      if (preference.selected_mode === newMode) {
        return {
          success: false,
          error: `You are already in ${newMode} mode.`,
          currentMode: newMode
        };
      }

      // Check cooldown period
      if (botSettings.switchCooldownMinutes > 0 && preference.last_mode_switch) {
        const cooldownMs = botSettings.switchCooldownMinutes * 60 * 1000;
        const lastSwitchTime = new Date(preference.last_mode_switch).getTime();
        const now = Date.now();
        const timeSinceSwitch = now - lastSwitchTime;

        if (timeSinceSwitch < cooldownMs) {
          const remainingMinutes = Math.ceil((cooldownMs - timeSinceSwitch) / 60000);
          return {
            success: false,
            error: `Please wait ${remainingMinutes} minutes before switching modes again.`,
            cooldownRemaining: remainingMinutes
          };
        }
      }

      // Perform the switch
      const oldMode = preference.selected_mode;

      await postgresService.query(`
        UPDATE user_bot_preferences
        SET
          selected_mode = $1,
          mode_switches_count = mode_switches_count + 1,
          last_mode_switch = NOW(),
          last_switched_at = NOW(),
          last_switched_from = $2,
          updated_at = NOW()
        WHERE user_id = $3 AND course_id = $4
      `, [newMode, oldMode, userId, courseId]);

      logger.info(`✅ User ${userId} switched mode: ${oldMode} → ${newMode} (course ${courseId})`);

      return {
        success: true,
        message: `Successfully switched to ${newMode} mode.`,
        oldMode,
        newMode,
        switchCount: preference.mode_switches_count + 1
      };
    } catch (error) {
      logger.error(`Failed to switch mode for user ${userId}, course ${courseId}:`, error);
      return {
        success: false,
        error: 'Failed to switch mode. Please try again.'
      };
    }
  }

  /**
   * Track session time for analytics
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @param {string} mode - Mode used in session
   * @param {number} durationMinutes - Session duration in minutes
   */
  async trackSession(userId, courseId, mode, durationMinutes = 1) {
    try {
      const modeColumn = mode === 'socratic' ? 'socratic' : 'regular';

      await postgresService.query(`
        UPDATE user_bot_preferences
        SET
          ${modeColumn}_mode_sessions = ${modeColumn}_mode_sessions + 1,
          ${modeColumn}_mode_time_minutes = ${modeColumn}_mode_time_minutes + $1,
          updated_at = NOW()
        WHERE user_id = $2 AND course_id = $3
      `, [durationMinutes, userId, courseId]);

      logger.debug(`Tracked ${mode} mode session: ${durationMinutes} min (user ${userId}, course ${courseId})`);
    } catch (error) {
      logger.error(`Failed to track session for user ${userId}, course ${courseId}:`, error);
      // Non-critical, don't throw
    }
  }

  /**
   * Get user's bot preferences summary
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @returns {Object} Preference summary with usage stats
   */
  async getPreferenceSummary(userId, courseId) {
    try {
      const preference = await this.getOrCreatePreference(userId, courseId);

      return {
        currentMode: preference.selected_mode,
        modeSwitches: preference.mode_switches_count,
        lastSwitch: preference.last_mode_switch,
        regularSessions: preference.regular_mode_sessions,
        regularTimeMinutes: preference.regular_mode_time_minutes,
        socraticSessions: preference.socratic_mode_sessions,
        socraticTimeMinutes: preference.socratic_mode_time_minutes,
        totalSessions: preference.regular_mode_sessions + preference.socratic_mode_sessions,
        totalTimeMinutes: preference.regular_mode_time_minutes + preference.socratic_mode_time_minutes
      };
    } catch (error) {
      logger.error(`Failed to get preference summary for user ${userId}, course ${courseId}:`, error);
      return null;
    }
  }

  /**
   * Get mode analytics for all users in a course
   * @param {number} courseId - Course ID
   * @returns {Object} Analytics summary
   */
  async getModeAnalytics(courseId) {
    try {
      const result = await postgresService.query(`
        SELECT
          selected_mode,
          COUNT(*) as user_count,
          SUM(mode_switches_count) as total_switches,
          SUM(regular_mode_sessions) as regular_sessions,
          SUM(socratic_mode_sessions) as socratic_sessions,
          SUM(regular_mode_time_minutes) as regular_time_minutes,
          SUM(socratic_mode_time_minutes) as socratic_time_minutes
        FROM user_bot_preferences
        WHERE course_id = $1
        GROUP BY selected_mode
      `, [courseId]);

      const analytics = {
        courseId,
        modes: {},
        totalUsers: 0,
        totalSwitches: 0
      };

      result.rows.forEach(row => {
        analytics.modes[row.selected_mode] = {
          userCount: parseInt(row.user_count),
          totalSwitches: parseInt(row.total_switches || 0),
          regularSessions: parseInt(row.regular_sessions || 0),
          socraticSessions: parseInt(row.socratic_sessions || 0),
          regularTimeMinutes: parseInt(row.regular_time_minutes || 0),
          socraticTimeMinutes: parseInt(row.socratic_time_minutes || 0)
        };

        analytics.totalUsers += parseInt(row.user_count);
        analytics.totalSwitches += parseInt(row.total_switches || 0);
      });

      return analytics;
    } catch (error) {
      logger.error(`Failed to get mode analytics for course ${courseId}:`, error);
      return null;
    }
  }
}

module.exports = new UserBotPreferencesService();
