/**
 * Twilio WhatsApp Webhook Routes
 * Handles incoming messages from Twilio WhatsApp API
 */

const express = require('express');
const router = express.Router();
const twilioWhatsAppService = require('../services/twilio-whatsapp.service');
const whatsappHandler = require('../services/whatsapp-handler.service');
const logger = require('../utils/logger');

/**
 * @route POST /webhook/twilio
 * @desc Receive WhatsApp messages from Twilio
 * @access Public (validated by Twilio signature)
 */
router.post('/webhook/twilio', async (req, res) => {
  try {
    // Log incoming webhook
    logger.info('Twilio webhook received');
    console.log('Twilio webhook body:', JSON.stringify(req.body, null, 2));

    // Validate Twilio signature (optional but recommended)
    const twilioSignature = req.headers['x-twilio-signature'];
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    // Skip signature validation if TWILIO_SKIP_VALIDATION is set (useful for testing)
    if (!process.env.TWILIO_SKIP_VALIDATION) {
      const isValid = twilioWhatsAppService.validateWebhookSignature(
        twilioSignature,
        url,
        req.body
      );

      if (!isValid) {
        logger.error('Invalid Twilio signature');
        return res.status(403).send('Forbidden');
      }
    }

    // Acknowledge receipt immediately
    res.status(200).send('OK');

    // Extract message data from Twilio format
    const messageData = twilioWhatsAppService.extractMessage(req.body);
    console.log('Extracted Twilio message:', messageData);

    if (!messageData) {
      logger.warn('No message data extracted from Twilio webhook');
      return;
    }

    // Process message asynchronously using existing handler
    await whatsappHandler.handleMessage(messageData);
    console.log('Twilio message processed successfully');

  } catch (error) {
    console.error('Error processing Twilio webhook:', error);
    logger.error('Error processing Twilio webhook:', error);
    logger.error('Error stack:', error.stack);
  }
});

/**
 * @route POST /webhook/twilio/status
 * @desc Receive message status updates from Twilio
 * @access Public (validated by Twilio signature)
 */
router.post('/webhook/twilio/status', async (req, res) => {
  try {
    logger.info('Twilio status callback received');
    console.log('Twilio status:', JSON.stringify(req.body, null, 2));

    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body;

    // Log status updates
    if (MessageStatus === 'failed' || MessageStatus === 'undelivered') {
      logger.error(`Message ${MessageSid} failed: ${ErrorCode} - ${ErrorMessage}`);
    } else {
      logger.info(`Message ${MessageSid} status: ${MessageStatus}`);
    }

    // Acknowledge receipt
    res.status(200).send('OK');

  } catch (error) {
    logger.error('Error processing Twilio status callback:', error);
    res.status(200).send('OK'); // Still acknowledge to prevent retries
  }
});

/**
 * @route POST /api/twilio/send
 * @desc Test endpoint to send WhatsApp message via Twilio
 * @access Public (should add auth in production)
 */
router.post('/api/twilio/send', async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required'
      });
    }

    const result = await twilioWhatsAppService.sendMessage(to, message);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error sending Twilio test message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
