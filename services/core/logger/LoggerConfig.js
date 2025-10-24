const path = require('path');

/**
 * LoggerConfig
 *
 * SOLID Principle: Single Responsibility Principle (SRP)
 * Responsibility: Provide logger configuration only
 *
 * This centralizes all logger configuration.
 * Easy to modify without touching logger implementation.
 */
class LoggerConfig {
  constructor() {
    this.serviceName = 'teachers-training';
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logsDirectory = path.join(__dirname, '..', '..', '..', 'logs');
    this.errorLogFile = 'error.log';
    this.combinedLogFile = 'combined.log';
    this.timestampFormat = 'YYYY-MM-DD HH:mm:ss';
    this.enableConsole = true;
    this.enableFile = true;
  }

  /**
   * Get log file path
   * @param {string} filename - Log file name
   * @returns {string} - Full path to log file
   */
  getLogFilePath(filename) {
    return path.join(this.logsDirectory, filename);
  }

  /**
   * Get configuration object
   * @returns {Object} - Configuration object
   */
  toObject() {
    return {
      serviceName: this.serviceName,
      logLevel: this.logLevel,
      logsDirectory: this.logsDirectory,
      errorLogFile: this.errorLogFile,
      combinedLogFile: this.combinedLogFile,
      timestampFormat: this.timestampFormat,
      enableConsole: this.enableConsole,
      enableFile: this.enableFile
    };
  }
}

module.exports = LoggerConfig;
