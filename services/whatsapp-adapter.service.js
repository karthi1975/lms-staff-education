/**
 * WhatsApp Adapter Service
 * Provides a unified interface for Meta Cloud API, Meta (legacy), and Twilio WhatsApp implementations
 */

const metaCloudService = require('./meta-whatsapp-cloud.service');
const metaWhatsAppService = require('./whatsapp.service');
const twilioWhatsAppService = require('./twilio-whatsapp.service');
const logger = require('../utils/logger');

class WhatsAppAdapterService {
  constructor() {
    // Determine which provider to use based on environment
    // Priority: USE_META_CLOUD_API > WHATSAPP_PROVIDER
    const useMetaCloud = process.env.USE_META_CLOUD_API === 'true';
    this.provider = process.env.WHATSAPP_PROVIDER || 'twilio'; // Default to twilio for backward compatibility

    if (useMetaCloud && metaCloudService.isEnabled()) {
      this.service = metaCloudService;
      this.provider = 'meta-cloud';
      this.supportsInteractiveUI = true;
      logger.info('✅ Using Meta WhatsApp Cloud API (Interactive UI enabled)');
    } else if (this.provider === 'twilio') {
      this.service = twilioWhatsAppService;
      this.supportsInteractiveUI = false;
      logger.info('✅ Using Twilio WhatsApp provider (Text-based UI)');
    } else {
      this.service = metaWhatsAppService;
      this.supportsInteractiveUI = true;
      logger.info('✅ Using Meta WhatsApp provider (legacy)');
    }
  }

  /**
   * Send text message
   * Automatically chunks messages longer than 1500 characters
   */
  async sendMessage(to, text) {
    const MAX_LENGTH = 1500; // Safe limit below Twilio's 1600 char limit

    // If message is short enough, send directly
    if (text.length <= MAX_LENGTH) {
      // Meta Cloud API has different method name
      if (this.provider === 'meta-cloud') {
        return await this.service.sendTextMessage(to, text);
      }
      return await this.service.sendMessage(to, text);
    }

    // Split long messages into chunks
    const chunks = this.splitMessage(text, MAX_LENGTH);
    const results = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const prefix = chunks.length > 1 ? `📄 Part ${i + 1}/${chunks.length}\n\n` : '';

      // Meta Cloud API has different method name
      if (this.provider === 'meta-cloud') {
        const result = await this.service.sendTextMessage(to, prefix + chunk);
        results.push(result);
      } else {
        const result = await this.service.sendMessage(to, prefix + chunk);
        results.push(result);
      }

      // Add small delay between chunks to ensure proper ordering
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results[0]; // Return first result for compatibility
  }

  /**
   * Split message into chunks while preserving paragraphs
   */
  splitMessage(text, maxLength) {
    const chunks = [];
    let currentChunk = '';

    // Split by paragraphs first (double newline)
    const paragraphs = text.split(/\n\n+/);

    for (const paragraph of paragraphs) {
      // If single paragraph is too long, split by sentences
      if (paragraph.length > maxLength) {
        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];

        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length + 2 > maxLength) {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence;
          } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          }
        }
      } else {
        // Try to add paragraph to current chunk
        if (currentChunk.length + paragraph.length + 2 > maxLength) {
          if (currentChunk) chunks.push(currentChunk.trim());
          currentChunk = paragraph;
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        }
      }
    }

    if (currentChunk) chunks.push(currentChunk.trim());

    return chunks.length > 0 ? chunks : [text.substring(0, maxLength)];
  }

  /**
   * Send interactive list
   */
  async sendInteractiveList(to, headerText, bodyText, buttonText, sections) {
    if (this.provider === 'meta-cloud') {
      // Meta Cloud API uses different parameter format
      return await this.service.sendListMessage(to, {
        header: headerText,
        body: bodyText,
        buttonText: buttonText,
        sections: sections
      });
    }
    return await this.service.sendInteractiveList(to, headerText, bodyText, buttonText, sections);
  }

  /**
   * Send buttons
   * @param {string} to - Recipient phone number
   * @param {string} bodyText - Message body
   * @param {Array<{id: string, title: string}>} buttons - Buttons (max 3)
   * @param {string} header - Optional header text
   */
  async sendButtons(to, bodyText, buttons, header = null) {
    if (this.provider === 'meta-cloud') {
      // Meta Cloud API uses different parameter format
      return await this.service.sendButtonMessage(to, {
        header: header,
        body: bodyText,
        buttons: buttons
      });
    }
    return await this.service.sendButtons(to, bodyText, buttons);
  }

  /**
   * Send document
   */
  async sendDocument(to, documentUrl, caption) {
    return await this.service.sendDocument(to, documentUrl, caption);
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId) {
    return await this.service.markAsRead(messageId);
  }

  /**
   * Send typing indicator
   */
  async sendTypingIndicator(to) {
    if (this.service.sendTypingIndicator) {
      return await this.service.sendTypingIndicator(to);
    }
  }

  /**
   * Get current provider
   */
  getProvider() {
    return this.provider;
  }

  /**
   * Check if provider supports interactive messages
   */
  supportsInteractive() {
    return this.supportsInteractiveUI || this.provider === 'meta' || this.provider === 'meta-cloud';
  }

  /**
   * Extract message from webhook payload
   */
  extractMessage(body) {
    if (this.provider === 'meta-cloud') {
      // Meta Cloud API uses different webhook format
      return this.service.parseWebhookMessage(body);
    }
    return this.service.extractMessage(body);
  }

  /**
   * Verify webhook
   */
  verifyWebhook(req) {
    return this.service.verifyWebhook(req);
  }
}

module.exports = new WhatsAppAdapterService();
