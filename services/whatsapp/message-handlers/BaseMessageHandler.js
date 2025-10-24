/**
 * BaseMessageHandler
 *
 * SOLID Principles:
 * - SRP: Base class for message handling only
 * - OCP: Open for extension via subclassing
 * - LSP: All subclasses must implement send() method
 *
 * Abstract base class for message type handlers.
 * Implements Strategy Pattern for different message types.
 */
class BaseMessageHandler {
  constructor(httpClient, config) {
    this.httpClient = httpClient;
    this.config = config;
  }

  /**
   * Send message (must be implemented by subclasses)
   * @abstract
   * @param {string} to - Recipient phone number
   * @param {Object} data - Message data
   * @returns {Promise<Object>} - Response data
   */
  async send(to, data) {
    throw new Error('send() must be implemented by subclass');
  }

  /**
   * Build base message payload
   * @param {string} to - Recipient phone number
   * @param {string} type - Message type
   * @returns {Object} - Base payload
   */
  buildBasePayload(to, type) {
    return {
      messaging_product: 'whatsapp',
      to,
      type
    };
  }

  /**
   * Make API request
   * @param {Object} payload - Message payload
   * @returns {Promise<Object>} - Response data
   */
  async makeRequest(payload) {
    return await this.httpClient.post(
      this.config.getApiUrl(),
      payload,
      this.config.getHeaders()
    );
  }
}

module.exports = BaseMessageHandler;
