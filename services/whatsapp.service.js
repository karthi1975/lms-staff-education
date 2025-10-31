/**
 * WhatsApp Service (Legacy Meta Provider) - STUB
 * This is a stub file to maintain backward compatibility with whatsapp-adapter.service.js
 *
 * IMPORTANT: This service is DEPRECATED and not actively used.
 * The system currently uses Twilio via twilio-whatsapp.service.js
 * If you see errors from this file, check WHATSAPP_PROVIDER env variable.
 */

const logger = require('../utils/logger');

class WhatsAppService {
  constructor() {
    logger.warn('⚠️  Legacy WhatsAppService instantiated but should not be used');
    logger.warn('    Current provider should be: twilio or meta-cloud');
  }

  sendMessage() {
    throw new Error('Legacy WhatsApp service is deprecated. Use twilio-whatsapp or meta-whatsapp-cloud instead.');
  }

  sendButtons() {
    throw new Error('Legacy WhatsApp service is deprecated. Use twilio-whatsapp or meta-whatsapp-cloud instead.');
  }

  sendInteractiveList() {
    throw new Error('Legacy WhatsApp service is deprecated. Use twilio-whatsapp or meta-whatsapp-cloud instead.');
  }

  markAsRead() {
    throw new Error('Legacy WhatsApp service is deprecated. Use twilio-whatsapp or meta-whatsapp-cloud instead.');
  }

  isEnabled() {
    return false;
  }
}

module.exports = new WhatsAppService();
