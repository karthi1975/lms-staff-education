const bilingualChroma = require('./bilingual-chroma.service');
const neo4jService = require('./neo4j.service');
const vertexAI = require('./vertexai.service');
const translationService = require('./translation.service');
const logger = require('../utils/logger');

/**
 * Bilingual RAG Service
 * Supports English and Swahili queries with GraphDB integration
 */
class BilingualRAGService {
  /**
   * Query content using bilingual RAG pipeline with GraphDB
   * @param {string} query - User's question
   * @param {Object} options
   * @param {string} options.language - 'english', 'swahili', or 'auto'
   * @param {number} options.courseId - Filter by course
   * @param {number} options.moduleId - Filter by module
   * @param {string} options.userId - User ID for Neo4j tracking
   * @param {number} options.limit - Number of context documents
   * @param {boolean} options.includeGraph - Include Neo4j graph context
   */
  async queryContent(query, options = {}) {
    try {
      const {
        language = 'auto',
        courseId,
        courseName,
        moduleId,
        moduleName,
        userId,
        limit = 3,
        includeGraph = true
      } = options;

      // Detect language if auto
      const queryLanguage = language === 'auto' ?
        bilingualChroma.detectLanguage(query) : language;

      logger.info(`[BilingualRAG] Query: "${query.substring(0, 50)}..." (${queryLanguage})`);

      // Step 1: Vector search in ChromaDB
      const relevantDocs = await bilingualChroma.searchSimilar(query, {
        language: queryLanguage,
        courseId,
        moduleId,
        limit
      });

      // Step 2: Get graph context from Neo4j (optional)
      let graphContext = null;
      if (includeGraph && neo4jService.isConnected() && userId) {
        graphContext = await this.getGraphContext(userId, courseId, moduleId);
      }

      // Step 3: Build context from retrieved documents
      let context = '';
      let sources = [];

      if (relevantDocs && relevantDocs.length > 0) {
        context = relevantDocs.map((doc, i) => {
          const source = doc.metadata?.filename || doc.metadata?.source || 'Training Content';
          const lang = doc.metadata?.language || doc.language;
          return `[Source ${i + 1}: ${source} (${lang})]\n${doc.content}`;
        }).join('\n\n---\n\n');

        sources = relevantDocs.map(doc => ({
          filename: doc.metadata?.filename || 'Unknown',
          language: doc.metadata?.language || doc.language,
          distance: doc.distance?.toFixed(4)
        }));
        // Remove duplicates
        sources = sources.filter((s, i, arr) =>
          arr.findIndex(x => x.filename === s.filename && x.language === s.language) === i
        );
      }

      // Step 4: Add graph context if available
      if (graphContext) {
        context += `\n\n[Learning Path Context]\n${graphContext}`;
      }

      // Step 5: Generate AI response in appropriate language
      const aiResponse = await this.generateBilingualResponse(
        query,
        context,
        queryLanguage,
        { courseId, courseName, moduleId, moduleName }
      );

      // Step 6: Track interaction in Neo4j
      if (neo4jService.isConnected() && userId) {
        await this.trackInteraction(userId, query, aiResponse, {
          language: queryLanguage,
          courseId,
          moduleId,
          sourcesCount: sources.length
        });
      }

      return {
        answer: aiResponse,
        sources: sources,
        hasContext: relevantDocs.length > 0,
        language: queryLanguage,
        graphEnhanced: !!graphContext
      };

    } catch (error) {
      logger.error('[BilingualRAG] Error in query:', error);

      // Return error message in appropriate language
      const errorMsg = language === 'swahili' ?
        'Samahani, nimekutana na hitilafu katika kuchakata swali lako. Tafadhali jaribu tena.' :
        'I apologize, but I encountered an error processing your question. Please try again.';

      return {
        answer: errorMsg,
        sources: [],
        hasContext: false,
        language: language,
        error: error.message
      };
    }
  }

  /**
   * Generate AI response in appropriate language
   */
  async generateBilingualResponse(query, context, language, metadata = {}) {
    try {
      // Use Vertex AI with language-specific prompts
      const prompt = this.buildBilingualPrompt(query, context, language, metadata);

      // Generate response
      const response = await vertexAI.generateEducationalResponse(
        prompt,
        '', // Context already in prompt
        language === 'swahili' ? 'swahili' : 'english'
      );

      return response;

    } catch (error) {
      logger.error('[BilingualRAG] Error generating response:', error);

      // Fallback error message
      return language === 'swahili' ?
        'Samahani, sijaweza kujibu swali lako kwa sasa. Tafadhali jaribu tena.' :
        'I apologize, but I could not generate a response at this time. Please try again.';
    }
  }

