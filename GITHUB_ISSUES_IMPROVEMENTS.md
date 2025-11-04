# GitHub Issues: Teachers Training System Improvements

**Generated**: 2025-11-03
**Total Issues**: 94 (47 Backend + 47 Frontend)
**Estimated Effort**: 420-476 hours total

---

## BACKEND ISSUES (47 total)

### 🔴 HIGH PRIORITY - SECURITY (6 issues)

#### Issue BE-001: [CRITICAL] Password Reset Returns Plain Text Password
**Priority**: CRITICAL
**Labels**: security, critical, backend
**Estimated Effort**: 4 hours

**Description**:
The password reset endpoint returns the auto-generated password in plain text in the API response.

**Location**: `routes/admin.routes.js:2122-2195`

**Current Code**:
```javascript
res.json({
  newPassword: newPassword, // PLAIN TEXT PASSWORD IN RESPONSE
  warning: 'This password will only be shown once.'
});
```

**Security Impact**:
- Password exposed in browser history
- Password exposed in server logs
- Password exposed in network monitoring
- Violates security best practices

**Recommended Fix**:
- Send password reset link via email instead
- Or require immediate password change on first login
- Never send passwords in API responses

**Acceptance Criteria**:
- [ ] Password reset sends email with secure reset link
- [ ] No plain text passwords in API responses
- [ ] Reset link expires after 1 hour
- [ ] Link can only be used once

---

#### Issue BE-002: [HIGH] SQL Injection Risk via String Interpolation
**Priority**: HIGH
**Labels**: security, sql-injection, backend
**Estimated Effort**: 8 hours

**Description**:
Several SQL queries use string interpolation which could lead to SQL injection if user input is involved.

**Location**: `models/user.model.js:214`

**Current Code**:
```javascript
const query = `
  SELECT * FROM users
  WHERE is_active = true
  AND (last_active_at IS NULL OR last_active_at < NOW() - INTERVAL '${hoursInactive} hours')
`;
```

**Security Impact**:
- SQL injection vulnerability if `hoursInactive` comes from user input
- Potential data exposure or manipulation

**Recommended Fix**:
```javascript
const query = `
  SELECT * FROM users
  WHERE is_active = true
  AND (last_active_at IS NULL OR last_active_at < NOW() - INTERVAL $1)
`;
await postgresService.query(query, [`${hoursInactive} hours`]);
```

**Acceptance Criteria**:
- [ ] All SQL queries use parameterized queries
- [ ] No string interpolation in SQL
- [ ] Security audit passes

---

#### Issue BE-003: [HIGH] No Rate Limiting on Endpoints
**Priority**: HIGH
**Labels**: security, ddos, backend
**Estimated Effort**: 8 hours

**Description**:
No rate limiting on any endpoints, exposing the API to DDoS and brute force attacks.

**Critical Endpoints**:
- `/api/admin/login` (brute force attacks)
- `/api/chat` (expensive Vertex AI calls)
- `/api/admin/modules/:moduleId/content` (file upload abuse)

**Recommended Fix**:
```javascript
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later'
});

app.use('/api/admin/login', loginLimiter);
```

**Acceptance Criteria**:
- [ ] Login endpoint limited to 5 attempts per 15 minutes
- [ ] Chat endpoint limited to 60 requests per minute
- [ ] File upload limited to 10 uploads per hour
- [ ] Rate limit headers returned in response

---

#### Issue BE-004: [HIGH] JWT Tokens Never Revoked
**Priority**: HIGH
**Labels**: security, authentication, backend
**Estimated Effort**: 12 hours

**Description**:
JWT tokens are validated but there's no mechanism to revoke tokens or implement token rotation.

**Location**: `middleware/auth.middleware.js:12-71`

**Security Impact**:
- Stolen tokens remain valid until expiration
- No way to forcefully log out users
- Session hijacking risk

**Recommended Fix**:
- Implement token blacklist in Redis
- Implement refresh token rotation
- Add token revocation on password change
- Add "logout all devices" functionality

**Acceptance Criteria**:
- [ ] Redis token blacklist implemented
- [ ] Refresh token rotation on use
- [ ] Tokens revoked on password change
- [ ] Admin can revoke user tokens

---

#### Issue BE-005: [HIGH] No CSRF Protection
**Priority**: HIGH
**Labels**: security, csrf, backend
**Estimated Effort**: 8 hours

**Description**:
No CSRF tokens on state-changing operations.

**Security Impact**:
- Cross-Site Request Forgery attacks possible
- Unauthorized actions via malicious websites

**Recommended Fix**:
```javascript
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

app.use(csrfProtection);

// Send token to client
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
```

**Acceptance Criteria**:
- [ ] CSRF protection on all POST/PUT/DELETE endpoints
- [ ] CSRF token endpoint for clients
- [ ] Frontend sends CSRF token in headers
- [ ] Tests verify CSRF protection

---

#### Issue BE-006: [MEDIUM] CORS Allows All Origins
**Priority**: MEDIUM
**Labels**: security, cors, backend
**Estimated Effort**: 4 hours

**Location**: `server.js:78`

**Current Code**:
```javascript
app.use(cors()); // Allows all origins
```

**Recommended Fix**:
```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

**Acceptance Criteria**:
- [ ] CORS restricted to specific origins
- [ ] Environment variable configures allowed origins
- [ ] Production uses whitelist of domains

---

### 🔴 HIGH PRIORITY - ARCHITECTURE (5 issues)

#### Issue BE-007: [HIGH] Massive Route File (2,558 lines)
**Priority**: HIGH
**Labels**: refactoring, architecture, technical-debt
**Estimated Effort**: 8-12 hours

**Description**:
`routes/admin.routes.js` is 2,558 lines and violates Single Responsibility Principle.

**Contains**:
- User management
- Course management
- Module management
- Quiz management
- Content upload
- RBAC logic
- File operations

**Impact**:
- Extremely difficult to maintain
- Hard to test
- Merge conflicts
- No clear ownership

**Recommended Refactoring**:
```
routes/
  ├── admin-users.routes.js (admin CRUD)
  ├── courses.routes.js (course management)
  ├── modules.routes.js (module management)
  ├── quizzes.routes.js (quiz management)
  ├── content.routes.js (content upload/processing)
  ├── regions.routes.js (region management)
  └── enrollment.routes.js (enrollment logic)
