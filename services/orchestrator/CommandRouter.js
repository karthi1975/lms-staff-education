/**
 * CommandRouter
 *
 * SOLID Principles:
 * - SRP: Routes commands to handlers ONLY
 * - OCP: Can add new handlers without modifying routing logic
 * - DIP: Depends on handler abstractions
 *
 * Chain of Responsibility pattern for command handling.
 */
class CommandRouter {
  constructor(handlers, logger) {
    this.handlers = handlers;
    this.logger = logger;
  }

  /**
   * Route command to appropriate handler
   * @param {string} userId - User ID
   * @param {string} input - User input
   * @param {Object} userProgress - User progress
   * @param {Object} session - User session
   * @returns {Promise<Object>} - Response object
   */
  async route(userId, input, userProgress, session) {
    // Try each handler in order until one can handle it
    for (const handler of this.handlers) {
      if (handler.canHandle(input, session)) {
        this.logger.debug(`Routing to ${handler.constructor.name}`);
        return await handler.handle(userId, input, userProgress, session);
      }
    }

    // Should never reach here if ContentQueryHandler is last (catches all)
    this.logger.warn(`No handler found for input: "${input}"`);
    return {
      type: 'text',
      content: 'Sorry, I did not understand that. Type "help" for available commands.'
    };
  }
}

module.exports = CommandRouter;
