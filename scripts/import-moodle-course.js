/**
 * Import Moodle Course Script
 * Imports course content from Moodle → PostgreSQL → ChromaDB → Neo4j
 *
 * Usage: node scripts/import-moodle-course.js <courseId>
 * Example: node scripts/import-moodle-course.js 11
 */

const moodleContentService = require('../services/moodle-content.service');
const chromaService = require('../services/chroma.service');
const neo4jService = require('../services/neo4j.service');
const postgresService = require('../services/database/postgres.service');
const embeddingService = require('../services/embedding.service');
const logger = require('../utils/logger');

class MoodleCourseImporter {
  constructor() {
    this.chunkSize = parseInt(process.env.CONTENT_CHUNK_SIZE) || 512;
  }

  /**
   * Main import function
   */
  async importCourse(courseId) {
    try {
      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`📚 Starting Moodle Course Import`);
      logger.info(`Course ID: ${courseId}`);
      logger.info(`${'='.repeat(60)}\n`);

      // Initialize services
      await this.initialize();

      // Step 1: Fetch course structure from Moodle
      logger.info('📡 Step 1: Fetching course structure from Moodle...');
      const { course, modules, quizzes } = await moodleContentService.fetchCourseStructure(courseId);
      logger.info(`✅ Fetched: ${course.fullname}`);
      logger.info(`   - Modules: ${modules.length}`);
      logger.info(`   - Quizzes: ${quizzes.length}\n`);

      // Step 2: Save course to PostgreSQL
      logger.info('💾 Step 2: Saving course to PostgreSQL...');
      const savedCourse = await this.saveCourse(course);
      logger.info(`✅ Course saved: ID ${savedCourse.id}\n`);

      // Step 3: Save modules to PostgreSQL
      logger.info('💾 Step 3: Saving modules to PostgreSQL...');
      const savedModules = await this.saveModules(modules, course.id);
      logger.info(`✅ Saved ${savedModules.length} modules\n`);

      // Step 4: Process module content for RAG
      logger.info('🔍 Step 4: Processing content for RAG...');
      let totalChunks = 0;
      for (const savedModule of savedModules) {
        const chunks = await this.processModuleContent(savedModule, course.shortname);
        totalChunks += chunks;
      }
      logger.info(`✅ Created ${totalChunks} content chunks\n`);

      // Step 5: Save quizzes to PostgreSQL
      logger.info('📝 Step 5: Saving quizzes to PostgreSQL...');
      const savedQuizzes = await this.saveQuizzes(quizzes, savedModules);
      logger.info(`✅ Saved ${savedQuizzes.length} quizzes\n`);

      // Step 6: Import quiz questions
      logger.info('❓ Step 6: Importing quiz questions...');
      let totalQuestions = 0;
      for (const quiz of savedQuizzes) {
        const questions = await this.importQuizQuestions(quiz);
        totalQuestions += questions;
      }
      logger.info(`✅ Imported ${totalQuestions} quiz questions\n`);

      // Step 7: Create Neo4j relationships
      logger.info('🔗 Step 7: Creating Neo4j learning paths...');
      await this.createNeo4jRelationships(savedCourse, savedModules);
      logger.info(`✅ Created learning path graph\n`);

      // Summary
      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`✅ Import Complete!`);
      logger.info(`${'='.repeat(60)}`);
      logger.info(`📊 Summary:`);
      logger.info(`   - Course: ${course.fullname}`);
      logger.info(`   - Modules: ${savedModules.length}`);
      logger.info(`   - Content chunks: ${totalChunks}`);
      logger.info(`   - Quizzes: ${savedQuizzes.length}`);
      logger.info(`   - Quiz questions: ${totalQuestions}`);
      logger.info(`${'='.repeat(60)}\n`);

