# Project File Audit - Teachers Training System

**Date**: 2025-10-24
**Purpose**: Identify essential files, key documentation, and stale/dead code

---

## 📁 ESSENTIAL CORE FILES (MUST KEEP)

### 1. Application Entry Point
- `server.js` - Main application server (actively used)
- `package.json` - Dependencies and scripts
- `package-lock.json` - Dependency lock file

### 2. Configuration Files
- `config/database.config.js` - Database configuration
- `playwright.config.js` - E2E test configuration
- `.vscode/settings.json` - IDE settings
- `.claude/settings.local.json` - Claude Code settings
- `credentials/` - GCP credentials (KEEP SECURE)

### 3. Core Services (Actively Used in server.js)
**Primary Services:**
- `services/course-orchestrator.service.js` (44KB) - Main course logic
- `services/whatsapp-handler.service.js` (31KB) - WhatsApp message handling
- `services/neo4j.service.js` (30KB) - Knowledge graph
- `services/vertexai.service.js` (22KB) - AI responses
- `services/chroma.service.js` (11KB) - Vector embeddings
- `services/whatsapp-adapter.service.js` (6KB) - WhatsApp provider abstraction
- `services/whatsapp-m3-formatter.service.js` (17KB) - Message formatting
- `services/prompt.service.js` (8KB) - Prompt management
- `services/document-processor.service.js` (18KB) - File processing
- `services/content-moderation.service.js` (19KB) - Content safety
- `services/prompt-injection-guard.service.js` (10KB) - Security
- `services/response-validator.service.js` (8KB) - Response validation
- `services/chat-history.service.js` (7KB) - Chat history

**Database Services:**
- `services/database/postgres.service.js` - PostgreSQL connection

**Supporting Services:**
- `services/enrollment.service.js` (17KB) - User enrollment
- `services/quiz.service.js` (15KB) - Quiz logic
- `services/certificate.service.js` (12KB) - Certificate generation
- `services/verification.service.js` (11KB) - User verification
- `services/embedding.service.js` (10KB) - Text embeddings

**WhatsApp Services (SOLID Refactored):**
- `services/whatsapp/` - SOLID-compliant WhatsApp modules
  - `index.js` - Factory pattern
  - `HttpClient.js` - HTTP communication
  - `MessageExtractor.js` - Message parsing
  - `MessageSender.js` - Message sending
  - `MessageChunker.js` - Long message handling
  - `WebhookVerifier.js` - Security
  - `WhatsAppConfig.js` - Configuration
  - `WhatsAppServiceFactory.js` - Service creation
  - `message-handlers/` - Handler modules

**Logger Services (SOLID Refactored):**
- `services/core/logger/` - SOLID-compliant logging
  - `index.js` - Main export
  - `LoggerFactory.js` - Factory pattern
  - `LoggerConfig.js` - Configuration
  - `TransportManager.js` - Log transport
  - `FileSystemService.js` - File operations

**Orchestrator Services (SOLID Refactored):**
- `services/orchestrator/` - SOLID-compliant orchestration
  - `index.js` - Main export
  - `OrchestratorServiceFactory.js` - Factory
  - `CommandRouter.js` - Route commands
  - `MessageProcessor.js` - Process messages
  - `ResponseSender.js` - Send responses
  - `SessionManager.js` - Session management
  - `OrchestratorConfig.js` - Configuration
  - `command-handlers/` - Command modules
  - `quiz/` - Quiz management
  - `module/` - Module management

**Auth Services:**
- `services/auth/admin.auth.service.js` - Admin authentication
- `services/auth/user.service.js` - User management

**Content Services:**
- `services/content.service.js` (21KB) - Content management
- `services/portal-content.service.js` (12KB) - Portal content
- `services/content-classification.service.js` (11KB) - Classification
- `services/content-processor.service.js` (6KB) - Processing

**RAG Services:**
- `services/rag/` - RAG pipeline
  - `content.service.js`
  - `enhanced-rag.service.js`
  - `performance-optimized-rag.service.js`

**Moodle Integration:**
- `services/moodle-content.service.js` (14KB)
- `services/moodle-sync.service.js` (16KB)
- `services/moodle-settings.service.js` (7KB)
- `services/gift-parser.service.js` (8KB)

**Session Management:**
- `services/session/session.service.js`
- `services/session/session-manager.service.js`

**Coaching:**
- `services/coaching/coaching-engine.service.js`
- `services/coaching/nudging.service.js`
- `services/coaching/reflection.service.js`

