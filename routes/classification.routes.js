/**
 * AI Content Classification Routes
 * Handles bulk upload, AI analysis, and module creation
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/auth.middleware');
const contentClassificationService = require('../services/content-classification.service');
const portalContentService = require('../services/portal-content.service');
const postgresService = require('../services/database/postgres.service');
const logger = require('../utils/logger');

// Configure multer for bulk uploads (up to 200 files)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'file-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024  // 50MB per file
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|docx|txt|png|jpg|jpeg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, TXT, and image files are allowed'));
    }
  }
});

/**
 * @route POST /api/admin/classify/courses/:courseId/bulk
 * @desc Upload multiple files and get AI classification suggestions
 * @access Admin
 */
router.post('/courses/:courseId/bulk',
  authMiddleware.authenticateToken,
  authMiddleware.requireRole(['admin']),
  upload.array('files', 200),  // Accept up to 200 files
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const files = req.files;
      const adminUserId = req.user.id;

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded'
        });
      }

      logger.info(`Starting AI classification for ${files.length} files (course: ${courseId}, admin: ${adminUserId})`);

      // Get existing modules for context
      const existingModulesResult = await postgresService.pool.query(
        'SELECT id, title, description FROM modules WHERE course_id = $1 ORDER BY sequence_order',
        [courseId]
      );

      // Run AI classification
      const classificationResults = await contentClassificationService.classifyBatch(files, {
        courseId,
        existingModules: existingModulesResult.rows
      });

      // Generate module structure suggestions
      const moduleStructure = await contentClassificationService.suggestModuleStructure(
        classificationResults.classifications
      );

      // Store classification results temporarily for review
      const classificationId = `classification_${Date.now()}_${adminUserId}`;

      // Store in PostgreSQL temp table (expires in 24 hours)
      await postgresService.pool.query(`
        INSERT INTO classification_temp (
          id, course_id, admin_user_id,
          classifications, module_suggestions,
          created_at, expires_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '24 hours')
        ON CONFLICT (id) DO UPDATE SET
          classifications = $4,
          module_suggestions = $5
      `, [
        classificationId,
        courseId,
        adminUserId,
        JSON.stringify(classificationResults),
        JSON.stringify(moduleStructure)
      ]);

      logger.info(`Classification complete: ${classificationResults.successful}/${files.length} successful`);

      res.json({
        success: true,
        classification_id: classificationId,
        course_id: parseInt(courseId),
        summary: {
          total_files: files.length,
          successful: classificationResults.successful,
          failed: classificationResults.failed,
          suggested_modules: moduleStructure.suggested_module_count,
          high_confidence: moduleStructure.high_confidence_files,
          needs_review: moduleStructure.needs_review_files
        },
        module_suggestions: moduleStructure.modules,
        detailed_classifications: classificationResults.classifications
      });

    } catch (error) {
      logger.error('Bulk classification failed:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

/**
 * @route GET /api/admin/classify/:classificationId
 * @desc Retrieve previously completed classification
 * @access Admin
 */
router.get('/:classificationId',
  authMiddleware.authenticateToken,
  authMiddleware.requireRole(['admin']),
  async (req, res) => {
    try {
      const { classificationId } = req.params;

      const result = await postgresService.pool.query(
        'SELECT * FROM classification_temp WHERE id = $1 AND expires_at > NOW()',
        [classificationId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Classification not found or expired'
        });
      }

      const classification = result.rows[0];

      res.json({
        success: true,
        classification_id: classification.id,
        course_id: classification.course_id,
        created_at: classification.created_at,
        expires_at: classification.expires_at,
        classifications: classification.classifications,
        module_suggestions: classification.module_suggestions
      });

    } catch (error) {
      logger.error('Failed to retrieve classification:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/admin/classify/courses/:courseId/accept
 * @desc Accept AI classification and create modules + process files
 * @access Admin
 */
router.post('/courses/:courseId/accept',
  authMiddleware.authenticateToken,
  authMiddleware.requireRole(['admin']),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const {
        classification_id,
        module_decisions,  // Array: [{title, files, action: 'create'|'merge'|'skip'}]
        auto_process = true
      } = req.body;

      const adminUserId = req.user.id;

      if (!module_decisions || module_decisions.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No module decisions provided'
        });
      }

      logger.info(`Accepting classification ${classification_id} for course ${courseId}`);

      const createdModules = [];
      const processedFiles = [];
      const errors = [];

      // Create modules and assign files
      for (const decision of module_decisions) {
        if (decision.action === 'skip') {
          continue;
        }

        let moduleId;

        if (decision.action === 'create') {
          // Create new module
          const moduleResult = await postgresService.pool.query(`
            INSERT INTO modules (
              course_id,
              title,
              description,
              sequence_order,
              learning_level,
              estimated_duration_hours,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING id, title
          `, [
            courseId,
            decision.title,
            decision.description || `Module covering: ${(decision.topics || []).slice(0, 5).join(', ')}`,
            decision.sequence_order,
            decision.learning_level || 'intermediate',
            decision.estimated_duration_hours || 4
          ]);

          moduleId = moduleResult.rows[0].id;
          createdModules.push(moduleResult.rows[0]);

          logger.info(`Created module ${moduleId}: ${decision.title}`);

        } else if (decision.action === 'merge') {
          // Use existing module
          moduleId = decision.existing_module_id;

          if (!moduleId) {
            errors.push({
              module: decision.title,
              error: 'Missing existing_module_id for merge action'
            });
            continue;
          }
        }

        // Assign files to module and optionally process
        for (const fileInfo of decision.files || []) {
          try {
            // Create module_content record
            const contentResult = await postgresService.pool.query(`
              INSERT INTO module_content (
                module_id,
                file_name,
                original_name,
                file_path,
                file_type,
                file_size,
                uploaded_by,
                uploaded_at,
                processed,
                classification_confidence,
                classification_topics,
                classification_metadata
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), false, $8, $9, $10)
              RETURNING id
            `, [
              moduleId,
              path.basename(fileInfo.file_path),
              fileInfo.file_name,
              fileInfo.file_path,
              fileInfo.file_type || 'application/pdf',
              fileInfo.file_size,
              adminUserId,
              fileInfo.confidence || 0,
              fileInfo.topics || [],
              JSON.stringify({
                classification: {
                  topics: fileInfo.topics || [],
                  confidence: fileInfo.confidence || 0,
                  learning_level: fileInfo.learning_level || 'intermediate',
                  reasoning: fileInfo.reasoning || ''
                }
              })
            ]);

            const contentId = contentResult.rows[0].id;

            // Process file immediately if requested
            if (auto_process) {
              try {
                await portalContentService.uploadModuleContent(
                  moduleId,
                  fileInfo.file_path,
                  {
                    originalname: fileInfo.file_name,
                    mimetype: fileInfo.file_type || 'application/pdf',
                    size: fileInfo.file_size
                  },
                  adminUserId
                );

                processedFiles.push({
                  file_name: fileInfo.file_name,
                  module_id: moduleId,
                  content_id: contentId,
                  status: 'processed'
                });

                logger.info(`Processed file: ${fileInfo.file_name} → Module ${moduleId}`);

              } catch (processError) {
                logger.error(`Failed to process ${fileInfo.file_name}:`, processError);
                processedFiles.push({
                  file_name: fileInfo.file_name,
                  module_id: moduleId,
                  content_id: contentId,
                  status: 'failed',
                  error: processError.message
                });
              }
            } else {
              processedFiles.push({
                file_name: fileInfo.file_name,
                module_id: moduleId,
                content_id: contentId,
                status: 'uploaded'
              });
            }

          } catch (fileError) {
            logger.error(`Failed to assign file ${fileInfo.file_name}:`, fileError);
            errors.push({
              file_name: fileInfo.file_name,
              error: fileError.message
            });
          }
        }
      }

      // Clean up temp classification data
      await postgresService.pool.query(
        'DELETE FROM classification_temp WHERE id = $1',
        [classification_id]
      );

      logger.info(`Classification acceptance complete: ${createdModules.length} modules, ${processedFiles.length} files`);

      res.json({
        success: true,
        message: `Created ${createdModules.length} modules and assigned ${processedFiles.length} files`,
        created_modules: createdModules,
        processed_files: processedFiles.filter(f => f.status === 'processed').length,
        uploaded_files: processedFiles.filter(f => f.status === 'uploaded').length,
        failed_files: processedFiles.filter(f => f.status === 'failed').length,
        auto_processed: auto_process,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      logger.error('Failed to accept classification:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

module.exports = router;