```

**Acceptance Criteria**:
- [ ] No route file > 500 lines
- [ ] Each file handles single domain
- [ ] All existing tests pass
- [ ] No functionality broken

---

#### Issue BE-008: [HIGH] Direct Database Access in Routes
**Priority**: HIGH
**Labels**: architecture, layering, technical-debt
**Estimated Effort**: 16-24 hours

**Description**:
Routes directly call `postgresService.pool.query()` instead of using service layer (50+ instances).

**Location**: `admin.routes.js:281, 332, 353, 396, etc.`

**Current Anti-Pattern**:
```javascript
// Line 281 - BAD
const userCheck = await postgresService.pool.query(
  'SELECT id, name, whatsapp_id FROM users WHERE id = $1',
  [parseInt(userId)]
);
```

**Impact**:
- Violates layered architecture
- Business logic in routes
- Impossible to unit test
- Code duplication

**Recommended Pattern**:
```javascript
// Good approach
const userService = require('../services/user.service');
const user = await userService.getUserById(userId);
```

**Acceptance Criteria**:
- [ ] Create UserService with CRUD methods
- [ ] Create CourseService with CRUD methods
- [ ] Routes only call service methods
- [ ] Add unit tests for services
- [ ] Remove all direct DB calls from routes

---

#### Issue BE-009: [HIGH] Missing Transaction Management
**Priority**: HIGH
**Labels**: database, data-integrity, backend
**Estimated Effort**: 12 hours

**Description**:
Complex multi-step operations run without transactions.

**Location**: `admin.routes.js:1446-1591` (module deletion)

**Current Issue**:
```javascript
// Lines 1496-1556: Delete files, Neo4j, ChromaDB, PostgreSQL
// NO TRANSACTION - if one step fails, partial data remains
```

**Impact**:
- Data inconsistency on failure
- Orphaned records
- File system out of sync with database

**Recommended Fix**:
```javascript
await postgresService.transaction(async (client) => {
  // Step 1: Get file paths
  const files = await getModuleFiles(client, moduleId);

  // Step 2: Delete DB records
  await deleteModuleRecords(client, moduleId);

  // Step 3: Delete files (if DB succeeds)
  await deleteFiles(files);

  // Step 4: Delete from Neo4j/Chroma (best effort)
  await deleteFromVectorDBs(moduleId);
});
```

**Acceptance Criteria**:
- [ ] All multi-step operations use transactions
- [ ] Rollback on any failure
- [ ] Files only deleted after DB success
- [ ] Add transaction helper to postgresService

---

#### Issue BE-010: [HIGH] No Caching Layer
**Priority**: HIGH
**Labels**: performance, caching, backend
**Estimated Effort**: 16 hours

**Description**:
No Redis or in-memory caching despite "Redis-ready" architecture comment.

**Impact**:
- Repeated database queries for:
  - User roles/permissions (RBAC)
  - Course/module lists
  - Content metadata
- Every request calls `rbacService.isSuperAdmin()` → DB query

**Recommended Implementation**:
```javascript
const NodeCache = require('node-cache');
const roleCache = new NodeCache({ stdTTL: 600 }); // 10 min TTL

async isSuperAdmin(adminUserId) {
  const cacheKey = `role:${adminUserId}`;
  let cached = roleCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const result = await this.getAdminUserRole(adminUserId);
  const isSuperAdmin = result?.role_id === this.ROLES.SUPER_ADMIN;
  roleCache.set(cacheKey, isSuperAdmin);
  return isSuperAdmin;
}
```

**Acceptance Criteria**:
- [ ] Install node-cache or connect to Redis
- [ ] Cache RBAC role checks (10 min TTL)
- [ ] Cache course/module lists (5 min TTL)
- [ ] Invalidate cache on updates
- [ ] Add cache hit/miss metrics

---

#### Issue BE-011: [HIGH] Missing Input Validation
**Priority**: HIGH
**Labels**: security, validation, backend
**Estimated Effort**: 16 hours

**Description**:
30+ endpoints lack input validation for request body parameters.

**Location**: `admin.routes.js:328-385` (Course Creation)

**Current Issue**:
```javascript
const { code, title, description, category, difficulty_level, duration_weeks, sequence_order, region_id } = req.body;
// NO VALIDATION - can insert invalid data
```

**Impact**:
- Corrupted data in database
- Application crashes
- Type errors
- Security vulnerabilities

**Recommended Fix**:
```javascript
const { body, validationResult } = require('express-validator');

router.post('/courses', [
  body('code').isString().trim().notEmpty().isLength({ max: 50 }),
  body('title').isString().trim().notEmpty().isLength({ max: 200 }),
  body('duration_weeks').optional().isInt({ min: 1, max: 52 }),
  body('difficulty_level').optional().isIn(['beginner', 'intermediate', 'advanced']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // ... create course
});
```

**Acceptance Criteria**:
- [ ] Install express-validator
- [ ] Add validation to all POST/PUT endpoints
- [ ] Return clear error messages
- [ ] Add validation tests
- [ ] Document validation rules

---

### 🟡 MEDIUM PRIORITY - DATABASE (6 issues)

#### Issue BE-012: [HIGH] N+1 Query Problem
**Priority**: HIGH
**Labels**: performance, database, backend
**Estimated Effort**: 6 hours

**Location**: `admin.routes.js:178-214` (Get Users)

**Current Issue**:
```javascript
// Lines 200-206 - INEFFICIENT
const allUsers = await contentService.getAllUsersProgress();
users = allUsers.filter(user =>
  user.primary_region_id && regionIds.includes(user.primary_region_id)
);
```

**Impact**:
- Loads entire users table into memory
- Filters in application instead of database
- Slow performance with 1000+ users

**Recommended Fix**:
```javascript
const users = await postgresService.query(`
  SELECT * FROM users WHERE primary_region_id = ANY($1)
`, [regionIds]);
```

**Acceptance Criteria**:
- [ ] Filter in SQL query, not in-memory
- [ ] Test with 10,000+ user records
- [ ] Response time < 500ms

---

#### Issue BE-013: [HIGH] Missing Database Indexes
**Priority**: HIGH
**Labels**: performance, database, optimization
**Estimated Effort**: 4 hours

**Location**: `database/init.sql`

**Missing Indexes**:
- `quiz_attempts(module_id)` - foreign key not indexed
- `quiz_attempts(passed)` - frequently filtered
- `module_content(processed, uploaded_at)` - background processing
- `admin_users(role_id)` - RBAC queries

**Impact**:
- Slow queries as data grows (10x+ slower at 100k+ records)
- Table scans instead of index seeks

**Recommended Fix**:
```sql
CREATE INDEX idx_quiz_module ON quiz_attempts(module_id);
CREATE INDEX idx_quiz_passed ON quiz_attempts(passed);
CREATE INDEX idx_content_processing ON module_content(processed, uploaded_at);
CREATE INDEX idx_admin_role ON admin_users(role_id);
CREATE INDEX idx_users_region ON users(primary_region_id);
```

**Acceptance Criteria**:
- [ ] Create migration with indexes
- [ ] Run EXPLAIN ANALYZE on slow queries
- [ ] Verify performance improvement
- [ ] Document index strategy

---

#### Issue BE-014: [MEDIUM] Connection Pool Not Optimized
**Priority**: MEDIUM
**Labels**: database, configuration, backend
**Estimated Effort**: 4 hours

**Location**: `services/database/postgres.service.js:25-27`

**Current Issue**:
```javascript
const poolConfig = dbConfig.getPoolConfig(); // Unknown defaults
this.pool = new Pool(poolConfig);
```

**Impact**:
- May exhaust connections under load (default pg pool = 10)
- No timeout configuration
- Connection leaks possible

**Recommended Fix**:
```javascript
const poolConfig = {
  max: 20, // Max concurrent connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  allowExitOnIdle: false
};
this.pool = new Pool(poolConfig);
```

**Acceptance Criteria**:
- [ ] Configure pool size based on load testing
- [ ] Add connection monitoring
- [ ] Set timeouts appropriately
- [ ] Test under concurrent load

---

#### Issue BE-015: [MEDIUM] No Query Performance Monitoring
**Priority**: MEDIUM
**Labels**: observability, performance, backend
**Estimated Effort**: 4 hours

**Location**: `services/database/postgres.service.js:73-88`

**Current Issue**:
- Logs query duration but no alerting for slow queries
- No aggregated performance metrics

**Recommended Fix**:
```javascript
if (duration > 1000) { // Slow query threshold
  logger.warn('Slow query detected', {
    query: text,
    duration,
    params: values
  });

  // Send to monitoring service
  metrics.increment('database.slow_queries');
}
```

**Acceptance Criteria**:
- [ ] Log slow queries (> 1 second)
- [ ] Track query performance metrics
- [ ] Dashboard for slow queries
- [ ] Alert on excessive slow queries

---

#### Issue BE-016: [MEDIUM] Missing Foreign Key Constraints
**Priority**: MEDIUM
**Labels**: database, data-integrity
**Estimated Effort**: 4 hours

**Location**: `database/init.sql`

**Current Issue**:
- `quiz_attempts.module_id` has no FK to `modules` table
- Potential orphaned records

**Recommended Fix**:
```sql
ALTER TABLE quiz_attempts
ADD CONSTRAINT fk_quiz_module
FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
```

**Acceptance Criteria**:
- [ ] Add missing foreign keys
- [ ] Verify cascade behavior
- [ ] Clean up existing orphaned records
- [ ] Add FK tests

---

#### Issue BE-017: [LOW] No Request Size Limits
**Priority**: LOW
**Labels**: security, configuration
**Estimated Effort**: 2 hours

**Location**: `server.js:79`

**Current Code**:
```javascript
app.use(bodyParser.json({ limit: '50mb' }));
```

**Impact**:
- Memory exhaustion attacks possible
- 50MB limit too high for JSON

**Recommended Fix**:
```javascript
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));

