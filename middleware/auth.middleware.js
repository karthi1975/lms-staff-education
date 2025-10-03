/**
 * Authentication Middleware
 * Protects routes requiring authentication
 */

const JWTUtil = require('../utils/jwt.util');
const AdminUserModel = require('../models/admin-user.model');

/**
 * Verify JWT token
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Extract token from header
    const authHeader = req.headers['authorization'];
    const token = JWTUtil.extractToken(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    // Verify token
    const decoded = JWTUtil.verifyToken(token);

    // Get user data
    if (decoded.type === 'admin') {
      const admin = await AdminUserModel.findById(decoded.id);
      
      if (!admin || !admin.is_active) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or inactive account'
        });
      }

      // Attach user to request
      req.user = {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        type: 'admin'
      };
    } else {
      // Handle regular user tokens if needed in future
      return res.status(401).json({
        success: false,
        error: 'Invalid token type'
      });
    }

    next();
  } catch (error) {
    if (error.message === 'Token has expired') {
      return res.status(401).json({
        success: false,
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
};

/**
 * Check if user has required role
 */
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!AdminUserModel.hasPermission(req.user.role, requiredRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Check if user is admin
 */
const requireAdmin = requireRole('admin');

/**
 * Check if user is instructor or above
 */
const requireInstructor = requireRole('instructor');

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = JWTUtil.extractToken(authHeader);

    if (token) {
      const decoded = JWTUtil.verifyToken(token);
      
      if (decoded.type === 'admin') {
        const admin = await AdminUserModel.findById(decoded.id);
        if (admin && admin.is_active) {
          req.user = {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role,
            type: 'admin'
          };
        }
      }
    }
  } catch (error) {
    // Ignore errors for optional auth
    console.log('Optional auth failed:', error.message);
  }

  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireInstructor,
  optionalAuth
};