const neo4j = require('neo4j-driver');
const logger = require('../utils/logger');

class Neo4jService {
  constructor() {
    this.driver = null;
  }

  async initialize() {
    try {
      // Use NEO4J_URI from environment (neo4j:7687 for Docker, localhost:7687 for local)
      const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
      const user = process.env.NEO4J_USER || 'neo4j';
      const password = process.env.NEO4J_PASSWORD || 'password';

      logger.info(`Connecting to Neo4j at: ${uri}`);

      this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
      
      // Test connection
      const session = this.driver.session();
      await session.run('RETURN 1');
      await session.close();

      // Setup database schema
      await this.setupDatabase();

      logger.info('Neo4j initialized successfully');
    } catch (error) {
      logger.error('Neo4j initialization failed:', error);
      throw error;
    }
  }

  async setupDatabase() {
    const session = this.driver.session();
    try {
      // Create constraints
      const constraints = [
        'CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE',
        'CREATE CONSTRAINT module_id IF NOT EXISTS FOR (m:Module) REQUIRE m.id IS UNIQUE',
        'CREATE CONSTRAINT quiz_id IF NOT EXISTS FOR (q:Quiz) REQUIRE q.id IS UNIQUE',
        'CREATE CONSTRAINT session_id IF NOT EXISTS FOR (s:Session) REQUIRE s.id IS UNIQUE',
        'CREATE CONSTRAINT event_id IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE'
      ];

      for (const constraint of constraints) {
        try {
          await session.run(constraint);
        } catch (e) {
          // Constraint might already exist
        }
      }

      // Create indexes for performance
      const indexes = [
        'CREATE INDEX user_phone IF NOT EXISTS FOR (u:User) ON (u.phone)',
        'CREATE INDEX session_active IF NOT EXISTS FOR (s:Session) ON (s.is_active)',
        'CREATE INDEX event_timestamp IF NOT EXISTS FOR (e:Event) ON (e.timestamp)'
      ];

      for (const index of indexes) {
        try {
          await session.run(index);
        } catch (e) {
          // Index might already exist
        }
      }

      logger.info('Neo4j database setup completed');
    } finally {
      await session.close();
    }
  }

