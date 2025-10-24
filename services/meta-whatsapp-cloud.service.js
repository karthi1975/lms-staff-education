/**
 * Meta WhatsApp Cloud API Service
 *
 * Provides real interactive UI components for WhatsApp messages:
 * - Interactive buttons (max 3 per message)
 * - Interactive lists (max 10 items)
 * - Rich media support
 *
 * Documentation: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

const axios = require('axios');
const logger = require('./logger.service');

class MetaWhatsAppCloudService {
    constructor() {
        this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        this.phoneNumberId = process.env.PHONE_NUMBER_ID;
        this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
        this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
        this.enabled = process.env.USE_META_CLOUD_API === 'true';

        if (!this.accessToken || !this.phoneNumberId) {
            logger.warn('⚠️  Meta WhatsApp Cloud API not configured - will fallback to Twilio');
            logger.warn('   Set WHATSAPP_ACCESS_TOKEN and PHONE_NUMBER_ID to enable');
            this.enabled = false;
        } else {
            logger.info('✅ Meta WhatsApp Cloud API initialized');
            logger.info(`   Phone Number ID: ${this.phoneNumberId}`);
        }
    }

    /**
     * Send text message (basic)
     */
    async sendTextMessage(to, text) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${this.phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: this.formatPhoneNumber(to),
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

            logger.info(`✅ Text message sent to ${to}: ${response.data.messages[0].id}`);
            return response.data;
        } catch (error) {
            logger.error('❌ Meta WhatsApp API error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Send interactive button message
     *
     * @param {string} to - Recipient phone number
     * @param {object} options - Button message options
     * @param {string} options.header - Header text (optional)
     * @param {string} options.body - Body text (required)
     * @param {string} options.footer - Footer text (optional)
     * @param {Array<{id: string, title: string}>} options.buttons - Buttons (max 3)
     *
     * Example:
     * await sendButtonMessage('+1234567890', {
     *   header: '📚 Courses',
     *   body: 'Choose your course:',
     *   buttons: [
     *     { id: 'course_business', title: '📖 Business' },
     *     { id: 'course_science', title: '🔬 Science' }
     *   ]
     * });
     */
    async sendButtonMessage(to, options) {
        try {
            if (!options.buttons || options.buttons.length === 0 || options.buttons.length > 3) {
                throw new Error('Must provide 1-3 buttons');
            }

            const interactive = {
                type: 'button',
                body: { text: options.body }
            };

            // Add optional header
            if (options.header) {
                interactive.header = {
                    type: 'text',
                    text: options.header
                };
            }

            // Add optional footer
            if (options.footer) {
                interactive.footer = { text: options.footer };
            }

            // Add buttons
            interactive.action = {
                buttons: options.buttons.map(btn => ({
                    type: 'reply',
                    reply: {
                        id: btn.id,
                        title: btn.title.substring(0, 20) // Max 20 chars
                    }
                }))
            };

            const response = await axios.post(
                `${this.baseUrl}/${this.phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: this.formatPhoneNumber(to),
                    type: 'interactive',
                    interactive
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            logger.info(`✅ Button message sent to ${to}: ${response.data.messages[0].id}`);
            return response.data;
        } catch (error) {
            logger.error('❌ Meta WhatsApp button message error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Send interactive list message
     *
     * @param {string} to - Recipient phone number
     * @param {object} options - List message options
     * @param {string} options.header - Header text (optional)
     * @param {string} options.body - Body text (required)
     * @param {string} options.footer - Footer text (optional)
     * @param {string} options.buttonText - Button text (required, max 20 chars)
     * @param {Array<{title: string, rows: Array<{id: string, title: string, description?: string}>}>} options.sections - List sections
     *
     * Example:
     * await sendListMessage('+1234567890', {
     *   header: 'Available Modules',
     *   body: 'Select a module to begin:',
     *   buttonText: 'View Modules',
     *   sections: [{
     *     title: 'Business Studies',
     *     rows: [
     *       { id: 'module_1', title: 'Introduction', description: 'Learn basics' },
     *       { id: 'module_2', title: 'Advanced', description: 'Deep dive' }
     *     ]
     *   }]
     * });
     */
    async sendListMessage(to, options) {
        try {
            if (!options.buttonText) {
                throw new Error('buttonText is required');
            }

            if (!options.sections || options.sections.length === 0) {
                throw new Error('Must provide at least one section');
            }

            // Validate total rows (max 10)
            const totalRows = options.sections.reduce((sum, section) => sum + section.rows.length, 0);
            if (totalRows > 10) {
                throw new Error('Total list items cannot exceed 10');
            }

            const interactive = {
                type: 'list',
                body: { text: options.body }
            };

            // Add optional header
            if (options.header) {
                interactive.header = {
                    type: 'text',
                    text: options.header
                };
            }

            // Add optional footer
            if (options.footer) {
                interactive.footer = { text: options.footer };
            }

            // Add list action
            interactive.action = {
                button: options.buttonText.substring(0, 20), // Max 20 chars
                sections: options.sections.map(section => ({
                    title: section.title?.substring(0, 24) || 'Options', // Max 24 chars
                    rows: section.rows.map(row => ({
                        id: row.id,
                        title: row.title.substring(0, 24), // Max 24 chars
                        description: row.description?.substring(0, 72) || '' // Max 72 chars
                    }))
                }))
            };

            const response = await axios.post(
                `${this.baseUrl}/${this.phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: this.formatPhoneNumber(to),
                    type: 'interactive',
                    interactive
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            logger.info(`✅ List message sent to ${to}: ${response.data.messages[0].id}`);
            return response.data;
        } catch (error) {
            logger.error('❌ Meta WhatsApp list message error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Send image with caption
     */
    async sendImage(to, imageUrl, caption = '') {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${this.phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: this.formatPhoneNumber(to),
                    type: 'image',
                    image: {
                        link: imageUrl,
                        caption
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            logger.info(`✅ Image sent to ${to}: ${response.data.messages[0].id}`);
            return response.data;
        } catch (error) {
            logger.error('❌ Meta WhatsApp image error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Send document (PDF, DOCX, etc.)
     */
    async sendDocument(to, documentUrl, filename, caption = '') {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${this.phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: this.formatPhoneNumber(to),
                    type: 'document',
                    document: {
                        link: documentUrl,
                        filename,
                        caption
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            logger.info(`✅ Document sent to ${to}: ${response.data.messages[0].id}`);
            return response.data;
        } catch (error) {
            logger.error('❌ Meta WhatsApp document error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Parse incoming webhook message
     *
     * Handles both button/list replies and regular text messages
     */
    parseWebhookMessage(body) {
        try {
            const entry = body.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;
            const messages = value?.messages?.[0];
            const contacts = value?.contacts?.[0];

            if (!messages) {
                return null;
            }

            const result = {
                from: messages.from,
                phone: messages.from,
                name: contacts?.profile?.name || 'User',
                messageId: messages.id,
                timestamp: messages.timestamp,
                type: messages.type
            };

            // Handle different message types
            switch (messages.type) {
                case 'text':
                    result.message = messages.text.body;
                    break;

                case 'interactive':
                    // Button or list reply
                    const interactive = messages.interactive;
                    if (interactive.type === 'button_reply') {
                        result.message = interactive.button_reply.title;
                        result.buttonId = interactive.button_reply.id;
                        result.isButtonReply = true;
                    } else if (interactive.type === 'list_reply') {
                        result.message = interactive.list_reply.title;
                        result.listItemId = interactive.list_reply.id;
                        result.isListReply = true;
                    }
                    break;

                case 'image':
                case 'video':
                case 'audio':
                case 'document':
                    result.mediaId = messages[messages.type].id;
                    result.mimeType = messages[messages.type].mime_type;
                    result.caption = messages[messages.type].caption;
                    break;

                default:
                    logger.warn(`⚠️  Unsupported message type: ${messages.type}`);
                    result.message = `[Unsupported: ${messages.type}]`;
            }

            return result;
        } catch (error) {
            logger.error('❌ Error parsing webhook message:', error);
            return null;
        }
    }

    /**
     * Format phone number for Meta API (must include country code without +)
     */
    formatPhoneNumber(phone) {
        // Remove any non-numeric characters except +
        let formatted = phone.replace(/[^\d+]/g, '');

        // Remove leading +
        if (formatted.startsWith('+')) {
            formatted = formatted.substring(1);
        }

        // If no country code, assume US (+1)
        if (formatted.length === 10) {
            formatted = '1' + formatted;
        }

        return formatted;
    }

    /**
     * Check if Meta WhatsApp Cloud API is enabled
     */
    isEnabled() {
        return this.enabled;
    }
}

module.exports = new MetaWhatsAppCloudService();
