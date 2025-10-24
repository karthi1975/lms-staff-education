const winston = require('winston');
const fileSystemService = require('./FileSystemService');
const LoggerConfig = require('./LoggerConfig');
const TransportManager = require('./TransportManager');

/**
 * LoggerFactory
 *
 * SOLID Principles:
 * - SRP: Creates logger instances only
 * - DIP: Depends on abstractions (config, transport manager)
 * - OCP: Can create different logger types without modification
 *
 * Factory pattern + Dependency Injection
 */
class LoggerFactory {
  /**
   * Create a logger instance
   * @param {LoggerConfig} config - Logger configuration (injected dependency)
   * @param {TransportManager} transportManager - Transport manager (injected dependency)
   * @returns {winston.Logger} - Configured logger instance
   */
  static createLogger(config = null, transportManager = null) {
    // Use defaults if not provided (for backward compatibility)
    const loggerConfig = config || new LoggerConfig();
    const manager = transportManager || LoggerFactory.createDefaultTransportManager(loggerConfig);

    // Ensure log directory exists (delegate to FileSystemService)
    fileSystemService.ensureDirectoryExists(loggerConfig.logsDirectory);

    // Create Winston logger with injected transports
    const logger = winston.createLogger({
      level: loggerConfig.logLevel,
      format: winston.format.combine(
        winston.format.timestamp({
          format: loggerConfig.timestampFormat
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
      ),
      defaultMeta: { service: loggerConfig.serviceName },
      transports: manager.getTransports()
    });

    return logger;
  }

  /**
   * Create default transport manager
   * @param {LoggerConfig} config - Logger configuration
   * @returns {TransportManager} - Configured transport manager
   */
  static createDefaultTransportManager(config) {
    const manager = new TransportManager();

    // Add file transports if enabled
    if (config.enableFile) {
      manager
        .addErrorFileTransport(config.getLogFilePath(config.errorLogFile))
        .addCombinedFileTransport(config.getLogFilePath(config.combinedLogFile));
    }

    // Add console transport if enabled
    if (config.enableConsole) {
      manager.addConsoleTransport();
    }

    return manager;
  }

  /**
   * Create a custom logger with specific configuration
   * Example: Testing logger, Production logger, etc.
   *
   * SOLID DIP: We depend on abstractions (config interface)
   * not on concrete implementations
   */
  static createCustomLogger(options) {
    const config = new LoggerConfig();

    // Override defaults with custom options
    if (options.serviceName) config.serviceName = options.serviceName;
    if (options.logLevel) config.logLevel = options.logLevel;
    if (options.logsDirectory) config.logsDirectory = options.logsDirectory;
    if (options.enableConsole !== undefined) config.enableConsole = options.enableConsole;
    if (options.enableFile !== undefined) config.enableFile = options.enableFile;

    // Create custom transport manager if provided
    let transportManager;
    if (options.customTransports) {
      transportManager = new TransportManager();
      options.customTransports.forEach(transport => {
        transportManager.addCustomTransport(transport);
      });
    }

    return LoggerFactory.createLogger(config, transportManager);
  }

  /**
   * Create test logger (console only, no files)
   * Useful for testing without creating log files
   */
  static createTestLogger() {
    return LoggerFactory.createCustomLogger({
      serviceName: 'teachers-training-test',
      enableFile: false,
      enableConsole: true,
      logLevel: 'debug'
    });
  }

  /**
   * Create production logger (all transports)
   */
  static createProductionLogger() {
    return LoggerFactory.createCustomLogger({
      serviceName: 'teachers-training-prod',
      enableFile: true,
      enableConsole: false,
      logLevel: 'info'
    });
  }
}

module.exports = LoggerFactory;
