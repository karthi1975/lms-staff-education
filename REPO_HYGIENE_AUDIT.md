# Repository Hygiene Audit - Teachers Training System

## ESSENTIAL FILES (Keep - Required for Functionality)

### Core Application
```
✅ server.js                          # Main application entry point
✅ package.json                       # Dependencies and scripts
✅ package-lock.json                  # Lock file for npm
✅ playwright.config.js               # E2E test configuration
✅ .gitignore                         # Git ignore rules
✅ docker-compose.yml                 # Docker orchestration
✅ Dockerfile                         # Container definition
```

### Configuration
```
✅ config/
   └── database.config.js            # Database configuration

✅ credentials/                       # API credentials (DO NOT COMMIT REAL KEYS)
   ├── application_default_credentials.json
   └── service-account-key.json
```

### Routes (All Essential)
```
✅ routes/
   ├── admin.routes.js               # Main admin routes
   ├── auth.routes.js                # Authentication
   ├── certificate.routes.js         # Certificates
   ├── classification.routes.js      # Content classification
   ├── enhanced-rag.routes.js        # RAG endpoints
   ├── file-list.routes.js           # File listing
   ├── file-processing.routes.js     # File processing
   ├── simple-upload.routes.js       # Upload handling
   ├── twilio-webhook.routes.js      # WhatsApp webhooks
   └── user.routes.js                # User management
```

### Services (All Essential)
```
✅ services/
   ├── auth/
   │   ├── admin.auth.service.js
   │   └── user.service.js
   ├── coaching/
   │   ├── coaching-engine.service.js
   │   ├── nudging.service.js
   │   └── reflection.service.js
   ├── database/
   │   └── postgres.service.js
   ├── rag/
   │   ├── content.service.js
   │   ├── enhanced-rag.service.js
   │   └── performance-optimized-rag.service.js
   ├── session/
   │   ├── session-manager.service.js
   │   └── session.service.js
   └── [All other service files]
```

### Models
```
✅ models/
   ├── admin-user.model.js
   ├── session.model.js
   └── user.model.js
```

### Middleware
```
✅ middleware/
   └── auth.middleware.js
```

### Utils
```
✅ utils/
   ├── jwt.util.js
   ├── logger.js
   └── password.util.js
```

### Public Assets (Frontend)
```
✅ public/
   ├── admin/                         # All 14 admin HTML pages
   │   ├── lms-dashboard.html
   │   ├── courses.html
   │   ├── users.html
   │   └── [12 other admin pages]
   ├── js/
   │   └── sidebar-nav.js            # Sidebar navigation
   ├── index.html
   ├── user-login.html
   └── user-progress.html
```

### Database
```
✅ database/
   ├── init.sql                       # Initial schema
   └── [migration files]              # Schema migrations
```

### Quiz Data
```
✅ quizzes/CORRECT_MODULES/           # Quiz content
   ├── module_01_production.json
   ├── module_02_financing.json
   ├── module_03_management.json
   ├── module_04_warehousing.json
   └── module_05_opportunity.json
```

---

## NON-ESSENTIAL FILES (Can Remove)

### 🗑️ Documentation (Outdated/Redundant)
```
❌ CLAUDE_CODE_INSTRUCTIONS.md        # Development notes
❌ CLAUDE.md                          # Development context
❌ DEPLOY-RAG-FIX.md                  # Temporary fix doc
❌ DEPLOYMENT.md                      # Old deployment guide
❌ M3-DESIGN-SYSTEM.md                # Design documentation
❌ SIDEBAR_NAVIGATION_COMPLETE.md     # Feature complete doc
❌ SIMPLIFIED_UPLOAD_ARCHITECTURE.md  # Architecture doc
❌ TEST_UPLOAD_WORKFLOW.md            # Testing workflow
❌ USER_JOURNEY_COURSE_UPLOAD.md      # User journey doc
❌ README.md                          # Keep this, but update it
```

**Recommendation:** Keep only `README.md` and create a `/docs` folder for others if needed.

### 🗑️ Test/Debug Scripts (Development Only)
```
❌ check-cloud-chromadb.sh
❌ check-logs.sh
❌ check-rag-retrieval.js
❌ clear-local-courses.sh
❌ create-admin-fresh.js
❌ diagnose-quiz-upload.sh
❌ diagnose-rag-on-gcp.sh
❌ monitor-webhook.sh
❌ rebuild-local-database.sh
❌ reset-local-database.sh
❌ RESOLVE_GCP_MERGE_CONFLICT.sh
❌ send-test-message.sh
❌ send-whatsapp-test.js
❌ start-fresh-local.sh
❌ test-webhook-direct.js
❌ test-webhook-simple.sh
❌ test-whatsapp-chat.sh
```

