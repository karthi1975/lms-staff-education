const BaseMessageHandler = require('./BaseMessageHandler');

/**
 * DocumentHandler
 *
 * SOLID Principles:
 * - SRP: Handles document messages ONLY
 * - OCP: Extends BaseMessageHandler without modification
 * - LSP: Can be substituted for BaseMessageHandler
 *
 * Strategy pattern implementation for document messages.
 */
class DocumentHandler extends BaseMessageHandler {
  /**
   * Send document message
   * @param {string} to - Recipient phone number
   * @param {Object} data - Document data { documentUrl, caption }
   * @returns {Promise<Object>} - Response data
   */
  async send(to, data) {
    const { documentUrl, caption } = data;

    const payload = {
      ...this.buildBasePayload(to, 'document'),
      document: {
        link: documentUrl,
        caption: caption
      }
    };

    return await this.makeRequest(payload);
  }
}

module.exports = DocumentHandler;
