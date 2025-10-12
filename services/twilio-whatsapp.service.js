/**
 * Twilio WhatsApp Service
 * Handles WhatsApp messaging via Twilio API
 */

const twilio = require('twilio');
const logger = require('../utils/logger');

class TwilioWhatsAppService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    this.whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER; // e.g., whatsapp:+14155238886

    if (this.accountSid && this.authToken) {
      this.client = twilio(this.accountSid, this.authToken);
      this.webhooks = twilio.webhooks;
      logger.info('Twilio WhatsApp service initialized');
    } else {
      logger.warn('Twilio credentials not configured');
    }
  }

  /**
   * Validate Twilio webhook signature
   * @param {string} twilioSignature - X-Twilio-Signature header
   * 
   * @param {string} url - Full webhook URL
   * @param {object} params - Request body parameters
   * @returns {boolean} - True if signature is valid
   */
  validateWebhookSignature(twilioSignature, url, params) {
    if (!this.authToken) {
      logger.warn('Cannot validate webhook - auth token not configured');
      return false;
    }

    try {
      const isValid = this.webhooks.validateRequest(
        this.authToken,
        twilioSignature,
        url,
        params
      );

      if (!isValid) {
        logger.error('Invalid Twilio webhook signature');
      }

      return isValid;
    } catch (error) {
      logger.error('Error validating Twilio signature:', error);
      return false;
    }
  }

  /**
   * Extract message from Twilio webhook payload
   * @param {object} body - Request body from Twilio
   * @returns {object|null} - Extracted message data
   */
  extractMessage(body) {
    try {
      const from = body.From; // e.g., whatsapp:+1234567890
      const to = body.To; // e.g., whatsapp:+14155238886
      const messageBody = body.Body || '';
      const messageSid = body.MessageSid;
      const numMedia = parseInt(body.NumMedia || '0');

      // Extract phone number from WhatsApp format
      const phoneNumber = from.replace('whatsapp:', '');

      // Handle button/list responses
      let interactive = null;
      if (body.ButtonPayload) {
        interactive = {
          type: 'button_reply',
          button_reply: {
            id: body.ButtonPayload,
            title: body.ButtonText || messageBody
          }
        };
      } else if (body.ListId) {
        interactive = {
          type: 'list_reply',
          list_reply: {
            id: body.ListId,
            title: body.ListTitle || messageBody
          }
        };
      }

      return {
        from: phoneNumber,
        to: to,
        messageBody: messageBody,
        messageType: numMedia > 0 ? 'media' : 'text',
        messageId: messageSid,
        timestamp: new Date().toISOString(),
        interactive: interactive,
        numMedia: numMedia
      };
    } catch (error) {
      logger.error('Error extracting Twilio message:', error);
      return null;
    }
  }

  /**
   * Send text message via Twilio
   * @param {string} to - Recipient phone number (without whatsapp: prefix)
   * @param {string} text - Message text
   * @returns {Promise<object>} - Twilio response
   */
  async sendMessage(to, text) {
    if (!this.client) {
      throw new Error('Twilio client not initialized');
    }

    try {
      // Ensure to number has whatsapp: prefix
      const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
      const fromNumber = this.whatsappNumber;

      const message = await this.client.messages.create({
        body: text,
        from: fromNumber,
        to: toNumber
      });

      logger.info(`Twilio message sent to ${to}: ${message.sid}`);
      return {
        success: true,
        messageSid: message.sid,
        status: message.status
      };
    } catch (error) {
      logger.error('Error sending Twilio message:', error);
      throw error;
    }
  }

  /**
   * Send interactive buttons (Twilio doesn't support native WhatsApp buttons yet)
   * Fallback to numbered text options
   * @param {string} to - Recipient phone number
   * @param {string} bodyText - Message body
   * @param {Array} buttons - Array of button objects {id, title}
   */
  async sendButtons(to, bodyText, buttons) {
    // Twilio doesn't support WhatsApp interactive buttons via their API yet
    // Fallback to numbered text message
    let message = bodyText + '\n\n';

    buttons.forEach((btn, index) => {
      message += `${index + 1}. ${btn.title}\n`;
    });

    message += '\nReply with the number (1, 2, 3...)';

    return await this.sendMessage(to, message);
  }

  /**
   * Send interactive list (Twilio doesn't support native WhatsApp lists yet)
   * Fallback to numbered text options
   * @param {string} to - Recipient phone number
   * @param {string} headerText - Header text
   * @param {string} bodyText - Body text
   * @param {string} buttonText - Button text (not used in fallback)
   * @param {Array} sections - Array of section objects with rows
   */
  async sendInteractiveList(to, headerText, bodyText, buttonText, sections) {
    // Twilio doesn't support WhatsApp interactive lists via their API yet
    // Fallback to numbered text message
    let message = `*${headerText}*\n\n${bodyText}\n\n`;

    let counter = 1;
    sections.forEach(section => {
      if (section.title) {
        message += `*${section.title}*\n`;
      }

      section.rows.forEach(row => {
        message += `${counter}. ${row.title}\n`;
        if (row.description) {
          message += `   ${row.description}\n`;
        }
        counter++;
      });
      message += '\n';
    });

    message += `Reply with the number to select`;

    return await this.sendMessage(to, message);
  }

  /**
   * Send document/media file
   * @param {string} to - Recipient phone number
   * @param {string} mediaUrl - Public URL of the media file
   * @param {string} caption - Optional caption
   */
  async sendDocument(to, mediaUrl, caption) {
    if (!this.client) {
      throw new Error('Twilio client not initialized');
    }

    try {
      const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
      const fromNumber = this.whatsappNumber;

      const message = await this.client.messages.create({
        body: caption || '',
        from: fromNumber,
        to: toNumber,
        mediaUrl: [mediaUrl]
      });

      logger.info(`Twilio media sent to ${to}: ${message.sid}`);
      return {
        success: true,
        messageSid: message.sid,
        status: message.status
      };
    } catch (error) {
      logger.error('Error sending Twilio media:', error);
      throw error;
    }
  }

  /**
   * Mark message as read (Twilio doesn't support this for WhatsApp)
   * This is a no-op for Twilio
   */
  async markAsRead(messageId) {
    // Twilio doesn't support marking WhatsApp messages as read
    logger.debug('Mark as read not supported by Twilio WhatsApp');
  }

  /**
   * Send typing indicator (Twilio doesn't support this for WhatsApp)
   * This is a no-op for Twilio
   */
  async sendTypingIndicator(to) {
    // Twilio doesn't support typing indicators for WhatsApp
    logger.debug('Typing indicator not supported by Twilio WhatsApp');
  }

  /**
   * Get message status
   * @param {string} messageSid - Message SID from Twilio
   */
  async getMessageStatus(messageSid) {
    if (!this.client) {
      throw new Error('Twilio client not initialized');
    }

    try {
      const message = await this.client.messages(messageSid).fetch();
      return {
        sid: message.sid,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage
      };
    } catch (error) {
      logger.error('Error fetching message status:', error);
      throw error;
    }
  }
}

module.exports = new TwilioWhatsAppService();
