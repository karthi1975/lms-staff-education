/**
 * Bilingual Document Upload Routes
 * Handles English and Swahili documents with OCR support
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const authMiddleware = require('../middleware/auth.middleware');
const documentProcessor = require('../services/document-processor.service');
const bilingualRAG = require('../services/bilingual-rag.service');
const bilingualChroma = require('../services/bilingual-chroma.service');
const postgresService = require('../services/database/postgres.service');
const logger = require('../utils/logger');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/bilingual');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /\.(pdf|docx|doc|txt|md|png|jpg|jpeg)$/i;
    const allowedMimetypes = /^(application\/pdf|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/msword|text\/plain|text\/markdown|image\/png|image\/jpeg)$/;

    const hasValidExtension = allowedExtensions.test(file.originalname);
    const hasValidMimetype = allowedMimetypes.test(file.mimetype);

    if (hasValidExtension || hasValidMimetype) {
      return cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}. Only PDF, DOCX, TXT, MD, and image files are allowed`));
    }
  }
});

/**
 * @route POST /api/admin/courses/:courseId/upload-bilingual
 * @desc Upload bilingual document with OCR and language detection
 * @access Authenticated Admin (RBAC enforced on course visibility only)
 */
router.post('/courses/:courseId/upload-bilingual',
  authMiddleware.authenticateToken,
  // Note: No role check - Regional admins can upload to courses they can access
  // RBAC is enforced on which courses they can SEE, not upload permissions
  upload.array('files', 10),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const { moduleId, language } = req.body; // language: 'auto', 'english', 'swahili'
      const files = req.files;

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded'
        });
      }

      logger.info(`[BilingualUpload] Processing ${files.length} files for course ${courseId}`);

      const results = [];

      for (const file of files) {
        try {
          const fileResult = await processFile({
            file,
            courseId: parseInt(courseId),
            moduleId: moduleId ? parseInt(moduleId) : null,
            language: language || 'auto',
            adminUserId: req.user.id
          });

          results.push(fileResult);

        } catch (fileError) {
          logger.error(`[BilingualUpload] Error processing ${file.originalname}:`, fileError);
          results.push({
            filename: file.originalname,
            success: false,
            error: fileError.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      res.json({
        success: true,
        processed: results.length,
        succeeded: successCount,
        failed: failureCount,
        results: results
      });

    } catch (error) {
      logger.error('[BilingualUpload] Upload failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Process a single file with OCR + RAG + GraphDB
 */
async function processFile({ file, courseId, moduleId, language, adminUserId }) {
  const startTime = Date.now();
  let cleanupNeeded = false;

  try {
    // Step 1: Extract text with OCR support
    logger.info(`[BilingualUpload] Extracting text from ${file.originalname}...`);

    const chunks = await documentProcessor.processDocument(file.path, {
      filename: file.originalname,
      course_id: courseId,
      module_id: moduleId,
      ocrPageLimit: 0 // Full OCR processing
    });

    if (chunks.length === 0) {
      throw new Error('No text could be extracted from document');
    }

    // Step 2: Detect language from chunks
    const fullText = chunks.map(c => c.content).join('\n');
    const detectedLanguage = language === 'auto' ?
      bilingualChroma.detectLanguage(fullText) : language;

    logger.info(`[BilingualUpload] Detected language: ${detectedLanguage} (${file.originalname})`);

    // Step 3: Record in PostgreSQL FIRST and get file_id
    const fileInsertResult = await postgresService.pool.query(`
      INSERT INTO course_content (
        course_id,
        file_name,
        original_name,
        file_path,
        file_type,
        file_size,
        processing_status,
        language,
        chunks_count,
        processed_at,
        uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
      RETURNING id
    `, [
      courseId,
      file.filename,
      file.originalname,
      file.path,
      file.mimetype,
      file.size,
      'completed',
      detectedLanguage,
      chunks.length,
      adminUserId
    ]);

    const fileId = fileInsertResult.rows[0].id;

    // Step 4: Store each chunk in ChromaDB with file_id for download links
    const chromaIds = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      const chromaResult = await bilingualRAG.addDocument({
        content: chunk.content,
        language: detectedLanguage,
        courseId,
        moduleId,
        metadata: {
          file_id: fileId,  // CRITICAL: Store file_id for download links
          filename: file.originalname,
          file_size: file.size,
          chunk_index: i,
          total_chunks: chunks.length,
          source: 'admin_upload',
          uploaded_by: adminUserId,
          content_type: chunk.metadata.content_type || 'narrative'
        }
      });

      chromaIds.push(chromaResult.id);
    }

    logger.info(`[BilingualUpload] Stored ${chunks.length} chunks with file_id ${fileId} for ${file.originalname}`);

    // Step 5: Clean up uploaded file
    cleanupNeeded = true;
    await fs.unlink(file.path);

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

    logger.info(`[BilingualUpload] ✅ Processed ${file.originalname}: ${chunks.length} chunks, ${detectedLanguage}, ${processingTime}s`);

    return {
      filename: file.originalname,
      success: true,
      language: detectedLanguage,
      chunks: chunks.length,
      chromaIds: chromaIds,
      processingTime: `${processingTime}s`,
      fileSize: file.size
    };

  } catch (error) {
    logger.error(`[BilingualUpload] Error processing ${file.originalname}:`, error);

    // Cleanup file on error
    if (cleanupNeeded === false && file.path) {
      try {
        await fs.unlink(file.path);
      } catch (unlinkError) {
        logger.error('Failed to cleanup file:', unlinkError);
      }
    }

    throw error;
  }
}

/**
 * @route GET /api/admin/courses/:courseId/bilingual-stats
 * @desc Get statistics for bilingual content
 * @access Authenticated Admin
 */
router.get('/courses/:courseId/bilingual-stats',
  authMiddleware.authenticateToken,
  async (req, res) => {
    try {
      const { courseId } = req.params;

      // Get document counts by language
      const docStats = await postgresService.pool.query(`
        SELECT
          language,
          COUNT(*) as document_count,
          SUM(chunks_count) as total_chunks,
          SUM(file_size) as total_size
        FROM course_content
        WHERE course_id = $1 AND processing_status = 'completed'
        GROUP BY language
      `, [courseId]);

      // Get ChromaDB stats
      const chromaStats = await bilingualChroma.getStats();

      // Get RAG stats
      const ragStats = await bilingualRAG.getStats();

      res.json({
        success: true,
        courseId: parseInt(courseId),
        documents: docStats.rows,
        chroma: chromaStats,
        rag: ragStats
      });

    } catch (error) {
      logger.error('[BilingualUpload] Error getting stats:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/admin/courses/:courseId/query-bilingual
 * @desc Query bilingual RAG system
 * @access Authenticated Admin
 */
router.post('/courses/:courseId/query-bilingual',
  authMiddleware.authenticateToken,
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const { query, language, moduleId } = req.body;

      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Query is required'
        });
      }

      // Fetch course name
      let courseName = null;
      const courseResult = await postgresService.pool.query(
        'SELECT title FROM courses WHERE id = $1',
        [courseId]
      );
      if (courseResult.rows.length > 0) {
        courseName = courseResult.rows[0].title;
      }

      // Fetch module name if moduleId is provided
      let moduleName = null;
      if (moduleId) {
        const moduleResult = await postgresService.pool.query(
          'SELECT title FROM modules WHERE id = $1',
          [moduleId]
        );
        if (moduleResult.rows.length > 0) {
          moduleName = moduleResult.rows[0].title;
        }
      }

      const result = await bilingualRAG.queryContent(query, {
        language: language || 'auto',
        courseId: parseInt(courseId),
        courseName: courseName,
        moduleId: moduleId ? parseInt(moduleId) : null,
        moduleName: moduleName,
        userId: req.user.id,
        limit: 8, // Increased from 3 to 8 for better context coverage
        includeGraph: true,
        format: 'web' // Generate Markdown citations with clickable links
      });

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      logger.error('[BilingualUpload] Query error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

module.exports = router;