// Handle files separately with multer
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } });
```

**Acceptance Criteria**:
- [ ] Reduce JSON limit to 5MB
- [ ] Handle large files separately
- [ ] Test with large payloads

---

### 🟡 MEDIUM PRIORITY - PERFORMANCE (4 issues)

#### Issue BE-018: [HIGH] Synchronous File Operations in Request Path
**Priority**: HIGH
**Labels**: performance, scalability, backend
**Estimated Effort**: 12 hours

**Location**: `admin.routes.js:1496-1529`

**Current Issue**:
```javascript
await fs.unlink(tryPath); // Blocks event loop
```

**Impact**:
- Server hangs during file I/O
- Poor performance under load
- Timeout issues with large files

**Recommended Fix**:
Use background job queue (Bull + Redis):
```javascript
await fileCleanupQueue.add('delete-module-files', {
  moduleId,
  files: filePaths
});

res.json({
  success: true,
  message: 'File deletion queued'
});
```

**Acceptance Criteria**:
- [ ] Install Bull and setup Redis
- [ ] Create file cleanup job processor
- [ ] Move file operations to background
- [ ] Add job status tracking

---

#### Issue BE-019: [MEDIUM] Expensive Operations Without Streaming
**Priority**: MEDIUM
**Labels**: performance, memory, backend
**Estimated Effort**: 8 hours

**Location**: `server.js:228-277` (content upload)

**Current Issue**:
- Entire file loaded into memory before processing
- Memory issues with large PDFs

**Recommended Fix**:
```javascript
const stream = fs.createReadStream(filePath);
const chunks = await documentProcessor.processStream(stream);
```

**Acceptance Criteria**:
- [ ] Implement streaming for file processing
- [ ] Test with 100MB+ files
- [ ] Monitor memory usage

---

#### Issue BE-020: [MEDIUM] Session Management In-Memory
**Priority**: MEDIUM
**Labels**: scalability, architecture, backend
**Estimated Effort**: 12 hours

**Location**: `services/session/session.service.js`

**Current Issue**:
- Sessions stored in PostgreSQL, not Redis
- Slow session lookups (DB roundtrip vs Redis O(1))
- Can't scale horizontally (sticky sessions required)

**Recommended Fix**:
```javascript
const redis = require('redis');
const client = redis.createClient();

// Session CRUD in Redis
await client.set(`session:${sessionId}`, JSON.stringify(data), { EX: 86400 });
const session = await client.get(`session:${sessionId}`);
```

**Acceptance Criteria**:
- [ ] Migrate sessions to Redis
- [ ] Session TTL management
- [ ] Test horizontal scaling
- [ ] Migration path for existing sessions

---

#### Issue BE-021: [LOW] No Response Compression
**Priority**: LOW
**Labels**: performance, optimization
**Estimated Effort**: 1 hour

**Recommended Fix**:
```javascript
const compression = require('compression');
app.use(compression());
```

**Acceptance Criteria**:
- [ ] Enable gzip compression
- [ ] Test response sizes
- [ ] Verify Content-Encoding headers

---

### 🟡 MEDIUM PRIORITY - CODE QUALITY (8 issues)

#### Issue BE-022: [MEDIUM] Inconsistent Error Handling
**Priority**: MEDIUM
**Labels**: code-quality, error-handling
**Estimated Effort**: 8 hours

**Current Issue**:
Mix of error response formats across endpoints:
```javascript
// Inconsistent formats
return res.status(413).json({ success: false, error: '...' });
res.status(500).json({ success: false, error: error.message });
res.status(400).json({ error: '...' }); // No success field
```

**Recommended Fix**:
Create centralized error handling middleware:
```javascript
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

app.use((err, req, res, next) => {
  const { statusCode = 500, message } = err;
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});
```

**Acceptance Criteria**:
- [ ] All errors use AppError class
- [ ] Consistent error response format
- [ ] Error logging to monitoring service
- [ ] Tests for error scenarios

---

#### Issue BE-023: [MEDIUM] Duplicate Code Across Routes
**Priority**: MEDIUM
**Labels**: code-quality, refactoring
**Estimated Effort**: 12 hours

**Current Issue**:
- User fetch logic repeated in 10+ routes
- RBAC checks copy-pasted
- Error handling boilerplate

**Recommended Fix**:
Extract to reusable functions/middleware:
```javascript
// middleware/require-admin.js
async function requireSuperAdmin(req, res, next) {
  const isSuperAdmin = await rbacService.isSuperAdmin(req.user.id);
  if (!isSuperAdmin) {
    return res.status(403).json({ error: 'Super Admin only' });
  }
  next();
}
```

**Acceptance Criteria**:
- [ ] Extract common patterns to middleware
- [ ] DRY principle applied
- [ ] Code coverage increases

---

#### Issue BE-024: [LOW] Magic Numbers/Strings
**Priority**: LOW
**Labels**: code-quality, maintainability
**Estimated Effort**: 4 hours

**Examples**:
- `role_id === 1` (hardcoded Super Admin ID)
- `status === 'active'` (no enum)
- `70` (quiz pass threshold hardcoded)

**Recommended Fix**:
```javascript
// constants/roles.js
const ROLES = {
  SUPER_ADMIN: 1,
  ADMIN: 2,
  USER: 3
};

