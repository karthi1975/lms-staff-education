/**
 * Content Processing Service
 * Handles background processing of module content with status tracking
 */

const portalContentService = require('./portal-content.service');
const postgresService = require('./database/postgres.service');
const logger = require('../utils/logger');

class ContentProcessorService {
  constructor() {
    // In-memory processing status tracking
    // Structure: { moduleId: { status, stage, progress, message, started, completed, error, stats } }
    this.processingStatus = {};
  }

  /**
   * Process all content files for a module
   */
  async processModuleContent(moduleId, adminUserId) {
    try {
      // Initialize status
      this.processingStatus[moduleId] = {
        status: 'processing',
        stage: 'initializing',
        progress: 0,
        message: 'Initializing content processing...',
        started: new Date(),
        completed: false,
        error: null,
        stats: {
          totalFiles: 0,
          processedFiles: 0,
          totalChunks: 0,
          failedFiles: 0
        }
      };

      logger.info(`Starting content processing for module ${moduleId}`);
      this.updateStatus(moduleId, 'initializing', 10, 'Fetching content files...');

      // Get all content files for this module
      const contentResult = await postgresService.pool.query(`
        SELECT id, file_path, original_name, file_name, processed
        FROM module_content
        WHERE module_id = $1
        ORDER BY uploaded_at DESC
      `, [moduleId]);

      const files = contentResult.rows;
      this.processingStatus[moduleId].stats.totalFiles = files.length;

      if (files.length === 0) {
        this.updateStatus(moduleId, 'completed', 100, 'No files to process', {
          completed: true,
          stats: { totalFiles: 0, processedFiles: 0, totalChunks: 0, failedFiles: 0 }
        });
        return { success: true, message: 'No files to process' };
      }

      this.updateStatus(moduleId, 'processing', 20, `Found ${files.length} file(s) to process`);

      // Process each file
      let totalChunks = 0;
      let processedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileNum = i + 1;
        const baseProgress = 20 + (60 * i / files.length);

        try {
          this.updateStatus(
            moduleId,
            'ocr',
            baseProgress + 10,
            `Processing file ${fileNum}/${files.length}: ${file.original_name || file.file_name}`
          );

          // Re-process the file using portal content service
          // This will do: OCR → chunking → embedding → ChromaDB → Neo4j
          const result = await portalContentService.uploadModuleContent(
            moduleId,
            file.file_path,
            {
              originalname: file.original_name || file.file_name,
              mimetype: this.getMimeType(file.file_path),
              size: 0 // Not critical for reprocessing
            },
            adminUserId,
            file.original_name || file.file_name
          );

          totalChunks += result.chunks || 0;
          processedCount++;

          this.updateStatus(
            moduleId,
            'indexing',
            baseProgress + 15,
            `Indexed ${result.chunks} chunks from ${file.original_name || file.file_name}`
          );

        } catch (fileError) {
          logger.error(`Error processing file ${file.id}:`, fileError);
          failedCount++;
          this.updateStatus(
            moduleId,
            'error',
            baseProgress + 15,
            `Failed to process ${file.original_name || file.file_name}: ${fileError.message}`
          );
        }
      }

      // Complete
      this.updateStatus(moduleId, 'completed', 100, 'Processing complete', {
        completed: true,
        stats: {
          totalFiles: files.length,
          processedFiles: processedCount,
          totalChunks: totalChunks,
          failedFiles: failedCount
        }
      });

      logger.info(`Completed processing for module ${moduleId}: ${processedCount}/${files.length} files, ${totalChunks} chunks`);

      return {
        success: true,
        stats: {
          totalFiles: files.length,
          processedFiles: processedCount,
          totalChunks: totalChunks,
          failedFiles: failedCount
        }
      };

    } catch (error) {
      logger.error(`Error in processModuleContent for module ${moduleId}:`, error);
      this.updateStatus(moduleId, 'error', 0, `Processing failed: ${error.message}`, {
        completed: true,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update processing status
   */
  updateStatus(moduleId, stage, progress, message, additionalData = {}) {
    if (!this.processingStatus[moduleId]) {
      this.processingStatus[moduleId] = {
        status: 'processing',
        stage: stage,
        progress: 0,
        message: '',
        started: new Date(),
        completed: false,
        error: null,
        stats: { totalFiles: 0, processedFiles: 0, totalChunks: 0, failedFiles: 0 }
      };
    }

    this.processingStatus[moduleId] = {
      ...this.processingStatus[moduleId],
      stage: stage,
      progress: Math.min(100, Math.max(0, progress)),
      message: message,
      ...additionalData
    };

    logger.debug(`Processing status for module ${moduleId}: ${stage} - ${progress}% - ${message}`);
  }

  /**
   * Get processing status for a module
   */
  getStatus(moduleId) {
    return this.processingStatus[moduleId] || null;
  }

  /**
   * Clear status for a module (cleanup)
   */
  clearStatus(moduleId) {
    delete this.processingStatus[moduleId];
  }

  /**
   * Get MIME type from file extension
   */
  getMimeType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const mimeTypes = {
      'pdf': 'application/pdf',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'doc': 'application/msword',
      'txt': 'text/plain'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Start processing in background (non-blocking)
   */
  async startBackgroundProcessing(moduleId, adminUserId) {
    // Start processing without awaiting
    this.processModuleContent(moduleId, adminUserId).catch(error => {
      logger.error(`Background processing error for module ${moduleId}:`, error);
    });

    return { success: true, message: 'Processing started in background' };
  }
}

module.exports = new ContentProcessorService();
