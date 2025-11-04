/**
 * Password Reset Routes
 * Secure password reset implementation using tokens
 * Security Fix: BE-001 - Replaces plain text password returns
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const authMiddleware = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

/**
 * @route POST /api/admin-users/:userId/reset-password-secure
 * @desc Generate secure password reset link (Super Admin only)
 * @access Super Admin only
 * @security Generates secure token link instead of returning plain password
 */
router.post('/admin-users/:userId/reset-password-secure', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const postgresService = require('../services/database/postgres.service');
    const PasswordResetService = require('../services/password-reset.service');
    const passwordResetService = new PasswordResetService(postgresService);

    // Verify requester is Super Admin (role_id = 1)
    if (req.user.role_id !== 1) {
      return res.status(403).json({
        success: false,
        error: 'Only Super Admins can reset passwords'
      });
    }

    // Check if target user exists
    const userCheck = await postgresService.query(
      'SELECT id, name, email FROM admin_users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Admin user not found'
      });
    }

    const targetUser = userCheck.rows[0];

    // Generate secure reset token
    const { token, expiresAt, resetLink } = await passwordResetService.createResetToken(
      parseInt(userId),
      req.user.id,
      req.ip,
      req.get('User-Agent')
    );

    logger.info(`Password reset link generated for admin user ${userId} (${targetUser.email}) by Super Admin ${req.user.id}`);

    // Return secure reset link (NOT the password)
    res.json({
      success: true,
      message: 'Password reset link generated successfully',
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email
      },
      resetLink: resetLink,
      expiresAt: expiresAt,
      expiresIn: '1 hour',
      instructions: 'Send this link to the user. They must use it to set a new password. Link expires in 1 hour and can only be used once.'
    });

  } catch (error) {
    logger.error('Error generating password reset link:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/admin/reset-password/validate
 * @desc Validate password reset token
 * @access Public (but requires valid token)
 */
router.post('/admin/reset-password/validate', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Reset token is required'
      });
    }

    const postgresService = require('../services/database/postgres.service');
    const PasswordResetService = require('../services/password-reset.service');
    const passwordResetService = new PasswordResetService(postgresService);

    const validation = await passwordResetService.validateToken(token);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    res.json({
      success: true,
      valid: true,
      user: {
        email: validation.email,
        name: validation.name
      }
    });

  } catch (error) {
    logger.error('Error validating reset token:', error);
    res.status(500).json({ success: false, error: 'Failed to validate token' });
  }
});

/**
 * @route POST /api/admin/reset-password/complete
 * @desc Complete password reset with new password
 * @access Public (but requires valid token)
 */
router.post('/admin/reset-password/complete', async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    // Validation
    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Token, new password, and password confirmation are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match'
      });
    }

    const postgresService = require('../services/database/postgres.service');
    const PasswordResetService = require('../services/password-reset.service');
    const passwordResetService = new PasswordResetService(postgresService);

    // Hash the password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Complete reset (validates token, checks expiry, updates password)
    const result = await passwordResetService.completeReset(token, newPassword, passwordHash);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    logger.info('Password reset completed successfully');

    res.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.'
    });

  } catch (error) {
    logger.error('Error completing password reset:', error);
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

/**
 * @route GET /api/admin/reset-password/stats
 * @desc Get password reset token statistics
 * @access Super Admin only
 */
router.get('/admin/reset-password/stats', authMiddleware.authenticateToken, async (req, res) => {
  try {
    // Verify requester is Super Admin
    if (req.user.role_id !== 1) {
      return res.status(403).json({
        success: false,
        error: 'Only Super Admins can view reset statistics'
      });
    }

    const postgresService = require('../services/database/postgres.service');
    const PasswordResetService = require('../services/password-reset.service');
    const passwordResetService = new PasswordResetService(postgresService);

    const stats = await passwordResetService.getTokenStats();

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    logger.error('Error fetching reset stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
  }
});

module.exports = router;