// constants/status.js
const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending'
};

// constants/quiz.js
const QUIZ = {
  PASS_THRESHOLD: 70,
  MAX_ATTEMPTS: 2
};
```

**Acceptance Criteria**:
- [ ] All magic numbers extracted
- [ ] Constants files created
- [ ] Code uses constant references

---

#### Issue BE-025: [LOW] Inconsistent Naming Conventions
**Priority**: LOW
**Labels**: code-quality, style
**Estimated Effort**: 4 hours

**Examples**:
- `whatsapp_id` vs `whatsappId` (snake_case vs camelCase)
- `module_id` in DB, `moduleId` in code

**Recommended Fix**:
- Standardize to camelCase in code
- Use snake_case only in database
- Add ESLint rules for naming

**Acceptance Criteria**:
- [ ] Code style guide documented
- [ ] ESLint enforces naming
- [ ] Codebase follows conventions

---

#### Issue BE-026: [MEDIUM] Service Dependencies Not Injected
**Priority**: MEDIUM
**Labels**: testing, architecture
**Estimated Effort**: 20 hours

**Current Issue**:
Services directly `require()` other services:
```javascript
const postgresService = require('./database/postgres.service'); // Line 11
```

**Impact**:
- Cannot mock dependencies for unit testing
- Tight coupling

**Recommended Fix**:
Use dependency injection pattern:
```javascript
class RbacService {
  constructor(postgresService) {
    this.postgresService = postgresService;
  }
}

// In app initialization
const rbacService = new RbacService(postgresService);
```

**Acceptance Criteria**:
- [ ] All services use DI
- [ ] Unit tests can mock dependencies
- [ ] Refactor complete

---

#### Issue BE-027: [MEDIUM] Circular Dependencies Risk
**Priority**: MEDIUM
**Labels**: architecture, refactoring
**Estimated Effort**: 12 hours

**Current Issue**:
Services importing each other (e.g., `orchestrator` → `whatsapp` → `orchestrator`)

**Impact**:
- Hard-to-debug initialization errors
- Tight coupling

**Recommended Fix**:
- Introduce event bus or mediator pattern
- Break circular dependencies

**Acceptance Criteria**:
- [ ] No circular dependencies
- [ ] Event bus implemented
- [ ] Services decoupled

---

#### Issue BE-028: [LOW] No Code Comments
**Priority**: LOW
**Labels**: documentation, code-quality
**Estimated Effort**: 8 hours

**Current Issue**:
Complex logic (RBAC, quiz scoring) lacks explanatory comments

**Recommended Fix**:
Add JSDoc comments:
```javascript
/**
 * Checks if user has passed quiz attempt
 * @param {number} score - User's quiz score (0-100)
 * @param {number} threshold - Pass threshold (default 70)
 * @returns {boolean} True if passed
 */
function hasPassedQuiz(score, threshold = 70) {
  return score >= threshold;
}
```

**Acceptance Criteria**:
- [ ] All public functions have JSDoc
- [ ] Complex logic explained
- [ ] Generate API docs from JSDoc

---

#### Issue BE-029: [LOW] Inconsistent RESTful Design
**Priority**: LOW
**Labels**: api-design, refactoring
**Estimated Effort**: 8 hours

**Current Issue**:
- Mix of `/api/admin/users` vs `/api/users`
- Duplicate endpoints with different schemas
- Inconsistent naming

**Recommended Fix**:
Standardize API structure:
```
/api/v1/admin/users       → Admin user CRUD
/api/v1/admin/whatsapp-users → WhatsApp users
/api/v1/admin/courses     → Course management
/api/v1/admin/modules     → Module management
```

**Acceptance Criteria**:
- [ ] All routes follow REST conventions
- [ ] API versioning added
- [ ] Deprecated routes removed

---

### 🟢 TESTING (3 issues)

#### Issue BE-030: [HIGH] No Unit Tests
**Priority**: HIGH
**Labels**: testing, quality
**Estimated Effort**: 40 hours

**Current Issue**:
`package.json` has Jest, but no test files found

**Recommended Implementation**:
```javascript
// tests/unit/rbac.service.test.js
describe('RbacService', () => {
  it('should identify super admin correctly', async () => {
    const rbacService = new RbacService(mockPostgresService);
    const result = await rbacService.isSuperAdmin(1);
    expect(result).toBe(true);
  });
});
```

**Acceptance Criteria**:
- [ ] 80% code coverage
- [ ] Tests for models
- [ ] Tests for services
- [ ] Tests for middleware
- [ ] CI runs tests automatically

---

#### Issue BE-031: [HIGH] No Integration Tests
**Priority**: HIGH
**Labels**: testing, quality
**Estimated Effort**: 24 hours

**Recommended Implementation**:
```javascript
const request = require('supertest');

