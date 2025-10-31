/**
 * Region Enrollment Service
 * Manages user enrollments in courses with regional awareness
 *
 * Features:
 * - Individual enrollment (manual)
 * - Bulk CSV enrollment
 * - Enrollment status management
 * - Audit trail
 * - Regional access control
 */

const postgresService = require('./database/postgres.service');
const rbacService = require('./rbac.service');
const regionService = require('./region.service');

class RegionEnrollmentService {
  constructor() {
    this.ENROLLMENT_STATUSES = {
      ACTIVE: 'active',
      SUSPENDED: 'suspended',
      COMPLETED: 'completed',
      REMOVED: 'removed'
    };

    this.ENROLLMENT_METHODS = {
      MANUAL: 'manual',
      CSV_UPLOAD: 'csv_upload',
      SELF: 'self'
    };
  }

  /**
   * Enroll user in course (individual)
   * @param {Object} enrollmentData - { userId, courseId, enrolledBy, enrollmentMethod }
   * @returns {Promise<Object>} Enrollment result
   */
  async enrollUser(enrollmentData) {
    const client = await postgresService.getPool().connect();

    try {
      await client.query('BEGIN');

      const { userId, courseId, enrolledBy, enrollmentMethod = this.ENROLLMENT_METHODS.MANUAL } = enrollmentData;

      // Validate required fields
      if (!userId || !courseId) {
        await client.query('ROLLBACK');
        return { success: false, error: 'userId and courseId are required' };
      }

      // Check if admin can enroll in this course
      if (enrolledBy) {
        const canEnroll = await rbacService.canEnrollInCourse(enrolledBy, courseId);
        if (!canEnroll.canEnroll) {
          await client.query('ROLLBACK');
          return { success: false, error: canEnroll.reason };
        }
      }

      // Check if user exists
      const userQuery = 'SELECT * FROM users WHERE id = $1 AND is_active = TRUE';
      const userResult = await client.query(userQuery, [userId]);
      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'User not found or inactive' };
      }

      // Check if course exists
      const courseQuery = 'SELECT * FROM courses WHERE id = $1 AND is_active = TRUE';
      const courseResult = await client.query(courseQuery, [courseId]);
      if (courseResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Course not found or inactive' };
      }

