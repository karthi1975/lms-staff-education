/**
 * WebhookVerifier
 *
 * SOLID Principle: Single Responsibility Principle (SRP)
 * Responsibility: Verify WhatsApp webhook requests ONLY
 *
 * Handles webhook verification challenge from Meta.
 */
class WebhookVerifier {
  constructor(config) {
    this.config = config;
  }

  /**
   * Verify webhook challenge from Meta
   * @param {Object} req - Express request object
   * @returns {string|null} - Challenge string if verified, null otherwise
   * @throws {Error} - If verification fails
   */
  verify(req) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Validate required parameters
    if (!mode || !token) {
      throw new Error('Missing webhook verification parameters');
    }

    // Verify mode and token
    if (mode === 'subscribe' && token === this.config.verifyToken) {
      return challenge;
    }

    throw new Error('Webhook verification failed: Invalid token or mode');
  }

  /**
   * Check if request is a verification request
   * @param {Object} req - Express request object
   * @returns {boolean} - True if this is a verification request
   */
  isVerificationRequest(req) {
    return !!(req.query['hub.mode'] && req.query['hub.verify_token'] && req.query['hub.challenge']);
  }
}

module.exports = WebhookVerifier;