describe('POST /api/admin/login', () => {
  it('should return token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@test.com', password: 'Test123!' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});
```

**Acceptance Criteria**:
- [ ] Tests for all API endpoints
- [ ] Test database setup/teardown
- [ ] Mock external services
- [ ] CI integration

---

#### Issue BE-032: [MEDIUM] No Load Testing
**Priority**: MEDIUM
**Labels**: testing, performance
**Estimated Effort**: 8 hours

**Recommended Tools**:
- k6 or Artillery for load testing
- Test scenarios: 100 concurrent users, 1000 requests/min

**Acceptance Criteria**:
- [ ] Load test scripts created
- [ ] Performance benchmarks documented
- [ ] Identify bottlenecks

---

### 🔧 ADDITIONAL BACKEND IMPROVEMENTS (15 issues)

**BE-033**: No API versioning
**BE-034**: No Helmet.js security headers
**BE-035**: Background jobs run in-process
**BE-036**: No read replicas support
**BE-037**: No load balancing preparation
**BE-038**: Duplicate route definitions
**BE-039**: Admin roles stored in JWT (can be stale)
**BE-040**: No logging aggregation
**BE-041**: No health check endpoint
**BE-042**: No graceful shutdown
**BE-043**: No request tracing
**BE-044**: No API documentation (Swagger)
**BE-045**: No database backup automation
**BE-046**: No performance profiling
**BE-047**: No dependency vulnerability scanning

*(Create separate issues for these 15 items with similar detail)*

---

## FRONTEND ISSUES (47 total)

### 🔴 HIGH PRIORITY - SECURITY (3 issues)

#### Issue FE-001: [CRITICAL] XSS Vulnerability - No Input Sanitization
**Priority**: CRITICAL
**Labels**: security, xss, frontend
**Estimated Effort**: 4-6 hours

**Description**:
User inputs directly inserted into DOM without sanitization using innerHTML.

**Location**: `public/admin/user-management.html:844`

**Current Code**:
```javascript
// VULNERABLE
return `<td>${user.name || 'N/A'}</td>`;
```

**Security Impact**:
- Cross-Site Scripting (XSS) attacks
- Malicious script execution
- Session hijacking
- Data theft

**Recommended Fix**:
```javascript
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

return `<td>${escapeHtml(user.name) || 'N/A'}</td>`;
```

**Acceptance Criteria**:
- [ ] All user inputs sanitized before rendering
- [ ] Use textContent instead of innerHTML where possible
- [ ] XSS security tests pass
- [ ] Security audit completed

---

#### Issue FE-002: [CRITICAL] JWT Token Storage in localStorage
**Priority**: CRITICAL
**Labels**: security, authentication, frontend
**Estimated Effort**: High (requires backend changes)

**Location**: `public/admin/login.html:404`, all pages reading token

**Current Issue**:
```javascript
localStorage.setItem('accessToken', data.tokens.accessToken);
localStorage.setItem('refreshToken', data.tokens.refreshToken);
```

**Security Impact**:
- Tokens vulnerable to XSS attacks
- If XSS exists, attacker can steal tokens
- No HttpOnly protection

**Recommended Fix**:
1. **Short-term**: Implement XSS protection (Issue FE-001)
2. **Long-term**: Move to HttpOnly cookies
```javascript
// Backend sends tokens in HttpOnly cookies
res.cookie('accessToken', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000 // 15 minutes
});
```

**Acceptance Criteria**:
- [ ] Tokens in HttpOnly cookies (backend)
- [ ] Frontend doesn't store tokens
- [ ] CSRF protection added
- [ ] Security tests pass

---

#### Issue FE-003: [MEDIUM] API Endpoints Exposed in Client Code
**Priority**: MEDIUM
**Labels**: security, configuration
**Estimated Effort**: 2-3 hours

**Current Issue**:
API endpoints hardcoded throughout client code

**Recommended Fix**:
```javascript
// public/admin/js/config.js
const API_CONFIG = {
  BASE_URL: '/api/v1',
  ENDPOINTS: {
    LOGIN: '/admin/login',
    USERS: '/admin/users',
    COURSES: '/admin/courses',
  }
};

// Usage
const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.USERS}`;
```

**Acceptance Criteria**:
- [ ] All API URLs centralized
- [ ] Easy to update API version
- [ ] Environment-specific configs

---

### 🔴 HIGH PRIORITY - CODE ORGANIZATION (4 issues)

#### Issue FE-004: [HIGH] Massive CSS Duplication (70-80%)
**Priority**: HIGH
**Labels**: refactoring, performance, frontend
**Estimated Effort**: 6-8 hours

**Description**:
All 14 HTML files duplicate 200-800 lines of CSS with 70-80% duplication.

**Current Issue**:
- Each file has embedded CSS for:
  - Material Design 3 design tokens
  - Button styles
  - Modal styling
  - Card components
  - Animations
- Total: 8,000+ lines of duplicated CSS

**Example**:
- `login.html` lines 13-300
- `user-management.html` lines 11-538
- `dashboard.html` lines 11-798

**Recommended Fix**:
1. Extract all common styles to `/admin/css/m3-theme.css`
2. Keep only page-specific styles in `<style>` tags
3. Link to theme CSS: `<link rel="stylesheet" href="css/m3-theme.css">`

**Acceptance Criteria**:
- [ ] CSS duplication reduced from 70% to < 10%
- [ ] File sizes reduced by 40-50%
- [ ] All pages still render correctly
- [ ] No visual regressions

---

#### Issue FE-005: [HIGH] JavaScript Code Duplication
**Priority**: HIGH
**Labels**: refactoring, code-quality, frontend
**Estimated Effort**: 4-6 hours

**Current Issue**:
Every page reimplements:
- Authentication check (dashboard.html:1025-1028, user-management.html:751-758)
- Token retrieval
- Logout function
- Alert/notification functions

**Recommended Fix**:
Create `/admin/js/common.js`:
```javascript
// Authentication utilities
function checkAuth() {
  const token = getAuthToken();
  if (!token) {
    window.location.href = 'login.html';
    return null;
  }
  return token;
}

function getAuthToken() {
  return localStorage.getItem('accessToken');
}

function handleLogout() {
  localStorage.clear();
  window.location.href = 'login.html';
}

// UI utilities
function showAlert(message, type) { /* ... */ }
function showToast(message) { /* ... */ }

// API utilities
async function apiRequest(endpoint, options) { /* ... */ }
```

**Acceptance Criteria**:
- [ ] Common functions extracted
- [ ] All pages use common.js
- [ ] Code duplication reduced
- [ ] Tests for common utilities

---

#### Issue FE-006: [MEDIUM] Inline JavaScript vs External Files
**Priority**: MEDIUM
**Labels**: refactoring, performance, frontend
**Estimated Effort**: 8-10 hours

**Current Issue**:
All JavaScript inline within `<script>` tags (300-1200 lines per file)

**Impact**:
- No browser caching
- Harder to debug
- Code duplication
- No minification

**Recommended Fix**:
Extract to separate files:
```
public/admin/js/
  ├── common.js (shared utilities)
  ├── dashboard.js (dashboard page)
  ├── user-management.js (user management page)
  ├── courses.js (course management)
  └── ...
```

**Acceptance Criteria**:
- [ ] All page-specific JS extracted
- [ ] Files properly cached
- [ ] Source maps for debugging
- [ ] Minification in production

---

#### Issue FE-007: [MEDIUM] No Build Process or Bundler
**Priority**: MEDIUM
**Labels**: tooling, performance
**Estimated Effort**: 8 hours

**Current Issue**:
- No minification
- No tree shaking
- No module bundling
- No CSS preprocessing

**Recommended Fix**:
Implement Vite or Webpack:
```json
// package.json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

**Acceptance Criteria**:
- [ ] Build process configured
- [ ] Development server with HMR
- [ ] Production builds optimized
- [ ] CI/CD integration

---

### 🔴 HIGH PRIORITY - MOBILE RESPONSIVENESS (3 issues)

#### Issue FE-008: [HIGH] Table Overflow on Mobile
**Priority**: HIGH
**Labels**: mobile, ux, frontend
**Estimated Effort**: 3-4 hours per table

**Current Issue**:
- Tables have 7 columns (user-management.html:589)
- No horizontal scroll wrapper
- Fixed column widths cause breaks
- Unusable on mobile

**Recommended Fix**:
```html
<div class="table-responsive">
  <table class="md3-table md3-table-mobile">
    <!-- Priority columns visible -->
    <th class="mobile-hidden">...</th> <!-- Hide on mobile -->
  </table>
