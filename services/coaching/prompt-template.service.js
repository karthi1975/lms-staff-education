/**
 * Prompt Template Service
 * Manages mode-specific prompt templates and dynamic prompt generation
 *
 * Features:
 * - Template-based prompt generation
 * - Mode-specific prompt customization
 * - Context injection
 * - Validation and sanitization
 */

const logger = require('../../utils/logger');

class PromptTemplateService {
  constructor() {
    this.MODES = {
      REGULAR: 'regular',
      SOCRATIC: 'socratic'
    };

    // Default templates
    this.defaultTemplates = this.initializeDefaultTemplates();
  }

  /**
   * Initialize default prompt templates
   */
  initializeDefaultTemplates() {
    return {
      regular: {
        system: `You are a helpful teaching assistant for this course. Provide clear, direct answers and explanations. Give step-by-step solutions and examples. Be friendly and encouraging.

Key principles:
- Give direct answers to questions
- Provide detailed explanations
- Use examples to illustrate concepts
- Break down complex topics into steps
- Encourage the learner
- Be patient and supportive`,

        greeting: `Hello! I'm your teaching assistant. I'm here to help you learn by providing direct answers, explanations, and examples. Ask me anything!`,

        helpText: `In Regular Mode, I provide:
- Direct answers to your questions
- Detailed explanations of concepts
- Step-by-step solutions to problems
- Practical examples
- Quick learning support`,

        contextTemplate: `Course: {courseName}
Module: {moduleName}
Topic: {topic}
User Level: {userLevel}

Please provide a clear, direct answer to help the learner understand this topic.`
      },

      socratic: {
        system: `You are a Socratic teaching assistant. NEVER give direct answers. Ask guiding questions that help the learner discover answers themselves.

Key principles:
- Use the Socratic method exclusively
- Ask probing questions to guide thinking
- Break down complex topics into simpler questions
- Build on the learner's previous answers
- Guide reflection and critical thinking
- Help them discover answers through inquiry
- Be patient and encouraging
- NEVER provide direct answers or solutions`,

        greeting: `Hello! Let's learn together through questions. I'll guide you to discover answers yourself. What would you like to explore today?`,

        helpText: `In Socratic Mode, I guide your learning through:
- Thought-provoking questions
- Guiding you to discover answers yourself
- Building on your previous responses
- Encouraging critical thinking
- Helping you develop problem-solving skills
- No direct answers - just guiding questions`,

        contextTemplate: `Course: {courseName}
Module: {moduleName}
Topic: {topic}
User Level: {userLevel}

Guide the learner through questions to help them discover the answer themselves. Ask probing questions that build on their understanding.`
      }
    };
  }

  /**
   * Generate system prompt for a mode
   * @param {string} mode - Mode (regular or socratic)
   * @param {Object} customPrompt - Custom prompt from database
   * @param {Object} context - Additional context
   * @returns {string} - Generated system prompt
   */
  generateSystemPrompt(mode, customPrompt = null, context = {}) {
    try {
      // Use custom prompt if provided, otherwise use default
      let basePrompt = customPrompt || this.defaultTemplates[mode].system;

      // Inject context if provided
      if (Object.keys(context).length > 0) {
        basePrompt += '\n\n' + this.injectContext(
          this.defaultTemplates[mode].contextTemplate,
          context
        );
      }

      // Add mode-specific instructions
      if (mode === this.MODES.SOCRATIC) {
        basePrompt += '\n\nREMEMBER: Ask questions, do NOT give direct answers.';
      }

      return basePrompt;
    } catch (error) {
      logger.error('Error generating system prompt:', error);
      return this.defaultTemplates[mode].system;
    }
  }

  /**
   * Generate greeting message for a mode
   * @param {string} mode - Mode (regular or socratic)
   * @param {Object} customGreeting - Custom greeting from database
   * @param {string} userName - User's name
   * @returns {string} - Generated greeting
   */
  generateGreeting(mode, customGreeting = null, userName = null) {
    try {
      let greeting = customGreeting || this.defaultTemplates[mode].greeting;

      // Personalize with user name if provided
      if (userName) {
        greeting = greeting.replace('Hello!', `Hello ${userName}!`);
      }

      return greeting;
    } catch (error) {
      logger.error('Error generating greeting:', error);
      return this.defaultTemplates[mode].greeting;
    }
  }