**Recommendation:** Move to `/scripts/dev/` or delete if no longer used.

### 🗑️ Deployment Scripts (Old/Redundant)
```
❌ deploy-m3-theme.sh                 # One-time deployment
❌ deploy-rag-fix.sh                  # One-time deployment
```

**Recommendation:** Keep `scripts/deploy-to-gcp.sh`, remove others.

### 🗑️ Test Results & Reports (Generated Files)
```
❌ playwright-report/                 # Generated test reports
❌ test-results/                      # Generated test results
❌ stress-test-report-*.json          # Performance test results
❌ screenshots/                       # Test screenshots
```

**Recommendation:** Add to `.gitignore`, delete from repo.

### 🗑️ Duplicate/Obsolete Route Files
```
❌ routes/admin.routes.minimal.js     # Duplicate/test version
❌ routes/admin.routes.simple.js      # Duplicate/test version
```

**Recommendation:** Delete if `admin.routes.js` is the active version.

### 🗑️ Speckit/Claude Commands (Development Tools)
```
❌ .claude/                           # Claude Code commands
❌ .specify/                          # Speckit templates
```

**Recommendation:** These are development tools. Keep if actively using, otherwise delete.

### 🗑️ VSCode Settings
```
⚠️ .vscode/settings.json              # Personal IDE settings
```

**Recommendation:** Add to `.gitignore` if not team-wide settings.

### 🗑️ Scripts Folder Audit
```
Keep (✅):
✅ scripts/run-migration.js           # Database migrations
✅ scripts/generate-admin-hash.js     # User management
✅ scripts/refresh-vertex-token.sh    # Production utility
✅ scripts/setup-token-refresh-cron.sh # Production utility

Remove (❌):
❌ scripts/bulk-upload-content.js
❌ scripts/check-chroma-content.js
❌ scripts/check-chromadb-sources.js
❌ scripts/check-content-stats.js
❌ scripts/check-docker-chromadb.js
❌ scripts/check-neo4j-graph.js
❌ scripts/cleanup-all-databases.sh
❌ scripts/cleanup-course-files.js
❌ scripts/cleanup-old-chromadb-content.js
❌ scripts/cleanup-orphaned-files.js
❌ scripts/create-bs-course-simple.js
❌ scripts/enroll-karthi.js
❌ scripts/gcp-complete-cleanup-and-reindex.sh
❌ scripts/gcp-full-reset.sh
❌ scripts/gcp-reset-v2.sh
❌ scripts/generate-business-studies-quizzes.js
❌ scripts/get-module-content.js
❌ scripts/import-moodle-course.js
❌ scripts/index-business-studies.js
❌ scripts/install-ocr-dependencies.sh
❌ scripts/ocr-index-business-studies.js
❌ scripts/reindex-chromadb.js
❌ scripts/reindex-from-db.js
❌ scripts/reprocess-all-content.js
❌ scripts/reprocess-pending-files.js
❌ scripts/reset-content-for-reprocessing.js
❌ scripts/seed-business-studies-quizzes.js
❌ scripts/upload-module-content.js
```

### 🗑️ Migration Files (Old/Obsolete)
```
Keep Latest:
✅ migrations/create_course_content_table.sql
✅ migrations/fix-uploaded-by-constraint.sql

Archive or Remove:
❌ migrations/002_add_source_columns.sql
❌ migrations/003_add_moodle_settings.sql
❌ migrations/004_add_chat_history.sql
```

---

## CLEANUP RECOMMENDATIONS

### Priority 1: Delete Immediately
```bash
# Remove generated test artifacts
rm -rf playwright-report/
rm -rf test-results/
rm -rf screenshots/
rm -f stress-test-report-*.json

# Remove one-time deployment scripts
rm -f deploy-m3-theme.sh
rm -f deploy-rag-fix.sh
rm -f RESOLVE_GCP_MERGE_CONFLICT.sh

# Remove test/debug scripts
rm -f check-*.sh
rm -f diagnose-*.sh
rm -f test-*.sh
rm -f send-test-message.sh
rm -f send-whatsapp-test.js
rm -f test-webhook-direct.js
```

### Priority 2: Archive to /docs
```bash
# Create docs archive
mkdir -p docs/archive

# Move development documentation
mv CLAUDE_CODE_INSTRUCTIONS.md docs/archive/
mv DEPLOY-RAG-FIX.md docs/archive/
mv M3-DESIGN-SYSTEM.md docs/archive/
mv SIDEBAR_NAVIGATION_COMPLETE.md docs/archive/
mv SIMPLIFIED_UPLOAD_ARCHITECTURE.md docs/archive/
mv TEST_UPLOAD_WORKFLOW.md docs/archive/
mv USER_JOURNEY_COURSE_UPLOAD.md docs/archive/
```

