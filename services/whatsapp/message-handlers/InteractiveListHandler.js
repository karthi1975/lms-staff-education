const BaseMessageHandler = require('./BaseMessageHandler');

/**
 * InteractiveListHandler
 *
 * SOLID Principles:
 * - SRP: Handles interactive list messages ONLY
 * - OCP: Extends BaseMessageHandler without modification
 * - LSP: Can be substituted for BaseMessageHandler
 *
 * Strategy pattern implementation for interactive lists.
 */
class InteractiveListHandler extends BaseMessageHandler {
  /**
   * Send interactive list message
   * @param {string} to - Recipient phone number
   * @param {Object} data - List data { headerText, bodyText, buttonText, sections }
   * @returns {Promise<Object>} - Response data
   */
  async send(to, data) {
    const { headerText, bodyText, buttonText, sections } = data;

    const payload = {
      ...this.buildBasePayload(to, 'interactive'),
      interactive: {
        type: 'list',
        header: {
          type: 'text',
          text: headerText
        },
        body: {
          text: bodyText
        },
        action: {
          button: buttonText,
          sections
        }
      }
    };

    return await this.makeRequest(payload);
  }
}

module.exports = InteractiveListHandler;