      return {
        success: true,
        course: savedCourse,
        modules: savedModules,
        quizzes: savedQuizzes,
        totalChunks,
        totalQuestions
      };
    } catch (error) {
      logger.error(`❌ Import failed:`, error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Initialize services
   */
  async initialize() {
    try {
      await chromaService.initialize();
      await neo4jService.initialize();
      logger.info('✅ Services initialized\n');
    } catch (error) {
      logger.error('Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * Save course to database
   */
  async saveCourse(course) {
    const result = await postgresService.query(`
      INSERT INTO moodle_courses (moodle_course_id, course_name, course_code, description, category, moodle_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (moodle_course_id) DO UPDATE
      SET course_name = EXCLUDED.course_name,
          course_code = EXCLUDED.course_code,
          description = EXCLUDED.description,
          updated_at = NOW()
      RETURNING *
    `, [
      course.id,
      course.fullname,
      course.shortname,
      course.summary || '',
      course.categoryname || 'General',
      `${process.env.MOODLE_URL}/course/view.php?id=${course.id}`
    ]);

    return result.rows[0];
  }

  /**
   * Save modules to database
   */
  async saveModules(modules, moodleCourseId) {
    const savedModules = [];

    for (const module of modules) {
      const result = await postgresService.query(`
        INSERT INTO moodle_modules (
          moodle_course_id, moodle_module_id, module_name, module_type,
          sequence_order, content_url, description
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (moodle_course_id, moodle_module_id) DO UPDATE
        SET module_name = EXCLUDED.module_name,
            module_type = EXCLUDED.module_type,
            updated_at = NOW()
        RETURNING *
      `, [
        moodleCourseId,
        module.moodle_module_id,
        module.module_name,
        module.module_type,
        module.sequence_order,
        module.content_url,
        module.description
      ]);

      savedModules.push({
        ...result.rows[0],
        content_text: module.content_text,
        section_name: module.section_name
      });
    }

    return savedModules;
  }

  /**
   * Process module content for RAG
   */
  async processModuleContent(module, courseShortName) {
    if (!module.content_text || module.content_text.trim().length === 0) {
      logger.info(`   ⏭️  Skipping ${module.module_name} (no content)`);
      return 0;
    }

    logger.info(`   📄 Processing: ${module.module_name}`);

    // Chunk content
    const chunks = this.chunkText(module.content_text, this.chunkSize);
    logger.info(`      - Created ${chunks.length} chunks`);

    let savedChunks = 0;

    for (const [index, chunk] of chunks.entries()) {
      try {
        // Generate embedding (note: generateEmbeddings returns array, we take first element)
        const embeddings = await embeddingService.generateEmbeddings(chunk);
        const embedding = Array.isArray(embeddings[0]) ? embeddings[0] : embeddings;

        // Create unique ID for ChromaDB
        const embeddingId = `${courseShortName}_${module.module_name}_chunk_${index}`
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .substring(0, 255);

        // Store in ChromaDB
        await chromaService.addDocument({
          id: embeddingId,
          content: chunk,
          metadata: {
            course: courseShortName,
            module: module.module_name,
            module_id: module.id,
            module_type: module.module_type,
            chunk_index: index,
            moodle_module_id: module.moodle_module_id,
            section: module.section_name || 'General'
          },
          embedding
        });

        // Save chunk reference in PostgreSQL
        await postgresService.query(`
          INSERT INTO module_content_chunks (
            moodle_module_id, chunk_text, chunk_order, chunk_size,
            embedding_id, metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT DO NOTHING
        `, [
          module.id,
          chunk,
          index,
          chunk.length,
          embeddingId,
          JSON.stringify({
            section: module.section_name,
            module_type: module.module_type
          })
        ]);

        savedChunks++;
      } catch (error) {
        logger.error(`      ❌ Failed to process chunk ${index}:`, error.message);
      }
    }

    logger.info(`      ✅ Saved ${savedChunks} chunks to RAG\n`);
    return savedChunks;
  }

  /**
   * Chunk text into smaller pieces
   */
  chunkText(text, maxSize) {
    const chunks = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (currentChunk.length + trimmed.length + 2 <= maxSize) {
        currentChunk += (currentChunk ? '. ' : '') + trimmed;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk + '.');
        }
        currentChunk = trimmed;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk + '.');
    }

    return chunks;
  }

  /**
   * Save quizzes to database
   */
  async saveQuizzes(quizzes, savedModules) {
    const savedQuizzes = [];

    for (const quiz of quizzes) {
      // Find matching module
      const module = savedModules.find(m => m.moodle_module_id === quiz.coursemodule);

      if (!module) {
        logger.warn(`   ⚠️  Quiz ${quiz.name} has no matching module, skipping`);
        continue;
      }

      const result = await postgresService.query(`
        INSERT INTO moodle_quizzes (
          moodle_quiz_id, moodle_module_id, quiz_name, quiz_intro,
          time_limit, attempts_allowed, grade_to_pass
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (moodle_quiz_id) DO UPDATE
        SET quiz_name = EXCLUDED.quiz_name,
            updated_at = NOW()
        RETURNING *
      `, [
        quiz.id,
        module.id,
        quiz.name,
        quiz.intro || '',
        quiz.timelimit || 0,
        quiz.attempts || 0,
        quiz.gradepass || 0
      ]);

      savedQuizzes.push(result.rows[0]);
      logger.info(`   ✅ Quiz: ${quiz.name}`);
    }

    return savedQuizzes;
  }

  /**
   * Import quiz questions
   */
  async importQuizQuestions(quiz) {
    try {
      logger.info(`   📝 Fetching questions for: ${quiz.quiz_name}`);

      const questions = await moodleContentService.getQuizQuestions(quiz.moodle_quiz_id);

      for (const question of questions) {
        await postgresService.query(`
          INSERT INTO quiz_questions (
            module_id, moodle_quiz_id, moodle_question_id,
            question_text, question_type, options, sequence_order
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT DO NOTHING
        `, [
          quiz.moodle_module_id,
          quiz.id,
          question.moodle_question_id,
          question.question_text,
          question.question_type,
          JSON.stringify(question.options),
          question.sequence_order
        ]);
      }

      logger.info(`      ✅ Imported ${questions.length} questions\n`);
      return questions.length;
    } catch (error) {
      logger.error(`      ❌ Failed to import quiz questions:`, error.message);
      return 0;
    }
  }

  /**
   * Create Neo4j learning path relationships
   */
  async createNeo4jRelationships(course, modules) {
    try {
      // Create course node
      await neo4jService.runQuery(`
        MERGE (c:Course {moodle_id: $moodleId})
        SET c.name = $name,
            c.code = $code,
            c.description = $description
      `, {
        moodleId: course.moodle_course_id,
        name: course.course_name,
        code: course.course_code,
        description: course.description
      });

      // Create module nodes and relationships
      for (const [index, module] of modules.entries()) {
        // Create module node
        await neo4jService.runQuery(`
          MERGE (m:Module {moodle_id: $moodleId})
          SET m.name = $name,
              m.type = $type,
              m.order = $order
        `, {
          moodleId: module.moodle_module_id,
          name: module.module_name,
          type: module.module_type,
          order: module.sequence_order
        });

        // Link to course
        await neo4jService.runQuery(`
          MATCH (c:Course {moodle_id: $courseId})
          MATCH (m:Module {moodle_id: $moduleId})
          MERGE (c)-[:HAS_MODULE]->(m)
        `, {
          courseId: course.moodle_course_id,
          moduleId: module.moodle_module_id
        });

        // Link to previous module (learning path)
        if (index > 0) {
          const prevModule = modules[index - 1];
          await neo4jService.runQuery(`
            MATCH (m1:Module {moodle_id: $prevModuleId})
            MATCH (m2:Module {moodle_id: $currModuleId})
            MERGE (m1)-[:PRECEDES]->(m2)
          `, {
            prevModuleId: prevModule.moodle_module_id,
            currModuleId: module.moodle_module_id
          });
        }
      }

      logger.info(`   ✅ Created course and ${modules.length} module nodes`);
      logger.info(`   ✅ Created ${modules.length - 1} sequential relationships`);
    } catch (error) {
      logger.error('Failed to create Neo4j relationships:', error);
    }
  }

  /**
   * Cleanup
   */
  async cleanup() {
    try {
      await neo4jService.close();
    } catch (error) {
      logger.error('Cleanup error:', error);
    }
  }
}

// Main execution
if (require.main === module) {
  const courseId = process.argv[2] || 11; // Default to Business Studies

  const importer = new MoodleCourseImporter();
  importer.importCourse(parseInt(courseId))
    .then(result => {
      logger.info('✅ Import completed successfully');
      process.exit(0);
    })
    .catch(error => {
      logger.error('❌ Import failed:', error);
      process.exit(1);
    });
}

module.exports = MoodleCourseImporter;
