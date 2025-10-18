const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const contentService = require('../services/content.service');
const portalContentService = require('../services/portal-content.service');
const contentProcessorService = require('../services/content-processor.service');
const verificationService = require('../services/verification.service');
const enrollmentService = require('../services/enrollment.service');
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
 * @route POST /api/admin/courses
 * @desc Create a new course
 * @access Admin
 */
router.post('/courses', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { code, title, description, category, difficulty_level, duration_weeks, sequence_order } = req.body;
    const postgresService = require('../services/database/postgres.service');

    if (!code || !title) {
      return res.status(400).json({ success: false, error: 'Course code and title are required' });
    }

    // Check if course with this code already exists - if so, return it instead of error
    const existingCourse = await postgresService.pool.query(
      'SELECT * FROM courses WHERE code = $1',
      [code]
    );

    if (existingCourse.rows.length > 0) {
      // Return existing course as success (idempotent operation)
      return res.json({
        success: true,
        message: 'Course already exists',
        course: existingCourse.rows[0],
        existing: true
      });
    }

    const result = await postgresService.pool.query(`
      INSERT INTO courses (code, title, description, category, difficulty_level, duration_weeks, sequence_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [code, title, description, category, difficulty_level, duration_weeks || 24, sequence_order || 1]);

    res.json({
      success: true,
      message: 'Course created successfully',
      course: result.rows[0],
      existing: false
    });
  } catch (error) {
    logger.error('Error creating course:', error);
    // Handle unique constraint violation (fallback)
    if (error.code === '23505') {
      // Race condition - fetch and return the existing course
      const existingCourse = await postgresService.pool.query(
        'SELECT * FROM courses WHERE code = $1',
        [code]
      );
      if (existingCourse.rows.length > 0) {
        return res.json({
          success: true,
          message: 'Course already exists',
          course: existingCourse.rows[0],
          existing: true
        });
      }
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/admin/portal/courses
 * @desc Create a new course (portal UI compatibility)
 * @access Admin
 */
router.post('/portal/courses', authMiddleware.authenticateToken, async (req, res) => {
  try {
    // Map portal UI fields to courses table schema
    const { course_name, course_code, description, category } = req.body;
    const postgresService = require('../services/database/postgres.service');

    if (!course_name) {
      return res.status(400).json({ success: false, error: 'Course name is required' });
    }

    const code = course_code || `COURSE-${Date.now()}`;

    // Check if course with this code already exists - if so, return it instead of error
    const existingCourse = await postgresService.pool.query(
      'SELECT * FROM courses WHERE code = $1',
      [code]
    );

    if (existingCourse.rows.length > 0) {
      // Return existing course as success (idempotent operation)
      return res.json({
        success: true,
        message: 'Course already exists',
        course: existingCourse.rows[0],
        existing: true
      });
    }

    const result = await postgresService.pool.query(`
      INSERT INTO courses (code, title, description, category, sequence_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [code, course_name, description, category || 'General', 1]);

    res.json({
      success: true,
      message: 'Course created successfully',
      course: result.rows[0],
      existing: false
    });
  } catch (error) {
    logger.error('Error creating course:', error);
    // Handle unique constraint violation (fallback)
    if (error.code === '23505') {
      // Race condition - fetch and return the existing course
      const existingCourse = await postgresService.pool.query(
        'SELECT * FROM courses WHERE code = $1',
        [course_code || `COURSE-${Date.now()}`]
      );
      if (existingCourse.rows.length > 0) {
        return res.json({
          success: true,
          message: 'Course already exists',
          course: existingCourse.rows[0],
          existing: true
        });
      }
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/admin/courses
 * @desc Get all courses
 * @access Admin
 */
router.get('/courses', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const postgresService = require('../services/database/postgres.service');

    const result = await postgresService.pool.query(`
      SELECT
        c.*,
        (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) as module_count
      FROM courses c
      ORDER BY c.sequence_order, c.created_at DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching courses:', error);
    res.json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/admin/portal/courses
 * @desc Get all courses (portal UI compatibility)
 * @access Admin
 */
router.get('/portal/courses', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const postgresService = require('../services/database/postgres.service');

    const result = await postgresService.pool.query(`
      SELECT
        c.id,
        c.id as moodle_course_id,
        c.code as course_code,
        c.title as course_name,
        c.description,
        c.category,
        c.sequence_order,
        c.is_active,
        c.created_at,
        (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) as module_count
      FROM courses c
      ORDER BY c.sequence_order, c.created_at DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching portal courses:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/admin/courses/:courseId
 * @desc Get course with all modules
 * @access Admin
 */
router.get('/courses/:courseId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const postgresService = require('../services/database/postgres.service');

    const courseResult = await postgresService.pool.query('SELECT * FROM courses WHERE id = $1', [courseId]);

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Course not found' });
    }

    const modulesResult = await postgresService.pool.query(
      'SELECT * FROM modules WHERE course_id = $1 ORDER BY sequence_order',
      [courseId]
    );

    res.json({
      success: true,
      data: {
        course: courseResult.rows[0],
        modules: modulesResult.rows
      }
    });
  } catch (error) {
    logger.error('Error fetching course:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/admin/portal/courses/:courseId/modules
 * @desc Get all modules for a course (portal UI compatibility)
 * @access Admin
 */
router.get('/portal/courses/:courseId/modules', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const postgresService = require('../services/database/postgres.service');

    const modulesResult = await postgresService.pool.query(`
      SELECT
        m.id,
        m.id as moodle_module_id,
        m.course_id,
        CONCAT('MOD-', m.id) as module_code,
        m.title as module_name,
        m.description,
        m.sequence_order,
        m.is_active,
        m.created_at,
        (SELECT COUNT(*) FROM module_content mc WHERE mc.module_id = m.id) as content_count
      FROM modules m
      WHERE m.course_id = $1
      ORDER BY m.sequence_order
    `, [courseId]);

    res.json({
      success: true,
      data: modulesResult.rows
    });
  } catch (error) {
    logger.error('Error fetching portal modules:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/admin/modules
 * @desc Create a new module for a course
 * @access Admin
 */
router.post('/modules', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { course_id, title, description, sequence_order } = req.body;
    const postgresService = require('../services/database/postgres.service');

    if (!course_id || !title) {
      return res.status(400).json({ success: false, error: 'Course ID and title are required' });
    }

    const result = await postgresService.pool.query(`
      INSERT INTO modules (course_id, title, description, sequence_order)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [course_id, title, description, sequence_order || 1]);

    res.json({
      success: true,
      message: 'Module created successfully',
      module: result.rows[0]
    });
  } catch (error) {
    logger.error('Error creating module:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/admin/portal/courses/:courseId/modules
 * @desc Create a new module for a course (portal UI compatibility)
 * @access Admin
 */
router.post('/portal/courses/:courseId/modules', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { module_name, description, sequence_order } = req.body;
    const postgresService = require('../services/database/postgres.service');

    if (!module_name) {
      return res.status(400).json({ success: false, error: 'Module name is required' });
    }

    // Verify course exists
    const courseResult = await postgresService.pool.query(
      'SELECT id FROM courses WHERE id = $1',
      [courseId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Course not found' });
    }

    // Get next sequence_order if not provided
    let moduleSeq = sequence_order;
    if (!moduleSeq) {
      const seqResult = await postgresService.pool.query(
        'SELECT COALESCE(MAX(sequence_order), 0) + 1 as next_seq FROM modules WHERE course_id = $1',
        [courseId]
      );
      moduleSeq = seqResult.rows[0].next_seq;
    }

    const result = await postgresService.pool.query(`
      INSERT INTO modules (course_id, title, description, sequence_order)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [courseId, module_name, description, moduleSeq]);

    res.json({
      success: true,
      message: 'Module created successfully',
      module: result.rows[0]
    });
  } catch (error) {
    logger.error('Error creating portal module:', error);
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
      const { original_file } = req.body;  // Accept original_file from form data
      const adminUserId = req.user.id;

      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      const result = await portalContentService.uploadModuleContent(
        parseInt(moduleId),
        req.file.path,
        req.file,
        adminUserId,
        original_file  // Pass original_file to service
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
 * @route POST /api/admin/modules/:moduleId/process-content
 * @desc Trigger background processing of all content files for a module
 * @access Admin
 */
router.post('/modules/:moduleId/process-content', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const adminUserId = req.user.id;

    logger.info(`Triggering content processing for module ${moduleId}`);

    // Start background processing (non-blocking)
    await contentProcessorService.startBackgroundProcessing(parseInt(moduleId), adminUserId);

    res.json({
      success: true,
      message: 'Content processing started in background',
      moduleId: parseInt(moduleId)
    });

  } catch (error) {
    logger.error(`Error starting content processing for module ${req.params.moduleId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/admin/modules/:moduleId/processing-status
 * @desc Get current processing status for a module
 * @access Admin
 */
router.get('/modules/:moduleId/processing-status', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const status = contentProcessorService.getStatus(parseInt(moduleId));

    if (!status) {
      return res.json({
        success: true,
        status: null,
        message: 'No processing in progress'
      });
    }

    res.json({
      success: true,
      status: status
    });

  } catch (error) {
    logger.error(`Error fetching processing status for module ${req.params.moduleId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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
 * @route POST /api/admin/users/register-with-verification
 * @desc Register user and send WhatsApp verification code
 * @access Admin
 */
router.post('/users/register-with-verification', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { name, phoneNumber } = req.body;

    if (!name || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Name and phone number are required'
      });
    }

    // Create user and send verification code
    const result = await verificationService.createUserAndSendCode(name, phoneNumber);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          phoneNumber: result.phoneNumber,
          codeExpiresAt: result.expiresAt,
          // Don't send actual code in production, but useful for testing
          verificationCode: process.env.NODE_ENV === 'development' ? result.code : undefined
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message
      });
    }

  } catch (error) {
    logger.error('Error registering user with verification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/admin/users/resend-verification
 * @desc Resend verification code to pending user
 * @access Admin
 */
router.post('/users/resend-verification', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    const result = await verificationService.resendCode(phoneNumber);

    res.json(result);

  } catch (error) {
    logger.error('Error resending verification code:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/admin/users/pending-verification
 * @desc Get all users pending verification
 * @access Admin
 */
router.get('/users/pending-verification', authMiddleware.authenticateToken, async (req, res) => {
  try {
    // This would need to be stored in database for production
    // For now, return empty array as verification codes are in memory
    res.json({
      success: true,
      data: [],
      message: 'Pending verifications are stored in memory. Check application logs for codes.'
    });

  } catch (error) {
    logger.error('Error fetching pending verifications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== PIN ENROLLMENT SYSTEM ====================

/**
 * @route POST /api/admin/users/enroll
 * @desc Enroll new user with PIN (replaces old verification system)
 * @access Admin
 */
router.post('/users/enroll', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { name, phoneNumber, customPin } = req.body;
    const adminId = req.user.id;

    if (!name || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Name and phone number are required'
      });
    }

    const result = await enrollmentService.enrollUser(name, phoneNumber, adminId, customPin);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          userId: result.userId,
          phoneNumber: result.phoneNumber,
          pin: result.pin, // 4-digit PIN for admin to share with user
          expiresAt: result.expiresAt
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
        userId: result.userId,
        status: result.status
      });
    }

  } catch (error) {
    logger.error('Error enrolling user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/admin/users/:phoneNumber/reset-pin
 * @desc Reset user's PIN
 * @access Admin
 */
router.post('/users/:phoneNumber/reset-pin', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { customPin } = req.body;
    const adminId = req.user.id;

    const result = await enrollmentService.resetPIN(phoneNumber, adminId, customPin);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          userId: result.userId,
          pin: result.pin,
          expiresAt: result.expiresAt
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message
      });
    }

  } catch (error) {
    logger.error('Error resetting PIN:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/admin/users/:phoneNumber/enrollment-status
 * @desc Get enrollment status for a user
 * @access Admin
 */
router.get('/users/:phoneNumber/enrollment-status', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    const result = await enrollmentService.getEnrollmentStatus(phoneNumber);

    if (result.enrolled) {
      res.json({
        success: true,
        data: {
          userId: result.userId,
          name: result.name,
          status: result.status,
          isVerified: result.isVerified,
          attemptsRemaining: result.attemptsRemaining,
          pinExpiresAt: result.pinExpiresAt,
          enrolledAt: result.enrolledAt
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    logger.error('Error getting enrollment status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/admin/users/:phoneNumber/unblock
 * @desc Unblock a blocked user
 * @access Admin
 */
router.post('/users/:phoneNumber/unblock', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const adminId = req.user.id;

    const result = await enrollmentService.unblockUser(phoneNumber, adminId);

    res.json(result);

  } catch (error) {
    logger.error('Error unblocking user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/admin/users/:userId/enrollment-history
 * @desc Get enrollment history for a user (audit trail)
 * @access Admin
 */
router.get('/users/:userId/enrollment-history', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const history = await enrollmentService.getEnrollmentHistory(parseInt(userId), limit);

    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    logger.error('Error getting enrollment history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/admin/modules/:moduleId/quiz/upload
 * @desc Upload quiz questions for a module from JSON file
 * @access Admin
 */
router.post('/modules/:moduleId/quiz/upload', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { questions } = req.body;
    const adminUserId = req.user.id;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Questions array is required and must not be empty'
      });
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question || !q.options || !Array.isArray(q.options)) {
        return res.status(400).json({
          success: false,
          error: `Question ${i + 1}: Invalid format (missing question or options)`
        });
      }
      if (q.options.length < 2 || q.options.length > 4) {
        return res.status(400).json({
          success: false,
          error: `Question ${i + 1}: Must have 2-4 options`
        });
      }
      if (q.correctAnswer === undefined || q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
        return res.status(400).json({
          success: false,
          error: `Question ${i + 1}: Invalid correctAnswer index`
        });
      }
    }

    const postgresService = require('../services/database/postgres.service');

    // Get module details
    const moduleResult = await postgresService.pool.query(
      'SELECT id FROM modules WHERE id = $1',
      [moduleId]
    );

    if (moduleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Module not found'
      });
    }

    // Check if quiz already exists for this module
    let quizResult = await postgresService.pool.query(
      'SELECT id FROM quizzes WHERE module_id = $1',
      [moduleId]
    );

    let quizId;

    if (quizResult.rows.length > 0) {
      // Update existing quiz
      quizId = quizResult.rows[0].id;

      // Delete existing questions
      await postgresService.pool.query(
        'DELETE FROM quiz_questions WHERE quiz_id = $1',
        [quizId]
      );

      logger.info(`Deleted existing questions for quiz ${quizId}`);
    } else {
      // Create new quiz
      quizResult = await postgresService.pool.query(`
        INSERT INTO quizzes (
          module_id,
          title,
          time_limit_minutes,
          pass_threshold,
          max_attempts
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [
        moduleId,
        `Module ${moduleId} Quiz`,
        30, // 30 minutes default
        70, // 70% pass threshold
        999  // unlimited attempts
      ]);

      quizId = quizResult.rows[0].id;
      logger.info(`Created new quiz ${quizId} for module ${moduleId}`);
    }

    // Insert questions
    const insertedQuestions = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const result = await postgresService.pool.query(`
        INSERT INTO quiz_questions (
          module_id,
          quiz_id,
          question_text,
          question_type,
          options,
          correct_answer,
          explanation,
          points
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        moduleId,
        quizId,
        q.question,
        'multichoice',
        JSON.stringify(q.options),
        q.correctAnswer.toString(),
        q.explanation || null,
        1.0
      ]);

      insertedQuestions.push({
        id: result.rows[0].id,
        question: q.question,
        optionCount: q.options.length
      });
    }

    logger.info(`Inserted ${insertedQuestions.length} questions for quiz ${quizId}`);

    res.json({
      success: true,
      message: `Quiz uploaded successfully with ${questions.length} questions`,
      data: {
        quizId,
        moduleId: parseInt(moduleId),
        questionCount: insertedQuestions.length,
        questions: insertedQuestions
      }
    });

  } catch (error) {
    logger.error('Error uploading quiz:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
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
    const fs = require('fs').promises;

    // Get course details from the CORRECT table (courses, not moodle_courses)
    const courseResult = await postgresService.pool.query(
      'SELECT * FROM courses WHERE id = $1',
      [courseId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Course not found' });
    }

    const course = courseResult.rows[0];

    // Get all modules for this course
    const modulesResult = await postgresService.pool.query(
      'SELECT id FROM modules WHERE course_id = $1',
      [courseId]
    );

    const moduleIds = modulesResult.rows.map(row => row.id);

    // Get all content files to delete from filesystem
    let deletedFiles = 0;
    if (moduleIds.length > 0) {
      const contentResult = await postgresService.pool.query(
        'SELECT file_path FROM module_content WHERE module_id = ANY($1)',
        [moduleIds]
      );

      // Delete physical files
      for (const row of contentResult.rows) {
        try {
          await fs.unlink(row.file_path);
          deletedFiles++;
        } catch (fileError) {
          logger.warn(`Could not delete file ${row.file_path}:`, fileError.message);
        }
      }

      if (deletedFiles > 0) {
        logger.info(`Deleted ${deletedFiles} physical file(s) from uploads/`);
      }
    }

    // Delete from Neo4j (if module IDs exist)
    try {
      if (moduleIds.length > 0) {
        for (const moduleId of moduleIds) {
          await neo4jService.deleteModuleGraph(moduleId);
        }
        logger.info(`Deleted Neo4j graph for course ${courseId}`);
      }
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

    // Delete from PostgreSQL - CASCADE should handle all related records
    // But let's be explicit for clarity
    await postgresService.pool.query(
      'DELETE FROM courses WHERE id = $1',
      [courseId]
    );

    logger.info(`Deleted course ${courseId} (${course.title})`);

    res.json({
      success: true,
      message: `Course and all related data deleted successfully (${deletedFiles} file(s) removed)`,
      deletedFiles: deletedFiles,
      deletedModules: moduleIds.length
    });

  } catch (error) {
    logger.error('Error deleting course:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ADMIN USER MANAGEMENT ====================

/**
 * @route GET /api/admin/admin-users
 * @desc Get all admin users
 * @access Admin
 */
router.get('/admin-users', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const postgresService = require('../services/database/postgres.service');

    const result = await postgresService.pool.query(`
      SELECT id, email, name, role, is_active, created_at, updated_at, last_login_at
      FROM admin_users
      ORDER BY created_at DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching admin users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/admin/admin-users
 * @desc Create a new admin user
 * @access Admin
 */
router.post('/admin-users', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const postgresService = require('../services/database/postgres.service');
    const bcrypt = require('bcrypt');

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters'
      });
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({
        success: false,
        error: 'Password must include uppercase, lowercase, and number'
      });
    }

    // Check if email already exists
    const existingUser = await postgresService.pool.query(
      'SELECT id FROM admin_users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Email already exists'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert admin user
    const result = await postgresService.pool.query(`
      INSERT INTO admin_users (email, password_hash, name, role, is_active)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING id, email, name, role, is_active, created_at
    `, [email, passwordHash, name, role || 'viewer']);

    logger.info(`Admin user created: ${email} (${role || 'viewer'})`);

    res.json({
      success: true,
      message: 'Admin user created successfully',
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Error creating admin user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route PATCH /api/admin/admin-users/:userId/toggle-status
 * @desc Toggle admin user active status
 * @access Admin
 */
router.patch('/admin-users/:userId/toggle-status', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const postgresService = require('../services/database/postgres.service');

    // Toggle status
    const result = await postgresService.pool.query(`
      UPDATE admin_users
      SET is_active = NOT is_active, updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, name, role, is_active
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Admin user not found'
      });
    }

    const user = result.rows[0];
    logger.info(`Admin user ${user.email} status toggled to ${user.is_active ? 'active' : 'inactive'}`);

    res.json({
      success: true,
      message: `User ${user.is_active ? 'activated' : 'deactivated'} successfully`,
      data: user
    });

  } catch (error) {
    logger.error('Error toggling admin user status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route DELETE /api/admin/admin-users/:userId
 * @desc Delete an admin user
 * @access Admin
 */
router.delete('/admin-users/:userId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const postgresService = require('../services/database/postgres.service');

    // Prevent deleting yourself
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'You cannot delete your own account'
      });
    }

    const result = await postgresService.pool.query(
      'DELETE FROM admin_users WHERE id = $1 RETURNING email',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Admin user not found'
      });
    }

    logger.info(`Admin user deleted: ${result.rows[0].email}`);

    res.json({
      success: true,
      message: 'Admin user deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting admin user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route PATCH /api/admin/users/:userId/toggle-status
 * @desc Toggle WhatsApp user active status
 * @access Admin
 */
router.patch('/users/:userId/toggle-status', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_active } = req.body;
    const postgresService = require('../services/database/postgres.service');

    // If is_active is provided, use it; otherwise toggle
    // When activating a user, also set last_active_at to NOW so they show as active
    let query, params;
    if (is_active !== undefined) {
      query = `
        UPDATE users
        SET
          is_active = $1,
          updated_at = NOW(),
          last_active_at = CASE WHEN $1 = TRUE THEN NOW() ELSE last_active_at END
        WHERE id = $2
        RETURNING id, whatsapp_id, name, is_active, last_active_at
      `;
      params = [is_active, userId];
    } else {
      query = `
        UPDATE users
        SET
          is_active = NOT is_active,
          updated_at = NOW(),
          last_active_at = CASE WHEN (NOT is_active) = TRUE THEN NOW() ELSE last_active_at END
        WHERE id = $1
        RETURNING id, whatsapp_id, name, is_active, last_active_at
      `;
      params = [userId];
    }

    const result = await postgresService.pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'WhatsApp user not found'
      });
    }

    const user = result.rows[0];
    logger.info(`WhatsApp user ${user.whatsapp_id} status toggled to ${user.is_active ? 'active' : 'inactive'}`);

    res.json({
      success: true,
      message: `User ${user.is_active ? 'activated' : 'deactivated'} successfully`,
      data: user
    });

  } catch (error) {
    logger.error('Error toggling WhatsApp user status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route DELETE /api/admin/users/:userId
 * @desc Delete a WhatsApp user
 * @access Admin
 */
router.delete('/users/:userId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const postgresService = require('../services/database/postgres.service');

    const result = await postgresService.pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING whatsapp_id, name',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    logger.info(`WhatsApp user deleted: ${result.rows[0].name} (${result.rows[0].whatsapp_id})`);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting WhatsApp user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