### 4. Routes (All Actively Used)
- `routes/auth.routes.js` - Authentication
- `routes/admin.routes.js` - Admin API
- `routes/user.routes.js` - User API
- `routes/enhanced-rag.routes.js` - RAG API
- `routes/certificate.routes.js` - Certificates
- `routes/twilio-webhook.routes.js` - WhatsApp webhook
- `routes/classification.routes.js` - Content classification
- `routes/file-processing.routes.js` - File uploads
- `routes/simple-upload.routes.js` - Simple uploads
- `routes/file-list.routes.js` - File listing

### 5. Models
- `models/admin-user.model.js` - Admin user model
- `models/user.model.js` - User model
- `models/session.model.js` - Session model

### 6. Middleware
- `middleware/auth.middleware.js` - Authentication middleware

### 7. Utilities
- `utils/logger.js` - Logging utility
- `utils/jwt.util.js` - JWT handling
- `utils/password.util.js` - Password utilities

### 8. Admin UI (Essential)
**Currently Used:**
- `public/admin/login.html` - Admin login
- `public/admin/dashboard.html` - Main dashboard
- `public/admin/user-management.html` (47KB) - Primary user management
- `public/admin/courses.html` - Course listing
- `public/admin/course-detail.html` - Course details
- `public/admin/chat.html` (32KB) - Primary chat interface
- `public/admin/quiz.html` - Quiz management

**Supporting Files:**
- `public/js/sidebar-nav.js` - Navigation component
- `public/index.html` - Landing page

### 9. Scripts
- `scripts/generate-admin-hash.js` - Admin password hashing
- `scripts/run-migration.js` - Database migrations
- `scripts/create-course-and-modules.js` - Course setup

### 10. Quiz Data
- `quizzes/CORRECT_MODULES/` - Production quiz files (5 modules)
  - `module_01_production.json`
  - `module_02_financing.json`
  - `module_03_management.json`
  - `module_04_warehousing.json`
  - `module_05_opportunity.json`

---

## 📚 KEY DOCUMENTATION (KEEP)

### Essential Documentation
1. **`README.md`** - Project overview and setup (MUST KEEP)
2. **`CLAUDE.md`** - Claude Code context (MUST KEEP - actively used by Claude)
3. **`DEPLOYMENT_GUIDE.md`** - Deployment instructions (MUST KEEP)
4. **`CORNER_CASE_FIXES_IMPLEMENTED.md`** - Critical bug fixes reference (KEEP)
5. **`API_ROUTES_STATUS.md`** - API documentation (KEEP)

### Implementation Documentation (Keep for Reference)
6. **`IMPLEMENTATION_SUMMARY.md`** - M3 UI implementation
7. **`M3_FORMATTING_GUIDE.md`** - WhatsApp formatting reference
8. **`WHATSAPP_META_CLOUD_API_SETUP.md`** - Future Meta API migration
9. **`SOLID_REFACTORING_SUMMARY.md`** - SOLID principles implementation

### User Guides (Keep)
10. **`CONTENT_UPLOAD_GUIDE.md`** - How to upload content
11. **`QUICK_START_ENDURANCE_TEST.md`** - Testing guide
12. **`QUIZ_UPLOAD_FEATURE.md`** - Quiz upload guide

### Subdirectory Documentation (Keep)
- `quizzes/CORRECT_MODULES/UPLOAD_GUIDE.md` - Quiz upload instructions
- `quizzes/CORRECT_MODULES/VALIDATION_REPORT.md` - Quiz validation
- `services/whatsapp/SOLID_EXAMPLES.md` - WhatsApp SOLID examples
- `services/core/logger/SOLID_EXAMPLES.md` - Logger SOLID examples

### Docs Folder (Keep All)
- `docs/gcp-infrastructure-setup.md`
- `docs/gcp-quick-setup-guide.md`
- `docs/moodle-api-integration.md`
- `docs/rag-knowledge-graph-integration-summary.md`
- `docs/knowledge-graph-context-reasoning.md`
- `docs/claude-code-gcp-setup.md`

---

## ⚠️ STALE/REDUNDANT FILES (CANDIDATES FOR DELETION)

### Duplicate HTML Files (DELETE)
**Problem**: Multiple versions of same functionality

1. **Chat Duplicates:**
   - ❌ `public/admin/chat-v2-backup.html` (31KB) - BACKUP FILE
   - ❌ `public/admin/chat-v2.html` (31KB) - OLD VERSION
   - ❌ `public/admin/chat-whatsapp-m3.html` (33KB) - SUPERSEDED
   - ✅ KEEP: `public/admin/chat.html` (32KB) - CURRENT ACTIVE

2. **User Management Duplicates:**
   - ❌ `public/admin/users.html` (31KB) - OLD VERSION
   - ❌ `public/admin/admin-users.html` (27KB) - DUPLICATE
   - ✅ KEEP: `public/admin/user-management.html` (47KB) - CURRENT ACTIVE
   - ✅ KEEP: `public/admin/user-detail.html` (21KB) - DETAIL PAGE

