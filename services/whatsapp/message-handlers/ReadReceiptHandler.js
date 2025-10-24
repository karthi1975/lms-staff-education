const BaseMessageHandler = require('./BaseMessageHandler');

/**
 * ReadReceiptHandler
 *
 * SOLID Principles:
 * - SRP: Handles read receipts ONLY
 * - OCP: Extends BaseMessageHandler without modification
 * - LSP: Can be substituted for BaseMessageHandler
 *
 * Strategy pattern implementation for read receipts.
 */
class ReadReceiptHandler extends BaseMessageHandler {
  /**
   * Mark message as read
   * @param {string} messageId - Message ID to mark as read
   * @returns {Promise<Object>} - Response data (or null if failed)
   */
  async send(messageId) {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      };

      return await this.httpClient.post(
        this.config.getApiUrl(),
        payload,
        this.config.getHeaders()
      );
    } catch (error) {
      // Read receipt is optional, don't throw
      return null;
    }
  }
}

module.exports = ReadReceiptHandler;
