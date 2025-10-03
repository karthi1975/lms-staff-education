/**
 * Nudging Service
 * Implements intelligent nudging for user engagement
 */

const UserService = require('../auth/user.service');
const UserModel = require('../../models/user.model');
const whatsappService = require('../whatsapp.service');
const ContentService = require('../rag/content.service');
const logger = require('../../utils/logger');

class NudgingService {
  // Nudge templates
  static NUDGE_TEMPLATES = {
    welcome_back: {
      type: 'welcome_back',
      messages: [
        "Welcome back! 🎓 Ready to continue your learning journey? Your progress has been saved.",
        "Hi again! 📚 Let's pick up where you left off. You're doing great!",
        "Good to see you back! 🌟 Your next lesson is waiting for you."
      ]
    },
    inactive_gentle: {
      type: 'inactive_gentle',
      messages: [
        "Hi! We noticed you haven't been active lately. Your learning journey awaits! 📖",
        "Missing your presence in the training! Ready to continue? 🎯",
        "Hey there! Your classmates are making progress. Join them! 💪"
      ]
    },
    quiz_reminder: {
      type: 'quiz_reminder',
      messages: [
        "You're ready for the quiz! 📝 Feel confident to test your knowledge.",
        "Quiz time! Show what you've learned. You've got this! 🌟",
        "Ready to complete this module? Take the quiz when you're ready! ✅"
      ]
    },
    quiz_retry: {
      type: 'quiz_retry',
      messages: [
        "Don't give up! Review the materials and try the quiz again. Every expert was once a beginner. 💪",
        "Almost there! A little more practice and you'll ace it. Would you like to review key concepts? 📚",
        "Learning takes time. Review the lessons and give it another shot! You can do this! 🎯"
      ]
    },
    milestone_celebration: {
      type: 'milestone_celebration',
      messages: [
        "🎉 Congratulations! You've completed {milestone}! Keep up the excellent work!",
        "🏆 Amazing progress! {milestone} achieved! You're on fire!",
        "⭐ Well done! {milestone} completed! Your dedication is inspiring!"
      ]
    },
    daily_tip: {
      type: 'daily_tip',
      messages: [
        "💡 Teaching tip: {tip}",
        "📌 Did you know? {tip}",
        "🔍 Quick insight: {tip}"
      ]
    }
  };

  /**
   * Check and send nudges to inactive users
   */
  static async checkAndSendNudges() {
    try {
      logger.info('Starting nudge check process...');
      
      // Get users for different nudge types
      const nudgeTasks = [
        this.nudgeInactiveUsers(3),      // 3 days inactive
        this.nudgeQuizReminders(),       // Ready for quiz
        this.nudgeQuizRetry(),          // Failed quiz recently
        this.sendDailyTips()            // Daily learning tips
      ];

      const results = await Promise.all(nudgeTasks);
      
      const totalNudges = results.reduce((sum, r) => sum + r.sent, 0);
      
      logger.info(`Nudge check complete. Sent ${totalNudges} nudges.`);
      
      return {
        total_sent: totalNudges,
        details: results
      };
    } catch (error) {
      logger.error('Check and send nudges error:', error);
      throw error;
    }
  }

  /**
   * Nudge inactive users
   */
  static async nudgeInactiveUsers(inactiveDays = 3) {
    try {
      const users = await UserService.getUsersForNudging(inactiveDays);
      let sentCount = 0;

      for (const user of users) {
        // Check last nudge time
        if (this.shouldSendNudge(user)) {
          const nudgeType = inactiveDays > 7 ? 'inactive_gentle' : 'welcome_back';
          const sent = await this.sendNudge(user, nudgeType);
          
          if (sent) sentCount++;
        }
      }

      logger.info(`Sent ${sentCount} inactivity nudges to ${users.length} eligible users`);
      
      return {
        type: 'inactive_users',
        eligible: users.length,
        sent: sentCount
      };
    } catch (error) {
      logger.error('Nudge inactive users error:', error);
      return { type: 'inactive_users', eligible: 0, sent: 0 };
    }
  }

