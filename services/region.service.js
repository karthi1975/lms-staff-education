/**
 * Region Service
 * Manages geographic regions for multi-region RBAC system
 *
 * Regions:
 * - TZ (Tanzania)
 * - RW (Rwanda)
 * - KE (Kenya)
 * - BI (Burundi)
 * - ALL (All Regions)
 * - Super Admin can add more regions
 */

const postgresService = require('./database/postgres.service');
const rbacService = require('./rbac.service');

class RegionService {
  constructor() {
    this.ALL_REGIONS_ID = 5; // Special ID for "All Regions"
  }

  /**
   * Get all regions
   * @param {boolean} activeOnly - Return only active regions
   * @returns {Promise<Array>} List of regions
   */
  async getAllRegions(activeOnly = true) {
    try {
      const query = activeOnly
        ? 'SELECT * FROM regions WHERE is_active = TRUE ORDER BY name'
        : 'SELECT * FROM regions ORDER BY name';

      const result = await postgresService.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error getting all regions:', error);
      throw error;
    }
  }

  /**
   * Get region by ID
   * @param {number} regionId - Region ID
   * @returns {Promise<Object|null>} Region details
   */
  async getRegionById(regionId) {
    try {
      const query = 'SELECT * FROM regions WHERE id = $1';
      const result = await postgresService.query(query, [regionId]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting region by ID:', error);
      throw error;
    }
  }

  /**
   * Get region by code
   * @param {string} code - Region code (TZ, RW, KE, etc.)
   * @returns {Promise<Object|null>} Region details
   */
  async getRegionByCode(code) {
    try {
      const query = 'SELECT * FROM regions WHERE code = $1';
      const result = await postgresService.query(query, [code.toUpperCase()]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting region by code:', error);
      throw error;
    }
  }

  /**
   * Create new region (Super Admin only)
   * @param {number} superAdminId - Super Admin ID
   * @param {Object} regionData - Region data { code, name, description }
   * @returns {Promise<Object>} Creation result
   */
  async createRegion(superAdminId, regionData) {
    try {
      // Verify Super Admin
      if (!await rbacService.isSuperAdmin(superAdminId)) {
        return { success: false, error: 'Only Super Admin can create regions' };
      }

      const { code, name, description } = regionData;

      // Validate required fields
      if (!code || !name) {
        return { success: false, error: 'Code and name are required' };
      }

      // Check if code already exists
      const existing = await this.getRegionByCode(code);
      if (existing) {
        return { success: false, error: `Region with code ${code} already exists` };
      }

      // Insert new region
      const query = `
        INSERT INTO regions (code, name, description, is_active)
        VALUES ($1, $2, $3, TRUE)
        RETURNING *
      `;
      const result = await postgresService.query(query, [
        code.toUpperCase(),
        name,
        description || null
      ]);

      return { success: true, data: result.rows[0] };
    } catch (error) {
      console.error('Error creating region:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update region (Super Admin only)
   * @param {number} superAdminId - Super Admin ID
   * @param {number} regionId - Region ID to update
   * @param {Object} updateData - Data to update { name, description, is_active }
   * @returns {Promise<Object>} Update result
   */
  async updateRegion(superAdminId, regionId, updateData) {
    try {
      // Verify Super Admin
      if (!await rbacService.isSuperAdmin(superAdminId)) {
        return { success: false, error: 'Only Super Admin can update regions' };
      }

      // Check if region exists
      const region = await this.getRegionById(regionId);
      if (!region) {
        return { success: false, error: 'Region not found' };
      }

      // Build update query dynamically
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (updateData.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(updateData.name);
      }

      if (updateData.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(updateData.description);
      }

      if (updateData.is_active !== undefined) {
        updates.push(`is_active = $${paramCount++}`);
        values.push(updateData.is_active);
      }

      if (updates.length === 0) {
        return { success: false, error: 'No fields to update' };
      }

      values.push(regionId);

      const query = `
        UPDATE regions
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await postgresService.query(query, values);
      return { success: true, data: result.rows[0] };
    } catch (error) {
      console.error('Error updating region:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete region (Super Admin only)
   * Note: This will fail if region has dependencies (courses, users, etc.)
   * @param {number} superAdminId - Super Admin ID
   * @param {number} regionId - Region ID to delete
   * @returns {Promise<Object>} Deletion result
   */
  async deleteRegion(superAdminId, regionId) {
    try {
      // Verify Super Admin
      if (!await rbacService.isSuperAdmin(superAdminId)) {
        return { success: false, error: 'Only Super Admin can delete regions' };
      }

      // Prevent deletion of "All Regions"
      if (regionId === this.ALL_REGIONS_ID) {
        return { success: false, error: 'Cannot delete "All Regions" region' };
      }

      // Check if region exists
      const region = await this.getRegionById(regionId);
      if (!region) {
        return { success: false, error: 'Region not found' };
      }

      // Check for dependencies
      const dependencies = await this.checkRegionDependencies(regionId);
      if (dependencies.hasDependencies) {
        return {
          success: false,
          error: 'Cannot delete region with dependencies',
          dependencies
        };
      }

      // Delete region
      const query = 'DELETE FROM regions WHERE id = $1 RETURNING *';
      const result = await postgresService.query(query, [regionId]);

      return { success: true, data: result.rows[0] };
    } catch (error) {
      console.error('Error deleting region:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Soft delete region (deactivate)
   * @param {number} superAdminId - Super Admin ID
   * @param {number} regionId - Region ID to deactivate
   * @returns {Promise<Object>} Deactivation result
   */
  async deactivateRegion(superAdminId, regionId) {
    try {
      return await this.updateRegion(superAdminId, regionId, { is_active: false });
    } catch (error) {
      console.error('Error deactivating region:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Activate region
   * @param {number} superAdminId - Super Admin ID
   * @param {number} regionId - Region ID to activate
   * @returns {Promise<Object>} Activation result
   */
  async activateRegion(superAdminId, regionId) {
    try {
      return await this.updateRegion(superAdminId, regionId, { is_active: true });
    } catch (error) {
      console.error('Error activating region:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if region has dependencies (courses, users, admins)
   * @param {number} regionId - Region ID
   * @returns {Promise<Object>} Dependency information
   */
  async checkRegionDependencies(regionId) {
    try {
      // Check courses
      const coursesQuery = 'SELECT COUNT(*) as count FROM courses WHERE region_id = $1';
      const coursesResult = await postgresService.query(coursesQuery, [regionId]);
      const coursesCount = parseInt(coursesResult.rows[0].count);

      // Check users
      const usersQuery = 'SELECT COUNT(*) as count FROM users WHERE primary_region_id = $1';
      const usersResult = await postgresService.query(usersQuery, [regionId]);
      const usersCount = parseInt(usersResult.rows[0].count);

      // Check admin users
      const adminUsersQuery = 'SELECT COUNT(*) as count FROM admin_users WHERE primary_region_id = $1';
      const adminUsersResult = await postgresService.query(adminUsersQuery, [regionId]);
      const adminUsersCount = parseInt(adminUsersResult.rows[0].count);

      // Check admin region assignments
      const adminRegionsQuery = 'SELECT COUNT(*) as count FROM admin_regions WHERE region_id = $1';
      const adminRegionsResult = await postgresService.query(adminRegionsQuery, [regionId]);
      const adminRegionsCount = parseInt(adminRegionsResult.rows[0].count);

      const hasDependencies = coursesCount > 0 || usersCount > 0 || adminUsersCount > 0 || adminRegionsCount > 0;

      return {
        hasDependencies,
        courses: coursesCount,
        users: usersCount,
        adminUsers: adminUsersCount,
        adminRegions: adminRegionsCount
      };
    } catch (error) {
      console.error('Error checking region dependencies:', error);
      throw error;
    }
  }

  /**
   * Get region statistics
   * @param {number} regionId - Region ID
   * @returns {Promise<Object>} Region statistics
   */
  async getRegionStats(regionId) {
    try {
      const stats = await this.checkRegionDependencies(regionId);
      const region = await this.getRegionById(regionId);

      return {
        region,
        statistics: stats
      };
    } catch (error) {
      console.error('Error getting region stats:', error);
      throw error;
    }
  }

  /**
   * Get all regions with statistics
   * @returns {Promise<Array>} Regions with statistics
   */
  async getAllRegionsWithStats() {
    try {
      const regions = await this.getAllRegions(false); // Include inactive

      const regionsWithStats = await Promise.all(
        regions.map(async (region) => {
          const dependencies = await this.checkRegionDependencies(region.id);
          return {
            ...region,
            statistics: dependencies
          };
        })
      );

      return regionsWithStats;
    } catch (error) {
      console.error('Error getting all regions with stats:', error);
      throw error;
    }
  }

  /**
   * Validate region code format
   * @param {string} code - Region code
   * @returns {boolean} Valid or not
   */
  validateRegionCode(code) {
    // Region code should be 2-10 uppercase letters
    const regex = /^[A-Z]{2,10}$/;
    return regex.test(code);
  }

  /**
   * Get courses in region
   * @param {number} regionId - Region ID
   * @returns {Promise<Array>} Courses in region
   */
  async getCoursesInRegion(regionId) {
    try {
      const query = `
        SELECT * FROM v_courses_with_regions
        WHERE region_id = $1 AND is_active = TRUE
        ORDER BY title
      `;
      const result = await postgresService.query(query, [regionId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting courses in region:', error);
      throw error;
    }
  }

  /**
   * Get users in region
   * @param {number} regionId - Region ID
   * @returns {Promise<Array>} Users in region
   */
  async getUsersInRegion(regionId) {
    try {
      const query = `
        SELECT * FROM v_users_with_roles
        WHERE primary_region_id = $1 AND is_active = TRUE
        ORDER BY full_name
      `;
      const result = await postgresService.query(query, [regionId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting users in region:', error);
      throw error;
    }
  }

  /**
   * Get admins managing region
   * @param {number} regionId - Region ID
   * @returns {Promise<Array>} Admins managing this region
   */
  async getAdminsManagingRegion(regionId) {
    try {
      const query = `
        SELECT
          a.id,
          a.email,
          a.name,
          a.role_id,
          r.name AS role_name,
          ar.assigned_at,
          ar.assigned_by
        FROM admin_regions ar
        JOIN admin_users a ON ar.admin_user_id = a.id
        LEFT JOIN roles r ON a.role_id = r.id
        WHERE ar.region_id = $1 AND a.is_active = TRUE
        ORDER BY a.name
      `;
      const result = await postgresService.query(query, [regionId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting admins managing region:', error);
      throw error;
    }
  }
}

// Create singleton instance
const regionService = new RegionService();

module.exports = regionService;
