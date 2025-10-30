const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Security Audit Service
 *
 * Provides comprehensive audit logging for security events:
 * 1. Logs all injection attempts (prompt, SQL)
 * 2. Tracks user blocking/unblocking
 * 3. Records admin security actions
 * 4. Generates security reports
 * 5. Provides forensic data for investigation
 */
class SecurityAuditService {
  constructor() {
    this.auditLogPath = process.env.SECURITY_AUDIT_LOG || './logs/security-audit.log';
    this.maxLogSizeMB = 100; // Rotate logs at 100MB
    this.retentionDays = 90; // Keep logs for 90 days

    // Ensure log directory exists
    this.ensureLogDirectory();

    // Event types
    this.eventTypes = {
      PROMPT_INJECTION: 'prompt_injection_attempt',
      SQL_INJECTION: 'sql_injection_attempt',
      USER_BLOCKED: 'user_blocked',
      USER_UNBLOCKED: 'user_unblocked',
      SUSPICIOUS_ACTIVITY: 'suspicious_activity',
      OUTPUT_VALIDATION_FAILED: 'output_validation_failed',
      RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
      ADMIN_ACTION: 'admin_security_action',
      SECURITY_ALERT: 'security_alert'
    };
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDirectory() {
    const logDir = path.dirname(this.auditLogPath);

    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
      logger.info(`Created security audit log directory: ${logDir}`);
    }
  }