3. **Dashboard Duplicates:**
   - ❌ `public/admin/lms-dashboard.html` - DUPLICATE
   - ✅ KEEP: `public/admin/dashboard.html` - CURRENT ACTIVE

4. **User Portal (Unused?):**
   - ❌ `public/user-login.html` - Appears unused
   - ❌ `public/user-progress.html` - Appears unused

### Unused/Superseded Services (DELETE)
1. **❌ `services/orchestrator.service.js`** (20KB)
   - REASON: Superseded by `services/orchestrator/` SOLID refactored modules
   - NEW LOCATION: `services/orchestrator/index.js` + command handlers

2. **❌ `services/whatsapp.service.js`** (9KB)
   - REASON: Superseded by `services/whatsapp/` SOLID refactored modules
   - NEW LOCATION: `services/whatsapp/index.js`

3. **❌ `services/twilio-whatsapp.service.js`** (9KB)
   - REASON: Superseded by `services/whatsapp-adapter.service.js`
   - USED VIA: `whatsapp-adapter` now handles both Twilio and Meta

4. **❌ `services/rag.service.js`** (2KB - VERY SMALL)
   - REASON: Superseded by `services/rag/` directory with enhanced RAG
   - NEW LOCATION: `services/rag/enhanced-rag.service.js`

5. **❌ `services/event-processor.service.js`** (9KB)
   - CHECK: Not imported in server.js - appears unused

### Old Quiz Data (DELETE)
- ❌ `quizzes/CONVERTED/` - OLD CONVERSION ATTEMPT
  - `module_01_production.json`
  - `module_02_financing.json`
  - `module_03_management.json`
  - `module_04_warehousing.json`
  - `module_05_opportunity.json`
- ✅ KEEP: `quizzes/CORRECT_MODULES/` - CURRENT PRODUCTION DATA

### Temporary Test Scripts (DELETE)
- ❌ `convert-quiz-format.js` - One-time conversion script
- ❌ `test-harassment-fixes.js` - Old test file

### Status/Progress MD Files (ARCHIVE OR DELETE)
**Category**: Temporary documentation of completed work

**M3 Phase Documentation (Completed - Can Archive):**
- ❌ `M3_PHASE_1_COMPLETE_STATUS.md`
- ❌ `M3_PHASE_2_COMPLETE_STATUS.md`
- ❌ `M3_PHASE_4_COMPLETE_STATUS.md`
- ❌ `M3_PHASE_5_COMPLETE_STATUS.md`
- ❌ `M3_PHASE_6_COMPLETE_STATUS.md`
- ❌ `M3_PHASE_7_COMPLETE_STATUS.md`
- ✅ CONSOLIDATE INTO: `M3_FORMATTING_GUIDE.md` (keep as reference)

**Endurance Test Reports (Completed - Can Archive):**
- ❌ `ENDURANCE_TEST_STATUS.md`
- ❌ `ENDURANCE_TEST_SUMMARY.md`
- ❌ `ENDURANCE_TEST_COMPREHENSIVE.md`
- ❌ `ENDURANCE_TEST_FIXES.md`
- ❌ `endurance-test-stats-20251024-143436.json`
- ✅ KEEP: `ENDURANCE_TEST_GUIDE.md` (how to run tests)
- ✅ KEEP: `QUICK_START_ENDURANCE_TEST.md` (quick reference)

**Edge Case Reports (Completed - Can Archive):**
- ❌ `EDGE_CASES_ANALYSIS.md`
- ❌ `EDGE_CASE_FIXES.md`
- ❌ `COMPREHENSIVE_CORNER_CASES.md`
- ❌ `CORNER_CASES_SUMMARY.md`
- ✅ KEEP: `CORNER_CASE_FIXES_IMPLEMENTED.md` (final reference)

**Implementation Complete Status (Archive):**
- ❌ `IMPLEMENTATION_COMPLETE.md`
- ❌ `CHAT_INTEGRATION_COMPLETE.md`
- ❌ `CLEANUP_COMPLETE_SUMMARY.md`
- ❌ `NAVIGATION_CONSOLIDATION_COMPLETE.md`
- ❌ `SIDEBAR_NAVIGATION_FIX.md`
- ❌ `SIDEBAR_GAP_FIX.md`
- ❌ `MEDIUM_PRIORITY_FIXES_COMPLETE.md`
- ❌ `MODULE_WELCOME_MESSAGE.md`

