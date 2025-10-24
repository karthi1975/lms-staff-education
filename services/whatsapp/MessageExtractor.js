/**
 * MessageExtractor
 *
 * SOLID Principle: Single Responsibility Principle (SRP)
 * Responsibility: Extract and parse incoming WhatsApp messages ONLY
 *
 * Handles different message types: text, interactive (list/button).
 */
class MessageExtractor {
  /**
   * Extract message from WhatsApp webhook payload
   * @param {Object} body - Webhook payload body
   * @returns {Object|null} - Extracted message data or null
   */
  extract(body) {
    try {
      // Validate payload structure
      if (!this.isValidPayload(body)) {
        return null;
      }

      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from;
      const messageType = message.type;

      // Extract message content based on type
      const { messageBody, interactive } = this.extractContent(message, messageType);

      return {
        from,
        messageBody,
        messageType,
        messageId: message.id,
        timestamp: message.timestamp,
        interactive
      };
    } catch (error) {
      throw new Error(`Failed to extract message: ${error.message}`);
    }
  }

  /**
   * Validate webhook payload structure
   * @param {Object} body - Webhook payload
   * @returns {boolean} - True if valid
   */
  isValidPayload(body) {
    return !!(
      body &&
      body.entry &&
      body.entry[0] &&
      body.entry[0].changes &&
      body.entry[0].changes[0] &&
      body.entry[0].changes[0].value &&
      body.entry[0].changes[0].value.messages &&
      body.entry[0].changes[0].value.messages[0]
    );
  }

  /**
   * Extract message content based on type
   * @param {Object} message - Message object
   * @param {string} messageType - Message type
   * @returns {Object} - { messageBody, interactive }
   */
  extractContent(message, messageType) {
    switch (messageType) {
      case 'text':
        return this.extractTextMessage(message);
      case 'interactive':
        return this.extractInteractiveMessage(message);
      default:
        return { messageBody: '', interactive: null };
    }
  }

  /**
   * Extract text message
   * @param {Object} message - Message object
   * @returns {Object} - { messageBody, interactive }
   */
  extractTextMessage(message) {
    return {
      messageBody: message.text?.body || '',
      interactive: null
    };
  }

  /**
   * Extract interactive message (list or button)
   * @param {Object} message - Message object
   * @returns {Object} - { messageBody, interactive }
   */
  extractInteractiveMessage(message) {
    const interactiveType = message.interactive?.type;

    if (interactiveType === 'list_reply') {
      return this.extractListReply(message);
    } else if (interactiveType === 'button_reply') {
      return this.extractButtonReply(message);
    }

    return { messageBody: '', interactive: null };
  }

  /**
   * Extract list reply
   * @param {Object} message - Message object
   * @returns {Object} - { messageBody, interactive }
   */
  extractListReply(message) {
    const listReply = message.interactive.list_reply;
    return {
      messageBody: listReply.title, // Fallback text
      interactive: {
        type: 'list_reply',
        list_reply: {
          id: listReply.id,
          title: listReply.title
        }
      }
    };
  }

  /**
   * Extract button reply
   * @param {Object} message - Message object
   * @returns {Object} - { messageBody, interactive }
   */
  extractButtonReply(message) {
    const buttonReply = message.interactive.button_reply;
    return {
      messageBody: buttonReply.title,
      interactive: {
        type: 'button_reply',
        button_reply: {
          id: buttonReply.id,
          title: buttonReply.title
        }
      }
    };
  }
}

module.exports = MessageExtractor;
