/**
 * JWT Utility
 * Handles JWT token generation and verification
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '86400'; // 24 hours

class JWTUtil {
  /**
   * Generate JWT token
   * @param {Object} payload - Data to encode in token
   * @param {Object} options - Additional JWT options
   * @returns {String} JWT token
   */
  static generateToken(payload, options = {}) {
    const defaultOptions = {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'teachers-training-system',
      audience: 'teachers-training-users'
    };

    const tokenOptions = { ...defaultOptions, ...options };
    
    return jwt.sign(payload, JWT_SECRET, tokenOptions);
  }

  /**
   * Verify JWT token
   * @param {String} token - JWT token to verify
   * @returns {Object} Decoded token payload
   */
  static verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET, {
        issuer: 'teachers-training-system',
        audience: 'teachers-training-users'
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else {
        throw error;
      }
    }
  }

  /**
   * Decode token without verification (for debugging)
   * @param {String} token - JWT token
   * @returns {Object} Decoded token
   */
  static decodeToken(token) {
    return jwt.decode(token, { complete: true });
  }

  /**
   * Generate refresh token
   * @param {Object} payload - Data to encode
   * @returns {String} Refresh token
   */
  static generateRefreshToken(payload) {
    return this.generateToken(payload, {
      expiresIn: '7d', // 7 days
      audience: 'teachers-training-refresh'
    });
  }

  /**
   * Verify refresh token
   * @param {String} token - Refresh token
   * @returns {Object} Decoded payload
   */
  static verifyRefreshToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET, {
        issuer: 'teachers-training-system',
        audience: 'teachers-training-refresh'
      });
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Extract token from Authorization header
   * @param {String} authHeader - Authorization header value
   * @returns {String|null} Token or null
   */
  static extractToken(authHeader) {
    if (!authHeader) return null;
    
    // Check for Bearer token
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    return authHeader;
  }
}

module.exports = JWTUtil;