      // Check if already enrolled
      const existingQuery = 'SELECT * FROM course_region_enrollments WHERE user_id = $1 AND course_id = $2';
      const existingResult = await client.query(existingQuery, [userId, courseId]);

      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0];
        if (existing.status === this.ENROLLMENT_STATUSES.ACTIVE) {
          await client.query('ROLLBACK');
          return { success: false, error: 'User already enrolled in this course' };
        } else {
          // Reactivate enrollment
          const reactivateQuery = `
            UPDATE course_region_enrollments
            SET status = $1, enrolled_at = NOW(), enrolled_by = $2
            WHERE id = $3
            RETURNING *
          `;
          const reactivateResult = await client.query(reactivateQuery, [
            this.ENROLLMENT_STATUSES.ACTIVE,
            enrolledBy || null,
            existing.id
          ]);

          // Log history
          await this.logEnrollmentHistory(client, existing.id, 'reactivated', enrolledBy, 'Enrollment reactivated');

          await client.query('COMMIT');
          return { success: true, data: reactivateResult.rows[0], action: 'reactivated' };
        }
      }

      // Create new enrollment
      const insertQuery = `
        INSERT INTO course_region_enrollments
        (user_id, course_id, enrolled_by, enrollment_method, status, enrolled_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *
      `;
      const insertResult = await client.query(insertQuery, [
        userId,
        courseId,
        enrolledBy || null,
        enrollmentMethod,
        this.ENROLLMENT_STATUSES.ACTIVE
      ]);

      const enrollment = insertResult.rows[0];

      // Log history
      await this.logEnrollmentHistory(client, enrollment.id, 'enrolled', enrolledBy, 'User enrolled in course');

      await client.query('COMMIT');
      return { success: true, data: enrollment, action: 'enrolled' };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error enrolling user:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  /**
   * Bulk enroll users (CSV upload)
   * @param {Array} enrollments - Array of { userId, courseId, enrolledBy }
   * @param {number} targetRegionId - Region to assign users to
   * @returns {Promise<Object>} Bulk enrollment result
   */
  async bulkEnrollUsers(enrollments, targetRegionId) {
    const results = {
      total: enrollments.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < enrollments.length; i++) {
      const enrollment = enrollments[i];
      try {
        // Assign user to target region if not already assigned
        if (targetRegionId && enrollment.userId) {
          await this.assignUserToRegion(enrollment.userId, targetRegionId);
        }

        const result = await this.enrollUser({
          ...enrollment,
          enrollmentMethod: this.ENROLLMENT_METHODS.CSV_UPLOAD
        });

        if (result.success) {
          results.successful++;
        } else {
          results.failed++;
          results.errors.push({
            row: i + 1,
            userId: enrollment.userId,
            error: result.error
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          userId: enrollment.userId,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Assign user to region
   * @param {number} userId - User ID
   * @param {number} regionId - Region ID
   * @returns {Promise<boolean>} Success status
   */
  async assignUserToRegion(userId, regionId) {
    try {
      const query = `
        UPDATE users
        SET primary_region_id = $1
        WHERE id = $2
      `;
      await postgresService.query(query, [regionId, userId]);
      return true;
    } catch (error) {
      console.error('Error assigning user to region:', error);
      return false;
    }
  }

  /**
   * Update enrollment status
   * @param {number} enrollmentId - Enrollment ID
   * @param {string} newStatus - New status
   * @param {number} performedBy - Admin user ID
   * @param {string} reason - Reason for status change
   * @returns {Promise<Object>} Update result
   */
  async updateEnrollmentStatus(enrollmentId, newStatus, performedBy, reason = null) {
    const client = await postgresService.getPool().connect();

    try {
      await client.query('BEGIN');

      // Validate status
      if (!Object.values(this.ENROLLMENT_STATUSES).includes(newStatus)) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Invalid status' };
      }

      // Check if enrollment exists
      const checkQuery = 'SELECT * FROM course_region_enrollments WHERE id = $1';
      const checkResult = await client.query(checkQuery, [enrollmentId]);
      if (checkResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Enrollment not found' };
      }

      const currentEnrollment = checkResult.rows[0];

      // Check if admin can manage this enrollment
      if (performedBy) {
        const canManage = await rbacService.canManageCourse(performedBy, currentEnrollment.course_id);
        if (!canManage.canManage) {
          await client.query('ROLLBACK');
          return { success: false, error: canManage.reason };
        }
      }

      // Update status
      const updateFields = ['status = $1'];
      const updateValues = [newStatus];
      let paramCount = 2;

      if (newStatus === this.ENROLLMENT_STATUSES.COMPLETED) {
        updateFields.push(`completed_at = NOW()`);
      }

      if (newStatus === this.ENROLLMENT_STATUSES.REMOVED) {
        updateFields.push(`removed_at = NOW()`);
        updateFields.push(`removed_by = $${paramCount++}`);
        updateFields.push(`removal_reason = $${paramCount++}`);
        updateValues.push(performedBy, reason || 'No reason provided');
      }

      updateValues.push(enrollmentId);

      const updateQuery = `
        UPDATE course_region_enrollments
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, updateValues);

      // Log history
      await this.logEnrollmentHistory(client, enrollmentId, newStatus, performedBy, reason);

      await client.query('COMMIT');
      return { success: true, data: updateResult.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating enrollment status:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  /**
   * Suspend enrollment
   * @param {number} enrollmentId - Enrollment ID
   * @param {number} performedBy - Admin user ID
   * @param {string} reason - Reason for suspension
   * @returns {Promise<Object>} Suspension result
   */
  async suspendEnrollment(enrollmentId, performedBy, reason) {
    return await this.updateEnrollmentStatus(
      enrollmentId,
      this.ENROLLMENT_STATUSES.SUSPENDED,
      performedBy,
      reason
    );
  }

  /**
   * Complete enrollment
   * @param {number} enrollmentId - Enrollment ID
   * @param {number} performedBy - Admin user ID
   * @returns {Promise<Object>} Completion result
   */
  async completeEnrollment(enrollmentId, performedBy) {
    return await this.updateEnrollmentStatus(
      enrollmentId,
      this.ENROLLMENT_STATUSES.COMPLETED,
      performedBy,
      'Course completed'
    );
  }

  /**
   * Remove enrollment
   * @param {number} enrollmentId - Enrollment ID
   * @param {number} performedBy - Admin user ID
   * @param {string} reason - Reason for removal
   * @returns {Promise<Object>} Removal result
   */
  async removeEnrollment(enrollmentId, performedBy, reason) {
    return await this.updateEnrollmentStatus(
      enrollmentId,
      this.ENROLLMENT_STATUSES.REMOVED,
      performedBy,
      reason
    );
  }

  /**
   * Reactivate enrollment
   * @param {number} enrollmentId - Enrollment ID
   * @param {number} performedBy - Admin user ID
   * @returns {Promise<Object>} Reactivation result
   */
  async reactivateEnrollment(enrollmentId, performedBy) {
    return await this.updateEnrollmentStatus(
      enrollmentId,
      this.ENROLLMENT_STATUSES.ACTIVE,
      performedBy,
      'Enrollment reactivated'
    );
  }

  /**
   * Log enrollment history
   * @param {Object} client - Database client
   * @param {number} enrollmentId - Enrollment ID
   * @param {string} action - Action performed
   * @param {number} performedBy - Admin user ID
   * @param {string} reason - Reason for action
   * @returns {Promise<void>}
   */
  async logEnrollmentHistory(client, enrollmentId, action, performedBy, reason) {
    try {
      const query = `
        INSERT INTO course_region_enrollment_history
        (enrollment_id, action, performed_by, reason, timestamp)
        VALUES ($1, $2, $3, $4, NOW())
      `;
      await client.query(query, [enrollmentId, action, performedBy || null, reason]);
    } catch (error) {
      console.error('Error logging enrollment history:', error);
      // Don't throw - history logging failure shouldn't block enrollment
    }
  }

  /**
   * Get enrollment by ID
   * @param {number} enrollmentId - Enrollment ID
   * @returns {Promise<Object|null>} Enrollment details
   */
  async getEnrollmentById(enrollmentId) {
    try {
      const query = 'SELECT * FROM v_active_region_enrollments WHERE enrollment_id = $1';
      const result = await postgresService.query(query, [enrollmentId]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting enrollment by ID:', error);
      throw error;
    }
  }

  /**
   * Get user enrollments
   * @param {number} userId - User ID
   * @param {string} status - Filter by status (optional)
   * @returns {Promise<Array>} User enrollments
   */
  async getUserEnrollments(userId, status = null) {
    try {
      let query = `
        SELECT * FROM v_active_region_enrollments
        WHERE user_id = $1
      `;
      const params = [userId];

      if (status) {
        query += ' AND status = $2';
        params.push(status);
      }

      query += ' ORDER BY enrolled_at DESC';

      const result = await postgresService.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting user enrollments:', error);
      throw error;
    }
  }

  /**
   * Get course enrollments
   * @param {number} courseId - Course ID
   * @param {string} status - Filter by status (optional)
   * @returns {Promise<Array>} Course enrollments
   */
  async getCourseEnrollments(courseId, status = null) {
    try {
      let query = `
        SELECT * FROM v_active_region_enrollments
        WHERE course_id = $1
      `;
      const params = [courseId];

      if (status) {
        query += ' AND status = $2';
        params.push(status);
      }

      query += ' ORDER BY enrolled_at DESC';

      const result = await postgresService.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting course enrollments:', error);
      throw error;
    }
  }

  /**
   * Get enrollment history
   * @param {number} enrollmentId - Enrollment ID
   * @returns {Promise<Array>} Enrollment history
   */
  async getEnrollmentHistory(enrollmentId) {
    try {
      const query = `
        SELECT
          eh.*,
          a.name AS performed_by_name,
          a.email AS performed_by_email
        FROM course_region_enrollment_history eh
        LEFT JOIN admin_users a ON eh.performed_by = a.id
        WHERE eh.enrollment_id = $1
        ORDER BY eh.timestamp DESC
      `;
      const result = await postgresService.query(query, [enrollmentId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting enrollment history:', error);
      throw error;
    }
  }

  /**
   * Get enrollments accessible by admin (filtered by regions)
   * @param {number} adminUserId - Admin user ID
   * @param {Object} filters - { status, courseId, regionId }
   * @returns {Promise<Array>} Accessible enrollments
   */
  async getAccessibleEnrollments(adminUserId, filters = {}) {
    try {
      const isSuperAdmin = await rbacService.isSuperAdmin(adminUserId);

      let query = 'SELECT * FROM v_active_region_enrollments WHERE 1=1';
      const params = [];
      let paramCount = 1;

      // Filter by region for Regional Admins
      if (!isSuperAdmin) {
        const regions = await rbacService.getAdminAssignedRegions(adminUserId);
        const regionIds = regions.map(r => r.region_id);

        if (regionIds.length === 0) {
          return [];
        }

        query += ` AND course_region_id = ANY($${paramCount++}::int[])`;
        params.push(regionIds);
      }

      // Apply filters
      if (filters.status) {
        query += ` AND status = $${paramCount++}`;
        params.push(filters.status);
      }

      if (filters.courseId) {
        query += ` AND course_id = $${paramCount++}`;
        params.push(filters.courseId);
      }

      if (filters.regionId) {
        query += ` AND course_region_id = $${paramCount++}`;
        params.push(filters.regionId);
      }

      query += ' ORDER BY enrolled_at DESC';

      const result = await postgresService.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting accessible enrollments:', error);
      throw error;
    }
  }

  /**
   * Get enrollment statistics
   * @param {Object} filters - { courseId, regionId, status }
   * @returns {Promise<Object>} Enrollment statistics
   */
  async getEnrollmentStats(filters = {}) {
    try {
      let query = 'SELECT status, COUNT(*) as count FROM course_region_enrollments WHERE 1=1';
      const params = [];
      let paramCount = 1;

      if (filters.courseId) {
        query += ` AND course_id = $${paramCount++}`;
        params.push(filters.courseId);
      }

      if (filters.regionId) {
        query += ` AND course_id IN (SELECT id FROM courses WHERE region_id = $${paramCount++})`;
        params.push(filters.regionId);
      }

      query += ' GROUP BY status';

      const result = await postgresService.query(query, params);

      // Format statistics
      const stats = {
        total: 0,
        active: 0,
        suspended: 0,
        completed: 0,
        removed: 0
      };

      result.rows.forEach(row => {
        stats[row.status] = parseInt(row.count);
        stats.total += parseInt(row.count);
      });

      return stats;
    } catch (error) {
      console.error('Error getting enrollment stats:', error);
      throw error;
    }
  }

  /**
   * Check if user is enrolled in course
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @returns {Promise<Object|null>} Enrollment if exists
   */
  async isUserEnrolled(userId, courseId) {
    try {
      const query = `
        SELECT * FROM course_region_enrollments
        WHERE user_id = $1 AND course_id = $2 AND status = $3
      `;
      const result = await postgresService.query(query, [userId, courseId, this.ENROLLMENT_STATUSES.ACTIVE]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error checking user enrollment:', error);
      return null;
    }
  }
}

// Create singleton instance
const regionEnrollmentService = new RegionEnrollmentService();

module.exports = regionEnrollmentService;
