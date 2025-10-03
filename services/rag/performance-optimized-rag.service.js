/**
 * Performance-Optimized Enhanced RAG Service
 * Combines vector search with knowledge graph reasoning
 * with aggressive performance optimizations
 */

const chromaService = require('../chroma.service');
const neo4jService = require('../neo4j.service');
const vertexAIService = require('../vertexai.service');
const SessionService = require('../session/session.service');
const logger = require('../../utils/logger');
const NodeCache = require('node-cache');

class PerformanceOptimizedRAGService {
  // Initialize caches with TTL
  static graphCache = new NodeCache({ stdTTL: 300 }); // 5 minutes for graph context
  static vectorCache = new NodeCache({ stdTTL: 600 }); // 10 minutes for vector results
  static responseCache = new NodeCache({ stdTTL: 120 }); // 2 minutes for responses
  
  // Connection pools for better performance
  static neo4jSessionPool = [];
  static maxPoolSize = 10;

  /**
   * MAIN ENTRY POINT - Optimized query processing
   */
  static async processQuery(userId, sessionId, query, options = {}) {
    const startTime = Date.now();
    
    try {
      // Check response cache first
      const cacheKey = `${userId}_${query.substring(0, 50)}`;
      const cachedResponse = this.responseCache.get(cacheKey);
      
      if (cachedResponse && !options.skipCache) {
        logger.info(`Cache hit for query: ${cacheKey} (${Date.now() - startTime}ms)`);
        return cachedResponse;
      }

      // Execute parallel operations
      const [graphContext, sessionData] = await Promise.all([
        this.getOptimizedGraphContext(userId),
        SessionService.getSession(sessionId)
      ]);

      // Parallel search operations
      const [vectorResults, graphRecommendations] = await Promise.all([
        this.performVectorSearch(query, graphContext, userId),
        this.getGraphRecommendations(userId, query, graphContext)
      ]);

      // Fast merge and rank
      const mergedContext = this.fastMergeAndRank(
        vectorResults,
        graphRecommendations,
        graphContext
      );

      // Generate response (most expensive operation)
      const response = await this.generateOptimizedResponse(
        query,
        mergedContext,
        graphContext,
        sessionData
      );

      // Async operations (don't wait)
      this.asyncPostProcessing(userId, sessionId, query, response, mergedContext);

      const result = {
        response,
        context_used: mergedContext.top_results,
        processing_time_ms: Date.now() - startTime,
        cache_status: 'miss'
      };

      // Cache the result
      this.responseCache.set(cacheKey, result);

      logger.info(`Query processed in ${Date.now() - startTime}ms`);
      return result;

    } catch (error) {
      logger.error('Performance-optimized RAG error:', error);
      // Fallback to simple response
      return this.fallbackResponse(query, error);
    }
  }

  /**
   * PERFORMANCE OPTIMIZATION 1: Cached & Batched Graph Context
   */
  static async getOptimizedGraphContext(userId) {
    // Check cache
    const cacheKey = `graph_${userId}`;
    const cached = this.graphCache.get(cacheKey);
    
    if (cached) {
      logger.debug(`Graph cache hit for user ${userId}`);
      return cached;
    }

    const session = await this.getPooledSession();
    
    try {
      // Single optimized query instead of multiple
      const result = await session.run(`
        MATCH (u:User {id: $userId})
        
        // Get all user data in one go
        OPTIONAL MATCH (u)-[p:PROGRESS]->(m:Module)
        WITH u, collect(DISTINCT {
          module_id: m.id,
          module_name: m.name,
          progress: p.completion_percentage,
          quiz_score: p.best_quiz_score
        }) as modules
        
        // Get struggled and mastered concepts
        OPTIONAL MATCH (u)-[:STRUGGLED_WITH]->(struggle:Concept)
        WITH u, modules, collect(DISTINCT struggle.name) as struggles
        
        OPTIONAL MATCH (u)-[:MASTERED]->(master:Concept)
        WITH u, modules, struggles, collect(DISTINCT master.name) as mastered
        
        // Get current module details
        OPTIONAL MATCH (u)-[:PROGRESS]->(current:Module)
        WHERE current.id = u.current_module_id
        OPTIONAL MATCH (current)-[:CONTAINS]->(concept:Concept)
        
        RETURN {
          user_id: u.id,
          modules: modules,
          struggles: struggles[0..5], // Limit for performance
          mastered: mastered[0..5],
          current_module: current.name,
          current_concepts: collect(DISTINCT concept.name)[0..10]
        } as context
      `, { userId });

      const context = result.records[0]?.get('context') || {};
      
      // Cache the result
      this.graphCache.set(cacheKey, context);
      
      return context;
    } finally {
      this.releasePooledSession(session);
    }
  }

