const winston = require('winston');

/**
 * TransportManager
 *
 * SOLID Principles:
 * - SRP: Manages logger transports only
 * - OCP: Open for extension (add new transports), closed for modification
 *
 * You can add new transports without modifying this class.
 */
class TransportManager {
  constructor() {
    this.transports = [];
  }

  /**
   * Add file transport for errors
   * @param {string} filename - Error log file path
   * @returns {TransportManager} - For method chaining
   */
  addErrorFileTransport(filename) {
    this.transports.push(
      new winston.transports.File({
        filename,
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        )
      })
    );
    return this;
  }

  /**
   * Add file transport for all logs
   * @param {string} filename - Combined log file path
   * @returns {TransportManager} - For method chaining
   */
  addCombinedFileTransport(filename) {
    this.transports.push(
      new winston.transports.File({
        filename,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        )
      })
    );
    return this;
  }

  /**
   * Add console transport with colors
   * @returns {TransportManager} - For method chaining
   */
  addConsoleTransport() {
    this.transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    );
    return this;
  }

  /**
   * Add custom transport
   * SOLID OCP: Extend functionality without modifying the class
   * @param {winston.Transport} transport - Custom Winston transport
   * @returns {TransportManager} - For method chaining
   */
  addCustomTransport(transport) {
    this.transports.push(transport);
    return this;
  }

  /**
   * Get all configured transports
   * @returns {Array<winston.Transport>} - Array of transports
   */
  getTransports() {
    return this.transports;
  }

  /**
   * Clear all transports
   * @returns {TransportManager} - For method chaining
   */
  clear() {
    this.transports = [];
    return this;
  }

  /**
   * Example: Add Slack transport without modifying this class
   */
  // const slackTransport = new SlackTransport({ webhookUrl: '...' });
  // transportManager.addCustomTransport(slackTransport);
}

module.exports = TransportManager;
