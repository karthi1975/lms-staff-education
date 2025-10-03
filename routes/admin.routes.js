const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const postgresService = require('../services/database/postgres.service');
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

      const content = await contentService.uploadContent(
        parseInt(moduleId),
        req.file,
        uploadedById
      );

      res.json({
        success: true,
        message: 'File uploaded successfully. Processing in background.',
        data: content
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
      await contentService.deleteContent(parseInt(contentId));

      res.json({
        success: true,
        message: 'Content deleted successfully'
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

    const progress = await contentService.getUserProgress(parseInt(userId));
    res.json({ success: true, data: progress });
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

      const results = await contentService.bulkUploadFromDirectory(directoryPath, uploadedById);

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      res.json({
        success: true,
        message: `Bulk upload completed: ${successCount} succeeded, ${failureCount} failed`,
        data: results
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

module.exports = router;
