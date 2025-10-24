/**
 * ModuleManager
 *
 * SOLID Principle: Single Responsibility Principle (SRP)
 * Responsibility: Manage module access and configuration ONLY
 *
 * Handles module validation, access control, and retrieval.
 */
class ModuleManager {
  constructor(config, neo4jService, logger) {
    this.config = config;
    this.neo4jService = neo4jService;
    this.logger = logger;
  }

  /**
   * Check if user can access module
   * @param {string} userId - User ID
   * @param {string} moduleId - Module ID
   * @returns {Promise<boolean>} - True if user can access
   */
  async canUserAccessModule(userId, moduleId) {
    try {
      return await this.neo4jService.canUserAccessModule(userId, moduleId);
    } catch (error) {
      this.logger.error(`Error checking module access: ${error.message}`);
      return false;
    }
  }

  /**
   * Get available modules for user
   * @param {string} userId - User ID
   * @param {Object} userProgress - User progress data
   * @returns {Promise<Array>} - Array of available modules
   */
  async getAvailableModules(userId, userProgress) {
    const availableModules = [];

    for (const module of this.config.modules) {
      const canAccess = await this.canUserAccessModule(userId, module.id);

      if (canAccess) {
        const moduleProgress = userProgress?.modules?.find(m => m.id === module.id);
        const status = moduleProgress?.progress?.status || 'unlocked';

        if (status !== 'completed') {
          availableModules.push({
            ...module,
            status
          });
        }
      }
    }

    return availableModules;
  }

  /**
   * Get module details
   * @param {string} moduleId - Module ID
   * @returns {Object|null} - Module details or null
   */
  getModuleDetails(moduleId) {
    return this.config.getModuleById(moduleId);
  }

  /**
   * Get next unlocked module for user
   * @param {string} userId - User ID
   * @param {Object} userProgress - User progress data
   * @returns {Promise<Object|null>} - Next module or null
   */
  async getNextUnlockedModule(userId, userProgress) {
    const availableModules = await this.getAvailableModules(userId, userProgress);
    return availableModules.length > 0 ? availableModules[0] : null;
  }

  /**
   * Update module progress
   * @param {string} userId - User ID
   * @param {string} moduleId - Module ID
   * @param {Object} progressData - Progress data
   * @returns {Promise<void>}
   */
  async updateProgress(userId, moduleId, progressData) {
    try {
      await this.neo4jService.trackUserProgress(userId, moduleId, progressData);
      this.logger.info(`Module progress updated: ${moduleId} for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error updating module progress: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unlock next module after completion
   * @param {string} userId - User ID
   * @param {string} completedModuleId - Completed module ID
   * @returns {Promise<Object|null>} - Unlocked module or null
   */
  async unlockNextModule(userId, completedModuleId) {
    const nextModule = this.config.getNextModule(completedModuleId);

    if (nextModule) {
      await this.updateProgress(userId, nextModule.id, {
        status: 'unlocked',
        completion_percentage: 0,
        time_spent: 0
      });
      this.logger.info(`Unlocked next module: ${nextModule.id} for user ${userId}`);
      return nextModule;
    }

    return null;
  }

  /**
   * Mark module as completed
   * @param {string} userId - User ID
   * @param {string} moduleId - Module ID
   * @param {number} score - Quiz score
   * @param {number} timeSpent - Time spent in seconds
   * @returns {Promise<void>}
   */
  async completeModule(userId, moduleId, score, timeSpent) {
    await this.updateProgress(userId, moduleId, {
      status: 'completed',
      completion_percentage: 100,
      quiz_score: score,
      time_spent: timeSpent
    });
  }
}

module.exports = ModuleManager;
