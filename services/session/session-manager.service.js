const { v4: uuidv4 } = require('uuid');
const neo4jService = require('../neo4j.service');
const logger = require('../../utils/logger');

/**
 * Session Manager Service
 * Implements state management and context preservation as per architecture diagram
 */
class SessionManagerService {
  constructor() {
    this.activeSessions = new Map(); // In-memory cache for quick access
    this.SESSION_TTL_HOURS = parseInt(process.env.SESSION_TTL_HOURS || '24');
  }

  /**
   * Create or resume a session for a user
   */
  async getOrCreateSession(userId, whatsappId) {
    try {
      // Check for active session in Neo4j
      let session = await neo4jService.getActiveSession(userId);

      if (!session) {
        // Create new session
        const sessionId = uuidv4();
        session = await neo4jService.createOrUpdateSession(userId, {
          sessionId,
          context: {
            whatsappId,
            conversationHistory: [],
            preferences: {}
          },
          currentState: 'welcome',
          currentModuleId: null
        });

        logger.info(`New session created for user ${userId}: ${sessionId}`);
      } else {
        logger.info(`Resumed session for user ${userId}: ${session.id}`);
      }

      // Cache in memory
      this.activeSessions.set(userId, session);

      return session;
    } catch (error) {
      logger.error('Error managing session:', error);
      throw error;
    }
  }

  /**
   * Update session state
   */
  async updateSessionState(userId, updates) {
    try {
      const session = await this.getOrCreateSession(userId);

      const updatedContext = {
        ...session.context,
        ...updates.context
      };

      await neo4jService.createOrUpdateSession(userId, {
        sessionId: session.id,
        context: updatedContext,
        currentState: updates.currentState || session.current_state,
        currentModuleId: updates.currentModuleId || session.current_module_id
      });

      // Update cache
      this.activeSessions.set(userId, {
        ...session,
        ...updates
      });

      logger.info(`Session updated for user ${userId}`);
    } catch (error) {
      logger.error('Error updating session:', error);
      throw error;
    }
  }

  /**
   * Record user event in session
   */
  async recordEvent(userId, eventType, eventData) {
    try {
      await neo4jService.recordEvent(userId, {
        type: eventType,
        data: eventData,
        moduleId: eventData.moduleId || null
      });

      logger.info(`Event recorded for user ${userId}: ${eventType}`);
    } catch (error) {
      logger.error('Error recording event:', error);
    }
  }

  /**
   * Get session context for user
   */
  async getSessionContext(userId) {
    try {
      const session = await this.getOrCreateSession(userId);
      return session.context || {};
    } catch (error) {
      logger.error('Error getting session context:', error);
      return {};
    }
  }

  /**
   * Add message to conversation history
   */
  async addToConversationHistory(userId, message) {
    try {
      const session = await this.getOrCreateSession(userId);
      const history = session.context.conversationHistory || [];

      history.push({
        timestamp: new Date().toISOString(),
        ...message
      });

      // Keep only last 20 messages
      if (history.length > 20) {
        history.splice(0, history.length - 20);
      }

      await this.updateSessionState(userId, {
        context: {
          ...session.context,
          conversationHistory: history
        }
      });
    } catch (error) {
      logger.error('Error adding to conversation history:', error);
    }
  }

  /**
   * Clear session (logout)
   */
  async clearSession(userId) {
    try {
      await neo4jService.createOrUpdateSession(userId, {
        sessionId: this.activeSessions.get(userId)?.id || uuidv4(),
        context: {},
        currentState: 'ended',
        currentModuleId: null
      });

      this.activeSessions.delete(userId);
      logger.info(`Session cleared for user ${userId}`);
    } catch (error) {
      logger.error('Error clearing session:', error);
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(userId) {
    try {
      const history = await neo4jService.getSessionHistory(userId, 30);
      const currentSession = await this.getOrCreateSession(userId);

      return {
        currentSession: currentSession,
        totalSessions: history.length,
        lastSession: history[0] || null,
        avgEventsPerSession: history.length > 0
          ? history.reduce((sum, s) => sum + s.events.length, 0) / history.length
          : 0
      };
    } catch (error) {
      logger.error('Error getting session stats:', error);
      return {};
    }
  }
}

module.exports = new SessionManagerService();
