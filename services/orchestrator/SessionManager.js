const { v4: uuidv4 } = require('uuid');

/**
 * SessionManager
 *
 * SOLID Principle: Single Responsibility Principle (SRP)
 * Responsibility: Manage user sessions ONLY
 *
 * Handles session creation, retrieval, updates, and cleanup.
 */
class SessionManager {
  constructor(config, neo4jService, logger) {
    this.config = config;
    this.neo4jService = neo4jService;
    this.logger = logger;
    this.sessions = new Map();
  }

  /**
   * Get existing session or create new one
   * @param {string} phoneNumber - User's phone number
   * @returns {Promise<Object>} - Session object
   */
  async getOrCreate(phoneNumber) {
    if (this.sessions.has(phoneNumber)) {
      this.logger.debug(`Existing session found for ${phoneNumber}`);
      return this.sessions.get(phoneNumber);
    }

    this.logger.info(`Creating new session for phone: ${phoneNumber}`);
    return await this.create(phoneNumber);
  }

  /**
   * Create new session
   * @param {string} phoneNumber - User's phone number
   * @returns {Promise<Object>} - New session object
   */
  async create(phoneNumber) {
    try {
      // Create new user in Neo4j
      const userId = uuidv4();
      this.logger.debug(`Creating user with ID: ${userId}`);

      await this.neo4jService.createUser({
        id: userId,
        phone: phoneNumber,
        name: phoneNumber,
        email: `${phoneNumber}@whatsapp.user`,
        role: 'student'
      });
      this.logger.info(`User created successfully: ${userId}`);

      // Initialize first module
      this.logger.debug('Initializing first module progress...');
      await this.neo4jService.trackUserProgress(userId, 'module_1', {
        status: 'unlocked',
        completion_percentage: 0,
        time_spent: 0
      });
      this.logger.info('Module 1 initialized for user');

      const session = {
        userId,
        phoneNumber,
        context: [],
        currentModule: 'module_1',
        lastActivity: new Date(),
        quizState: null
      };

      this.sessions.set(phoneNumber, session);
      this.logger.info(`Session created for ${phoneNumber}`);

      return session;
    } catch (error) {
      this.logger.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Update session activity
   * @param {string} phoneNumber - User's phone number
   * @param {Object} session - Session object
   */
  update(phoneNumber, session) {
    session.lastActivity = new Date();
    session.context = session.context.slice(-this.config.maxContextMessages);
    this.sessions.set(phoneNumber, session);
  }

  /**
   * Clean up old sessions
   */
  cleanup() {
    const cutoffTime = new Date(Date.now() - this.config.getSessionTTLMs());

    for (const [phone, session] of this.sessions.entries()) {
      if (session.lastActivity < cutoffTime) {
        this.logger.info(`Cleaning up old session for ${phone}`);
        this.sessions.delete(phone);
      }
    }
  }

  /**
   * Get session by phone number
   * @param {string} phoneNumber - User's phone number
   * @returns {Object|null} - Session object or null
   */
  get(phoneNumber) {
    return this.sessions.get(phoneNumber) || null;
  }

  /**
   * Delete session
   * @param {string} phoneNumber - User's phone number
   * @returns {boolean} - True if deleted
   */
  delete(phoneNumber) {
    return this.sessions.delete(phoneNumber);
  }

  /**
   * Get all active sessions
   * @returns {Array} - Array of [phoneNumber, session] pairs
   */
  getAllActiveSessions() {
    return Array.from(this.sessions.entries());
  }

  /**
   * Get active session count
   * @returns {number} - Number of active sessions
   */
  getActiveCount() {
    return this.sessions.size;
  }
}

module.exports = SessionManager;