</div>

<style>
@media (max-width: 768px) {
  .mobile-hidden { display: none; }
  .table-responsive {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}
</style>
```

**Acceptance Criteria**:
- [ ] All tables responsive
- [ ] Test on iPhone SE (320px)
- [ ] Card layout alternative for mobile
- [ ] Essential columns visible

---

#### Issue FE-009: [HIGH] Sidebar Not Mobile Responsive
**Priority**: HIGH
**Labels**: mobile, navigation, frontend
**Estimated Effort**: 5-6 hours

**Location**: `dashboard.html`, `sidebar-nav.js`

**Current Issue**:
- Basic media query hides sidebar (dashboard:567)
- No tablet breakpoint (768-1024px)
- No swipe gestures
- Sidebar content may overflow

**Recommended Fix**:
```javascript
// Add touch gesture support
let touchStartX = 0;
document.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
});

document.addEventListener('touchend', (e) => {
  const touchEndX = e.changedTouches[0].clientX;
  if (touchStartX < 50 && touchEndX > 150) {
    // Swipe right from edge - open sidebar
    openSidebar();
  }
});
```

**Acceptance Criteria**:
- [ ] Sidebar toggleable on mobile
- [ ] Swipe to open/close
- [ ] Overlay when open
- [ ] Test on actual devices

---

#### Issue FE-010: [MEDIUM] Form Fields Too Small on Mobile
**Priority**: MEDIUM
**Labels**: mobile, ux, accessibility
**Estimated Effort**: 2-3 hours

**Current Issue**:
- Small touch targets (< 44px)
- Input fields too narrow
- PIN modal doesn't fit on iPhone SE

**Recommended Fix**:
```css
/* Minimum touch target */
.md3-button,
.md3-input,
.clickable {
  min-height: 48px;
  min-width: 48px;
}

@media (max-width: 480px) {
  .md3-input {
    width: 100%;
    font-size: 16px; /* Prevents zoom on iOS */
  }

  .md3-modal {
    margin: 0;
    width: 100%;
    max-width: 100%;
  }
}
```

**Acceptance Criteria**:
- [ ] All touch targets ≥ 48px
- [ ] Inputs full-width on mobile
- [ ] No zoom on focus (iOS)
- [ ] Test on smallest device (320px)

---

### 🔴 HIGH PRIORITY - ACCESSIBILITY (4 issues)

#### Issue FE-011: [HIGH] Missing ARIA Labels
**Priority**: HIGH
**Labels**: accessibility, wcag, frontend
**Estimated Effort**: 10-12 hours

**Current Issue**:
- Navigation links lack `aria-current="page"`
- Modals missing `aria-labelledby` and `aria-describedby`
- Form inputs missing `aria-invalid`
- Loading spinners lack `aria-live`
- Buttons use emoji only (no alt text)

**Example**:
```html
<!-- Bad: dashboard.html:810 -->
<a href="dashboard.html" class="nav-item active">
  <span class="nav-item-icon">📊</span>
  <span class="nav-item-text">Dashboard</span>
</a>

<!-- Good -->
<a href="dashboard.html" class="nav-item active" aria-current="page">
  <span class="nav-item-icon" aria-hidden="true">📊</span>
  <span class="nav-item-text">Dashboard</span>
</a>
```

**Acceptance Criteria**:
- [ ] All interactive elements have ARIA labels
- [ ] aria-live for dynamic content
- [ ] aria-invalid for form errors
- [ ] Test with NVDA/JAWS screen readers

---

#### Issue FE-012: [HIGH] Keyboard Navigation Issues
**Priority**: HIGH
**Labels**: accessibility, keyboard, frontend
**Estimated Effort**: 6-8 hours

**Current Issue**:
- Modal focus not trapped
- Tab order skips elements
- No visible focus indicators
- Escape key doesn't close modals consistently

**Recommended Fix**:
```javascript
function trapFocus(modal) {
  const focusableElements = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    } else if (e.key === 'Escape') {
      closeModal(modal);
    }
  });

  firstElement.focus();
}
```

**Acceptance Criteria**:
- [ ] Focus trapped in modals
- [ ] Escape closes modals
- [ ] Visible focus indicators
- [ ] Logical tab order

---

#### Issue FE-013: [MEDIUM] Color Contrast Issues
**Priority**: MEDIUM
**Labels**: accessibility, wcag, design
**Estimated Effort**: 2-3 hours

**Current Issue**:
- Sidebar text on dark background may fail WCAG AA
- Disabled button text (opacity 0.38)
- Some status badges low contrast

**Recommended Fix**:
- Use contrast checker (4.5:1 for normal text, 3:1 for large)
- Add outlines for disabled states
- Test in grayscale mode

**Acceptance Criteria**:
- [ ] All text passes WCAG AA
- [ ] Lighthouse accessibility score > 95
- [ ] Tested in grayscale

---

#### Issue FE-014: [MEDIUM] Missing Skip Links
**Priority**: MEDIUM
**Labels**: accessibility, navigation
**Estimated Effort**: 30 minutes

**Current Issue**:
No "Skip to main content" link for keyboard/screen reader users

**Recommended Fix**:
```html
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <nav>...</nav>
  <main id="main-content">
    <!-- page content -->
  </main>
</body>

