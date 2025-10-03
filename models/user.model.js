/**
 * User Model
 * Handles WhatsApp user data operations
 */

const postgresService = require('../services/database/postgres.service');

class UserModel {
  /**
   * Create a new user
   */
  static async create(userData) {
    const { whatsapp_id, name, metadata = {} } = userData;
    
    const query = `
      INSERT INTO users (whatsapp_id, name, metadata)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    try {
      const result = await postgresService.query(query, [whatsapp_id, name, metadata]);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error('User with this WhatsApp ID already exists');
      }
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  static async findById(id) {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await postgresService.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Find user by WhatsApp ID
   */
  static async findByWhatsAppId(whatsapp_id) {
    const query = 'SELECT * FROM users WHERE whatsapp_id = $1';
    const result = await postgresService.query(query, [whatsapp_id]);
    return result.rows[0];
  }

  /**
   * Find or create user
   */
  static async findOrCreate(whatsapp_id, name) {
    // First try to find
    let user = await this.findByWhatsAppId(whatsapp_id);
    
    if (user) {
      // Update last active
      await this.updateLastActive(user.id);
      return { user, isNew: false };
    }
    
    // Create new user
    user = await this.create({ whatsapp_id, name });
    return { user, isNew: true };
  }

  /**
   * Update user
   */
  static async update(id, updates) {
    const allowedFields = ['name', 'current_module_id', 'metadata', 'is_active'];
    const updateFields = [];
    const values = [];
    let paramCount = 1;

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
      UPDATE users 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await postgresService.query(query, values);
    return result.rows[0];
  }

  /**
   * Update last active timestamp
   */
  static async updateLastActive(id) {
    const query = `
      UPDATE users 
      SET last_active_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await postgresService.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Get all users with pagination
   */
  static async findAll(options = {}) {
    const { 
      page = 1, 
      limit = 20, 
      search = null,
      module_id = null,
      is_active = null 
    } = options;
    
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (search) {
      whereClause += ` AND (name ILIKE $${paramCount} OR whatsapp_id ILIKE $${paramCount})`;
      values.push(`%${search}%`);
      paramCount++;
    }

    if (module_id !== null) {
      whereClause += ` AND current_module_id = $${paramCount}`;
      values.push(module_id);
      paramCount++;
    }

    if (is_active !== null) {
      whereClause += ` AND is_active = $${paramCount}`;
      values.push(is_active);
      paramCount++;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
    const countResult = await postgresService.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    values.push(limit);
    values.push(offset);
    const query = `
      SELECT * FROM users 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const result = await postgresService.query(query, values);

    return {
      users: result.rows,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    };
  }

  /**
   * Get user progress with quiz attempts
   */
  static async getUserProgress(userId) {
    const query = `
      SELECT 
        u.*,
        COALESCE(
          json_agg(
            json_build_object(
              'module_id', qa.module_id,
              'attempt_number', qa.attempt_number,
              'score', qa.score,
              'passed', qa.passed,
              'completed_at', qa.completed_at
            ) ORDER BY qa.completed_at DESC
          ) FILTER (WHERE qa.id IS NOT NULL), 
          '[]'
        ) as quiz_attempts
      FROM users u
      LEFT JOIN quiz_attempts qa ON u.id = qa.user_id
      WHERE u.id = $1
      GROUP BY u.id
    `;

    const result = await postgresService.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Get inactive users
   */
  static async getInactiveUsers(hoursInactive = 48) {
    const query = `
      SELECT * FROM users
      WHERE is_active = true
      AND (last_active_at IS NULL OR last_active_at < NOW() - INTERVAL '${hoursInactive} hours')
      ORDER BY last_active_at ASC NULLS FIRST
    `;
    
    const result = await postgresService.query(query);
    return result.rows;
  }

  /**
   * Delete user (cascade will handle related records)
   */
  static async delete(id) {
    const query = 'DELETE FROM users WHERE id = $1 RETURNING *';
    const result = await postgresService.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = UserModel;