/**
 * Bot Configuration Service
 * Manages bot prompts and configurations from course_bot_configs table
 */

const postgresService = require('./database/postgres.service');
const logger = require('../utils/logger');

class BotConfigService {
  constructor() {
    this.configCache = new Map(); // courseId -> config
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get bot configuration for a course
   * @param {number} courseId - Course ID
   * @returns {Object} Bot configuration with prompts and settings
   */
  async getBotConfig(courseId) {
    try {
      // Check cache first
      const cached = this.configCache.get(courseId);
      if (cached && cached.expiresAt > Date.now()) {
        logger.debug(`Cache hit for course ${courseId} bot config`);
        return cached.config;
      }

      // Fetch from database
      const result = await postgresService.query(`
        SELECT
          id,
          course_id,
          regular_prompt,
          regular_greeting,
          regular_help_text,
          regular_version,
          socratic_prompt,
          socratic_greeting,
          socratic_help_text,
          socratic_version,
          default_mode,
          allow_mode_switching,
          switch_cooldown_minutes,
          last_approved_at,
          last_approved_by
        FROM course_bot_configs
        WHERE course_id = $1
      `, [courseId]);

      if (result.rows.length === 0) {
        // No config found, return default config
        logger.warn(`No bot config found for course ${courseId}, using defaults`);
        return this.getDefaultConfig(courseId);
      }

      const config = result.rows[0];

      // Cache the config
      this.configCache.set(courseId, {
        config,
        expiresAt: Date.now() + this.cacheTTL
      });

      logger.info(`✅ Loaded bot config for course ${courseId} (regular v${config.regular_version}, socratic v${config.socratic_version})`);

      return config;
    } catch (error) {
      logger.error(`Failed to get bot config for course ${courseId}:`, error);
      return this.getDefaultConfig(courseId);
    }
  }

  /**
   * Get default bot configuration (fallback)
   * @param {number} courseId - Course ID
   * @returns {Object} Default configuration
   */
  getDefaultConfig(courseId) {
    return {
      course_id: courseId,
      regular_prompt: 'You are a helpful teaching assistant for this course. Provide clear, direct answers and explanations. Give step-by-step solutions and examples. Be friendly and encouraging.',
      regular_greeting: 'Hello! I\'m your teaching assistant. I\'m here to help you learn by providing direct answers, explanations, and examples. Ask me anything!',
      regular_help_text: 'In Regular Mode, I provide direct answers, detailed explanations, step-by-step solutions, and practical examples to help you learn quickly.',
      regular_version: 1,
      socratic_prompt: 'You are a Socratic teaching assistant. NEVER give direct answers. Ask guiding questions that help the learner discover answers themselves. Use the Socratic method: break down complex topics into simpler questions, build on previous answers, and guide reflection.',
      socratic_greeting: 'Hello! Let\'s learn together through questions. I\'ll guide you to discover answers yourself. What would you like to explore today?',
      socratic_help_text: 'In Socratic Mode, I guide you through questions to help you discover answers yourself. This encourages deeper understanding and critical thinking.',
      socratic_version: 1,
      default_mode: 'regular',
      allow_mode_switching: true,
      switch_cooldown_minutes: 0
    };
  }

  /**
   * Get the prompt for a specific mode
   * @param {number} courseId - Course ID
   * @param {string} mode - 'regular' or 'socratic'
   * @returns {Object} Prompt configuration with text, greeting, help text, and version
   */
  async getPromptForMode(courseId, mode) {
    const config = await this.getBotConfig(courseId);

    const modeKey = mode === 'socratic' ? 'socratic' : 'regular';

    return {
      prompt: config[`${modeKey}_prompt`],
      greeting: config[`${modeKey}_greeting`],
      helpText: config[`${modeKey}_help_text`],
      version: config[`${modeKey}_version`],
      mode: modeKey
    };
  }

  /**
   * Get bot settings for a course
   * @param {number} courseId - Course ID
   * @returns {Object} Settings (default_mode, allow_mode_switching, etc.)
   */
  async getBotSettings(courseId) {
    const config = await this.getBotConfig(courseId);

    return {
      defaultMode: config.default_mode || 'regular',
      allowModeSwitching: config.allow_mode_switching !== false,
      switchCooldownMinutes: config.switch_cooldown_minutes || 0,
      lastApprovedAt: config.last_approved_at,
      lastApprovedBy: config.last_approved_by
    };
  }

  /**
   * Clear cache for a specific course (useful after config updates)
   * @param {number} courseId - Course ID
   */
  clearCache(courseId) {
    if (courseId) {
      this.configCache.delete(courseId);
      logger.info(`Cache cleared for course ${courseId}`);
    } else {
      this.configCache.clear();
      logger.info('All bot config cache cleared');
    }
  }

  /**
   * Get all bot configurations (for admin purposes)
   * @returns {Array} All bot configurations
   */
  async getAllBotConfigs() {
    try {
      const result = await postgresService.query(`
        SELECT
          bc.*,
          c.title as course_title,
          c.code as course_code
        FROM course_bot_configs bc
        JOIN courses c ON bc.course_id = c.id
        ORDER BY c.title
      `);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get all bot configs:', error);
      return [];
    }
  }
}

module.exports = new BotConfigService();
