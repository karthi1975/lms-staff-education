/**
 * WhatsApp Adapter Service
 * Provides a unified interface for both Meta and Twilio WhatsApp implementations
 */

const metaWhatsAppService = require('./whatsapp.service');
const twilioWhatsAppService = require('./twilio-whatsapp.service');
const logger = require('../utils/logger');

class WhatsAppAdapterService {
  constructor() {
    // Determine which provider to use based on environment
    this.provider = process.env.WHATSAPP_PROVIDER || 'meta'; // 'meta' or 'twilio'

    if (this.provider === 'twilio') {
      this.service = twilioWhatsAppService;
      logger.info('Using Twilio WhatsApp provider');
    } else {
      this.service = metaWhatsAppService;
      logger.info('Using Meta WhatsApp provider');
    }
  }

  /**
   * Send text message
   */
  async sendMessage(to, text) {
    return await this.service.sendMessage(to, text);
  }

  /**
   * Send interactive list
   */
  async sendInteractiveList(to, headerText, bodyText, buttonText, sections) {
    return await this.service.sendInteractiveList(to, headerText, bodyText, buttonText, sections);
  }

  /**
   * Send buttons
   */
  async sendButtons(to, bodyText, buttons) {
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
    return this.provider === 'meta';
  }
}

module.exports = new WhatsAppAdapterService();
