/**
 * Admin Authentication Service
 * Handles admin login, logout, and authorization
 */

const AdminUserModel = require('../../models/admin-user.model');
const JWTUtil = require('../../utils/jwt.util');

class AdminAuthService {
  /**
   * Admin login
   */
  static async login(email, password) {
    try {
      // Verify credentials
      const admin = await AdminUserModel.verifyCredentials(email, password);
      
      if (!admin) {
        throw new Error('Invalid email or password');
      }

      // Generate tokens
      const tokenPayload = {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        type: 'admin'
      };

      const accessToken = JWTUtil.generateToken(tokenPayload);
      const refreshToken = JWTUtil.generateRefreshToken(tokenPayload);

      return {
        user: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || 86400
        }
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = JWTUtil.verifyRefreshToken(refreshToken);
      
      // Get fresh user data
      const admin = await AdminUserModel.findById(decoded.id);
      
      if (!admin || !admin.is_active) {
        throw new Error('Admin account not found or inactive');
      }

      // Generate new access token
      const tokenPayload = {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        type: 'admin'
      };

      const accessToken = JWTUtil.generateToken(tokenPayload);

      return {
        accessToken,
        expiresIn: process.env.JWT_EXPIRES_IN || 86400
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Validate access token
   */
  static async validateToken(token) {
    try {
      const decoded = JWTUtil.verifyToken(token);
      
      // Ensure it's an admin token
      if (decoded.type !== 'admin') {
        throw new Error('Invalid token type');
      }

      // Get fresh user data
      const admin = await AdminUserModel.findById(decoded.id);
      
      if (!admin || !admin.is_active) {
        throw new Error('Admin account not found or inactive');
      }

      return {
        isValid: true,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role
        }
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message
      };
    }
  }

  /**
   * Change password
   */
  static async changePassword(adminId, oldPassword, newPassword) {
    try {
      const result = await AdminUserModel.changePassword(adminId, oldPassword, newPassword);
      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      console.error('Password change error:', error);
      throw error;
    }
  }

  /**
   * Reset password (admin action)
   */
  static async resetPassword(adminId, newPassword, requesterId, requesterRole) {
    // Check if requester has permission
    if (!AdminUserModel.hasPermission(requesterRole, 'admin')) {
      throw new Error('Insufficient permissions to reset password');
    }

    try {
      await AdminUserModel.resetPassword(adminId, newPassword);
      return {
        success: true,
        message: 'Password reset successfully'
      };
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  }

  /**
   * Create new admin user
   */
  static async createAdmin(adminData, creatorRole) {
    // Check if creator has permission
    if (!AdminUserModel.hasPermission(creatorRole, 'admin')) {
      throw new Error('Insufficient permissions to create admin user');
    }

    try {
      const newAdmin = await AdminUserModel.create(adminData);
      return {
        success: true,
        admin: newAdmin
      };
    } catch (error) {
      console.error('Admin creation error:', error);
      throw error;
    }
  }

  /**
   * Get all admin users
   */
  static async getAllAdmins(options, requesterRole) {
    // Viewers can only see basic info
    if (requesterRole === 'viewer') {
      options.limit = 10; // Limit results for viewers
    }

    try {
      const result = await AdminUserModel.findAll(options);
      return result;
    } catch (error) {
      console.error('Get admins error:', error);
      throw error;
    }
  }

  /**
   * Update admin user
   */
  static async updateAdmin(adminId, updates, requesterId, requesterRole) {
    // Check permissions
    if (adminId !== requesterId && !AdminUserModel.hasPermission(requesterRole, 'admin')) {
      throw new Error('Insufficient permissions to update this user');
    }

    // Prevent role escalation
    if (updates.role && !AdminUserModel.hasPermission(requesterRole, 'admin')) {
      delete updates.role;
    }

    try {
      const updatedAdmin = await AdminUserModel.update(adminId, updates);
      return {
        success: true,
        admin: updatedAdmin
      };
    } catch (error) {
      console.error('Admin update error:', error);
      throw error;
    }
  }

  /**
   * Delete admin user
   */
  static async deleteAdmin(adminId, requesterId, requesterRole) {
    // Check permissions
    if (!AdminUserModel.hasPermission(requesterRole, 'admin')) {
      throw new Error('Insufficient permissions to delete admin user');
    }

    // Prevent self-deletion
    if (adminId === requesterId) {
      throw new Error('Cannot delete your own account');
    }

    try {
      await AdminUserModel.delete(adminId);
      return {
        success: true,
        message: 'Admin user deleted successfully'
      };
    } catch (error) {
      console.error('Admin deletion error:', error);
      throw error;
    }
  }
}

module.exports = AdminAuthService;