  /**
   * Send quiz reminders
   */
  static async nudgeQuizReminders() {
    try {
      // Get users who completed content but haven't taken quiz
      const users = await this.getUsersReadyForQuiz();
      let sentCount = 0;

      for (const user of users) {
        if (this.shouldSendNudge(user, 'quiz_reminder')) {
          const sent = await this.sendNudge(user, 'quiz_reminder', {
            module_name: user.current_module?.name
          });
          
          if (sent) sentCount++;
        }
      }

      logger.info(`Sent ${sentCount} quiz reminders`);
      
      return {
        type: 'quiz_reminders',
        eligible: users.length,
        sent: sentCount
      };
    } catch (error) {
      logger.error('Nudge quiz reminders error:', error);
      return { type: 'quiz_reminders', eligible: 0, sent: 0 };
    }
  }

  /**
   * Nudge users who need to retry quiz
   */
  static async nudgeQuizRetry() {
    try {
      // Get users who failed quiz recently
      const users = await this.getUsersNeedingQuizRetry();
      let sentCount = 0;

      for (const user of users) {
        if (this.shouldSendNudge(user, 'quiz_retry')) {
          // Get weak areas for personalized message
          const weakAreas = await this.identifyWeakAreas(user);
          
          const sent = await this.sendNudge(user, 'quiz_retry', {
            weak_areas: weakAreas
          });
          
          if (sent) sentCount++;
        }
      }

      logger.info(`Sent ${sentCount} quiz retry nudges`);
      
      return {
        type: 'quiz_retry',
        eligible: users.length,
        sent: sentCount
      };
    } catch (error) {
      logger.error('Nudge quiz retry error:', error);
      return { type: 'quiz_retry', eligible: 0, sent: 0 };
    }
  }

  /**
   * Send daily learning tips
   */
  static async sendDailyTips() {
    try {
      // Get active users for daily tips
      const users = await this.getActiveUsersForTips();
      let sentCount = 0;

      for (const user of users) {
        const tip = await this.getPersonalizedTip(user);
        
        if (tip) {
          const sent = await this.sendNudge(user, 'daily_tip', { tip });
          if (sent) sentCount++;
        }
      }

      logger.info(`Sent ${sentCount} daily tips`);
      
      return {
        type: 'daily_tips',
        eligible: users.length,
        sent: sentCount
      };
    } catch (error) {
      logger.error('Send daily tips error:', error);
      return { type: 'daily_tips', eligible: 0, sent: 0 };
    }
  }

  /**
   * Send milestone celebration
   */
  static async celebrateMilestone(userId, milestone) {
    try {
      const user = await UserModel.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const sent = await this.sendNudge(user, 'milestone_celebration', { milestone });
      
      if (sent) {
        logger.info(`Milestone celebration sent to user ${userId}: ${milestone}`);
      }
      
      return sent;
    } catch (error) {
      logger.error('Celebrate milestone error:', error);
      return false;
    }
  }

  /**
   * Send a nudge to a user
   */
  static async sendNudge(user, nudgeType, variables = {}) {
    try {
      const template = this.NUDGE_TEMPLATES[nudgeType];
      
      if (!template) {
        logger.error(`Unknown nudge type: ${nudgeType}`);
        return false;
      }

      // Select random message from template
      const messageTemplate = template.messages[
        Math.floor(Math.random() * template.messages.length)
      ];

      // Replace variables in message
      let message = messageTemplate;
      for (const [key, value] of Object.entries(variables)) {
        message = message.replace(`{${key}}`, value);
      }

      // Add personalization
      message = `Hi ${user.name}! ${message}`;

      // Add action buttons if appropriate
      if (nudgeType === 'quiz_reminder' || nudgeType === 'quiz_retry') {
        message += "\n\nReply with:\n📚 'REVIEW' to review content\n📝 'QUIZ' to take the quiz\n❓ 'HELP' for assistance";
      } else if (nudgeType === 'inactive_gentle' || nudgeType === 'welcome_back') {
        message += "\n\nReply 'CONTINUE' to resume your learning journey!";
      }

      // Send via WhatsApp
      const sent = await whatsappService.sendMessage(user.whatsapp_id, message);
      
      if (sent) {
        // Record nudge
        await UserService.recordNudge(user.id, nudgeType, message);
      }

      return sent;
    } catch (error) {
      logger.error(`Send nudge error for user ${user.id}:`, error);
      return false;
    }
  }

