# Repository Cleanup Audit - 2025-10-31

## Executive Summary
Repository contains **400+ files**, many from previous development phases. This audit categorizes files into:
- **ESSENTIAL** (keep)
- **DOCUMENTATION** (consolidate/keep important ones)
- **NON-ESSENTIAL** (safe to delete)

---

## 🟢 ESSENTIAL FILES - KEEP (Core Application)

### Configuration & Setup
```
✅ package.json
✅ package-lock.json
✅ .gitignore
✅ README.md (main)
✅ CLAUDE.md (project context)
✅ server.js
✅ playwright.config.js
```

### Active Middleware
```
✅ middleware/auth.middleware.js
✅ middleware/rbac.middleware.js
```

### Active Models
```
✅ models/admin-user.model.js
✅ models/session.model.js
✅ models/user.model.js
```

### Active Routes (ALL ESSENTIAL)
```
✅ routes/admin.routes.js
✅ routes/auth.routes.js
✅ routes/certificate.routes.js
✅ routes/chatbot-prompt.routes.js
✅ routes/classification.routes.js
✅ routes/coaching.routes.js
✅ routes/course-rbac.routes.js (NEW - RBAC)
✅ routes/csv-upload.routes.js (NEW - RBAC)
✅ routes/enhanced-rag.routes.js
✅ routes/enrollment.routes.js (NEW - RBAC)
✅ routes/file-list.routes.js
✅ routes/file-processing.routes.js
✅ routes/notification.routes.js (NEW - RBAC)
✅ routes/region.routes.js (NEW - RBAC)
✅ routes/simple-upload.routes.js
✅ routes/statistics.routes.js (NEW - RBAC)
✅ routes/twilio-webhook.routes.js
✅ routes/user.routes.js
```

### Active Services (ALL ESSENTIAL)
```
✅ services/auth/*.js
✅ services/coaching/*.js
✅ services/core/logger/*.js
✅ services/database/postgres.service.js
✅ services/orchestrator/*.js (entire directory)
✅ services/rag/*.js
✅ services/session/*.js
✅ services/whatsapp/*.js (entire directory)

✅ services/certificate.service.js
✅ services/chat-history.service.js
✅ services/chroma.service.js
✅ services/content-classification.service.js
✅ services/content-moderation.service.js
✅ services/content-processor.service.js
✅ services/content.service.js
✅ services/course-chatbot.service.js
✅ services/course-orchestrator.service.js
✅ services/csv-processor.service.js (NEW - RBAC)
✅ services/document-processor.service.js
✅ services/embedding.service.js
✅ services/enrollment.service.js
✅ services/gift-parser.service.js
✅ services/meta-whatsapp-cloud.service.js
✅ services/neo4j.service.js
✅ services/portal-content.service.js
✅ services/prompt-injection-guard.service.js
✅ services/prompt-injection-protection.service.js
✅ services/prompt.service.js
✅ services/quiz.service.js
✅ services/rag.service.js
✅ services/rbac.service.js (NEW - RBAC)
✅ services/region-enrollment.service.js (NEW - RBAC)
✅ services/region.service.js (NEW - RBAC)
✅ services/response-validator.service.js
✅ services/security-audit.service.js
✅ services/sql-injection-protection.service.js
✅ services/translation.service.js
✅ services/twilio-whatsapp.service.js
✅ services/verification.service.js
✅ services/vertexai.service.js
✅ services/whatsapp-adapter.service.js
✅ services/whatsapp-handler.service.js
✅ services/whatsapp-m3-formatter.service.js
✅ services/whatsapp-region-notification.service.js (NEW - RBAC)
```

### Active Database Files
```
✅ database/init.sql
✅ database/migrations/010_create_rbac_tables_postgres.sql (LATEST - RBAC)
✅ config/database.config.js
```