  /**
   * Generate help text for a mode
   * @param {string} mode - Mode (regular or socratic)
   * @param {Object} customHelpText - Custom help text from database
   * @returns {string} - Generated help text
   */
  generateHelpText(mode, customHelpText = null) {
    try {
      return customHelpText || this.defaultTemplates[mode].helpText;
    } catch (error) {
      logger.error('Error generating help text:', error);
      return this.defaultTemplates[mode].helpText;
    }
  }

  /**
   * Inject context variables into a template
   * @param {string} template - Template string with {variables}
   * @param {Object} context - Context object with values
   * @returns {string} - Template with injected values
   */
  injectContext(template, context) {
    let result = template;

    for (const [key, value] of Object.entries(context)) {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value || 'N/A');
    }

    return result;
  }

  /**
   * Validate a custom prompt
   * @param {string} prompt - Prompt to validate
   * @param {string} mode - Mode (regular or socratic)
   * @returns {Object} - Validation result
   */
  validatePrompt(prompt, mode) {
    const errors = [];
    const warnings = [];

    // Check if prompt is empty
    if (!prompt || prompt.trim().length === 0) {
      errors.push('Prompt cannot be empty');
      return { valid: false, errors, warnings };
    }

    // Check minimum length
    if (prompt.length < 50) {
      warnings.push('Prompt is quite short. Consider adding more guidance.');
    }

    // Check maximum length
    if (prompt.length > 4000) {
      errors.push('Prompt is too long. Maximum 4000 characters.');
    }

    // Mode-specific validations
    if (mode === this.MODES.SOCRATIC) {
      // Check if Socratic prompt contains guidance about questions
      const socraticKeywords = ['question', 'ask', 'guide', 'inquiry', 'discover'];
      const hasGuidance = socraticKeywords.some(keyword =>
        prompt.toLowerCase().includes(keyword)
      );

      if (!hasGuidance) {
        warnings.push('Socratic mode prompt should emphasize asking questions and guiding discovery');
      }

      // Check if it instructs NOT to give direct answers
      const hasDontGiveAnswers = prompt.toLowerCase().includes('never give') ||
                                  prompt.toLowerCase().includes('do not give') ||
                                  prompt.toLowerCase().includes('don\'t give');

      if (!hasDontGiveAnswers) {
        warnings.push('Socratic mode should explicitly instruct NOT to give direct answers');
      }
    }

    if (mode === this.MODES.REGULAR) {
      // Check if regular prompt mentions providing answers
      const regularKeywords = ['answer', 'explain', 'provide', 'help', 'teach'];
      const hasGuidance = regularKeywords.some(keyword =>
        prompt.toLowerCase().includes(keyword)
      );

      if (!hasGuidance) {
        warnings.push('Regular mode prompt should emphasize providing clear answers and explanations');
      }
    }

    // Check for potential security issues
    const securityIssues = this.checkSecurityIssues(prompt);
    if (securityIssues.length > 0) {
      errors.push(...securityIssues);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check for security issues in prompt
   * @param {string} prompt - Prompt to check
   * @returns {Array} - List of security issues
   */
  checkSecurityIssues(prompt) {
    const issues = [];

    // Check for script tags
    if (/<script/i.test(prompt)) {
      issues.push('Prompt contains potentially unsafe script tags');
    }

    // Check for SQL-like commands (basic check)
    if (/DROP\s+TABLE|DELETE\s+FROM|INSERT\s+INTO/i.test(prompt)) {
      issues.push('Prompt contains SQL-like commands');
    }

    // Check for system command patterns
    if (/\$\(.*\)|`.*`|eval\s*\(/i.test(prompt)) {
      issues.push('Prompt contains potential command injection patterns');
    }

    return issues;
  }

  /**
   * Sanitize a prompt
   * @param {string} prompt - Prompt to sanitize
   * @returns {string} - Sanitized prompt
   */
  sanitizePrompt(prompt) {
    if (!prompt) return '';

    // Remove script tags
    let sanitized = prompt.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove potentially dangerous characters
    sanitized = sanitized.replace(/[<>]/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
  }

  /**
   * Generate a complete prompt configuration
   * @param {string} mode - Mode (regular or socratic)
   * @param {Object} customConfig - Custom configuration from database
   * @param {Object} context - Additional context
   * @returns {Object} - Complete prompt configuration
   */
  generatePromptConfig(mode, customConfig = {}, context = {}) {
    try {
      const config = {
        mode: mode,
        system_prompt: this.generateSystemPrompt(
          mode,
          customConfig.system_prompt,
          context
        ),
        greeting: this.generateGreeting(
          mode,
          customConfig.greeting,
          context.userName
        ),
        help_text: this.generateHelpText(
          mode,
          customConfig.help_text
        ),
        allow_mode_switching: customConfig.allow_mode_switching !== false,
        switch_cooldown_minutes: customConfig.switch_cooldown_minutes || 0
      };

      return config;
    } catch (error) {
      logger.error('Error generating prompt config:', error);
      throw error;
    }
  }

  /**
   * Get mode examples for testing
   * @param {string} mode - Mode (regular or socratic)
   * @returns {Object} - Example prompts
   */
  getModeExamples(mode) {
    const examples = {
      regular: {
        question: 'What is classroom management?',
        expectedResponse: 'Classroom management is the process of organizing and conducting a class to ensure effective learning. It includes...',
        characteristics: [
          'Direct answer provided',
          'Clear explanation',
          'Structured information',
          'Actionable examples'
        ]
      },
      socratic: {
        question: 'What is classroom management?',
        expectedResponse: 'That\'s a great question! Let me help you discover this. What do you think happens when a teacher successfully manages their classroom? What might you observe?',
        characteristics: [
          'Question in response',
          'Guides thinking',
          'No direct answer',
          'Encourages discovery'
        ]
      }
    };

    return examples[mode] || null;
  }

  /**
   * Format mode info for user display
   * @param {string} currentMode - Current mode
   * @param {Object} config - Course configuration
   * @returns {string} - Formatted info
   */
  formatModeInfo(currentMode, config) {
    const modeEmoji = currentMode === this.MODES.REGULAR ? '📚' : '🤔';
    const modeName = currentMode === this.MODES.REGULAR ? 'Regular Mode' : 'Socratic Mode';

    let info = `${modeEmoji} Current Mode: *${modeName}*\n\n`;

    if (currentMode === this.MODES.REGULAR) {
      info += '📖 In this mode, I provide direct answers, explanations, and examples.\n\n';
    } else {
      info += '💡 In this mode, I guide you through questions to discover answers yourself.\n\n';
    }

    if (config && config.allow_mode_switching) {
      info += '*Available Commands:*\n';
      info += '• `/regular` or `/direct` - Switch to Regular Mode\n';
      info += '• `/socratic` or `/discovery` - Switch to Socratic Mode\n';
      info += '• `/mode` - Show current mode\n';
      info += '• `/modes` - List all modes\n';

      if (config.switch_cooldown_minutes > 0) {
        info += `\n⏱️ Mode switching has a ${config.switch_cooldown_minutes}-minute cooldown.`;
      }
    } else {
      info += '🔒 Mode switching is not available for this course.';
    }

    return info;
  }

  /**
   * Generate comparison text for both modes
   * @returns {string} - Comparison text
   */
  generateModeComparison() {
    return '📚 *Coaching Modes Comparison*\n\n' +
      '🎯 *Regular Mode (Direct Coach)*\n' +
      '• Provides direct answers\n' +
      '• Detailed explanations\n' +
      '• Step-by-step solutions\n' +
      '• Quick learning\n' +
      '• Best for: Fast knowledge acquisition\n\n' +
      '🤔 *Socratic Mode (Discovery Coach)*\n' +
      '• Asks guiding questions\n' +
      '• Encourages self-discovery\n' +
      '• Builds critical thinking\n' +
      '• Deeper understanding\n' +
      '• Best for: Deep learning and retention\n\n' +
      '💡 *Tip:* You can switch between modes anytime using `/regular` or `/socratic` commands!';
  }
}

// Export singleton instance
module.exports = new PromptTemplateService();
