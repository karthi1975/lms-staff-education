/**
 * MessageSender
 *
 * SOLID Principles:
 * - SRP: Coordinates message sending ONLY (delegates to handlers)
 * - OCP: Can add new message types without modification
 * - DIP: Depends on abstractions (handlers) not concrete implementations
 *
 * Facade pattern that coordinates different message handlers.
 */
class MessageSender {
  constructor(handlers) {
    this.textHandler = handlers.textHandler;
    this.interactiveListHandler = handlers.interactiveListHandler;
    this.buttonHandler = handlers.buttonHandler;
    this.documentHandler = handlers.documentHandler;
    this.typingIndicatorHandler = handlers.typingIndicatorHandler;
    this.readReceiptHandler = handlers.readReceiptHandler;
  }

  /**
   * Send text message
   * @param {string} to - Recipient phone number
   * @param {string} text - Message text
   * @returns {Promise<Object>} - Response data
   */
  async sendText(to, text) {
    return await this.textHandler.send(to, text);
  }

  /**
   * Send interactive list
   * @param {string} to - Recipient phone number
   * @param {string} headerText - List header
   * @param {string} bodyText - List body
   * @param {string} buttonText - Button text
   * @param {Array} sections - List sections
   * @returns {Promise<Object>} - Response data
   */
  async sendInteractiveList(to, headerText, bodyText, buttonText, sections) {
    return await this.interactiveListHandler.send(to, {
      headerText,
      bodyText,
      buttonText,
      sections
    });
  }

  /**
   * Send buttons
   * @param {string} to - Recipient phone number
   * @param {string} bodyText - Button body text
   * @param {Array} buttons - Array of buttons
   * @returns {Promise<Object>} - Response data
   */
  async sendButtons(to, bodyText, buttons) {
    return await this.buttonHandler.send(to, {
      bodyText,
      buttons
    });
  }

  /**
   * Send document
   * @param {string} to - Recipient phone number
   * @param {string} documentUrl - Document URL
   * @param {string} caption - Document caption
   * @returns {Promise<Object>} - Response data
   */
  async sendDocument(to, documentUrl, caption) {
    return await this.documentHandler.send(to, {
      documentUrl,
      caption
    });
  }

  /**
   * Send typing indicator
   * @param {string} to - Recipient phone number
   * @returns {Promise<Object>} - Response data
   */
  async sendTypingIndicator(to) {
    return await this.typingIndicatorHandler.send(to);
  }

  /**
   * Mark message as read
   * @param {string} messageId - Message ID
   * @returns {Promise<Object>} - Response data
   */
  async markAsRead(messageId) {
    return await this.readReceiptHandler.send(messageId);
  }
}

module.exports = MessageSender;
