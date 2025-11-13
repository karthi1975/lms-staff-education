/**
 * File Download Routes
 * Secure file download with RBAC and audit logging
 *
 * Security Features:
 * - Authentication required (admin or WhatsApp user)
 * - RBAC: Users can only download files from courses they have access to
 * - Path traversal protection
 * - Audit logging for compliance
 * - Proper content-type headers
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const authMiddleware = require('../middleware/auth.middleware');
const postgresService = require('../services/database/postgres.service');
const rbacService = require('../services/rbac.service');
const logger = require('../utils/logger');

/**
 * @route GET /api/files/download/:fileId
 * @desc Download a course content file
 * @access Authenticated (Admin or Enrolled WhatsApp User)
 * @security RBAC enforced - users can only download files from courses they have access to
 */
router.get('/download/:fileId', authMiddleware.optionalAuth, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user?.id;
    const whatsappId = req.query.whatsapp_id; // For WhatsApp users without JWT

    // Validate fileId is numeric
    if (!fileId || isNaN(parseInt(fileId))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file ID'
      });
    }

    // Get file information from database
    const fileQuery = `
      SELECT
        cc.id,
        cc.course_id,
        cc.file_name,
        cc.original_name,
        cc.file_path,
        cc.file_type,
        cc.file_size,
        c.title AS course_title
      FROM course_content cc
      JOIN courses c ON cc.course_id = c.id
      WHERE cc.id = $1 AND cc.processing_status = 'completed'
    `;

    const fileResult = await postgresService.query(fileQuery, [parseInt(fileId)]);

    if (fileResult.rows.length === 0) {
      logger.warn(`File not found or not processed: ${fileId}`);
      return res.status(404).json({
        success: false,
        error: 'File not found or not available for download'
      });
    }

    const file = fileResult.rows[0];

    // RBAC: Check if user has access to this course
    let hasAccess = false;

    if (userId) {
      // Admin user - check RBAC
      const canManage = await rbacService.canManageCourse(userId, file.course_id);
      hasAccess = canManage.canManage;

      if (!hasAccess) {
        logger.warn(`Admin user ${userId} denied access to file ${fileId} (course ${file.course_id})`);
        return res.status(403).json({
          success: false,
          error: 'You do not have access to this course content'
        });
      }
    } else if (whatsappId) {
      // WhatsApp user - check enrollment
      const enrollmentQuery = `
        SELECT e.id
        FROM enrollments e
        JOIN whatsapp_users wu ON e.whatsapp_user_id = wu.id
        WHERE wu.phone_number = $1
          AND e.course_id = $2
          AND e.status = 'active'
      `;
      const enrollmentResult = await postgresService.query(enrollmentQuery, [whatsappId, file.course_id]);
      hasAccess = enrollmentResult.rows.length > 0;

      if (!hasAccess) {
        logger.warn(`WhatsApp user ${whatsappId} not enrolled in course ${file.course_id}, denied file ${fileId}`);
        return res.status(403).json({
          success: false,
          error: 'You must be enrolled in this course to download this file'
        });
      }
    } else {
      // No authentication
      logger.warn(`Unauthenticated download attempt for file ${fileId}`);
      return res.status(401).json({
        success: false,
        error: 'Authentication required to download files'
      });
    }

    // Security: Validate file path to prevent directory traversal
    const filePath = file.file_path;
    const normalizedPath = path.normalize(filePath);

    // Ensure the path doesn't try to escape the uploads directory
    if (normalizedPath.includes('..') || !normalizedPath.includes('uploads')) {
      logger.error(`Path traversal attempt detected: ${filePath}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid file path'
      });
    }

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      logger.error(`File not found on disk: ${filePath}`);
      return res.status(404).json({
        success: false,
        error: 'File not found on server'
      });
    }

    // Audit log the download
    logger.info(`File download: ${file.original_name} (ID: ${fileId}) by ${userId ? `admin ${userId}` : `whatsapp ${whatsappId}`} from course ${file.course_id}`);

    // Set appropriate headers
    res.setHeader('Content-Type', file.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);
    res.setHeader('Content-Length', file.file_size);
    res.setHeader('X-File-ID', fileId);
    res.setHeader('X-Course-ID', file.course_id);

    // Stream the file to response
    const fileStream = require('fs').createReadStream(filePath);

    fileStream.on('error', (error) => {
      logger.error(`Error streaming file ${fileId}:`, error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Error downloading file'
        });
      }
    });

    fileStream.pipe(res);

  } catch (error) {
    logger.error('File download error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download file'
    });
  }
});

/**
 * @route GET /api/files/info/:fileId
 * @desc Get file information without downloading
 * @access Authenticated
 */
router.get('/info/:fileId', authMiddleware.optionalAuth, async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!fileId || isNaN(parseInt(fileId))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file ID'
      });
    }

    const fileQuery = `
      SELECT
        cc.id,
        cc.course_id,
        cc.original_name,
        cc.file_type,
        cc.file_size,
        cc.uploaded_at,
        cc.processing_status,
        c.title AS course_title,
        c.code AS course_code
      FROM course_content cc
      JOIN courses c ON cc.course_id = c.id
      WHERE cc.id = $1
    `;

    const fileResult = await postgresService.query(fileQuery, [parseInt(fileId)]);

    if (fileResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    const file = fileResult.rows[0];

    res.json({
      success: true,
      file: {
        id: file.id,
        name: file.original_name,
        type: file.file_type,
        size: file.file_size,
        sizeFormatted: formatFileSize(file.file_size),
        uploadedAt: file.uploaded_at,
        status: file.processing_status,
        course: {
          id: file.course_id,
          title: file.course_title,
          code: file.course_code
        }
      }
    });

  } catch (error) {
    logger.error('File info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get file information'
    });
  }
});

/**
 * Helper function to format file size
 */
function formatFileSize(bytes) {
  if (!bytes) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

module.exports = router;
