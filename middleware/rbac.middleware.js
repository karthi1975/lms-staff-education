/**
 * RBAC Middleware
 * Role-Based Access Control for Multi-Region System
 *
 * Integrates with existing auth.middleware.js
 * Adds regional access control and new role hierarchy
 */

const rbacService = require('../services/rbac.service');
const regionService = require('../services/region.service');

/**
 * Require Super Admin role
 */
const requireSuperAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const isSuperAdmin = await rbacService.isSuperAdmin(req.user.id);

    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Super Admin access required'
      });
    }

    // Attach role info to request
    req.userRole = {
      isSuperAdmin: true,
      isRegionalAdmin: false,
      roleId: rbacService.ROLES.SUPER_ADMIN
    };

    next();
  } catch (error) {
    console.error('Error in requireSuperAdmin middleware:', error);
    return res.status(500).json({
      success: false,
      error: 'Error checking permissions'
    });
  }
};

/**
 * Require Regional Admin or Super Admin
 */
const requireRegionalAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const isSuperAdmin = await rbacService.isSuperAdmin(req.user.id);
    const isRegionalAdmin = await rbacService.isRegionalAdmin(req.user.id);

    if (!isSuperAdmin && !isRegionalAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    // Attach role info to request
    req.userRole = {
      isSuperAdmin,
      isRegionalAdmin,
      roleId: isSuperAdmin ? rbacService.ROLES.SUPER_ADMIN : rbacService.ROLES.ADMIN
    };

    // Attach assigned regions for Regional Admin
    if (isRegionalAdmin && !isSuperAdmin) {
      const regions = await rbacService.getAdminAssignedRegions(req.user.id);
      req.assignedRegions = regions.map(r => r.region_id);
    }

    next();
  } catch (error) {
    console.error('Error in requireRegionalAdmin middleware:', error);
    return res.status(500).json({
      success: false,
      error: 'Error checking permissions'
    });
  }
};

/**
 * Validate course access (used in route params)
 * Checks if admin can manage the course based on region
 */
const validateCourseAccess = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const courseId = req.params.courseId || req.params.id || req.body.courseId;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'Course ID required'
      });
    }

    const result = await rbacService.canManageCourse(req.user.id, courseId);

    if (!result.canManage) {
      return res.status(403).json({
        success: false,
        error: result.reason
      });
    }

    // Attach course access validation
    req.courseAccess = {
      canManage: true,
      courseId: parseInt(courseId)
    };

    next();
  } catch (error) {
    console.error('Error in validateCourseAccess middleware:', error);
    return res.status(500).json({
      success: false,
      error: 'Error validating course access'
    });
  }
};

/**
 * Validate region access (used in route params)
 * Checks if admin has access to the specified region
 */
const validateRegionAccess = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const regionId = req.params.regionId || req.params.id || req.body.regionId || req.body.target_region_id;

    if (!regionId) {
      return res.status(400).json({
        success: false,
        error: 'Region ID required'
      });
    }

    // Super Admin has access to all regions
    const isSuperAdmin = await rbacService.isSuperAdmin(req.user.id);
    if (isSuperAdmin) {
      req.regionAccess = {
        hasAccess: true,
        regionId: parseInt(regionId),
        isSuperAdmin: true
      };
      return next();
    }

    // Check regional access
    const hasAccess = await rbacService.hasRegionAccess(req.user.id, regionId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this region'
      });
    }

    req.regionAccess = {
      hasAccess: true,
      regionId: parseInt(regionId),
      isSuperAdmin: false
    };

    next();
  } catch (error) {
    console.error('Error in validateRegionAccess middleware:', error);
    return res.status(500).json({
      success: false,
      error: 'Error validating region access'
    });
  }
};

/**
 * Validate enrollment access
 * Checks if admin can manage enrollment (based on course region)
 */
const validateEnrollmentAccess = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const courseId = req.body.courseId || req.body.course_id;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'Course ID required for enrollment'
      });
    }

    const result = await rbacService.canEnrollInCourse(req.user.id, courseId);

    if (!result.canEnroll) {
      return res.status(403).json({
        success: false,
        error: result.reason
      });
    }

    req.enrollmentAccess = {
      canEnroll: true,
      courseId: parseInt(courseId)
    };

    next();
  } catch (error) {
    console.error('Error in validateEnrollmentAccess middleware:', error);
    return res.status(500).json({
      success: false,
      error: 'Error validating enrollment access'
    });
  }
};