  /**
   * PERFORMANCE OPTIMIZATION 2: Parallel Vector Search with Caching
   */
  static async performVectorSearch(query, graphContext, userId) {
    const cacheKey = `vector_${userId}_${query.substring(0, 30)}`;
    const cached = this.vectorCache.get(cacheKey);
    
    if (cached) {
      logger.debug(`Vector cache hit for query`);
      return cached;
    }

    // Build optimized search parameters
    const searchParams = {
      nResults: 5, // Reduced from 10 for performance
      metadataFilter: {
        module: graphContext.current_module
      }
    };

    // Add struggle boost terms
    const enhancedQuery = graphContext.struggles?.length > 0
      ? `${query} ${graphContext.struggles.slice(0, 2).join(' ')}`
      : query;

    const results = await chromaService.searchSimilar(enhancedQuery, searchParams);
    
    // Light-weight scoring
    const scored = results.map(r => ({
      ...r,
      score: this.calculateQuickScore(r, graphContext)
    }));

    this.vectorCache.set(cacheKey, scored);
    return scored;
  }

  /**
   * PERFORMANCE OPTIMIZATION 3: Simplified Graph Recommendations
   */
  static async getGraphRecommendations(userId, query, graphContext) {
    // Skip if user has no struggles (nothing to recommend)
    if (!graphContext.struggles || graphContext.struggles.length === 0) {
      return { peer_based: [], prerequisites: [] };
    }

    const session = await this.getPooledSession();
    
    try {
      // Single efficient query
      const result = await session.run(`
        MATCH (u:User {id: $userId})
        
        // Get top peer recommendation
        OPTIONAL MATCH (u)-[:STRUGGLED_WITH]->(concept:Concept)<-[:STRUGGLED_WITH]-(peer:User)
        WHERE peer.id <> u.id
        OPTIONAL MATCH (peer)-[:VIEWED]->(content:Content)-[:TEACHES]->(concept)
        WITH u, content, count(DISTINCT peer) as peer_count
        ORDER BY peer_count DESC
        LIMIT 3
        
        WITH collect({
          content_id: content.id,
          title: content.title,
          peer_count: peer_count
        }) as recommendations
        
        RETURN recommendations
      `, { userId });

      const recommendations = result.records[0]?.get('recommendations') || [];
      
      return {
        peer_based: recommendations,
        prerequisites: [] // Skip prerequisites for performance
      };
    } finally {
      this.releasePooledSession(session);
    }
  }

  /**
   * PERFORMANCE OPTIMIZATION 4: Fast Merge and Rank
   */
  static fastMergeAndRank(vectorResults, graphRecommendations, graphContext) {
    const results = [];
    
    // Quick scoring for vector results
    vectorResults.forEach(r => {
      results.push({
        content: r.content?.substring(0, 500), // Limit content size
        score: r.score || r.similarity || 0.5,
        source: 'vector',
        metadata: r.metadata
      });
    });

    // Add top graph recommendations
    graphRecommendations.peer_based?.slice(0, 2).forEach(r => {
      results.push({
        content: `Peer recommendation: ${r.title}`,
        score: 0.7 + (r.peer_count * 0.05),
        source: 'graph',
        metadata: r
      });
    });

    // Simple sort by score
    results.sort((a, b) => b.score - a.score);

    return {
      top_results: results.slice(0, 3), // Only top 3 for response
      total_count: results.length
    };
  }

  /**
   * PERFORMANCE OPTIMIZATION 5: Streamlined Response Generation
   */
  static async generateOptimizedResponse(query, mergedContext, graphContext, sessionData) {
    // Build minimal prompt
    const context = mergedContext.top_results
      .map(r => r.content.substring(0, 200))
      .join('\n');

    const messages = [
      {
        role: 'system',
        content: `You are a teaching assistant. User is studying ${graphContext.current_module || 'introductory content'}.`
      },
      {
        role: 'user',
        content: `Context:\n${context}\n\nQuestion: ${query}\n\nProvide a clear, concise answer.`
      }
    ];

    // Use lower token limit for faster response
    const response = await vertexAIService.generateCompletion(messages, {
      maxTokens: 300, // Reduced from 600
      temperature: 0.7,
      topP: 0.9
    });

    return response;
  }

