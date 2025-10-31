/**
 * RBAC Service
 * Role-Based Access Control for Multi-Region System
 *
 * Roles:
 * - Super Admin (level 1): Full system access across all regions
 * - Regional Administrator (level 2): CRUD within assigned regions
 * - WhatsApp User (level 3): Access enrolled courses only
 */

const postgresService = require('./database/postgres.service');

class RBACService {
  constructor() {
    this.ROLES = {
      SUPER_ADMIN: 1,
      ADMIN: 2,
      WHATSAPP_USER: 3
    };

    this.ROLE_NAMES = {
      1: 'super_admin',
      2: 'admin',
      3: 'whatsapp_user'
    };
  }

  /**
   * Get user role information (for admin users)
   * @param {number} adminUserId - Admin user ID
   * @returns {Promise<Object>} Role and region information
   */
  async getAdminUserRole(adminUserId) {
    try {
      const query = `
        SELECT
          a.id,
          a.email,
          a.name,
          a.role_id,
          r.name AS role_name,
          r.display_name AS role_display_name,
          r.level AS role_level,
          a.primary_region_id,
          reg.code AS primary_region_code,
          reg.name AS primary_region_name
        FROM admin_users a
        LEFT JOIN roles r ON a.role_id = r.id
        LEFT JOIN regions reg ON a.primary_region_id = reg.id
        WHERE a.id = $1 AND a.is_active = TRUE
      `;

      const result = await postgresService.query(query, [adminUserId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting admin user role:', error);
      throw error;
    }
  }

  /**
   * Get user role information (for WhatsApp users)
   * @param {number} userId - WhatsApp user ID
   * @returns {Promise<Object>} Role and region information
   */
  async getWhatsAppUserRole(userId) {
    try {
      const query = `
        SELECT
          u.id,
          u.whatsapp_id,
          u.name,
          u.role_id,
          r.name AS role_name,
          r.display_name AS role_display_name,
          r.level AS role_level,
          u.primary_region_id,
          reg.code AS primary_region_code,
          reg.name AS primary_region_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN regions reg ON u.primary_region_id = reg.id
        WHERE u.id = $1 AND u.is_active = TRUE
      `;

      const result = await postgresService.query(query, [userId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting WhatsApp user role:', error);
      throw error;
    }
  }

  /**
   * Get all regions assigned to an admin
   * @param {number} adminUserId - Admin user ID
   * @returns {Promise<Array>} List of assigned regions
   */
  async getAdminAssignedRegions(adminUserId) {
    try {
      const query = `
        SELECT
          ar.admin_user_id,
          ar.region_id,
          r.code AS region_code,
          r.name AS region_name,
          r.is_active,
          ar.assigned_at,
          ar.assigned_by
        FROM admin_regions ar
        JOIN regions r ON ar.region_id = r.id
        WHERE ar.admin_user_id = $1 AND r.is_active = TRUE
        ORDER BY r.name
      `;

      const result = await postgresService.query(query, [adminUserId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting admin assigned regions:', error);
      throw error;
    }
  }

  /**
   * Check if user is Super Admin
   * @param {number} adminUserId - Admin user ID
   * @returns {Promise<boolean>}
   */
  async isSuperAdmin(adminUserId) {
    try {
      const roleInfo = await this.getAdminUserRole(adminUserId);
      return roleInfo && roleInfo.role_id === this.ROLES.SUPER_ADMIN;
    } catch (error) {
      console.error('Error checking super admin:', error);
      return false;
    }
  }

  /**
   * Check if user is Regional Admin
   * @param {number} adminUserId - Admin user ID
   * @returns {Promise<boolean>}
   */
  async isRegionalAdmin(adminUserId) {
    try {
      const roleInfo = await this.getAdminUserRole(adminUserId);
      return roleInfo && roleInfo.role_id === this.ROLES.ADMIN;
    } catch (error) {
      console.error('Error checking regional admin:', error);
      return false;
    }
  }

  /**
   * Check if admin has access to a specific region
   * @param {number} adminUserId - Admin user ID
   * @param {number} regionId - Region ID to check
   * @returns {Promise<boolean>}
   */
  async hasRegionAccess(adminUserId, regionId) {
    try {
      // Super Admin has access to all regions
      if (await this.isSuperAdmin(adminUserId)) {
        return true;
      }

      // Check if admin is assigned to this region
      const query = `
        SELECT 1 FROM admin_regions
        WHERE admin_user_id = $1 AND region_id = $2
      `;

      const result = await postgresService.query(query, [adminUserId, regionId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking region access:', error);
      return false;
    }
  }

  /**
   * Check if admin can manage a specific course
   * @param {number} adminUserId - Admin user ID
   * @param {number} courseId - Course ID
   * @returns {Promise<Object>} { canManage: boolean, reason: string }
   */
  async canManageCourse(adminUserId, courseId) {
    try {
      // Super Admin can manage all courses
      if (await this.isSuperAdmin(adminUserId)) {
        return { canManage: true, reason: 'Super Admin access' };
      }

      // Get course region
      const courseQuery = `
        SELECT region_id FROM courses WHERE id = $1
      `;
      const courseResult = await postgresService.query(courseQuery, [courseId]);

      if (courseResult.rows.length === 0) {
        return { canManage: false, reason: 'Course not found' };
      }

      const courseRegionId = courseResult.rows[0].region_id;

      // Check if course has no region assigned
      if (!courseRegionId) {
        return { canManage: false, reason: 'Course not assigned to any region' };
      }

      // Check if admin has access to course region
      const hasAccess = await this.hasRegionAccess(adminUserId, courseRegionId);

      if (hasAccess) {
        return { canManage: true, reason: 'Region access granted' };
      }

      return { canManage: false, reason: 'No access to course region' };
    } catch (error) {
      console.error('Error checking course management:', error);
      return { canManage: false, reason: 'Error checking permissions' };
    }
  }

  /**
   * Check if admin can enroll users in a course
   * @param {number} adminUserId - Admin user ID
   * @param {number} courseId - Course ID
   * @returns {Promise<Object>} { canEnroll: boolean, reason: string }
   */
  async canEnrollInCourse(adminUserId, courseId) {
    // Same logic as course management for now
    const result = await this.canManageCourse(adminUserId, courseId);
    return { canEnroll: result.canManage, reason: result.reason };
  }

  /**
   * Check if WhatsApp user can access a course
   * @param {number} userId - WhatsApp user ID
   * @param {number} courseId - Course ID
   * @returns {Promise<Object>} { canAccess: boolean, reason: string }
   */
  async canAccessCourse(userId, courseId) {
    try {
      // Check if user is enrolled
      const enrollmentQuery = `
        SELECT 1 FROM course_region_enrollments
        WHERE user_id = $1 AND course_id = $2 AND status = 'active'
      `;
      const enrollmentResult = await postgresService.query(enrollmentQuery, [userId, courseId]);

      if (enrollmentResult.rows.length === 0) {
        return { canAccess: false, reason: 'Not enrolled in course' };
      }

      // Check region match
      const userRole = await this.getWhatsAppUserRole(userId);
      const courseQuery = `
        SELECT region_id FROM courses WHERE id = $1
      `;
      const courseResult = await postgresService.query(courseQuery, [courseId]);

      if (courseResult.rows.length === 0) {
        return { canAccess: false, reason: 'Course not found' };
      }

      const courseRegionId = courseResult.rows[0].region_id;

      // If course is in "All Regions", allow access
      if (courseRegionId === 5) { // 5 = ALL regions
        return { canAccess: true, reason: 'Course available in all regions' };
      }

      // Check if user's region matches course region
      if (userRole.primary_region_id === courseRegionId) {
        return { canAccess: true, reason: 'Region match' };
      }

      return { canAccess: false, reason: 'Course not available in user region' };
    } catch (error) {
      console.error('Error checking course access:', error);
      return { canAccess: false, reason: 'Error checking permissions' };
    }
  }

  /**
   * Assign region to admin (Super Admin only)
   * @param {number} superAdminId - Super Admin ID
   * @param {number} adminUserId - Admin user ID to assign region to
   * @param {number} regionId - Region ID to assign
   * @returns {Promise<Object>} Assignment result
   */
  async assignRegionToAdmin(superAdminId, adminUserId, regionId) {
    try {
      // Verify Super Admin
      if (!await this.isSuperAdmin(superAdminId)) {
        return { success: false, error: 'Only Super Admin can assign regions' };
      }

      // Check if already assigned
      const checkQuery = `
        SELECT 1 FROM admin_regions
        WHERE admin_user_id = $1 AND region_id = $2
      `;
      const existing = await postgresService.query(checkQuery, [adminUserId, regionId]);

      if (existing.rows.length > 0) {
        return { success: false, error: 'Region already assigned to this admin' };
      }

      // Insert assignment
      const insertQuery = `
        INSERT INTO admin_regions (admin_user_id, region_id, assigned_by)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const result = await postgresService.query(insertQuery, [adminUserId, regionId, superAdminId]);

      return { success: true, data: result.rows[0] };
    } catch (error) {
      console.error('Error assigning region to admin:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove region from admin (Super Admin only)
   * @param {number} superAdminId - Super Admin ID
   * @param {number} adminUserId - Admin user ID
   * @param {number} regionId - Region ID to remove
   * @returns {Promise<Object>} Removal result
   */
  async removeRegionFromAdmin(superAdminId, adminUserId, regionId) {
    try {
      // Verify Super Admin
      if (!await this.isSuperAdmin(superAdminId)) {
        return { success: false, error: 'Only Super Admin can remove regions' };
      }

      // Delete assignment
      const deleteQuery = `
        DELETE FROM admin_regions
        WHERE admin_user_id = $1 AND region_id = $2
        RETURNING *
      `;
      const result = await postgresService.query(deleteQuery, [adminUserId, regionId]);

      if (result.rows.length === 0) {
        return { success: false, error: 'Region assignment not found' };
      }

      return { success: true, data: result.rows[0] };
    } catch (error) {
      console.error('Error removing region from admin:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all roles
   * @returns {Promise<Array>} List of all roles
   */
  async getAllRoles() {
    try {
      const query = `
        SELECT * FROM roles ORDER BY level
      `;
      const result = await postgresService.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error getting all roles:', error);
      throw error;
    }
  }

  /**
   * Update admin user role (Super Admin only)
   * @param {number} superAdminId - Super Admin ID
   * @param {number} adminUserId - Admin user ID to update
   * @param {number} roleId - New role ID
   * @returns {Promise<Object>} Update result
   */
  async updateAdminRole(superAdminId, adminUserId, roleId) {
    try {
      // Verify Super Admin
      if (!await this.isSuperAdmin(superAdminId)) {
        return { success: false, error: 'Only Super Admin can update roles' };
      }

      // Prevent self-demotion
      if (superAdminId === adminUserId && roleId !== this.ROLES.SUPER_ADMIN) {
        return { success: false, error: 'Cannot demote yourself' };
      }

      // Update role
      const updateQuery = `
        UPDATE admin_users
        SET role_id = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      const result = await postgresService.query(updateQuery, [roleId, adminUserId]);

      if (result.rows.length === 0) {
        return { success: false, error: 'Admin user not found' };
      }

      return { success: true, data: result.rows[0] };
    } catch (error) {
      console.error('Error updating admin role:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get courses accessible by admin (filtered by regions)
   * @param {number} adminUserId - Admin user ID
   * @returns {Promise<Array>} List of accessible courses
   */
  async getAccessibleCourses(adminUserId) {
    try {
      // Super Admin sees all courses
      if (await this.isSuperAdmin(adminUserId)) {
        const query = `
          SELECT * FROM v_courses_with_regions
          WHERE is_active = TRUE
          ORDER BY title
        `;
        const result = await postgresService.query(query);
        return result.rows;
      }

      // Regional Admin sees only their region courses
      const regions = await this.getAdminAssignedRegions(adminUserId);
      const regionIds = regions.map(r => r.region_id);

      if (regionIds.length === 0) {
        return [];
      }

      const query = `
        SELECT * FROM v_courses_with_regions
        WHERE is_active = TRUE AND region_id = ANY($1::int[])
        ORDER BY title
      `;
      const result = await postgresService.query(query, [regionIds]);
      return result.rows;
    } catch (error) {
      console.error('Error getting accessible courses:', error);
      throw error;
    }
  }

  /**
   * Get users accessible by admin (filtered by regions)
   * @param {number} adminUserId - Admin user ID
   * @returns {Promise<Array>} List of accessible users
   */
  async getAccessibleUsers(adminUserId) {
    try {
      // Super Admin sees all users
      if (await this.isSuperAdmin(adminUserId)) {
        const query = `
          SELECT * FROM v_users_with_roles
          WHERE is_active = TRUE
          ORDER BY full_name
        `;
        const result = await postgresService.query(query);
        return result.rows;
      }

      // Regional Admin sees only their region users
      const regions = await this.getAdminAssignedRegions(adminUserId);
      const regionIds = regions.map(r => r.region_id);

      if (regionIds.length === 0) {
        return [];
      }

      const query = `
        SELECT * FROM v_users_with_roles
        WHERE is_active = TRUE AND primary_region_id = ANY($1::int[])
        ORDER BY full_name
      `;
      const result = await postgresService.query(query, [regionIds]);
      return result.rows;
    } catch (error) {
      console.error('Error getting accessible users:', error);
      throw error;
    }
  }
}

// Create singleton instance
const rbacService = new RBACService();

module.exports = rbacService;