  // Helper methods

  /**
   * Check if should send nudge to user
   */
  static shouldSendNudge(user, nudgeType = null) {
    const lastNudge = user.metadata?.last_nudge_sent;
    
    if (!lastNudge) return true;

    const hoursSinceLastNudge = (Date.now() - new Date(lastNudge)) / (1000 * 60 * 60);
    
    // Different cooldown periods for different nudge types
    const cooldownHours = {
      welcome_back: 72,
      inactive_gentle: 120,
      quiz_reminder: 48,
      quiz_retry: 24,
      milestone_celebration: 0,
      daily_tip: 24
    };

    const cooldown = cooldownHours[nudgeType] || 48;
    
    return hoursSinceLastNudge >= cooldown;
  }

  /**
   * Get users ready for quiz
   */
  static async getUsersReadyForQuiz() {
    try {
      const users = await UserModel.getUsersReadyForQuiz();
      
      return users.filter(user => {
        // Check if user has viewed enough content
        const contentViews = user.metadata?.content_views || 0;
        return contentViews >= 5; // Minimum content views before quiz
      });
    } catch (error) {
      logger.error('Get users ready for quiz error:', error);
      return [];
    }
  }

  /**
   * Get users needing quiz retry
   */
  static async getUsersNeedingQuizRetry() {
    try {
      const users = await UserModel.getUsersFailedQuiz();
      
      return users.filter(user => {
        const lastAttempt = user.last_quiz_attempt;
        
        if (!lastAttempt) return false;

        // Wait at least 24 hours before retry nudge
        const hoursSinceAttempt = (Date.now() - new Date(lastAttempt)) / (1000 * 60 * 60);
        
        return hoursSinceAttempt >= 24 && hoursSinceAttempt <= 72;
      });
    } catch (error) {
      logger.error('Get users needing quiz retry error:', error);
      return [];
    }
  }

  /**
   * Get active users for daily tips
   */
  static async getActiveUsersForTips() {
    try {
      // Get users active in last 7 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7);

      const users = await UserModel.getActiveUsers(cutoffDate);
      
      // Filter users who haven't received tip today
      return users.filter(user => {
        const lastTip = user.metadata?.last_tip_sent;
        
        if (!lastTip) return true;

        const hoursSinceTip = (Date.now() - new Date(lastTip)) / (1000 * 60 * 60);
        return hoursSinceTip >= 24;
      });
    } catch (error) {
      logger.error('Get active users for tips error:', error);
      return [];
    }
  }

  /**
   * Identify weak areas for user
   */
  static async identifyWeakAreas(user) {
    try {
      // This would analyze quiz attempts to identify weak areas
      // For now, return generic areas
      const areas = [
        'Review the introduction section',
        'Focus on practical examples',
        'Practice with sample questions'
      ];

      return areas.join(', ');
    } catch (error) {
      logger.error('Identify weak areas error:', error);
      return 'Review key concepts';
    }
  }

  /**
   * Get personalized tip for user
   */
  static async getPersonalizedTip(user) {
    const tips = [
      'Active learning techniques like summarizing help retention by 50%',
      'Teaching others what you learn improves understanding by 90%',
      'Taking breaks every 25 minutes increases focus and productivity',
      'Writing notes by hand improves memory retention',
      'Testing yourself regularly is more effective than re-reading',
      'Visual aids and diagrams can improve learning by 400%',
      'Setting specific goals increases achievement likelihood by 42%'
    ];

    // Select tip based on user's current module
    const moduleIndex = parseInt(user.current_module_id?.replace('module', '') || 1) - 1;
    const tipIndex = (moduleIndex + user.id) % tips.length;
    
    return tips[tipIndex];
  }

  /**
   * Schedule nudge campaigns
   */
  static async scheduleCampaign(campaignType, schedule) {
    try {
      // This would integrate with a job scheduler
      // For now, log the campaign
      logger.info(`Campaign scheduled: ${campaignType} at ${schedule}`);
      
      return {
        campaign_type: campaignType,
        schedule,
        status: 'scheduled'
      };
    } catch (error) {
      logger.error('Schedule campaign error:', error);
      throw error;
    }
  }
}

module.exports = NudgingService;