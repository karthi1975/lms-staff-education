/**
 * Orchestrator Service Module - SOLID Compliant
 *
 * This module provides a refactored orchestrator following SOLID principles:
 * - S: Single Responsibility - Each class has one job
 * - O: Open/Closed - Easy to extend with new commands/handlers
 * - L: Liskov Substitution - All handlers implement same interface
 * - I: Interface Segregation - Clean, focused interfaces
 * - D: Dependency Inversion - Depends on abstractions
 *
 * Usage (Backward Compatible):
 *   const orchestratorService = require('./services/orchestrator.service');
 *   await orchestratorService.initialize();
 *   await orchestratorService.processWhatsAppMessage(messageData);
 *
 * Advanced Usage:
 *   const { OrchestratorServiceFactory } = require('./services/orchestrator');
 *   const customOrchestrator = OrchestratorServiceFactory.create(dependencies, {
 *     quizThreshold: 0.8,
 *     sessionTTLHours: 48
 *   });
 */

const OrchestratorServiceFactory = require('./OrchestratorServiceFactory');

// Lazy initialization - will be created when first used
let defaultOrchestratorService = null;

/**
 * Get or create default orchestrator service
 * @returns {Object} - Default orchestrator service
 */
function getDefaultService() {
  if (!defaultOrchestratorService) {
    // Import dependencies
    const whatsappService = require('../whatsapp-adapter.service');
    const chromaService = require('../chroma.service');
    const neo4jService = require('../neo4j.service');
    const vertexAIService = require('../vertexai.service');
    const logger = require('../../utils/logger');

    // Create service
    defaultOrchestratorService = OrchestratorServiceFactory.create({
      whatsappService,
      chromaService,
      neo4jService,
      vertexAIService,
      logger
    });
  }

  return defaultOrchestratorService;
}

// Export default service proxy (backward compatible)
module.exports = new Proxy({}, {
  get(target, prop) {
    const service = getDefaultService();
    const value = service[prop];

    // If it's a function, bind it to the service
    if (typeof value === 'function') {
      return value.bind(service);
    }

    return value;
  }
});

// Export factory and components for advanced usage
module.exports.OrchestratorServiceFactory = OrchestratorServiceFactory;
module.exports.OrchestratorConfig = require('./OrchestratorConfig');
module.exports.SessionManager = require('./SessionManager');
module.exports.MessageProcessor = require('./MessageProcessor');
module.exports.CommandRouter = require('./CommandRouter');
module.exports.ResponseSender = require('./ResponseSender');
module.exports.ModuleManager = require('./module/ModuleManager');
module.exports.QuizManager = require('./quiz/QuizManager');
module.exports.CommandHandlers = require('./command-handlers');
