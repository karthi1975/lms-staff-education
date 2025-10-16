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
        INSERT INTO courses (
          title,
          code,
          description,
          category,
          difficulty_level,
          duration_weeks,
          sequence_order,
          is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          (SELECT COALESCE(MAX(sequence_order), 0) + 1 FROM courses),
          true
        )
        RETURNING *
      `, [
        courseData.course_name || courseData.title,
        courseData.course_code || courseData.code || `PORTAL-${Date.now()}`,
        courseData.description || '',
        courseData.category || 'Portal Training',
        courseData.difficulty_level || 'beginner',
        courseData.duration_weeks || 4
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

      logger.info(`Created portal course: ${courseData.course_name || courseData.title}`, {
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
      // Verify course exists
      const courseResult = await postgresService.pool.query(
        'SELECT id FROM courses WHERE id = $1',
        [courseId]
      );

      if (courseResult.rows.length === 0) {
        throw new Error('Course not found');
      }

      // Get next sequence order
      const seqResult = await postgresService.pool.query(`
        SELECT COALESCE(MAX(sequence_order), 0) + 1 as next_seq
        FROM modules
        WHERE course_id = $1
      `, [courseId]);

      const sequenceOrder = moduleData.sequence_order || seqResult.rows[0].next_seq;

      const result = await postgresService.pool.query(`
        INSERT INTO modules (
          course_id,
          title,
          description,
          sequence_order,
          is_active
        ) VALUES (
          $1, $2, $3, $4, true
        )
        RETURNING *
      `, [
        courseId,
        moduleData.module_name || moduleData.title,
        moduleData.description || '',
        sequenceOrder
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

      logger.info(`Created portal module: ${moduleData.module_name || moduleData.title}`, {
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
   * Creates: module_content record + ChromaDB embeddings + Neo4j knowledge graph
   */
  async uploadModuleContent(moduleId, filePath, fileMetadata, adminUserId, originalFile = null) {
    try {
      // Use provided original_file or fall back to uploaded filename
      const sourceFile = originalFile || fileMetadata.originalname;

      logger.info(`Processing document for module ${moduleId}: ${sourceFile}`);

      // First, create the module_content record
      const contentResult = await postgresService.pool.query(`
        INSERT INTO module_content (
          module_id,
          file_name,
          original_name,
          file_path,
          file_type,
          file_size,
          uploaded_by,
          uploaded_at,
          processed,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), false, $8)
        RETURNING id
      `, [
        moduleId,
        path.basename(filePath),
        sourceFile,  // Use source file name
        filePath,
        fileMetadata.mimetype,
        fileMetadata.size,
        adminUserId,
        JSON.stringify({ source: 'portal', original_file: sourceFile })
      ]);

      const contentId = contentResult.rows[0].id;

      // Extract text from document
      const chunks = await documentProcessor.processDocument(filePath, {
        module_id: moduleId,
        content_id: contentId,
        filename: sourceFile,  // Use source file name
        original_file: sourceFile,  // Add original_file metadata
        source: 'portal'
      });

      if (chunks.length === 0) {
        logger.warn('No chunks created from document');
        return { chunks: 0, embeddings: 0, graph_nodes: 0 };
      }

      logger.info(`Created ${chunks.length} chunks from document`);

      // Extract full text for module_content.content_text
      const fullText = chunks.map(c => c.content).join('\n\n');

      // Store chunks and embeddings
      let storedEmbeddings = 0;
      const chunksWithIds = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
          // Store in ChromaDB for RAG
          const embeddingId = await chromaService.addDocument(
            chunk.content,
            {
              ...chunk.metadata,
              module_id: moduleId,
              content_id: contentId,
              chunk_index: i,
              source: 'portal'
            }
          );

          // Collect for Neo4j graph
          chunksWithIds.push({
            ...chunk,
            chunk_id: `${contentId}-${i}`,
            chunk_index: i,
            embedding_id: embeddingId
          });

          storedEmbeddings++;
        } catch (embeddingError) {
          logger.error('Error creating embedding:', embeddingError);
        }
      }

      logger.info(`Stored ${chunks.length} chunks and ${storedEmbeddings} embeddings for module ${moduleId}`);

      // Create knowledge graph in Neo4j
      let graphStats = { chunks: 0, topics: 0 };
      try {
        graphStats = await neo4jService.createContentGraph(moduleId, chunksWithIds);
        logger.info(`Created Neo4j knowledge graph: ${graphStats.chunks} nodes, ${graphStats.topics} topic relationships`);
      } catch (neo4jError) {
        logger.error('Error creating Neo4j knowledge graph:', neo4jError);
        // Don't fail the upload if Neo4j fails
      }

      // Update module_content with extracted text and chunk count
      await postgresService.pool.query(`
        UPDATE module_content
        SET content_text = $1,
            chunk_count = $2,
            processed = true,
            processed_at = NOW()
        WHERE id = $3
      `, [fullText.substring(0, 100000), chunks.length, contentId]);

      return {
        contentId: contentId,
        chunks: chunks.length,
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
      // Get module content
      const contentResult = await postgresService.pool.query(`
        SELECT content_text
        FROM module_content
        WHERE module_id = $1
        ORDER BY uploaded_at DESC
        LIMIT 1
      `, [moduleId]);

      if (contentResult.rows.length === 0) {
        throw new Error('No content found for module');
      }

      // Get content text
      const context = contentResult.rows[0].content_text.substring(0, 8000); // Limit context size

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
          c.*,
          (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) as module_count
        FROM courses c
        WHERE c.is_active = true
        ORDER BY c.created_at DESC
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
        SELECT * FROM courses WHERE id = $1
      `, [courseId]);

      if (courseResult.rows.length === 0) {
        throw new Error('Course not found');
      }

      const course = courseResult.rows[0];

      const modulesResult = await postgresService.pool.query(`
        SELECT
          m.*,
          (SELECT COUNT(*) FROM module_content mc WHERE mc.module_id = m.id) as content_count
        FROM modules m
        WHERE m.course_id = $1
        ORDER BY m.sequence_order
      `, [courseId]);

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
