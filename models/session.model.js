/**
 * Session Model
 * Handles user session management
 */

const postgresService = require('../services/database/postgres.service');

class SessionModel {
  /**
   * Create a new session
   */
  static async create(sessionData) {
    const { user_id, whatsapp_id, context = {} } = sessionData;
    const sessionTTL = process.env.SESSION_TTL_HOURS || 24;
    
    const query = `
      INSERT INTO sessions (user_id, whatsapp_id, expires_at, context)
      VALUES ($1, $2, NOW() + INTERVAL '${sessionTTL} hours', $3)
      RETURNING *
    `;
    
    try {
      const result = await postgresService.query(query, [user_id, whatsapp_id, context]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find session by ID
   */
  static async findById(id) {
    const query = `
      SELECT * FROM sessions 
      WHERE id = $1 AND is_active = true AND expires_at > NOW()
    `;
    const result = await postgresService.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Find active session for user
   */
  static async findActiveByUserId(userId) {
    const query = `
      SELECT * FROM sessions 
      WHERE user_id = $1 
        AND is_active = true 
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await postgresService.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Find active session by WhatsApp ID
   */
  static async findActiveByWhatsAppId(whatsappId) {
    const query = `
      SELECT s.*, u.name as user_name, u.current_module_id
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.whatsapp_id = $1 
        AND s.is_active = true 
        AND s.expires_at > NOW()
      ORDER BY s.started_at DESC
      LIMIT 1
    `;
    const result = await postgresService.query(query, [whatsappId]);
    return result.rows[0];
  }

  /**
   * Update session context and activity
   */
  static async update(id, updates) {
    const { context, extend_expiry = true } = updates;
    const sessionTTL = process.env.SESSION_TTL_HOURS || 24;
    
    let query;
    let values;

    if (extend_expiry) {
      query = `
        UPDATE sessions 
        SET context = $1, 
            last_activity_at = NOW(), 
            expires_at = NOW() + INTERVAL '${sessionTTL} hours'
        WHERE id = $2 AND is_active = true
        RETURNING *
      `;
      values = [context, id];
    } else {
      query = `
        UPDATE sessions 
        SET context = $1, 
            last_activity_at = NOW()
        WHERE id = $2 AND is_active = true
        RETURNING *
      `;
      values = [context, id];
    }

    const result = await postgresService.query(query, values);
    return result.rows[0];
  }

  /**
   * Merge context (preserves existing context)
   */
  static async mergeContext(id, newContext) {
    // First get current context
    const current = await this.findById(id);
    if (!current) {
      throw new Error('Session not found or expired');
    }

    // Merge contexts
    const mergedContext = { ...current.context, ...newContext };
    
    // Update with merged context
    return await this.update(id, { context: mergedContext });
  }

  /**
   * End session
   */
  static async end(id) {
    const query = `
      UPDATE sessions 
      SET is_active = false, last_activity_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await postgresService.query(query, [id]);
    return result.rows[0];
  }

  /**
   * End all sessions for user
   */
  static async endAllForUser(userId) {
    const query = `
      UPDATE sessions 
      SET is_active = false, last_activity_at = NOW()
      WHERE user_id = $1 AND is_active = true
      RETURNING COUNT(*)
    `;
    const result = await postgresService.query(query, [userId]);
    return result.rowCount;
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpired() {
    const query = `
      UPDATE sessions 
      SET is_active = false
      WHERE expires_at < NOW() AND is_active = true
      RETURNING COUNT(*)
    `;
    const result = await postgresService.query(query);
    return {
      removed_count: result.rowCount,
      active_count: await this.getActiveCount()
    };
  }

  /**
   * Get active session count
   */
  static async getActiveCount() {
    const query = `
      SELECT COUNT(*) FROM sessions 
      WHERE is_active = true AND expires_at > NOW()
    `;
    const result = await postgresService.query(query);
    return parseInt(result.rows[0].count);
  }

  /**
   * Get session statistics
   */
  static async getStatistics() {
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE is_active = true AND expires_at > NOW()) as active,
        COUNT(*) FILTER (WHERE is_active = false) as ended,
        COUNT(*) FILTER (WHERE expires_at < NOW() AND is_active = true) as expired,
        AVG(EXTRACT(EPOCH FROM (last_activity_at - started_at))/3600)::numeric(10,2) as avg_duration_hours
      FROM sessions
    `;
    const result = await postgresService.query(query);
    return result.rows[0];
  }

  /**
   * Get or create session for WhatsApp user
   */
  static async getOrCreate(whatsappId, userId) {
    // Try to find active session
    let session = await this.findActiveByWhatsAppId(whatsappId);
    
    if (session) {
      // Extend expiry
      await this.update(session.id, { context: session.context });
      return { session, isNew: false };
    }

    // Create new session
    session = await this.create({
      user_id: userId,
      whatsapp_id: whatsappId,
      context: {
        conversation_history: [],
        current_state: 'idle'
      }
    });

    return { session, isNew: true };
  }

  /**
   * Add message to conversation history
   */
  static async addToHistory(sessionId, message, response) {
    const session = await this.findById(sessionId);
    if (!session) {
      throw new Error('Session not found or expired');
    }

    const history = session.context.conversation_history || [];
    history.push({
      timestamp: new Date(),
      message,
      response
    });

    // Keep only last 20 messages
    if (history.length > 20) {
      history.shift();
    }

    const newContext = {
      ...session.context,
      conversation_history: history
    };

    return await this.update(sessionId, { context: newContext });
  }
}

module.exports = SessionModel;