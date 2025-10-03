/**
 * AdminUser Model
 * Handles admin user authentication and management
 */

const postgresService = require('../services/database/postgres.service');
const PasswordUtil = require('../utils/password.util');

class AdminUserModel {
  /**
   * Create a new admin user
   */
  static async create(adminData) {
    const { email, password, name, role = 'viewer' } = adminData;
    
    // Hash password
    const password_hash = await PasswordUtil.hashPassword(password);
    
    const query = `
      INSERT INTO admin_users (email, password_hash, name, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, name, role, created_at, is_active
    `;
    
    try {
      const result = await postgresService.query(query, [email, password_hash, name, role]);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error('Admin user with this email already exists');
      }
      throw error;
    }
  }

  /**
   * Find admin by ID (without password)
   */
  static async findById(id) {
    const query = `
      SELECT id, email, name, role, ldap_dn, created_at, 
             updated_at, last_login_at, is_active
      FROM admin_users 
      WHERE id = $1
    `;
    const result = await postgresService.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Find admin by email (with password for auth)
   */
  static async findByEmail(email) {
    const query = 'SELECT * FROM admin_users WHERE email = $1';
    const result = await postgresService.query(query, [email]);
    return result.rows[0];
  }

  /**
   * Verify admin credentials
   */
  static async verifyCredentials(email, password) {
    const admin = await this.findByEmail(email);
    
    if (!admin) {
      return null;
    }

    if (!admin.is_active) {
      throw new Error('Account is deactivated');
    }

    const isValidPassword = await PasswordUtil.verifyPassword(password, admin.password_hash);
    
    if (!isValidPassword) {
      return null;
    }

    // Update last login
    await this.updateLastLogin(admin.id);

    // Return admin without password
    const { password_hash, ...adminWithoutPassword } = admin;
    return adminWithoutPassword;
  }

  /**
   * Update admin user
   */
  static async update(id, updates) {
    const allowedFields = ['name', 'role', 'ldap_dn', 'is_active'];
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    // Handle password update separately
    if (updates.password) {
      const password_hash = await PasswordUtil.hashPassword(updates.password);
      updateFields.push(`password_hash = $${paramCount}`);
      values.push(password_hash);
      paramCount++;
    }

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);
    const query = `
      UPDATE admin_users 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING id, email, name, role, ldap_dn, created_at, updated_at, last_login_at, is_active
    `;

    const result = await postgresService.query(query, values);
    return result.rows[0];
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(id) {
    const query = `
      UPDATE admin_users 
      SET last_login_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, name, role, last_login_at
    `;
    const result = await postgresService.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Get all admin users with pagination
   */
  static async findAll(options = {}) {
    const { 
      page = 1, 
      limit = 20, 
      role = null,
      is_active = null 
    } = options;
    
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (role) {
      whereClause += ` AND role = $${paramCount}`;
      values.push(role);
      paramCount++;
    }

    if (is_active !== null) {
      whereClause += ` AND is_active = $${paramCount}`;
      values.push(is_active);
      paramCount++;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM admin_users ${whereClause}`;
    const countResult = await postgresService.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results (without passwords)
    values.push(limit);
    values.push(offset);
    const query = `
      SELECT id, email, name, role, ldap_dn, created_at, 
             updated_at, last_login_at, is_active
      FROM admin_users 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const result = await postgresService.query(query, values);

    return {
      admins: result.rows,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    };
  }

  /**
   * Change password
   */
  static async changePassword(id, oldPassword, newPassword) {
    // Get current password hash
    const query = 'SELECT password_hash FROM admin_users WHERE id = $1';
    const result = await postgresService.query(query, [id]);
    
    if (!result.rows[0]) {
      throw new Error('Admin user not found');
    }

    // Verify old password
    const isValidOldPassword = await PasswordUtil.verifyPassword(
      oldPassword, 
      result.rows[0].password_hash
    );
    
    if (!isValidOldPassword) {
      throw new Error('Current password is incorrect');
    }

    // Update to new password
    return await this.update(id, { password: newPassword });
  }

  /**
   * Reset password (admin action)
   */
  static async resetPassword(id, newPassword) {
    return await this.update(id, { password: newPassword });
  }

  /**
   * Delete admin user
   */
  static async delete(id) {
    const query = 'DELETE FROM admin_users WHERE id = $1 RETURNING email';
    const result = await postgresService.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Check if admin has permission
   */
  static hasPermission(adminRole, requiredRole) {
    const roleHierarchy = {
      'viewer': 1,
      'instructor': 2,
      'admin': 3
    };

    return roleHierarchy[adminRole] >= roleHierarchy[requiredRole];
  }
}

module.exports = AdminUserModel;