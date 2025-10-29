const BaseCommandHandler = require('./BaseCommandHandler');

/**
 * ContentQueryHandler
 *
 * SOLID Principles:
 * - SRP: Handles content queries (RAG) ONLY
 * - OCP: Extends BaseCommandHandler without modification
 * - LSP: Can be substituted for BaseCommandHandler
 *
 * Default handler for general questions using RAG pipeline.
 */
class ContentQueryHandler extends BaseCommandHandler {
  canHandle(input, session) {
    // This is the default handler - handles anything not handled by others
    return true;
  }

  async handle(userId, input, userProgress, session) {
    const currentModule = session.currentModule;
    const language = this.config.defaultLanguage;

    try {
      this.logger.info(`Processing content query: "${input}" for module: ${currentModule}`);

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

      // Generate response using Vertex AI
      this.logger.debug(`Generating response with Vertex AI in ${language}...`);
      const response = await this.vertexAIService.generateEducationalResponse(
        input,
        context,
        language
      );
      this.logger.info(`Generated response length: ${response.length} characters`);

      // Track interaction
      this.logger.debug('Tracking content interaction...');
      await this.neo4jService.trackContentInteraction(userId, 'content_query', 'query');

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
}

module.exports = ContentQueryHandler;
