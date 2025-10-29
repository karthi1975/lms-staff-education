/**
 * Prompt Injection Guard Service
 * Detects and blocks prompt injection attempts in user messages
 *
 * Security Layer 1: Pre-processing input validation
 */

const logger = require('../utils/logger');
const postgresService = require('./database/postgres.service');

class PromptInjectionGuard {
  constructor() {
    // Injection attack patterns
    this.injectionPatterns = [
      // Direct instruction override
      { pattern: /ignore (previous|all|above|prior) (instructions|prompts|commands)/i, name: 'instruction_override', severity: 'high' },
      { pattern: /disregard (previous|all|above|prior) (instructions|prompts|commands)/i, name: 'instruction_override', severity: 'high' },
      { pattern: /forget (everything|all|previous|above)/i, name: 'instruction_override', severity: 'high' },

      // Role manipulation
      { pattern: /you are now (a|an)/i, name: 'role_hijacking', severity: 'high' },
      { pattern: /act as (a|an)/i, name: 'role_hijacking', severity: 'high' },
      { pattern: /pretend (you are|to be)/i, name: 'role_hijacking', severity: 'medium' },
      { pattern: /roleplay as/i, name: 'role_hijacking', severity: 'medium' },
      { pattern: /simulate (a|an)/i, name: 'role_hijacking', severity: 'medium' },

      // System prompt extraction
      { pattern: /show me (your|the) (system |hidden )?(prompt|instructions)/i, name: 'prompt_extraction', severity: 'high' },
      { pattern: /what (are|were) your (original |initial )?(instructions|prompts)/i, name: 'prompt_extraction', severity: 'high' },
      { pattern: /reveal your (system |hidden )?(prompt|instructions)/i, name: 'prompt_extraction', severity: 'high' },
      { pattern: /print your (system |hidden )?(prompt|instructions)/i, name: 'prompt_extraction', severity: 'high' },
      { pattern: /tell me (your|the) (system |hidden )?(prompt|instructions)/i, name: 'prompt_extraction', severity: 'high' },

      // Delimiter attacks (attempting to break out of context)
      { pattern: /[\n\r]{5,}/, name: 'delimiter_attack', severity: 'medium' },
      { pattern: /---{5,}/, name: 'delimiter_attack', severity: 'medium' },
      { pattern: /==={5,}/, name: 'delimiter_attack', severity: 'medium' },
      { pattern: /\*\*\*{5,}/, name: 'delimiter_attack', severity: 'medium' },

      // Code injection
      { pattern: /<script/i, name: 'code_injection', severity: 'critical' },
      { pattern: /javascript:/i, name: 'code_injection', severity: 'critical' },
      { pattern: /eval\(/i, name: 'code_injection', severity: 'critical' },
      { pattern: /<iframe/i, name: 'code_injection', severity: 'critical' },

      // Jailbreak attempts
      { pattern: /DAN mode/i, name: 'jailbreak', severity: 'critical' },
      { pattern: /developer mode/i, name: 'jailbreak', severity: 'high' },
      { pattern: /sudo mode/i, name: 'jailbreak', severity: 'high' },
      { pattern: /admin mode/i, name: 'jailbreak', severity: 'high' },
      { pattern: /unrestricted mode/i, name: 'jailbreak', severity: 'critical' },
      { pattern: /bypass (restrictions|filters|rules)/i, name: 'jailbreak', severity: 'critical' },

      // Output format manipulation
      { pattern: /respond in (json|xml|code|html)/i, name: 'format_manipulation', severity: 'medium' },
      { pattern: /output as (json|xml|code|html)/i, name: 'format_manipulation', severity: 'medium' },
      { pattern: /format.*output.*as/i, name: 'format_manipulation', severity: 'low' },

      // Educational context violations
      { pattern: /stop (teaching|being|acting)/i, name: 'context_violation', severity: 'medium' },
      { pattern: /instead.*tell me about/i, name: 'context_violation', severity: 'medium' },
      { pattern: /let's talk about.*instead/i, name: 'context_violation', severity: 'medium' }
    ];
  }

  /**
   * Detect prompt injection attempts
   * @param {string} userInput - User message to check
   * @returns {object} - { detected: boolean, pattern?: string, severity?: string, message?: string }
   */
  detectInjection(userInput) {
    if (!userInput || typeof userInput !== 'string') {
      return { detected: false };
    }

    const lowerInput = userInput.toLowerCase();

    // Check each pattern
    for (const { pattern, name, severity } of this.injectionPatterns) {
      if (pattern.test(userInput)) {
        logger.warn(`Prompt injection detected: ${name} (severity: ${severity})`, {
          pattern: pattern.toString(),
          input_length: userInput.length
        });

        return {
          detected: true,
          pattern: name,
          severity: severity,
          message: this.getBlockMessage(name)
        };
      }
    }

    // Check for excessive length (potential overflow attack)
    if (userInput.length > 2000) {
      return {
        detected: true,
        pattern: 'excessive_length',
        severity: 'medium',
        message: "Your message is too long. Please keep questions concise (under 2000 characters)."
      };
    }

    // Check for suspicious character patterns (control characters)
    const suspiciousChars = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;
    if (suspiciousChars.test(userInput)) {
      return {
        detected: true,
        pattern: 'suspicious_characters',
        severity: 'high',
        message: "Your message contains invalid characters. Please use standard text."
      };
    }

    // Check for repetitive patterns (potential DOS)
    const repetitivePattern = /(.{10,})\1{5,}/;
    if (repetitivePattern.test(userInput)) {
      return {
        detected: true,
        pattern: 'repetitive_pattern',
        severity: 'medium',
        message: "Your message contains suspicious repetitive patterns."
      };
    }

    return { detected: false };
  }

  /**
   * Get appropriate block message for injection type
   */
  getBlockMessage(injectionType) {
    const messages = {
      instruction_override: "I'm designed to help with teacher training content only. Let's focus on your educational questions!",
      role_hijacking: "I can only assist with teacher training topics. Please ask a question related to education.",
      prompt_extraction: "I can only help with teacher training. Please ask about course content or teaching methods.",
      delimiter_attack: "Your message format is invalid. Please send a clear question.",
      code_injection: "Your message contains invalid content. Please send a text question.",
      jailbreak: "I'm here to help with teacher training only. Please ask an educational question.",
      format_manipulation: "I can only answer questions in plain text. Please ask a normal question.",
      context_violation: "Let's keep our focus on teacher training. What educational topic can I help you with?",
      excessive_length: "Your message is too long. Please keep questions concise (under 2000 characters).",
      suspicious_characters: "Your message contains invalid characters. Please use standard text.",
      repetitive_pattern: "Your message contains suspicious patterns. Please send a clear question."
    };

    return messages[injectionType] || "I can only help with teacher training. Please ask an educational question.";
  }

  /**
   * Sanitize user input (removes potentially harmful patterns)
   * Note: This should be used AFTER detection, as a secondary defense
   * @param {string} userInput - User message to sanitize
   * @returns {string} - Sanitized message
   */
  sanitizeInput(userInput) {
    if (!userInput || typeof userInput !== 'string') {
      return '';
    }

    let sanitized = userInput;

    // Remove excessive newlines (keep max 2 consecutive)
    sanitized = sanitized.replace(/[\n\r]{3,}/g, '\n\n');

    // Remove excessive separators (keep max 3 chars)
    sanitized = sanitized.replace(/[-=*]{5,}/g, '---');

    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

    // Remove HTML/script tags (if any slipped through)
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    // Trim excessive whitespace (keep max 2 consecutive spaces)
    sanitized = sanitized.trim().replace(/\s{3,}/g, ' ');

    // Limit length
    if (sanitized.length > 2000) {
      sanitized = sanitized.substring(0, 2000);
    }

    return sanitized;
  }

  /**
   * Log injection attempt to database
   * @param {number} userId - User ID
   * @param {string} phone - User phone number
   * @param {string} message - Original message
   * @param {object} injectionData - Detection result
   */
  async logInjectionAttempt(userId, phone, message, injectionData) {
    try {
      const query = `
        INSERT INTO content_injection_log
        (user_id, user_phone, message, injection_pattern, severity, blocked, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `;

      await postgresService.pool.query(query, [
        userId || null,
        phone || null,
        message.substring(0, 1000), // Limit stored length
        injectionData.pattern,
        injectionData.severity,
        true
      ]);

    } catch (error) {
      // Don't fail the request if logging fails
      logger.error('Error logging injection attempt:', error);
    }
  }

  /**
   * Check if user has excessive failed attempts (potential attacker)
   * @param {number} userId - User ID
   * @param {string} phone - User phone number
   * @returns {boolean} - True if user should be flagged
   */
  async checkExcessiveAttempts(userId, phone) {
    try {
      const query = `
        SELECT COUNT(*) as attempt_count
        FROM content_injection_log
        WHERE (user_id = $1 OR user_phone = $2)
          AND created_at >= NOW() - INTERVAL '1 hour'
          AND severity IN ('high', 'critical')
      `;

      const result = await postgresService.pool.query(query, [userId, phone]);
      const attemptCount = parseInt(result.rows[0]?.attempt_count || 0);

      // Flag if more than 5 high-severity attempts in 1 hour
      if (attemptCount > 5) {
        logger.warn(`User ${userId || phone} has ${attemptCount} injection attempts in the last hour`);
        return true;
      }

      return false;

    } catch (error) {
      logger.error('Error checking attempt count:', error);
      return false; // Fail open
    }
  }
}

module.exports = new PromptInjectionGuard();