<style>
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
</style>
```

**Acceptance Criteria**:
- [ ] Skip link on all pages
- [ ] Visible on keyboard focus
- [ ] Links to main content

---

### 🟡 MEDIUM PRIORITY - UX/UI CONSISTENCY (6 issues)

#### Issue FE-015: [HIGH] Inconsistent Navigation Patterns
**Priority**: HIGH
**Labels**: ux, consistency, frontend
**Estimated Effort**: 2-3 hours

**Current Issue**:
- dashboard.html: Embedded sidebar (lines 802-844)
- Other pages: sidebar-nav.js component
- Different active state indicators

**Recommended Fix**:
- Use sidebar-nav.js for ALL pages including dashboard
- Remove duplicate sidebar code
- Consistent active states

**Acceptance Criteria**:
- [ ] All pages use sidebar-nav.js
- [ ] Consistent navigation highlighting
- [ ] No duplicate sidebar code

---

#### Issue FE-016: [MEDIUM] Inconsistent Header/Breadcrumb Patterns
**Priority**: MEDIUM
**Labels**: ux, consistency
**Estimated Effort**: 4-5 hours

**Current Issue**:
- dashboard.html: Custom top-bar with breadcrumb
- user-management.html: Separate breadcrumb + header
- courses.html: Header only, no breadcrumb initially

**Recommended Fix**:
Create reusable header component with:
- Breadcrumb navigation
- Page title
- Action buttons area
- User profile dropdown

**Acceptance Criteria**:
- [ ] Consistent header across all pages
- [ ] Reusable component
- [ ] Proper breadcrumb navigation

---

#### Issue FE-017: [MEDIUM] Modal Design Inconsistency
**Priority**: MEDIUM
**Labels**: ui, consistency
**Estimated Effort**: 2-3 hours

**Current Issue**:
- Different modal sizes (420px vs 500px vs 600px)
- Inconsistent animations
- Different close button patterns

**Recommended Fix**:
```css
.md3-modal-sm { max-width: 420px; }
.md3-modal-md { max-width: 600px; }
.md3-modal-lg { max-width: 800px; }
```

**Acceptance Criteria**:
- [ ] Standard modal sizes
- [ ] Consistent animations
- [ ] Standard close button position

---

#### Issue FE-018: [MEDIUM] Button Style Variations
**Priority**: MEDIUM
**Labels**: ui, consistency
**Estimated Effort**: 4-5 hours

**Current Issue**:
- login.html: `.btn-login` custom
- user-management.html: `.btn-primary`, `.btn-secondary`
- m3-theme.css: `.md3-button` rarely used

**Recommended Fix**:
- Use ONLY `.md3-button` classes
- Remove custom button classes
- Add missing variants to m3-theme.css

**Acceptance Criteria**:
- [ ] All buttons use md3-button
- [ ] Consistent hover effects
- [ ] No custom button classes

---

#### Issue FE-019: [LOW] Inconsistent Loading States
**Priority**: LOW
**Labels**: ux, consistency
**Estimated Effort**: 5-6 hours

**Current Issue**:
- user-detail.html: Spinner with text
- dashboard.html: Custom loading div
- user-management.html: Button text change

**Recommended Fix**:
Standardize:
1. Global: Top progress bar
2. Local: Skeleton screens
3. Button: Spinner + disabled
4. Inline: Small spinner

**Acceptance Criteria**:
- [ ] Consistent loading patterns
- [ ] Skeleton screens for content
- [ ] Progress indicators

---

#### Issue FE-020: [LOW] No Empty States
**Priority**: LOW
**Labels**: ux
**Estimated Effort**: 3-4 hours

**Current Issue**:
No friendly empty states when no data (just empty tables)

**Recommended Fix**:
```html
<div class="empty-state">
  <div class="empty-state-icon">📭</div>
  <h3>No users yet</h3>
  <p>Users will appear here once they enroll</p>
  <button class="md3-button">Invite Users</button>
