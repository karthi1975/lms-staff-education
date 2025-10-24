/**
 * WhatsAppConfig
 *
 * SOLID Principle: Single Responsibility Principle (SRP)
 * Responsibility: Provide WhatsApp configuration only
 *
 * Centralizes all WhatsApp configuration.
 * Easy to modify without touching service implementation.
 */
class WhatsAppConfig {
  constructor(options = {}) {
    this.accessToken = options.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = options.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.verifyToken = options.verifyToken || process.env.WEBHOOK_VERIFY_TOKEN;
    this.apiVersion = options.apiVersion || 'v17.0';
    this.maxMessageLength = options.maxMessageLength || 4096;
    this.rateLimitDelay = options.rateLimitDelay || 1000; // 1 second between chunks
    this.messageBufferSize = options.messageBufferSize || 50; // Buffer for part numbers
  }

  /**
   * Get WhatsApp API URL
   * @returns {string} - Full API URL
   */
  getApiUrl() {
    return `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
  }

  /**
   * Get authorization headers
   * @returns {Object} - Headers object
   */
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Get effective max message length (with buffer)
   * @returns {number} - Max length for message content
   */
  getEffectiveMaxLength() {
    return this.maxMessageLength - this.messageBufferSize;
  }

  /**
   * Validate configuration
   * @throws {Error} - If configuration is invalid
   */
  validate() {
    if (!this.accessToken) {
      throw new Error('WhatsApp access token is required');
    }
    if (!this.phoneNumberId) {
      throw new Error('WhatsApp phone number ID is required');
    }
    if (!this.verifyToken) {
      throw new Error('Webhook verify token is required');
    }
  }

  /**
   * Get configuration object
   * @returns {Object} - Configuration object
   */
  toObject() {
    return {
      phoneNumberId: this.phoneNumberId,
      apiVersion: this.apiVersion,
      maxMessageLength: this.maxMessageLength,
      rateLimitDelay: this.rateLimitDelay,
      apiUrl: this.getApiUrl()
    };
  }
}

module.exports = WhatsAppConfig;