### Active Public/Admin Portal (ALL ESSENTIAL)
```
✅ public/admin/chat.html
✅ public/admin/coaching-analytics.html
✅ public/admin/course-detail.html
✅ public/admin/courses.html
✅ public/admin/dashboard.html
✅ public/admin/login.html
✅ public/admin/quiz.html
✅ public/admin/user-detail.html
✅ public/admin/user-management.html
✅ public/js/sidebar-nav.js
✅ public/index.html
```

### Active Quiz Files
```
✅ quizzes/CORRECT_MODULES/*.json (all 5 modules)
✅ quizzes/CORRECT_MODULES/UPLOAD_GUIDE.md
```

### Active Utilities
```
✅ utils/jwt.util.js
✅ utils/logger.js
✅ utils/password.util.js
```

### Active Tests
```
✅ test-rbac-api.sh (PRIMARY INTEGRATION TEST)
✅ tests/e2e/login.spec.js
✅ tests/e2e/course-creation.spec.js
✅ tests/e2e/course-detail-page.spec.js
```

### Active Scripts
```
✅ scripts/generate-admin-hash.js
✅ scripts/refresh-vertex-token.js
```

### Credentials (KEEP - SECURE)
```
✅ credentials/application_default_credentials.json
✅ credentials/service-account-key.json
```

---

## 📘 DOCUMENTATION - KEEP IMPORTANT ONES

### KEEP - Current & Important Documentation
```
✅ PHASE_4_FINAL_100_PERCENT_COMPLETE.md (LATEST - 100% success!)
✅ PHASE_3_4_IMPLEMENTATION_COMPLETE.md (Technical details)
✅ DUAL_COACHING_BOT_IMPLEMENTATION_PLAN.md (Future feature)
✅ PER_COURSE_CHATBOT_IMPLEMENTATION.md (Future feature)
✅ docs/MULTI_REGION_RBAC_SPEC.md (Current architecture)
✅ SECURITY.md (Important security documentation)
✅ TESTING_GUIDE.md
✅ DEPLOYMENT_GUIDE.md
✅ M3_FORMATTING_GUIDE.md (WhatsApp UI standard)
✅ SOLID_ANALYSIS.md (Code quality reference)
```

### CONSOLIDATE - Similar Content
These have overlapping/similar information - consider merging:
```
⚠️  PHASE_4_COMPLETION_SUMMARY.md (superseded by PHASE_4_FINAL_100_PERCENT_COMPLETE.md)
⚠️  M3_PHASE_1-7_COMPLETE_STATUS.md (7 files - can consolidate into one)
⚠️  DEPLOYMENT*.md (5 files - consolidate into one DEPLOYMENT_GUIDE.md)
⚠️  ENDURANCE_TEST*.md (7 files - consolidate)
⚠️  EDGE_CASE*.md (4 files - consolidate)
⚠️  HARASSMENT*.md (3 files - consolidate or delete)
```

---

## 🔴 NON-ESSENTIAL FILES - SAFE TO DELETE

### Old/Deprecated Deployment Scripts (50+ files)
These are one-time deployment scripts or superseded by newer versions:
```
❌ deploy-1min-nudge.sh
❌ deploy-bilingual-to-gcp.sh
❌ deploy-chat-fix.sh
❌ deploy-dashboard-fix-gcloud.sh
❌ deploy-dashboard-fix.sh
❌ deploy-moderation-to-gcp.sh
❌ deploy-nav-fix.sh
❌ deploy-nav-to-gcp.sh
❌ deploy-nudge-fix-gcp.sh
❌ deploy-number-fix-to-gcp.sh
❌ deploy-solid-refactoring.sh
❌ deploy-top-courses-fix.sh
❌ enable-testing-mode.sh
❌ fix-dashboard-numbers-on-gcp.sh
❌ rollback-nudge.sh
❌ safe-deploy-1min-nudge.sh
❌ setup-auto-backup.sh
❌ setup-https-gcp.sh
```

