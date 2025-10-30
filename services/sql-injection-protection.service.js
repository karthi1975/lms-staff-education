const logger = require('../utils/logger');

/**
 * SQL Injection Protection Service
 *
 * Protects against SQL injection attacks by:
 * 1. Detecting SQL injection patterns in user input
 * 2. Sanitizing input before database queries
 * 3. Providing parameterized query helpers
 * 4. Validating and escaping special characters
 */
class SQLInjectionProtectionService {
  constructor() {
    // SQL injection pattern library
    this.sqlInjectionPatterns = [
      // Classic SQL injection
      /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/i,
      /(\bOR\b|\bAND\b)\s+['"]\w+['"]\s*=\s*['"]\w+['"]/i,

      // Comment-based injection
      /--\s*$/,
      /\/\*.*?\*\//,
      /#.*$/,

      // UNION-based injection
      /\bUNION\b.*\bSELECT\b/i,

      // Stacked queries
      /;\s*(DROP|DELETE|UPDATE|INSERT|CREATE|ALTER)\b/i,

      // Boolean-based blind injection
      /\bOR\b\s+\d+\s*>\s*\d+/i,
      /\bOR\b\s+['"]\w+['"]\s*LIKE\s*['"]/i,

      // Time-based blind injection
      /\b(SLEEP|BENCHMARK|WAITFOR\s+DELAY)\b/i,

      // Information schema queries
      /\bINFORMATION_SCHEMA\b/i,
      /\bSYSTEM_SCHEMA\b/i,

      // Database function injection
      /\b(CONCAT|CHAR|ASCII|SUBSTRING|DATABASE|VERSION|USER)\s*\(/i,

      // Special characters used in SQL injection
      /['";].*(\bOR\b|\bAND\b|\bUNION\b|\bSELECT\b)/i,

      // Hex/binary injection
      /0x[0-9a-fA-F]+/,

      // Multiple statement execution
      /;\s*\w+\s*=/i,

      // Common SQL keywords in suspicious contexts
      /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b.*\b(FROM|INTO|WHERE|SET|TABLE|DATABASE)\b/i
    ];

    // Dangerous SQL keywords
    this.dangerousSQLKeywords = [
      'DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'EXEC', 'EXECUTE',
      'UNION', 'INSERT', 'UPDATE', 'CREATE', 'GRANT', 'REVOKE'
    ];

    // Characters that need escaping
    this.specialChars = ["'", '"', '\\', '\x00', '\n', '\r', '\x1a'];
  }

  /**
   * Detect SQL injection attempts in input
   * @param {string} input - User input to check
   * @returns {Object} - { safe: boolean, reason: string, patterns: Array }
   */
  detectSQLInjection(input) {
    if (!input || typeof input !== 'string') {
      return { safe: true, reason: 'EMPTY_OR_INVALID', patterns: [] };
    }

    const detectedPatterns = [];

    // Check against SQL injection patterns
    for (const pattern of this.sqlInjectionPatterns) {
      if (pattern.test(input)) {
        detectedPatterns.push(pattern.toString());
      }
    }

    if (detectedPatterns.length > 0) {
      logger.warn('SQL injection attempt detected:', {
        input: input.substring(0, 200),
        patterns: detectedPatterns.length
      });

      return {
        safe: false,
        reason: 'SQL_INJECTION_DETECTED',
        patterns: detectedPatterns
      };
    }

    // Check for dangerous keyword density
    const keywordCount = this.countDangerousKeywords(input);
    if (keywordCount >= 2) {
      logger.warn('Multiple dangerous SQL keywords detected:', {
        input: input.substring(0, 200),
        count: keywordCount
      });

      return {
        safe: false,
        reason: 'DANGEROUS_SQL_KEYWORDS',
        patterns: []
      };
    }

    return { safe: true, reason: 'VALID', patterns: [] };
  }

  /**
   * Count dangerous SQL keywords in input
   * @param {string} input - User input
   * @returns {number} - Count of dangerous keywords
   */
  countDangerousKeywords(input) {
    const upperInput = input.toUpperCase();
    let count = 0;

    for (const keyword of this.dangerousSQLKeywords) {
      // Use word boundary to avoid false positives (e.g., "DROP" in "dropdown")
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = upperInput.match(regex);
      if (matches) {
        count += matches.length;
      }
    }

    return count;
  }

  /**
   * Sanitize input for use in SQL queries
   * @param {string} input - Raw input
   * @returns {string} - Sanitized input
   */
  sanitizeForSQL(input) {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let sanitized = input;

    // Remove SQL comments
    sanitized = sanitized.replace(/--.*$/gm, '');
    sanitized = sanitized.replace(/\/\*.*?\*\//g, '');
    sanitized = sanitized.replace(/#.*$/gm, '');

    // Remove semicolons (prevent multiple statements)
    sanitized = sanitized.replace(/;/g, '');

    // Escape special characters
    for (const char of this.specialChars) {
      sanitized = sanitized.split(char).join('\\' + char);
    }

    // Limit length
    if (sanitized.length > 1000) {
      sanitized = sanitized.substring(0, 1000);
    }

    return sanitized.trim();
  }

  /**
   * Validate and sanitize input for database operations
   * @param {string} input - User input
   * @param {string} fieldName - Field name for logging
   * @returns {Object} - { safe: boolean, sanitized: string, error: string }
   */
  validateAndSanitize(input, fieldName = 'input') {
    // First detect SQL injection
    const detection = this.detectSQLInjection(input);

    if (!detection.safe) {
      logger.warn(`SQL injection detected in ${fieldName}:`, {
        input: input.substring(0, 100),
        reason: detection.reason
      });

      return {
        safe: false,
        sanitized: null,
        error: 'Invalid input detected. Please avoid special SQL characters.'
      };
    }

    // Sanitize the input
    const sanitized = this.sanitizeForSQL(input);

    return {
      safe: true,
      sanitized: sanitized,
      error: null
    };
  }

  /**
   * Create parameterized query placeholder
   * IMPORTANT: Always use parameterized queries instead of string concatenation
   *
   * @param {string} query - SQL query with placeholders
   * @param {Array} params - Parameters to bind
   * @returns {Object} - { query, params }
   */
  createParameterizedQuery(query, params) {
    // Validate that placeholders match param count
    const placeholderCount = (query.match(/\?/g) || []).length;

    if (placeholderCount !== params.length) {
      throw new Error(`Parameter count mismatch: ${placeholderCount} placeholders, ${params.length} params`);
    }

    // Validate each parameter
    const validatedParams = params.map((param, index) => {
      if (typeof param === 'string') {
        // Check for SQL injection in parameter
        const detection = this.detectSQLInjection(param);
        if (!detection.safe) {
          throw new Error(`SQL injection detected in parameter ${index}: ${param.substring(0, 50)}`);
        }
      }
      return param;
    });

    return {
      query,
      params: validatedParams
    };
  }

  /**
   * Escape identifier (table name, column name)
   * @param {string} identifier - Database identifier
   * @returns {string} - Escaped identifier
   */
  escapeIdentifier(identifier) {
    if (!identifier || typeof identifier !== 'string') {
      throw new Error('Invalid identifier');
    }

    // Remove dangerous characters
    const cleaned = identifier.replace(/[^a-zA-Z0-9_]/g, '');

    // Validate it's not a SQL keyword
    if (this.dangerousSQLKeywords.includes(cleaned.toUpperCase())) {
      throw new Error(`Cannot use SQL keyword as identifier: ${cleaned}`);
    }

    // Wrap in backticks (for MySQL/SQLite)
    return `\`${cleaned}\``;
  }

  /**
   * Validate email format (common user input)
   * @param {string} email - Email address
   * @returns {boolean}
   */
  validateEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format
   * @param {string} phone - Phone number
   * @returns {boolean}
   */
  validatePhone(phone) {
    // Allow international format with optional +
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    return phoneRegex.test(phone.replace(/[\s()-]/g, ''));
  }

  /**
   * Sanitize input for LIKE queries
   * @param {string} input - Search term
   * @returns {string} - Sanitized search term
   */
  sanitizeForLike(input) {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Escape LIKE special characters
    let sanitized = input.replace(/[%_\\]/g, '\\$&');

    // Also apply general SQL sanitization
    sanitized = this.sanitizeForSQL(sanitized);

    return sanitized;
  }

  /**
   * Create safe search query with LIKE
   * @param {string} column - Column name
   * @param {string} searchTerm - User's search term
   * @returns {Object} - { clause, param }
   */
  createSafeSearchClause(column, searchTerm) {
    const safeColumn = this.escapeIdentifier(column);
    const safeTerm = this.sanitizeForLike(searchTerm);

    return {
      clause: `${safeColumn} LIKE ?`,
      param: `%${safeTerm}%`
    };
  }

  /**
   * Validate integer input
   * @param {any} value - Value to validate
   * @returns {Object} - { valid: boolean, value: number }
   */
  validateInteger(value) {
    const num = parseInt(value, 10);

    if (isNaN(num) || !isFinite(num)) {
      return { valid: false, value: null };
    }

    return { valid: true, value: num };
  }

  /**
   * Get statistics
   * @returns {Object} - Stats
   */
  getStats() {
    return {
      patterns: this.sqlInjectionPatterns.length,
      dangerousKeywords: this.dangerousSQLKeywords.length
    };
  }
}

module.exports = new SQLInjectionProtectionService();