  /**
   * Build language-appropriate prompt
   */
  buildBilingualPrompt(query, context, language, metadata = {}) {
    const { courseId, courseName, moduleId, moduleName } = metadata;

    let systemPrompt = '';
    let userPrompt = '';

    if (language === 'swahili') {
      systemPrompt = `Wewe ni msaidizi wa mafunzo wa walimu. Saidia walimu kujifunza na kuboresha ujuzi wao wa kufundisha.\n\n`;

      systemPrompt += `MIONGOZO MUHIMU YA TABIA:
- Wakati watumiaji wanaonyesha shukrani (asante, nashukuru, n.k.), jibu kwa upole na kitaalamu
- Tumia maneno ya heshima kama "Karibu sana!", "Furaha yangu!", "Nimefurahi kukusaidia!"
- Baada ya kukubali shukrani, wakumbushe kuwa uko tayari kusaidia maswali yoyote yanayohusiana na elimu
- Tumia sauti inayounga mkono na kuhamasisha inayoonyesha heshima kwa walimu\n\n`;

      if (context) {
        systemPrompt += `MUKTADHA KUTOKA KWA NYARAKA ZA MAFUNZO:\n${context}\n\n`;
      }

      // Add course and module context
      if (courseName && moduleName) {
        systemPrompt += `MUKTADHA WA KOZI: Wewe unasaidia walimu katika kozi ya "${courseName}".\n`;
        systemPrompt += `MODULI YA SASA: "${moduleName}"\n\n`;
        systemPrompt += `Toa majibu kulingana na maudhui ya kozi hii. Ikiwa mtu anauliza kuhusu kozi au moduli, eleza kwa undani.\n\n`;
      } else if (courseName) {
        systemPrompt += `MUKTADHA WA KOZI: Wewe unasaidia walimu katika kozi ya "${courseName}".\n\n`;
      } else if (moduleName) {
        systemPrompt += `Swali hili linahusiana na "${moduleName}".\n\n`;
      } else if (moduleId) {
        systemPrompt += `Swali hili linahusiana na Moduli ${moduleId}.\n\n`;
      }

      userPrompt = `SWALI LA MWANAFUNZI: ${query}\n\n`;
      userPrompt += `Toa jibu wazi na la kusaidia kulingana na nyaraka za mafunzo. Kuwa mfupi lakini wa taarifa. Jibu kwa Kiswahili. Ikiwa mtumiaji anaonyesha shukrani, jibu kwa upole na kumkumbusha kuwa uko tayari kusaidia maswali yoyote yanayohusiana na elimu.`;

    } else {
      // English
      systemPrompt = `You are a helpful teaching assistant for a teacher training program. Help teachers learn and improve their teaching skills.\n\n`;

      systemPrompt += `IMPORTANT BEHAVIORAL GUIDELINES:
- When users express gratitude (thank you, thanks, etc.), respond warmly and professionally
- Use courteous phrases like "You're welcome!", "My pleasure!", "Happy to help!"
- After acknowledging gratitude, remind them you're available for any education-related questions
- Maintain a supportive, encouraging tone that reflects respect for educators\n\n`;

      if (context) {
        systemPrompt += `CONTEXT FROM TRAINING MATERIALS:\n${context}\n\n`;
      }

      // Add course and module context
      if (courseName && moduleName) {
        systemPrompt += `COURSE CONTEXT: You are helping teachers with the course "${courseName}".\n`;
        systemPrompt += `CURRENT MODULE: "${moduleName}"\n\n`;
        systemPrompt += `IMPORTANT: When asked about the course or module itself, explain what it covers based on the training materials provided. The materials you have ARE the content of this course.\n\n`;
      } else if (courseName) {
        systemPrompt += `COURSE CONTEXT: You are helping teachers with the course "${courseName}".\n`;
        systemPrompt += `IMPORTANT: When asked about this course, explain what it covers based on the training materials. The materials you have ARE the content of this course.\n\n`;
      } else if (moduleName) {
        systemPrompt += `This question is related to "${moduleName}".\n\n`;
      } else if (moduleId) {
        systemPrompt += `This question is related to Module ${moduleId}.\n\n`;
      }

      userPrompt = `USER QUESTION: ${query}\n\n`;
      userPrompt += `Provide a clear, helpful answer based on the training materials. Be concise but informative. Respond in English. If the user is expressing gratitude, respond warmly and remind them you're available for any education-related questions.`;
    }

    return systemPrompt + userPrompt;
  }

