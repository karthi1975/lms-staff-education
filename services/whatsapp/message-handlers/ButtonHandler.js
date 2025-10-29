const BaseMessageHandler = require('./BaseMessageHandler');

/**
 * ButtonHandler
 *
 * SOLID Principles:
 * - SRP: Handles button messages ONLY
 * - OCP: Extends BaseMessageHandler without modification
 * - LSP: Can be substituted for BaseMessageHandler
 *
 * Strategy pattern implementation for button messages.
 */
class ButtonHandler extends BaseMessageHandler {
  /**
   * Send button message
   * @param {string} to - Recipient phone number
   * @param {Object} data - Button data { bodyText, buttons }
   * @returns {Promise<Object>} - Response data
   */
  async send(to, data) {
    const { bodyText, buttons } = data;

    const payload = {
      ...this.buildBasePayload(to, 'interactive'),
      interactive: {
        type: 'button',
        body: {
          text: bodyText
        },
        action: {
          buttons: buttons.map((btn, index) => ({
            type: 'reply',
            reply: {
              id: btn.id || `button_${index}`,
              title: btn.title
            }
          }))
        }
      }
    };

    return await this.makeRequest(payload);
  }
}

module.exports = ButtonHandler;
