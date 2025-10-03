const express = require('express');
const router = express.Router();
const postgresService = require('../services/database/postgres.service');
const logger = require('../utils/logger');

/**
 * @route POST /api/user/verify
 * @desc Verify user by WhatsApp ID
 * @access Public
 */
router.post('/user/verify', async (req, res) => {
  try {
    const { whatsapp_id } = req.body;

    if (!whatsapp_id) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp ID is required'
      });
    }

    // Find user by WhatsApp ID
    const result = await postgresService.pool.query(
      'SELECT id, whatsapp_id, name, created_at FROM users WHERE whatsapp_id = $1 AND is_active = true',
      [whatsapp_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found. Please contact your administrator or start training via WhatsApp.'
      });
    }

    const user = result.rows[0];

    // Update last active
    await postgresService.pool.query(
      'UPDATE users SET last_active_at = NOW() WHERE id = $1',
      [user.id]
    );

    res.json({
      success: true,
      data: {
        user_id: user.id,
        name: user.name,
        whatsapp_id: user.whatsapp_id,
        created_at: user.created_at
      }
    });

  } catch (error) {
    logger.error('Error verifying user:', error);
    res.status(500).json({
      success: false,
      error: 'Server error. Please try again later.'
    });
  }
});

module.exports = router;