### Old Test Scripts (40+ files)
Superseded by test-rbac-api.sh:
```
❌ demo-swahili-detection-simple.sh
❌ quick-bilingual-test.sh
❌ test-1min-nudge-live.sh
❌ test-all-corner-cases.sh
❌ test-automatic-nudge-72s.sh
❌ test-bilingual-flow.sh
❌ test-both-endpoints.sh
❌ test-business-studies-bilingual.sh
❌ test-chat-visual.sh
❌ test-coaching-gcp.sh
❌ test-coaching-nudging.sh
❌ test-edge-cases.sh
❌ test-enrollment-flow.sh
❌ test-enrollment.sh
❌ test-harassment-sexual-moderation.sh
❌ test-injection-protection.sh
❌ test-navigation-consolidation.sh
❌ test-nudge-now.sh
❌ test-per-user-isolation.sh
❌ test-quiz-get.sh
❌ test-quiz-simple.sh
❌ test-quiz-upload.sh
❌ test-swahili-auto-detection.sh
❌ test-swahili-chat-endpoint.sh
❌ test-swahili-gcp.sh
❌ test-twilio-endpoints.sh
❌ test-upload-endpoint.sh
❌ test-whatsapp-coaching-demo.sh
❌ test-whatsapp-enrollment-live.sh
❌ test-whatsapp-webhook.sh
❌ verify-twilio-webhook.sh
```

### Old E2E Tests (Superseded)
```
❌ tests/e2e/admin-portal-endurance-comprehensive.spec.js
❌ tests/e2e/admin-portal-endurance-realistic.spec.js
❌ tests/e2e/admin-portal-endurance.spec.js
❌ tests/e2e/coaching-analytics-navigation.spec.js
❌ tests/e2e/content-moderation.spec.js
❌ tests/e2e/course-detail-module-check.spec.js
❌ tests/e2e/fresh-course-test.spec.js
❌ tests/e2e/module-chat-production.spec.js
❌ tests/e2e/upload-and-test-ai.spec.js
❌ tests/e2e/upload-production-quiz.spec.js
❌ tests/e2e/view-modules.spec.js
```

### Old Monitoring Scripts
```
❌ monitor-endurance-test-comprehensive.sh
❌ monitor-endurance-test-realistic.sh
❌ monitor-endurance-test.sh
❌ monitor-system.sh
```

### Old Run Scripts
```
❌ run-complete-migration.sh
❌ run-endurance-test-2hour.sh
❌ run-endurance-test-comprehensive.sh
❌ run-endurance-test-headless.sh
❌ run-endurance-test-realistic.sh
❌ run-endurance-test.sh
❌ run-moderation-tests.sh
❌ run-quiz-migration-gcp.sh
❌ endurance-test-solid-2hour.sh
```

### Old Upload Scripts
```
❌ upload-business-studies-content.sh
❌ upload-production-quiz-curl.sh
```

### Old SQL Migration Files (Superseded by newer ones)
```
❌ database/migration_002_moodle_integration.sql
❌ database/migration_003_simplified_moodle.sql
❌ database/migration_004_add_courses_table.sql
❌ database/migration_005_complete_lms.sql
❌ database/migration_006_business_studies_f2.sql
❌ database/migration_007_fix_quiz_schema.sql
❌ database/migration_008_quiz_completion_tracking.sql
❌ database/fix_conversation_context.sql
❌ cleanup-duplicate-uploads.sql
❌ fix-enrollment-columns.sql
❌ fix-enrollment-schema.sh

❌ database/migrations/001_create_base_schema.sql
❌ database/migrations/004_create_learning_interactions.sql
❌ database/migrations/005_add_classification_support.sql
❌ database/migrations/007_pin_enrollment_system.sql
❌ database/migrations/008_coaching_nudges_reflections.sql
❌ database/migrations/009_add_vertex_ai_safety_columns.sql
❌ database/migrations/010_create_conversation_context.sql
❌ database/migrations/010_create_rbac_tables.sql (SQLite version - we use Postgres)

❌ migrations/*.sql (entire old migrations directory)
```

