const postgresService = require('./database/postgres.service');
const logger = require('../utils/logger');

class ChatHistoryService {
  /**
   * Get or create a chat session for a user and module
   * @param {number} userId - User ID
   * @param {number} moduleId - Module ID (optional)
   * @returns {Promise<Object>} Session object
   */
  async getOrCreateSession(userId, moduleId = null) {
    try {
      // Try to find an active session for this user and module
      let result = await postgresService.query(
        `SELECT * FROM chat_sessions
         WHERE user_id = $1
         AND (module_id = $2 OR ($2 IS NULL AND module_id IS NULL))
         AND is_active = TRUE
         ORDER BY last_activity_at DESC
         LIMIT 1`,
        [userId, moduleId]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Create a new session if none exists
      result = await postgresService.query(
        `INSERT INTO chat_sessions (user_id, module_id, session_title, is_active)
         VALUES ($1, $2, $3, TRUE)
         RETURNING *`,
        [userId, moduleId, moduleId ? `Module ${moduleId} Chat` : 'General Chat']
      );

      logger.info(`Created new chat session ${result.rows[0].id} for user ${userId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error getting/creating chat session:', error);
      throw error;
    }
  }

  /**
   * Save a chat message to history
   * @param {number} sessionId - Session ID
   * @param {number} userId - User ID
   * @param {string} role - Message role (user, assistant, system)
   * @param {string} content - Message content
   * @param {number} moduleId - Module ID (optional)
   * @param {Array} contextSources - RAG context sources
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Saved message
   */
  async saveMessage(sessionId, userId, role, content, moduleId = null, contextSources = [], metadata = {}) {
    try {
      const result = await postgresService.query(
        `INSERT INTO chat_messages
         (session_id, user_id, message_role, message_content, module_id, context_sources, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [sessionId, userId, role, content, moduleId, JSON.stringify(contextSources), JSON.stringify(metadata)]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error saving chat message:', error);
      throw error;
    }
  }

  /**
   * Get chat history for a session
   * @param {number} sessionId - Session ID
   * @param {number} limit - Maximum number of messages to retrieve (default: 50)
   * @returns {Promise<Array>} Array of messages
   */
  async getSessionHistory(sessionId, limit = 50) {
    try {
      const result = await postgresService.query(
        `SELECT * FROM chat_messages
         WHERE session_id = $1
         ORDER BY created_at ASC
         LIMIT $2`,
        [sessionId, limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error retrieving session history:', error);
      throw error;
    }
  }

  /**
   * Get recent chat history for context (last N messages)
   * @param {number} sessionId - Session ID
   * @param {number} messageCount - Number of recent messages (default: 10)
   * @returns {Promise<Array>} Array of recent messages
   */
  async getRecentHistory(sessionId, messageCount = 10) {
    try {
      const result = await postgresService.query(
        `SELECT message_role, message_content, created_at
         FROM chat_messages
         WHERE session_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [sessionId, messageCount]
      );

      // Reverse to get chronological order
      return result.rows.reverse();
    } catch (error) {
      logger.error('Error retrieving recent history:', error);
      throw error;
    }
  }

  /**
   * Get all sessions for a user
   * @param {number} userId - User ID
   * @param {boolean} activeOnly - Only return active sessions
   * @returns {Promise<Array>} Array of sessions
   */
  async getUserSessions(userId, activeOnly = false) {
    try {
      let query = `
        SELECT s.*, COUNT(m.id) as message_count
        FROM chat_sessions s
        LEFT JOIN chat_messages m ON s.id = m.session_id
        WHERE s.user_id = $1
      `;

      if (activeOnly) {
        query += ' AND s.is_active = TRUE';
      }

      query += ' GROUP BY s.id ORDER BY s.last_activity_at DESC';

      const result = await postgresService.query(query, [userId]);
      return result.rows;
    } catch (error) {
      logger.error('Error retrieving user sessions:', error);
      throw error;
    }
  }

  /**
   * Close/deactivate a session
   * @param {number} sessionId - Session ID
   */
  async closeSession(sessionId) {
    try {
      await postgresService.query(
        `UPDATE chat_sessions SET is_active = FALSE, updated_at = NOW() WHERE id = $1`,
        [sessionId]
      );
      logger.info(`Closed chat session ${sessionId}`);
    } catch (error) {
      logger.error('Error closing session:', error);
      throw error;
    }
  }

  /**
   * Get conversation context formatted for AI
   * Formats recent messages into a context string for the AI
   * @param {number} sessionId - Session ID
   * @param {number} messageCount - Number of recent messages to include
   * @returns {Promise<string>} Formatted conversation context
   */
  async getConversationContext(sessionId, messageCount = 5) {
    try {
      const messages = await this.getRecentHistory(sessionId, messageCount);

      if (messages.length === 0) {
        return '';
      }

      const contextLines = messages.map(msg => {
        const role = msg.message_role === 'user' ? 'User' : 'Assistant';
        return `${role}: ${msg.message_content}`;
      });

      return `Previous conversation:\n${contextLines.join('\n')}\n`;
    } catch (error) {
      logger.error('Error getting conversation context:', error);
      return '';
    }
  }

  /**
   * Delete old inactive sessions (cleanup)
   * @param {number} daysOld - Delete sessions older than this many days
   */
  async cleanupOldSessions(daysOld = 90) {
    try {
      const result = await postgresService.query(
        `DELETE FROM chat_sessions
         WHERE is_active = FALSE
         AND last_activity_at < NOW() - INTERVAL '${daysOld} days'
         RETURNING id`,
        []
      );

      logger.info(`Cleaned up ${result.rows.length} old chat sessions`);
      return result.rows.length;
    } catch (error) {
      logger.error('Error cleaning up old sessions:', error);
      throw error;
    }
  }
}

module.exports = new ChatHistoryService();
