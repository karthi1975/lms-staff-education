const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const postgresService = require('../services/database/postgres.service');
const documentProcessor = require('../services/document-processor.service');
const chromaService = require('../services/chroma.service');
// const contentService = require('../services/content.service'); // Disabled - has dependency issues
const authMiddleware = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760') // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.txt', '.pdf', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .txt, .pdf, and .docx files are allowed.'));
    }
  }
});

/**
 * @route GET /api/admin/modules
 * @desc Get all modules
 * @access Admin
 */
router.get('/modules', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const result = await postgresService.pool.query(`
      SELECT
        id,
        title,
        description,
        sequence_order,
        is_active,
        created_at,
        (SELECT COUNT(*) FROM module_content mc WHERE mc.module_id = modules.id) as content_count
      FROM modules
      WHERE is_active = true
      ORDER BY sequence_order
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching modules:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/admin/modules/:moduleId
 * @desc Get module by ID
 * @access Admin
 */
router.get('/modules/:moduleId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { moduleId } = req.params;

    const result = await postgresService.pool.query(`
      SELECT
        id,
        title,
        description,
        sequence_order,
        is_active,
        created_at
      FROM modules
      WHERE id = $1 AND is_active = true
    `, [parseInt(moduleId)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error(`Error fetching module ${req.params.moduleId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/admin/modules/:moduleId/content
 * @desc Get all content for a module
 * @access Admin
 */
router.get('/modules/:moduleId/content', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { moduleId } = req.params;

    const result = await postgresService.pool.query(`
      SELECT
        mc.id,
        mc.file_name,
        mc.original_name,
        mc.file_type,
        mc.chunk_count,
        mc.uploaded_at,
        mc.processed,
        au.name as uploaded_by_name
      FROM module_content mc
      LEFT JOIN admin_users au ON mc.uploaded_by = au.id
      WHERE mc.module_id = $1
      ORDER BY mc.uploaded_at DESC
    `, [parseInt(moduleId)]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error(`Error fetching content for module ${req.params.moduleId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/admin/modules/:moduleId/content
 * @desc Upload content file for a module
 * @access Admin
 */
router.post('/modules/:moduleId/content',
  authMiddleware.authenticateToken,
  upload.single('file'),
  async (req, res) => {
    try {
      const { moduleId } = req.params;
      const uploadedById = req.user.id;

      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      // Insert content record into database
      const result = await postgresService.pool.query(`
        INSERT INTO module_content (
          module_id,
          file_name,
          original_name,
          file_path,
          file_type,
          file_size,
          chunk_count,
          uploaded_by,
          processed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, file_name, original_name, file_type, file_size, uploaded_at
      `, [
        parseInt(moduleId),
        req.file.filename,
        req.file.originalname,
        req.file.path,
        path.extname(req.file.originalname).substring(1).toLowerCase(),
        req.file.size,
        0, // chunk_count will be updated after processing
        uploadedById,
        false
      ]);

      const contentRecord = result.rows[0];

      // Process file in background (don't wait for completion)
      setImmediate(async () => {
        try {
          logger.info(`Starting background processing for: ${req.file.originalname}`);

          // Prepare metadata for chunking
          const baseMetadata = {
            module_id: parseInt(moduleId),
            content_id: contentRecord.id,
            filename: req.file.originalname,
            uploadedAt: new Date().toISOString()
          };

          // Process document into chunks
          const chunks = await documentProcessor.processDocument(req.file.path, baseMetadata);

          if (chunks.length === 0) {
            logger.warn(`No chunks created for ${req.file.originalname}`);
            return;
          }

          logger.info(`Created ${chunks.length} chunks for ${req.file.originalname}`);

          // Store chunks in ChromaDB
          let storedCount = 0;
          for (const chunk of chunks) {
            try {
              await chromaService.addDocument(chunk.content, chunk.metadata);
              storedCount++;
            } catch (error) {
              logger.error(`Error storing chunk in ChromaDB:`, error);
            }
          }

          logger.info(`Stored ${storedCount}/${chunks.length} chunks in ChromaDB`);

          // Update database - mark as processed and update chunk count
          await postgresService.pool.query(`
            UPDATE module_content
            SET processed = true, processed_at = NOW(), chunk_count = $1
            WHERE id = $2
          `, [chunks.length, contentRecord.id]);

          logger.info(`File processed successfully: ${req.file.originalname} (${chunks.length} chunks)`);

        } catch (processError) {
          logger.error('Error in background processing:', processError);

          // Mark as failed in database
          await postgresService.pool.query(`
            UPDATE module_content
            SET processed = false, metadata = jsonb_set(
              COALESCE(metadata, '{}'::jsonb),
              '{processing_error}',
              to_jsonb($1::text)
            )
            WHERE id = $2
          `, [processError.message, contentRecord.id]);
        }
      });

      res.json({
        success: true,
        message: 'File uploaded successfully. Processing in background.',
        data: contentRecord
      });

    } catch (error) {
      logger.error('Error uploading content:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * @route DELETE /api/admin/content/:contentId
 * @desc Delete content file
 * @access Admin
 */
router.delete('/content/:contentId',
  authMiddleware.authenticateToken,
  authMiddleware.requireRole(['admin']),
  async (req, res) => {
    try {
      const { contentId } = req.params;

      // Get file info before deleting
      const fileResult = await postgresService.pool.query(
        'SELECT file_name, file_path FROM module_content WHERE id = $1',
        [parseInt(contentId)]
      );

      if (fileResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Content not found' });
      }

      const { file_name: fileName, file_path: filePath } = fileResult.rows[0];

      // Delete chunks from ChromaDB vector store
      try {
        await chromaService.deleteByMetadata({ content_id: parseInt(contentId) });
        logger.info(`Deleted vector embeddings for content ID: ${contentId}`);
      } catch (chromaError) {
        logger.error('Error deleting from ChromaDB:', chromaError);
        // Continue with deletion even if ChromaDB fails
      }

      // Delete physical file
      try {
        await fs.unlink(filePath);
        logger.info(`Deleted physical file: ${filePath}`);
      } catch (fileError) {
        logger.error('Error deleting physical file:', fileError);
        // Continue with deletion even if file doesn't exist
      }

      // Delete from database
      await postgresService.pool.query(
        'DELETE FROM module_content WHERE id = $1',
        [parseInt(contentId)]
      );

      logger.info(`Content fully deleted: ${fileName} (ID: ${contentId})`);

      res.json({
        success: true,
        message: 'Content and all related data deleted successfully'
      });

    } catch (error) {
      logger.error(`Error deleting content ${req.params.contentId}:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * @route GET /api/admin/users
 * @desc Get all users with progress summary
 * @access Admin
 */
router.get('/users', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const postgresService = require('../services/database/postgres.service');

    // Query users with aggregated progress stats
    const result = await postgresService.pool.query(`
      SELECT
        u.id,
        u.name,
        u.whatsapp_id,
        u.created_at,
        u.last_active_at,
        COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN up.module_id END) as modules_completed,
        COUNT(DISTINCT CASE WHEN up.status = 'in_progress' THEN up.module_id END) as modules_in_progress,
        COUNT(DISTINCT CASE WHEN qa.passed = true THEN qa.module_id END) as quizzes_passed,
        COALESCE(SUM(up.time_spent_minutes), 0) as total_time_spent_minutes
      FROM users u
      LEFT JOIN user_progress up ON u.id = up.user_id
      LEFT JOIN quiz_attempts qa ON u.id = qa.user_id
      WHERE u.is_active = true
      GROUP BY u.id, u.name, u.whatsapp_id, u.created_at, u.last_active_at
      ORDER BY u.last_active_at DESC NULLS LAST, u.created_at DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/admin/users/:userId/progress
 * @desc Get detailed progress for a user
 * @access Admin or User (with guest token)
 */
router.get('/users/:userId/progress', async (req, res) => {
  try {
    const { userId } = req.params;
    const authHeader = req.headers.authorization;

    // Allow guest tokens for user self-viewing
    if (!authHeader || (!authHeader.startsWith('Bearer ') && !authHeader.includes('guest-token'))) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get user progress from database
    const result = await postgresService.pool.query(`
      SELECT
        up.id,
        up.module_id,
        m.title as module_title,
        m.description as module_description,
        up.status,
        up.progress_percentage,
        up.started_at,
        up.completed_at,
        up.time_spent_minutes,
        up.last_activity_at,
        (SELECT COUNT(*) FROM quiz_attempts qa
         WHERE qa.user_id = up.user_id AND qa.module_id = up.module_id AND qa.passed = true) as quizzes_passed
      FROM user_progress up
      JOIN modules m ON m.id = up.module_id
      WHERE up.user_id = $1
      ORDER BY m.sequence_order
    `, [parseInt(userId)]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error(`Error fetching progress for user ${req.params.userId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/admin/bulk-upload
 * @desc Bulk upload content from training-content directory
 * @access Admin
 */
router.post('/bulk-upload',
  authMiddleware.authenticateToken,
  authMiddleware.requireRole(['admin']),
  async (req, res) => {
    try {
      const directoryPath = path.join(__dirname, '../training-content');
      const uploadedById = req.user.id;

      // TODO: Implement bulk upload from directory
      // This would scan the directory, read files, and upload them to the database
      logger.warn('Bulk upload endpoint not yet implemented');

      res.status(501).json({
        success: false,
        error: 'Bulk upload feature not yet implemented. Please use single file upload.'
      });

    } catch (error) {
      logger.error('Error in bulk upload:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * @route GET /api/user-progress/:userId
 * @desc Get user progress with module details
 * @access Admin
 */
router.get('/user-progress/:userId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const postgresService = require('../services/database/postgres.service');

    const result = await postgresService.pool.query(`
      SELECT
        up.id,
        up.module_id,
        m.title as module_title,
        up.status,
        up.progress_percentage,
        up.started_at,
        up.completed_at,
        up.time_spent_minutes,
        up.last_activity_at
      FROM user_progress up
      JOIN modules m ON m.id = up.module_id
      WHERE up.user_id = $1
      ORDER BY m.sequence_order
    `, [parseInt(userId)]);

    res.json({
      success: true,
      modules: result.rows
    });
  } catch (error) {
    logger.error(`Error fetching user progress for ${req.params.userId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/admin/chat
 * @desc Chat with module content using RAG
 * @access Admin
 */
router.post('/chat', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { module_id, message } = req.body;

    if (!module_id || !message) {
      return res.status(400).json({
        success: false,
        error: 'module_id and message are required'
      });
    }

    // Query ChromaDB for relevant content
    const relevantDocs = await chromaService.query(message, {
      module_id: parseInt(module_id),
      n_results: 3
    });

    let context = '';
    let sources = [];

    if (relevantDocs && relevantDocs.length > 0) {
      context = relevantDocs.map(doc => doc.content).join('\n\n');
      sources = relevantDocs.map(doc => doc.metadata?.filename || 'Training Content');
      // Remove duplicates
      sources = [...new Set(sources)];
    }

    // Build prompt for AI
    const prompt = `You are a helpful teaching assistant for a teacher training program.
You are answering questions about training content.

${context ? `CONTEXT FROM TRAINING MATERIALS:
${context}

` : ''}USER QUESTION: ${message}

Provide a clear, helpful answer based on the training materials${context ? '' : ' (note: no specific content was found, so provide general teaching guidance)'}. Be concise but informative.`;

    // Call Vertex AI for response
    const vertexAI = require('../services/vertexai.service');
    const aiResponse = await vertexAI.generateText(prompt);

    res.json({
      success: true,
      response: aiResponse,
      sources: sources,
      has_context: relevantDocs.length > 0
    });

  } catch (error) {
    logger.error('Error in chat endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat message',
      details: error.message
    });
  }
});

/**
 * @route GET /api/admin/quiz/:moduleId
 * @desc Get quiz questions for a module
 * @access Admin
 */
router.get('/quiz/:moduleId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { moduleId } = req.params;

    const result = await postgresService.pool.query(`
      SELECT
        id,
        question_text,
        question_type,
        options,
        difficulty,
        points,
        sequence_order
      FROM quiz_questions
      WHERE module_id = $1 AND is_active = true
      ORDER BY sequence_order
    `, [parseInt(moduleId)]);

    res.json({
      success: true,
      questions: result.rows
    });
  } catch (error) {
    logger.error(`Error fetching quiz for module ${req.params.moduleId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/admin/quiz/:moduleId/submit
 * @desc Submit quiz answers
 * @access Admin (for testing) or User
 */
router.post('/quiz/:moduleId/submit', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { answers } = req.body; // { questionId: userAnswer }
    const userId = req.user.id;

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Answers object is required'
      });
    }

    // Get correct answers
    const questionsResult = await postgresService.pool.query(`
      SELECT id, correct_answer, points
      FROM quiz_questions
      WHERE module_id = $1 AND is_active = true
    `, [parseInt(moduleId)]);

    const questions = questionsResult.rows;
    let score = 0;
    let totalPoints = 0;

    // Calculate score
    questions.forEach(q => {
      totalPoints += q.points;
      if (answers[q.id] && answers[q.id].trim() === q.correct_answer.trim()) {
        score += q.points;
      }
    });

    const percentage = Math.round((score / totalPoints) * 100);
    const passed = percentage >= 70; // 70% pass threshold

    // Get attempt number
    const attemptsResult = await postgresService.pool.query(`
      SELECT COUNT(*) as count
      FROM quiz_attempts
      WHERE user_id = $1 AND module_id = $2
    `, [userId, parseInt(moduleId)]);

    const attemptNumber = parseInt(attemptsResult.rows[0].count) + 1;

    // Save attempt
    await postgresService.pool.query(`
      INSERT INTO quiz_attempts (
        user_id,
        module_id,
        attempt_number,
        score,
        total_questions,
        passed,
        answers
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      userId,
      parseInt(moduleId),
      attemptNumber,
      percentage,
      questions.length,
      passed,
      JSON.stringify(answers)
    ]);

    res.json({
      success: true,
      score: percentage,
      passed: passed,
      attempt_number: attemptNumber,
      points_earned: score,
      total_points: totalPoints
    });

  } catch (error) {
    logger.error('Error submitting quiz:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
