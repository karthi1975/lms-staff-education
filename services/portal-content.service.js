/**
 * Portal Content Service
 * Manages portal-created courses and modules (dual-source architecture)
 */

const postgresService = require('./database/postgres.service');
const documentProcessor = require('./document-processor.service');
const chromaService = require('./chroma.service');
const neo4jService = require('./neo4j.service');
const vertexAIService = require('./vertexai.service');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

class PortalContentService {

  /**
   * Create a new portal course
   */
  async createPortalCourse(courseData, adminUserId) {
    try {
      const result = await postgresService.pool.query(`
        INSERT INTO moodle_courses (
          moodle_course_id,
          course_name,
          course_code,
          description,
          category,
          source,
          portal_created_by,
          portal_created_at
        ) VALUES (
          (SELECT COALESCE(MAX(moodle_course_id), 0) + 1 FROM moodle_courses),
          $1, $2, $3, $4, 'portal', $5, NOW()
        )
        RETURNING *
      `, [
        courseData.course_name,
        courseData.course_code || `PORTAL-${Date.now()}`,
        courseData.description || '',
        courseData.category || 'Portal Training',
        adminUserId
      ]);

      const course = result.rows[0];

      // Create course node in Neo4j
      try {
        await neo4jService.createCourse(course);
        logger.info(`Created course node in Neo4j for course ${course.id}`);
      } catch (neo4jError) {
        logger.error('Error creating course in Neo4j:', neo4jError);
        // Don't fail course creation if Neo4j fails
      }

      logger.info(`Created portal course: ${courseData.course_name}`, {
        courseId: course.id,
        adminUserId
      });

      return course;
    } catch (error) {
      logger.error('Error creating portal course:', error);
      throw error;
    }
  }

  /**
   * Create a module for a portal course
   */
  async createPortalModule(courseId, moduleData, adminUserId) {
    try {
      // Get course moodle_course_id
      const courseResult = await postgresService.pool.query(
        'SELECT moodle_course_id, source FROM moodle_courses WHERE id = $1',
        [courseId]
      );

      if (courseResult.rows.length === 0) {
        throw new Error('Course not found');
      }

      const course = courseResult.rows[0];

      // Get next sequence order
      const seqResult = await postgresService.pool.query(`
        SELECT COALESCE(MAX(sequence_order), 0) + 1 as next_seq
        FROM moodle_modules
        WHERE moodle_course_id = $1
      `, [course.moodle_course_id]);

      const sequenceOrder = moduleData.sequence_order || seqResult.rows[0].next_seq;

      const result = await postgresService.pool.query(`
        INSERT INTO moodle_modules (
          moodle_course_id,
          moodle_module_id,
          module_name,
          module_type,
          sequence_order,
          description,
          source,
          portal_created_by,
          portal_created_at
        ) VALUES (
          $1,
          (SELECT COALESCE(MAX(moodle_module_id), 0) + 1 FROM moodle_modules WHERE moodle_course_id = $1),
          $2, 'page', $3, $4, 'portal', $5, NOW()
        )
        RETURNING *
      `, [
        course.moodle_course_id,
        moduleData.module_name,
        sequenceOrder,
        moduleData.description || '',
        adminUserId
      ]);

      const module = result.rows[0];

      // Create module node in Neo4j and link to course
      try {
        await neo4jService.createModuleInCourse(module, courseId);
        logger.info(`Created module node in Neo4j for module ${module.id}`);
      } catch (neo4jError) {
        logger.error('Error creating module in Neo4j:', neo4jError);
        // Don't fail module creation if Neo4j fails
      }

      logger.info(`Created portal module: ${moduleData.module_name}`, {
        moduleId: module.id,
        courseId,
        adminUserId
      });

      return module;
    } catch (error) {
      logger.error('Error creating portal module:', error);
      throw error;
    }
  }

