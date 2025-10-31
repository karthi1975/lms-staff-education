/**
 * Coaching Mode Service
 * Manages dual coaching modes (Regular vs Socratic) for the training system
 *
 * Features:
 * - Mode configuration per course
 * - User preference management
 * - Mode switching with cooldown enforcement
 * - Session tracking
 * - Analytics generation
 */

const postgresService = require('../database/postgres.service');
const logger = require('../../utils/logger');

class CoachingModeService {
  constructor() {
    this.MODES = {
      REGULAR: 'regular',
      SOCRATIC: 'socratic'
    };

    this.DEFAULT_COOLDOWN_MINUTES = 0;
    this.initialized = false;
  }

  /**
   * Initialize the service
   */
  async initialize() {
    try {
      if (this.initialized) {
        logger.info('CoachingModeService already initialized');
        return;
      }

      await postgresService.initialize();
      this.initialized = true;
      logger.info('CoachingModeService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize CoachingModeService:', error);
      throw error;
    }
  }

  /**
   * Get course bot configuration
   * @param {number} courseId - Course ID
   * @returns {Object|null} - Configuration object or null
   */
  async getCourseConfig(courseId) {
    try {
      const query = `
        SELECT * FROM course_bot_configs
        WHERE course_id = $1
      `;
      const result = await postgresService.query(query, [courseId]);

      if (result.rows.length === 0) {
        logger.warn(`No bot config found for course ${courseId}`);
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting course config:', error);
      throw error;
    }
  }

  /**
   * Create or update course bot configuration
   * @param {number} courseId - Course ID
   * @param {Object} config - Configuration object
   * @param {number} adminId - Admin user ID
   * @returns {Object} - Created/updated configuration
   */
  async setCourseConfig(courseId, config, adminId) {
    try {
      const {
        regular_prompt,
        regular_greeting,
        regular_help_text,
        socratic_prompt,
        socratic_greeting,
        socratic_help_text,
        default_mode = this.MODES.REGULAR,
        allow_mode_switching = true,
        switch_cooldown_minutes = this.DEFAULT_COOLDOWN_MINUTES
      } = config;

      // Validate mode
      if (default_mode && !Object.values(this.MODES).includes(default_mode)) {
        throw new Error(`Invalid default mode: ${default_mode}`);
      }

      const query = `
        INSERT INTO course_bot_configs (
          course_id, regular_prompt, regular_greeting, regular_help_text,
          socratic_prompt, socratic_greeting, socratic_help_text,
          default_mode, allow_mode_switching, switch_cooldown_minutes,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (course_id)
        DO UPDATE SET
          regular_prompt = COALESCE($2, course_bot_configs.regular_prompt),
          regular_greeting = COALESCE($3, course_bot_configs.regular_greeting),
          regular_help_text = COALESCE($4, course_bot_configs.regular_help_text),
          socratic_prompt = COALESCE($5, course_bot_configs.socratic_prompt),
          socratic_greeting = COALESCE($6, course_bot_configs.socratic_greeting),
          socratic_help_text = COALESCE($7, course_bot_configs.socratic_help_text),
          default_mode = COALESCE($8, course_bot_configs.default_mode),
          allow_mode_switching = COALESCE($9, course_bot_configs.allow_mode_switching),
          switch_cooldown_minutes = COALESCE($10, course_bot_configs.switch_cooldown_minutes),
          updated_at = NOW()
        RETURNING *
      `;

      const result = await postgresService.query(query, [
        courseId,
        regular_prompt,
        regular_greeting,
        regular_help_text,
        socratic_prompt,
        socratic_greeting,
        socratic_help_text,
        default_mode,
        allow_mode_switching,
        switch_cooldown_minutes,
        adminId
      ]);

      logger.info(`Course bot config updated for course ${courseId} by admin ${adminId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error setting course config:', error);
      throw error;
    }
  }

  /**
   * Get user bot preference for a course
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @returns {Object|null} - User preference object or null
   */
  async getUserPreference(userId, courseId) {
    try {
      const query = `
        SELECT * FROM user_bot_preferences
        WHERE user_id = $1 AND course_id = $2
      `;
      const result = await postgresService.query(query, [userId, courseId]);

      if (result.rows.length === 0) {
        // No preference yet, return default from course config
        const courseConfig = await this.getCourseConfig(courseId);
        if (!courseConfig) {
          return null;
        }

        return {
          user_id: userId,
          course_id: courseId,
          selected_mode: courseConfig.default_mode,
          mode_switches_count: 0,
          is_new: true
        };
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting user preference:', error);
      throw error;
    }
  }

  /**
   * Switch user mode
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @param {string} newMode - New mode (regular or socratic)
   * @returns {Object} - Result with success status and message
   */
  async switchMode(userId, courseId, newMode) {
    try {
      // Validate mode
      if (!Object.values(this.MODES).includes(newMode)) {
        return {
          success: false,
          message: `Invalid mode: ${newMode}. Valid modes are: ${Object.values(this.MODES).join(', ')}`
        };
      }

      // Check course configuration
      const courseConfig = await this.getCourseConfig(courseId);
      if (!courseConfig) {
        return {
          success: false,
          message: 'Course configuration not found'
        };
      }

      if (!courseConfig.allow_mode_switching) {
        return {
          success: false,
          message: 'Mode switching is not allowed for this course'
        };
      }

      // Get current preference
      const currentPref = await this.getUserPreference(userId, courseId);

      // Check if already in that mode
      if (currentPref && currentPref.selected_mode === newMode) {
        return {
          success: true,
          message: `Already in ${newMode} mode`,
          current_mode: newMode,
          already_active: true
        };
      }

      // Check cooldown
      if (currentPref && currentPref.last_mode_switch && courseConfig.switch_cooldown_minutes > 0) {
        const lastSwitch = new Date(currentPref.last_mode_switch);
        const now = new Date();
        const minutesSinceSwitch = (now - lastSwitch) / 1000 / 60;

        if (minutesSinceSwitch < courseConfig.switch_cooldown_minutes) {
          const remainingMinutes = Math.ceil(courseConfig.switch_cooldown_minutes - minutesSinceSwitch);
          return {
            success: false,
            message: `Please wait ${remainingMinutes} more minute(s) before switching modes`,
            cooldown_remaining_minutes: remainingMinutes
          };
        }
      }

      // Create or update preference
      const query = `
        INSERT INTO user_bot_preferences (
          user_id, course_id, selected_mode, mode_switches_count, last_mode_switch
        ) VALUES ($1, $2, $3, 1, NOW())
        ON CONFLICT (user_id, course_id)
        DO UPDATE SET
          selected_mode = $3,
          mode_switches_count = user_bot_preferences.mode_switches_count + 1,
          last_mode_switch = NOW(),
          updated_at = NOW()
        RETURNING *
      `;

      const result = await postgresService.query(query, [userId, courseId, newMode]);

      logger.info(`User ${userId} switched to ${newMode} mode for course ${courseId}`);

      return {
        success: true,
        message: `Successfully switched to ${newMode} mode`,
        current_mode: newMode,
        switches_count: result.rows[0].mode_switches_count,
        preference: result.rows[0]
      };
    } catch (error) {
      logger.error('Error switching mode:', error);
      return {
        success: false,
        message: 'Error switching mode. Please try again.'
      };
    }
  }

  /**
   * Get mode-specific prompt for user
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @returns {Object} - Prompt information
   */
  async getModePrompt(userId, courseId) {
    try {
      const courseConfig = await this.getCourseConfig(courseId);
      if (!courseConfig) {
        return null;
      }

      const userPref = await this.getUserPreference(userId, courseId);
      const mode = userPref ? userPref.selected_mode : courseConfig.default_mode;

      const isRegular = mode === this.MODES.REGULAR;

      return {
        mode: mode,
        prompt: isRegular ? courseConfig.regular_prompt : courseConfig.socratic_prompt,
        greeting: isRegular ? courseConfig.regular_greeting : courseConfig.socratic_greeting,
        help_text: isRegular ? courseConfig.regular_help_text : courseConfig.socratic_help_text,
        allow_switching: courseConfig.allow_mode_switching,
        cooldown_minutes: courseConfig.switch_cooldown_minutes
      };
    } catch (error) {
      logger.error('Error getting mode prompt:', error);
      throw error;
    }
  }

  /**
   * Start a coaching session
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @returns {Object} - Session object
   */
  async startSession(userId, courseId) {
    try {
      const userPref = await this.getUserPreference(userId, courseId);
      const courseConfig = await this.getCourseConfig(courseId);

      const mode = userPref ? userPref.selected_mode : courseConfig.default_mode;

      const query = `
        INSERT INTO coaching_sessions (
          user_id, course_id, mode_used, session_start
        ) VALUES ($1, $2, $3, NOW())
        RETURNING *
      `;

      const result = await postgresService.query(query, [userId, courseId, mode]);

      logger.info(`Coaching session started for user ${userId}, course ${courseId}, mode ${mode}`);

      return result.rows[0];
    } catch (error) {
      logger.error('Error starting session:', error);
      throw error;
    }
  }

  /**
   * End a coaching session
   * @param {number} sessionId - Session ID
   * @param {string} status - Completion status (completed, abandoned)
   * @param {Object} metrics - Optional metrics (quiz_score, satisfaction_rating)
   * @returns {Object} - Updated session
   */
  async endSession(sessionId, status = 'completed', metrics = {}) {
    try {
      const { quiz_score, satisfaction_rating } = metrics;

      const query = `
        UPDATE coaching_sessions
        SET session_end = NOW(),
            duration_minutes = EXTRACT(EPOCH FROM (NOW() - session_start)) / 60,
            completion_status = $1,
            quiz_score = COALESCE($2, quiz_score),
            satisfaction_rating = COALESCE($3, satisfaction_rating)
        WHERE id = $4
        RETURNING *
      `;

      const result = await postgresService.query(query, [
        status,
        quiz_score,
        satisfaction_rating,
        sessionId
      ]);

      if (result.rows.length > 0) {
        const session = result.rows[0];

        // Update user preference time tracking
        await this.trackModeTime(
          session.user_id,
          session.course_id,
          session.mode_used,
          session.duration_minutes
        );

        logger.info(`Coaching session ${sessionId} ended with status ${status}`);
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error ending session:', error);
      throw error;
    }
  }

  /**
   * Log a message in an active session
   * @param {number} sessionId - Session ID
   * @param {boolean} isQuestion - Whether the message is a question
   */
  async logSessionMessage(sessionId, isQuestion = false) {
    try {
      const query = `
        UPDATE coaching_sessions
        SET messages_sent = messages_sent + 1,
            questions_asked = questions_asked + ${isQuestion ? 1 : 0}
        WHERE id = $1
      `;

      await postgresService.query(query, [sessionId]);
    } catch (error) {
      logger.error('Error logging session message:', error);
    }
  }

  /**
   * Track mode usage time for user
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @param {string} mode - Mode used
   * @param {number} minutes - Minutes spent
   */
  async trackModeTime(userId, courseId, mode, minutes) {
    try {
      const timeField = mode === this.MODES.REGULAR ? 'regular_mode_time_minutes' : 'socratic_mode_time_minutes';
      const sessionField = mode === this.MODES.REGULAR ? 'regular_mode_sessions' : 'socratic_mode_sessions';

      const query = `
        UPDATE user_bot_preferences
        SET ${timeField} = ${timeField} + $1,
            ${sessionField} = ${sessionField} + 1
        WHERE user_id = $2 AND course_id = $3
      `;

      await postgresService.query(query, [Math.round(minutes), userId, courseId]);

      logger.debug(`Tracked ${minutes} minutes for user ${userId} in ${mode} mode`);
    } catch (error) {
      logger.error('Error tracking mode time:', error);
    }
  }

  /**
   * Get active session for user and course
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @returns {Object|null} - Active session or null
   */
  async getActiveSession(userId, courseId) {
    try {
      const query = `
        SELECT * FROM coaching_sessions
        WHERE user_id = $1
          AND course_id = $2
          AND completion_status = 'in_progress'
        ORDER BY session_start DESC
        LIMIT 1
      `;

      const result = await postgresService.query(query, [userId, courseId]);

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('Error getting active session:', error);
      return null;
    }
  }

  /**
   * Generate mode analytics for a course
   * @param {number} courseId - Course ID
   * @param {Date} startDate - Period start
   * @param {Date} endDate - Period end
   * @returns {Object} - Analytics data
   */
  async generateModeAnalytics(courseId, startDate, endDate) {
    try {
      const analytics = {};

      for (const mode of Object.values(this.MODES)) {
        const query = `
          WITH session_stats AS (
            SELECT
              COUNT(DISTINCT user_id) as total_users,
              COUNT(*) as total_sessions,
              SUM(messages_sent) as total_messages,
              AVG(duration_minutes) as avg_duration,
              AVG(quiz_score) as avg_quiz,
              SUM(CASE WHEN completion_status = 'completed' THEN 1 ELSE 0 END)::decimal / NULLIF(COUNT(*), 0) * 100 as completion_rate
            FROM coaching_sessions
            WHERE course_id = $1
              AND mode_used = $2
              AND session_start BETWEEN $3 AND $4
          ),
          preference_stats AS (
            SELECT
              COUNT(*) as mode_users,
              (SELECT COUNT(*) FROM user_bot_preferences WHERE course_id = $1) as total_users
            FROM user_bot_preferences
            WHERE course_id = $1 AND selected_mode = $2
          )
          SELECT
            ss.total_users,
            ss.total_sessions,
            ss.total_messages,
            ss.avg_duration,
            ss.avg_quiz,
            ss.completion_rate,
            CASE WHEN ps.total_users > 0 THEN (ps.mode_users::decimal / ps.total_users * 100) ELSE 0 END as preference_percentage
          FROM session_stats ss, preference_stats ps
        `;

        const result = await postgresService.query(query, [courseId, mode, startDate, endDate]);

        if (result.rows.length > 0) {
          analytics[mode] = result.rows[0];
        }
      }

      return analytics;
    } catch (error) {
      logger.error('Error generating mode analytics:', error);
      throw error;
    }
  }

  /**
   * Save analytics to database
   * @param {number} courseId - Course ID
   * @param {Date} periodStart - Period start
   * @param {Date} periodEnd - Period end
   */
  async saveModeAnalytics(courseId, periodStart, periodEnd) {
    try {
      const analytics = await this.generateModeAnalytics(courseId, periodStart, periodEnd);

      for (const [mode, stats] of Object.entries(analytics)) {
        const query = `
          INSERT INTO mode_analytics (
            course_id, mode, period_start, period_end,
            total_users, total_sessions, total_messages,
            avg_session_duration_minutes, avg_quiz_score,
            completion_rate, user_preference_percentage
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (course_id, mode, period_start, period_end)
          DO UPDATE SET
            total_users = EXCLUDED.total_users,
            total_sessions = EXCLUDED.total_sessions,
            total_messages = EXCLUDED.total_messages,
            avg_session_duration_minutes = EXCLUDED.avg_session_duration_minutes,
            avg_quiz_score = EXCLUDED.avg_quiz_score,
            completion_rate = EXCLUDED.completion_rate,
            user_preference_percentage = EXCLUDED.user_preference_percentage
        `;

        await postgresService.query(query, [
          courseId,
          mode,
          periodStart,
          periodEnd,
          stats.total_users || 0,
          stats.total_sessions || 0,
          stats.total_messages || 0,
          stats.avg_duration || 0,
          stats.avg_quiz || 0,
          stats.completion_rate || 0,
          stats.preference_percentage || 0
        ]);
      }

      logger.info(`Mode analytics saved for course ${courseId}, period ${periodStart} to ${periodEnd}`);
      return analytics;
    } catch (error) {
      logger.error('Error saving mode analytics:', error);
      throw error;
    }
  }

  /**
   * Get mode comparison for a course
   * @param {number} courseId - Course ID
   * @param {Date} startDate - Period start
   * @param {Date} endDate - Period end
   * @returns {Object} - Comparison data
   */
  async getModeComparison(courseId, startDate, endDate) {
    try {
      const query = `
        SELECT
          mode,
          total_users,
          total_sessions,
          total_messages,
          avg_session_duration_minutes,
          avg_quiz_score,
          completion_rate,
          user_preference_percentage
        FROM mode_analytics
        WHERE course_id = $1
          AND period_start >= $2
          AND period_end <= $3
        ORDER BY mode
      `;

      const result = await postgresService.query(query, [courseId, startDate, endDate]);

      return result.rows;
    } catch (error) {
      logger.error('Error getting mode comparison:', error);
      throw error;
    }
  }

  /**
   * Get available commands for mode switching
   * @returns {Array} - List of commands
   */
  getAvailableCommands() {
    return [
      {
        command: '/regular',
        alias: '/direct',
        description: 'Switch to Regular Mode (direct teaching)',
        mode: this.MODES.REGULAR
      },
      {
        command: '/socratic',
        alias: '/discovery',
        description: 'Switch to Socratic Mode (question-based learning)',
        mode: this.MODES.SOCRATIC
      },
      {
        command: '/mode',
        description: 'Show current coaching mode',
        action: 'show_current'
      },
      {
        command: '/modes',
        description: 'List all available coaching modes',
        action: 'list_all'
      }
    ];
  }

  /**
   * Parse mode command from message
   * @param {string} message - User message
   * @returns {Object|null} - Parsed command or null
   */
  parseModeCommand(message) {
    const lowerMessage = message.toLowerCase().trim();
    const commands = this.getAvailableCommands();

    for (const cmd of commands) {
      if (lowerMessage === cmd.command || lowerMessage === cmd.alias) {
        return cmd;
      }
    }

    return null;
  }
}

// Export singleton instance
module.exports = new CoachingModeService();
