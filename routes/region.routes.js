/**
 * Region Management Routes
 * Multi-Region RBAC System
 *
 * Features:
 * - Region CRUD (Super Admin only)
 * - Region listing with stats
 * - Regional data access control
 * - Dependency checking before deletion
 */

const express = require('express');
const router = express.Router();
const regionService = require('../services/region.service');
const authMiddleware = require('../middleware/auth.middleware');
const rbacMiddleware = require('../middleware/rbac.middleware');
const logger = require('../utils/logger');

/**
 * @route GET /api/regions
 * @desc Get all regions with stats (filtered by admin's access)
 * @access Admin+
 */
router.get(
  '/',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.attachRoleInfo,
  async (req, res) => {
    try {
      const regions = await regionService.getAllRegions();

      // Filter by accessible regions for Regional Admins
      let filteredRegions = regions;
      if (req.userRole && !req.userRole.isSuperAdmin && req.assignedRegions) {
        filteredRegions = regions.filter(region =>
          req.assignedRegions.includes(region.id)
        );
      }

      res.json({
        success: true,
        data: filteredRegions,
        userRole: req.userRole
      });
    } catch (error) {
      logger.error('Error fetching regions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch regions'
      });
    }
  }
);

/**
 * @route GET /api/regions/:id
 * @desc Get region details by ID
 * @access Admin+ (with region access validation)
 */
router.get(
  '/:id',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateRegionAccess,
  async (req, res) => {
    try {
      const regionId = parseInt(req.params.id);
      const region = await regionService.getRegionById(regionId);

      if (!region) {
        return res.status(404).json({
          success: false,
          error: 'Region not found'
        });
      }

      res.json({
        success: true,
        data: region
      });
    } catch (error) {
      logger.error(`Error fetching region ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch region details'
      });
    }
  }
);

/**
 * @route GET /api/regions/:id/stats
 * @desc Get region statistics (courses, users, admins)
 * @access Admin+ (with region access validation)
 */
router.get(
  '/:id/stats',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateRegionAccess,
  async (req, res) => {
    try {
      const regionId = parseInt(req.params.id);
      const stats = await regionService.getRegionStats(regionId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error(`Error fetching region stats ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch region statistics'
      });
    }
  }
);

/**
 * @route GET /api/regions/:id/courses
 * @desc Get all courses in a region
 * @access Admin+ (with region access validation)
 */
router.get(
  '/:id/courses',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateRegionAccess,
  async (req, res) => {
    try {
      const regionId = parseInt(req.params.id);
      const courses = await regionService.getRegionCourses(regionId);

      res.json({
        success: true,
        data: courses
      });
    } catch (error) {
      logger.error(`Error fetching courses for region ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch region courses'
      });
    }
  }
);

/**
 * @route GET /api/regions/:id/users
 * @desc Get all users in a region
 * @access Admin+ (with region access validation)
 */
router.get(
  '/:id/users',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateRegionAccess,
  async (req, res) => {
    try {
      const regionId = parseInt(req.params.id);
      const { limit = 100, offset = 0 } = req.query;

      const users = await regionService.getRegionUsers(
        regionId,
        parseInt(limit),
        parseInt(offset)
      );

      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      logger.error(`Error fetching users for region ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch region users'
      });
    }
  }
);

/**
 * @route GET /api/regions/:id/admins
 * @desc Get all admins assigned to a region
 * @access Super Admin only
 */
