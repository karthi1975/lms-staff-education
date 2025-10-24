/**
 * MessageProcessor
 *
 * SOLID Principle: Single Responsibility Principle (SRP)
 * Responsibility: Process incoming WhatsApp messages ONLY
 *
 * Orchestrates message processing flow.
 */
class MessageProcessor {
  constructor(
    sessionManager,
    commandRouter,
    responseSender,
    neo4jService,
    whatsappService,
    logger
  ) {
    this.sessionManager = sessionManager;
    this.commandRouter = commandRouter;
    this.responseSender = responseSender;
    this.neo4jService = neo4jService;
    this.whatsappService = whatsappService;
    this.logger = logger;
  }

  /**
   * Process incoming WhatsApp message
   * @param {Object} messageData - Message data { from, messageBody, messageId }
   * @returns {Promise<void>}
   */
  async process(messageData) {
    const { from, messageBody, messageId } = messageData;

    try {
      this.logger.info(`Processing WhatsApp message from ${from}: "${messageBody}"`);

      // Mark message as read
      this.logger.debug('Marking message as read...');
      await this.whatsappService.markAsRead(messageId);

      // Get or create session
      this.logger.debug('Getting or creating session...');
      const session = await this.sessionManager.getOrCreate(from);
      this.logger.info(`Session retrieved for user ${session.userId}`);

      // Get user progress
      this.logger.debug('Getting user learning path...');
      const userProgress = await this.neo4jService.getUserLearningPath(session.userId);
      this.logger.info(`User progress retrieved: ${userProgress ? 'Found' : 'Not found'}`);

      // Route command to appropriate handler
      this.logger.debug('Routing command to handler...');
      const response = await this.commandRouter.route(
        session.userId,
        messageBody,
        userProgress,
        session
      );
      this.logger.info(`Generated response type: ${response.type}`);

      // Send response via WhatsApp
      this.logger.debug('Sending WhatsApp response...');
      await this.responseSender.send(from, response);
      this.logger.info('Response sent successfully');

      // Update session
      this.sessionManager.update(from, session);

      // Cleanup old sessions
      this.sessionManager.cleanup();

    } catch (error) {
      this.logger.error('Error processing WhatsApp message:', error);
      this.logger.error('Error details:', {
        from,
        messageBody,
        messageId,
        errorMessage: error.message,
        errorStack: error.stack
      });

      // Send error message to user
      await this.whatsappService.sendMessage(
        from,
        "Sorry, I encountered an error. Please try again or type 'help' for assistance."
      );
    }
  }
}

module.exports = MessageProcessor;
