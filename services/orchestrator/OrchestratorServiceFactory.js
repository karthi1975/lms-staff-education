const OrchestratorConfig = require('./OrchestratorConfig');
const SessionManager = require('./SessionManager');
const ModuleManager = require('./module/ModuleManager');
const ModuleSetupService = require('./module/ModuleSetupService');
const QuizStateManager = require('./quiz/QuizStateManager');
const QuizScorer = require('./quiz/QuizScorer');
const QuizManager = require('./quiz/QuizManager');
const CommandRouter = require('./CommandRouter');
const ResponseSender = require('./ResponseSender');
const MessageProcessor = require('./MessageProcessor');
const commandHandlers = require('./command-handlers');

/**
 * OrchestratorServiceFactory
 *
 * SOLID Principles:
 * - SRP: Creates orchestrator service instances ONLY
 * - DIP: Injects all dependencies
 * - OCP: Can create different configurations
 *
 * Factory pattern + Dependency Injection
 */
class OrchestratorServiceFactory {
  /**
   * Create orchestrator service
   * @param {Object} dependencies - External service dependencies
   * @param {Object} options - Configuration options
   * @returns {Object} - Orchestrator service
   */
  static create(dependencies, options = {}) {
    const {
      whatsappService,
      chromaService,
      neo4jService,
      vertexAIService,
      logger
    } = dependencies;

    // Create configuration
    const config = new OrchestratorConfig(options);

    // Create managers
    const sessionManager = new SessionManager(config, neo4jService, logger);
    const moduleManager = new ModuleManager(config, neo4jService, logger);
    const moduleSetupService = new ModuleSetupService(config, neo4jService, logger);

    // Create quiz services
    const quizStateManager = new QuizStateManager();
    const quizScorer = new QuizScorer(config);
    const quizManager = new QuizManager(
      config,
      quizStateManager,
      quizScorer,
      moduleManager,
      chromaService,
      vertexAIService,
      neo4jService,
      logger
    );

    // Create command handlers (order matters! ContentQueryHandler must be last)
    const handlerDependencies = {
      config,
      logger,
      neo4jService,
      chromaService,
      vertexAIService,
      moduleManager,
      quizManager
    };

    const handlers = [
      new commandHandlers.GreetingCommandHandler(handlerDependencies),
      new commandHandlers.MenuCommandHandler(handlerDependencies),
      new commandHandlers.ProgressCommandHandler(handlerDependencies),
      new commandHandlers.ModuleCommandHandler(handlerDependencies),
      new commandHandlers.QuizCommandHandler(handlerDependencies),
      new commandHandlers.ModeCommandHandler(handlerDependencies), // Coaching mode commands
      new commandHandlers.ContentQueryHandler(handlerDependencies) // Must be last!
    ];

    // Create router
    const commandRouter = new CommandRouter(handlers, logger);

    // Create response sender
    const responseSender = new ResponseSender(whatsappService, logger);

    // Create message processor
    const messageProcessor = new MessageProcessor(
      sessionManager,
      commandRouter,
      responseSender,
      neo4jService,
      whatsappService,
      logger
    );

    // Return service facade (backward compatible interface)
    return {
      // Configuration
      config,

      // Services
      sessionManager,
      moduleManager,
      quizManager,
      messageProcessor,

      // Main interface methods (backward compatible)
      initialize: async () => {
        try {
          await chromaService.initialize();

          // Neo4j is optional
          try {
            await neo4jService.initialize();
          } catch (neo4jError) {
            logger.warn('Neo4j not available, continuing without graph features:', neo4jError.message);
          }

          await moduleSetupService.setupAll();
          logger.info('Orchestrator initialized successfully');
        } catch (error) {
          logger.error('Failed to initialize orchestrator:', error);
          throw error;
        }
      },

      processWhatsAppMessage: (messageData) => messageProcessor.process(messageData),

      // Legacy properties for backward compatibility
      modules: config.modules,
      quizThreshold: config.quizThreshold,
      sessions: sessionManager.sessions
    };
  }
}

module.exports = OrchestratorServiceFactory;
