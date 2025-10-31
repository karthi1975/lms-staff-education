/**
 * CSV Processor Service
 * Handles CSV upload, parsing, validation, and bulk enrollment
 *
 * Features:
 * - CSV parsing and validation
 * - 5,000 row limit enforcement
 * - Duplicate detection
 * - Phone number validation (E.164 format)
 * - Region-aware enrollment
 * - Progress tracking
 * - Error reporting
 */

const postgresService = require('./database/postgres.service');
const rbacService = require('./rbac.service');
const regionEnrollmentService = require('./region-enrollment.service');
const whatsAppNotificationService = require('./whatsapp-region-notification.service');

class CSVProcessorService {
  constructor() {
    this.MAX_ROWS = 5000; // Maximum rows per CSV upload
    this.REQUIRED_COLUMNS = ['Full Name', 'WhatsApp Number'];
    this.PHONE_REGEX = /^\+?[1-9]\d{1,14}$/; // E.164 format
  }

  /**
   * Parse CSV content
   * @param {string} csvContent - Raw CSV content
   * @returns {Object} Parsed data { headers, rows, errors }
   */
  parseCSV(csvContent) {
    try {
      const lines = csvContent.trim().split('\n');

      if (lines.length === 0) {
        return { success: false, error: 'CSV file is empty' };
      }

      // Parse headers
      const headers = this.parseCSVLine(lines[0]);

      // Validate required columns
      const missingColumns = this.REQUIRED_COLUMNS.filter(col =>
        !headers.some(h => h.toLowerCase().trim() === col.toLowerCase())
      );

      if (missingColumns.length > 0) {
        return {
          success: false,
          error: `Missing required columns: ${missingColumns.join(', ')}`
        };
      }

      // Find column indexes
      const nameIndex = headers.findIndex(h => h.toLowerCase().trim() === 'full name');
      const phoneIndex = headers.findIndex(h => h.toLowerCase().trim() === 'whatsapp number');

      // Parse rows
      const rows = [];
      const errors = [];

      for (let i = 1; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i].trim();

        if (!line) continue; // Skip empty lines

        const values = this.parseCSVLine(line);

        if (values.length < headers.length) {
          errors.push({ row: lineNum, error: 'Incomplete row' });
          continue;
        }

        const name = values[nameIndex]?.trim();
        const phone = values[phoneIndex]?.trim();

        if (!name || !phone) {
          errors.push({ row: lineNum, error: 'Missing name or phone number' });
          continue;
        }

        rows.push({
          rowNumber: lineNum,
          fullName: name,
          whatsappNumber: phone
        });
      }

      return {
        success: true,
        headers,
        rows,
        errors
      };
    } catch (error) {
      console.error('Error parsing CSV:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Parse a single CSV line (handles quoted fields)
   * @param {string} line - CSV line
   * @returns {Array} Parsed values
   */
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add last field
    values.push(current.trim());

    return values;
  }

  /**
   * Validate CSV data
   * @param {Array} rows - Parsed CSV rows
   * @returns {Object} Validation result { valid, errors }
   */
  validateCSVData(rows) {
    const errors = [];
    const seen = new Set();

    // Check row limit
    if (rows.length > this.MAX_ROWS) {
      return {
        valid: false,
        errors: [{
          row: 0,
          error: `CSV exceeds maximum allowed rows (${this.MAX_ROWS}). Found ${rows.length} rows.`
        }]
      };
    }

    rows.forEach(row => {
      const { rowNumber, fullName, whatsappNumber } = row;

      // Validate name length
      if (fullName.length < 2 || fullName.length > 200) {
        errors.push({
          row: rowNumber,
          error: 'Full name must be between 2 and 200 characters'
        });
      }

      // Validate phone number format
      if (!this.validatePhoneNumber(whatsappNumber)) {
        errors.push({
          row: rowNumber,
          error: `Invalid WhatsApp number format: ${whatsappNumber}. Must be in E.164 format (e.g., +255712345678)`
        });
      }

      // Check for duplicates
      if (seen.has(whatsappNumber)) {
        errors.push({
          row: rowNumber,
          error: `Duplicate WhatsApp number: ${whatsappNumber}`
        });
      } else {
        seen.add(whatsappNumber);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate phone number (E.164 format)
   * @param {string} phone - Phone number
   * @returns {boolean} Valid or not
   */
  validatePhoneNumber(phone) {
    return this.PHONE_REGEX.test(phone);
  }

  /**
   * Process CSV upload and enroll users
   * @param {Object} uploadData - { csvContent, courseId, targetRegionId, uploadedBy }
   * @returns {Promise<Object>} Processing result
   */
  async processCSVUpload(uploadData) {
    const { csvContent, courseId, targetRegionId, uploadedBy } = uploadData;

    try {
      // Validate admin permissions
      if (uploadedBy) {
        const canEnroll = await rbacService.canEnrollInCourse(uploadedBy, courseId);
        if (!canEnroll.canEnroll) {
          return { success: false, error: canEnroll.reason };
        }
      }

      // Determine target region
      let effectiveRegionId = targetRegionId;

      if (!targetRegionId) {
        // Get admin's region if not specified (for Regional Admins)
        const adminRole = await rbacService.getAdminUserRole(uploadedBy);
        if (adminRole && adminRole.role_id === rbacService.ROLES.ADMIN) {
          // Regional Admin - use their primary region
          effectiveRegionId = adminRole.primary_region_id;
        } else {
          return { success: false, error: 'Target region must be specified' };
        }
      }

      // Parse CSV
      const parseResult = this.parseCSV(csvContent);
      if (!parseResult.success) {
        return parseResult;
      }

      const { rows, errors: parseErrors } = parseResult;

      // Validate CSV data
      const validationResult = this.validateCSVData(rows);

      // Combine parse and validation errors
      const allErrors = [...parseErrors, ...validationResult.errors];

      if (!validationResult.valid) {
        return {
          success: false,
          error: 'CSV validation failed',
          validationErrors: allErrors,
          totalRows: rows.length
        };
      }

      // Process enrollments
      const enrollmentResults = await this.enrollUsersFromCSV(
        rows,
        courseId,
        effectiveRegionId,
        uploadedBy
      );

      // Log CSV upload
      await this.logCSVUpload({
        uploaded_by: uploadedBy,
        course_id: courseId,
        target_region_id: effectiveRegionId,
        filename: `upload_${Date.now()}.csv`,
        total_rows: rows.length,
        successful_enrollments: enrollmentResults.successful,
        failed_enrollments: enrollmentResults.failed,
        error_details: JSON.stringify(enrollmentResults.errors)
      });

      return {
        success: true,
        totalRows: rows.length,
        successful: enrollmentResults.successful,
        failed: enrollmentResults.failed,
        errors: enrollmentResults.errors,
        parseErrors: allErrors
      };
    } catch (error) {
      console.error('Error processing CSV upload:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enroll users from CSV rows
   * @param {Array} rows - CSV rows
   * @param {number} courseId - Course ID
   * @param {number} targetRegionId - Target region ID
   * @param {number} uploadedBy - Admin user ID
   * @returns {Promise<Object>} Enrollment results
   */
  async enrollUsersFromCSV(rows, courseId, targetRegionId, uploadedBy) {
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        // Create or get user
        const user = await this.createOrGetUser(row.fullName, row.whatsappNumber, targetRegionId);

        if (!user) {
          results.failed++;
          results.errors.push({
            row: row.rowNumber,
            name: row.fullName,
            phone: row.whatsappNumber,
            error: 'Failed to create or retrieve user'
          });
          continue;
        }

        // Enroll user
        const enrollResult = await regionEnrollmentService.enrollUser({
          userId: user.id,
          courseId,
          enrolledBy: uploadedBy,
          enrollmentMethod: 'csv_upload'
        });

        if (enrollResult.success) {
          results.successful++;

          // Send enrollment notification (async, don't wait)
          whatsAppNotificationService.sendEnrollmentNotification(user.id, courseId, uploadedBy)
            .catch(err => console.error('Error sending enrollment notification:', err));
        } else {
          results.failed++;
          results.errors.push({
            row: row.rowNumber,
            name: row.fullName,
            phone: row.whatsappNumber,
            error: enrollResult.error
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: row.rowNumber,
          name: row.fullName,
          phone: row.whatsappNumber,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Create or get user by WhatsApp number
   * @param {string} fullName - Full name
   * @param {string} whatsappNumber - WhatsApp number
   * @param {number} regionId - Region ID
   * @returns {Promise<Object|null>} User object
   */
  async createOrGetUser(fullName, whatsappNumber, regionId) {
    try {
      // Check if user exists
      const existingQuery = 'SELECT * FROM users WHERE whatsapp_id = $1';
      const existingResult = await postgresService.query(existingQuery, [whatsappNumber]);

      if (existingResult.rows.length > 0) {
        const user = existingResult.rows[0];

        // Update region if different
        if (user.primary_region_id !== regionId) {
          await postgresService.query(
            'UPDATE users SET primary_region_id = $1 WHERE id = $2',
            [regionId, user.id]
          );
        }

        return user;
      }

      // Create new user
      const insertQuery = `
        INSERT INTO users (whatsapp_id, name, role_id, primary_region_id, is_active, created_at)
        VALUES ($1, $2, 3, $3, TRUE, NOW())
        RETURNING *
      `;
      const insertResult = await postgresService.query(insertQuery, [whatsappNumber, fullName, regionId]);

      return insertResult.rows[0];
    } catch (error) {
      console.error('Error creating or getting user:', error);
      return null;
    }
  }

  /**
   * Log CSV upload
   * @param {Object} logData - CSV upload log data
   * @returns {Promise<void>}
   */
  async logCSVUpload(logData) {
    try {
      const query = `
        INSERT INTO csv_upload_logs
        (uploaded_by, course_id, target_region_id, filename, total_rows, successful_enrollments, failed_enrollments, error_details, uploaded_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *
      `;
      await postgresService.query(query, [
        logData.uploaded_by,
        logData.course_id,
        logData.target_region_id,
        logData.filename,
        logData.total_rows,
        logData.successful_enrollments,
        logData.failed_enrollments,
        logData.error_details
      ]);
    } catch (error) {
      console.error('Error logging CSV upload:', error);
      // Don't throw - logging failure shouldn't block main flow
    }
  }

  /**
   * Get CSV upload history
   * @param {number} adminUserId - Admin user ID
   * @param {number} limit - Result limit
   * @returns {Promise<Array>} Upload history
   */
  async getCSVUploadHistory(adminUserId, limit = 50) {
    try {
      const query = `
        SELECT
          cl.*,
          c.title AS course_title,
          c.code AS course_code,
          r.name AS target_region_name,
          a.name AS uploaded_by_name
        FROM csv_upload_logs cl
        LEFT JOIN courses c ON cl.course_id = c.id
        LEFT JOIN regions r ON cl.target_region_id = r.id
        LEFT JOIN admin_users a ON cl.uploaded_by = a.id
        WHERE cl.uploaded_by = $1
        ORDER BY cl.uploaded_at DESC
        LIMIT $2
      `;
      const result = await postgresService.query(query, [adminUserId, limit]);
      return result.rows;
    } catch (error) {
      console.error('Error getting CSV upload history:', error);
      throw error;
    }
  }

  /**
   * Get CSV upload statistics
   * @param {Object} filters - { uploadedBy, courseId, regionId, startDate, endDate }
   * @returns {Promise<Object>} Statistics
   */
  async getCSVUploadStats(filters = {}) {
    try {
      let query = 'SELECT COUNT(*) as total_uploads, SUM(total_rows) as total_rows, SUM(successful_enrollments) as successful, SUM(failed_enrollments) as failed FROM csv_upload_logs WHERE 1=1';
      const params = [];
      let paramCount = 1;

      if (filters.uploadedBy) {
        query += ` AND uploaded_by = $${paramCount++}`;
        params.push(filters.uploadedBy);
      }

      if (filters.courseId) {
        query += ` AND course_id = $${paramCount++}`;
        params.push(filters.courseId);
      }

      if (filters.regionId) {
        query += ` AND target_region_id = $${paramCount++}`;
        params.push(filters.regionId);
      }

      if (filters.startDate) {
        query += ` AND uploaded_at >= $${paramCount++}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        query += ` AND uploaded_at <= $${paramCount++}`;
        params.push(filters.endDate);
      }

      const result = await postgresService.query(query, params);

      return {
        totalUploads: parseInt(result.rows[0].total_uploads) || 0,
        totalRows: parseInt(result.rows[0].total_rows) || 0,
        successful: parseInt(result.rows[0].successful) || 0,
        failed: parseInt(result.rows[0].failed) || 0,
        successRate: result.rows[0].total_rows > 0
          ? ((result.rows[0].successful / result.rows[0].total_rows) * 100).toFixed(2)
          : 0
      };
    } catch (error) {
      console.error('Error getting CSV upload stats:', error);
      throw error;
    }
  }

  /**
   * Generate CSV template
   * @returns {string} CSV template content
   */
  generateCSVTemplate() {
    return `Full Name,WhatsApp Number
John Doe,+255712345678
Jane Smith,+255723456789`;
  }

  /**
   * Validate CSV file before processing
   * @param {string} csvContent - CSV content
   * @returns {Object} Validation result
   */
  validateCSVFile(csvContent) {
    // Parse CSV
    const parseResult = this.parseCSV(csvContent);
    if (!parseResult.success) {
      return parseResult;
    }

    const { rows, errors: parseErrors } = parseResult;

    // Validate data
    const validationResult = this.validateCSVData(rows);

    return {
      success: validationResult.valid,
      totalRows: rows.length,
      validRows: rows.length - validationResult.errors.length,
      invalidRows: validationResult.errors.length,
      errors: [...parseErrors, ...validationResult.errors],
      preview: rows.slice(0, 10) // Preview first 10 rows
    };
  }
}

// Create singleton instance
const csvProcessorService = new CSVProcessorService();

module.exports = csvProcessorService;
