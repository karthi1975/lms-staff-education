/**
 * File Processing Routes
 * Handles background file processing with status tracking
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const documentProcessor = require('../services/document-processor.service');
const chromaService = require('../services/chroma.service');
const embeddingService = require('../services/embedding.service');
const postgresService = require('../services/database/postgres.service');
const logger = require('../utils/logger');

// In-memory job storage (consider Redis for production)
const processingJobs = new Map();

/**
 * @route POST /api/admin/courses/:courseId/process-files
 * @desc Start background file processing (OCR + RAG + Graph DB)
 * @access Admin
 */
router.post('/courses/:courseId/process-files',
  authMiddleware.authenticateToken,
  authMiddleware.requireRole(['admin']),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const adminUserId = req.user.id;

      // Query database for files with status='uploaded'
      const uploadedFilesResult = await postgresService.pool.query(`
        SELECT id, course_id, file_name, original_name, file_path, file_type, file_size
        FROM course_content
        WHERE course_id = $1 AND processing_status = 'uploaded'
        ORDER BY uploaded_at ASC
      `, [courseId]);

      const files = uploadedFilesResult.rows;

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No uploaded files found for processing'
        });
      }

      // Generate job ID
      const jobId = `job-${courseId}-${Date.now()}`;

      logger.info(`Starting background processing job ${jobId} for ${files.length} files`);

      // Initialize job status
      const jobStatus = {
        jobId: jobId,
        courseId: parseInt(courseId),
        totalFiles: files.length,
        processedFiles: 0,
        status: 'processing',
        startTime: new Date().toISOString(),
        currentFile: null,
        errors: [],
        progress: 0,
        estimatedMinutes: Math.ceil(files.length * 5) // ~5 min per file average
      };

      processingJobs.set(jobId, jobStatus);

      // Start processing in background (don't await)
      processFilesInBackground(jobId, courseId, files, adminUserId).catch(error => {
        logger.error(`Background processing failed for job ${jobId}:`, error);
        const job = processingJobs.get(jobId);
        if (job) {
          job.status = 'failed';
          job.errors.push({
            file: 'System',
            error: error.message
          });
        }
      });

      // Return immediately
      res.json({
        success: true,
        job_id: jobId,
        total_files: files.length,
        estimated_minutes: jobStatus.estimatedMinutes,
        message: 'Processing started in background'
      });

    } catch (error) {
      logger.error('Failed to start file processing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/admin/courses/:courseId/processing-status/:jobId
 * @desc Get current processing status for a job
 * @access Admin
 */
router.get('/courses/:courseId/processing-status/:jobId',
  authMiddleware.authenticateToken,
  authMiddleware.requireRole(['admin']),
  async (req, res) => {
    try {
      const { jobId } = req.params;

      const jobStatus = processingJobs.get(jobId);

      if (!jobStatus) {
        return res.status(404).json({
          success: false,
          error: 'Processing job not found'
        });
      }

      // Calculate estimated remaining time
      let estimatedRemaining = 'N/A';
      if (jobStatus.status === 'processing' && jobStatus.processedFiles > 0) {
        const elapsed = (new Date() - new Date(jobStatus.startTime)) / 1000 / 60; // minutes
        const avgTimePerFile = elapsed / jobStatus.processedFiles;
        const remainingFiles = jobStatus.totalFiles - jobStatus.processedFiles;
        const remainingMinutes = Math.ceil(avgTimePerFile * remainingFiles);
        estimatedRemaining = `${remainingMinutes} min`;
      }

      res.json({
        success: true,
        job_id: jobStatus.jobId,
        status: jobStatus.status,
        progress: jobStatus.progress,
        total_files: jobStatus.totalFiles,
        processed_files: jobStatus.processedFiles,
        current_file: jobStatus.currentFile,
        errors: jobStatus.errors,
        start_time: jobStatus.startTime,
        estimated_remaining: estimatedRemaining
      });

    } catch (error) {
      logger.error('Failed to get processing status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Background processing function
 * Processes files one by one and updates job status
 */
async function processFilesInBackground(jobId, courseId, files, adminUserId) {
  const job = processingJobs.get(jobId);

  if (!job) {
    logger.error(`Job ${jobId} not found in processing jobs`);
    return;
  }

  logger.info(`🚀 Background processing started for job ${jobId} - ${files.length} files`);

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Update database status to 'processing' before starting
      await postgresService.pool.query(`
        UPDATE course_content
        SET processing_status = 'processing'
        WHERE id = $1
      `, [file.id]);

      // Update current file status
      job.currentFile = {
        name: file.original_name,
        operation: 'Starting OCR and text extraction...'
      };
      job.progress = Math.round((i / files.length) * 100);

      logger.info(`📄 Processing file ${i + 1}/${files.length}: ${file.original_name}`);

      try {
        // Update operation status
        job.currentFile.operation = 'Full OCR processing (all pages)...';

        logger.info(`🔍 Processing ${file.original_name} - Size: ${file.file_size} bytes`);

        // STEP 1: OCR + Chunking
        const result = await documentProcessor.processDocument(
          file.file_path,
          {
            originalname: file.original_name,
            mimetype: file.file_type || 'application/pdf',
            size: file.file_size || 0
          },
          {
            course_id: parseInt(courseId),
            source: file.original_name,
            upload_date: new Date().toISOString(),
            uploaded_by: adminUserId
          }
        );

        const chunks = result.chunks || result || [];
        logger.info(`📝 Extracted ${chunks.length} chunks from ${file.original_name}`);

        if (chunks.length === 0) {
          throw new Error('No chunks extracted from document');
        }

        // STEP 2: Index to ChromaDB (RAG)
        job.currentFile.operation = `Indexing ${chunks.length} chunks to RAG (generating embeddings)...`;

        // Ensure ChromaDB is initialized
        await chromaService.initialize();

        for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
          const chunk = chunks[chunkIdx];

          // Update progress for chunk indexing
          job.currentFile.operation = `Indexing chunk ${chunkIdx + 1}/${chunks.length} to RAG...`;

          // Prepare metadata
          const metadata = {
            course_id: parseInt(courseId),
            file_id: file.id,
            file_name: file.original_name,
            chunk_index: chunkIdx,
            total_chunks: chunks.length,
            source: file.original_name,
            upload_date: new Date().toISOString()
          };

          // Get chunk content (handle different chunk formats)
          const content = chunk.content || chunk.text || chunk;

          if (!content || typeof content !== 'string') {
            logger.warn(`Skipping invalid chunk ${chunkIdx} in ${file.original_name}`);
            continue;
          }

          // Add to ChromaDB (this automatically generates embeddings)
          await chromaService.addDocument(content, metadata);
        }

        logger.info(`✅ Indexed ${chunks.length} chunks to ChromaDB for ${file.original_name}`);

        // Update database record to 'completed'
        await postgresService.pool.query(`
          UPDATE course_content
          SET processed = true,
              processing_status = 'completed',
              processed_at = NOW(),
              chunk_count = $1
          WHERE id = $2
        `, [chunks.length, file.id]);

        logger.info(`✅ Successfully processed ${file.original_name}: ${chunks.length} chunks indexed to RAG`);

        // Update progress
        job.processedFiles++;
        job.progress = Math.round((job.processedFiles / files.length) * 100);

      } catch (fileError) {
        logger.error(`❌ Failed to process file ${file.original_name}:`, fileError);

        job.errors.push({
          file: file.original_name,
          error: fileError.message
        });

        // Update database record to 'failed'
        await postgresService.pool.query(`
          UPDATE course_content
          SET processing_status = 'failed',
              error_message = $1
          WHERE id = $2
        `, [fileError.message, file.id]);

        // Continue with next file even if this one failed
        job.processedFiles++;
        job.progress = Math.round((job.processedFiles / files.length) * 100);
      }
    }

    // All files processed
    job.status = job.errors.length === 0 ? 'completed' : 'completed_with_errors';
    job.currentFile = null;
    job.progress = 100;

    logger.info(`✅ Background processing completed for job ${jobId}: ${job.processedFiles}/${files.length} files, ${job.errors.length} errors`);

    // Clean up job after 24 hours
    setTimeout(() => {
      processingJobs.delete(jobId);
      logger.info(`🗑️  Cleaned up job ${jobId}`);
    }, 24 * 60 * 60 * 1000);

  } catch (error) {
    logger.error(`💥 Fatal error in background processing for job ${jobId}:`, error);
    job.status = 'failed';
    job.errors.push({
      file: 'System',
      error: error.message
    });
  }
}

module.exports = router;
