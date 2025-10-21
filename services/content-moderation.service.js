/**
 * Content Moderation Service
 * Provides guardrails for harmful content including:
 * - Suicide/self-harm
 * - Violence
 * - Threats
 * - Aggression
 * - Profanity
 * - Vulgarity
 * - Harassment
 */

const leoProfanity = require('leo-profanity');
const logger = require('../utils/logger');
const postgresService = require('./database/postgres.service');

class ContentModerationService {
  constructor() {
    // Load multiple languages for leo-profanity
    leoProfanity.loadDictionary('en');
    leoProfanity.loadDictionary('fr');

    // Harmful content patterns
    this.harmfulPatterns = {
      suicide: {
        pattern: /\b(suicide|kill myself|end it all|want to die|self harm|hurt myself|no reason to live|better off dead)\b/i,
        severity: 'critical',
        message: "I notice you may be going through a difficult time. Please reach out to a counselor or call a crisis hotline. For immediate help:\n\n🆘 Tanzania Crisis Line: 116\n🆘 International: +1-800-273-8255\n\nI'm here to help with your educational content. What module would you like to learn about?"
      },

      violence: {
        pattern: /\b(kill|murder|stab|shoot|attack|beat up|assault|slaughter|massacre)\s+(you|him|her|them|someone|people)/i,
        severity: 'high',
        message: "I'm designed to support your learning journey. Let's focus on educational topics. What can I help you learn today?"
      },

      threats: {
        pattern: /\b(I will (kill|hurt|destroy|harm|attack)|going to (kill|hurt|destroy)|bomb|threat|revenge)\b/i,
        severity: 'high',
        message: "I can only assist with course-related questions. Please keep our conversation focused on your training modules."
      },

      profanity_explicit: {
        pattern: /\b(fuck|shit|damn|bitch|bastard|asshole|hell)\b/i,
        severity: 'low',
        message: "Let's keep our conversation professional. How can I help with your training?"
      },

      aggression: {
        pattern: /\b(fuck you|screw you|hate you|stupid|idiot|dumb|moron)\b/i,
        severity: 'medium',
        message: "Let's keep our conversation respectful and focused on learning. How can I help with your coursework?"
      },

      harassment: {
        pattern: /\b(harass|bully|intimidate|abuse|torment)\b/i,
        severity: 'medium',
        message: "I'm here to create a safe learning environment. Let's focus on your educational goals. What topic interests you?"
      },

      sexual: {
        pattern: /\b(sex|porn|nude|naked|xxx|adult content)\b/i,
        severity: 'high',
        message: "I provide educational assistance only. Please ask questions related to your training materials."
      }
    };

    // Educational topic keywords (to reduce false positives)
    this.educationalKeywords = [
      'business', 'production', 'management', 'finance', 'entrepreneurship',
      'marketing', 'accounting', 'economics', 'teacher', 'teaching', 'classroom',
      'student', 'learning', 'education', 'training', 'course', 'module'
    ];
  }

  /**
   * Check if message contains harmful content
   * @param {string} message - User message to check
   * @param {object} context - Additional context (user_id, phone, etc.)
   * @returns {object} - { allowed: boolean, reason: string, severity: string, message: string }
   */
  async checkMessage(message, context = {}) {
    if (!message || typeof message !== 'string') {
      return { allowed: true };
    }

    const lowerMessage = message.toLowerCase();
    const checkResult = {
      allowed: true,
      reason: null,
      severity: null,
      blockedMessage: null,
      category: null
    };

    try {
      // 1. Check for profanity using leo-profanity
      if (leoProfanity.check(message)) {
        checkResult.allowed = false;
        checkResult.reason = 'profanity';
        checkResult.severity = 'low';
        checkResult.category = 'profanity';
        checkResult.blockedMessage = "Let's keep our conversation professional. How can I help with your training?";
      }

      // 2. Check harmful patterns (skip if already blocked)
      if (checkResult.allowed) {
        for (const [category, config] of Object.entries(this.harmfulPatterns)) {
          if (config.pattern.test(message)) {
            // Check if it's in educational context to reduce false positives
            const isEducationalContext = this.educationalKeywords.some(keyword =>
              lowerMessage.includes(keyword)
            );

            // For critical issues (suicide), block regardless of context
            if (config.severity === 'critical' || !isEducationalContext) {
              checkResult.allowed = false;
              checkResult.reason = category;
              checkResult.severity = config.severity;
              checkResult.category = category;
              checkResult.blockedMessage = config.message;
              break;
            }
          }
        }
      }

      // 3. Log if content was blocked
      if (!checkResult.allowed) {
        await this.logModerationEvent({
          user_id: context.user_id,
          user_phone: context.phone,
          message: message,
          moderation_reason: checkResult.reason,
          severity: checkResult.severity,
          blocked_by: 'local_filter',
          category: checkResult.category
        });

        logger.warn('Content blocked by moderation', {
          reason: checkResult.reason,
          severity: checkResult.severity,
          user_id: context.user_id,
          phone: context.phone
        });
      }

      return checkResult;

    } catch (error) {
      logger.error('Error in content moderation:', error);
      // On error, allow message through (fail open) but log the error
      return { allowed: true, error: error.message };
    }
  }

  /**
   * Clean/sanitize message by removing profanity
   * @param {string} message - Message to clean
   * @returns {string} - Cleaned message
   */
  cleanMessage(message) {
    try {
      return leoProfanity.clean(message);
    } catch (error) {
      logger.error('Error cleaning message:', error);
      return message;
    }
  }

  /**
   * Log moderation event to database
   * @param {object} event - Moderation event details
   */
  async logModerationEvent(event) {
    try {
      const query = `
        INSERT INTO content_moderation_log
        (user_id, user_phone, message, moderation_reason, severity, blocked_by, category, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `;

      await postgresService.pool.query(query, [
        event.user_id || null,
        event.user_phone || null,
        event.message,
        event.moderation_reason,
        event.severity,
        event.blocked_by,
        event.category || event.moderation_reason
      ]);

    } catch (error) {
      // Don't fail the request if logging fails
      logger.error('Error logging moderation event:', error);
    }
  }

  /**
   * Log Vertex AI safety block
   * @param {object} event - Safety event from Vertex AI
   */
  async logVertexAISafetyBlock(event) {
    try {
      await this.logModerationEvent({
        user_id: event.user_id,
        user_phone: event.phone,
        message: event.message,
        moderation_reason: event.category || 'vertex_ai_safety',
        severity: event.severity || 'medium',
        blocked_by: 'vertex_ai',
        category: event.category
      });
    } catch (error) {
      logger.error('Error logging Vertex AI safety block:', error);
    }
  }

  /**
   * Get moderation statistics
   * @param {number} days - Number of days to look back
   * @returns {object} - Statistics
   */
  async getModerationStats(days = 7) {
    try {
      const query = `
        SELECT
          category,
          severity,
          COUNT(*) as count,
          blocked_by
        FROM content_moderation_log
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY category, severity, blocked_by
        ORDER BY count DESC
      `;

      const result = await postgresService.pool.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error getting moderation stats:', error);
      return [];
    }
  }
}

module.exports = new ContentModerationService();
