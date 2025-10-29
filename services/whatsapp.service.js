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
        const messageType = message.type;

        let messageBody = '';
        let interactive = null;

        // Handle different message types
        if (messageType === 'text') {
          messageBody = message.text?.body || '';
        } else if (messageType === 'interactive') {
          // Handle interactive list/button responses
          if (message.interactive?.type === 'list_reply') {
            interactive = {
              type: 'list_reply',
              list_reply: {
                id: message.interactive.list_reply.id,
                title: message.interactive.list_reply.title
              }
            };
            messageBody = message.interactive.list_reply.title; // Fallback text
          } else if (message.interactive?.type === 'button_reply') {
            interactive = {
              type: 'button_reply',
              button_reply: {
                id: message.interactive.button_reply.id,
                title: message.interactive.button_reply.title
              }
            };
            messageBody = message.interactive.button_reply.title;
          }
        }

        return {
          from,
          messageBody,
          messageType,
          messageId: message.id,
          timestamp: message.timestamp,
          interactive
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
      // CORNER CASE FIX: WhatsApp has 4096 character limit
      const MAX_LENGTH = 4096;

      // If message fits within limit, send directly
      if (text.length <= MAX_LENGTH) {
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
      }

      // CORNER CASE FIX: Split long messages into multiple parts
      logger.warn(`Message exceeds ${MAX_LENGTH} chars (${text.length}), splitting...`);
      const parts = this.splitMessage(text, MAX_LENGTH - 50); // Leave buffer for part numbers

      for (let i = 0; i < parts.length; i++) {
        const partText = `(${i + 1}/${parts.length})\n\n${parts[i]}`;

        await axios.post(
          this.apiUrl,
          {
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: partText }
          },
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        logger.info(`Message part ${i + 1}/${parts.length} sent to ${to}`);

        // CORNER CASE FIX: Rate limit between parts
        if (i < parts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
      }

      return { status: 'success', parts: parts.length };
    } catch (error) {
      logger.error('Error sending WhatsApp message:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Split long message into parts that respect line breaks
   * CORNER CASE FIX: Prevents message truncation
   */
  splitMessage(text, maxLength) {
    const parts = [];
    let current = '';

    const lines = text.split('\n');
    for (const line of lines) {
      // If adding this line would exceed max length
      if ((current + line + '\n').length > maxLength) {
        // If we have accumulated text, save it as a part
        if (current.trim()) {
          parts.push(current.trim());
          current = '';
        }

        // If single line is too long, split by words
        if (line.length > maxLength) {
          const words = line.split(' ');
          for (const word of words) {
            if ((current + word + ' ').length > maxLength) {
              if (current.trim()) {
                parts.push(current.trim());
                current = '';
              }
              current = word + ' ';
            } else {
              current += word + ' ';
            }
          }
        } else {
          current = line + '\n';
        }
      } else {
        current += line + '\n';
      }
    }

    // Add remaining text as final part
    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts.length > 0 ? parts : [text];
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