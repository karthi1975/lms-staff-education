const { ChromaClient } = require('chromadb');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const embeddingService = require('./embedding.service');

/**
 * Bilingual ChromaDB Service
 * Manages separate collections for English and Swahili content
 * Supports OCR-extracted documents
 */
class BilingualChromaService {
  constructor() {
    this.client = null;
    this.collections = {
      english: null,
      swahili: null,
      mixed: null // For bilingual documents
    };
    this.connected = false;
    this.reconnecting = false;
  }

  async initialize() {
    const MAX_RETRIES = 5;
    const RETRY_DELAY_BASE = 2000;
    let retries = 0;

    while (retries < MAX_RETRIES) {
      try {
        const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';
        logger.info(`[BilingualChroma] Connecting to ChromaDB at: ${chromaUrl} (attempt ${retries + 1}/${MAX_RETRIES})`);

        this.client = new ChromaClient({
          path: chromaUrl
        });

        // Initialize all three collections
        await this.initializeCollection('english', 'English language training content');
        await this.initializeCollection('swahili', 'Swahili language training content (Mafunzo kwa Kiswahili)');
        await this.initializeCollection('mixed', 'Bilingual content (English/Swahili)');

        this.connected = true;
        logger.info('✅ [BilingualChroma] All language collections initialized successfully');
        return;

      } catch (error) {
        retries++;
        logger.error(`[BilingualChroma] Connection attempt ${retries}/${MAX_RETRIES} failed:`, error.message);

        if (retries < MAX_RETRIES) {
          const delay = RETRY_DELAY_BASE * Math.pow(2, retries - 1);
          logger.info(`Retrying in ${delay / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          logger.error('⚠️  [BilingualChroma] Unavailable after all retries - running in DEGRADED MODE');
          this.connected = false;
          return;
        }
      }
    }
  }

  async initializeCollection(language, description) {
    const collectionName = `teachers_training_${language}`;

    try {
      // Try to get existing collection
      this.collections[language] = await this.client.getCollection({
        name: collectionName
      });
      logger.info(`✅ Using existing ${language} collection`);
    } catch (err) {
      // Create new collection
      logger.info(`Creating new ${language} collection...`);
      this.collections[language] = await this.client.createCollection({
        name: collectionName,
        metadata: {
          description: description,
          language: language,
          created_at: new Date().toISOString(),
          embedding_dimension: 768
        }
      });
      logger.info(`✅ Created ${language} collection`);
    }
  }

  isConnected() {
    return this.connected && this.client &&
           this.collections.english &&
           this.collections.swahili;
  }

  /**
   * Detect language of text
   * Simple heuristic: Check for Swahili markers
   */
  detectLanguage(text) {
    const swahiliMarkers = [
      // Common Swahili words
      'ni', 'na', 'wa', 'ya', 'kwa', 'katika', 'au', 'lakini',
      'pia', 'zaidi', 'kutoka', 'hadi', 'pamoja', 'bila',
      // Swahili verbs
      'kuwa', 'kufanya', 'kupata', 'kwenda', 'kuja', 'kusoma',
      // Common phrases
      'habari', 'asante', 'tafadhali', 'karibu', 'ndiyo', 'hapana',
      'mwalimu', 'wanafunzi', 'shule', 'elimu', 'mafunzo'
    ];

    const words = text.toLowerCase().split(/\s+/);
    const swahiliCount = words.filter(word =>
      swahiliMarkers.includes(word)
    ).length;

    const swahiliRatio = swahiliCount / Math.max(words.length, 1);

    // If more than 10% Swahili markers, consider it Swahili or mixed
    if (swahiliRatio > 0.15) return 'swahili';
    if (swahiliRatio > 0.05) return 'mixed';
    return 'english';
  }

  /**
   * Add document to appropriate collection based on language
   * @param {Object} params
   * @param {string} params.content - Document text content
   * @param {string} params.language - 'english', 'swahili', or 'mixed' (auto-detect if not provided)
   * @param {Object} params.metadata - Document metadata
   * @param {Array} params.embedding - Pre-computed embedding (optional)
   * @param {number} params.courseId - Course ID
   * @param {number} params.moduleId - Module ID (optional)
   */
  async addDocument({ content, language, metadata = {}, embedding, courseId, moduleId }) {
    try {
      if (!this.isConnected()) {
        throw new Error('BilingualChroma not connected');
      }

      // Auto-detect language if not provided
      const detectedLanguage = language || this.detectLanguage(content);

      const id = uuidv4();

      // Generate embedding if not provided
      let finalEmbedding = embedding;
      if (!finalEmbedding || !Array.isArray(finalEmbedding)) {
        finalEmbedding = await embeddingService.generateEmbeddings(content);
      }

      // Validate embedding
      if (!Array.isArray(finalEmbedding) || finalEmbedding.length !== 768) {
        throw new Error(`Invalid embedding dimension: ${finalEmbedding?.length || 'undefined'}`);
      }

      // Enhance metadata with language info
      const enhancedMetadata = {
        ...metadata,
        language: detectedLanguage,
        course_id: courseId ? String(courseId) : undefined,
        module_id: moduleId ? String(moduleId) : undefined,
        content_length: String(content.length),
        added_at: new Date().toISOString()
      };

      // Add to appropriate collection
      const collection = this.collections[detectedLanguage];
      if (!collection) {
        throw new Error(`Collection for language '${detectedLanguage}' not initialized`);
      }

      await collection.add({
        ids: [id],
        embeddings: [finalEmbedding],
        documents: [content],
        metadatas: [enhancedMetadata]
      });

      logger.info(`✅ Added document to ${detectedLanguage} collection: ${id} (${content.length} chars)`);

      return {
        id,
        language: detectedLanguage,
        collection: collection.name,
        content_length: content.length
      };

    } catch (error) {
      logger.error('[BilingualChroma] Error adding document:', error);
      throw error;
    }
  }

  /**
   * Search for similar content in appropriate language collection
   * @param {string} query - Search query
   * @param {Object} options
   * @param {string} options.language - 'english', 'swahili', 'mixed', or 'auto'
   * @param {number} options.courseId - Filter by course
   * @param {number} options.moduleId - Filter by module
   * @param {number} options.limit - Number of results
   */
  async searchSimilar(query, options = {}) {
    try {
      if (!this.isConnected()) {
        logger.warn('[BilingualChroma] Not connected - returning empty results');
        return [];
      }

      const {
        language = 'auto',
        courseId,
        moduleId,
        limit = 3
      } = options;

      // Auto-detect query language
      const queryLanguage = language === 'auto' ? this.detectLanguage(query) : language;

      // Generate query embedding
      const queryEmbedding = await embeddingService.generateEmbeddings(query);

      // Build metadata filter
      const where = {};
      if (courseId) where.course_id = String(courseId);
      if (moduleId) where.module_id = String(moduleId);

      // Search in appropriate collection(s)
      let results = [];

      if (queryLanguage === 'mixed') {
        // Search in all collections for mixed queries
        const [englishResults, swahiliResults, mixedResults] = await Promise.all([
          this.searchInCollection('english', queryEmbedding, where, limit),
          this.searchInCollection('swahili', queryEmbedding, where, limit),
          this.searchInCollection('mixed', queryEmbedding, where, limit)
        ]);

        // Combine and sort by distance
        results = [...englishResults, ...swahiliResults, ...mixedResults]
          .sort((a, b) => a.distance - b.distance)
          .slice(0, limit);
      } else {
        // Search in specific language collection
        results = await this.searchInCollection(queryLanguage, queryEmbedding, where, limit);
      }

      logger.info(`[BilingualChroma] Found ${results.length} results for query in ${queryLanguage}`);
      return results;

    } catch (error) {
      logger.error('[BilingualChroma] Search error:', error);
      return [];
    }
  }

  async searchInCollection(language, queryEmbedding, where, limit) {
    try {
      const collection = this.collections[language];
      if (!collection) {
        return [];
      }

      const whereClause = Object.keys(where).length > 0 ? where : undefined;

      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        where: whereClause
      });

      if (!results || !results.documents || !results.documents[0]) {
        return [];
      }

      // Format results
      return results.documents[0].map((doc, i) => ({
        content: doc,
        metadata: results.metadatas[0][i],
        distance: results.distances[0][i],
        language: language,
        id: results.ids[0][i]
      }));

    } catch (error) {
      logger.error(`[BilingualChroma] Error searching ${language} collection:`, error.message);
      return [];
    }
  }

  /**
   * Get collection statistics
   */
  async getStats() {
    try {
      const stats = {};

      for (const [lang, collection] of Object.entries(this.collections)) {
        if (collection) {
          try {
            const count = await collection.count();
            stats[lang] = {
              count,
              name: collection.name
            };
          } catch (error) {
            stats[lang] = { count: 0, error: error.message };
          }
        }
      }

      return stats;
    } catch (error) {
      logger.error('[BilingualChroma] Error getting stats:', error);
      return {};
    }
  }

  /**
   * Clear all documents from a collection (for testing)
   */
  async clearCollection(language) {
    try {
      if (!this.collections[language]) {
        throw new Error(`Collection for language '${language}' not found`);
      }

      // Delete and recreate collection
      await this.client.deleteCollection({ name: `teachers_training_${language}` });
      await this.initializeCollection(
        language,
        language === 'english' ? 'English language training content' :
        language === 'swahili' ? 'Swahili language training content (Mafunzo kwa Kiswahili)' :
        'Bilingual content (English/Swahili)'
      );

      logger.info(`✅ Cleared ${language} collection`);
    } catch (error) {
      logger.error(`[BilingualChroma] Error clearing ${language} collection:`, error);
      throw error;
    }
  }

  /**
   * Delete all documents for a specific module across all language collections
   * @param {number} moduleId - Module ID to delete
   */
  async deleteByModule(moduleId) {
    try {
      if (!this.isConnected()) {
        logger.warn('[BilingualChroma] Not connected - skipping module deletion');
        return;
      }

      let totalDeleted = 0;

      // Delete from all language collections
      for (const [language, collection] of Object.entries(this.collections)) {
        if (!collection) continue;

        try {
          // Query for documents with this module_id
          const results = await collection.get({
            where: { module_id: String(moduleId) }
          });

          if (results && results.ids && results.ids.length > 0) {
            // Delete the documents
            await collection.delete({
              ids: results.ids
            });

            totalDeleted += results.ids.length;
            logger.info(`[BilingualChroma] Deleted ${results.ids.length} documents from ${language} collection for module ${moduleId}`);
          }
        } catch (collectionError) {
          logger.warn(`[BilingualChroma] Error deleting from ${language} collection:`, collectionError.message);
        }
      }

      logger.info(`[BilingualChroma] ✅ Deleted ${totalDeleted} total documents for module ${moduleId}`);
      return totalDeleted;

    } catch (error) {
      logger.error('[BilingualChroma] Error in deleteByModule:', error);
      throw error;
    }
  }
}

module.exports = new BilingualChromaService();