  /**
   * Log a security event
   * @param {Object} event - Security event details
   */
  logEvent(event) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      eventType: event.type,
      userId: event.userId || 'anonymous',
      phoneNumber: event.phoneNumber || null,
      severity: event.severity || 'medium', // low, medium, high, critical
      details: event.details || {},
      action: event.action || 'logged',
      metadata: {
        ipAddress: event.ipAddress || null,
        userAgent: event.userAgent || null,
        sessionId: event.sessionId || null
      }
    };

    // Write to log file
    try {
      const logLine = JSON.stringify(auditEntry) + '\n';
      fs.appendFileSync(this.auditLogPath, logLine);

      // Also log to application logger based on severity
      if (auditEntry.severity === 'critical') {
        logger.error(`[SECURITY AUDIT] ${auditEntry.eventType}:`, auditEntry);
      } else if (auditEntry.severity === 'high') {
        logger.warn(`[SECURITY AUDIT] ${auditEntry.eventType}:`, auditEntry);
      } else {
        logger.info(`[SECURITY AUDIT] ${auditEntry.eventType}:`, auditEntry);
      }

      // Check if log rotation is needed
      this.checkLogRotation();

    } catch (error) {
      logger.error('Failed to write security audit log:', error);
    }
  }

  /**
   * Log prompt injection attempt
   */
  logPromptInjection(userId, input, reason, patterns) {
    this.logEvent({
      type: this.eventTypes.PROMPT_INJECTION,
      userId: userId,
      phoneNumber: userId,
      severity: 'high',
      details: {
        input: input.substring(0, 500), // Store first 500 chars
        reason: reason,
        detectedPatterns: patterns.length,
        inputLength: input.length
      },
      action: 'blocked'
    });
  }

  /**
   * Log SQL injection attempt
   */
  logSQLInjection(userId, input, reason, patterns) {
    this.logEvent({
      type: this.eventTypes.SQL_INJECTION,
      userId: userId,
      phoneNumber: userId,
      severity: 'critical', // SQL injection is critical
      details: {
        input: input.substring(0, 500),
        reason: reason,
        detectedPatterns: patterns.length,
        inputLength: input.length
      },
      action: 'blocked'
    });
  }

  /**
   * Log user blocking
   */
  logUserBlocked(userId, attemptCount, attempts) {
    this.logEvent({
      type: this.eventTypes.USER_BLOCKED,
      userId: userId,
      phoneNumber: userId,
      severity: 'high',
      details: {
        attemptCount: attemptCount,
        timeRange: {
          first: attempts[0]?.timestamp,
          last: attempts[attempts.length - 1]?.timestamp
        },
        attemptTypes: [...new Set(attempts.map(a => a.type))]
      },
      action: 'user_blocked'
    });
  }

  /**
   * Log user unblocking
   */
  logUserUnblocked(userId, adminId = null, reason = 'auto') {
    this.logEvent({
      type: this.eventTypes.USER_UNBLOCKED,
      userId: userId,
      phoneNumber: userId,
      severity: 'medium',
      details: {
        unblocked_by: adminId || 'system',
        reason: reason
      },
      action: 'user_unblocked'
    });
  }

  /**
   * Log suspicious activity
   */
  logSuspiciousActivity(userId, activity, details) {
    this.logEvent({
      type: this.eventTypes.SUSPICIOUS_ACTIVITY,
      userId: userId,
      phoneNumber: userId,
      severity: 'medium',
      details: {
        activity: activity,
        ...details
      },
      action: 'monitored'
    });
  }

  /**
   * Log output validation failure
   */
  logOutputValidationFailed(userId, output, reason) {
    this.logEvent({
      type: this.eventTypes.OUTPUT_VALIDATION_FAILED,
      userId: userId,
      severity: 'high',
      details: {
        output: output.substring(0, 300),
        reason: reason,
        outputLength: output.length
      },
      action: 'output_blocked'
    });
  }

  /**
   * Log admin security action
   */
  logAdminAction(adminId, action, targetUserId, details) {
    this.logEvent({
      type: this.eventTypes.ADMIN_ACTION,
      userId: adminId,
      severity: 'medium',
      details: {
        action: action,
        targetUserId: targetUserId,
        ...details
      },
      action: 'admin_action'
    });
  }

  /**
   * Generate security report for a date range
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Object} - Security report
   */
  generateReport(startDate, endDate) {
    try {
      const logs = this.readLogs(startDate, endDate);

      const report = {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        totalEvents: logs.length,
        eventsByType: {},
        eventsBySeverity: {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0
        },
        topOffenders: {},
        blockedUsers: new Set(),
        summary: {}
      };

      // Analyze logs
      for (const log of logs) {
        // Count by type
        report.eventsByType[log.eventType] = (report.eventsByType[log.eventType] || 0) + 1;

        // Count by severity
        report.eventsBySeverity[log.severity] = (report.eventsBySeverity[log.severity] || 0) + 1;

        // Track top offenders
        if (log.userId) {
          report.topOffenders[log.userId] = (report.topOffenders[log.userId] || 0) + 1;
        }

        // Track blocked users
        if (log.eventType === this.eventTypes.USER_BLOCKED) {
          report.blockedUsers.add(log.userId);
        }
      }

      // Convert sets to arrays
      report.blockedUsers = Array.from(report.blockedUsers);

      // Sort top offenders
      report.topOffenders = Object.entries(report.topOffenders)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([userId, count]) => ({ userId, count }));

      // Generate summary
      report.summary = {
        prompt_injection_attempts: report.eventsByType[this.eventTypes.PROMPT_INJECTION] || 0,
        sql_injection_attempts: report.eventsByType[this.eventTypes.SQL_INJECTION] || 0,
        users_blocked: report.blockedUsers.length,
        critical_events: report.eventsBySeverity.critical,
        high_severity_events: report.eventsBySeverity.high
      };

      return report;

    } catch (error) {
      logger.error('Failed to generate security report:', error);
      return null;
    }
  }

  /**
   * Read logs within a date range
   */
  readLogs(startDate, endDate) {
    try {
      if (!fs.existsSync(this.auditLogPath)) {
        return [];
      }

      const content = fs.readFileSync(this.auditLogPath, 'utf8');
      const lines = content.trim().split('\n');

      const logs = lines
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (e) {
            return null;
          }
        })
        .filter(log => log !== null)
        .filter(log => {
          const logDate = new Date(log.timestamp);
          return logDate >= startDate && logDate <= endDate;
        });

      return logs;

    } catch (error) {
      logger.error('Failed to read security logs:', error);
      return [];
    }
  }

  /**
   * Check if log rotation is needed
   */
  checkLogRotation() {
    try {
      if (!fs.existsSync(this.auditLogPath)) {
        return;
      }

      const stats = fs.statSync(this.auditLogPath);
      const sizeMB = stats.size / (1024 * 1024);

      if (sizeMB > this.maxLogSizeMB) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = `${this.auditLogPath}.${timestamp}`;

        fs.renameSync(this.auditLogPath, rotatedPath);
        logger.info(`Security audit log rotated: ${rotatedPath}`);

        // Compress old log (optional)
        this.compressOldLog(rotatedPath);
      }
    } catch (error) {
      logger.error('Failed to check log rotation:', error);
    }
  }

  /**
   * Compress old log file
   */
  compressOldLog(logPath) {
    // TODO: Implement compression using zlib if needed
    logger.debug(`Old log ready for compression: ${logPath}`);
  }

  /**
   * Get recent security events
   * @param {number} limit - Number of recent events
   * @returns {Array} - Recent events
   */
  getRecentEvents(limit = 100) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const now = new Date();

    const logs = this.readLogs(oneDayAgo, now);

    return logs.slice(-limit).reverse(); // Most recent first
  }

  /**
   * Get events for a specific user
   * @param {string} userId
   * @param {number} limit
   * @returns {Array}
   */
  getUserEvents(userId, limit = 50) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const logs = this.readLogs(thirtyDaysAgo, now);

    return logs
      .filter(log => log.userId === userId)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get statistics
   */
  getStats() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const now = new Date();

    const report = this.generateReport(oneDayAgo, now);

    return {
      last24Hours: report.summary,
      eventsByType: report.eventsByType,
      topOffenders: report.topOffenders
    };
  }
}

module.exports = new SecurityAuditService();
