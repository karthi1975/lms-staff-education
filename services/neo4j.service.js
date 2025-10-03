const neo4j = require('neo4j-driver');
const logger = require('../utils/logger');

class Neo4jService {
  constructor() {
    this.driver = null;
  }

  async initialize() {
    try {
      const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
      const user = process.env.NEO4J_USER || 'neo4j';
      const password = process.env.NEO4J_PASSWORD || 'password';

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
        'CREATE CONSTRAINT quiz_id IF NOT EXISTS FOR (q:Quiz) REQUIRE q.id IS UNIQUE'
      ];

      for (const constraint of constraints) {
        try {
          await session.run(constraint);
        } catch (e) {
          // Constraint might already exist
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

  async close() {
    if (this.driver) {
      await this.driver.close();
      logger.info('Neo4j connection closed');
    }
  }
}

module.exports = new Neo4jService();