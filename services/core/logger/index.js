/**
 * Logger Module - SOLID Compliant
 *
 * This module provides a refactored logger following SOLID principles:
 * - S: Single Responsibility - Each class has one job
 * - O: Open/Closed - Easy to extend without modification
 * - L: Liskov Substitution - All loggers implement same interface
 * - I: Interface Segregation - Clean, focused interfaces
 * - D: Dependency Inversion - Depends on abstractions
 *
 * Usage:
 *   const logger = require('./services/core/logger');
 *   logger.info('Hello World');
 *
 * Advanced Usage:
 *   const { LoggerFactory } = require('./services/core/logger');
 *   const customLogger = LoggerFactory.createCustomLogger({
 *     serviceName: 'my-service',
 *     logLevel: 'debug'
 *   });
 */

const LoggerFactory = require('./LoggerFactory');
const LoggerConfig = require('./LoggerConfig');
const TransportManager = require('./TransportManager');
const fileSystemService = require('./FileSystemService');

// Create default logger instance
const defaultLogger = LoggerFactory.createLogger();

// Export default logger for backward compatibility
module.exports = defaultLogger;

// Export factory and components for advanced usage
module.exports.LoggerFactory = LoggerFactory;
module.exports.LoggerConfig = LoggerConfig;
module.exports.TransportManager = TransportManager;
module.exports.FileSystemService = fileSystemService;

// Export convenience methods
module.exports.createTestLogger = () => LoggerFactory.createTestLogger();
module.exports.createProductionLogger = () => LoggerFactory.createProductionLogger();
module.exports.createCustomLogger = (options) => LoggerFactory.createCustomLogger(options);