</div>
```

**Acceptance Criteria**:
- [ ] Empty states for all lists
- [ ] Helpful call-to-action
- [ ] Consistent design

---

### 🟡 MEDIUM PRIORITY - PERFORMANCE (5 issues)

#### Issue FE-021: [MEDIUM] Large File Sizes
**Priority**: MEDIUM
**Labels**: performance, optimization
**Estimated Effort**: Low (automated)

**Current Issue**:
- course-detail.html: 73KB
- admin-users-rbac.html: 55KB
- No minification

**Recommended Fix**:
- Extract CSS/JS
- Enable GZIP
- Minify production builds
- Expected: 40-50% reduction

**Acceptance Criteria**:
- [ ] File sizes reduced 40-50%
- [ ] GZIP enabled
- [ ] Minified builds

---

#### Issue FE-022: [MEDIUM] No API Response Caching
**Priority**: MEDIUM
**Labels**: performance, caching
**Estimated Effort**: 4-5 hours

**Current Issue**:
Every page load fetches same data

**Recommended Fix**:
```javascript
const cache = {
  set(key, data, ttl = 300000) {
    localStorage.setItem(key, JSON.stringify({
      data,
      expires: Date.now() + ttl
    }));
  },
  get(key) {
    const item = JSON.parse(localStorage.getItem(key));
    if (item && Date.now() < item.expires) {
      return item.data;
    }
    localStorage.removeItem(key);
    return null;
  }
};
```

**Acceptance Criteria**:
- [ ] Cache with TTL implemented
- [ ] User list cached (5 min)
- [ ] Course list cached (5 min)
- [ ] Invalidate on updates

---

#### Issue FE-023: [MEDIUM] No Lazy Loading
**Priority**: MEDIUM
**Labels**: performance, scalability
**Estimated Effort**: 8-10 hours

**Current Issue**:
- All course modules loaded immediately
- Large user tables load all data
- No pagination

**Recommended Fix**:
- Pagination (10-20 items per page)
- Lazy load course modules on expand
- Intersection Observer for infinite scroll
- Backend pagination support

**Acceptance Criteria**:
- [ ] User tables paginated
- [ ] Modules lazy loaded
- [ ] Performance tested with 1000+ items

---

#### Issue FE-024: [LOW] Animation Performance
**Priority**: LOW
**Labels**: performance, animations
**Estimated Effort**: 2-3 hours

**Current Issue**:
Animations use non-GPU properties (box-shadow, width)

**Recommended Fix**:
- Use only GPU properties (transform, opacity)
- Add `will-change` for frequent animations

**Acceptance Criteria**:
- [ ] Smooth 60fps animations
- [ ] GPU-accelerated properties

---

#### Issue FE-025: [MEDIUM] No Service Worker / PWA
**Priority**: MEDIUM
**Labels**: performance, offline
**Estimated Effort**: 12 hours

**Recommended Implementation**:
- Service worker for caching
- Offline fallback page
- PWA manifest

**Acceptance Criteria**:
- [ ] Service worker caches assets
- [ ] Works offline (read-only)
- [ ] Installable as PWA

---

### 🟡 MEDIUM PRIORITY - ERROR HANDLING (4 issues)

#### Issue FE-026: [MEDIUM] Inconsistent Error Display
**Priority**: MEDIUM
**Labels**: ux, error-handling
**Estimated Effort**: 3-4 hours

**Current Issue**:
- login.html: Inline error messages
- user-management.html: Alert div with setTimeout
- dashboard.html: console.error only

**Recommended Fix**:
Create toast notification system:
```javascript
class ToastManager {
  show(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `md3-toast md3-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}
```

**Acceptance Criteria**:
- [ ] Toast system implemented
- [ ] Consistent error display
- [ ] Success/warning/error types

---

#### Issue FE-027: [MEDIUM] No Offline Handling
**Priority**: MEDIUM
**Labels**: ux, error-handling
**Estimated Effort**: 4-5 hours

**Current Issue**:
- Network failures show generic error
- No retry mechanism
- No offline detection

**Recommended Fix**:
```javascript
window.addEventListener('offline', () => {
  showToast('You are offline. Some features may not work.', 'warning');
});

window.addEventListener('online', () => {
  showToast('Back online!', 'success');
  retryFailedRequests();
});
```

**Acceptance Criteria**:
- [ ] Offline detection
- [ ] User feedback
- [ ] Request retry on reconnect

---

#### Issue FE-028: [MEDIUM] No Global Error Handler
**Priority**: MEDIUM
**Labels**: error-handling, monitoring
**Estimated Effort**: 1-2 hours

**Recommended Fix**:
```javascript
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  showToast('Something went wrong. Please refresh.', 'error');
  // Send to Sentry or error tracking
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise:', event.reason);
  showToast('An error occurred. Please try again.', 'error');
});
```

**Acceptance Criteria**:
- [ ] Global error handlers
- [ ] User-friendly messages
- [ ] Error tracking integration

---

#### Issue FE-029: [LOW] No Form Validation Feedback
**Priority**: LOW
**Labels**: ux, forms
**Estimated Effort**: 4 hours

**Current Issue**:
Generic error messages, no field-specific validation

**Recommended Fix**:
- Real-time validation
- Field-specific error messages
- Visual indicators

**Acceptance Criteria**:
- [ ] Real-time validation
- [ ] Clear error messages
- [ ] Accessibility-friendly errors

---

### 🟢 CODE QUALITY (8 issues)

#### Issue FE-030: [LOW] No Code Comments
**Priority**: LOW
**Labels**: documentation, code-quality
**Estimated Effort**: 8-10 hours

**Current Issue**:
Complex functions lack comments (e.g., dashboard.html:1189, 70 lines no comments)

**Recommended Fix**:
```javascript
/**
 * Loads modules for a specific course
 * @param {number} courseId - Course ID
 * @returns {Promise<void>}
 */
async function loadCourseModules(courseId) {
  // Implementation
}
```

**Acceptance Criteria**:
- [ ] JSDoc for all functions
- [ ] Complex logic explained
- [ ] Generated docs

---

#### Issue FE-031: [LOW] Magic Numbers and Strings
**Priority**: LOW
**Labels**: code-quality
**Estimated Effort**: 2-3 hours

**Current Issue**:
Hardcoded values (300, 200, 'active', 'completed')

**Recommended Fix**:
```javascript
// constants.js
const STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  COMPLETED: 'completed'
};

const TIMEOUTS = {
  TOAST: 3000,
  API_TIMEOUT: 10000,
  DEBOUNCE: 300
};
```

**Acceptance Criteria**:
- [ ] Constants extracted
- [ ] Code uses constants
- [ ] Maintainability improved

---

#### Issue FE-032: [LOW] Inconsistent Naming
**Priority**: LOW
**Labels**: code-quality, style
**Estimated Effort**: Medium (refactoring)

**Current Issue**:
- Mix of camelCase and kebab-case
- `loadUsers()` vs `displayUsers()` vs `renderCourseTree()`

**Recommended Fix**:
Naming conventions:
- Functions: `verbNoun()` - `loadUsers`, `displayCourses`
- Event handlers: `handle[Event]` - `handleClick`
- Booleans: `is[Adjective]` - `isActive`, `isLoading`

**Acceptance Criteria**:
- [ ] Style guide documented
- [ ] ESLint enforces naming
- [ ] Code follows conventions

---

#### Issue FE-033: [MEDIUM] No Linting
**Priority**: MEDIUM
**Labels**: tooling, quality
**Estimated Effort**: 3 hours

**Recommended Fix**:
```json
// .eslintrc.json
{
  "extends": ["airbnb-base"],
  "rules": {
    "no-console": "warn",
    "no-unused-vars": "error"
  }
}
```

**Acceptance Criteria**:
- [ ] ESLint configured
- [ ] Stylelint for CSS
- [ ] Prettier for formatting
- [ ] Pre-commit hooks

---

#### Issue FE-034: [LOW] No TypeScript
**Priority**: LOW
**Labels**: enhancement, type-safety
**Estimated Effort**: High (migration)

**Recommended Fix**:
Gradual migration to TypeScript for better type safety

**Acceptance Criteria**:
- [ ] TypeScript setup
- [ ] Critical files migrated
- [ ] Type definitions for APIs

---

#### Issue FE-035: [LOW] No Frontend Tests
**Priority**: LOW
**Labels**: testing
**Estimated Effort**: 16 hours

**Recommended Fix**:
- Unit tests with Jest
- E2E tests with Playwright
- Visual regression tests

**Acceptance Criteria**:
- [ ] 60% code coverage
- [ ] Critical flows tested
- [ ] CI integration

---

#### Issue FE-036: [LOW] No Component Library
**Priority**: LOW
**Labels**: architecture, enhancement
**Estimated Effort**: 20 hours

**Recommended Fix**:
Create reusable component library:
- Button component
- Modal component
- Form components
- Table component

**Acceptance Criteria**:
- [ ] Reusable components
- [ ] Storybook documentation
- [ ] Consistent UI

---

#### Issue FE-037: [LOW] No State Management
**Priority**: LOW
**Labels**: architecture
**Estimated Effort**: 16 hours

**Current Issue**:
Global state scattered across localStorage and variables

**Recommended Fix**:
Simple state management:
```javascript
class AppState {
  constructor() {
    this.state = { user: null, courses: [] };
    this.listeners = [];
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.listeners.forEach(fn => fn(this.state));
  }

  subscribe(fn) {
    this.listeners.push(fn);
  }
}
```

**Acceptance Criteria**:
- [ ] Centralized state
- [ ] Reactive updates
- [ ] Easier debugging

---

### 🔧 ADDITIONAL FRONTEND IMPROVEMENTS (10 issues)

**FE-038**: No internationalization (i18n)
**FE-039**: No dark mode support
**FE-040**: No print stylesheets
**FE-041**: No analytics tracking
**FE-042**: No A/B testing framework
**FE-043**: Images not optimized
**FE-044**: No lazy image loading
**FE-045**: No font optimization
**FE-046**: No CSP headers configured
**FE-047**: No performance monitoring

*(Create separate issues for these 10 items)*

---

## ISSUE CREATION CHECKLIST

For each issue, create GitHub issue with:
- [ ] Title: `[BE/FE-###] Short descriptive title`
- [ ] Labels: priority (critical/high/medium/low), category (security/performance/etc)
- [ ] Description from above
- [ ] Acceptance criteria
- [ ] Estimated effort
- [ ] Link to related issues
- [ ] Milestone assignment

---

## SUMMARY STATISTICS

### Backend Issues
- **CRITICAL**: 2 issues (password reset, SQL injection)
- **HIGH**: 14 issues
- **MEDIUM**: 23 issues
- **LOW**: 8 issues
- **Total Effort**: 260-276 hours

### Frontend Issues
- **CRITICAL**: 2 issues (XSS, token storage)
- **HIGH**: 10 issues
- **MEDIUM**: 27 issues
- **LOW**: 8 issues
- **Total Effort**: 160-200 hours

### Overall
- **Total Issues**: 94
- **Total Effort**: 420-476 hours (10-12 weeks)
- **Critical**: 4 issues requiring immediate attention
- **High**: 24 issues for Phase 1-2
- **Medium**: 50 issues for Phase 3-4
- **Low**: 16 issues for ongoing improvements

---

**End of GitHub Issues Document**
