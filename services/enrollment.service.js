/**
 * Enrollment Service
 * Handles PIN-based enrollment for WhatsApp users
 * Only pre-enrolled users with valid PINs can access the system
 */

const bcrypt = require('bcrypt');
const postgresService = require('./database/postgres.service');
const twilioWhatsAppService = require('./twilio-whatsapp.service');
const logger = require('../utils/logger');

class EnrollmentService {
  constructor() {
    this.PIN_LENGTH = 4;
    this.MAX_ATTEMPTS = 3;
    this.PIN_EXPIRY_DAYS = 7;
    this.SALT_ROUNDS = 10;
  }

  /**
   * Generate a random 4-digit PIN
   * @returns {string} - 4-digit PIN
   */
  generatePIN() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Hash PIN using bcrypt
   * @param {string} pin - Plain text PIN
   * @returns {Promise<string>} - Hashed PIN
   */
  async hashPIN(pin) {
    return await bcrypt.hash(pin, this.SALT_ROUNDS);
  }

  /**
   * Verify PIN against hashed version
   * @param {string} plainPin - Plain text PIN from user
   * @param {string} hashedPin - Hashed PIN from database
   * @returns {Promise<boolean>} - True if PIN matches
   */
  async verifyPIN(plainPin, hashedPin) {
    return await bcrypt.compare(plainPin, hashedPin);
  }

