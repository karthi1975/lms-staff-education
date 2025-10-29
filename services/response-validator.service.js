/**
 * Response Validator Service
 * Validates AI responses before sending to users
 *
 * Security Layer 4: Post-processing output validation
 */

const logger = require('../utils/logger');

class ResponseValidator {
  constructor() {
    // Educational keywords (should appear in valid responses)
    this.educationalKeywords = [
      'teach', 'teacher', 'student', 'classroom', 'learning', 'education',
      'lesson', 'curriculum', 'assessment', 'pedagogy', 'training',
      'instruction', 'school', 'course', 'module', 'study', 'educational',
      'academic', 'educational', 'pedagogical', 'didactic',
      // Swahili
      'mwalimu', 'elimu', 'darasa', 'mafunzo', 'kujifunza', 'masomo',
      'wanafunzi', 'ufundishaji', 'mtaala'
    ];

    // Topics that should NEVER appear in responses
    this.forbiddenTopics = [
      { pattern: /\b(bitcoin|crypto|cryptocurrency|blockchain|NFT)\b/i, topic: 'cryptocurrency' },
      { pattern: /\b(stock|invest|trading|forex|portfolio)\b/i, topic: 'financial_investment' },
      { pattern: /\b(dating|romance|relationship advice|love life)\b/i, topic: 'dating_advice' },
      { pattern: /\b(political party|election|vote for|campaign)\b/i, topic: 'politics' },
      { pattern: /\b(porn|sex|nude|adult content)\b/i, topic: 'adult_content' },
      { pattern: /\b(casino|gambling|betting|lottery)\b/i, topic: 'gambling' },
      { pattern: /\b(drug|marijuana|cocaine|prescription)\b/i, topic: 'drugs' },
      { pattern: /\b(weapon|gun|firearm|explosive)\b/i, topic: 'weapons' }
    ];

    // System prompt leakage patterns
    this.leakagePatterns = [
      /you are (a|an) .* (assistant|bot|AI)/i,
      /your (role|purpose) is to/i,
      /instructions.*received/i,
      /system.*prompt/i,
      /my training (data|materials|instructions)/i,
      /I was (told|instructed|programmed) to/i,
      /as (a|an) language model/i,
      /I (am|was) created (by|to)/i,
      /my creators (told|instructed)/i
    ];
  }

