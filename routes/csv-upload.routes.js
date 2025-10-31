/**
 * CSV Upload Routes
 * Multi-Region RBAC System - Bulk User Enrollment via CSV
 *
 * Features:
 * - CSV file upload with validation
 * - 5,000 row limit enforcement
 * - E.164 phone format validation
 * - Auto region assignment for Regional Admins
 * - Manual region selection for Super Admins
 * - Upload history and logs
 * - CSV template download
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const csvProcessorService = require('../services/csv-processor.service');
const authMiddleware = require('../middleware/auth.middleware');
const rbacMiddleware = require('../middleware/rbac.middleware');
const logger = require('../utils/logger');

// Configure multer for CSV uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/csv/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'enrollment-' + uniqueSuffix + '.csv');
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit (enough for 5,000 rows)
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (ext === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .csv files are allowed.'));
    }
  }
});

/**
 * @route GET /api/csv-upload/template
 * @desc Download CSV template
 * @access Admin+
 */
router.get(
  '/template',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  async (req, res) => {
    try {
      const template = csvProcessorService.generateCSVTemplate();

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=enrollment_template.csv');
      res.send(template);
    } catch (error) {
      logger.error('Error generating CSV template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate CSV template'
      });
    }
  }
);

/**
 * @route POST /api/csv-upload/validate
 * @desc Validate CSV file without processing (preview)
 * @access Admin+
 */
router.post(
  '/validate',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  upload.single('csvFile'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No CSV file provided'
        });
      }

      // Read CSV content
      const csvContent = await fs.readFile(req.file.path, 'utf-8');

      // Validate CSV
      const result = csvProcessorService.validateCSVFile(csvContent);

      // Clean up uploaded file
      await fs.unlink(req.file.path).catch(err =>
        logger.warn('Failed to delete temp CSV file:', err)
      );

      res.json(result);
    } catch (error) {
      logger.error('Error validating CSV:', error);

      // Clean up on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }

      res.status(500).json({
        success: false,
        error: 'Failed to validate CSV file'
      });
    }
  }
);

/**
 * @route POST /api/csv-upload/process
 * @desc Process CSV upload and enroll users
 * @access Admin+ (with enrollment permission validation)
 * @body courseId (required), targetRegionId (Super Admin only)
 */
router.post(
  '/process',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.resolveTargetRegion, // Automatically resolves region
  upload.single('csvFile'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No CSV file provided'
        });
      }

      const { courseId } = req.body;

      if (!courseId) {
        // Clean up file
        await fs.unlink(req.file.path).catch(() => {});

        return res.status(400).json({
          success: false,
          error: 'courseId is required'
        });
      }

      // Read CSV content
      const csvContent = await fs.readFile(req.file.path, 'utf-8');

      // Process CSV upload
      const result = await csvProcessorService.processCSVUpload({
        csvContent,
        courseId: parseInt(courseId),
        targetRegionId: req.targetRegion.regionId,
        uploadedBy: req.user.id
      });

      // Clean up uploaded file
      await fs.unlink(req.file.path).catch(err =>
        logger.warn('Failed to delete CSV file:', err)
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      logger.info(`CSV upload processed: ${result.successful}/${result.totalRows} enrollments by admin ${req.user.id}`);

      res.json({
        ...result,
        targetRegion: {
          regionId: req.targetRegion.regionId,
          autoAssigned: req.targetRegion.autoAssigned
        }
      });
    } catch (error) {
      logger.error('Error processing CSV upload:', error);

      // Clean up on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }

      res.status(500).json({
        success: false,
        error: 'Failed to process CSV upload'
      });
    }
  }
);

/**
 * @route GET /api/csv-upload/history
 * @desc Get CSV upload history for current admin
 * @access Admin+
 */
router.get(
  '/history',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  async (req, res) => {
    try {
      const { limit = 50 } = req.query;

      const history = await csvProcessorService.getCSVUploadHistory(
        req.user.id,
        parseInt(limit)
      );

      res.json({
        success: true,
        data: history,
        totalUploads: history.length
      });
    } catch (error) {
      logger.error('Error fetching CSV upload history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch upload history'
      });
    }
  }
);

/**
 * @route GET /api/csv-upload/stats
 * @desc Get CSV upload statistics
 * @access Admin+
 */
