const neo4jService = require('../neo4j.service');
const sessionManager = require('../session/session-manager.service');
const logger = require('../../utils/logger');

/**
 * Coaching Engine Service
 * Implements intelligent nudging and coaching logic
 */
class CoachingEngineService {
  constructor() {
    this.NUDGE_INTERVAL_HOURS = parseInt(process.env.NUDGE_INACTIVITY_HOURS || '48');
    this.coachingRules = this.initializeCoachingRules();
  }

  /**
   * Initialize coaching rules
   */
  initializeCoachingRules() {
    return {
      inactivity: {
        threshold: this.NUDGE_INTERVAL_HOURS,
        messages: [
          "👋 Hi! We noticed you haven't been active lately. Ready to continue your learning journey?",
          "📚 Your progress is waiting! Let's pick up where you left off.",
          "🎯 Just a reminder - you have modules waiting to be completed. Want to continue?"
        ]
      },
      incomplete_modules: {
        messages: [
          "You're almost there! Complete {moduleName} to unlock the next module.",
          "Great progress! Ready to finish {moduleName}?",
          "🌟 You've started {moduleName}. Let's complete it together!"
        ]
      },
      quiz_failed: {
        messages: [
          "Don't worry! Review the content and try the quiz again. You can do it! 💪",
          "Learning takes practice. Review {moduleName} and retake the quiz when ready.",
          "Almost there! One more attempt can make all the difference. Review and try again!"
        ]
      },
      milestone: {
        messages: [
          "🎉 Congratulations! You've completed {count} modules!",
          "Amazing work! You're {percentage}% through your training!",
          "🏆 Milestone achieved! Keep up the excellent work!"
        ]
      },
      encouragement: {
        messages: [
          "You're doing great! Keep up the momentum! 🚀",
          "Your dedication is impressive. Keep learning!",
          "Every step forward is progress. Well done! ⭐"
        ]
      }
    };
  }

  /**
   * Check if user needs a nudge
   */
  async checkAndSendNudges(userId) {
    try {
      const nudgeData = await neo4jService.shouldNudgeUser(userId);

      if (!nudgeData.should_nudge) {
        return null;
      }

      const nudgeType = nudgeData.reason;
      const message = this.generateNudgeMessage(nudgeType, nudgeData);

      // Record the nudge
      await neo4jService.recordNudge(userId, {
        type: nudgeType,
        message: message,
        reason: nudgeData.reason
      });

      // Track behavior
      await neo4jService.trackLearningBehavior(userId, {
        type: 'nudge_sent',
        metadata: { reason: nudgeType }
      });

      logger.info(`Nudge sent to user ${userId}: ${nudgeType}`);

      return {
        message,
        type: nudgeType,
        data: nudgeData
      };
    } catch (error) {
      logger.error('Error checking nudges:', error);
      return null;
    }
  }

  /**
   * Generate appropriate nudge message
   */
  generateNudgeMessage(type, data) {
    const rules = this.coachingRules[type];
    if (!rules) return this.coachingRules.encouragement.messages[0];

    const messages = rules.messages;
    const message = messages[Math.floor(Math.random() * messages.length)];

    // Replace placeholders
    return message
      .replace('{moduleName}', data.module_name || 'your current module')
      .replace('{count}', data.incomplete_count || 0)
      .replace('{percentage}', Math.round(data.completion_percentage || 0));
  }

  /**
   * Get personalized learning recommendations
   */
  async getRecommendations(userId) {
    try {
      const recommendations = await neo4jService.getPersonalizedRecommendations(userId);

      // Track behavior
      await neo4jService.trackLearningBehavior(userId, {
        type: 'recommendations_requested',
        metadata: { count: recommendations.length }
      });

      return recommendations;
    } catch (error) {
      logger.error('Error getting recommendations:', error);
      return [];
    }
  }

  /**
   * Celebrate user milestones
   */
  async celebrateMilestone(userId, milestone) {
    try {
      const message = this.coachingRules.milestone.messages[0]
        .replace('{count}', milestone.count)
        .replace('{percentage}', milestone.percentage);

      await neo4jService.recordNudge(userId, {
        type: 'milestone',
        message: message,
        reason: 'achievement'
      });

      await neo4jService.trackLearningBehavior(userId, {
        type: 'milestone_reached',
        metadata: milestone
      });

      return message;
    } catch (error) {
      logger.error('Error celebrating milestone:', error);
      return null;
    }
  }

  /**
   * Analyze user engagement and provide coaching
   */
  async analyzeEngagement(userId) {
    try {
      const score = await neo4jService.getUserEngagementScore(userId);

      let coaching = {
        engagement_level: 'low',
        suggestions: []
      };

      if (score.engagement_score < 0.3) {
        coaching.engagement_level = 'low';
        coaching.suggestions = [
          'Try completing at least one module this week',
          'Set aside 15 minutes daily for learning',
          'Start with shorter modules to build momentum'
        ];
      } else if (score.engagement_score < 0.7) {
        coaching.engagement_level = 'medium';
        coaching.suggestions = [
          'You\'re making good progress! Keep it up',
          'Try to maintain your learning rhythm',
          'Challenge yourself with the next module'
        ];
      } else {
        coaching.engagement_level = 'high';
        coaching.suggestions = [
          'Excellent engagement! You\'re a star learner! ⭐',
          'Consider helping other learners',
          'You\'re on track to complete all modules soon!'
        ];
      }

      return {
        score: score.engagement_score,
        ...coaching
      };
    } catch (error) {
      logger.error('Error analyzing engagement:', error);
      return null;
    }
  }

  /**
   * Provide adaptive coaching based on user behavior
   */
  async provideAdaptiveCoaching(userId, context) {
    try {
      // Get user engagement
      const engagement = await this.analyzeEngagement(userId);

      // Get recommendations
      const recommendations = await this.getRecommendations(userId);

      // Check if nudge needed
      const nudge = await this.checkAndSendNudges(userId);

      return {
        engagement,
        recommendations,
        nudge,
        coaching_message: this.generateCoachingMessage(engagement, recommendations, nudge)
      };
    } catch (error) {
      logger.error('Error providing adaptive coaching:', error);
      return null;
    }
  }

  /**
   * Generate comprehensive coaching message
   */
  generateCoachingMessage(engagement, recommendations, nudge) {
    let message = '';

    if (nudge) {
      message += nudge.message + '\n\n';
    }

    if (engagement && engagement.engagement_level === 'high') {
      message += '🌟 ' + engagement.suggestions[0] + '\n\n';
    }

    if (recommendations && recommendations.length > 0) {
      message += '📚 Recommended next steps:\n';
      recommendations.forEach((rec, idx) => {
        message += `${idx + 1}. ${rec.name}\n`;
      });
    }

    return message.trim() || 'Keep up the great work! 💪';
  }

  /**
   * Schedule periodic nudges (to be called by cron job)
   */
  async sendScheduledNudges() {
    try {
      // This would typically be called by a scheduled task
      // Get all users who need nudges
      logger.info('Scheduled nudge check initiated');

      // Implementation would query for inactive users and send nudges
      // This is a placeholder for the scheduled task
    } catch (error) {
      logger.error('Error in scheduled nudges:', error);
    }
  }
}

module.exports = new CoachingEngineService();