**Moderation Test Reports (Completed - Can Archive):**
- ❌ `harassment-sexual-comparison.md`
- ❌ `harassment-sexual-FINAL-RESULTS.md`
- ❌ `harassment-sexual-test-summary.md`
- ✅ KEEP: `CONTENT_MODERATION_DEPLOYMENT.md` (deployment reference)
- ✅ KEEP: `PROMPT_INJECTION_DEPLOYMENT_REPORT.md` (security reference)

**Deployment Status (Archive After Successful Deploy):**
- ❌ `DEPLOYMENT.md` - OLD
- ❌ `DEPLOY_NOW.md` - TEMPORARY
- ✅ KEEP: `DEPLOYMENT_GUIDE.md` - PRIMARY GUIDE

**Enrollment/Quiz Documentation (Can Consolidate):**
- ❌ `ENROLLMENT_SYSTEM_DOCS.md`
- ❌ `LIVE_USER_ENROLLMENT_CHECKLIST.md`
- ❌ `QUIZ_COMPLETION_TRACKING.md`
- ✅ KEEP: `QUIZ_UPLOAD_FEATURE.md`

**Miscellaneous (Review):**
- ❌ `WHATSAPP_UI_REALITY_CHECK.md` - One-time analysis
- ❌ `M3_UPGRADE_PLAN.md` - Completed plan
- ❌ `HTTPS_SETUP_CHECKLIST.md` - One-time setup
- ❌ `GCP_HTTPS_DOMAIN_SETUP.md` - One-time setup
- ❌ `SOLID_ANALYSIS.md` - Analysis complete
- ❌ `REPO_HYGIENE_AUDIT.md` - Old audit
- ❌ `VALIDATED_SAFE_DELETE_LIST.md` - Old delete list

### Endurance Test Files (Some Can Delete)
**E2E Tests - Keep Core Tests:**
- ✅ KEEP: `tests/e2e/login.spec.js`
- ✅ KEEP: `tests/e2e/course-creation.spec.js`
- ✅ KEEP: `tests/e2e/course-detail-page.spec.js`
- ✅ KEEP: `tests/e2e/content-moderation.spec.js`
- ❌ DELETE: `tests/e2e/admin-portal-endurance.spec.js` (superseded)
- ❌ DELETE: `tests/e2e/admin-portal-endurance-realistic.spec.js` (superseded)
- ✅ KEEP: `tests/e2e/admin-portal-endurance-comprehensive.spec.js` (current)

### .specify and .claude (Speckit - Optional)
**If Not Using Speckit Workflow:**
- ❌ `.specify/` directory
- ❌ `.claude/commands/speckit.*.md` files
- ✅ KEEP: `.claude/commands/*.md` (non-speckit commands)
- ✅ KEEP: `.claude/settings.local.json`

---

## 📊 SUMMARY STATISTICS

### Total Files by Category
- **Core Services**: 32 files (~420KB)
- **Routes**: 10 files
- **Models**: 3 files
- **Utilities**: 3 files
- **Admin UI (Active)**: 7 HTML files (~200KB)
- **Admin UI (Stale)**: 6 HTML files (~180KB) ❌
- **Essential MD Files**: 15 files
- **Stale MD Files**: ~35 files ❌
- **Tests**: 15 files
- **Quiz Data (Active)**: 5 JSON files
- **Quiz Data (Old)**: 5 JSON files ❌

### Potential Space Savings
- **Stale HTML files**: ~180KB
- **Stale services**: ~40KB
- **Old quiz data**: ~50KB
- **Stale MD documentation**: ~300KB
- **Total**: ~570KB of stale files

---

## ✅ RECOMMENDED ACTIONS

### Phase 1: High Priority Deletions (Safe)
1. Delete backup HTML files
2. Delete old quiz conversion data
3. Delete superseded services
4. Delete temporary test scripts

### Phase 2: Archive Documentation (Medium Priority)
1. Create `archive/` directory
2. Move completed status MD files to `archive/completed-phases/`
3. Move old test reports to `archive/test-reports/`
4. Keep current guides in root

### Phase 3: Consolidate Documentation (Low Priority)
1. Consolidate M3 phase docs into single reference
2. Consolidate endurance test reports
3. Consolidate edge case reports
4. Create single deployment guide

### Phase 4: Remove Unused Features (Review First)
1. Check if user portal is needed
2. Verify event-processor usage
3. Check speckit usage
4. Review old test files

---

## 🎯 NEXT STEPS

1. **Review this audit** with team
2. **Create git branch** for cleanup: `git checkout -b cleanup/remove-stale-files`
3. **Execute Phase 1 deletions** (safe, reversible via git)
4. **Test application** after each phase
5. **Commit changes** incrementally
6. **Create archive** for documentation

---

*Generated: 2025-10-24*
*Last Updated: 2025-10-24*
