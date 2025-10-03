/**
 * Session Management Service
 * Handles user session lifecycle and context preservation
 */

const SessionModel = require('../../models/session.model');
const UserModel = require('../../models/user.model');
const logger = require('../../utils/logger');

class SessionService {
  /**
   * Create or retrieve a session for a WhatsApp user
   */
  static async getOrCreateSession(whatsapp_id, context = {}) {
    try {
      // Get user first
      const user = await UserModel.findByWhatsAppId(whatsapp_id);
      
      if (!user) {
        throw new Error('User not found. Please identify user first.');
      }

      // Check for existing active session
      let session = await SessionModel.getActiveSession(user.id);
      
      if (session) {
        // Update session activity
        await SessionModel.updateActivity(session.id);
        
        // Merge new context with existing
        if (Object.keys(context).length > 0) {
          const mergedContext = {
            ...session.context,
            ...context,
            updated_at: new Date().toISOString()
          };
          
          session = await SessionModel.updateContext(session.id, mergedContext);
        }
        
        logger.info(`Existing session retrieved for user ${user.id}`);
      } else {
        // Create new session
        const sessionData = {
          user_id: user.id,
          context: {
            module_id: user.current_module_id,
            conversation_history: [],
            quiz_state: null,
            created_at: new Date().toISOString(),
            ...context
          }
        };
        
        session = await SessionModel.create(sessionData);
        logger.info(`New session created for user ${user.id}`);
      }

      return {
        session_id: session.id,
        user_id: session.user_id,
        context: session.context,
        expires_at: session.expires_at,
        is_new: !session.last_activity || 
               (new Date() - new Date(session.last_activity)) > 3600000 // New if inactive > 1 hour
      };
    } catch (error) {
      logger.error('Get/create session error:', error);
      throw error;
    }
  }

  /**
   * Update session context
   */
  static async updateSessionContext(sessionId, updates) {
    try {
      const session = await SessionModel.findById(sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }

      // Check if session is still active
      if (!SessionModel.isActive(session)) {
        throw new Error('Session has expired');
      }

      // Merge context updates
      const updatedContext = {
        ...session.context,
        ...updates,
        last_updated: new Date().toISOString()
      };

      const updatedSession = await SessionModel.updateContext(sessionId, updatedContext);
      
      logger.info(`Session ${sessionId} context updated`);
      
      return updatedSession;
    } catch (error) {
      logger.error('Update session context error:', error);
      throw error;
    }
  }

  /**
   * Add message to conversation history
   */
  static async addToConversation(sessionId, message, response) {
    try {
      const session = await SessionModel.findById(sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }

      // Initialize conversation history if not exists
      if (!session.context.conversation_history) {
        session.context.conversation_history = [];
      }

      // Add new exchange
      const exchange = {
        timestamp: new Date().toISOString(),
        user_message: message,
        assistant_response: response
      };

      // Keep only last 20 exchanges
      const conversationHistory = [
        ...session.context.conversation_history.slice(-19),
        exchange
      ];

      // Update context
      const updatedContext = {
        ...session.context,
        conversation_history: conversationHistory,
        last_interaction: new Date().toISOString()
      };

      await SessionModel.updateContext(sessionId, updatedContext);
      
      logger.info(`Conversation updated for session ${sessionId}`);
      
      return true;
    } catch (error) {
      logger.error('Add to conversation error:', error);
      return false;
    }
  }

  /**
   * Save quiz state in session
   */
  static async saveQuizState(sessionId, quizState) {
    try {
      const session = await SessionModel.findById(sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }

      const updatedContext = {
        ...session.context,
        quiz_state: {
          ...quizState,
          saved_at: new Date().toISOString()
        }
      };

      await SessionModel.updateContext(sessionId, updatedContext);
      
      logger.info(`Quiz state saved for session ${sessionId}`);
      
      return true;
    } catch (error) {
      logger.error('Save quiz state error:', error);
      throw error;
    }
  }

  /**
   * Get quiz state from session
   */
  static async getQuizState(sessionId) {
    try {
      const session = await SessionModel.findById(sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }

      return session.context.quiz_state || null;
    } catch (error) {
      logger.error('Get quiz state error:', error);
      throw error;
    }
  }

