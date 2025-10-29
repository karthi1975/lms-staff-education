/**
 * OrchestratorConfig
 *
 * SOLID Principle: Single Responsibility Principle (SRP)
 * Responsibility: Provide orchestrator configuration ONLY
 *
 * Centralizes all orchestrator configuration including modules.
 */
class OrchestratorConfig {
  constructor(options = {}) {
    this.quizThreshold = options.quizThreshold || 0.7;
    this.sessionTTLHours = options.sessionTTLHours || 24;
    this.maxContextMessages = options.maxContextMessages || 5;
    this.defaultLanguage = options.defaultLanguage || 'english';
    this.modules = options.modules || this.getDefaultModules();
  }

  /**
   * Get default module configuration
   * @returns {Array} - Array of module objects
   */
  getDefaultModules() {
    return [
      { id: 'module_1', name: 'Introduction to Teaching', order: 1 },
      { id: 'module_2', name: 'Classroom Management', order: 2 },
      { id: 'module_3', name: 'Lesson Planning', order: 3 },
      { id: 'module_4', name: 'Assessment Strategies', order: 4 },
      { id: 'module_5', name: 'Technology in Education', order: 5 }
    ];
  }

  /**
   * Get module by ID
   * @param {string} moduleId - Module ID
   * @returns {Object|null} - Module object or null
   */
  getModuleById(moduleId) {
    return this.modules.find(m => m.id === moduleId) || null;
  }

  /**
   * Get module by order
   * @param {number} order - Module order (1-5)
   * @returns {Object|null} - Module object or null
   */
  getModuleByOrder(order) {
    return this.modules.find(m => m.order === order) || null;
  }

  /**
   * Get next module after given module
   * @param {string} moduleId - Current module ID
   * @returns {Object|null} - Next module or null
   */
  getNextModule(moduleId) {
    const currentModule = this.getModuleById(moduleId);
    if (!currentModule) return null;

    const nextOrder = currentModule.order + 1;
    return this.getModuleByOrder(nextOrder);
  }

  /**
   * Get previous module before given module
   * @param {string} moduleId - Current module ID
   * @returns {Object|null} - Previous module or null
   */
  getPreviousModule(moduleId) {
    const currentModule = this.getModuleById(moduleId);
    if (!currentModule) return null;

    const prevOrder = currentModule.order - 1;
    return this.getModuleByOrder(prevOrder);
  }

  /**
   * Get session TTL in milliseconds
   * @returns {number} - TTL in milliseconds
   */
  getSessionTTLMs() {
    return this.sessionTTLHours * 60 * 60 * 1000;
  }

  /**
   * Get quiz pass threshold percentage
   * @returns {number} - Pass threshold (0-100)
   */
  getQuizPassThreshold() {
    return this.quizThreshold * 100;
  }

  /**
   * Get configuration object
   * @returns {Object} - Configuration object
   */
  toObject() {
    return {
      quizThreshold: this.quizThreshold,
      sessionTTLHours: this.sessionTTLHours,
      maxContextMessages: this.maxContextMessages,
      defaultLanguage: this.defaultLanguage,
      modules: this.modules
    };
  }
}

module.exports = OrchestratorConfig;
