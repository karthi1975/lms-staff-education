/**
 * Simplified Bulk Upload Routes
 * Upload files directly to RAG+Graph DB without module classification
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const authMiddleware = require('../middleware/auth.middleware');
const documentProcessor = require('../services/document-processor.service');
const postgresService = require('../services/database/postgres.service');
const logger = require('../utils/logger');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/course_content');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 100 // Max 100 files at once
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /\.(pdf|docx?|txt)$/i;
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'text/plain' // .txt
    ];

    const extname = allowedExtensions.test(file.originalname.toLowerCase());
    const mimetype = allowedMimeTypes.includes(file.mimetype);

    if (extname || mimetype) {
      // Accept if either extension OR mimetype matches (permissive)
      return cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.originalname}. Only PDF, DOCX, DOC, and TXT files are supported.`));
    }
  }
});

/**
 * @route POST /api/admin/courses/:courseId/simple-upload
 * @desc Upload files to storage (no processing - user must trigger separately)
 * @access Admin
 */
router.post('/courses/:courseId/simple-upload',
  authMiddleware.authenticateToken,
  authMiddleware.requireRole(['admin']),
  upload.array('files', 100),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const adminUserId = req.user.id;
      const uploadedFiles = req.files;

      if (!uploadedFiles || uploadedFiles.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files provided'
        });
      }

      logger.info(`Upload: ${uploadedFiles.length} files for course ${courseId} by admin ${adminUserId}`);

      // Store file metadata in database with status='uploaded'
      const fileRecords = [];
      for (const file of uploadedFiles) {
        // Set uploaded_by to NULL for admin uploads since admins are in admin_users table,
        // not users table (WhatsApp users). The FK constraint only allows users.id or NULL.
        const fileRecord = await postgresService.pool.query(`
          INSERT INTO course_content (
            course_id,
            file_name,
            original_name,
            file_path,
            file_type,
            file_size,
            uploaded_by,
            uploaded_at,
            processed,
            processing_status
          ) VALUES ($1, $2, $3, $4, $5, $6, NULL, NOW(), false, 'uploaded')
          RETURNING id, file_name, file_path
        `, [
          courseId,
          file.filename,
          file.originalname,
          file.path,
          file.mimetype,
          file.size
        ]);

        fileRecords.push({
          id: fileRecord.rows[0].id,
          file_name: file.originalname,
          file_path: file.path,
          file_size: file.size,
          file_type: file.mimetype
        });
      }

      // Return success - files are stored and ready for processing
      res.json({
        success: true,
        total_files: uploadedFiles.length,
        message: `${uploadedFiles.length} file(s) uploaded successfully. Click "Process Files" to start OCR and indexing.`,
        files: fileRecords.map(f => ({
          id: f.id,
          name: f.file_name,
          size: f.file_size
        }))
      });

    } catch (error) {
      logger.error('Upload failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Note: Processing status endpoint and background processing have been moved to file-processing.routes.js
// This keeps upload and processing concerns separated

module.exports = router;