### Priority 3: Consolidate Scripts
```bash
# Create dev scripts folder
mkdir -p scripts/dev

# Move development-only scripts
mv scripts/check-* scripts/dev/
mv scripts/cleanup-* scripts/dev/
mv scripts/gcp-*-reset.sh scripts/dev/
mv scripts/*-test-* scripts/dev/
```

### Priority 4: Update .gitignore
```bash
# Add to .gitignore
echo "
# Test Results
playwright-report/
test-results/
screenshots/
stress-test-*.json

# IDE Settings
.vscode/
.idea/

# Development Tools
.claude/
.specify/

# Temporary Files
*.log
*.tmp
*.bak
" >> .gitignore
```

---

## FINAL RECOMMENDED STRUCTURE

```
teachers_training/
├── config/                    # Configuration
├── credentials/               # API keys (not in git)
├── database/                  # Schema & migrations
├── docs/                      # Essential documentation
│   ├── README.md
│   ├── API.md
│   └── DEPLOYMENT.md
├── middleware/                # Express middleware
├── migrations/                # Active migrations only
├── models/                    # Data models
├── public/                    # Frontend assets
├── quizzes/                   # Quiz content
├── routes/                    # API routes
├── scripts/                   # Production utilities only
│   ├── run-migration.js
│   ├── generate-admin-hash.js
│   └── refresh-vertex-token.sh
├── services/                  # Business logic
├── tests/                     # E2E & unit tests
├── utils/                     # Utilities
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── package.json
├── playwright.config.js
├── README.md
└── server.js
```

---

## FILES TO DELETE (Safe to Remove)

**Total: ~60 files can be safely removed**

**Estimated repo size reduction: 70-80%**

### Commands to Clean Up
```bash
# 1. Remove all test artifacts
rm -rf playwright-report/ test-results/ screenshots/
rm -f stress-test-*.json

# 2. Remove temporary documentation
rm -f CLAUDE_CODE_INSTRUCTIONS.md DEPLOY-RAG-FIX.md M3-DESIGN-SYSTEM.md
rm -f SIDEBAR_NAVIGATION_COMPLETE.md SIMPLIFIED_UPLOAD_ARCHITECTURE.md
rm -f TEST_UPLOAD_WORKFLOW.md USER_JOURNEY_COURSE_UPLOAD.md

# 3. Remove test/debug scripts (root level)
rm -f check-*.sh diagnose-*.sh test-*.sh monitor-webhook.sh
rm -f send-test-message.sh send-whatsapp-test.js test-webhook-direct.js
rm -f deploy-m3-theme.sh deploy-rag-fix.sh RESOLVE_GCP_MERGE_CONFLICT.sh
rm -f clear-local-courses.sh rebuild-local-database.sh reset-local-database.sh
rm -f start-fresh-local.sh create-admin-fresh.js check-rag-retrieval.js

# 4. Remove obsolete route files
rm -f routes/admin.routes.minimal.js routes/admin.routes.simple.js

# 5. Remove development scripts (keep only production utilities)
rm -f scripts/bulk-upload-content.js scripts/check-*.js
rm -f scripts/cleanup-*.js scripts/cleanup-*.sh
rm -f scripts/create-bs-course-simple.js scripts/enroll-karthi.js
rm -f scripts/gcp-*-reset.sh scripts/generate-business-studies-quizzes.js
rm -f scripts/get-module-content.js scripts/import-moodle-course.js
rm -f scripts/index-business-studies.js scripts/install-ocr-dependencies.sh
rm -f scripts/ocr-index-business-studies.js scripts/reindex-*.js
rm -f scripts/reprocess-*.js scripts/reset-content-for-reprocessing.js
rm -f scripts/seed-business-studies-quizzes.js scripts/upload-module-content.js

# 6. Remove development tools (optional)
rm -rf .claude/ .specify/
```

---

## FINAL CHECKLIST

Before cleaning:
- [ ] Backup the repository
- [ ] Ensure all essential functionality works
- [ ] Test on GCP instance
- [ ] Review .gitignore additions
- [ ] Update README.md with current architecture

After cleaning:
- [ ] Commit cleanup changes
- [ ] Push to GitHub
- [ ] Verify GCP deployment still works
- [ ] Update documentation

**Estimated Time to Clean: 30 minutes**
**Benefit: Cleaner repo, easier onboarding, faster CI/CD**