### Old Documentation (60+ files to review)
```
❌ 1MIN_NUDGE_SUMMARY.md
❌ API_ROUTES_STATUS.md
❌ BILINGUAL_TEST_GUIDE.md
❌ BRANCH_STATUS_multi_region_rbac.md
❌ CHAT_INTEGRATION_COMPLETE.md
❌ CLEANUP_COMPLETE_SUMMARY.md
❌ COACHING_SYSTEM_SUMMARY.md
❌ COMPREHENSIVE_CORNER_CASES.md
❌ CONTENT_MODERATION_DEPLOYMENT.md
❌ CONTENT_UPLOAD_GUIDE.md
❌ CORNER_CASE_FIXES_IMPLEMENTED.md
❌ CORNER_CASES_SUMMARY.md
❌ DEMO_GUIDE.md
❌ DEPLOY_NOW.md
❌ DEPLOYMENT_REPORT_2025_10_30.md
❌ DEPLOYMENT_SUCCESS.md
❌ DEPLOYMENT.md
❌ EDGE_CASE_FIXES.md
❌ EDGE_CASES_ANALYSIS.md
❌ ENDURANCE_TEST_COMPREHENSIVE.md
❌ ENDURANCE_TEST_FIXES.md
❌ ENDURANCE_TEST_GUIDE.md
❌ ENDURANCE_TEST_README.md
❌ ENDURANCE_TEST_STATUS.md
❌ ENDURANCE_TEST_SUMMARY.md
❌ ENROLLMENT_SYSTEM_DOCS.md
❌ FINAL_REQUIREMENTS_CLARIFIED.md
❌ GCP_HTTPS_DOMAIN_SETUP.md
❌ harassment-sexual-comparison.md
❌ harassment-sexual-FINAL-RESULTS.md
❌ harassment-sexual-test-summary.md
❌ HTTPS_SETUP_CHECKLIST.md
❌ IMPLEMENTATION_COMPLETE.md
❌ IMPLEMENTATION_SUMMARY.md
❌ LIVE_USER_ENROLLMENT_CHECKLIST.md
❌ M3_PHASE_1_COMPLETE_STATUS.md
❌ M3_PHASE_2_COMPLETE_STATUS.md
❌ M3_PHASE_4_COMPLETE_STATUS.md
❌ M3_PHASE_5_COMPLETE_STATUS.md
❌ M3_PHASE_6_COMPLETE_STATUS.md
❌ M3_PHASE_7_COMPLETE_STATUS.md
❌ M3_UPGRADE_PLAN.md
❌ MEDIUM_PRIORITY_FIXES_COMPLETE.md
❌ MIGRATION_TEST_REPORT_2025_10_30.md
❌ MODULE_WELCOME_MESSAGE.md
❌ NAVIGATION_CONSOLIDATION_COMPLETE.md
❌ NUDGE_FIX_SUCCESS.md
❌ NUDGE_PER_USER_VERIFICATION.md
❌ NUDGE_SYSTEM_COMPLETE.md
❌ PER_USER_NUDGE_GUARANTEE.md
❌ PHASE_1_2_IMPACT_ANALYSIS.md
❌ PHASE_4_COMPLETION_SUMMARY.md (superseded by FINAL version)
❌ PROJECT_FILE_AUDIT.md
❌ PROMPT_INJECTION_DEPLOYMENT_REPORT.md
❌ QUICK_1MIN_NUDGE_TEST.md
❌ QUICK_START_ENDURANCE_TEST.md
❌ QUICK_TEST_REFERENCE.md
❌ QUIZ_COMPLETION_TRACKING.md
❌ QUIZ_UPLOAD_FEATURE.md
❌ REPO_HYGIENE_AUDIT.md
❌ REQUIREMENTS_CONFIRMED_2025_10_30.md
❌ SESSION_INDEX.md
❌ SESSION_STATE_2025_10_30.md
❌ SESSION_STATE_2025-10-29.md
❌ SIDEBAR_GAP_FIX.md
❌ SIDEBAR_NAVIGATION_FIX.md
❌ SOLID_REFACTORING_SUMMARY.md
❌ VALIDATED_SAFE_DELETE_LIST.md
❌ WHATSAPP_CHATBOT_CAPABILITIES.md
❌ WHATSAPP_COACHING_FLOW.md
❌ WHATSAPP_META_CLOUD_API_SETUP.md
❌ WHATSAPP_UI_REALITY_CHECK.md
```