/**
 * Auto-detect target region for CSV upload
 * Super Admin: Region from request body (required)
 * Regional Admin: Auto-assign to their primary region
 */
const resolveTargetRegion = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const isSuperAdmin = await rbacService.isSuperAdmin(req.user.id);

    if (isSuperAdmin) {
      // Super Admin must specify target region
      const targetRegionId = req.body.targetRegionId || req.body.target_region_id;

      if (!targetRegionId) {
        return res.status(400).json({
          success: false,
          error: 'Target region must be specified by Super Admin'
        });
      }

      // Validate region exists
      const region = await regionService.getRegionById(targetRegionId);
      if (!region) {
        return res.status(404).json({
          success: false,
          error: 'Target region not found'
        });
      }

      req.targetRegion = {
        regionId: parseInt(targetRegionId),
        autoAssigned: false
      };
    } else {
      // Regional Admin: Auto-assign to their primary region
      const adminRole = await rbacService.getAdminUserRole(req.user.id);

      if (!adminRole || !adminRole.primary_region_id) {
        return res.status(403).json({
          success: false,
          error: 'No region assigned to your account'
        });
      }

      req.targetRegion = {
        regionId: adminRole.primary_region_id,
        autoAssigned: true
      };
    }

    next();
  } catch (error) {
    console.error('Error in resolveTargetRegion middleware:', error);
    return res.status(500).json({
      success: false,
      error: 'Error resolving target region'
    });
  }
};

/**
 * Attach user role information to request
 * Useful for conditional logic in controllers
 */
const attachRoleInfo = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(); // Skip if no user authenticated
    }

    const roleInfo = await rbacService.getAdminUserRole(req.user.id);

    if (roleInfo) {
      req.userRole = {
        isSuperAdmin: roleInfo.role_id === rbacService.ROLES.SUPER_ADMIN,
        isRegionalAdmin: roleInfo.role_id === rbacService.ROLES.ADMIN,
        roleId: roleInfo.role_id,
        roleName: roleInfo.role_name,
        primaryRegionId: roleInfo.primary_region_id,
        primaryRegionCode: roleInfo.primary_region_code
      };

      // Get assigned regions for Regional Admin
      if (roleInfo.role_id === rbacService.ROLES.ADMIN) {
        const regions = await rbacService.getAdminAssignedRegions(req.user.id);
        req.assignedRegions = regions.map(r => r.region_id);
      }
    }

    next();
  } catch (error) {
    console.error('Error in attachRoleInfo middleware:', error);
    // Don't block request on error, just skip role attachment
    next();
  }
};

/**
 * Filter response data by accessible regions
 * Automatically filters array responses for Regional Admins
 */
const filterByRegion = (dataKey = 'data') => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = async function(body) {
      try {
        // Skip filtering for Super Admin or if no user role
        if (!req.userRole || req.userRole.isSuperAdmin) {
          return originalJson(body);
        }

        // Skip if not Regional Admin
        if (!req.userRole.isRegionalAdmin) {
          return originalJson(body);
        }

        // Skip if no assigned regions
        if (!req.assignedRegions || req.assignedRegions.length === 0) {
          return originalJson(body);
        }

        // Filter data if it's an array
        if (body && Array.isArray(body[dataKey])) {
          body[dataKey] = body[dataKey].filter(item => {
            // Check if item has region_id and filter
            if (item.region_id) {
              return req.assignedRegions.includes(item.region_id);
            }
            // If no region_id, include by default
            return true;
          });
        }

        return originalJson(body);
      } catch (error) {
        console.error('Error in filterByRegion:', error);
        return originalJson(body);
      }
    };

    next();
  };
};

/**
 * Validate request body fields
 */
const validateRequiredFields = (fields) => {
  return (req, res, next) => {
    const missing = fields.filter(field => !req.body[field]);

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`
      });
    }

    next();
  };
};

module.exports = {
  // Role requirements
  requireSuperAdmin,
  requireRegionalAdmin,

  // Access validation
  validateCourseAccess,
  validateRegionAccess,
  validateEnrollmentAccess,
  resolveTargetRegion,

  // Utilities
  attachRoleInfo,
  filterByRegion,
  validateRequiredFields
};