  /**
   * PERFORMANCE OPTIMIZATION 6: Async Post-Processing
   */
  static async asyncPostProcessing(userId, sessionId, query, response, mergedContext) {
    // Fire and forget - don't wait for these
    setImmediate(async () => {
      try {
        // Update session
        await SessionService.addToConversation(sessionId, query, response);
        
        // Update graph analytics (batched)
        this.batchGraphUpdate(userId, query, mergedContext);
        
      } catch (error) {
        logger.error('Async post-processing error:', error);
      }
    });
  }

  /**
   * PERFORMANCE OPTIMIZATION 7: Batched Graph Updates
   */
  static batchQueue = [];
  static batchTimer = null;
  
  static batchGraphUpdate(userId, query, context) {
    this.batchQueue.push({ userId, query, context, timestamp: Date.now() });
    
    // Process batch after 1 second or when queue reaches 10
    if (this.batchQueue.length >= 10) {
      this.processBatch();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.processBatch(), 1000);
    }
  }

  static async processBatch() {
    if (this.batchQueue.length === 0) return;
    
    const batch = [...this.batchQueue];
    this.batchQueue = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const session = await this.getPooledSession();
    
    try {
      // Batch insert all interactions
      await session.run(`
        UNWIND $batch as item
        MATCH (u:User {id: item.userId})
        CREATE (i:Interaction {
          id: item.userId + '_' + toString(item.timestamp),
          query: item.query,
          timestamp: datetime({epochMillis: item.timestamp})
        })
        CREATE (u)-[:HAD_INTERACTION]->(i)
      `, { batch });
      
      logger.info(`Batch processed ${batch.length} interactions`);
    } catch (error) {
      logger.error('Batch processing error:', error);
    } finally {
      this.releasePooledSession(session);
    }
  }

  /**
   * PERFORMANCE OPTIMIZATION 8: Connection Pooling
   */
  static async getPooledSession() {
    // Reuse existing session if available
    if (this.neo4jSessionPool.length > 0) {
      return this.neo4jSessionPool.pop();
    }
    
    // Create new session
    return neo4jService.driver.session({
      defaultAccessMode: 'READ',
      fetchSize: 100
    });
  }

  static releasePooledSession(session) {
    if (this.neo4jSessionPool.length < this.maxPoolSize) {
      this.neo4jSessionPool.push(session);
    } else {
      session.close();
    }
  }

  /**
   * PERFORMANCE OPTIMIZATION 9: Quick Scoring Algorithm
   */
  static calculateQuickScore(result, graphContext) {
    let score = result.similarity || 0.5;
    
    // Simple keyword match for struggles (faster than complex analysis)
    if (graphContext.struggles?.some(s => 
      result.content?.toLowerCase().includes(s.toLowerCase()))) {
      score *= 1.2;
    }
    
    // Current module boost
    if (result.metadata?.module === graphContext.current_module) {
      score *= 1.1;
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * PERFORMANCE OPTIMIZATION 10: Fallback Response
   */
  static async fallbackResponse(query, error) {
    logger.error('Using fallback response due to error:', error.message);
    
    return {
      response: `I'll help you with that. ${query} is an important topic in teaching. Let me provide some general guidance...`,
      context_used: [],
      processing_time_ms: 0,
      cache_status: 'error',
      fallback: true
    };
  }

  /**
   * Preload frequently accessed data
   */
  static async preloadCache(userIds = []) {
    logger.info(`Preloading cache for ${userIds.length} users`);
    
    const preloadPromises = userIds.map(async userId => {
      try {
        await this.getOptimizedGraphContext(userId);
      } catch (error) {
        logger.error(`Failed to preload cache for user ${userId}:`, error);
      }
    });

    await Promise.all(preloadPromises);
    logger.info('Cache preload complete');
  }

  /**
   * Clear all caches
   */
  static clearAllCaches() {
    this.graphCache.flushAll();
    this.vectorCache.flushAll();
    this.responseCache.flushAll();
    logger.info('All caches cleared');
  }

  /**
   * Get performance metrics
   */
  static getPerformanceMetrics() {
    return {
      cache_stats: {
        graph_cache: this.graphCache.getStats(),
        vector_cache: this.vectorCache.getStats(),
        response_cache: this.responseCache.getStats()
      },
      pool_stats: {
        neo4j_sessions: this.neo4jSessionPool.length,
        batch_queue_size: this.batchQueue.length
      },
      memory_usage: process.memoryUsage()
    };
  }
}

// Cleanup on exit
process.on('exit', () => {
  PerformanceOptimizedRAGService.neo4jSessionPool.forEach(session => session.close());
});

module.exports = PerformanceOptimizedRAGService;