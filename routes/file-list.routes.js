const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const postgresService = require('../services/database/postgres.service');
const logger = require('../utils/logger');

/**
 * Get all uploaded files for a course with processing status
 * GET /api/admin/courses/:courseId/files
 */
router.get('/courses/:courseId/files',
  authMiddleware.authenticateToken,
  authMiddleware.requireRole(['admin']),
  async (req, res) => {
    try {
      const { courseId } = req.params;

      // Get all files for the course
      const result = await postgresService.pool.query(`
        SELECT
          id,
          file_name,
          original_name,
          file_type,
          file_size,
          uploaded_at,
          processed,
          processing_status,
          processed_at,
          chunk_count,
          error_message
        FROM course_content
        WHERE course_id = $1
        ORDER BY uploaded_at DESC
      `, [courseId]);

      // Get status counts
      const statusCountsResult = await postgresService.pool.query(`
        SELECT
          processing_status,
          COUNT(*) as count
        FROM course_content
        WHERE course_id = $1
        GROUP BY processing_status
      `, [courseId]);

      // Create status counts object
      const statusCounts = {
        uploaded: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        pending: 0
      };

      statusCountsResult.rows.forEach(row => {
        statusCounts[row.processing_status] = parseInt(row.count);
      });

      // Map files with enhanced information
      const files = result.rows.map(file => ({
        id: file.id,
        fileName: file.original_name || file.file_name,
        fileType: file.file_type,
        fileSize: file.file_size,
        uploadedAt: file.uploaded_at,
        processed: file.processed,
        status: file.processing_status || 'pending',
        processedAt: file.processed_at,
        chunkCount: file.chunk_count,
        error: file.error_message
      }));

      // Group files by status
      const filesByStatus = {
        uploaded: files.filter(f => f.status === 'uploaded'),
        processing: files.filter(f => f.status === 'processing'),
        completed: files.filter(f => f.status === 'completed'),
        failed: files.filter(f => f.status === 'failed'),
        pending: files.filter(f => f.status === 'pending')
      };

      res.json({
        success: true,
        files: files,
        filesByStatus: filesByStatus,
        statusCounts: statusCounts,
        total: files.length,
        processed: files.filter(f => f.processed).length,
        pending: files.filter(f => !f.processed).length
      });

    } catch (error) {
      logger.error('Error fetching files:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch files'
      });
    }
  }
);

/**
 * Delete a file from course
 * DELETE /api/admin/courses/:courseId/files/:fileId
 */
router.delete('/courses/:courseId/files/:fileId',
  authMiddleware.authenticateToken,
  authMiddleware.requireRole(['admin']),
  async (req, res) => {
    try {
      const { courseId, fileId } = req.params;

      // Get file info before deleting
      const fileResult = await postgresService.pool.query(
        'SELECT file_name, original_name, file_path FROM course_content WHERE id = $1 AND course_id = $2',
        [fileId, courseId]
      );

      if (fileResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      const file = fileResult.rows[0];
      const fileName = file.original_name || file.file_name;

      logger.info(`Deleting file: ${fileName} (ID: ${fileId})`);

      // Delete from ChromaDB (if indexed)
      try {
        const chromaService = require('../services/chroma.service');
        await chromaService.initialize();

        // Query ChromaDB for chunks with this file_id
        const collection = chromaService.collection;
        const results = await collection.get({
          where: { file_id: parseInt(fileId) }
        });

        if (results && results.ids && results.ids.length > 0) {
          logger.info(`Deleting ${results.ids.length} chunks from ChromaDB for file ${fileId}`);
          await collection.delete({
            where: { file_id: parseInt(fileId) }
          });
        }
      } catch (chromaError) {
        logger.warn('ChromaDB deletion warning:', chromaError.message);
        // Continue with database deletion even if ChromaDB fails
      }

      // Delete physical file (optional)
      if (file.file_path) {
        try {
          const fs = require('fs').promises;
          const path = require('path');
          const fullPath = path.join(process.cwd(), file.file_path);
          await fs.unlink(fullPath);
          logger.info(`Deleted physical file: ${fullPath}`);
        } catch (fsError) {
          logger.warn('Physical file deletion warning:', fsError.message);
          // Continue with database deletion
        }
      }

      // Delete from database
      await postgresService.pool.query(
        'DELETE FROM course_content WHERE id = $1 AND course_id = $2',
        [fileId, courseId]
      );

      logger.info(`File deleted successfully: ${fileName}`);

      res.json({
        success: true,
        message: `File "${fileName}" deleted successfully`,
        fileId: parseInt(fileId)
      });

    } catch (error) {
      logger.error('Error deleting file:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete file'
      });
    }
  }
);

module.exports = router;
