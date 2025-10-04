const chromaService = require('./chroma.service');
const vertexAI = require('./vertexai.service');
const logger = require('../utils/logger');

/**
 * RAG (Retrieval-Augmented Generation) Service
 * Integrates with ChromaDB and Vertex AI for intelligent responses
 */
class RAGService {
  /**
   * Query content using RAG pipeline
   */
  async queryContent(query, options = {}) {
    try {
      const { moduleId, userId, limit = 3 } = options;

      // Build metadata filter
      const metadata = {};
      if (moduleId) {
        metadata.module_id = moduleId;
      }

      // Query ChromaDB for relevant content
      const relevantDocs = await chromaService.searchSimilar(query, {
        module: moduleId ? `module_${moduleId}` : null,
        nResults: limit
      });

      let context = '';
      let sources = [];

      if (relevantDocs && relevantDocs.length > 0) {
        context = relevantDocs.map(doc => doc.content).join('\n\n');
        sources = relevantDocs.map(doc => doc.metadata?.filename || 'Training Content');
        // Remove duplicates
        sources = [...new Set(sources)];
      }

      // Get AI response using educational response generator
      const aiResponse = await vertexAI.generateEducationalResponse(query, context, 'english');

      return {
        answer: aiResponse,
        sources: sources,
        hasContext: relevantDocs.length > 0
      };

    } catch (error) {
      logger.error('Error in RAG query:', error);
      return {
        answer: 'I apologize, but I encountered an error processing your question. Please try again.',
        sources: [],
        hasContext: false
      };
    }
  }

  /**
   * Build prompt for AI with context
   */
  buildPrompt(query, context, moduleId) {
    let prompt = `You are a helpful teaching assistant for a teacher training program.\n\n`;

    if (context) {
      prompt += `CONTEXT FROM TRAINING MATERIALS:\n${context}\n\n`;
    }

    if (moduleId) {
      prompt += `This question is related to Module ${moduleId}.\n\n`;
    }

    prompt += `USER QUESTION: ${query}\n\n`;
    prompt += `Provide a clear, helpful answer based on the training materials${context ? '' : ' and your knowledge of teaching best practices'}. Be concise but informative.`;

    return prompt;
  }
}

module.exports = new RAGService();
