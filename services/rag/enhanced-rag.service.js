/**
 * Enhanced RAG Service
 * Combines vector search (ChromaDB) with knowledge graph reasoning (Neo4j)
 * for superior context understanding and personalization
 */

const chromaService = require('../chroma.service');
const neo4jService = require('../neo4j.service');
const vertexAIService = require('../vertexai.service');
const SessionService = require('../session/session.service');
const UserService = require('../auth/user.service');
const logger = require('../../utils/logger');

class EnhancedRAGService {
  /**
   * Process query with combined RAG + Knowledge Graph
   */
  static async processEnhancedQuery(userId, sessionId, query, options = {}) {
    try {
      logger.info(`Processing enhanced query for user ${userId}: ${query.substring(0, 50)}...`);

      // Step 1: Get comprehensive graph context
      const graphContext = await this.getGraphContext(userId);
      
      // Step 2: Enhance query with graph insights
      const enhancedQuery = await this.enhanceQueryWithGraph(query, graphContext);
      
      // Step 3: Perform contextual vector search
      const vectorResults = await this.contextualVectorSearch(enhancedQuery, graphContext);
      
      // Step 4: Get relationship-based recommendations
      const graphRecommendations = await this.getGraphRecommendations(userId, query, graphContext);
      
      // Step 5: Merge and rank results
      const mergedContext = await this.mergeAndRankContext(
        vectorResults,
        graphRecommendations,
        graphContext
      );
      
      // Step 6: Generate personalized response
      const response = await this.generatePersonalizedResponse(
        query,
        mergedContext,
        graphContext,
        sessionId
      );
      
      // Step 7: Update knowledge graph with interaction
      await this.updateGraphWithInteraction(userId, query, response, mergedContext);
      
      // Step 8: Update session context
      await SessionService.updateSessionContext(sessionId, {
        last_query: query,
        graph_context_used: true,
        concepts_addressed: mergedContext.concepts
      });

      return {
        response,
        context_used: mergedContext,
        graph_insights: graphContext.insights,
        reasoning_path: mergedContext.reasoning_path
      };
    } catch (error) {
      logger.error('Enhanced RAG processing error:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive context from knowledge graph
   */
  static async getGraphContext(userId) {
    const session = neo4jService.driver.session();
    try {
      // Get user's learning state
      const learningState = await session.run(`
        MATCH (u:User {id: $userId})
        OPTIONAL MATCH (u)-[p:PROGRESS]->(m:Module)
        OPTIONAL MATCH (u)-[c:COMPLETED]->(completed:Module)
        OPTIONAL MATCH (u)-[s:STRUGGLED_WITH]->(struggle:Concept)
        OPTIONAL MATCH (u)-[mastered:MASTERED]->(master:Concept)
        OPTIONAL MATCH (u)-[:TOOK]->(quiz:Quiz)-[:FOR_MODULE]->(qm:Module)
        WITH u, 
             collect(DISTINCT {module: m.name, progress: p.completion_percentage}) as current_progress,
             collect(DISTINCT completed.id) as completed_modules,
             collect(DISTINCT struggle.name) as struggled_concepts,
             collect(DISTINCT master.name) as mastered_concepts,
             collect(DISTINCT {module: qm.name, score: quiz.score}) as quiz_history
        RETURN {
          user_id: u.id,
          current_modules: current_progress,
          completed: completed_modules,
          struggles: struggled_concepts,
          mastered: mastered_concepts,
          quiz_performance: quiz_history
        } as context
      `, { userId });

      const userContext = learningState.records[0]?.get('context') || {};

      // Get learning path dependencies
      const dependencies = await session.run(`
        MATCH (u:User {id: $userId})-[:PROGRESS]->(current:Module)
        OPTIONAL MATCH path = (current)-[:PREREQUISITE_FOR*1..3]->(future:Module)
        OPTIONAL MATCH (current)-[:CONTAINS]->(concept:Concept)
        WITH current, collect(DISTINCT future.name) as future_modules,
             collect(DISTINCT concept.name) as current_concepts
        RETURN {
          current_module: current.name,
          upcoming_modules: future_modules,
          concepts_in_focus: current_concepts
        } as path_context
      `, { userId });

      const pathContext = dependencies.records[0]?.get('path_context') || {};

      // Get peer learning patterns
      const peerPatterns = await session.run(`
        MATCH (u:User {id: $userId})-[:PROGRESS]->(m:Module)
        MATCH (peer:User)-[:PROGRESS]->(m)
        WHERE peer.id <> u.id
        OPTIONAL MATCH (peer)-[:COMPLETED]->(m)
        OPTIONAL MATCH (peer)-[:VIEWED]->(content:Content)-[:TEACHES]->(concept:Concept)
        WITH peer, m, 
             collect(DISTINCT {content: content.title, concept: concept.name}) as peer_resources,
             exists((peer)-[:COMPLETED]->(m)) as peer_completed
        WHERE peer_completed = true
        RETURN collect(DISTINCT peer_resources) as successful_peer_resources
        LIMIT 5
      `, { userId });

      const peerContext = peerPatterns.records[0]?.get('successful_peer_resources') || [];

      // Compile insights
      const insights = this.generateGraphInsights(userContext, pathContext, peerContext);

      return {
        user: userContext,
        path: pathContext,
        peers: peerContext,
        insights,
        timestamp: new Date().toISOString()
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Enhance query with graph-based context
   */
  static async enhanceQueryWithGraph(originalQuery, graphContext) {
    const enhancements = [];

    // Add struggle context
    if (graphContext.user.struggles?.length > 0) {
      enhancements.push({
        type: 'focus_areas',
        concepts: graphContext.user.struggles,
        weight: 1.5
      });
    }

    // Add current module context
    if (graphContext.path.current_module) {
      enhancements.push({
        type: 'module_context',
        module: graphContext.path.current_module,
        concepts: graphContext.path.concepts_in_focus,
        weight: 1.2
      });
    }

    // Add upcoming module preparation
    if (graphContext.path.upcoming_modules?.length > 0) {
      enhancements.push({
        type: 'preparation',
        modules: graphContext.path.upcoming_modules,
        weight: 0.8
      });
    }

    return {
      original: originalQuery,
      enhancements,
      enhanced_query: this.buildEnhancedQuery(originalQuery, enhancements)
    };
  }

  /**
   * Perform contextual vector search with graph enhancements
   */
  static async contextualVectorSearch(enhancedQuery, graphContext) {
    // Build metadata filters based on graph context
    const metadataFilter = {
      module: graphContext.path.current_module,
      difficulty: this.calculateAppropiateDifficulty(graphContext)
    };

    // Search with enhanced query
    const results = await chromaService.searchSimilar(
      enhancedQuery.enhanced_query,
      {
        nResults: 10,
        metadataFilter
      }
    );

    // Re-rank based on graph insights
    const rerankedResults = await this.rerankWithGraphContext(results, graphContext);

    return rerankedResults;
  }

  /**
   * Get graph-based content recommendations
   */
  static async getGraphRecommendations(userId, query, graphContext) {
    const session = neo4jService.driver.session();
    try {
      // Find content that helped users with similar struggles
      const recommendations = await session.run(`
        MATCH (u:User {id: $userId})-[:STRUGGLED_WITH]->(concept:Concept)
        MATCH (other:User)-[:STRUGGLED_WITH]->(concept)
        WHERE other.id <> u.id
        MATCH (other)-[:MASTERED]->(concept)
        MATCH (other)-[:VIEWED]->(content:Content)-[:TEACHES]->(concept)
        WITH content, concept, count(DISTINCT other) as success_count
        WHERE success_count > 2
        RETURN collect({
          content_id: content.id,
          title: content.title,
          concept: concept.name,
          success_rate: success_count,
          type: 'peer_success'
        }) as recommendations
        LIMIT 5
      `, { userId });

      const peerRecommendations = recommendations.records[0]?.get('recommendations') || [];

      // Find prerequisite content for upcoming modules
      const prerequisiteContent = await session.run(`
        MATCH (u:User {id: $userId})-[:PROGRESS]->(current:Module)
        MATCH (current)-[:PREREQUISITE_FOR]->(next:Module)
        MATCH (next)-[:CONTAINS]->(concept:Concept)
        MATCH (content:Content)-[:TEACHES]->(concept)
        RETURN collect({
          content_id: content.id,
          title: content.title,
          concept: concept.name,
          module: next.name,
          type: 'prerequisite'
        }) as prerequisites
        LIMIT 5
      `, { userId });

      const prerequisites = prerequisiteContent.records[0]?.get('prerequisites') || [];

      return {
        peer_based: peerRecommendations,
        prerequisites: prerequisites,
        reasoning: 'Graph-based recommendations from successful peer patterns and prerequisites'
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Merge and rank results from vector and graph sources
   */
  static async mergeAndRankContext(vectorResults, graphRecommendations, graphContext) {
    const mergedResults = [];
    const reasoning_path = [];

    // Score vector results
    vectorResults.forEach(result => {
      let score = result.similarity || 0.5;
      
      // Boost if addresses user's struggles
      if (graphContext.user.struggles?.some(s => 
        result.content?.toLowerCase().includes(s.toLowerCase()))) {
        score *= 1.3;
        reasoning_path.push(`Boosted "${result.metadata?.title}" - addresses struggle areas`);
      }

      // Boost if from current module
      if (result.metadata?.module === graphContext.path.current_module) {
        score *= 1.2;
        reasoning_path.push(`Boosted "${result.metadata?.title}" - from current module`);
      }

      mergedResults.push({
        ...result,
        source: 'vector',
        final_score: score
      });
    });

    // Add graph recommendations with scoring
    graphRecommendations.peer_based?.forEach(rec => {
      const score = 0.7 + (rec.success_rate * 0.1); // Base score + success bonus
      mergedResults.push({
        content: `Recommended content: ${rec.title}`,
        metadata: rec,
        source: 'graph_peer',
        final_score: score
      });
      reasoning_path.push(`Added peer-successful content: "${rec.title}"`);
    });

    graphRecommendations.prerequisites?.forEach(rec => {
      const score = 0.6; // Prerequisites have moderate priority
      mergedResults.push({
        content: `Prerequisite: ${rec.title} for ${rec.module}`,
        metadata: rec,
        source: 'graph_prerequisite',
        final_score: score
      });
      reasoning_path.push(`Added prerequisite: "${rec.title}" for upcoming module`);
    });

    // Sort by final score
    mergedResults.sort((a, b) => b.final_score - a.final_score);

    // Extract concepts mentioned
    const concepts = new Set();
    mergedResults.forEach(r => {
      if (r.metadata?.concept) concepts.add(r.metadata.concept);
    });

    return {
      results: mergedResults.slice(0, 5), // Top 5 results
      concepts: Array.from(concepts),
      reasoning_path,
      sources: {
        vector_count: vectorResults.length,
        graph_peer_count: graphRecommendations.peer_based?.length || 0,
        graph_prerequisite_count: graphRecommendations.prerequisites?.length || 0
      }
    };
  }

  /**
   * Generate personalized response with full context
   */
  static async generatePersonalizedResponse(query, mergedContext, graphContext, sessionId) {
    // Build comprehensive prompt
    const systemPrompt = this.buildSystemPrompt(graphContext);
    const contextPrompt = this.buildContextPrompt(mergedContext);
    
    // Get session history
    const session = await SessionService.getSession(sessionId);
    const conversationHistory = session?.context?.conversation_history || [];

    // Build messages for AI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.formatConversationHistory(conversationHistory.slice(-3))
    ];

    // Add current query with context
    const userPrompt = `
Context from knowledge base:
${contextPrompt}

User's current learning state:
- Current Module: ${graphContext.path.current_module || 'Getting Started'}
- Struggled Concepts: ${graphContext.user.struggles?.join(', ') || 'None identified'}
- Mastered Concepts: ${graphContext.user.mastered?.join(', ') || 'None yet'}

User Question: ${query}

Please provide a helpful response that:
1. Directly answers the question
2. Considers the user's current learning level
3. References relevant concepts from the context
4. Suggests next steps if appropriate
    `;

    messages.push({ role: 'user', content: userPrompt });

    // Generate response
    const response = await vertexAIService.generateCompletion(messages, {
      maxTokens: 600,
      temperature: 0.7
    });

    // Add reasoning explanation if requested
    if (mergedContext.reasoning_path.length > 0) {
      const reasoning = `\n\n📊 *Context Sources:* ${mergedContext.reasoning_path.slice(0, 3).join('; ')}`;
      return response + reasoning;
    }

    return response;
  }

  /**
   * Update knowledge graph with interaction data
   */
  static async updateGraphWithInteraction(userId, query, response, context) {
    const session = neo4jService.driver.session();
    try {
      // Record interaction
      await session.run(`
        MATCH (u:User {id: $userId})
        CREATE (i:Interaction {
          id: $interactionId,
          query: $query,
          response: $response,
          timestamp: datetime(),
          concepts: $concepts
        })
        CREATE (u)-[:HAD_INTERACTION]->(i)
        WITH i, u
        UNWIND $concepts as conceptName
        MATCH (c:Concept {name: conceptName})
        CREATE (i)-[:DISCUSSED]->(c)
      `, {
        userId,
        interactionId: `interaction_${Date.now()}`,
        query: query.substring(0, 500),
        response: response.substring(0, 500),
        concepts: context.concepts || []
      });

      // Update user engagement metrics
      await session.run(`
        MATCH (u:User {id: $userId})
        SET u.last_interaction = datetime(),
            u.total_interactions = COALESCE(u.total_interactions, 0) + 1,
            u.last_query_type = $queryType
      `, {
        userId,
        queryType: this.classifyQuery(query)
      });

      logger.info(`Graph updated with interaction for user ${userId}`);
    } catch (error) {
      logger.error('Error updating graph with interaction:', error);
    } finally {
      await session.close();
    }
  }

  // Helper methods

  /**
   * Generate insights from graph context
   */
  static generateGraphInsights(userContext, pathContext, peerContext) {
    const insights = [];

    // Learning pace insight
    if (userContext.completed_modules?.length > 0) {
      const completionRate = userContext.completed_modules.length / 5; // Total modules
      if (completionRate > 0.6) {
        insights.push({
          type: 'progress',
          message: 'User is progressing well through the curriculum',
          confidence: 0.9
        });
      }
    }

    // Struggle pattern insight
    if (userContext.struggles?.length > 2) {
      insights.push({
        type: 'support_needed',
        message: `User needs additional support with: ${userContext.struggles.slice(0, 3).join(', ')}`,
        confidence: 0.85
      });
    }

    // Quiz performance insight
    const avgQuizScore = userContext.quiz_performance?.reduce((acc, q) => acc + q.score, 0) 
                        / (userContext.quiz_performance?.length || 1);
    if (avgQuizScore < 0.7) {
      insights.push({
        type: 'quiz_preparation',
        message: 'User may benefit from more practice before quiz attempts',
        confidence: 0.8
      });
    }

    // Peer comparison insight
    if (peerContext.length > 0) {
      insights.push({
        type: 'peer_resources',
        message: 'Similar successful learners found these resources helpful',
        confidence: 0.75
      });
    }

    return insights;
  }

  /**
   * Build enhanced query string
   */
  static buildEnhancedQuery(original, enhancements) {
    let enhanced = original;

    enhancements.forEach(enhancement => {
      if (enhancement.type === 'focus_areas' && enhancement.concepts.length > 0) {
        enhanced += ` [Focus: ${enhancement.concepts.join(', ')}]`;
      } else if (enhancement.type === 'module_context') {
        enhanced += ` [Module: ${enhancement.module}]`;
      }
    });

    return enhanced;
  }

  /**
   * Calculate appropriate difficulty based on performance
   */
  static calculateAppropiateDifficulty(graphContext) {
    const quizScores = graphContext.user.quiz_performance?.map(q => q.score) || [];
    const avgScore = quizScores.length > 0 
      ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length
      : 0.5;

    if (avgScore > 0.85) return 'advanced';
    if (avgScore > 0.7) return 'intermediate';
    return 'beginner';
  }

  /**
   * Re-rank results based on graph context
   */
  static async rerankWithGraphContext(results, graphContext) {
    return results.map(result => {
      let rankBoost = 1.0;

      // Boost content that addresses struggles
      if (graphContext.user.struggles?.some(concept => 
        result.content?.includes(concept))) {
        rankBoost *= 1.3;
      }

      // Boost content from successful peers
      if (graphContext.peers?.some(peer => 
        peer.content === result.metadata?.title)) {
        rankBoost *= 1.2;
      }

      // Penalize content from completed modules
      if (graphContext.user.completed?.includes(result.metadata?.module)) {
        rankBoost *= 0.8;
      }

      return {
        ...result,
        similarity: (result.similarity || 0.5) * rankBoost
      };
    }).sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Build system prompt with user context
   */
  static buildSystemPrompt(graphContext) {
    let prompt = 'You are an intelligent teaching assistant with deep knowledge of the user\'s learning journey. ';

    if (graphContext.path.current_module) {
      prompt += `The user is currently studying ${graphContext.path.current_module}. `;
    }

    if (graphContext.user.struggles?.length > 0) {
      prompt += `They need extra support with: ${graphContext.user.struggles.join(', ')}. `;
    }

    if (graphContext.insights.length > 0) {
      prompt += `Key insights: ${graphContext.insights[0].message}. `;
    }

    prompt += 'Provide clear, encouraging responses that build on their current understanding.';

    return prompt;
  }

  /**
   * Build context prompt from merged results
   */
  static buildContextPrompt(mergedContext) {
    return mergedContext.results
      .slice(0, 3)
      .map((r, i) => `[${i + 1}] ${r.content.substring(0, 300)}...`)
      .join('\n\n');
  }

  /**
   * Format conversation history for AI
   */
  static formatConversationHistory(history) {
    const formatted = [];
    history.forEach(exchange => {
      formatted.push({ role: 'user', content: exchange.user_message });
      formatted.push({ role: 'assistant', content: exchange.assistant_response });
    });
    return formatted;
  }

  /**
   * Classify query type for analytics
   */
  static classifyQuery(query) {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('quiz') || lowerQuery.includes('test')) {
      return 'quiz_related';
    } else if (lowerQuery.includes('explain') || lowerQuery.includes('what is')) {
      return 'conceptual';
    } else if (lowerQuery.includes('how to') || lowerQuery.includes('steps')) {
      return 'procedural';
    } else if (lowerQuery.includes('help') || lowerQuery.includes('stuck')) {
      return 'support';
    }
    
    return 'general';
  }

  /**
   * Get learning recommendations based on graph analysis
   */
  static async getLearningRecommendations(userId) {
    const session = neo4jService.driver.session();
    try {
      // Complex query to find optimal learning paths
      const recommendations = await session.run(`
        MATCH (u:User {id: $userId})
        OPTIONAL MATCH (u)-[:PROGRESS]->(current:Module)
        OPTIONAL MATCH (u)-[:STRUGGLED_WITH]->(struggle:Concept)
        
        // Find successful learning patterns from similar users
        OPTIONAL MATCH (similar:User)-[:COMPLETED]->(current)
        WHERE similar.id <> u.id
        OPTIONAL MATCH (similar)-[:VIEWED]->(content:Content)-[:TEACHES]->(struggle)
        
        // Find next best modules based on prerequisites
        OPTIONAL MATCH path = (current)-[:PREREQUISITE_FOR]->(next:Module)
        WHERE NOT exists((u)-[:COMPLETED]->(next))
        
        // Collect and return recommendations
        WITH u, 
             collect(DISTINCT content) as helpful_content,
             collect(DISTINCT next) as next_modules,
             collect(DISTINCT struggle) as focus_areas
        
        RETURN {
          helpful_content: [c in helpful_content | {id: c.id, title: c.title}],
          next_modules: [m in next_modules | {id: m.id, name: m.name}],
          focus_areas: [s in focus_areas | s.name]
        } as recommendations
      `, { userId });

      return recommendations.records[0]?.get('recommendations') || {};
    } finally {
      await session.close();
    }
  }
}

module.exports = EnhancedRAGService;