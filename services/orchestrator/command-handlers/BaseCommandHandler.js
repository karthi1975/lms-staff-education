/**
 * BaseCommandHandler
 *
 * SOLID Principles:
 * - SRP: Base class for command handling
 * - OCP: Open for extension via subclassing
 * - LSP: All subclasses must implement handle() method
 *
 * Abstract base class for command handlers (Strategy pattern).
 */
class BaseCommandHandler {
  constructor(dependencies) {
    this.config = dependencies.config;
    this.logger = dependencies.logger;
    this.neo4jService = dependencies.neo4jService;
    this.chromaService = dependencies.chromaService;
    this.vertexAIService = dependencies.vertexAIService;
    this.moduleManager = dependencies.moduleManager;
    this.quizManager = dependencies.quizManager;
  }

  /**
   * Check if this handler can handle the input
   * @abstract
   * @param {string} input - User input
   * @param {Object} session - User session
   * @returns {boolean} - True if this handler can handle it
   */
  canHandle(input, session) {
    throw new Error('canHandle() must be implemented by subclass');
  }

  /**
   * Handle the command
   * @abstract
   * @param {string} userId - User ID
   * @param {string} input - User input
   * @param {Object} userProgress - User progress
   * @param {Object} session - User session
   * @returns {Promise<Object>} - Response object
   */
  async handle(userId, input, userProgress, session) {
    throw new Error('handle() must be implemented by subclass');
  }
}

module.exports = BaseCommandHandler;
