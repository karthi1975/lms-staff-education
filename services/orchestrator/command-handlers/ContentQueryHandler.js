const BaseCommandHandler = require('./BaseCommandHandler');
const coachingModeService = require('../../coaching/coaching-mode.service');

/**
 * ContentQueryHandler
 *
 * SOLID Principles:
 * - SRP: Handles content queries (RAG) ONLY
 * - OCP: Extends BaseCommandHandler without modification
 * - LSP: Can be substituted for BaseCommandHandler
 *
 * Default handler for general questions using RAG pipeline.
 * Now includes coaching mode awareness for personalized responses.
 */
class ContentQueryHandler extends BaseCommandHandler {
  constructor(dependencies) {
    super();
    this.config = dependencies.config;
    this.logger = dependencies.logger;
    this.chromaService = dependencies.chromaService;
    this.vertexAIService = dependencies.vertexAIService;
    this.neo4jService = dependencies.neo4jService;
    this.initialized = false;
  }

  async initialize() {
    if (!this.initialized) {
      await coachingModeService.initialize();
      this.initialized = true;
    }
  }

  canHandle(input, session) {
    // This is the default handler - handles anything not handled by others
    return true;
  }

  async handle(userId, input, userProgress, session) {
    const currentModule = session.currentModule;
    const language = this.config.defaultLanguage;

    try {
      await this.initialize();

      this.logger.info(`Processing content query: "${input}" for module: ${currentModule}`);

      // Get user's current course
      const courseId = await this.getUserCurrentCourse(userId);

      // Get mode-specific prompt
      let modePrompt = null;
      let mode = 'regular'; // default
      if (courseId) {
        try {
          modePrompt = await coachingModeService.getModePrompt(userId, courseId);
          mode = modePrompt ? modePrompt.mode : 'regular';
          this.logger.info(`Using ${mode} mode for response generation`);
        } catch (error) {
          this.logger.warn('Could not get mode prompt, using default:', error.message);
        }
      }

      // Search relevant content
      this.logger.debug('Searching ChromaDB for similar content...');
      const searchResults = await this.chromaService.searchSimilar(input, {
        module: currentModule,
        nResults: 3
      });
      this.logger.info(`Found ${searchResults.length} relevant documents`);

      // Build context from search results
      const context = searchResults.map(r => r.content).join('\n\n---\n\n');
      this.logger.debug(`Context length: ${context.length} characters`);

      // Generate response using Vertex AI with mode-specific prompt
      this.logger.debug(`Generating response with Vertex AI in ${language} using ${mode} mode...`);

      // Add mode-specific system instruction if available
      const systemInstruction = modePrompt ? modePrompt.prompt : null;

      const response = await this.vertexAIService.generateEducationalResponse(
        input,
        context,
        language,
        systemInstruction // Pass mode-specific instruction
      );
      this.logger.info(`Generated response length: ${response.length} characters`);

      // Track interaction with mode info
      this.logger.debug('Tracking content interaction...');
      await this.neo4jService.trackContentInteraction(userId, 'content_query', 'query', {
        mode: mode
      });

      // Log session message if session exists
      if (courseId) {
        try {
          const activeSession = await coachingModeService.getActiveSession(userId, courseId);
          if (activeSession) {
            // Check if response contains questions (for Socratic mode tracking)
            const hasQuestions = (response.match(/\?/g) || []).length > 0;
            await coachingModeService.logSessionMessage(activeSession.id, hasQuestions);
          }
        } catch (error) {
          this.logger.warn('Could not log session message:', error.message);
        }
      }

      return {
        type: 'text',
        content: response
      };
    } catch (error) {
      this.logger.error('Error processing content query:', error);
      return {
        type: 'text',
        content: "I couldn't find relevant information. Try asking differently or type 'help' for options."
      };
    }
  }

  /**
   * Get user's current course
   * @param {number} userId - User ID
   * @returns {Promise<number|null>} - Course ID or null
   */
  async getUserCurrentCourse(userId) {
    try {
      // Get from Neo4j
      const userProgress = await this.neo4jService.getUserLearningPath(userId);
      if (userProgress && userProgress.courses && userProgress.courses.length > 0) {
        return userProgress.courses[0].id;
      }

      // Fallback: Query PostgreSQL for enrollments
      const postgresService = require('../../database/postgres.service');
      const query = `
        SELECT course_id FROM course_enrollments
        WHERE user_id = $1
        ORDER BY enrolled_at DESC
        LIMIT 1
      `;
      const result = await postgresService.query(query, [userId]);

      if (result.rows.length > 0) {
        return result.rows[0].course_id;
      }

      return null;
    } catch (error) {
      this.logger.error('Error getting user current course:', error);
      return null;
    }
  }
}

module.exports = ContentQueryHandler;