  /**
   * Get learning path context from Neo4j
   */
  async getGraphContext(userId, courseId, moduleId) {
    try {
      if (!neo4jService.isConnected()) {
        return null;
      }

      // Get user's learning progress
      const progress = await neo4jService.getUserModuleProgress(userId, courseId);

      if (!progress || progress.length === 0) {
        return null;
      }

      // Build context string
      const completedModules = progress.filter(p => p.status === 'completed');
      const currentModule = progress.find(p => p.moduleId === moduleId);

      let contextParts = [];

      if (completedModules.length > 0) {
        contextParts.push(
          `Completed modules: ${completedModules.map(p => p.moduleName || `Module ${p.moduleId}`).join(', ')}`
        );
      }

      if (currentModule) {
        contextParts.push(
          `Current module: ${currentModule.moduleName || `Module ${moduleId}`} (${currentModule.status})`
        );
      }

      return contextParts.length > 0 ? contextParts.join('\n') : null;

    } catch (error) {
      logger.error('[BilingualRAG] Error getting graph context:', error);
      return null;
    }
  }

  /**
   * Track user interaction in Neo4j graph
   */
  async trackInteraction(userId, query, response, metadata = {}) {
    try {
      if (!neo4jService.isConnected()) {
        return;
      }

      const { language, courseId, moduleId, sourcesCount } = metadata;

      // Create interaction node
      await neo4jService.createInteraction({
        userId,
        query,
        response,
        language,
        courseId,
        moduleId,
        sourcesCount,
        timestamp: new Date().toISOString()
      });

      logger.info(`[BilingualRAG] Tracked interaction for user ${userId} (${language})`);

    } catch (error) {
      logger.error('[BilingualRAG] Error tracking interaction:', error);
      // Don't throw - tracking is non-critical
    }
  }

  /**
   * Add document to bilingual RAG system
   * @param {Object} params
   * @param {string} params.content - Document content
   * @param {string} params.language - 'english', 'swahili', or 'auto'
   * @param {number} params.courseId - Course ID
   * @param {number} params.moduleId - Module ID
   * @param {Object} params.metadata - Additional metadata
   */
  async addDocument(params) {
    try {
      const {
        content,
        language = 'auto',
        courseId,
        moduleId,
        metadata = {}
      } = params;

      // Add to ChromaDB
      const chromaResult = await bilingualChroma.addDocument({
        content,
        language,
        courseId,
        moduleId,
        metadata
      });

      // Add to Neo4j graph if connected
      if (neo4jService.isConnected() && courseId) {
        await this.addToGraph({
          documentId: chromaResult.id,
          courseId,
          moduleId,
          language: chromaResult.language,
          metadata: {
            ...metadata,
            collection: chromaResult.collection
          }
        });
      }

      logger.info(`[BilingualRAG] Document added: ${chromaResult.id} (${chromaResult.language})`);

      return chromaResult;

    } catch (error) {
      logger.error('[BilingualRAG] Error adding document:', error);
      throw error;
    }
  }

  /**
   * Add document to Neo4j knowledge graph
   */
  async addToGraph({ documentId, courseId, moduleId, language, metadata }) {
    try {
      if (!neo4jService.isConnected()) {
        return;
      }

      // Create document node with language metadata
      await neo4jService.createDocument({
        id: documentId,
        courseId,
        moduleId,
        language,
        filename: metadata.filename,
        source: metadata.source,
        contentType: metadata.content_type,
        createdAt: new Date().toISOString()
      });

      logger.info(`[BilingualRAG] Added document to graph: ${documentId}`);

    } catch (error) {
      logger.error('[BilingualRAG] Error adding to graph:', error);
      // Don't throw - graph is supplementary
    }
  }

  /**
   * Get statistics for bilingual collections
   */
  async getStats() {
    try {
      const chromaStats = await bilingualChroma.getStats();

      return {
        chroma: chromaStats,
        neo4j: {
          connected: neo4jService.isConnected()
        }
      };

    } catch (error) {
      logger.error('[BilingualRAG] Error getting stats:', error);
      return { error: error.message };
    }
  }
}

module.exports = new BilingualRAGService();