  /**
   * Normalize phone number to E.164 format
   * @param {string} phoneNumber - Phone number
   * @returns {string} - Normalized phone number
   */
  normalizePhoneNumber(phoneNumber) {
    let normalized = phoneNumber.replace(/[\s\(\)\-]/g, '');
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }
    return normalized;
  }

  /**
   * Enroll a new user (Admin action)
   * Creates user record with PIN, status 'pending'
   *
   * @param {string} name - User's name
   * @param {string} phoneNumber - WhatsApp phone number
   * @param {number} adminId - ID of admin enrolling the user
   * @param {string} customPin - Optional custom PIN (otherwise auto-generated)
   * @returns {Promise<object>} - { success, pin, userId, message }
   */
  async enrollUser(name, phoneNumber, adminId, customPin = null) {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

      // Check if user already exists
      const existingUser = await postgresService.query(
        'SELECT id, name, enrollment_status FROM users WHERE whatsapp_id = $1',
        [normalizedPhone]
      );

      if (existingUser.rows.length > 0) {
        const user = existingUser.rows[0];
        return {
          success: false,
          message: `User "${user.name}" already exists with status: ${user.enrollment_status}`,
          userId: user.id,
          status: user.enrollment_status
        };
      }

      // Generate or use custom PIN
      const plainPin = customPin || this.generatePIN();

      // Validate PIN format
      if (!/^\d{4}$/.test(plainPin)) {
        return {
          success: false,
          message: 'PIN must be exactly 4 digits'
        };
      }

      // Hash the PIN
      const hashedPin = await this.hashPIN(plainPin);

      // Calculate PIN expiry
      const pinExpiresAt = new Date();
      pinExpiresAt.setDate(pinExpiresAt.getDate() + this.PIN_EXPIRY_DAYS);

      // Get first available module
      const firstModuleResult = await postgresService.query(
        `SELECT m.id FROM modules m
         JOIN courses c ON m.course_id = c.id
         ORDER BY c.sequence_order, m.sequence_order
         LIMIT 1`
      );

      const firstModuleId = firstModuleResult.rows.length > 0
        ? firstModuleResult.rows[0].id
        : null;

      // Create user record
      const result = await postgresService.query(
        `INSERT INTO users (
          whatsapp_id, name, enrollment_pin, enrollment_status,
          pin_attempts, pin_expires_at, enrolled_by, enrolled_at,
          current_module_id, is_verified, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, false, true, NOW(), NOW())
        RETURNING id, whatsapp_id, name, enrollment_status`,
        [
          normalizedPhone,
          name,
          hashedPin,
          'pending',
          this.MAX_ATTEMPTS,
          pinExpiresAt,
          adminId,
          firstModuleId
        ]
      );

      const user = result.rows[0];

      // Record enrollment in history
      await this.recordHistory(user.id, 'enrolled', adminId, {
        phone: normalizedPhone,
        pin_expires_at: pinExpiresAt
      });

      logger.info(`User enrolled: ${name} (${normalizedPhone}) by admin ${adminId}`);

      return {
        success: true,
        pin: plainPin, // Return plain PIN for admin to share with user
        userId: user.id,
        phoneNumber: normalizedPhone,
        expiresAt: pinExpiresAt,
        message: `User enrolled successfully. Share PIN with user.`
      };

    } catch (error) {
      logger.error('Error enrolling user:', error);
      return {
        success: false,
        message: `Failed to enroll user: ${error.message}`
      };
    }
  }

  /**
   * Verify user's PIN (when they send it via WhatsApp)
   *
   * @param {string} phoneNumber - User's phone number
   * @param {string} pin - PIN sent by user
   * @returns {Promise<object>} - { verified, userId, name, message }
   */
  async verifyUserPIN(phoneNumber, pin) {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

      // Validate PIN format
      if (!/^\d{4}$/.test(pin)) {
        return {
          verified: false,
          message: '❌ Invalid PIN format. Please send a 4-digit PIN.'
        };
      }

      // Get user record
      const result = await postgresService.query(
        `SELECT id, name, enrollment_pin, enrollment_status,
                pin_attempts, pin_expires_at, is_verified
         FROM users
         WHERE whatsapp_id = $1`,
        [normalizedPhone]
      );

      if (result.rows.length === 0) {
        return {
          verified: false,
          message: '❌ This number is not enrolled.\n\nPlease contact your administrator to register.'
        };
      }

      const user = result.rows[0];

      // Check if already verified
      if (user.is_verified && user.enrollment_status === 'active') {
        return {
          verified: true,
          userId: user.id,
          name: user.name,
          alreadyVerified: true,
          message: null // No message, proceed to normal chat
        };
      }

      // Check if blocked
      if (user.enrollment_status === 'blocked') {
        return {
          verified: false,
          message: '🔒 Your account is blocked due to too many failed PIN attempts.\n\nPlease contact your administrator.'
        };
      }

      // Check if PIN expired
      if (user.pin_expires_at && new Date() > new Date(user.pin_expires_at)) {
        await this.recordHistory(user.id, 'pin_expired', null, { pin_expires_at: user.pin_expires_at });
        return {
          verified: false,
          message: '⏰ Your PIN has expired.\n\nPlease contact your administrator for a new PIN.'
        };
      }

      // Check remaining attempts
      if (user.pin_attempts <= 0) {
        await this.blockUser(user.id);
        return {
          verified: false,
          message: '🔒 Account blocked due to too many failed attempts.\n\nPlease contact your administrator.'
        };
      }

      // Verify PIN
      const isValid = await this.verifyPIN(pin, user.enrollment_pin);

      if (!isValid) {
        // Decrement attempts
        const newAttempts = user.pin_attempts - 1;
        await postgresService.query(
          'UPDATE users SET pin_attempts = $1 WHERE id = $2',
          [newAttempts, user.id]
        );

        await this.recordHistory(user.id, 'pin_failed', null, {
          attempts_remaining: newAttempts
        });

        if (newAttempts === 0) {
          await this.blockUser(user.id);
          return {
            verified: false,
            message: '🔒 Account blocked due to too many failed attempts.\n\nPlease contact your administrator.'
          };
        }

        return {
          verified: false,
          message: `❌ Incorrect PIN.\n\nYou have ${newAttempts} attempt${newAttempts > 1 ? 's' : ''} remaining.\n\nPlease try again.`
        };
      }

      // PIN is correct - activate user
      await postgresService.query(
        `UPDATE users
         SET is_verified = true,
             enrollment_status = 'active',
             pin_attempts = $1,
             enrollment_pin = NULL,
             updated_at = NOW()
         WHERE id = $2`,
        [this.MAX_ATTEMPTS, user.id]
      );

      // Initialize first module progress if exists
      const moduleCheck = await postgresService.query(
        'SELECT current_module_id FROM users WHERE id = $1',
        [user.id]
      );

      if (moduleCheck.rows[0].current_module_id) {
        await postgresService.query(
          `INSERT INTO user_progress (user_id, module_id, status, progress_percentage, started_at, last_activity_at)
           VALUES ($1, $2, 'not_started', 0, NOW(), NOW())
           ON CONFLICT (user_id, module_id) DO NOTHING`,
          [user.id, moduleCheck.rows[0].current_module_id]
        );
      }

      await this.recordHistory(user.id, 'pin_verified', null, {
        verified_at: new Date()
      });

      logger.info(`✅ User verified: ${user.name} (${normalizedPhone})`);

      return {
        verified: true,
        userId: user.id,
        name: user.name,
        phoneNumber: normalizedPhone,
        message: null // Welcome message will be sent separately
      };

    } catch (error) {
      logger.error('Error verifying PIN:', error);
      return {
        verified: false,
        message: '⚠️ Error during verification. Please try again or contact support.'
      };
    }
  }

  /**
   * Reset user's PIN (Admin action)
   * Generates new PIN and resets attempts
   *
   * @param {string} phoneNumber - User's phone number
   * @param {number} adminId - ID of admin resetting PIN
   * @param {string} customPin - Optional custom PIN
   * @returns {Promise<object>} - { success, pin, message }
   */
  async resetPIN(phoneNumber, adminId, customPin = null) {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

      const result = await postgresService.query(
        'SELECT id, name, enrollment_status FROM users WHERE whatsapp_id = $1',
        [normalizedPhone]
      );

      if (result.rows.length === 0) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      const user = result.rows[0];

      // Generate new PIN
      const plainPin = customPin || this.generatePIN();
      const hashedPin = await this.hashPIN(plainPin);

      const pinExpiresAt = new Date();
      pinExpiresAt.setDate(pinExpiresAt.getDate() + this.PIN_EXPIRY_DAYS);

      // Update user
      await postgresService.query(
        `UPDATE users
         SET enrollment_pin = $1,
             pin_attempts = $2,
             pin_expires_at = $3,
             enrollment_status = CASE
               WHEN enrollment_status = 'blocked' THEN 'pending'
               ELSE enrollment_status
             END,
             updated_at = NOW()
         WHERE id = $4`,
        [hashedPin, this.MAX_ATTEMPTS, pinExpiresAt, user.id]
      );

      await this.recordHistory(user.id, 'pin_reset', adminId, {
        new_pin_expires_at: pinExpiresAt
      });

      logger.info(`PIN reset for user: ${user.name} (${normalizedPhone}) by admin ${adminId}`);

      return {
        success: true,
        pin: plainPin,
        userId: user.id,
        expiresAt: pinExpiresAt,
        message: 'PIN reset successfully. Share new PIN with user.'
      };

    } catch (error) {
      logger.error('Error resetting PIN:', error);
      return {
        success: false,
        message: `Failed to reset PIN: ${error.message}`
      };
    }
  }

  /**
   * Block user (after failed PIN attempts or admin action)
   *
   * @param {number} userId - User ID
   * @param {number} adminId - Optional admin ID if admin-initiated
   * @returns {Promise<void>}
   */
  async blockUser(userId, adminId = null) {
    await postgresService.query(
      `UPDATE users
       SET enrollment_status = 'blocked',
           updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    await this.recordHistory(userId, 'blocked', adminId, {
      blocked_at: new Date(),
      reason: adminId ? 'admin_action' : 'failed_pin_attempts'
    });

    logger.warn(`User ${userId} blocked ${adminId ? 'by admin ' + adminId : 'due to failed PIN attempts'}`);
  }

  /**
   * Unblock user (Admin action)
   *
   * @param {string} phoneNumber - User's phone number
   * @param {number} adminId - Admin ID
   * @returns {Promise<object>} - { success, message }
   */
  async unblockUser(phoneNumber, adminId) {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

      const result = await postgresService.query(
        'SELECT id FROM users WHERE whatsapp_id = $1',
        [normalizedPhone]
      );

      if (result.rows.length === 0) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      const userId = result.rows[0].id;

      await postgresService.query(
        `UPDATE users
         SET enrollment_status = 'pending',
             pin_attempts = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [this.MAX_ATTEMPTS, userId]
      );

      await this.recordHistory(userId, 'unblocked', adminId, {
        unblocked_at: new Date()
      });

      logger.info(`User ${userId} unblocked by admin ${adminId}`);

      return {
        success: true,
        message: 'User unblocked successfully'
      };

    } catch (error) {
      logger.error('Error unblocking user:', error);
      return {
        success: false,
        message: `Failed to unblock user: ${error.message}`
      };
    }
  }

  /**
   * Get user enrollment status
   *
   * @param {string} phoneNumber - User's phone number
   * @returns {Promise<object>} - User enrollment details
   */
  async getEnrollmentStatus(phoneNumber) {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

      const result = await postgresService.query(
        `SELECT id, name, enrollment_status, pin_attempts,
                pin_expires_at, is_verified, enrolled_at
         FROM users
         WHERE whatsapp_id = $1`,
        [normalizedPhone]
      );

      if (result.rows.length === 0) {
        return {
          enrolled: false,
          message: 'User not enrolled'
        };
      }

      const user = result.rows[0];

      return {
        enrolled: true,
        userId: user.id,
        name: user.name,
        status: user.enrollment_status,
        isVerified: user.is_verified,
        attemptsRemaining: user.pin_attempts,
        pinExpiresAt: user.pin_expires_at,
        enrolledAt: user.enrolled_at
      };

    } catch (error) {
      logger.error('Error getting enrollment status:', error);
      return {
        enrolled: false,
        error: error.message
      };
    }
  }

  /**
   * Record action in enrollment history (audit trail)
   *
   * @param {number} userId - User ID
   * @param {string} action - Action type
   * @param {number} performedBy - Admin ID (if applicable)
   * @param {object} metadata - Additional metadata
   * @returns {Promise<void>}
   */
  async recordHistory(userId, action, performedBy = null, metadata = {}) {
    try {
      await postgresService.query(
        `INSERT INTO enrollment_history (user_id, action, performed_by, metadata, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [userId, action, performedBy, JSON.stringify(metadata)]
      );
    } catch (error) {
      logger.error('Error recording enrollment history:', error);
      // Don't throw - history logging shouldn't break main flow
    }
  }

  /**
   * Get enrollment history for user (for admin dashboard)
   *
   * @param {number} userId - User ID
   * @param {number} limit - Max records to return
   * @returns {Promise<Array>} - History records
   */
  async getEnrollmentHistory(userId, limit = 50) {
    try {
      const result = await postgresService.query(
        `SELECT eh.*, au.email as admin_email
         FROM enrollment_history eh
         LEFT JOIN admin_users au ON eh.performed_by = au.id
         WHERE eh.user_id = $1
         ORDER BY eh.created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting enrollment history:', error);
      return [];
    }
  }
}

// Export singleton instance
module.exports = new EnrollmentService();