router.get(
  '/stats',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.attachRoleInfo,
  async (req, res) => {
    try {
      const { courseId, regionId, startDate, endDate } = req.query;

      const filters = {
        uploadedBy: req.user.id
      };

      if (courseId) filters.courseId = parseInt(courseId);

      // Regional Admins can only see their region stats
      if (regionId) {
        const hasAccess = await rbacService.hasRegionAccess(req.user.id, regionId);
        if (hasAccess) {
          filters.regionId = parseInt(regionId);
        }
      } else if (req.userRole && !req.userRole.isSuperAdmin && req.userRole.primaryRegionId) {
        filters.regionId = req.userRole.primaryRegionId;
      }

      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const stats = await csvProcessorService.getCSVUploadStats(filters);

      res.json({
        success: true,
        data: stats,
        filters: filters
      });
    } catch (error) {
      logger.error('Error fetching CSV upload stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch upload statistics'
      });
    }
  }
);

/**
 * @route GET /api/csv-upload/logs/:logId
 * @desc Get detailed log for a specific CSV upload
 * @access Admin+
 */
router.get(
  '/logs/:logId',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  async (req, res) => {
    try {
      const logId = parseInt(req.params.logId);

      const query = `
        SELECT
          cl.*,
          c.title AS course_title,
          c.code AS course_code,
          r.name AS target_region_name,
          r.code AS target_region_code,
          a.name AS uploaded_by_name
        FROM csv_upload_logs cl
        LEFT JOIN courses c ON cl.course_id = c.id
        LEFT JOIN regions r ON cl.target_region_id = r.id
        LEFT JOIN admin_users a ON cl.uploaded_by = a.id
        WHERE cl.id = $1
      `;

      const postgresService = require('../services/database/postgres.service');
      const result = await postgresService.query(query, [logId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Upload log not found'
        });
      }

      const log = result.rows[0];

      // Check access
      if (log.uploaded_by !== req.user.id) {
        const rbacService = require('../services/rbac.service');
        const isSuperAdmin = await rbacService.isSuperAdmin(req.user.id);
        if (!isSuperAdmin) {
          return res.status(403).json({
            success: false,
            error: 'You do not have access to this upload log'
          });
        }
      }

      // Parse error details
      if (log.error_details) {
        try {
          log.error_details = JSON.parse(log.error_details);
        } catch (e) {
          // Keep as string if not valid JSON
        }
      }

      res.json({
        success: true,
        data: log
      });
    } catch (error) {
      logger.error(`Error fetching CSV upload log ${req.params.logId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch upload log'
      });
    }
  }
);

/**
 * @route GET /api/csv-upload/all-history
 * @desc Get all CSV upload history (Super Admin only)
 * @access Super Admin only
 */
router.get(
  '/all-history',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireSuperAdmin,
  async (req, res) => {
    try {
      const { limit = 100, offset = 0, courseId, regionId } = req.query;

      let query = `
        SELECT
          cl.*,
          c.title AS course_title,
          c.code AS course_code,
          r.name AS target_region_name,
          r.code AS target_region_code,
          a.name AS uploaded_by_name
        FROM csv_upload_logs cl
        LEFT JOIN courses c ON cl.course_id = c.id
        LEFT JOIN regions r ON cl.target_region_id = r.id
        LEFT JOIN admin_users a ON cl.uploaded_by = a.id
        WHERE 1=1
      `;

      const params = [];
      let paramCount = 1;

      if (courseId) {
        query += ` AND cl.course_id = $${paramCount++}`;
        params.push(parseInt(courseId));
      }

      if (regionId) {
        query += ` AND cl.target_region_id = $${paramCount++}`;
        params.push(parseInt(regionId));
      }

      query += ` ORDER BY cl.uploaded_at DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
      params.push(parseInt(limit), parseInt(offset));

      const postgresService = require('../services/database/postgres.service');
      const result = await postgresService.query(query, params);

      // Get total count
      const countQuery = 'SELECT COUNT(*) as count FROM csv_upload_logs';
      const countResult = await postgresService.query(countQuery);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: parseInt(countResult.rows[0].count)
        }
      });
    } catch (error) {
      logger.error('Error fetching all CSV upload history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch upload history'
      });
    }
  }
);

/**
 * @route GET /api/csv-upload/region-options
 * @desc Get available regions for CSV upload (Super Admin only)
 * @access Super Admin only
 */
router.get(
  '/region-options',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireSuperAdmin,
  async (req, res) => {
    try {
      const regionService = require('../services/region.service');
      const regions = await regionService.getAllRegions();

      const options = regions
        .filter(r => r.is_active)
        .map(r => ({
          value: r.id,
          label: `${r.name} (${r.code})`,
          code: r.code,
          name: r.name
        }));

      res.json({
        success: true,
        data: options
      });
    } catch (error) {
      logger.error('Error fetching region options:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch region options'
      });
    }
  }
);

module.exports = router;
