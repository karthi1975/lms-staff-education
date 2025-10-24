const WhatsAppConfig = require('./WhatsAppConfig');
const WebhookVerifier = require('./WebhookVerifier');
const MessageExtractor = require('./MessageExtractor');
const MessageChunker = require('./MessageChunker');
const HttpClient = require('./HttpClient');
const MessageSender = require('./MessageSender');
const handlers = require('./message-handlers');

/**
 * WhatsAppServiceFactory
 *
 * SOLID Principles:
 * - SRP: Creates WhatsApp service instances ONLY
 * - DIP: Injects dependencies (config, handlers, etc.)
 * - OCP: Can create different service configurations
 *
 * Factory pattern + Dependency Injection
 */
class WhatsAppServiceFactory {
  /**
   * Create WhatsApp service with all dependencies
   * @param {Object} options - Configuration options
   * @returns {Object} - WhatsApp service facade
   */
  static create(options = {}) {
    // Create configuration
    const config = new WhatsAppConfig(options);
    config.validate();

    // Create infrastructure services
    const httpClient = new HttpClient();
    const messageChunker = new MessageChunker(config.getEffectiveMaxLength());

    // Create message handlers
    const textHandler = new handlers.TextMessageHandler(httpClient, config, messageChunker);
    const interactiveListHandler = new handlers.InteractiveListHandler(httpClient, config);
    const buttonHandler = new handlers.ButtonHandler(httpClient, config);
    const documentHandler = new handlers.DocumentHandler(httpClient, config);
    const typingIndicatorHandler = new handlers.TypingIndicatorHandler(httpClient, config);
    const readReceiptHandler = new handlers.ReadReceiptHandler(httpClient, config);

    // Create message sender (coordinates handlers)
    const messageSender = new MessageSender({
      textHandler,
      interactiveListHandler,
      buttonHandler,
      documentHandler,
      typingIndicatorHandler,
      readReceiptHandler
    });

    // Create webhook verifier
    const webhookVerifier = new WebhookVerifier(config);

    // Create message extractor
    const messageExtractor = new MessageExtractor();

    // Return service facade (backward compatible interface)
    return {
      // Configuration
      config,

      // Webhook verification
      verifyWebhook: (req) => webhookVerifier.verify(req),

      // Message extraction
      extractMessage: (body) => messageExtractor.extract(body),

      // Message sending (delegates to MessageSender)
      sendMessage: (to, text) => messageSender.sendText(to, text),
      sendInteractiveList: (...args) => messageSender.sendInteractiveList(...args),
      sendButtons: (...args) => messageSender.sendButtons(...args),
      sendDocument: (...args) => messageSender.sendDocument(...args),
      sendTypingIndicator: (to) => messageSender.sendTypingIndicator(to),
      markAsRead: (messageId) => messageSender.markAsRead(messageId),

      // For backward compatibility (legacy property access)
      accessToken: config.accessToken,
      phoneNumberId: config.phoneNumberId,
      verifyToken: config.verifyToken,
      apiUrl: config.getApiUrl()
    };
  }

  /**
   * Create test service (for testing without API calls)
   * @returns {Object} - Mock service
   */
  static createTestService() {
    return {
      verifyWebhook: () => 'test_challenge',
      extractMessage: (body) => ({
        from: 'test_user',
        messageBody: 'test message',
        messageType: 'text',
        messageId: 'test_id',
        timestamp: Date.now()
      }),
      sendMessage: async () => ({ status: 'test_success' }),
      sendInteractiveList: async () => ({ status: 'test_success' }),
      sendButtons: async () => ({ status: 'test_success' }),
      sendDocument: async () => ({ status: 'test_success' }),
      sendTypingIndicator: async () => null,
      markAsRead: async () => null
    };
  }
}

module.exports = WhatsAppServiceFactory;
