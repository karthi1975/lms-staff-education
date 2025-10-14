/**
 * Verification Service
 * Handles user verification via SMS codes for Twilio WhatsApp
 */

const postgresService = require('./database/postgres.service');
const twilioWhatsAppService = require('./twilio-whatsapp.service');
const logger = require('../utils/logger');

class VerificationService {
  constructor() {
    // Store verification codes in memory (use Redis in production)
    // Format: { phoneNumber: { code: '123456', name: 'John', expiresAt: Date, attempts: 0 } }
    this.verificationCodes = new Map();
    this.MAX_ATTEMPTS = 3;
    this.CODE_EXPIRY_MINUTES = 30;
  }

  /**
   * Generate 6-digit verification code
   */
  generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Normalize phone number to E.164 format
   */
  normalizePhoneNumber(phoneNumber) {
    // Remove any spaces, parentheses, hyphens
    let normalized = phoneNumber.replace(/[\s\(\)\-]/g, '');

    // Add + if not present
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }

    return normalized;
  }

  /**
   * Admin creates user and sends verification code
   * @param {string} name - User's name
   * @param {string} phoneNumber - WhatsApp phone number (E.164 format)
   * @returns {Promise<object>} - { success, code, message }
   */
  async createUserAndSendCode(name, phoneNumber) {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

      // Check if user already exists
      const existingUser = await postgresService.query(
        'SELECT id, name FROM users WHERE whatsapp_id = $1',
        [normalizedPhone]
      );

      if (existingUser.rows.length > 0) {
        return {
          success: false,
          message: `User ${existingUser.rows[0].name} already exists with phone ${normalizedPhone}`
        };
      }

      // Generate verification code
      const code = this.generateCode();
      const expiresAt = new Date(Date.now() + this.CODE_EXPIRY_MINUTES * 60 * 1000);

      // Store verification data
      this.verificationCodes.set(normalizedPhone, {
        code,
        name,
        expiresAt,
        attempts: 0,
        createdAt: new Date()
      });

      // Get available courses from database
      const coursesResult = await postgresService.query(
        'SELECT code, title FROM courses ORDER BY sequence_order LIMIT 5'
      );

      let coursesText = '';
      if (coursesResult.rows.length > 0) {
        coursesText = coursesResult.rows.map((course, idx) =>
          `${idx + 1}️⃣ ${course.title}`
        ).join('\n');
      } else {
        coursesText = '📚 Training courses available after verification';
      }

      // Send verification code via WhatsApp
      const message = `🎓 *Welcome to Teachers Training!*\n\n` +
        `Hello ${name}! 👋\n\n` +
        `Your verification code is: *${code}*\n\n` +
        `To activate your account, reply with:\n` +
        `*HI ${code}*\n\n` +
        `This code expires in ${this.CODE_EXPIRY_MINUTES} minutes.\n\n` +
        `After verification, you'll have access to:\n` +
        `${coursesText}`;

      await twilioWhatsAppService.sendMessage(normalizedPhone, message);

      logger.info(`Verification code sent to ${normalizedPhone}: ${code}`);

      return {
        success: true,
        code,
        phoneNumber: normalizedPhone,
        expiresAt,
        message: `Verification code sent to ${normalizedPhone}`
      };

    } catch (error) {
      logger.error('Error creating user and sending code:', error);
      return {
        success: false,
        message: `Failed to send verification code: ${error.message}`
      };
    }
  }

  /**
   * Verify code from user message
   * @param {string} phoneNumber - User's phone number
   * @param {string} messageBody - Message from user (e.g., "HI 123456")
   * @returns {Promise<object>} - { verified, userId, name, message }
   */
  async verifyCode(phoneNumber, messageBody) {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

      // Check if verification exists
      const verificationData = this.verificationCodes.get(normalizedPhone);

      if (!verificationData) {
        return {
          verified: false,
          message: '❌ No verification code found for this number.\n\n' +
            'Please contact your administrator to register.'
        };
      }

      // Check expiry
      if (new Date() > verificationData.expiresAt) {
        this.verificationCodes.delete(normalizedPhone);
        return {
          verified: false,
          message: '⏰ Verification code expired.\n\n' +
            'Please contact your administrator for a new code.'
        };
      }

      // Extract code from message (e.g., "HI 123456" or "hi 192556779")
      const codeMatch = messageBody.match(/\b\d{6}\b/);
      if (!codeMatch) {
        return {
          verified: false,
          message: '❌ Invalid format.\n\n' +
            'Please reply with: *HI [your 6-digit code]*\n\n' +
            'Example: HI 123456'
        };
      }

      const providedCode = codeMatch[0];

      // Check attempts
      verificationData.attempts++;
      if (verificationData.attempts > this.MAX_ATTEMPTS) {
        this.verificationCodes.delete(normalizedPhone);
        return {
          verified: false,
          message: '🔒 Too many attempts.\n\n' +
            'Please contact your administrator for a new code.'
        };
      }

      // Verify code
      if (providedCode !== verificationData.code) {
        return {
          verified: false,
          message: `❌ Incorrect code. (${this.MAX_ATTEMPTS - verificationData.attempts} attempts remaining)\n\n` +
            'Please try again: *HI [your code]*'
        };
      }

      // Code is correct - create user account
      // Get the first available module from any course
      const firstModuleResult = await postgresService.query(
        `SELECT m.id FROM modules m
         JOIN courses c ON m.course_id = c.id
         ORDER BY c.sequence_order, m.sequence_order
         LIMIT 1`
      );

      const firstModuleId = firstModuleResult.rows.length > 0
        ? firstModuleResult.rows[0].id
        : null;

      const result = await postgresService.query(
        `INSERT INTO users (whatsapp_id, name, current_module_id, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id, whatsapp_id, name`,
        [normalizedPhone, verificationData.name, firstModuleId]
      );

      const user = result.rows[0];

      // Initialize first module progress (if exists)
      if (firstModuleId) {
        await postgresService.query(
          `INSERT INTO user_progress (user_id, module_id, status, progress_percentage, started_at, last_activity_at)
           VALUES ($1, $2, 'not_started', 0, NOW(), NOW())`,
          [user.id, firstModuleId]
        );
      }

      // Clean up verification code
      this.verificationCodes.delete(normalizedPhone);

      logger.info(`✅ User verified and created: ${user.name} (${normalizedPhone})`);

      return {
        verified: true,
        userId: user.id,
        name: user.name,
        phoneNumber: normalizedPhone,
        message: null // Welcome message will be sent separately
      };

    } catch (error) {
      logger.error('Error verifying code:', error);
      return {
        verified: false,
        message: '⚠️ Error during verification. Please try again or contact support.'
      };
    }
  }

  /**
   * Send welcome message after successful verification
   */
  async sendWelcomeMessage(phoneNumber, name) {
    try {
      // Get available courses and their modules
      const coursesResult = await postgresService.query(`
        SELECT c.id, c.code, c.title,
               (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) as module_count
        FROM courses c
        ORDER BY c.sequence_order
        LIMIT 5
      `);

      let coursesText = '';
      if (coursesResult.rows.length > 0) {
        coursesText = coursesResult.rows.map((course, idx) => {
          const moduleText = course.module_count > 0 ? ` (${course.module_count} modules)` : '';
          return `${idx + 1}️⃣ ${course.title}${moduleText}`;
        }).join('\n');
      } else {
        coursesText = '📚 Courses coming soon!';
      }

      const welcomeMessage = `🎉 *Account Activated!*\n\n` +
        `Welcome ${name}! 👋\n\n` +
        `Your account has been successfully activated. You now have access to the Teachers Training program!\n\n` +
        `*📚 Available Courses:*\n` +
        `${coursesText}\n\n` +
        `*🚀 Getting Started:*\n` +
        `• Ask me questions about the course content\n` +
        `• Type *"courses"* to see available courses\n` +
        `• Type *"progress"* to track your learning\n` +
        `• Type *"help"* for all available commands\n\n` +
        `I'm here to help you learn! Ask me anything about the course material. 📖`;

      await twilioWhatsAppService.sendMessage(phoneNumber, welcomeMessage);

      logger.info(`Welcome message sent to ${phoneNumber}`);

      return { success: true };
    } catch (error) {
      logger.error('Error sending welcome message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user is pending verification
   */
  isPendingVerification(phoneNumber) {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    return this.verificationCodes.has(normalizedPhone);
  }

  /**
   * Get pending verification info (for admin)
   */
  getPendingVerification(phoneNumber) {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    const data = this.verificationCodes.get(normalizedPhone);

    if (!data) return null;

    return {
      phoneNumber: normalizedPhone,
      name: data.name,
      code: data.code,
      expiresAt: data.expiresAt,
      attempts: data.attempts,
      createdAt: data.createdAt
    };
  }

  /**
   * Resend verification code
   */
  async resendCode(phoneNumber) {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    const data = this.verificationCodes.get(normalizedPhone);

    if (!data) {
      return {
        success: false,
        message: 'No pending verification found'
      };
    }

    // Generate new code and extend expiry
    const newCode = this.generateCode();
    data.code = newCode;
    data.expiresAt = new Date(Date.now() + this.CODE_EXPIRY_MINUTES * 60 * 1000);
    data.attempts = 0;

    const message = `🔄 *New Verification Code*\n\n` +
      `Your new verification code is: *${newCode}*\n\n` +
      `Reply with: *HI ${newCode}*\n\n` +
      `This code expires in ${this.CODE_EXPIRY_MINUTES} minutes.`;

    await twilioWhatsAppService.sendMessage(normalizedPhone, message);

    logger.info(`Verification code resent to ${normalizedPhone}: ${newCode}`);

    return {
      success: true,
      code: newCode,
      message: 'New verification code sent'
    };
  }

  /**
   * Clean up expired codes (run periodically)
   */
  cleanupExpiredCodes() {
    const now = new Date();
    let cleaned = 0;

    for (const [phone, data] of this.verificationCodes.entries()) {
      if (now > data.expiresAt) {
        this.verificationCodes.delete(phone);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} expired verification codes`);
    }

    return cleaned;
  }
}

// Run cleanup every 10 minutes
const verificationService = new VerificationService();
setInterval(() => {
  verificationService.cleanupExpiredCodes();
}, 10 * 60 * 1000);

module.exports = verificationService;
