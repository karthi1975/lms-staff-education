/**
 * ModeCommandHandler
 *
 * SOLID Principles:
 * - SRP: Handles coaching mode commands ONLY
 * - LSP: Implements BaseCommandHandler interface
 * - DIP: Depends on abstractions (CoachingModeService)
 *
 * Handles commands: /regular, /socratic, /mode, /modes, /direct, /discovery
 */

const BaseCommandHandler = require('./BaseCommandHandler');
const coachingModeService = require('../../coaching/coaching-mode.service');
const promptTemplateService = require('../../coaching/prompt-template.service');

class ModeCommandHandler extends BaseCommandHandler {
  constructor(dependencies) {
    super(dependencies);
    this.initialized = false;
  }

  /**
   * Initialize the handler
   */
  async initialize() {
    if (!this.initialized) {
      await coachingModeService.initialize();
      this.initialized = true;
      this.logger.info('ModeCommandHandler initialized');
    }
  }

  /**
   * Check if this handler can process the command
   * @param {string} command - User command
   * @returns {boolean}
   */
  canHandle(command) {
    const lowerCommand = command.toLowerCase().trim();
    const modeCommands = [
      '/regular', '/direct',
      '/socratic', '/discovery',
      '/mode', '/modes'
    ];

    return modeCommands.some(cmd => lowerCommand.startsWith(cmd));
  }

  /**
   * Handle the coaching mode command
   * @param {number} userId - User ID
   * @param {string} command - User command
   * @param {Object} userProgress - User progress data
   * @param {Object} session - Current session
   * @returns {Promise<Object>} - Response object
   */
  async handle(userId, command, userProgress, session) {
    try {
      await this.initialize();

      const lowerCommand = command.toLowerCase().trim();
      this.logger.info(`ModeCommandHandler processing: ${lowerCommand}`);

      // Get user's current course
      const courseId = await this.getUserCurrentCourse(userId);
      if (!courseId) {
        return {
          type: 'text',
          content: '❌ You need to be enrolled in a course to use coaching modes. Type /menu to see available courses.'
        };
      }

      // Parse command
      const parsedCommand = coachingModeService.parseModeCommand(command);
      if (!parsedCommand) {
        return {
          type: 'text',
          content: '❌ Invalid mode command. Type /modes to see available options.'
        };
      }

      // Handle different command types
      if (parsedCommand.action === 'show_current') {
        return await this.handleShowCurrent(userId, courseId);
      } else if (parsedCommand.action === 'list_all') {
        return await this.handleListAll(userId, courseId);
      } else if (parsedCommand.mode) {
        return await this.handleModeSwitch(userId, courseId, parsedCommand.mode);
      }

      return {
        type: 'text',
        content: '❌ Unknown mode command. Type /modes for help.'
      };
    } catch (error) {
      this.logger.error('Error handling mode command:', error);
      return {
        type: 'text',
        content: '❌ Sorry, I encountered an error processing your mode command. Please try again.'
      };
    }
  }

  /**
   * Handle /mode command - Show current mode
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @returns {Promise<Object>} - Response
   */
  async handleShowCurrent(userId, courseId) {
    try {
      const modePrompt = await coachingModeService.getModePrompt(userId, courseId);
      if (!modePrompt) {
        return {
          type: 'text',
          content: '❌ Could not retrieve your current mode. Please try again.'
        };
      }

      const courseConfig = await coachingModeService.getCourseConfig(courseId);
      const modeInfo = promptTemplateService.formatModeInfo(modePrompt.mode, {
        allow_mode_switching: modePrompt.allow_switching,
        switch_cooldown_minutes: modePrompt.cooldown_minutes
      });

      return {
        type: 'text',
        content: modeInfo
      };
    } catch (error) {
      this.logger.error('Error showing current mode:', error);
      return {
        type: 'text',
        content: '❌ Error retrieving mode information.'
      };
    }
  }

  /**
   * Handle /modes command - List all available modes
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @returns {Promise<Object>} - Response
   */
  async handleListAll(userId, courseId) {
    try {
      const courseConfig = await coachingModeService.getCourseConfig(courseId);
      const currentPref = await coachingModeService.getUserPreference(userId, courseId);
      const currentMode = currentPref ? currentPref.selected_mode : courseConfig?.default_mode || 'regular';

      const comparison = promptTemplateService.generateModeComparison();
      const currentModeIndicator = `\n\n📍 *Current Mode:* ${currentMode === 'regular' ? 'Regular (Direct Coach)' : 'Socratic (Discovery Coach)'}`;

      return {
        type: 'text',
        content: comparison + currentModeIndicator
      };
    } catch (error) {
      this.logger.error('Error listing modes:', error);
      return {
        type: 'text',
        content: '❌ Error retrieving mode information.'
      };
    }
  }

  /**
   * Handle mode switching
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @param {string} newMode - New mode to switch to
   * @returns {Promise<Object>} - Response
   */
  async handleModeSwitch(userId, courseId, newMode) {
    try {
      const result = await coachingModeService.switchMode(userId, courseId, newMode);

      if (!result.success) {
        return {
          type: 'text',
          content: `❌ ${result.message}`
        };
      }

      // Get mode-specific greeting
      const modePrompt = await coachingModeService.getModePrompt(userId, courseId);
      const modeName = newMode === 'regular' ? 'Regular Mode (Direct Coach)' : 'Socratic Mode (Discovery Coach)';
      const modeEmoji = newMode === 'regular' ? '📚' : '🤔';

      let response = `${modeEmoji} *Switched to ${modeName}*\n\n`;

      if (result.already_active) {
        response = `${modeEmoji} *Already in ${modeName}*\n\n`;
      }

      response += modePrompt.greeting;
      response += `\n\n💡 ${modePrompt.help_text}`;

      // Add tip about switching back
      const otherMode = newMode === 'regular' ? 'socratic' : 'regular';
      const otherCommand = newMode === 'regular' ? '/socratic' : '/regular';
      response += `\n\n💬 Type ${otherCommand} to switch to ${otherMode} mode anytime.`;

      return {
        type: 'text',
        content: response
      };
    } catch (error) {
      this.logger.error('Error switching mode:', error);
      return {
        type: 'text',
        content: '❌ Error switching mode. Please try again.'
      };
    }
  }

  /**
   * Get user's current course
   * @param {number} userId - User ID
   * @returns {Promise<number|null>} - Course ID or null
   */
  async getUserCurrentCourse(userId) {
    try {
      // Get from Neo4j or PostgreSQL
      const userProgress = await this.neo4jService.getUserLearningPath(userId);
      if (userProgress && userProgress.courses && userProgress.courses.length > 0) {
        // Return first active course
        return userProgress.courses[0].id;
      }

      // Fallback: Query PostgreSQL for enrollments
      const postgresService = require('../../database/postgres.service');
      const query = `
        SELECT course_id FROM course_enrollments
        WHERE user_id = $1
        ORDER BY enrolled_at DESC
        LIMIT 1
      `;
      const result = await postgresService.query(query, [userId]);

      if (result.rows.length > 0) {
        return result.rows[0].course_id;
      }

      return null;
    } catch (error) {
      this.logger.error('Error getting user current course:', error);
      return null;
    }
  }

  /**
   * Get command examples
   * @returns {string}
   */
  getExamples() {
    return `/mode - Show your current coaching mode
/modes - List all available modes
/regular - Switch to Regular Mode (direct answers)
/socratic - Switch to Socratic Mode (question-based learning)`;
  }
}

module.exports = ModeCommandHandler;