  /**
   * Validate AI response before sending to user
   * @param {string} aiResponse - AI-generated response
   * @param {object} context - Request context (module_id, user_id, etc.)
   * @returns {object} - { valid: boolean, blocked: boolean, reason?: string, safeResponse?: string, warnings?: array }
   */
  validateResponse(aiResponse, context = {}) {
    if (!aiResponse || typeof aiResponse !== 'string') {
      return {
        valid: false,
        blocked: true,
        reason: 'empty_response',
        safeResponse: "I apologize, but I couldn't generate a proper response. Please try rephrasing your question."
      };
    }

    const issues = [];

    // 1. Check for system prompt leakage (CRITICAL)
    for (const pattern of this.leakagePatterns) {
      if (pattern.test(aiResponse)) {
        logger.error('System prompt leakage detected in AI response', {
          pattern: pattern.toString(),
          module_id: context.module_id
        });

        issues.push({
          type: 'prompt_leakage',
          severity: 'critical',
          pattern: pattern.toString()
        });
      }
    }

    // 2. Check for forbidden topics (HIGH)
    for (const { pattern, topic } of this.forbiddenTopics) {
      if (pattern.test(aiResponse)) {
        logger.warn(`Forbidden topic detected in AI response: ${topic}`, {
          module_id: context.module_id
        });

        issues.push({
          type: 'forbidden_topic',
          severity: 'high',
          topic: topic
        });
      }
    }

    // 3. Check if response is educational (MEDIUM - if response is long)
    if (aiResponse.length > 200) {
      const hasEducationalContext = this.educationalKeywords.some(keyword =>
        aiResponse.toLowerCase().includes(keyword)
      );

      if (!hasEducationalContext) {
        // Check if response contains generic phrases (might be off-topic)
        const genericPhrases = [
          'i can help', 'i can assist', 'i\'m here to', 'feel free to ask',
          'happy to help', 'let me know'
        ];

        const isGenericOnly = genericPhrases.some(phrase =>
          aiResponse.toLowerCase().includes(phrase)
        );

        if (isGenericOnly || aiResponse.split(' ').length > 50) {
          logger.warn('AI response lacks educational keywords', {
            response_length: aiResponse.length,
            module_id: context.module_id
          });

          issues.push({
            type: 'off_topic',
            severity: 'medium'
          });
        }
      }
    }

    // 4. Check response length (very long responses might be hallucination)
    if (aiResponse.length > 3000) {
      logger.warn('AI response is unusually long', {
        response_length: aiResponse.length,
        module_id: context.module_id
      });

      issues.push({
        type: 'excessive_length',
        severity: 'low'
      });
    }

    // 5. Check for repetitive content (hallucination indicator)
    const repetitivePattern = /(.{50,})\1{2,}/;
    if (repetitivePattern.test(aiResponse)) {
      logger.warn('Repetitive content detected in AI response');

      issues.push({
        type: 'repetitive_content',
        severity: 'medium'
      });
    }

    // DECISION LOGIC
    if (issues.length === 0) {
      return { valid: true, blocked: false };
    }

    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const highIssues = issues.filter(i => i.severity === 'high');

    // Block if critical or multiple high-severity issues
    if (criticalIssues.length > 0 || highIssues.length >= 2) {
      const reason = criticalIssues.length > 0
        ? criticalIssues[0].type
        : highIssues[0].type;

      logger.error('AI response BLOCKED by validator', {
        reason: reason,
        issues: issues,
        module_id: context.module_id
      });

      return {
        valid: false,
        blocked: true,
        reason: reason,
        safeResponse: this.getSafeResponse(reason),
        issues: issues
      };
    }

    // Allow but log warnings
    logger.warn('AI response has warnings but allowed', {
      issues: issues,
      module_id: context.module_id
    });

    return {
      valid: true,
      blocked: false,
      warnings: issues
    };
  }

  /**
   * Get safe fallback response based on issue type
   */
  getSafeResponse(issueType) {
    const responses = {
      prompt_leakage: "I apologize, but I can only discuss teacher training and educational topics. Please ask a question related to your coursework.",
      forbidden_topic: "That topic is outside my scope. I can only help with teacher training and educational content. What educational question can I answer?",
      off_topic: "Let's focus on teacher training topics. What would you like to learn about classroom management, lesson planning, or teaching methods?",
      excessive_length: "Let me provide a more concise answer. Could you clarify what specific aspect you'd like to know about?",
      repetitive_content: "I apologize, but I encountered an error generating that response. Could you rephrase your question?",
      empty_response: "I apologize, but I couldn't generate a proper response. Please try rephrasing your question."
    };

    return responses[issueType] ||
      "I can only help with teacher training. Please ask a question related to education.";
  }

  /**
   * Sanitize response (remove any leaked system info)
   */
  sanitizeResponse(aiResponse) {
    let sanitized = aiResponse;

    // Remove common system leakage phrases
    const leakagePhrases = [
      /As (a|an) (AI|language model|assistant)[^.]*\./gi,
      /I (am|was) (created|designed|programmed)[^.]*\./gi,
      /My (training|programming|instructions)[^.]*\./gi
    ];

    for (const pattern of leakagePhrases) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Clean up any resulting double spaces or newlines
    sanitized = sanitized.replace(/\s{2,}/g, ' ').trim();

    return sanitized;
  }

  /**
   * Quick check if response is likely safe (for fast-path optimization)
   */
  quickCheck(aiResponse) {
    if (!aiResponse) return false;

    // Quick reject patterns
    const quickRejectPatterns = [
      /ignore previous/i,
      /system prompt/i,
      /cryptocurrency|bitcoin/i,
      /adult content|porn/i
    ];

    return !quickRejectPatterns.some(pattern => pattern.test(aiResponse));
  }
}

module.exports = new ResponseValidator();
