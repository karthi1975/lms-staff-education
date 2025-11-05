const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const contentService = require('../services/content.service');
const portalContentService = require('../services/portal-content.service');
const contentProcessorService = require('../services/content-processor.service');
const verificationService = require('../services/verification.service');
const enrollmentService = require('../services/enrollment.service');
const contentClassificationService = require('../services/content-classification.service');
const postgresService = require('../services/database/postgres.service');
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
 * @desc Get all users with progress summary (filtered by admin's region access)
 * @access Admin
 */
router.get('/users', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const rbacService = require('../services/rbac.service');
    const postgresService = require('../services/database/postgres.service');

    // Check if Super Admin
    const isSuperAdmin = await rbacService.isSuperAdmin(req.user.id);

    let users;
    if (isSuperAdmin) {
      // Super Admin sees all users
      users = await contentService.getAllUsersProgress();
    } else {
      // Regional Admin sees only users from their assigned regions
      const regions = await rbacService.getAdminAssignedRegions(req.user.id);
      const regionIds = regions.map(r => r.region_id);

      if (regionIds.length === 0) {
        return res.json({ success: true, data: [] });
      }

      // Get all users and filter by region
      const allUsers = await contentService.getAllUsersProgress();

      // Filter users by primary_region_id
      users = allUsers.filter(user =>
        user.primary_region_id && regionIds.includes(user.primary_region_id)
      );
    }

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

    // CORNER CASE FIX: Check if user exists before querying progress
    const userCheck = await postgresService.pool.query(
      'SELECT id, name, whatsapp_id FROM users WHERE id = $1',
      [parseInt(userId)]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found. The user may have been deleted.',
        errorCode: 'USER_NOT_FOUND'
      });
    }

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
    const { code, title, description, category, difficulty_level, duration_weeks, sequence_order, region_id } = req.body;
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
      INSERT INTO courses (code, title, description, category, difficulty_level, duration_weeks, sequence_order, region_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [code, title, description, category, difficulty_level, duration_weeks || 24, sequence_order || 1, region_id || null, req.user.id]);

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
    const { course_name, course_code, description, category, region_id } = req.body;
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
      INSERT INTO courses (code, title, description, category, sequence_order, region_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [code, course_name, description, category || 'General', 1, region_id || null, req.user.id]);

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
 * @desc Get all courses (filtered by admin's region access)
 * @access Admin
 */
router.get('/courses', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const rbacService = require('../services/rbac.service');
    const postgresService = require('../services/database/postgres.service');

    // Check if Super Admin
    const isSuperAdmin = await rbacService.isSuperAdmin(req.user.id);

    let result;
    if (isSuperAdmin) {
      // Super Admin sees all courses
      result = await postgresService.pool.query(`
        SELECT
          c.*,
          (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) as module_count
        FROM courses c
        ORDER BY c.sequence_order, c.created_at DESC
      `);
    } else {
      // Regional Admin sees only their region courses
      const regions = await rbacService.getAdminAssignedRegions(req.user.id);
      const regionIds = regions.map(r => r.region_id);

      if (regionIds.length === 0) {
        return res.json({ success: true, data: [] });
      }

      result = await postgresService.pool.query(`
        SELECT
          c.*,
          (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) as module_count
        FROM courses c
        WHERE c.region_id = ANY($1::int[])
        ORDER BY c.sequence_order, c.created_at DESC
      `, [regionIds]);
    }

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
 * @route GET /api/admin/courses/pilot
 * @desc Get all courses in Tanzania region (pilot program)
 * @access Admin (Tanzania region only)
 * NOTE: This route must come BEFORE /courses/:courseId to avoid matching "pilot" as courseId
 */
router.get('/courses/pilot', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const rbacService = require('../services/rbac.service');

    // TANZANIA PILOT: Check region access
    const isSuperAdmin = await rbacService.isSuperAdmin(req.user.id);

    if (!isSuperAdmin) {
      const regions = await rbacService.getAdminAssignedRegions(req.user.id);
      const tanzaniaRegion = regions.find(r => r.region_code === 'TZ');

      if (!tanzaniaRegion) {
        return res.status(403).json({
          success: false,
          error: 'Prompt viewer is currently available only for Tanzania region admins',
          pilotRegion: 'Tanzania (TZ)'
        });
      }
    }

    // Get Tanzania region ID
    const tanzaniaRegionResult = await postgresService.pool.query(
      'SELECT id FROM regions WHERE code = $1',
      ['TZ']
    );

    if (tanzaniaRegionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tanzania region not found'
      });
    }

    const tzRegionId = tanzaniaRegionResult.rows[0].id;

    // Fetch Tanzania courses with bot config info
    const coursesResult = await postgresService.pool.query(`
      SELECT
        c.id,
        c.code,
        c.title,
        c.description,
        c.category,
        c.is_active,
        c.created_at,
        bc.regular_version,
        bc.socratic_version,
        bc.last_approved_at,
        (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) as module_count
      FROM courses c
      LEFT JOIN course_bot_configs bc ON c.id = bc.course_id
      WHERE c.region_id = $1 AND c.is_active = TRUE
      ORDER BY c.sequence_order, c.created_at DESC
    `, [tzRegionId]);

    res.json({
      success: true,
      pilotRegion: 'Tanzania (TZ)',
      courses: coursesResult.rows,
      totalCourses: coursesResult.rows.length
    });

  } catch (error) {
    logger.error('Error fetching pilot courses:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
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
      course: courseResult.rows[0],
      modules: modulesResult.rows
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
// Configure multer for quiz file uploads
const quizUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'));
    }
  }
});

