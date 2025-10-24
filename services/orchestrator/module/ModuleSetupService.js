/**
 * ModuleSetupService
 *
 * SOLID Principle: Single Responsibility Principle (SRP)
 * Responsibility: Set up modules in Neo4j ONLY
 *
 * Handles initial module creation and linking in the graph database.
 */
class ModuleSetupService {
  constructor(config, neo4jService, logger) {
    this.config = config;
    this.neo4jService = neo4jService;
    this.logger = logger;
  }

  /**
   * Set up all modules in Neo4j
   * @returns {Promise<void>}
   */
  async setupAll() {
    for (const module of this.config.modules) {
      await this.setupModule(module);
    }
  }

  /**
   * Set up single module
   * @param {Object} module - Module configuration
   * @returns {Promise<void>}
   */
  async setupModule(module) {
    try {
      // Create module node
      await this.neo4jService.createModule({
        id: module.id,
        name: module.name,
        order_index: module.order,
        description: `Training module ${module.order}: ${module.name}`,
        difficulty: this.getDifficultyLevel(module.order),
        estimated_time: module.order * 30
      });

      // Link to previous module (prerequisite relationship)
      if (module.order > 1) {
        const prevModule = this.config.getModuleByOrder(module.order - 1);
        if (prevModule) {
          await this.neo4jService.linkModuleSequence(prevModule.id, module.id);
        }
      }

      this.logger.info(`Module setup complete: ${module.id}`);
    } catch (error) {
      this.logger.debug(`Module ${module.id} setup: ${error.message}`);
    }
  }

  /**
   * Get difficulty level based on module order
   * @param {number} order - Module order
   * @returns {string} - Difficulty level
   */
  getDifficultyLevel(order) {
    if (order <= 2) return 'beginner';
    if (order <= 4) return 'intermediate';
    return 'advanced';
  }
}

module.exports = ModuleSetupService;
