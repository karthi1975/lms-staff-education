# Logger SOLID Implementation - Examples

## 📚 Table of Contents
1. [Basic Usage](#basic-usage)
2. [Advanced Usage](#advanced-usage)
3. [SOLID Principles Demonstrated](#solid-principles-demonstrated)
4. [Testing Examples](#testing-examples)
5. [Extension Examples](#extension-examples)

---

## 🎯 Basic Usage

### **Backward Compatible** (works with existing code)

```javascript
// Old way still works!
const logger = require('./services/core/logger');

logger.info('Application started');
logger.error('Error occurred', { error: err });
logger.warn('Warning message');
logger.debug('Debug information');
```

---

## 🚀 Advanced Usage

### **1. Custom Logger for Different Services**

```javascript
const { LoggerFactory } = require('./services/core/logger');

// Create logger for specific microservice
const authLogger = LoggerFactory.createCustomLogger({
  serviceName: 'auth-service',
  logLevel: 'debug',
  logsDirectory: './logs/auth'
});

authLogger.info('User logged in', { userId: 123 });
```

### **2. Test Logger (No File Creation)**

```javascript
const { createTestLogger } = require('./services/core/logger');

// Perfect for unit tests - console only, no files
const testLogger = createTestLogger();
testLogger.info('Test running...'); // Only outputs to console
```

### **3. Production Logger (Files Only)**

```javascript
const { createProductionLogger } = require('./services/core/logger');

// Production - files only, no console clutter
const prodLogger = createProductionLogger();
prodLogger.info('Production event'); // Only writes to files
```

---

## 🏗️ SOLID Principles Demonstrated

### **S - Single Responsibility Principle**

Each class has ONE job:

```javascript
// ❌ OLD: One file doing everything
// - File system operations
// - Logger configuration
// - Transport setup
// - Format definition

// ✅ NEW: Each class has one responsibility

// FileSystemService - ONLY file operations
const fileSystemService = require('./FileSystemService');
fileSystemService.ensureDirectoryExists('./logs');

// LoggerConfig - ONLY configuration
const LoggerConfig = require('./LoggerConfig');
const config = new LoggerConfig();

// TransportManager - ONLY managing transports
const TransportManager = require('./TransportManager');
const transportManager = new TransportManager();

// LoggerFactory - ONLY creating loggers
const LoggerFactory = require('./LoggerFactory');
const logger = LoggerFactory.createLogger(config, transportManager);
```

---

### **O - Open/Closed Principle**

Open for extension, closed for modification:

```javascript
const { TransportManager } = require('./services/core/logger');
const winston = require('winston');

// ✅ ADD NEW TRANSPORT WITHOUT MODIFYING CODE

// 1. Create custom Slack transport
class SlackTransport extends winston.Transport {
  constructor(opts) {
    super(opts);
    this.webhookUrl = opts.webhookUrl;
  }

  log(info, callback) {
    // Send log to Slack
    fetch(this.webhookUrl, {
      method: 'POST',
      body: JSON.stringify({ text: info.message })
    }).then(() => callback());
  }
}

// 2. Add it without modifying TransportManager!
const manager = new TransportManager();
manager.addCustomTransport(new SlackTransport({
  webhookUrl: 'https://hooks.slack.com/...'
}));

// 3. Create logger with new transport
const logger = LoggerFactory.createLogger(null, manager);
logger.error('Critical error!'); // Logs to file + console + Slack!
```

---

### **L - Liskov Substitution Principle**

All loggers implement the same interface:

```javascript
const { LoggerFactory } = require('./services/core/logger');

// These can be swapped anywhere
const logger1 = LoggerFactory.createLogger();
const logger2 = LoggerFactory.createTestLogger();
const logger3 = LoggerFactory.createProductionLogger();

// All work the same way
function logMessage(logger, message) {
  logger.info(message); // Works with ANY logger
}

logMessage(logger1, 'Test 1');
logMessage(logger2, 'Test 2');
logMessage(logger3, 'Test 3');
```

---

### **I - Interface Segregation Principle**

Clean, focused interfaces:

```javascript
// Each service has ONLY the methods it needs

// FileSystemService - ONLY file operations
fileSystemService.ensureDirectoryExists(path);
fileSystemService.exists(path);
fileSystemService.getAbsolutePath(...paths);

// LoggerConfig - ONLY configuration
config.getLogFilePath(filename);
config.toObject();

// TransportManager - ONLY transport management
manager.addConsoleTransport();
manager.addErrorFileTransport(file);
manager.getTransports();

// Clients only depend on what they need!
```

---

### **D - Dependency Inversion Principle**

Depend on abstractions, not concretions:

```javascript
// ❌ OLD: Direct dependency on Winston
const winston = require('winston');
const logger = winston.createLogger({ /* ... */ });

// ✅ NEW: Depend on abstractions

// 1. Define logger interface (abstraction)
interface ILogger {
  info(message: string): void;
  error(message: string): void;
  warn(message: string): void;
  debug(message: string): void;
}

// 2. Implementations
class WinstonLogger implements ILogger {
  constructor(private winston) {}
  info(msg) { this.winston.info(msg); }
  // ...
}

class ConsoleLogger implements ILogger {
  info(msg) { console.log('INFO:', msg); }
  error(msg) { console.error('ERROR:', msg); }
  // ...
}

// 3. Services depend on interface, not implementation
class UserService {
  constructor(private logger: ILogger) {} // Abstraction!

  createUser(data) {
    this.logger.info('Creating user...');
    // ...
  }
}

// 4. Easy to test and swap implementations
const service1 = new UserService(new WinstonLogger(winston));
const service2 = new UserService(new ConsoleLogger()); // Same interface!
const service3 = new UserService(new MockLogger()); // Testing!
```

---

## 🧪 Testing Examples

### **Unit Test with Mock Logger**

```javascript
// test/user.service.test.js
const { expect } = require('chai');
const UserService = require('../services/user.service');

// Mock logger for testing
class MockLogger {
  constructor() {
    this.logs = [];
  }

  info(message) {
    this.logs.push({ level: 'info', message });
  }

  error(message) {
    this.logs.push({ level: 'error', message });
  }
}

describe('UserService', () => {
  it('should log when creating user', () => {
    const mockLogger = new MockLogger();
    const service = new UserService(mockLogger);

    service.createUser({ name: 'John' });

    expect(mockLogger.logs).to.have.lengthOf(1);
    expect(mockLogger.logs[0].level).to.equal('info');
  });
});
```

### **Integration Test with Test Logger**

```javascript
// test/integration/logging.test.js
const { createTestLogger } = require('../../services/core/logger');

describe('Logging Integration', () => {
  it('should create test logger without files', () => {
    const logger = createTestLogger();

    // Won't create any files, only console output
    logger.info('Test message');

    // Assert no files were created
    const fs = require('fs');
    expect(fs.existsSync('./logs')).to.be.false;
  });
});
```

---

## 🔧 Extension Examples

### **Example 1: Add Database Logging**

```javascript
const { TransportManager, LoggerFactory } = require('./services/core/logger');
const winston = require('winston');

// 1. Create custom database transport
class DatabaseTransport extends winston.Transport {
  constructor(opts) {
    super(opts);
    this.db = opts.database;
  }

  async log(info, callback) {
    await this.db.query(
      'INSERT INTO logs (level, message, timestamp) VALUES (?, ?, ?)',
      [info.level, info.message, new Date()]
    );
    callback();
  }
}

// 2. Add to transport manager
const manager = new TransportManager();
manager.addCustomTransport(new DatabaseTransport({
  database: myDatabase
}));

// 3. Create logger
const logger = LoggerFactory.createLogger(null, manager);
logger.info('This goes to database!');
```

### **Example 2: Environment-Specific Loggers**

```javascript
const { LoggerFactory } = require('./services/core/logger');

function createEnvironmentLogger() {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'production':
      return LoggerFactory.createCustomLogger({
        serviceName: 'teachers-training-prod',
        logLevel: 'warn', // Only warnings and errors
        enableConsole: false,
        enableFile: true
      });

    case 'staging':
      return LoggerFactory.createCustomLogger({
        serviceName: 'teachers-training-staging',
        logLevel: 'info',
        enableConsole: true,
        enableFile: true
      });

    case 'development':
    default:
      return LoggerFactory.createCustomLogger({
        serviceName: 'teachers-training-dev',
        logLevel: 'debug', // Everything
        enableConsole: true,
        enableFile: false // No file clutter in dev
      });
  }
}

module.exports = createEnvironmentLogger();
```

### **Example 3: Add Elasticsearch Transport**

```javascript
const { TransportManager, LoggerFactory } = require('./services/core/logger');
const { ElasticsearchTransport } = require('winston-elasticsearch');

const manager = new TransportManager();

// Add Elasticsearch transport (no code modification!)
manager.addCustomTransport(new ElasticsearchTransport({
  level: 'info',
  clientOpts: { node: 'http://localhost:9200' },
  index: 'teachers-training-logs'
}));

const logger = LoggerFactory.createLogger(null, manager);
logger.info('Logged to Elasticsearch!');
```

---

## 📊 Benefits Summary

| Benefit | Before (Old Logger) | After (SOLID Logger) |
|---------|---------------------|----------------------|
| **Add new transport** | Modify logger.js | Just call `.addCustomTransport()` |
| **Test without files** | Can't do it | `createTestLogger()` |
| **Different log levels per env** | Hard-coded | Pass config object |
| **Mock for testing** | Difficult | Easy with DIP |
| **Swap implementations** | Impossible | Easy (any logger works) |
| **Understand code** | One big file | Small, focused files |

---

## 🎓 Key Takeaways

1. **SRP** makes each class easy to understand and test
2. **OCP** lets you add features without modifying existing code
3. **LSP** ensures all loggers work interchangeably
4. **ISP** provides clean, focused interfaces
5. **DIP** makes testing and swapping implementations trivial

---

**The refactored logger is:**
- ✅ Easier to test
- ✅ Easier to extend
- ✅ Easier to maintain
- ✅ Easier to understand
- ✅ Backward compatible!