  async createUser(userData) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `CREATE (u:User {
          id: $id,
          phone: $phone,
          name: $name,
          email: $email,
          role: $role,
          created_at: datetime()
        })
        RETURN u`,
        userData
      );
      
      return result.records[0].get('u').properties;
    } finally {
      await session.close();
    }
  }

  async getUser(userId) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (u:User {id: $userId}) RETURN u',
        { userId }
      );
      
      return result.records[0]?.get('u').properties;
    } finally {
      await session.close();
    }
  }

  async createModule(moduleData) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MERGE (m:Module {id: $id})
        SET m.name = $name,
            m.description = $description,
            m.order_index = $order_index,
            m.difficulty = $difficulty,
            m.estimated_time = $estimated_time,
            m.created_at = datetime()
        RETURN m`,
        moduleData
      );
      
      return result.records[0].get('m').properties;
    } finally {
      await session.close();
    }
  }

  async linkModuleSequence(moduleId1, moduleId2) {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (m1:Module {id: $moduleId1})
        MATCH (m2:Module {id: $moduleId2})
        MERGE (m1)-[:PREREQUISITE_FOR]->(m2)`,
        { moduleId1, moduleId2 }
      );
    } finally {
      await session.close();
    }
  }

  async trackUserProgress(userId, moduleId, progressData) {
    const session = this.driver.session();
    try {
      // Ensure all required parameters are present
      const params = {
        userId,
        moduleId,
        status: progressData.status || 'in_progress',
        completion_percentage: progressData.completion_percentage || 0,
        time_spent: progressData.time_spent || 0,
        quiz_score: progressData.quiz_score || null
      };
      
      const result = await session.run(
        `MATCH (u:User {id: $userId})
        MATCH (m:Module {id: $moduleId})
        MERGE (u)-[p:PROGRESS]->(m)
        SET p.status = $status,
            p.completion_percentage = $completion_percentage,
            p.last_accessed = datetime(),
            p.time_spent = COALESCE(p.time_spent, 0) + $time_spent,
            p.quiz_score = COALESCE($quiz_score, p.quiz_score)
        RETURN p`,
        params
      );
      
      return result.records[0]?.get('p').properties;
    } finally {
      await session.close();
    }
  }

  async recordQuizAttempt(userId, moduleId, quizData) {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (u:User {id: $userId})
        MATCH (m:Module {id: $moduleId})
        CREATE (q:Quiz {
          id: $quizId,
          score: $score,
          total_questions: $total_questions,
          correct_answers: $correct_answers,
          attempt_number: $attempt_number,
          completed_at: datetime()
        })
        CREATE (u)-[:TOOK]->(q)
        CREATE (q)-[:FOR_MODULE]->(m)
        WITH u, m, q
        MATCH (u)-[p:PROGRESS]->(m)
        SET p.quiz_attempts = COALESCE(p.quiz_attempts, 0) + 1,
            p.best_quiz_score = CASE 
              WHEN COALESCE(p.best_quiz_score, 0) < $score 
              THEN $score 
              ELSE p.best_quiz_score 
            END`,
        quizData
      );
    } finally {
      await session.close();
    }
  }

  async getUserLearningPath(userId) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})
        OPTIONAL MATCH (u)-[p:PROGRESS]->(m:Module)
        WITH u, m, p
        ORDER BY m.order_index
        RETURN u, collect({
          id: m.id,
          name: m.name,
          order_index: m.order_index,
          progress: p
        }) as modules`,
        { userId }
      );

      if (result.records.length === 0) {
        return null;
      }

      const user = result.records[0].get('u').properties;
      const modules = result.records[0].get('modules').filter(m => m.id);

      return { user, modules };
    } finally {
      await session.close();
    }
  }

  async canUserAccessModule(userId, moduleId) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (m:Module {id: $moduleId})
        OPTIONAL MATCH (prerequisite:Module)-[:PREREQUISITE_FOR]->(m)
        OPTIONAL MATCH (u:User {id: $userId})-[p:PROGRESS]->(prerequisite)
        WHERE p.status = 'completed' OR prerequisite IS NULL
        RETURN count(prerequisite) = count(p) as canAccess`,
        { userId, moduleId }
      );
      
      return result.records[0]?.get('canAccess') ?? true;
    } finally {
      await session.close();
    }
  }

  async getLearningAnalytics() {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (u:User)
        OPTIONAL MATCH (u)-[p:PROGRESS]->(m:Module)
        RETURN {
          total_users: count(DISTINCT u),
          active_users: count(DISTINCT CASE WHEN p IS NOT NULL THEN u END),
          completed_modules: count(DISTINCT CASE WHEN p.status = 'completed' THEN p END),
          average_score: avg(p.quiz_score)
        } as analytics`
      );
      
      return result.records[0]?.get('analytics') || {};
    } finally {
      await session.close();
    }
  }

  async trackContentInteraction(userId, contentId, interactionType) {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (u:User {id: $userId})
        MERGE (c:Content {id: $contentId})
        CREATE (u)-[:INTERACTED {
          type: $interactionType,
          timestamp: datetime()
        }]->(c)`,
        { userId, contentId, interactionType }
      );
    } finally {
      await session.close();
    }
  }

  // ========================================
  // SESSION MEMORY & STATE MANAGEMENT
  // ========================================

  async createOrUpdateSession(userId, sessionData) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})
        MERGE (s:Session {id: $sessionId})
        ON CREATE SET
          s.started_at = datetime(),
          s.context = $context,
          s.current_module_id = $currentModuleId,
          s.current_state = $currentState,
          s.is_active = true,
          s.last_activity = datetime()
        ON MATCH SET
          s.context = $context,
          s.current_module_id = $currentModuleId,
          s.current_state = $currentState,
          s.last_activity = datetime(),
          s.interaction_count = COALESCE(s.interaction_count, 0) + 1
        MERGE (u)-[:HAS_SESSION]->(s)
        RETURN s`,
        {
          userId,
          sessionId: sessionData.sessionId,
          context: JSON.stringify(sessionData.context || {}),
          currentModuleId: sessionData.currentModuleId || null,
          currentState: sessionData.currentState || 'idle'
        }
      );

      return result.records[0]?.get('s').properties;
    } finally {
      await session.close();
    }
  }

  async getActiveSession(userId) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:HAS_SESSION]->(s:Session)
        WHERE s.is_active = true
          AND duration.between(s.last_activity, datetime()).hours < 24
        RETURN s
        ORDER BY s.last_activity DESC
        LIMIT 1`,
        { userId }
      );

      if (result.records.length === 0) return null;

      const sessionProps = result.records[0].get('s').properties;
      return {
        ...sessionProps,
        context: JSON.parse(sessionProps.context || '{}')
      };
    } finally {
      await session.close();
    }
  }

  async recordEvent(userId, eventData) {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (u:User {id: $userId})
        CREATE (e:Event {
          id: randomUUID(),
          type: $type,
          data: $data,
          timestamp: datetime(),
          module_id: $moduleId
        })
        CREATE (u)-[:TRIGGERED]->(e)
        WITH u, e
        OPTIONAL MATCH (u)-[:HAS_SESSION]->(s:Session {is_active: true})
        CREATE (s)-[:CONTAINS]->(e)
        RETURN e`,
        {
          userId,
          type: eventData.type,
          data: JSON.stringify(eventData.data || {}),
          moduleId: eventData.moduleId || null
        }
      );
    } finally {
      await session.close();
    }
  }

  async getSessionHistory(userId, limit = 10) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:HAS_SESSION]->(s:Session)
        OPTIONAL MATCH (s)-[:CONTAINS]->(e:Event)
        WITH s, collect(e) as events
        ORDER BY s.last_activity DESC
        LIMIT $limit
        RETURN s, events`,
        { userId, limit }
      );

      return result.records.map(record => ({
        session: record.get('s').properties,
        events: record.get('events').map(e => e.properties)
      }));
    } finally {
      await session.close();
    }
  }

  // ========================================
  // COACHING & NUDGING ENGINE
  // ========================================

  async trackLearningBehavior(userId, behavior) {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (u:User {id: $userId})
        MERGE (u)-[b:BEHAVIOR]->(pattern:LearningPattern {type: $type})
        ON CREATE SET
          b.frequency = 1,
          b.first_seen = datetime(),
          b.last_seen = datetime()
        ON MATCH SET
          b.frequency = b.frequency + 1,
          b.last_seen = datetime()
        SET b.metadata = $metadata`,
        {
          userId,
          type: behavior.type,
          metadata: JSON.stringify(behavior.metadata || {})
        }
      );
    } finally {
      await session.close();
    }
  }

  async shouldNudgeUser(userId) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})
        OPTIONAL MATCH (u)-[:HAS_SESSION]->(s:Session)
        WHERE s.is_active = true
        WITH u, s
        ORDER BY s.last_activity DESC
        LIMIT 1

        // Check last activity
        WITH u, s,
          duration.between(COALESCE(s.last_activity, datetime() - duration({hours: 48})), datetime()) as inactivity

        // Check incomplete modules
        OPTIONAL MATCH (u)-[p:PROGRESS]->(m:Module)
        WHERE p.status = 'in_progress'

        RETURN {
          should_nudge: inactivity.hours > 48 OR count(p) > 0,
          reason: CASE
            WHEN inactivity.hours > 48 THEN 'inactivity'
            WHEN count(p) > 0 THEN 'incomplete_modules'
            ELSE 'none'
          END,
          inactivity_hours: inactivity.hours,
          incomplete_count: count(p)
        } as nudge_data`,
        { userId }
      );

      return result.records[0]?.get('nudge_data') || { should_nudge: false };
    } finally {
      await session.close();
    }
  }

  async getPersonalizedRecommendations(userId) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})

        // Find current progress
        OPTIONAL MATCH (u)-[p:PROGRESS]->(completed:Module)
        WHERE p.status = 'completed'

        // Find next recommended modules
        MATCH (next:Module)
        WHERE NOT exists((u)-[:PROGRESS {status: 'completed'}]->(next))
        OPTIONAL MATCH (prereq:Module)-[:PREREQUISITE_FOR]->(next)
        WHERE NOT exists((u)-[:PROGRESS {status: 'completed'}]->(prereq))

        WITH u, next, count(prereq) as missing_prereqs
        WHERE missing_prereqs = 0

        // Consider learning behavior
        OPTIONAL MATCH (u)-[b:BEHAVIOR]->(lp:LearningPattern)

        RETURN next {
          .*,
          recommended: true,
          priority: CASE
            WHEN next.order_index = (SELECT min(m.order_index) FROM Module m
              WHERE NOT exists((u)-[:PROGRESS {status: 'completed'}]->(m)))
            THEN 'high'
            ELSE 'medium'
          END
        } as recommendation
        ORDER BY next.order_index
        LIMIT 3`,
        { userId }
      );

      return result.records.map(r => r.get('recommendation'));
    } finally {
      await session.close();
    }
  }

  async recordNudge(userId, nudgeData) {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (u:User {id: $userId})
        CREATE (n:Nudge {
          id: randomUUID(),
          type: $type,
          message: $message,
          sent_at: datetime(),
          trigger_reason: $reason
        })
        CREATE (u)-[:RECEIVED]->(n)`,
        {
          userId,
          type: nudgeData.type,
          message: nudgeData.message,
          reason: nudgeData.reason
        }
      );
    } finally {
      await session.close();
    }
  }

  async getUserEngagementScore(userId) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})
        OPTIONAL MATCH (u)-[:HAS_SESSION]->(s:Session)
        OPTIONAL MATCH (u)-[:PROGRESS]->(m:Module)
        OPTIONAL MATCH (u)-[:TOOK]->(q:Quiz)

        WITH u,
          count(DISTINCT s) as session_count,
          count(DISTINCT m) as modules_touched,
          count(DISTINCT q) as quiz_attempts,
          avg(CASE WHEN m IS NOT NULL THEN m.completion_percentage ELSE 0 END) as avg_completion

        RETURN {
          engagement_score: (session_count * 2 + modules_touched * 5 + quiz_attempts * 3) / 100.0,
          session_count: session_count,
          modules_touched: modules_touched,
          quiz_attempts: quiz_attempts,
          avg_completion: avg_completion
        } as score`,
        { userId }
      );

      return result.records[0]?.get('score') || { engagement_score: 0 };
    } finally {
      await session.close();
    }
  }

  // ========================================
  // CONTENT KNOWLEDGE GRAPH MANAGEMENT
  // ========================================

  /**
   * Create course node in graph
   */
  async createCourse(courseData) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MERGE (c:Course {id: $id})
        SET c.moodle_course_id = $moodleCourseId,
            c.name = $name,
            c.code = $code,
            c.description = $description,
            c.category = $category,
            c.source = $source,
            c.created_at = datetime()
        RETURN c`,
        {
          id: courseData.id,
          moodleCourseId: courseData.moodle_course_id,
          name: courseData.course_name,
          code: courseData.course_code,
          description: courseData.description || '',
          category: courseData.category || '',
          source: courseData.source || 'portal'
        }
      );

      logger.info(`Created course node in Neo4j: ${courseData.course_name}`);
      return result.records[0]?.get('c').properties;
    } finally {
      await session.close();
    }
  }

  /**
   * Create module node and link to course
   */
  async createModuleInCourse(moduleData, courseId) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (c:Course {id: $courseId})
        MERGE (m:Module {id: $moduleId})
        SET m.name = $name,
            m.description = $description,
            m.order_index = $sequenceOrder,
            m.module_type = $moduleType,
            m.created_at = datetime()
        MERGE (c)-[:CONTAINS]->(m)
        RETURN m`,
        {
          courseId: courseId,
          moduleId: moduleData.id,
          name: moduleData.module_name,
          description: moduleData.description || '',
          sequenceOrder: moduleData.sequence_order,
          moduleType: moduleData.module_type || 'page'
        }
      );

      logger.info(`Created module node in Neo4j: ${moduleData.module_name}`);
      return result.records[0]?.get('m').properties;
    } finally {
      await session.close();
    }
  }

  /**
   * Create content chunk nodes from document processing
   * Creates Topic nodes and relationships between chunks
   */
  async createContentGraph(moduleId, chunks) {
    const session = this.driver.session();
    try {
      logger.info(`Creating content graph for module ${moduleId} with ${chunks.length} chunks`);

      // Create module node if not exists
      await session.run(
        `MERGE (m:Module {id: $moduleId})
        ON CREATE SET m.created_at = datetime()`,
        { moduleId }
      );

      let topicsCreated = 0;
      let chunksLinked = 0;

      for (const chunk of chunks) {
        // Create chunk node
        await session.run(
          `MATCH (m:Module {id: $moduleId})
          CREATE (chunk:ContentChunk {
            id: $chunkId,
            text: $text,
            chunk_order: $chunkOrder,
            chunk_size: $chunkSize,
            created_at: datetime()
          })
          CREATE (m)-[:HAS_CONTENT]->(chunk)`,
          {
            moduleId: moduleId,
            chunkId: chunk.chunk_id || `chunk_${Date.now()}_${Math.random()}`,
            text: chunk.content.substring(0, 1000), // Limit for graph storage
            chunkOrder: chunk.chunk_index || 0,
            chunkSize: chunk.content.length
          }
        );

        chunksLinked++;

        // Extract and create topic nodes from metadata
        const topics = chunk.metadata?.topics || chunk.metadata?.keywords || [];
        if (topics.length > 0) {
          for (const topic of topics) {
            await session.run(
              `MATCH (chunk:ContentChunk {id: $chunkId})
              MERGE (topic:Topic {name: $topicName})
              ON CREATE SET topic.created_at = datetime()
              MERGE (chunk)-[:DISCUSSES]->(topic)
              WITH topic
              MATCH (m:Module {id: $moduleId})
              MERGE (m)-[:COVERS_TOPIC]->(topic)`,
              {
                chunkId: chunk.chunk_id || `chunk_${Date.now()}_${Math.random()}`,
                topicName: topic.toLowerCase(),
                moduleId: moduleId
              }
            );
            topicsCreated++;
          }
        }
      }

      // Create relationships between sequential chunks
      if (chunks.length > 1) {
        for (let i = 0; i < chunks.length - 1; i++) {
          const currentChunkId = chunks[i].chunk_id || `chunk_${i}`;
          const nextChunkId = chunks[i + 1].chunk_id || `chunk_${i + 1}`;

          await session.run(
            `MATCH (c1:ContentChunk), (c2:ContentChunk)
            WHERE c1.chunk_order = $currentOrder AND c2.chunk_order = $nextOrder
            MERGE (c1)-[:FOLLOWED_BY]->(c2)`,
            {
              currentOrder: i,
              nextOrder: i + 1
            }
          );
        }
      }

      logger.info(`Content graph created: ${chunksLinked} chunks, ${topicsCreated} topic relationships`);
      return { chunks: chunksLinked, topics: topicsCreated };

    } finally {
      await session.close();
    }
  }

  /**
   * Get module content graph visualization data
   */
  async getModuleContentGraph(moduleId) {
    const session = this.driver.session();
    try {
      // Ensure moduleId is an integer
      const moduleIdInt = parseInt(moduleId, 10);

      const result = await session.run(
        `MATCH (m:Module {id: $moduleId})
        OPTIONAL MATCH (m)-[:HAS_CONTENT]->(chunk:ContentChunk)
        OPTIONAL MATCH (m)-[:COVERS_TOPIC]->(topic:Topic)
        OPTIONAL MATCH (chunk)-[:DISCUSSES]->(topic)
        RETURN m,
          collect(DISTINCT chunk) as chunks,
          collect(DISTINCT topic) as topics,
          collect(DISTINCT {chunk: chunk, topic: topic}) as relationships`,
        { moduleId: moduleIdInt }
      );

      if (result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      return {
        module: record.get('m')?.properties,
        chunks: record.get('chunks').map(c => c?.properties).filter(Boolean),
        topics: record.get('topics').map(t => t?.properties).filter(Boolean),
        relationships: record.get('relationships')
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Delete course and all related graph data
   */
  async deleteCourseGraph(moodleCourseId) {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (c:Course {moodle_course_id: $moodleCourseId})
        OPTIONAL MATCH (c)-[:CONTAINS]->(m:Module)
        OPTIONAL MATCH (m)-[:HAS_CONTENT]->(chunk:ContentChunk)
        OPTIONAL MATCH (m)-[:COVERS_TOPIC]->(topic:Topic)
        DETACH DELETE c, m, chunk`,
        { moodleCourseId }
      );

      // Clean up orphaned topics
      await session.run(
        `MATCH (topic:Topic)
        WHERE NOT exists((topic)<-[:COVERS_TOPIC]-())
        DELETE topic`
      );

      logger.info(`Deleted course graph for moodle_course_id: ${moodleCourseId}`);
    } finally {
      await session.close();
    }
  }

  /**
   * Search content by topic
   */
  async searchByTopic(topicName, limit = 10) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (topic:Topic)
        WHERE toLower(topic.name) CONTAINS toLower($topicName)
        MATCH (topic)<-[:DISCUSSES]-(chunk:ContentChunk)
        MATCH (chunk)<-[:HAS_CONTENT]-(m:Module)
        RETURN m.name as module_name,
               m.id as module_id,
               chunk.text as content_preview,
               topic.name as topic
        LIMIT $limit`,
        { topicName, limit }
      );

      return result.records.map(record => ({
        module_name: record.get('module_name'),
        module_id: record.get('module_id'),
        content_preview: record.get('content_preview'),
        topic: record.get('topic')
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Get related content based on topics
   */
  async getRelatedContent(moduleId, limit = 5) {
    const session = this.driver.session();
    try {
      // Ensure moduleId is an integer, not a float or string
      const moduleIdInt = parseInt(moduleId, 10);
      const limitInt = parseInt(limit, 10);

      const result = await session.run(
        `MATCH (m:Module {id: $moduleId})-[:COVERS_TOPIC]->(topic:Topic)
        MATCH (topic)<-[:COVERS_TOPIC]-(related:Module)
        WHERE related.id <> $moduleId
        WITH related, count(topic) as shared_topics
        ORDER BY shared_topics DESC
        LIMIT $limit
        RETURN related.id as module_id,
               related.name as module_name,
               shared_topics`,
        { moduleId: moduleIdInt, limit: limitInt }
      );

      return result.records.map(record => ({
        module_id: record.get('module_id'),
        module_name: record.get('module_name'),
        shared_topics: record.get('shared_topics').toNumber()
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Generic query runner for custom Cypher queries
   * @param {string} query - Cypher query to execute
   * @param {object} params - Parameters for the query
   * @returns {Promise<any>} Query result
   */
  async runQuery(query, params = {}) {
    const session = this.driver.session();
    try {
      const result = await session.run(query, params);
      return result;
    } finally {
      await session.close();
    }
  }

  async close() {
    if (this.driver) {
      await this.driver.close();
      logger.info('Neo4j connection closed');
    }
  }
}

module.exports = new Neo4jService();