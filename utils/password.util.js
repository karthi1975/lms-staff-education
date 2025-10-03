/**
 * Password Utility
 * Handles password hashing and verification using bcrypt
 */

const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

class PasswordUtil {
  /**
   * Hash a plain text password
   * @param {String} password - Plain text password
   * @returns {Promise<String>} Hashed password
   */
  static async hashPassword(password) {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    try {
      const salt = await bcrypt.genSalt(SALT_ROUNDS);
      const hash = await bcrypt.hash(password, salt);
      return hash;
    } catch (error) {
      throw new Error('Error hashing password: ' + error.message);
    }
  }

  /**
   * Verify a password against a hash
   * @param {String} password - Plain text password
   * @param {String} hash - Hashed password
   * @returns {Promise<Boolean>} True if password matches
   */
  static async verifyPassword(password, hash) {
    if (!password || !hash) {
      return false;
    }
    
    try {
      const isMatch = await bcrypt.compare(password, hash);
      return isMatch;
    } catch (error) {
      console.error('Error verifying password:', error);
      return false;
    }
  }

  /**
   * Validate password strength
   * @param {String} password - Password to validate
   * @returns {Object} Validation result
   */
  static validatePasswordStrength(password) {
    const result = {
      isValid: true,
      errors: []
    };

    if (!password || password.length < 8) {
      result.errors.push('Password must be at least 8 characters long');
      result.isValid = false;
    }

    if (!/[A-Z]/.test(password)) {
      result.errors.push('Password must contain at least one uppercase letter');
      result.isValid = false;
    }

    if (!/[a-z]/.test(password)) {
      result.errors.push('Password must contain at least one lowercase letter');
      result.isValid = false;
    }

    if (!/[0-9]/.test(password)) {
      result.errors.push('Password must contain at least one number');
      result.isValid = false;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      result.errors.push('Password must contain at least one special character');
      result.isValid = false;
    }

    return result;
  }

  /**
   * Generate a random password
   * @param {Number} length - Password length (default: 12)
   * @returns {String} Random password
   */
  static generateRandomPassword(length = 12) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const allChars = uppercase + lowercase + numbers + special;

    let password = '';
    
    // Ensure at least one of each required character type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Check if password needs rehashing (e.g., if salt rounds changed)
   * @param {String} hash - Current password hash
   * @returns {Boolean} True if needs rehashing
   */
  static needsRehash(hash) {
    try {
      const rounds = bcrypt.getRounds(hash);
      return rounds !== SALT_ROUNDS;
    } catch (error) {
      return true;
    }
  }
}

module.exports = PasswordUtil;