/**
 * Authentication Routes
 * Handles admin authentication endpoints
 */

const express = require('express');
const router = express.Router();
const AdminAuthService = require('../services/auth/admin.auth.service');
const UserModel = require('../models/user.model');
const { authenticateToken, requireAdmin } = require('../middleware/auth.middleware');

/**
 * POST /api/admin/login
 * Admin login endpoint
 */
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const result = await AdminAuthService.login(email, password);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Login failed'
    });
  }
});

/**
 * POST /api/admin/logout
 * Admin logout endpoint
 */
router.post('/admin/logout', authenticateToken, async (req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // We could implement token blacklisting here if needed
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * POST /api/admin/refresh
 * Refresh access token
 */
router.post('/admin/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }

    const result = await AdminAuthService.refreshToken(refreshToken);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Token refresh failed'
    });
  }
});

// Note: /api/admin/users routes moved to admin.routes.js to avoid conflicts

/**
 * POST /api/users/identify
 * Identify or create WhatsApp user
 */
router.post('/users/identify', async (req, res) => {
  try {
    const { whatsapp_id, name } = req.body;

    if (!whatsapp_id || !name) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp ID and name are required'
      });
    }

    // Validate WhatsApp ID format (E.164)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(whatsapp_id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid WhatsApp ID format'
      });
    }

    const result = await UserModel.findOrCreate(whatsapp_id, name);
    
    res.json({
      success: true,
      user: result.user,
      is_new: result.isNew
    });
  } catch (error) {
    console.error('User identify error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to identify user'
    });
  }
});

/**
 * POST /api/admin/password/change
 * Change own password
 */
router.post('/admin/password/change', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Old and new passwords are required'
      });
    }

    const result = await AdminAuthService.changePassword(
      req.user.id, 
      oldPassword, 
      newPassword
    );
    
    res.json(result);
  } catch (error) {
    console.error('Password change error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to change password'
    });
  }
});

/**
 * POST /api/admin/password/reset
 * Reset another admin's password (admin only)
 */
router.post('/admin/password/reset', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { adminId, newPassword } = req.body;

    if (!adminId || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Admin ID and new password are required'
      });
    }

    const result = await AdminAuthService.resetPassword(
      adminId,
      newPassword,
      req.user.id,
      req.user.role
    );
    
    res.json(result);
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to reset password'
    });
  }
});

/**
 * POST /api/admin/create
 * Create new admin user (admin only)
 */
router.post('/admin/create', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and name are required'
      });
    }

    const result = await AdminAuthService.createAdmin(
      { email, password, name, role },
      req.user.role
    );
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Admin creation error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create admin'
    });
  }
});

/**
 * GET /api/admin/profile
 * Get current admin profile
 */
router.get('/admin/profile', authenticateToken, async (req, res) => {
  res.json({
    success: true,
    profile: req.user
  });
});

module.exports = router;