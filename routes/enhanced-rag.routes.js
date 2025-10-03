/**
 * Enhanced RAG API Routes
 * Integrates vector search with knowledge graph reasoning
 */

const express = require('express');
const router = express.Router();
const PerformanceOptimizedRAGService = require('../services/rag/performance-optimized-rag.service');
const EnhancedRAGService = require('../services/rag/enhanced-rag.service');
const SessionService = require('../services/session/session.service');
const UserService = require('../services/auth/user.service');
const { authenticateToken, optionalAuth } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

/**
 * POST /api/rag/query
 * Process query with enhanced RAG (performance-optimized)
 */
router.post('/rag/query', optionalAuth, async (req, res) => {
  try {
    const { query, session_id, use_performance_mode = true, skip_cache = false } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    // Get or create session
    let sessionId = session_id;
    let userId = req.user?.id;

    if (!sessionId && req.body.whatsapp_id) {
      // WhatsApp user
      const session = await SessionService.getOrCreateSession(req.body.whatsapp_id);
      sessionId = session.session_id;
      userId = session.user_id;
    } else if (!sessionId && userId) {
      // Admin user
      const session = await SessionService.getOrCreateSession(`admin_${userId}`);
      sessionId = session.session_id;
    }

    if (!sessionId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Session or user identification required'
      });
    }

    // Process query with appropriate service
    const startTime = Date.now();
    let result;

    if (use_performance_mode) {
      result = await PerformanceOptimizedRAGService.processQuery(
        userId,
        sessionId,
        query,
        { skipCache: skip_cache }
      );
    } else {
      result = await EnhancedRAGService.processEnhancedQuery(
        userId,
        sessionId,
        query
      );
    }

    // Add timing info
    result.total_time_ms = Date.now() - startTime;
    result.mode = use_performance_mode ? 'performance' : 'enhanced';

    res.json({
      success: true,
      ...result,
      session_id: sessionId
    });

  } catch (error) {
    logger.error('RAG query error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process query'
    });
  }
});

/**
 * POST /api/rag/batch
 * Process multiple queries in batch (performance optimization)
 */
router.post('/rag/batch', authenticateToken, async (req, res) => {
  try {
    const { queries, session_id } = req.body;

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Queries array is required'
      });
    }

    if (queries.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 queries allowed per batch'
      });
    }

    const userId = req.user.id;
    const sessionId = session_id || (await SessionService.getOrCreateSession(`admin_${userId}`)).session_id;

    // Process queries in parallel
    const results = await Promise.allSettled(
      queries.map(query => 
        PerformanceOptimizedRAGService.processQuery(userId, sessionId, query)
      )
    );

    // Format results
    const responses = results.map((result, index) => ({
      query: queries[index],
      success: result.status === 'fulfilled',
      response: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));

    res.json({
      success: true,
      batch_size: queries.length,
      responses
    });

  } catch (error) {
    logger.error('Batch query error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process batch'
    });
  }
});

/**
 * GET /api/rag/recommendations/:userId
 * Get learning recommendations from knowledge graph
 */
router.get('/rag/recommendations/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get recommendations from graph
    const recommendations = await EnhancedRAGService.getLearningRecommendations(userId);

    res.json({
      success: true,
      user_id: userId,
      recommendations
    });

  } catch (error) {
    logger.error('Get recommendations error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get recommendations'
    });
  }
});

/**
 * GET /api/rag/context/:userId
 * Get user's complete learning context from graph
 */
router.get('/rag/context/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { use_cache = true } = req.query;

    // Get context from cache or fresh
    const context = use_cache
      ? await PerformanceOptimizedRAGService.getOptimizedGraphContext(userId)
      : await EnhancedRAGService.getGraphContext(userId);

    res.json({
      success: true,
      user_id: userId,
      context,
      cached: use_cache
    });

  } catch (error) {
    logger.error('Get context error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get context'
    });
  }
});

/**
 * POST /api/rag/feedback
 * Record feedback for RAG responses
 */
router.post('/rag/feedback', optionalAuth, async (req, res) => {
  try {
    const { session_id, query, response, rating, feedback_text } = req.body;

    if (!session_id || !query || rating === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Session ID, query, and rating are required'
      });
    }

    // Store feedback in graph
    const neo4jService = require('../services/neo4j.service');
    const session = neo4jService.driver.session();
    
    try {
      await session.run(`
        CREATE (f:Feedback {
          id: $feedbackId,
          session_id: $sessionId,
          query: $query,
          response: $response,
          rating: $rating,
          feedback_text: $feedbackText,
          timestamp: datetime()
        })
      `, {
        feedbackId: `feedback_${Date.now()}`,
        sessionId: session_id,
        query: query.substring(0, 500),
        response: response?.substring(0, 500) || '',
        rating: rating,
        feedbackText: feedback_text || ''
      });

      res.json({
        success: true,
        message: 'Feedback recorded successfully'
      });
    } finally {
      await session.close();
    }

  } catch (error) {
    logger.error('Record feedback error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to record feedback'
    });
  }
});

/**
 * POST /api/rag/preload
 * Preload cache for specific users (admin only)
 */
router.post('/rag/preload', authenticateToken, async (req, res) => {
  try {
    const { user_ids } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    if (!user_ids || !Array.isArray(user_ids)) {
      return res.status(400).json({
        success: false,
        error: 'User IDs array required'
      });
    }

    // Start preloading in background
    PerformanceOptimizedRAGService.preloadCache(user_ids);

    res.json({
      success: true,
      message: `Cache preload started for ${user_ids.length} users`
    });

  } catch (error) {
    logger.error('Preload cache error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to preload cache'
    });
  }
});

/**
 * DELETE /api/rag/cache
 * Clear all caches (admin only)
 */
router.delete('/rag/cache', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    PerformanceOptimizedRAGService.clearAllCaches();

    res.json({
      success: true,
      message: 'All caches cleared successfully'
    });

  } catch (error) {
    logger.error('Clear cache error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear cache'
    });
  }
});

/**
 * GET /api/rag/metrics
 * Get performance metrics (admin only)
 */
router.get('/rag/metrics', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const metrics = PerformanceOptimizedRAGService.getPerformanceMetrics();

    res.json({
      success: true,
      metrics
    });

  } catch (error) {
    logger.error('Get metrics error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get metrics'
    });
  }
});

/**
 * POST /api/rag/test
 * Test RAG with sample queries
 */
router.post('/rag/test', authenticateToken, async (req, res) => {
  try {
    const testQueries = [
      'What is classroom management?',
      'How do I create a lesson plan?',
      'Tips for student assessment'
    ];

    const userId = req.user.id;
    const session = await SessionService.getOrCreateSession(`test_${userId}`);
    
    const results = [];
    
    for (const query of testQueries) {
      const startTime = Date.now();
      
      try {
        const result = await PerformanceOptimizedRAGService.processQuery(
          userId,
          session.session_id,
          query,
          { skipCache: true }
        );
        
        results.push({
          query,
          success: true,
          time_ms: Date.now() - startTime,
          response_preview: result.response.substring(0, 100) + '...'
        });
      } catch (error) {
        results.push({
          query,
          success: false,
          error: error.message
        });
      }
    }

    const avgTime = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.time_ms, 0) / results.filter(r => r.success).length;

    res.json({
      success: true,
      test_results: results,
      average_time_ms: Math.round(avgTime),
      performance_grade: avgTime < 500 ? 'Excellent' : avgTime < 1000 ? 'Good' : 'Needs Optimization'
    });

  } catch (error) {
    logger.error('Test RAG error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Test failed'
    });
  }
});

module.exports = router;