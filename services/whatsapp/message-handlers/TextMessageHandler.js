const BaseMessageHandler = require('./BaseMessageHandler');

/**
 * TextMessageHandler
 *
 * SOLID Principles:
 * - SRP: Handles text messages ONLY
 * - OCP: Extends BaseMessageHandler without modification
 * - LSP: Can be substituted for BaseMessageHandler
 *
 * Strategy pattern implementation for text messages.
 */
class TextMessageHandler extends BaseMessageHandler {
  constructor(httpClient, config, messageChunker) {
    super(httpClient, config);
    this.messageChunker = messageChunker;
  }

  /**
   * Send text message (with chunking support)
   * @param {string} to - Recipient phone number
   * @param {string} text - Message text
   * @returns {Promise<Object>} - Response data
   */
  async send(to, text) {
    // Check if message needs chunking
    if (!this.messageChunker.needsChunking(text)) {
      return await this.sendSingle(to, text);
    }

    // CORNER CASE FIX: Split and send multiple parts
    return await this.sendChunked(to, text);
  }

  /**
   * Send single text message
   * @param {string} to - Recipient phone number
   * @param {string} text - Message text
   * @returns {Promise<Object>} - Response data
   */
  async sendSingle(to, text) {
    const payload = {
      ...this.buildBasePayload(to, 'text'),
      text: { body: text }
    };

    return await this.makeRequest(payload);
  }

  /**
   * Send chunked text message
   * @param {string} to - Recipient phone number
   * @param {string} text - Message text
   * @returns {Promise<Object>} - Response data
   */
  async sendChunked(to, text) {
    const chunks = this.messageChunker.split(text);
    const numberedChunks = this.messageChunker.addPartNumbers(chunks);

    for (let i = 0; i < numberedChunks.length; i++) {
      await this.sendSingle(to, numberedChunks[i]);

      // CORNER CASE FIX: Rate limit between parts
      if (i < numberedChunks.length - 1) {
        await this.delay(this.config.rateLimitDelay);
      }
    }

    return { status: 'success', parts: numberedChunks.length };
  }

  /**
   * Delay helper
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = TextMessageHandler;