router.get(
  '/:id/admins',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireSuperAdmin,
  async (req, res) => {
    try {
      const regionId = parseInt(req.params.id);
      const admins = await regionService.getRegionAdmins(regionId);

      res.json({
        success: true,
        data: admins
      });
    } catch (error) {
      logger.error(`Error fetching admins for region ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch region administrators'
      });
    }
  }
);

/**
 * @route POST /api/regions
 * @desc Create a new region
 * @access Super Admin only
 * @body { name, code, description }
 */
router.post(
  '/',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireSuperAdmin,
  rbacMiddleware.validateRequiredFields(['name', 'code']),
  async (req, res) => {
    try {
      const { name, code, description } = req.body;

      const result = await regionService.createRegion(req.user.id, {
        name,
        code: code.toUpperCase(),
        description
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      logger.info(`Region created: ${code} by admin ${req.user.id}`);
      res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating region:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create region'
      });
    }
  }
);

/**
 * @route PUT /api/regions/:id
 * @desc Update region details
 * @access Super Admin only
 * @body { name?, code?, description?, is_active? }
 */
router.put(
  '/:id',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireSuperAdmin,
  async (req, res) => {
    try {
      const regionId = parseInt(req.params.id);
      const { name, code, description, is_active } = req.body;

      // Validate at least one field is provided
      if (!name && !code && description === undefined && is_active === undefined) {
        return res.status(400).json({
          success: false,
          error: 'At least one field must be provided for update'
        });
      }

      const updateData = {};
      if (name) updateData.name = name;
      if (code) updateData.code = code.toUpperCase();
      if (description !== undefined) updateData.description = description;
      if (is_active !== undefined) updateData.is_active = is_active;

      const result = await regionService.updateRegion(
        req.user.id,
        regionId,
        updateData
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      logger.info(`Region ${regionId} updated by admin ${req.user.id}`);
      res.json(result);
    } catch (error) {
      logger.error(`Error updating region ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to update region'
      });
    }
  }
);

/**
 * @route DELETE /api/regions/:id
 * @desc Delete a region (with dependency check)
 * @access Super Admin only
 */
router.delete(
  '/:id',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireSuperAdmin,
  async (req, res) => {
    try {
      const regionId = parseInt(req.params.id);

      // Check dependencies before deletion
      const dependencies = await regionService.checkRegionDependencies(regionId);

      if (dependencies.hasDependencies) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete region with existing dependencies',
          dependencies: {
            courses: dependencies.courses,
            users: dependencies.users,
            admins: dependencies.admins
          },
          suggestion: 'Deactivate the region instead, or reassign all dependencies first'
        });
      }

      const result = await regionService.deleteRegion(req.user.id, regionId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      logger.info(`Region ${regionId} deleted by admin ${req.user.id}`);
      res.json(result);
    } catch (error) {
      logger.error(`Error deleting region ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete region'
      });
    }
  }
);

/**
 * @route POST /api/regions/:id/activate
 * @desc Activate a region
 * @access Super Admin only
 */
router.post(
  '/:id/activate',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireSuperAdmin,
  async (req, res) => {
    try {
      const regionId = parseInt(req.params.id);

      const result = await regionService.updateRegion(
        req.user.id,
        regionId,
        { is_active: true }
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      logger.info(`Region ${regionId} activated by admin ${req.user.id}`);
      res.json(result);
    } catch (error) {
      logger.error(`Error activating region ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to activate region'
      });
    }
  }
);

/**
 * @route POST /api/regions/:id/deactivate
 * @desc Deactivate a region
 * @access Super Admin only
 */
router.post(
  '/:id/deactivate',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireSuperAdmin,
  async (req, res) => {
    try {
      const regionId = parseInt(req.params.id);

      const result = await regionService.updateRegion(
        req.user.id,
        regionId,
        { is_active: false }
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      logger.info(`Region ${regionId} deactivated by admin ${req.user.id}`);
      res.json(result);
    } catch (error) {
      logger.error(`Error deactivating region ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to deactivate region'
      });
    }
  }
);

/**
 * @route GET /api/regions/code/:code
 * @desc Get region by code
 * @access Admin+
 */
router.get(
  '/code/:code',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  async (req, res) => {
    try {
      const { code } = req.params;
      const region = await regionService.getRegionByCode(code.toUpperCase());

      if (!region) {
        return res.status(404).json({
          success: false,
          error: 'Region not found'
        });
      }

      // Check regional access
      if (req.userRole && !req.userRole.isSuperAdmin && req.assignedRegions) {
        if (!req.assignedRegions.includes(region.id)) {
          return res.status(403).json({
            success: false,
            error: 'You do not have access to this region'
          });
        }
      }

      res.json({
        success: true,
        data: region
      });
    } catch (error) {
      logger.error(`Error fetching region by code ${req.params.code}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch region'
      });
    }
  }
);

module.exports = router;