  /**
   * Upload content for a portal module
   * Creates: PostgreSQL chunks + ChromaDB embeddings + Neo4j knowledge graph
   */
  async uploadModuleContent(moduleId, filePath, fileMetadata, adminUserId) {
    try {
      logger.info(`Processing document for module ${moduleId}: ${fileMetadata.originalname}`);

      // Extract text from document
      const chunks = await documentProcessor.processDocument(filePath, {
        module_id: moduleId,
        filename: fileMetadata.originalname,
        source: 'portal'
      });

      if (chunks.length === 0) {
        logger.warn('No chunks created from document');
        return { chunks: 0, embeddings: 0, graph_nodes: 0 };
      }

      logger.info(`Created ${chunks.length} chunks from document`);

      // Store chunks in database and collect chunk IDs for graph
      let storedChunks = 0;
      let storedEmbeddings = 0;
      const chunksWithIds = [];

      for (const chunk of chunks) {
        try {
          // Store chunk in module_content_chunks table
          const chunkResult = await postgresService.pool.query(`
            INSERT INTO module_content_chunks (
              moodle_module_id,
              chunk_text,
              chunk_order,
              chunk_size,
              metadata
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING id
          `, [
            moduleId,
            chunk.content,
            chunk.chunk_index || storedChunks,
            chunk.content.length,
            JSON.stringify(chunk.metadata)
          ]);

          const chunkId = chunkResult.rows[0].id;
          storedChunks++;

          // Add chunk_id to chunk object for Neo4j
          chunksWithIds.push({
            ...chunk,
            chunk_id: chunkId,
            chunk_index: chunk.chunk_index || storedChunks - 1
          });

          // Store in ChromaDB for RAG
          try {
            const embeddingId = await chromaService.addDocument(
              chunk.content,
              {
                ...chunk.metadata,
                chunk_id: chunkId,
                module_id: moduleId,
                source: 'portal'
              }
            );

            // Update chunk with embedding_id
            await postgresService.pool.query(`
              UPDATE module_content_chunks
              SET embedding_id = $1
              WHERE id = $2
            `, [embeddingId, chunkId]);

            storedEmbeddings++;
          } catch (embeddingError) {
            logger.error('Error creating embedding:', embeddingError);
          }
        } catch (chunkError) {
          logger.error('Error storing chunk:', chunkError);
        }
      }

      logger.info(`Stored ${storedChunks} chunks and ${storedEmbeddings} embeddings for module ${moduleId}`);

      // Create knowledge graph in Neo4j
      let graphStats = { chunks: 0, topics: 0 };
      try {
        graphStats = await neo4jService.createContentGraph(moduleId, chunksWithIds);
        logger.info(`Created Neo4j knowledge graph: ${graphStats.chunks} nodes, ${graphStats.topics} topic relationships`);
      } catch (neo4jError) {
        logger.error('Error creating Neo4j knowledge graph:', neo4jError);
        // Don't fail the upload if Neo4j fails
      }

      // Update module with content file path
      await postgresService.pool.query(`
        UPDATE moodle_modules
        SET content_file_path = $1
        WHERE id = $2
      `, [filePath, moduleId]);

      return {
        chunks: storedChunks,
        embeddings: storedEmbeddings,
        graph_nodes: graphStats.chunks,
        graph_topics: graphStats.topics
      };

    } catch (error) {
      logger.error('Error uploading module content:', error);
      throw error;
    }
  }

