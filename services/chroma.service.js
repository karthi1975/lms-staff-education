const { ChromaClient } = require('chromadb');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const embeddingService = require('./embedding.service');

class ChromaService {
  constructor() {
    this.client = null;
    this.collection = null;
  }

  async initialize() {
    try {
      // Initialize ChromaDB client
      // Use localhost for scripts running outside Docker, chromadb hostname for inside Docker
      const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';

      logger.info(`Connecting to ChromaDB at: ${chromaUrl}`);

      this.client = new ChromaClient({
        path: chromaUrl
      });

      // Try to get existing collection first
      try {
        this.collection = await this.client.getCollection({
          name: 'teachers_training'
        });
        logger.info('Using existing ChromaDB collection');
      } catch (err) {
        // Collection doesn't exist, create it
        this.collection = await this.client.createCollection({
          name: 'teachers_training',
          metadata: {
            description: 'Educational content for teachers training',
            created_at: new Date().toISOString(),
            embedding_dimension: 768
          }
        });
        logger.info('Created new ChromaDB collection');
      }

      logger.info('ChromaDB initialized successfully');
    } catch (error) {
      logger.error('ChromaDB initialization failed:', error);
      throw error;
    }
  }

  // Use production-ready embeddings from embedding service
  async generateEmbedding(text) {
    try {
      return await embeddingService.generateEmbeddings(text);
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  async addDocument(moduleIdOrContent, contentOrEmbedding, embeddingOrMetadata, metadataOptional) {
    try {
      // Handle both old signature (content, metadata) and new signature (moduleId, content, embedding, metadata)
      let content, embedding, metadata;

      if (arguments.length === 2 && typeof arguments[1] === 'object' && !Array.isArray(arguments[1])) {
        // Old signature: addDocument(content, metadata)
        content = moduleIdOrContent;
        embedding = null;
        metadata = contentOrEmbedding;
      } else if (arguments.length >= 3) {
        // New signature: addDocument(moduleId, content, embedding, metadata)
        // moduleId is ignored (it's in metadata)
        content = contentOrEmbedding;
        embedding = embeddingOrMetadata;
        metadata = metadataOptional || {};
      } else {
        content = moduleIdOrContent;
        embedding = null;
        metadata = {};
      }

      const id = uuidv4();

      // If embedding not provided, generate it
      let finalEmbedding = embedding;
      if (!finalEmbedding || !Array.isArray(finalEmbedding)) {
        finalEmbedding = await this.generateEmbedding(content);
      }

      // Validate embedding
      if (!Array.isArray(finalEmbedding) || finalEmbedding.length !== 768) {
        logger.error(`Invalid embedding dimension: ${finalEmbedding?.length || 'undefined'}`);
        throw new Error('Invalid embedding generated');
      }

      // Ensure all values are valid numbers
      const validEmbedding = finalEmbedding.map(val => {
        if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
          return 0; // Replace invalid values with 0
        }
        return val;
      });

      // Ensure content is a string
      const contentStr = typeof content === 'string' ? content : String(content || '');

      await this.collection.add({
        ids: [id],
        embeddings: [validEmbedding],
        documents: [contentStr],
        metadatas: [{
          ...metadata,
          id,
          created_at: new Date().toISOString(),
          content_length: contentStr.length
        }]
      });

      logger.info(`Document added to ChromaDB: ${id}`);
      return id;
    } catch (error) {
      logger.error('Error adding document:', error.message);
      logger.error('Full error:', error);
      throw error;
    }
  }

  async addBulkDocuments(documents) {
    try {
      const ids = documents.map(() => uuidv4());
      // Generate embeddings in batch for better performance
      const contents = documents.map(doc => doc.content);
      const embeddings = await embeddingService.generateEmbeddings(contents);
      const metadatas = documents.map((doc, index) => ({
        ...doc.metadata,
        id: ids[index],
        created_at: new Date().toISOString()
      }));

      await this.collection.add({
        ids,
        embeddings,
        documents: contents,
        metadatas
      });

      logger.info(`Added ${documents.length} documents to ChromaDB`);
      return ids;
    } catch (error) {
      logger.error('Error adding bulk documents:', error);
      throw error;
    }
  }

  async searchSimilar(query, options = {}) {
    try {
      const { nResults = 5, module = null, module_id = null } = options;
      const queryEmbedding = await this.generateEmbedding(query);

      // Support both 'module' (legacy string like 'module_1') and 'module_id' (integer like 1)
      let filter = undefined;
      if (module_id !== null) {
        filter = { module_id: parseInt(module_id) };
      } else if (module) {
        // Try to extract module ID from string like 'module_1' -> 1
        const match = String(module).match(/module[_-]?(\d+)/i);
        if (match) {
          filter = { module_id: parseInt(match[1]) };
        } else {
          // Fallback to old behavior for backward compatibility
          filter = { module };
        }
      }

      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults,
        where: filter
      });

      return results.ids[0].map((id, index) => ({
        id,
        content: results.documents[0][index],
        metadata: results.metadatas[0][index],
        distance: results.distances[0][index]
      }));
    } catch (error) {
      logger.error('Search error:', error);
      throw error;
    }
  }

  async getDocumentsByModule(moduleId, limit = 10) {
    try {
      // Support both integer module_id and string 'module_X' format
      let whereClause;
      if (typeof moduleId === 'number') {
        whereClause = { module_id: moduleId };
      } else if (typeof moduleId === 'string') {
        const match = moduleId.match(/module[_-]?(\d+)/i);
        if (match) {
          whereClause = { module_id: parseInt(match[1]) };
        } else {
          whereClause = { module: moduleId };
        }
      } else {
        whereClause = { module_id: parseInt(moduleId) };
      }

      const results = await this.collection.get({
        where: whereClause,
        limit
      });

      return results.ids.map((id, index) => ({
        id,
        content: results.documents[index],
        metadata: results.metadatas[index]
      }));
    } catch (error) {
      logger.error('Error getting documents by module:', error);
      return [];
    }
  }

  async deleteDocument(documentId) {
    try {
      await this.collection.delete({ ids: [documentId] });
      logger.info(`Document deleted: ${documentId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Delete all documents matching metadata filter
   */
  async deleteByMetadata(whereFilter) {
    try {
      await this.collection.delete({
        where: whereFilter
      });
      logger.info(`Documents deleted with filter:`, whereFilter);
      return true;
    } catch (error) {
      logger.error('Error deleting documents by metadata:', error);
      throw error;
    }
  }

  /**
   * Delete all documents for a specific module
   */
  async deleteByModule(moduleId) {
    try {
      // Support both integer module_id and string 'module_X' format
      let whereClause;
      if (typeof moduleId === 'number') {
        whereClause = { module_id: moduleId };
      } else if (typeof moduleId === 'string') {
        const match = moduleId.match(/module[_-]?(\d+)/i);
        if (match) {
          whereClause = { module_id: parseInt(match[1]) };
        } else {
          whereClause = { module: moduleId };
        }
      } else {
        whereClause = { module_id: parseInt(moduleId) };
      }

      await this.collection.delete({
        where: whereClause
      });
      logger.info(`Documents deleted for module ${moduleId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting documents by module:', error);
      throw error;
    }
  }

  async getStats() {
    try {
      const count = await this.collection.count();
      return { total_documents: count };
    } catch (error) {
      logger.error('Error getting stats:', error);
      return { total_documents: 0 };
    }
  }
}

module.exports = new ChromaService();