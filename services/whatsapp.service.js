const axios = require('axios');
const logger = require('../utils/logger');

class WhatsAppService {
  constructor() {
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;
    this.apiUrl = `https://graph.facebook.com/v17.0/${this.phoneNumberId}/messages`;
  }

  // Verify webhook for Meta
  verifyWebhook(req) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === this.verifyToken) {
        logger.info('WhatsApp webhook verified');
        return challenge;
      } else {
        logger.error('WhatsApp webhook verification failed');
        throw new Error('Verification failed');
      }
    }
    throw new Error('Missing parameters');
  }

  // Extract message from WhatsApp webhook payload
  extractMessage(body) {
    try {
      if (body.entry && 
          body.entry[0].changes && 
          body.entry[0].changes[0].value.messages) {
        
        const message = body.entry[0].changes[0].value.messages[0];
        const from = message.from;
        const messageBody = message.text?.body || '';
        const messageType = message.type;
        
        return {
          from,
          messageBody,
          messageType,
          messageId: message.id,
          timestamp: message.timestamp
        };
      }
    } catch (error) {
      logger.error('Error extracting message:', error);
    }
    return null;
  }

  // Send text message
  async sendMessage(to, text) {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      logger.info(`Message sent to ${to}`);
      return response.data;
    } catch (error) {
      logger.error('Error sending WhatsApp message:', error.response?.data || error.message);
      throw error;
    }
  }

  // Send interactive list message
  async sendInteractiveList(to, headerText, bodyText, buttonText, sections) {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'interactive',
          interactive: {
            type: 'list',
            header: {
              type: 'text',
              text: headerText
            },
            body: {
              text: bodyText
            },
            action: {
              button: buttonText,
              sections
            }
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      logger.error('Error sending interactive list:', error.response?.data || error.message);
      throw error;
    }
  }

  // Send buttons message
  async sendButtons(to, bodyText, buttons) {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'interactive',
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
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      logger.error('Error sending buttons:', error.response?.data || error.message);
      throw error;
    }
  }

  // Send document
  async sendDocument(to, documentUrl, caption) {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'document',
          document: {
            link: documentUrl,
            caption: caption
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      logger.error('Error sending document:', error.response?.data || error.message);
      throw error;
    }
  }

  // Send typing indicator
  async sendTypingIndicator(to) {
    try {
      await axios.post(
        this.apiUrl,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { body: '...' }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      // Typing indicator is optional, don't throw
      logger.debug('Typing indicator error:', error.message);
    }
  }

  // Mark message as read
  async markAsRead(messageId) {
    try {
      await axios.post(
        this.apiUrl,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      logger.debug('Mark as read error:', error.message);
    }
  }
}

module.exports = new WhatsAppService();