  /**
   * Generate quiz questions from module content
   */
  async generateQuizForModule(moduleId, questionCount = 5, adminUserId) {
    try {
      // Get module content chunks
      const chunksResult = await postgresService.pool.query(`
        SELECT chunk_text, metadata
        FROM module_content_chunks
        WHERE moodle_module_id = $1
        ORDER BY chunk_order
        LIMIT 10
      `, [moduleId]);

      if (chunksResult.rows.length === 0) {
        throw new Error('No content found for module');
      }

      // Combine chunks into context
      const context = chunksResult.rows
        .map(row => row.chunk_text)
        .join('\n\n')
        .substring(0, 8000); // Limit context size

      // Generate quiz questions using Vertex AI
      const prompt = `Based on the following educational content, generate ${questionCount} multiple-choice quiz questions.

Content:
${context}

Generate questions in JSON format with this structure:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A",
      "explanation": "Brief explanation of why this is correct"
    }
  ]
}

Requirements:
- Mix of difficulty levels (easy, medium, hard)
- Clear, unambiguous questions
- Plausible wrong answers
- Cover different parts of the content
- Return valid JSON only`;

      const response = await vertexAIService.generateText(prompt);

      // Parse JSON response
      let quizData;
      try {
        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          quizData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        logger.error('Error parsing quiz JSON:', parseError);
        logger.error('Raw response:', response);
        throw new Error('Failed to parse quiz questions from AI response');
      }

      // Create quiz in database
      const quizResult = await postgresService.pool.query(`
        INSERT INTO moodle_quizzes (
          moodle_quiz_id,
          moodle_module_id,
          quiz_name,
          quiz_intro,
          attempts_allowed,
          grade_to_pass,
          source
        ) VALUES (
          (SELECT COALESCE(MAX(moodle_quiz_id), 0) + 1 FROM moodle_quizzes),
          $1,
          $2,
          $3,
          2,
          70.0,
          'portal'
        )
        RETURNING id, moodle_quiz_id
      `, [
        moduleId,
        `Quiz - ${new Date().toISOString().split('T')[0]}`,
        'Auto-generated quiz from module content'
      ]);

      const quizId = quizResult.rows[0].id;

      // Store questions
      for (const q of quizData.questions) {
        await postgresService.pool.query(`
          INSERT INTO quiz_questions (
            moodle_quiz_id,
            question_text,
            question_type,
            options,
            correct_answer,
            source
          ) VALUES ($1, $2, 'multichoice', $3, $4, 'portal')
        `, [
          quizId,
          q.question,
          JSON.stringify(q.options),
          q.correct_answer
        ]);
      }

      logger.info(`Generated quiz with ${quizData.questions.length} questions for module ${moduleId}`);

      return {
        quizId: quizId,
        questionCount: quizData.questions.length
      };

    } catch (error) {
      logger.error('Error generating quiz:', error);
      throw error;
    }
  }

  /**
   * List all portal courses
   */
  async listPortalCourses() {
    try {
      const result = await postgresService.pool.query(`
        SELECT
          mc.*,
          au.name as created_by_name,
          (SELECT COUNT(*) FROM moodle_modules mm WHERE mm.moodle_course_id = mc.moodle_course_id) as module_count
        FROM moodle_courses mc
        LEFT JOIN admin_users au ON mc.portal_created_by = au.id
        WHERE mc.source = 'portal'
        ORDER BY mc.created_at DESC
      `);

      return result.rows;
    } catch (error) {
      logger.error('Error listing portal courses:', error);
      throw error;
    }
  }

  /**
   * Get course with modules
   */
  async getCourseWithModules(courseId) {
    try {
      const courseResult = await postgresService.pool.query(`
        SELECT * FROM moodle_courses WHERE id = $1
      `, [courseId]);

      if (courseResult.rows.length === 0) {
        throw new Error('Course not found');
      }

      const course = courseResult.rows[0];

      const modulesResult = await postgresService.pool.query(`
        SELECT
          mm.*,
          (SELECT COUNT(*) FROM module_content_chunks mcc WHERE mcc.moodle_module_id = mm.id) as chunk_count,
          (SELECT COUNT(*) FROM moodle_quizzes mq WHERE mq.moodle_module_id = mm.id) as quiz_count
        FROM moodle_modules mm
        WHERE mm.moodle_course_id = $1
        ORDER BY mm.sequence_order
      `, [course.moodle_course_id]);

      return {
        ...course,
        modules: modulesResult.rows
      };
    } catch (error) {
      logger.error('Error getting course with modules:', error);
      throw error;
    }
  }
}

module.exports = new PortalContentService();