router.post('/modules/:moduleId/quiz/upload',
  authMiddleware.authenticateToken,
  quizUpload.single('quizFile'),
  async (req, res) => {
  try {
    const { moduleId } = req.params;
    const adminUserId = req.user.id;

    // Parse uploaded JSON file
    let questions;
    if (req.file) {
      // File upload - parse JSON from buffer
      const fileContent = req.file.buffer.toString('utf-8');
      const quizData = JSON.parse(fileContent);
      questions = quizData.questions; // Extract questions array from { "questions": [...] }
    } else if (req.body.questions) {
      // Direct JSON in body (for API calls)
      questions = req.body.questions;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Please upload a JSON file with quiz questions'
      });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Quiz file must contain a "questions" array with at least one question'
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
          question,
          options,
          correct_answer,
          explanation,
          difficulty
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        moduleId,
        quizId,
        q.question,
        JSON.stringify(q.options),
        q.correctAnswer.toString(),
        q.explanation || null,
        'medium'
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

// REMOVED: Duplicate POST endpoint /courses/:courseId/modules/:moduleId/quiz
// This endpoint expected incorrect format: {correct_answer: 'A', options: {A, B, C, D}}
// Now using /modules/:moduleId/quiz/upload which accepts our format: {correctAnswer: 0, options: [...]}

/**
 * @route GET /api/admin/courses/:courseId/modules/:moduleId/quiz
 * @desc Get quiz questions for a module
 * @access Admin
 */
router.get('/courses/:courseId/modules/:moduleId/quiz', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const postgresService = require('../services/database/postgres.service');

    // Get quiz for this module
    const quizResult = await postgresService.pool.query(
      'SELECT * FROM quizzes WHERE module_id = $1',
      [moduleId]
    );

    if (quizResult.rows.length === 0) {
      return res.json({
        success: true,
        quiz: null,
        message: 'No quiz found for this module'
      });
    }

    const quiz = quizResult.rows[0];

    // Get quiz questions
    const questionsResult = await postgresService.pool.query(
      'SELECT * FROM quiz_questions WHERE quiz_id = $1 ORDER BY id',
      [quiz.id]
    );

    // Convert questions to frontend format {question, options: {A, B, C, D}, correct_answer: 'A'}
    const formattedQuestions = questionsResult.rows.map(q => {
      // Handle options - might be JSONB (object) or string
      const optionsArray = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
      const correctAnswer = ['A', 'B', 'C', 'D'][parseInt(q.correct_answer)];

      return {
        id: q.id,
        question: q.question, // Fixed: use 'question' column, not 'question_text'
        options: {
          A: optionsArray[0],
          B: optionsArray[1],
          C: optionsArray[2],
          D: optionsArray[3]
        },
        correct_answer: correctAnswer,
        explanation: q.explanation
      };
    });

    res.json({
      success: true,
      quiz: formattedQuestions,
      quizInfo: {
        id: quiz.id,
        title: quiz.title,
        pass_threshold: quiz.pass_threshold,
        max_attempts: quiz.max_attempts,
        time_limit_minutes: quiz.time_limit_minutes
      }
    });

  } catch (error) {
    logger.error('Error getting quiz:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/admin/courses/:courseId/modules/:moduleId/quiz
 * @desc Delete quiz for a module
 * @access Admin
 */
router.delete('/courses/:courseId/modules/:moduleId/quiz', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const postgresService = require('../services/database/postgres.service');

    // Get quiz for this module
    const quizResult = await postgresService.pool.query(
      'SELECT id FROM quizzes WHERE module_id = $1',
      [moduleId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No quiz found for this module'
      });
    }

    const quizId = quizResult.rows[0].id;

    // Delete quiz questions (will cascade due to foreign key)
    await postgresService.pool.query(
      'DELETE FROM quiz_questions WHERE quiz_id = $1',
      [quizId]
    );

    // Delete quiz
    await postgresService.pool.query(
      'DELETE FROM quizzes WHERE id = $1',
      [quizId]
    );

    logger.info(`Deleted quiz ${quizId} for module ${moduleId}`);

    res.json({
      success: true,
      message: 'Quiz deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting quiz:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/admin/courses/:courseId/modules/:moduleId
 * @desc Delete a module and all its related data (RBAC enforced by region)
 * @access Admin (regional admins can delete modules from courses in their region)
 */
router.delete('/courses/:courseId/modules/:moduleId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { courseId, moduleId } = req.params;
    const postgresService = require('../services/database/postgres.service');
    const rbacService = require('../services/rbac.service');
    const neo4jService = require('../services/neo4j.service');
    const chromaService = require('../services/chroma.service');
    const bilingualChroma = require('../services/bilingual-chroma.service');
    const fs = require('fs').promises;
    const path = require('path');

    // Verify module exists and belongs to the course
    const moduleResult = await postgresService.pool.query(
      'SELECT * FROM modules WHERE id = $1 AND course_id = $2',
      [moduleId, courseId]
    );

    if (moduleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Module not found in this course'
      });
    }

    const module = moduleResult.rows[0];

    // RBAC: Verify course belongs to admin's region (for regional admins)
    const isSuperAdmin = await rbacService.isSuperAdmin(req.user.id);

    if (!isSuperAdmin) {
      // Regional admin - verify course is in their region
      const regions = await rbacService.getAdminAssignedRegions(req.user.id);
      const regionIds = regions.map(r => r.region_id);

      const courseCheck = await postgresService.pool.query(
        'SELECT region_id FROM courses WHERE id = $1',
        [courseId]
      );

      if (!courseCheck.rows[0] || !regionIds.includes(courseCheck.rows[0].region_id)) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to delete modules from this course'
        });
      }
    }

    logger.info(`[Module Delete] Starting deletion of module ${moduleId} (${module.title}) from course ${courseId}`);

    // Step 1: Delete physical files from filesystem
    let deletedFiles = 0;
    const contentResult = await postgresService.pool.query(
      'SELECT file_path FROM module_content WHERE module_id = $1',
      [moduleId]
    );

    for (const row of contentResult.rows) {
      const filePath = row.file_path;
      let deleted = false;

      // Try multiple path variations
      const pathsToTry = [filePath];
      if (path.isAbsolute(filePath)) {
        const filename = path.basename(filePath);
        pathsToTry.push(`uploads/${filename}`);
        pathsToTry.push(`uploads/bilingual/${filename}`);
      }

      for (const tryPath of pathsToTry) {
        try {
          await fs.unlink(tryPath);
          deletedFiles++;
          deleted = true;
          logger.info(`[Module Delete] Deleted file: ${tryPath}`);
          break;
        } catch (fileError) {
          // Continue to next path variant
        }
      }

      if (!deleted) {
        logger.warn(`[Module Delete] Could not delete file: ${filePath}`);
      }
    }

    // Step 2: Delete from Neo4j knowledge graph
    try {
      await neo4jService.deleteModuleGraph(moduleId);
      logger.info(`[Module Delete] Deleted Neo4j graph for module ${moduleId}`);
    } catch (neo4jError) {
      logger.warn('[Module Delete] Error deleting from Neo4j:', neo4jError);
    }

    // Step 3: Delete from ChromaDB (legacy single collection)
    try {
      await chromaService.deleteByModule(moduleId);
      logger.info(`[Module Delete] Deleted ChromaDB vectors for module ${moduleId}`);
    } catch (chromaError) {
      logger.warn('[Module Delete] Error deleting from ChromaDB:', chromaError);
    }

    // Step 4: Delete from BilingualChroma (English/Swahili/Mixed collections)
    try {
      if (bilingualChroma.isConnected && bilingualChroma.isConnected()) {
        await bilingualChroma.deleteByModule(moduleId);
        logger.info(`[Module Delete] Deleted BilingualChroma vectors for module ${moduleId}`);
      }
    } catch (bilingualError) {
      logger.warn('[Module Delete] Error deleting from BilingualChroma:', bilingualError);
    }

    // Step 5: Delete from course_content table (for bilingual uploads)
    try {
      await postgresService.pool.query(
        'DELETE FROM course_content WHERE course_id = $1',
        [courseId]
      );
      logger.info(`[Module Delete] Deleted course_content records for course ${courseId}`);
    } catch (courseContentError) {
      logger.warn('[Module Delete] Error deleting from course_content:', courseContentError);
    }

    // Step 6: Delete from PostgreSQL
    // CASCADE will handle: quiz_questions, quizzes, module_content, enrollments, etc.
    await postgresService.pool.query(
      'DELETE FROM modules WHERE id = $1',
      [moduleId]
    );

    logger.info(`[Module Delete] ✅ Successfully deleted module ${moduleId} (${module.title})`);

    res.json({
      success: true,
      message: `Module "${module.title}" and all related data deleted successfully`,
      deletedFiles: deletedFiles,
      moduleId: parseInt(moduleId),
      moduleTitle: module.title
    });

  } catch (error) {
    logger.error('[Module Delete] Error deleting module:', error);
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

      // Delete physical files - try multiple path variations
      for (const row of contentResult.rows) {
        const filePath = row.file_path;
        let deleted = false;

        // Try paths in order:
        // 1. Original path as-is
        // 2. If absolute, extract filename and try uploads/ directory
        const pathsToTry = [filePath];

        if (path.isAbsolute(filePath)) {
          const filename = path.basename(filePath);
          pathsToTry.push(`uploads/${filename}`);
        }

        for (const tryPath of pathsToTry) {
          try {
            await fs.unlink(tryPath);
            deletedFiles++;
            deleted = true;
            logger.info(`Deleted file: ${tryPath}`);
            break;
          } catch (fileError) {
            // Continue to next path variant
          }
        }

        if (!deleted) {
          logger.warn(`Could not delete file at any path: ${filePath}`);
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
 * @desc Get all admin users (filtered by admin's region access)
 * @access Admin
 */
router.get('/admin-users', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const rbacService = require('../services/rbac.service');
    const postgresService = require('../services/database/postgres.service');

    // Check if Super Admin
    const isSuperAdmin = await rbacService.isSuperAdmin(req.user.id);

    let result;
    if (isSuperAdmin) {
      // Super Admin sees all admin users with their assigned regions
      result = await postgresService.pool.query(`
        SELECT
          au.id,
          au.email,
          au.name,
          au.role,
          au.role_id,
          au.primary_region_id,
          au.is_active,
          au.created_at,
          au.updated_at,
          au.last_login_at,
          CASE
            WHEN au.role_id = 1 THEN 'super_admin'
            ELSE 'admin'
          END as role_name,
          STRING_AGG(r.code || ':' || r.name, ', ' ORDER BY r.name) as assigned_regions
        FROM admin_users au
        LEFT JOIN admin_regions ar ON au.id = ar.admin_user_id
        LEFT JOIN regions r ON ar.region_id = r.id
        GROUP BY au.id, au.email, au.name, au.role, au.role_id, au.primary_region_id,
                 au.is_active, au.created_at, au.updated_at, au.last_login_at
        ORDER BY au.created_at DESC
      `);
    } else {
      // Regional Admin sees only admin users from their assigned regions
      const regions = await rbacService.getAdminAssignedRegions(req.user.id);
      const regionIds = regions.map(r => r.region_id);

      if (regionIds.length === 0) {
        return res.json({ success: true, data: [] });
      }

      result = await postgresService.pool.query(`
        SELECT
          au.id,
          au.email,
          au.name,
          au.role,
          au.role_id,
          au.primary_region_id,
          au.is_active,
          au.created_at,
          au.updated_at,
          au.last_login_at,
          CASE
            WHEN au.role_id = 1 THEN 'super_admin'
            ELSE 'admin'
          END as role_name,
          STRING_AGG(r.code || ':' || r.name, ', ' ORDER BY r.name) as assigned_regions
        FROM admin_users au
        LEFT JOIN admin_regions ar ON au.id = ar.admin_user_id
        LEFT JOIN regions r ON ar.region_id = r.id
        WHERE au.primary_region_id = ANY($1::int[])
        GROUP BY au.id, au.email, au.name, au.role, au.role_id, au.primary_region_id,
                 au.is_active, au.created_at, au.updated_at, au.last_login_at
        ORDER BY au.created_at DESC
      `, [regionIds]);
    }

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
 * @route GET /api/admin/regions
 * @desc Get all active regions
 * @access Admin
 */
router.get('/regions', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const postgresService = require('../services/database/postgres.service');

    const result = await postgresService.pool.query(
      'SELECT id, code, name, description FROM regions WHERE is_active = TRUE ORDER BY name'
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching regions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch regions'
    });
  }
});

/**
 * @route GET /api/admin/admin-users/:userId/regions
 * @desc Get regions assigned to an admin user
 * @access Admin
 */
router.get('/admin-users/:userId/regions', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const postgresService = require('../services/database/postgres.service');

    // Get all available regions
    const allRegionsResult = await postgresService.pool.query(
      'SELECT id, code, name, description FROM regions WHERE is_active = TRUE ORDER BY name'
    );

    // Get assigned regions for this admin user
    const assignedResult = await postgresService.pool.query(`
      SELECT r.id, r.code, r.name, r.description, ar.assigned_at
      FROM admin_regions ar
      JOIN regions r ON ar.region_id = r.id
      WHERE ar.admin_user_id = $1
      ORDER BY r.name
    `, [userId]);

    res.json({
      success: true,
      regions: assignedResult.rows,
      allRegions: allRegionsResult.rows
    });

  } catch (error) {
    logger.error('Error fetching admin user regions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/admin/admin-users/:userId/regions
 * @desc Assign regions to an admin user
 * @access Admin
 */
router.post('/admin-users/:userId/regions', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { regionIds } = req.body;
    const postgresService = require('../services/database/postgres.service');

    if (!regionIds || !Array.isArray(regionIds) || regionIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'regionIds array is required'
      });
    }

    // Insert region assignments (ignore duplicates)
    const values = regionIds.map((regionId, index) =>
      `($1, $${index + 2}, $${index + 2 + regionIds.length})`
    ).join(', ');

    const params = [
      userId,
      ...regionIds,
      ...regionIds.map(() => req.user.id) // assigned_by
    ];

    await postgresService.pool.query(`
      INSERT INTO admin_regions (admin_user_id, region_id, assigned_by)
      VALUES ${values}
      ON CONFLICT (admin_user_id, region_id) DO NOTHING
    `, params);

    // Also update primary_region_id if not set
    await postgresService.pool.query(`
      UPDATE admin_users
      SET primary_region_id = $2
      WHERE id = $1 AND primary_region_id IS NULL
    `, [userId, regionIds[0]]);

    logger.info(`Assigned ${regionIds.length} region(s) to admin user ${userId}`);

    res.json({
      success: true,
      message: `Successfully assigned ${regionIds.length} region(s)`
    });

  } catch (error) {
    logger.error('Error assigning regions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route DELETE /api/admin/admin-users/:userId/regions/:regionId
 * @desc Remove a region assignment from an admin user
 * @access Admin
 */
router.delete('/admin-users/:userId/regions/:regionId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId, regionId } = req.params;
    const postgresService = require('../services/database/postgres.service');

    const result = await postgresService.pool.query(`
      DELETE FROM admin_regions
      WHERE admin_user_id = $1 AND region_id = $2
      RETURNING id
    `, [userId, regionId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Region assignment not found'
      });
    }

    logger.info(`Removed region ${regionId} from admin user ${userId}`);

    res.json({
      success: true,
      message: 'Region assignment removed successfully'
    });

  } catch (error) {
    logger.error('Error removing region assignment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/admin/admin-users/:userId/reset-password
 * @desc Reset password for an admin user (auto-generate secure password)
 * @access Super Admin only
 */
router.post('/admin-users/:userId/reset-password', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const postgresService = require('../services/database/postgres.service');
    const bcrypt = require('bcrypt');

    // Verify requester is Super Admin (role_id = 1)
    if (req.user.role_id !== 1) {
      return res.status(403).json({
        success: false,
        error: 'Only Super Admins can reset passwords'
      });
    }

    // Check if target user exists
    const userCheck = await postgresService.pool.query(
      'SELECT id, name, email FROM admin_users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Admin user not found'
      });
    }

    const targetUser = userCheck.rows[0];

    // Generate secure random password
    // Format: Uppercase + lowercase + numbers + special char (e.g., "Admin2025!Xyz")
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const specialChars = '!@#$%^&*';
    const generatePassword = () => {
      const year = new Date().getFullYear();
      const prefix = 'Admin';
      const random = Array.from({ length: 3 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join('');
      const special = specialChars[Math.floor(Math.random() * specialChars.length)];
      return `${prefix}${year}${special}${random}`;
    };

    const newPassword = generatePassword();

    // Hash the password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await postgresService.pool.query(
      'UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, userId]
    );

    logger.info(`Password reset for admin user ${userId} (${targetUser.email}) by Super Admin ${req.user.id}`);

    // Return the plain password (ONLY TIME it's sent)
    res.json({
      success: true,
      message: 'Password reset successfully',
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email
      },
      newPassword: newPassword,
      warning: 'This password will only be shown once. Please save it securely.'
    });

  } catch (error) {
    logger.error('Error resetting admin user password:', error);
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

/**
 * @route GET /api/admin/courses/:courseId/modules
 * @desc Get modules for a course (alias for portal route for UI compatibility)
 * @access Admin
 */
router.get('/courses/:courseId/modules', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const postgresService = require('../services/database/postgres.service');

    const modulesResult = await postgresService.pool.query(`
      SELECT
        m.id,
        m.id as moodle_module_id,
        m.course_id,
        CONCAT('MOD-', m.id) as module_code,
        m.title,
        m.title as module_name,
        m.description,
        m.sequence_order,
        m.sequence_order as module_number,
        m.is_active,
        m.created_at,
        (SELECT COUNT(*) FROM module_content mc WHERE mc.module_id = m.id) as content_count,
        (SELECT COUNT(*) FROM quiz_questions qq
         INNER JOIN quizzes q ON qq.quiz_id = q.id
         WHERE q.module_id = m.id) as quiz_questions,
        NULL as duration
      FROM modules m
      WHERE m.course_id = $1
      ORDER BY m.sequence_order
    `, [courseId]);

    res.json({
      success: true,
      modules: modulesResult.rows,
      data: modulesResult.rows
    });
  } catch (error) {
    logger.error('Error fetching course modules:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== USER PROGRESS & QUIZ COMPLETION TRACKING ====================

/**
 * @route GET /api/admin/users/:userId/progress-detailed
 * @desc Get detailed user progress including quiz completion data
 * @access Admin
 */
router.get('/users/:userId/progress-detailed', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user info
    const userResult = await postgresService.pool.query(
      'SELECT id, name, whatsapp_id, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Get detailed progress using the view we created
    const progressResult = await postgresService.pool.query(`
      SELECT
        module_id,
        module_title,
        module_number,
        course_id,
        course_title,
        status,
        progress_percentage,
        started_at,
        completed_at,
        time_spent_minutes,
        last_activity_at,
        quiz_taken,
        quiz_passed,
        quiz_score,
        quiz_attempts_count,
        completion_method,
        final_quiz_percentage,
        time_to_complete_minutes,
        quiz_questions_available
      FROM user_module_progress_summary
      WHERE user_id = $1
      ORDER BY module_number
    `, [userId]);

    // Get overall stats
    const statsResult = await postgresService.pool.query(
      'SELECT * FROM get_user_completion_stats($1)',
      [userId]
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.whatsapp_id,
        enrolled_at: user.created_at
      },
      stats: statsResult.rows[0],
      modules: progressResult.rows
    });

  } catch (error) {
    logger.error('Error fetching detailed user progress:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/admin/users/:userId/quiz-attempts/:moduleId
 * @desc Get all quiz attempts for a user on a specific module
 * @access Admin
 */
router.get('/users/:userId/quiz-attempts/:moduleId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId, moduleId } = req.params;

    const attemptsResult = await postgresService.pool.query(`
      SELECT
        qa.id,
        qa.attempt_number,
        qa.score,
        qa.total_questions,
        qa.percentage,
        qa.passed,
        qa.time_taken_seconds,
        qa.answers,
        qa.attempted_at,
        q.title as quiz_title,
        q.pass_threshold
      FROM quiz_attempts qa
      LEFT JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.user_id = $1 AND qa.module_id = $2
      ORDER BY qa.attempt_number DESC
    `, [userId, moduleId]);

    res.json({
      success: true,
      attempts: attemptsResult.rows
    });

  } catch (error) {
    logger.error('Error fetching quiz attempts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/admin/completion-summary
 * @desc Get completion summary for all users
 * @access Admin
 */
router.get('/completion-summary', authMiddleware.authenticateToken, async (req, res) => {
  try {
    // Get summary for all users
    const summaryResult = await postgresService.pool.query(`
      SELECT
        u.id as user_id,
        u.name as full_name,
        u.whatsapp_id as phone_number,
        u.created_at as enrolled_at,
        COUNT(DISTINCT m.id) as total_modules,
        COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN m.id END) as completed_modules,
        COUNT(DISTINCT CASE WHEN up.status = 'in_progress' THEN m.id END) as in_progress_modules,
        COUNT(DISTINCT CASE WHEN up.quiz_taken = TRUE THEN m.id END) as quizzes_taken,
        COUNT(DISTINCT CASE WHEN up.quiz_passed = TRUE THEN m.id END) as quizzes_passed,
        ROUND(AVG(CASE WHEN up.quiz_passed = TRUE THEN up.quiz_score END), 1) as avg_quiz_score,
        ROUND(
          (COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN m.id END)::DECIMAL /
           NULLIF(COUNT(DISTINCT m.id), 0) * 100), 1
        ) as completion_percentage
      FROM users u
      CROSS JOIN modules m
      LEFT JOIN user_progress up ON u.id = up.user_id AND m.id = up.module_id
      WHERE u.is_active = TRUE
      GROUP BY u.id, u.name, u.whatsapp_id, u.created_at
      ORDER BY completion_percentage DESC NULLS LAST, u.created_at DESC
    `);

    res.json({
      success: true,
      users: summaryResult.rows
    });

  } catch (error) {
    logger.error('Error fetching completion summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/admin/module/:moduleId/completions
 * @desc Get all users who completed a specific module
 * @access Admin
 */
router.get('/module/:moduleId/completions', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { moduleId } = req.params;

    const completionsResult = await postgresService.pool.query(`
      SELECT
        mc.id,
        u.id as user_id,
        u.name as full_name,
        u.whatsapp_id as phone_number,
        mc.completed_at,
        mc.completion_method,
        mc.quiz_score,
        mc.quiz_percentage,
        mc.quiz_attempt_number,
        mc.quiz_passed,
        mc.time_to_complete_minutes,
        mc.total_attempts
      FROM module_completions mc
      JOIN users u ON mc.user_id = u.id
      WHERE mc.module_id = $1
      ORDER BY mc.completed_at DESC
    `, [moduleId]);

    // Get module info
    const moduleResult = await postgresService.pool.query(
      'SELECT id, title, sequence_order FROM modules WHERE id = $1',
      [moduleId]
    );

    res.json({
      success: true,
      module: moduleResult.rows[0],
      completions: completionsResult.rows,
      total_completions: completionsResult.rows.length
    });

  } catch (error) {
    logger.error('Error fetching module completions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== PROMPT MANAGEMENT SYSTEM (PHASE 1: READ-ONLY VIEWER) ====================

/**
 * @route GET /api/admin/courses/:courseId/prompts
 * @desc Get current prompts for both Regular and Socratic modes (Read-only)
 * @access Admin (Tanzania region pilot)
 */
router.get('/courses/:courseId/prompts', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const rbacService = require('../services/rbac.service');
    const botConfigService = require('../services/bot-config.service');

    // TANZANIA PILOT: Check if admin has access to Tanzania region
    const isSuperAdmin = await rbacService.isSuperAdmin(req.user.id);

    if (!isSuperAdmin) {
      const regions = await rbacService.getAdminAssignedRegions(req.user.id);
      const tanzaniaRegion = regions.find(r => r.region_code === 'TZ');

      if (!tanzaniaRegion) {
        return res.status(403).json({
          success: false,
          error: 'Prompt viewer is currently available only for Tanzania region admins (pilot program)',
          pilotRegion: 'Tanzania (TZ)'
        });
      }
    }

    // Verify course belongs to Tanzania region (or admin is super admin)
    const courseCheck = await postgresService.pool.query(
      'SELECT id, title, code, region_id FROM courses WHERE id = $1',
      [courseId]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }

    const course = courseCheck.rows[0];

    // Check if course is in Tanzania region (region_id for TZ)
    const tanzaniaRegionResult = await postgresService.pool.query(
      'SELECT id FROM regions WHERE code = $1',
      ['TZ']
    );

    if (!isSuperAdmin && tanzaniaRegionResult.rows.length > 0) {
      const tzRegionId = tanzaniaRegionResult.rows[0].id;
      if (course.region_id !== tzRegionId) {
        return res.status(403).json({
          success: false,
          error: 'This course is not in the Tanzania region',
          pilotRegion: 'Tanzania (TZ)'
        });
      }
    }

    // Fetch bot config
    const config = await botConfigService.getBotConfig(courseId);

    // Return both prompts with metadata
    res.json({
      success: true,
      courseId: parseInt(courseId),
      courseName: course.title,
      courseCode: course.code,
      prompts: {
        regular: {
          prompt: config.regular_prompt,
          greeting: config.regular_greeting,
          helpText: config.regular_help_text,
          version: config.regular_version,
          characterCount: config.regular_prompt ? config.regular_prompt.length : 0
        },
        socratic: {
          prompt: config.socratic_prompt,
          greeting: config.socratic_greeting,
          helpText: config.socratic_help_text,
          version: config.socratic_version,
          characterCount: config.socratic_prompt ? config.socratic_prompt.length : 0
        }
      },
      metadata: {
        defaultMode: config.default_mode || 'regular',
        allowModeSwitching: config.allow_mode_switching !== false,
        lastApprovedAt: config.last_approved_at,
        lastApprovedBy: config.last_approved_by
      }
    });

  } catch (error) {
    logger.error('Error fetching course prompts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/admin/courses/:courseId/prompts/:mode/history
 * @desc Get version history for a specific prompt mode
 * @access Admin (Tanzania region pilot)
 */
router.get('/courses/:courseId/prompts/:mode/history', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { courseId, mode } = req.params;
    const rbacService = require('../services/rbac.service');

    // Validate mode
    if (mode !== 'regular' && mode !== 'socratic') {
      return res.status(400).json({
        success: false,
        error: 'Invalid mode. Must be "regular" or "socratic"'
      });
    }

    // TANZANIA PILOT: Check region access
    const isSuperAdmin = await rbacService.isSuperAdmin(req.user.id);

    if (!isSuperAdmin) {
      const regions = await rbacService.getAdminAssignedRegions(req.user.id);
      const tanzaniaRegion = regions.find(r => r.region_code === 'TZ');

      if (!tanzaniaRegion) {
        return res.status(403).json({
          success: false,
          error: 'Prompt viewer is currently available only for Tanzania region admins'
        });
      }
    }

    // Fetch version history from prompt_approval_history
    const historyResult = await postgresService.pool.query(`
      SELECT
        pah.id,
        pah.request_id,
        pah.action,
        pah.actor_id,
        pah.actor_role,
        pah.notes,
        pah.previous_status,
        pah.new_status,
        pah.created_at,
        pcr.new_prompt,
        pcr.version_number,
        pcr.change_reason,
        au.name as actor_name,
        au.email as actor_email
      FROM prompt_approval_history pah
      LEFT JOIN prompt_change_requests pcr ON pah.request_id = pcr.id
      LEFT JOIN admin_users au ON pah.actor_id = au.id
      WHERE pah.course_id = $1
        AND pcr.mode = $2
        AND pah.action IN ('approved', 'activated')
      ORDER BY pah.created_at DESC
      LIMIT 50
    `, [courseId, mode]);

    res.json({
      success: true,
      courseId: parseInt(courseId),
      mode: mode,
      history: historyResult.rows,
      totalVersions: historyResult.rows.length
    });

  } catch (error) {
    logger.error('Error fetching prompt history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/admin/courses/:courseId/prompts/:mode/versions/:version
 * @desc Get a specific version of a prompt
 * @access Admin (Tanzania region pilot)
 */
router.get('/courses/:courseId/prompts/:mode/versions/:version', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { courseId, mode, version } = req.params;
    const rbacService = require('../services/rbac.service');

    // Validate mode
    if (mode !== 'regular' && mode !== 'socratic') {
      return res.status(400).json({
        success: false,
        error: 'Invalid mode. Must be "regular" or "socratic"'
      });
    }

    // TANZANIA PILOT: Check region access
    const isSuperAdmin = await rbacService.isSuperAdmin(req.user.id);

    if (!isSuperAdmin) {
      const regions = await rbacService.getAdminAssignedRegions(req.user.id);
      const tanzaniaRegion = regions.find(r => r.region_code === 'TZ');

      if (!tanzaniaRegion) {
        return res.status(403).json({
          success: false,
          error: 'Prompt viewer is currently available only for Tanzania region admins'
        });
      }
    }

    // Fetch specific version from prompt_change_requests
    const versionResult = await postgresService.pool.query(`
      SELECT
        pcr.id,
        pcr.course_id,
        pcr.mode,
        pcr.new_prompt,
        pcr.version_number,
        pcr.change_reason,
        pcr.status,
        pcr.requested_by,
        pcr.requested_at,
        pcr.reviewed_by,
        pcr.reviewed_at,
        au1.name as requested_by_name,
        au1.email as requested_by_email,
        au2.name as reviewed_by_name,
        au2.email as reviewed_by_email
      FROM prompt_change_requests pcr
      LEFT JOIN admin_users au1 ON pcr.requested_by = au1.id
      LEFT JOIN admin_users au2 ON pcr.reviewed_by = au2.id
      WHERE pcr.course_id = $1
        AND pcr.mode = $2
        AND pcr.version_number = $3
    `, [courseId, mode, version]);

    if (versionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Version ${version} not found for ${mode} mode`
      });
    }

    const versionData = versionResult.rows[0];

    res.json({
      success: true,
      courseId: parseInt(courseId),
      mode: mode,
      version: parseInt(version),
      prompt: versionData.new_prompt,
      metadata: {
        changeReason: versionData.change_reason,
        status: versionData.status,
        requestedBy: {
          id: versionData.requested_by,
          name: versionData.requested_by_name,
          email: versionData.requested_by_email
        },
        requestedAt: versionData.requested_at,
        reviewedBy: versionData.reviewed_by ? {
          id: versionData.reviewed_by,
          name: versionData.reviewed_by_name,
          email: versionData.reviewed_by_email
        } : null,
        reviewedAt: versionData.reviewed_at
      }
    });

  } catch (error) {
    logger.error('Error fetching prompt version:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// SYSTEM PROMPT APPROVAL WORKFLOW - PHASE 2: WRITE OPERATIONS
// ============================================================================

/**
 * @route POST /api/admin/courses/:courseId/prompts/change-requests
 * @desc Create a new prompt change request (Regional admins submit, cannot approve)
 * @access Regional Admin, Super Admin
 */
router.post('/courses/:courseId/prompts/change-requests', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const rbacService = require('../services/rbac.service');
    const botConfigService = require('../services/bot-config.service');
    const { courseId } = req.params;
    const { mode, newPrompt, changeReason, newGreeting, newHelpText } = req.body;
    const userId = req.user.id;

    // Validation
    if (!mode || !['regular', 'socratic'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid mode. Must be "regular" or "socratic"'
      });
    }

    if (!newPrompt || newPrompt.length < 100 || newPrompt.length > 5000) {
      return res.status(400).json({
        success: false,
        error: 'Prompt must be between 100 and 5000 characters'
      });
    }

    if (!changeReason || changeReason.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Change reason must be at least 10 characters'
      });
    }

    // RBAC Check
    const isSuperAdmin = await rbacService.isSuperAdmin(userId);

    if (!isSuperAdmin) {
      // Regional admin - check if they have access to this course's region
      const regions = await rbacService.getAdminAssignedRegions(userId);

      if (!regions || regions.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'No regions assigned to your account'
        });
      }

      // Check if course belongs to one of admin's regions
      const courseRegionCheck = await postgresService.pool.query(
        `SELECT c.id, c.region_id, r.name as region_name
         FROM courses c
         LEFT JOIN regions r ON c.region_id = r.id
         WHERE c.id = $1`,
        [courseId]
      );

      if (courseRegionCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Course not found'
        });
      }

      const courseRegion = courseRegionCheck.rows[0].region_id;
      const hasAccess = regions.some(r => r.id === courseRegion);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'You do not have access to this course\'s region'
        });
      }
    }

    // Get next version number for this mode
    const versionQuery = await postgresService.pool.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
       FROM prompt_change_requests
       WHERE course_id = $1 AND mode = $2`,
      [courseId, mode]
    );
    const versionNumber = versionQuery.rows[0].next_version;

    // Get current prompt for comparison
    const currentConfig = await botConfigService.getBotConfig(courseId);
    const oldPrompt = mode === 'regular' ? currentConfig.regularPrompt : currentConfig.socraticPrompt;
    const oldGreeting = currentConfig.greetingMessage;
    const oldHelpText = currentConfig.helpMessage;

    // Insert change request
    const insertResult = await postgresService.pool.query(
      `INSERT INTO prompt_change_requests (
        course_id, mode, new_prompt, old_prompt, version_number,
        change_reason, new_greeting, old_greeting, new_help_text, old_help_text,
        status, requested_by, requested_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING id, status, version_number`,
      [
        courseId, mode, newPrompt, oldPrompt, versionNumber,
        changeReason, newGreeting || null, oldGreeting || null,
        newHelpText || null, oldHelpText || null,
        'pending_approval', userId
      ]
    );

    const requestId = insertResult.rows[0].id;

    // Log the action
    await postgresService.pool.query(
      `INSERT INTO prompt_approval_history (
        request_id, course_id, action, actor_id, actor_role,
        notes, previous_status, new_status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        requestId, courseId, 'submitted', userId,
        isSuperAdmin ? 'superadmin' : 'regional_admin',
        changeReason, null, 'pending_approval'
      ]
    );

    logger.info(`Prompt change request created: ID=${requestId}, Course=${courseId}, Mode=${mode}, User=${userId}`);

    res.status(201).json({
      success: true,
      requestId: requestId,
      status: 'pending_approval',
      versionNumber: versionNumber,
      message: 'Change request submitted. Awaiting superadmin approval.'
    });

  } catch (error) {
    logger.error('Error creating prompt change request:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/admin/prompt-change-requests
 * @desc Get all prompt change requests (for approval dashboard)
 * @access Super Admin (all requests), Regional Admin (own requests)
 */
router.get('/prompt-change-requests', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const rbacService = require('../services/rbac.service');
    const { status, courseId } = req.query;
    const userId = req.user.id;

    const isSuperAdmin = await rbacService.isSuperAdmin(userId);

    let query = `
      SELECT
        pcr.id,
        pcr.course_id,
        c.name as course_name,
        pcr.mode,
        pcr.version_number,
        pcr.change_reason,
        pcr.status,
        pcr.requested_at,
        pcr.reviewed_at,
        pcr.activated_at,
        SUBSTRING(pcr.new_prompt, 1, 100) as preview,
        u.id as requester_id,
        u.name as requester_name,
        u.email as requester_email,
        reviewer.id as reviewer_id,
        reviewer.name as reviewer_name
      FROM prompt_change_requests pcr
      JOIN courses c ON pcr.course_id = c.id
      JOIN admin_users u ON pcr.requested_by = u.id
      LEFT JOIN admin_users reviewer ON pcr.reviewed_by = reviewer.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Super admin sees all, regional admin sees only their requests
    if (!isSuperAdmin) {
      query += ` AND pcr.requested_by = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    // Filter by status
    if (status) {
      query += ` AND pcr.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Filter by course
    if (courseId) {
      query += ` AND pcr.course_id = $${paramIndex}`;
      params.push(courseId);
      paramIndex++;
    }

    query += ` ORDER BY pcr.requested_at DESC`;

    const result = await postgresService.pool.query(query, params);

    const requests = result.rows.map(row => ({
      id: row.id,
      courseId: row.course_id,
      courseName: row.course_name,
      mode: row.mode,
      versionNumber: row.version_number,
      changeReason: row.change_reason,
      status: row.status,
      requestedBy: {
        id: row.requester_id,
        name: row.requester_name,
        email: row.requester_email
      },
      requestedAt: row.requested_at,
      reviewedAt: row.reviewed_at,
      activatedAt: row.activated_at,
      reviewedBy: row.reviewer_id ? {
        id: row.reviewer_id,
        name: row.reviewer_name
      } : null,
      preview: row.preview + '...'
    }));

    res.json({
      success: true,
      requests: requests,
      totalRequests: requests.length,
      userRole: isSuperAdmin ? 'superadmin' : 'regional_admin'
    });

  } catch (error) {
    logger.error('Error fetching prompt change requests:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/admin/prompt-change-requests/:requestId
 * @desc Get single change request with full details (for detail view)
 * @access Super Admin, Regional Admin (own requests only)
 */
router.get('/prompt-change-requests/:requestId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const rbacService = require('../services/rbac.service');
    const { requestId } = req.params;
    const userId = req.user.id;

    const isSuperAdmin = await rbacService.isSuperAdmin(userId);

    let query = `
      SELECT
        pcr.*,
        c.name as course_name,
        c.region_id,
        r.name as region_name,
        u.id as requester_id,
        u.name as requester_name,
        u.email as requester_email,
        u.role_id as requester_role_id,
        reviewer.id as reviewer_id,
        reviewer.name as reviewer_name,
        reviewer.email as reviewer_email
      FROM prompt_change_requests pcr
      JOIN courses c ON pcr.course_id = c.id
      LEFT JOIN regions r ON c.region_id = r.id
      JOIN admin_users u ON pcr.requested_by = u.id
      LEFT JOIN admin_users reviewer ON pcr.reviewed_by = reviewer.id
      WHERE pcr.id = $1
    `;

    const params = [requestId];

    // Regional admin can only view their own requests
    if (!isSuperAdmin) {
      query += ` AND pcr.requested_by = $2`;
      params.push(userId);
    }

    const result = await postgresService.pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Change request not found or access denied'
      });
    }

    const row = result.rows[0];

    // Get approval history
    const historyResult = await postgresService.pool.query(
      `SELECT
        pah.*,
        u.name as actor_name,
        u.email as actor_email
       FROM prompt_approval_history pah
       LEFT JOIN admin_users u ON pah.actor_id = u.id
       WHERE pah.request_id = $1
       ORDER BY pah.created_at DESC`,
      [requestId]
    );

    const request = {
      id: row.id,
      courseId: row.course_id,
      courseName: row.course_name,
      regionId: row.region_id,
      regionName: row.region_name,
      mode: row.mode,
      versionNumber: row.version_number,
      status: row.status,
      newPrompt: row.new_prompt,
      oldPrompt: row.old_prompt,
      newGreeting: row.new_greeting,
      oldGreeting: row.old_greeting,
      newHelpText: row.new_help_text,
      oldHelpText: row.old_help_text,
      changeReason: row.change_reason,
      reviewNotes: row.review_notes,
      requestedBy: {
        id: row.requester_id,
        name: row.requester_name,
        email: row.requester_email,
        roleId: row.requester_role_id
      },
      requestedAt: row.requested_at,
      reviewedBy: row.reviewer_id ? {
        id: row.reviewer_id,
        name: row.reviewer_name,
        email: row.reviewer_email
      } : null,
      reviewedAt: row.reviewed_at,
      activatedAt: row.activated_at,
      history: historyResult.rows.map(h => ({
        action: h.action,
        actor: h.actor_name,
        actorEmail: h.actor_email,
        actorRole: h.actor_role,
        notes: h.notes,
        previousStatus: h.previous_status,
        newStatus: h.new_status,
        createdAt: h.created_at
      }))
    };

    res.json({
      success: true,
      request: request
    });

  } catch (error) {
    logger.error('Error fetching prompt change request details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/admin/prompt-change-requests/:requestId/review
 * @desc Approve or reject a prompt change request
 * @access Super Admin ONLY
 */
router.post('/prompt-change-requests/:requestId/review', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const rbacService = require('../services/rbac.service');
    const { requestId } = req.params;
    const { action, notes } = req.body;
    const userId = req.user.id;

    // Validation
    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be "approve" or "reject"'
      });
    }

    // RBAC Check - Only super admin can approve/reject
    const isSuperAdmin = await rbacService.isSuperAdmin(userId);
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only super administrators can approve or reject change requests'
      });
    }

    // Get current request
    const requestResult = await postgresService.pool.query(
      `SELECT * FROM prompt_change_requests WHERE id = $1`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Change request not found'
      });
    }

    const request = requestResult.rows[0];

    // Check if request is in valid state for review
    if (request.status !== 'pending_approval') {
      return res.status(400).json({
        success: false,
        error: `Cannot review request with status: ${request.status}. Only pending_approval requests can be reviewed.`
      });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Update request status
    await postgresService.pool.query(
      `UPDATE prompt_change_requests
       SET status = $1, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
       WHERE id = $4`,
      [newStatus, userId, notes || null, requestId]
    );

    // Log the action
    await postgresService.pool.query(
      `INSERT INTO prompt_approval_history (
        request_id, course_id, action, actor_id, actor_role,
        notes, previous_status, new_status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        requestId, request.course_id, action, userId, 'superadmin',
        notes || `Request ${action}d`, 'pending_approval', newStatus
      ]
    );

    logger.info(`Prompt change request ${action}d: ID=${requestId}, User=${userId}`);

    res.json({
      success: true,
      requestId: parseInt(requestId),
      newStatus: newStatus,
      message: action === 'approve'
        ? 'Request approved. Ready for activation.'
        : 'Request rejected.',
      canActivateNow: action === 'approve'
    });

  } catch (error) {
    logger.error('Error reviewing prompt change request:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/admin/prompt-change-requests/:requestId/activate
 * @desc Activate an approved prompt (make it live in course_bot_configs)
 * @access Super Admin ONLY
 */
router.post('/prompt-change-requests/:requestId/activate', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const rbacService = require('../services/rbac.service');
    const botConfigService = require('../services/bot-config.service');
    const { requestId } = req.params;
    const { notes } = req.body;
    const userId = req.user.id;

    // RBAC Check - Only super admin can activate
    const isSuperAdmin = await rbacService.isSuperAdmin(userId);
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only super administrators can activate prompts'
      });
    }

    // Get current request
    const requestResult = await postgresService.pool.query(
      `SELECT * FROM prompt_change_requests WHERE id = $1`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Change request not found'
      });
    }

    const request = requestResult.rows[0];

    // Check if request is approved
    if (request.status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: `Cannot activate request with status: ${request.status}. Only approved requests can be activated.`
      });
    }

    const { course_id, mode, new_prompt, new_greeting, new_help_text, version_number } = request;

    // Begin transaction
    const client = await postgresService.pool.connect();
    try {
      await client.query('BEGIN');

      // Update course_bot_configs
      const updateFields = [];
      const updateParams = [];
      let paramIndex = 1;

      if (mode === 'regular') {
        updateFields.push(`regular_prompt = $${paramIndex++}`);
        updateParams.push(new_prompt);
        updateFields.push(`regular_version = $${paramIndex++}`);
        updateParams.push(version_number);
      } else if (mode === 'socratic') {
        updateFields.push(`socratic_prompt = $${paramIndex++}`);
        updateParams.push(new_prompt);
        updateFields.push(`socratic_version = $${paramIndex++}`);
        updateParams.push(version_number);
      }

      if (new_greeting) {
        updateFields.push(`greeting_message = $${paramIndex++}`);
        updateParams.push(new_greeting);
      }

      if (new_help_text) {
        updateFields.push(`help_message = $${paramIndex++}`);
        updateParams.push(new_help_text);
      }

      updateFields.push(`last_approved_at = NOW()`);
      updateFields.push(`last_approved_by = $${paramIndex++}`);
      updateParams.push(userId);

      updateParams.push(course_id);

      const updateQuery = `
        UPDATE course_bot_configs
        SET ${updateFields.join(', ')}
        WHERE course_id = $${paramIndex}
      `;

      await client.query(updateQuery, updateParams);

      // Update request status to activated
      await client.query(
        `UPDATE prompt_change_requests
         SET status = 'activated', activated_at = NOW()
         WHERE id = $1`,
        [requestId]
      );

      // Log the action
      await client.query(
        `INSERT INTO prompt_approval_history (
          request_id, course_id, action, actor_id, actor_role,
          notes, previous_status, new_status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          requestId, course_id, 'activated', userId, 'superadmin',
          notes || `Prompt v${version_number} activated for ${mode} mode`,
          'approved', 'activated'
        ]
      );

      await client.query('COMMIT');

      // Clear bot config cache
      await botConfigService.clearCache(course_id);

      logger.info(`Prompt activated: Request=${requestId}, Course=${course_id}, Mode=${mode}, Version=${version_number}, User=${userId}`);

      res.json({
        success: true,
        requestId: parseInt(requestId),
        courseId: course_id,
        mode: mode,
        newVersion: version_number,
        message: `Prompt v${version_number} is now LIVE for ${mode} mode`,
        affectsActiveUsers: true
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Error activating prompt:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