  /**
   * Clear quiz state
   */
  static async clearQuizState(sessionId) {
    try {
      const session = await SessionModel.findById(sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }

      const updatedContext = {
        ...session.context,
        quiz_state: null,
        quiz_completed_at: new Date().toISOString()
      };

      await SessionModel.updateContext(sessionId, updatedContext);
      
      logger.info(`Quiz state cleared for session ${sessionId}`);
      
      return true;
    } catch (error) {
      logger.error('Clear quiz state error:', error);
      return false;
    }
  }

  /**
   * End a session
   */
  static async endSession(sessionId) {
    try {
      const session = await SessionModel.end(sessionId);
      
      if (session) {
        logger.info(`Session ${sessionId} ended`);
        
        // Update user's last session time
        await UserModel.updateMetadata(session.user_id, {
          last_session_ended: new Date().toISOString()
        });
      }
      
      return session;
    } catch (error) {
      logger.error('End session error:', error);
      throw error;
    }
  }

  /**
   * Get session by ID
   */
  static async getSession(sessionId) {
    try {
      const session = await SessionModel.findById(sessionId);
      
      if (!session) {
        return null;
      }

      // Check if still active
      const isActive = SessionModel.isActive(session);
      
      return {
        ...session,
        is_active: isActive
      };
    } catch (error) {
      logger.error('Get session error:', error);
      throw error;
    }
  }

  /**
   * Get all active sessions
   */
  static async getActiveSessions() {
    try {
      const sessions = await SessionModel.getActiveSessions();
      
      logger.info(`Found ${sessions.length} active sessions`);
      
      return sessions;
    } catch (error) {
      logger.error('Get active sessions error:', error);
      throw error;
    }
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpiredSessions() {
    try {
      const count = await SessionModel.cleanupExpired();
      
      logger.info(`Cleaned up ${count} expired sessions`);
      
      return count;
    } catch (error) {
      logger.error('Cleanup expired sessions error:', error);
      throw error;
    }
  }

  /**
   * Get user's session history
   */
  static async getUserSessionHistory(userId, limit = 10) {
    try {
      const sessions = await SessionModel.getUserSessions(userId, limit);
      
      // Calculate session statistics
      const stats = {
        total_sessions: sessions.length,
        active_session: null,
        recent_sessions: [],
        average_duration: 0
      };

      let totalDuration = 0;
      
      sessions.forEach(session => {
        if (SessionModel.isActive(session)) {
          stats.active_session = session;
        }
        
        // Calculate duration
        const start = new Date(session.created_at);
        const end = session.ended_at ? new Date(session.ended_at) : new Date();
        const duration = (end - start) / 1000 / 60; // Duration in minutes
        
        totalDuration += duration;
        
        stats.recent_sessions.push({
          id: session.id,
          started_at: session.created_at,
          ended_at: session.ended_at,
          duration_minutes: Math.round(duration),
          context_summary: {
            module_id: session.context?.module_id,
            quiz_attempted: !!session.context?.quiz_state,
            messages_count: session.context?.conversation_history?.length || 0
          }
        });
      });

      if (sessions.length > 0) {
        stats.average_duration = Math.round(totalDuration / sessions.length);
      }

      return stats;
    } catch (error) {
      logger.error('Get user session history error:', error);
      throw error;
    }
  }

  /**
   * Transfer session context to new session
   */
  static async transferSession(oldSessionId, newUserId) {
    try {
      const oldSession = await SessionModel.findById(oldSessionId);
      
      if (!oldSession) {
        throw new Error('Original session not found');
      }

      // Create new session with transferred context
      const newSessionData = {
        user_id: newUserId,
        context: {
          ...oldSession.context,
          transferred_from: oldSessionId,
          transferred_at: new Date().toISOString()
        }
      };

      const newSession = await SessionModel.create(newSessionData);
      
      // End old session
      await SessionModel.end(oldSessionId);
      
      logger.info(`Session transferred from ${oldSessionId} to new session ${newSession.id}`);
      
      return newSession;
    } catch (error) {
      logger.error('Transfer session error:', error);
      throw error;
    }
  }
}

module.exports = SessionService;