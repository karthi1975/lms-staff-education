const BaseMessageHandler = require('./BaseMessageHandler');

/**
 * TypingIndicatorHandler
 *
 * SOLID Principles:
 * - SRP: Handles typing indicators ONLY
 * - OCP: Extends BaseMessageHandler without modification
 * - LSP: Can be substituted for BaseMessageHandler
 *
 * Strategy pattern implementation for typing indicators.
 */
class TypingIndicatorHandler extends BaseMessageHandler {
  /**
   * Send typing indicator
   * @param {string} to - Recipient phone number
   * @returns {Promise<Object>} - Response data (or null if failed)
   */
  async send(to) {
    try {
      const payload = {
        ...this.buildBasePayload(to, 'text'),
        recipient_type: 'individual',
        text: { body: '...' }
      };

      return await this.makeRequest(payload);
    } catch (error) {
      // Typing indicator is optional, don't throw
      // Just return null to indicate silent failure
      return null;
    }
  }
}

module.exports = TypingIndicatorHandler;
