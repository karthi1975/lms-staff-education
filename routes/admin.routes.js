const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const contentService = require('../services/content.service');
const portalContentService = require('../services/portal-content.service');
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
    const modules = await contentService.getModules();
    res.json({ success: true, data: modules });
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
    const module = await contentService.getModuleById(moduleId);

    if (!module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    res.json({ success: true, data: module });
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
    const content = await contentService.getModuleContent(moduleId);
    res.json({ success: true, data: content });
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
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // Handle multer-specific errors
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            error: `File too large. Maximum size is ${Math.round(parseInt(process.env.UPLOAD_MAX_SIZE || '104857600') / 1024 / 1024)}MB`
          });
        }
        return res.status(400).json({ success: false, error: err.message });
      } else if (err) {
        // Handle other errors
        return res.status(400).json({ success: false, error: err.message });
      }
      next();
    });
  },
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
    const users = await contentService.getAllUsersProgress();
    // Return in expected format with data property
    res.json({ success: true, data: users || [] });
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

// ==================== PORTAL COURSE MANAGEMENT ====================

/**
 * @route POST /api/admin/portal/courses
 * @desc Create a new portal course manually
 * @access Admin
 */
router.post('/portal/courses', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { course_name, course_code, description, category } = req.body;
    const adminUserId = req.user.id;

    if (!course_name) {
      return res.status(400).json({ success: false, error: 'Course name is required' });
    }

    const course = await portalContentService.createPortalCourse({
      course_name,
      course_code,
      description,
      category
    }, adminUserId);

    res.json({
      success: true,
      message: 'Course created successfully',
      data: course
    });
  } catch (error) {
    logger.error('Error creating portal course:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/admin/courses
 * @desc Get all courses (portal and Moodle)
 * @access Admin
 */
router.get('/courses', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const postgresService = require('../services/database/postgres.service');

    const result = await postgresService.pool.query(`
      SELECT
        mc.*,
        (SELECT COUNT(*) FROM moodle_modules mm WHERE mm.moodle_course_id = mc.moodle_course_id) as module_count,
        CASE
          WHEN mc.source = 'portal' THEN 'Portal'
          WHEN mc.source = 'moodle' THEN 'Moodle'
          ELSE 'Unknown'
        END as source_display
      FROM moodle_courses mc
      ORDER BY mc.created_at DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching courses:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/admin/portal/courses/:courseId
 * @desc Get course with all modules
 * @access Admin
 */
router.get('/portal/courses/:courseId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const courseData = await portalContentService.getCourseWithModules(parseInt(courseId));

    res.json({
      success: true,
      data: courseData
    });
  } catch (error) {
    logger.error('Error fetching course:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/admin/portal/courses/:courseId/modules
 * @desc Add a module to a portal course
 * @access Admin
 */
router.post('/portal/courses/:courseId/modules', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { module_name, description, sequence_order } = req.body;
    const adminUserId = req.user.id;

    if (!module_name) {
      return res.status(400).json({ success: false, error: 'Module name is required' });
    }

    const module = await portalContentService.createPortalModule(
      parseInt(courseId),
      { module_name, description, sequence_order },
      adminUserId
    );

    res.json({
      success: true,
      message: 'Module created successfully',
      data: module
    });
  } catch (error) {
    logger.error('Error creating module:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/admin/portal/courses/:courseId/modules/:moduleId/upload
 * @desc Upload content file for a portal module (creates RAG + GraphDB)
 * @access Admin
 */
router.post('/portal/courses/:courseId/modules/:moduleId/upload',
  authMiddleware.authenticateToken,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            error: `File too large. Maximum size is ${Math.round(parseInt(process.env.UPLOAD_MAX_SIZE || '104857600') / 1024 / 1024)}MB`
          });
        }
        return res.status(400).json({ success: false, error: err.message });
      } else if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const { moduleId } = req.params;
      const adminUserId = req.user.id;

      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      const result = await portalContentService.uploadModuleContent(
        parseInt(moduleId),
        req.file.path,
        req.file,
        adminUserId
      );

      res.json({
        success: true,
        message: 'Content uploaded and processed successfully (RAG + GraphDB)',
        data: result
      });

    } catch (error) {
      logger.error('Error uploading module content:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * @route GET /api/admin/modules/:moduleId/graph
 * @desc Get knowledge graph data for a module
 * @access Admin
 */
router.get('/modules/:moduleId/graph', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const neo4jService = require('../services/neo4j.service');

    const graphData = await neo4jService.getModuleContentGraph(parseInt(moduleId));

    if (!graphData) {
      return res.status(404).json({
        success: false,
        error: 'No graph data found for this module'
      });
    }

    res.json({
      success: true,
      data: graphData
    });

  } catch (error) {
    logger.error(`Error fetching graph for module ${req.params.moduleId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/admin/modules/:moduleId/related
 * @desc Get related content modules based on topics
 * @access Admin
 */
router.get('/modules/:moduleId/related', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const neo4jService = require('../services/neo4j.service');

    const relatedContent = await neo4jService.getRelatedContent(parseInt(moduleId));

    res.json({
      success: true,
      data: relatedContent
    });

  } catch (error) {
    logger.error(`Error fetching related content for module ${req.params.moduleId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/admin/search/topic/:topicName
 * @desc Search content by topic in knowledge graph
 * @access Admin
 */
router.get('/search/topic/:topicName', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { topicName } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const neo4jService = require('../services/neo4j.service');

    const results = await neo4jService.searchByTopic(topicName, limit);

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    logger.error(`Error searching for topic ${req.params.topicName}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route DELETE /api/admin/courses/:courseId
 * @desc Delete a course and all its related data
 * @access Admin
 */
router.delete('/courses/:courseId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const postgresService = require('../services/database/postgres.service');
    const neo4jService = require('../services/neo4j.service');
    const chromaService = require('../services/chroma.service');

    // Get course details
    const courseResult = await postgresService.pool.query(
      'SELECT * FROM moodle_courses WHERE id = $1',
      [courseId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Course not found' });
    }

    const course = courseResult.rows[0];
    const moodleCourseId = course.moodle_course_id;

    // Get all modules for this course
    const modulesResult = await postgresService.pool.query(
      'SELECT id FROM moodle_modules WHERE moodle_course_id = $1',
      [moodleCourseId]
    );

    const moduleIds = modulesResult.rows.map(row => row.id);

    // Delete from Neo4j
    try {
      await neo4jService.deleteCourseGraph(moodleCourseId);
      logger.info(`Deleted Neo4j graph for course ${moodleCourseId}`);
    } catch (neo4jError) {
      logger.warn('Error deleting from Neo4j:', neo4jError);
    }

    // Delete from ChromaDB
    try {
      for (const moduleId of moduleIds) {
        await chromaService.deleteByModule(moduleId);
      }
      logger.info(`Deleted ChromaDB vectors for ${moduleIds.length} modules`);
    } catch (chromaError) {
      logger.warn('Error deleting from ChromaDB:', chromaError);
    }

    // Delete from PostgreSQL (cascading deletes should handle related records)
    await postgresService.pool.query('BEGIN');

    try {
      // Delete quiz attempts (use moodle_quiz_id, not quiz_id)
      await postgresService.pool.query(`
        DELETE FROM quiz_attempts
        WHERE moodle_quiz_id IN (
          SELECT id FROM moodle_quizzes
          WHERE moodle_module_id IN (
            SELECT id FROM moodle_modules WHERE moodle_course_id = $1
          )
        )
      `, [moodleCourseId]);

      // Delete quiz questions
      await postgresService.pool.query(`
        DELETE FROM quiz_questions
        WHERE moodle_quiz_id IN (
          SELECT id FROM moodle_quizzes
          WHERE moodle_module_id IN (
            SELECT id FROM moodle_modules WHERE moodle_course_id = $1
          )
        )
      `, [moodleCourseId]);

      // Delete quizzes
      await postgresService.pool.query(`
        DELETE FROM moodle_quizzes
        WHERE moodle_module_id IN (
          SELECT id FROM moodle_modules WHERE moodle_course_id = $1
        )
      `, [moodleCourseId]);

      // Delete content chunks
      await postgresService.pool.query(`
        DELETE FROM module_content_chunks
        WHERE moodle_module_id IN (
          SELECT id FROM moodle_modules WHERE moodle_course_id = $1
        )
      `, [moodleCourseId]);

      // Delete modules
      await postgresService.pool.query(
        'DELETE FROM moodle_modules WHERE moodle_course_id = $1',
        [moodleCourseId]
      );

      // Delete course
      await postgresService.pool.query(
        'DELETE FROM moodle_courses WHERE id = $1',
        [courseId]
      );

      await postgresService.pool.query('COMMIT');

      res.json({
        success: true,
        message: 'Course and all related data deleted successfully'
      });
    } catch (dbError) {
      await postgresService.pool.query('ROLLBACK');
      throw dbError;
    }

  } catch (error) {
    logger.error('Error deleting course:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
