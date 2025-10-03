/**
 * User Service
 * Handles user identification, tracking, and basic user operations
 */

const UserModel = require('../../models/user.model');
const SessionModel = require('../../models/session.model');
const logger = require('../../utils/logger');

class UserService {
  /**
   * Identify or create a WhatsApp user
   */
  static async identifyUser(whatsapp_id, name, metadata = {}) {
    try {
      // Validate WhatsApp ID format
      if (!this.isValidWhatsAppId(whatsapp_id)) {
        throw new Error('Invalid WhatsApp ID format');
      }

      // Find or create user
      const result = await UserModel.findOrCreate(whatsapp_id, name);
      
      // Update metadata if provided
      if (Object.keys(metadata).length > 0) {
        await UserModel.updateMetadata(result.user.id, metadata);
        result.user.metadata = { ...result.user.metadata, ...metadata };
      }

      // Log user activity
      logger.info(`User identified: ${whatsapp_id} (${result.isNew ? 'new' : 'existing'})`);

      return {
        user: result.user,
        isNew: result.isNew,
        welcomeRequired: result.isNew
      };
    } catch (error) {
      logger.error('User identification error:', error);
      throw error;
    }
  }

  /**
   * Get user by WhatsApp ID
   */
  static async getUserByWhatsAppId(whatsapp_id) {
    try {
      const user = await UserModel.findByWhatsAppId(whatsapp_id);
      
      if (!user) {
        return null;
      }

      // Get user's current progress
      const progress = await UserModel.getUserProgress(user.id);
      
      return progress;
    } catch (error) {
      logger.error('Get user error:', error);
      throw error;
    }
  }

  /**
   * Update user's current module
   */
  static async updateUserModule(userId, moduleId, metadata = {}) {
    try {
      const updates = {
        current_module_id: moduleId,
        metadata: {
          last_module_change: new Date().toISOString(),
          ...metadata
        }
      };

      const updatedUser = await UserModel.update(userId, updates);
      
      logger.info(`User ${userId} module updated to ${moduleId}`);
      
      return updatedUser;
    } catch (error) {
      logger.error('Update user module error:', error);
      throw error;
    }
  }

  /**
   * Track user activity
   */
  static async trackActivity(userId, activityType, data = {}) {
    try {
      const metadata = {
        last_activity: new Date().toISOString(),
        last_activity_type: activityType,
        activity_count: 1,
        ...data
      };

      // Get current user
      const user = await UserModel.findById(userId);
      
      if (user && user.metadata) {
        // Increment activity count
        metadata.activity_count = (user.metadata.activity_count || 0) + 1;
      }

      // Update user metadata
      await UserModel.updateMetadata(userId, metadata);
      
      logger.info(`Activity tracked for user ${userId}: ${activityType}`);
      
      return true;
    } catch (error) {
      logger.error('Track activity error:', error);
      // Don't throw error for tracking failures
      return false;
    }
  }

  /**
   * Get user's learning statistics
   */
  static async getUserStats(userId) {
    try {
      // Get user with progress
      const userProgress = await UserModel.getUserProgress(userId);
      
      if (!userProgress) {
        throw new Error('User not found');
      }

      // Calculate statistics
      const stats = {
        user: {
          id: userProgress.id,
          name: userProgress.name,
          whatsapp_id: userProgress.whatsapp_id,
          joined_at: userProgress.created_at
        },
        progress: {
          current_module: userProgress.current_module,
          modules_completed: userProgress.modules_completed || [],
          quiz_attempts: userProgress.quiz_attempts || 0,
          quiz_passed: userProgress.quiz_passed || 0,
          average_score: userProgress.average_score || 0
        },
        engagement: {
          total_sessions: userProgress.total_sessions || 0,
          last_session: userProgress.last_session || null,
          activity_count: userProgress.metadata?.activity_count || 0,
          last_activity: userProgress.metadata?.last_activity || null
        }
      };

      // Calculate completion percentage
      const totalModules = 5; // Total modules in the system
      stats.progress.completion_percentage = Math.round(
        (stats.progress.modules_completed.length / totalModules) * 100
      );

      // Calculate pass rate
      if (stats.progress.quiz_attempts > 0) {
        stats.progress.pass_rate = Math.round(
          (stats.progress.quiz_passed / stats.progress.quiz_attempts) * 100
        );
      } else {
        stats.progress.pass_rate = 0;
      }

      return stats;
    } catch (error) {
      logger.error('Get user stats error:', error);
      throw error;
    }
  }

  /**
   * Get all users with filters
   */
  static async getAllUsers(options = {}) {
    try {
      const result = await UserModel.findAll(options);
      return result;
    } catch (error) {
      logger.error('Get all users error:', error);
      throw error;
    }
  }

  /**
   * Mark user as inactive
   */
  static async deactivateUser(userId) {
    try {
      const updates = {
        metadata: {
          is_active: false,
          deactivated_at: new Date().toISOString()
        }
      };

      const updatedUser = await UserModel.update(userId, updates);
      
      // End all active sessions
      await SessionModel.endAllUserSessions(userId);
      
      logger.info(`User ${userId} deactivated`);
      
      return updatedUser;
    } catch (error) {
      logger.error('Deactivate user error:', error);
      throw error;
    }
  }

  /**
   * Reactivate user
   */
  static async reactivateUser(userId) {
    try {
      const updates = {
        metadata: {
          is_active: true,
          reactivated_at: new Date().toISOString()
        }
      };

      const updatedUser = await UserModel.update(userId, updates);
      
      logger.info(`User ${userId} reactivated`);
      
      return updatedUser;
    } catch (error) {
      logger.error('Reactivate user error:', error);
      throw error;
    }
  }

  /**
   * Validate WhatsApp ID format
   */
  static isValidWhatsAppId(whatsapp_id) {
    // E.164 format: + followed by country code and number
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(whatsapp_id);
  }

  /**
   * Get users requiring nudges
   */
  static async getUsersForNudging(inactiveDays = 3) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

      const users = await UserModel.getInactiveUsers(cutoffDate);
      
      // Filter users who haven't completed all modules
      const nudgeableUsers = users.filter(user => {
        const modulesCompleted = user.modules_completed || [];
        return modulesCompleted.length < 5; // Total modules
      });

      logger.info(`Found ${nudgeableUsers.length} users for nudging`);
      
      return nudgeableUsers;
    } catch (error) {
      logger.error('Get users for nudging error:', error);
      throw error;
    }
  }

  /**
   * Record nudge sent to user
   */
  static async recordNudge(userId, nudgeType, message) {
    try {
      const metadata = {
        last_nudge_sent: new Date().toISOString(),
        last_nudge_type: nudgeType,
        nudge_count: 1
      };

      // Get current user
      const user = await UserModel.findById(userId);
      
      if (user && user.metadata) {
        // Increment nudge count
        metadata.nudge_count = (user.metadata.nudge_count || 0) + 1;
      }

      // Update user metadata
      await UserModel.updateMetadata(userId, metadata);
      
      logger.info(`Nudge recorded for user ${userId}: ${nudgeType}`);
      
      return true;
    } catch (error) {
      logger.error('Record nudge error:', error);
      return false;
    }
  }
}

module.exports = UserService;