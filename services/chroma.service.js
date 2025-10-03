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
      this.client = new ChromaClient({
        path: process.env.CHROMA_URL || 'http://localhost:8000'
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

  async addDocument(content, metadata = {}) {
    try {
      const id = uuidv4();
      const embedding = await this.generateEmbedding(content);
      
      // Validate embedding
      if (!Array.isArray(embedding) || embedding.length !== 768) {
        logger.error(`Invalid embedding dimension: ${embedding?.length || 'undefined'}`);
        throw new Error('Invalid embedding generated');
      }
      
      // Ensure all values are valid numbers
      const validEmbedding = embedding.map(val => {
        if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
          return 0; // Replace invalid values with 0
        }
        return val;
      });

      await this.collection.add({
        ids: [id],
        embeddings: [validEmbedding],
        documents: [content],
        metadatas: [{
          ...metadata,
          id,
          created_at: new Date().toISOString(),
          content_length: content.length
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
      const { nResults = 5, module = null } = options;
      const queryEmbedding = await this.generateEmbedding(query);

      const filter = module ? { module } : undefined;

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
      const results = await this.collection.get({
        where: { module: moduleId },
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