### Report Investigation Directory (Can archive entire folder)
```
❌ report_investigation/*.md (all files)
❌ report_investigation/*.sh (all scripts)
```

### Old HTML Files (Replaced)
```
❌ public/admin/lms-dashboard.html (replaced by dashboard.html)
❌ public/user-login.html (not used)
❌ public/user-progress.html (not used)
```

### Old Scripts
```
❌ scripts/create-course-and-modules.js (replaced by admin UI)
❌ scripts/deploy-to-gcp.sh (use gcloud commands instead)
❌ scripts/run-migration.js (use direct SQL)
❌ scripts/setup-token-refresh-cron.sh (manual process)
```

### Test Artifacts
```
❌ test-results/.last-run.json
❌ endurance-test-stats-20251024-143436.json
❌ playwright-report/index.html
```

### Old Service Files (Deprecated/Unused)
```
❌ services/event-processor.service.js (not referenced)
❌ services/moodle-content.service.js (not used)
❌ services/moodle-settings.service.js (not used)
❌ services/moodle-sync.service.js (not used)
❌ services/orchestrator.service.js (replaced by services/orchestrator/)
❌ services/whatsapp.service.js (replaced by services/whatsapp/)
```

### Misc Old Files
```
❌ backup.sh
❌ apply-edge-case-fixes.sh
❌ database/quiz-questions.sql (replaced by quizzes/CORRECT_MODULES)
❌ database/seed_business_studies_questions.sql (replaced)
```

### .specify and .claude directories (Optional)
```
⚠️  .specify/ (entire directory - speckit templates, may want to keep if using)
⚠️  .claude/ (entire directory - Claude Code commands, may want to keep if using)
```

---

## Cleanup Recommendations

### Phase 1: Safe Deletions (Low Risk)
Delete all files marked with ❌ above (~150 files):
- Old test scripts
- Old deployment scripts
- Superseded documentation
- Old migrations
- Test artifacts

### Phase 2: Documentation Consolidation
Consolidate similar docs into single authoritative files:
- Merge 7 M3_PHASE*.md into M3_IMPLEMENTATION_COMPLETE.md
- Merge 5 DEPLOYMENT*.md into one DEPLOYMENT_GUIDE.md
- Merge ENDURANCE_TEST*.md into TESTING_GUIDE.md
- Archive report_investigation/ to docs/archive/

### Phase 3: Keep Only Latest
For Phase 4:
- Keep: PHASE_4_FINAL_100_PERCENT_COMPLETE.md
- Delete: PHASE_4_COMPLETION_SUMMARY.md

### Estimated Size Reduction
- Before: ~400 files
- After: ~120 essential files (70% reduction)

---

## Commands to Execute Cleanup

### Option 1: Create Archive Branch First (SAFEST)
```bash
git checkout -b archive/pre-cleanup-2025-10-31
git push origin archive/pre-cleanup-2025-10-31
git checkout feature/multi-region-rbac
```

### Option 2: Delete Files (After Review)
```bash
# Review the list carefully, then create a script
# DO NOT RUN without manual review!
```

---

## Final Recommendation

**WAIT FOR USER CONFIRMATION** before deleting anything. Present this audit to the user and let them decide which files to keep/delete based on their needs.

Some users may want to:
- Keep all documentation for historical reference
- Archive instead of delete
- Keep test scripts for reference

Always create a backup branch before major cleanup operations.
