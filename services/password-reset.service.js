/**
 * Password Reset Service
 * Handles secure password reset via tokens (not plain text passwords)
 * Security Fix: BE-001 Critical Vulnerability
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

class PasswordResetService {
  constructor(postgresService) {
    this.postgresService = postgresService;
    this.TOKEN_EXPIRY_HOURS = 1; // Tokens expire after 1 hour
  }

  /**
   * Generate cryptographically secure random token
   * @returns {string} 64-character hex string
   */
  generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create password reset token for admin user
   * @param {number} adminUserId - ID of admin user to reset
   * @param {number} createdBy - ID of Super Admin creating the reset
   * @param {string} ipAddress - IP address of requester
   * @param {string} userAgent - Browser user agent
   * @returns {Promise<{token: string, expiresAt: Date, resetLink: string}>}
   */
  async createResetToken(adminUserId, createdBy, ipAddress = null, userAgent = null) {
    const token = this.generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.TOKEN_EXPIRY_HOURS);

    await this.postgresService.query(`
      INSERT INTO password_reset_tokens (
        admin_user_id, token, expires_at, created_by, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [adminUserId, token, expiresAt, createdBy, ipAddress, userAgent]);

    logger.info(`Password reset token created for user ${adminUserId} by ${createdBy}`, {
      expiresAt,
      ipAddress
    });

    // Generate reset link (frontend will handle this route)
    const baseUrl = process.env.ADMIN_PORTAL_URL || 'http://localhost:3000/admin';
    const resetLink = `${baseUrl}/reset-password.html?token=${token}`;

    return {
      token,
      expiresAt,
      resetLink
    };
  }

  /**
   * Validate reset token
   * @param {string} token - Reset token to validate
   * @returns {Promise<{valid: boolean, adminUserId?: number, error?: string}>}
   */
  async validateToken(token) {
    const result = await this.postgresService.query(`
      SELECT
        prt.id,
        prt.admin_user_id,
        prt.expires_at,
        prt.used_at,
        au.email,
        au.name
      FROM password_reset_tokens prt
      JOIN admin_users au ON prt.admin_user_id = au.id
      WHERE prt.token = $1
    `, [token]);

    if (result.rows.length === 0) {
      return { valid: false, error: 'Invalid or expired reset token' };
    }

    const resetToken = result.rows[0];

    // Check if already used
    if (resetToken.used_at) {
      logger.warn(`Attempt to reuse password reset token for user ${resetToken.admin_user_id}`);
      return { valid: false, error: 'This reset link has already been used' };
    }

    // Check if expired
    if (new Date() > new Date(resetToken.expires_at)) {
      logger.warn(`Expired password reset token used for user ${resetToken.admin_user_id}`);
      return { valid: false, error: 'This reset link has expired. Please request a new one.' };
    }

    return {
      valid: true,
      adminUserId: resetToken.admin_user_id,
      tokenId: resetToken.id,
      email: resetToken.email,
      name: resetToken.name
    };
  }

  /**
   * Complete password reset with new password
   * @param {string} token - Reset token
   * @param {string} newPassword - New password to set
   * @param {string} passwordHash - Bcrypt hash of new password
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async completeReset(token, newPassword, passwordHash) {
    // Validate token
    const validation = await this.validateToken(token);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Validate password strength
    const passwordValidation = this.validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return { success: false, error: passwordValidation.error };
    }

    try {
      // Use transaction to ensure atomicity
      await this.postgresService.transaction(async (client) => {
        // Update password
        await client.query(
          'UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
          [passwordHash, validation.adminUserId]
        );

        // Mark token as used
        await client.query(
          'UPDATE password_reset_tokens SET used_at = NOW() WHERE token = $1',
          [token]
        );
      });

      logger.info(`Password reset completed for user ${validation.adminUserId} (${validation.email})`);

      return { success: true };
    } catch (error) {
      logger.error('Error completing password reset:', error);
      return { success: false, error: 'Failed to reset password. Please try again.' };
    }
  }

  /**
   * Validate password strength
   * Requirements:
   * - At least 8 characters
   * - At least 1 uppercase letter
   * - At least 1 lowercase letter
   * - At least 1 number
   * - At least 1 special character
   *
   * @param {string} password - Password to validate
   * @returns {{valid: boolean, error?: string}}
   */
  validatePasswordStrength(password) {
    if (!password || password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters long' };
    }

    if (!/[A-Z]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one uppercase letter' };
    }

    if (!/[a-z]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one lowercase letter' };
    }

    if (!/[0-9]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one number' };
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one special character' };
    }

    return { valid: true };
  }

  /**
   * Invalidate all reset tokens for a user (e.g., after successful reset)
   * @param {number} adminUserId - User ID
   * @returns {Promise<number>} Number of tokens invalidated
   */
  async invalidateUserTokens(adminUserId) {
    const result = await this.postgresService.query(`
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE admin_user_id = $1
        AND used_at IS NULL
        AND expires_at > NOW()
    `, [adminUserId]);

    return result.rowCount;
  }

  /**
   * Cleanup expired tokens (should be run as scheduled job)
   * @returns {Promise<number>} Number of tokens deleted
   */
  async cleanupExpiredTokens() {
    const result = await this.postgresService.query(`
      DELETE FROM password_reset_tokens
      WHERE expires_at < NOW()
        AND used_at IS NULL
    `);

    logger.info(`Cleaned up ${result.rowCount} expired password reset tokens`);
    return result.rowCount;
  }

  /**
   * Get token usage stats (for audit/monitoring)
   * @returns {Promise<object>} Token statistics
   */
  async getTokenStats() {
    const result = await this.postgresService.query(`
      SELECT
        COUNT(*) as total_tokens,
        COUNT(CASE WHEN used_at IS NOT NULL THEN 1 END) as used_tokens,
        COUNT(CASE WHEN expires_at < NOW() AND used_at IS NULL THEN 1 END) as expired_tokens,
        COUNT(CASE WHEN expires_at > NOW() AND used_at IS NULL THEN 1 END) as active_tokens
      FROM password_reset_tokens
    `);

    return result.rows[0];
  }
}

module.exports = PasswordResetService;
