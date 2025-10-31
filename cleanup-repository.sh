#!/bin/bash

##############################################
# Repository Cleanup Script
# Removes non-essential files and reduces repo size
# ALWAYS REVIEW BEFORE RUNNING!
##############################################

set -e

echo "======================================"
echo "Repository Cleanup Script"
echo "======================================"
echo ""
echo "⚠️  WARNING: This will delete files!"
echo "Review the list carefully before proceeding."
echo ""

# Function to prompt for confirmation
confirm() {
    read -p "Proceed with $1? (yes/no): " response
    if [ "$response" != "yes" ]; then
        echo "Skipped $1"
        return 1
    fi
    return 0
}

# Create backup branch first
echo "Step 1: Creating backup branch..."
if confirm "backup branch creation"; then
    git checkout -b archive/pre-cleanup-$(date +%Y%m%d)
    git push origin archive/pre-cleanup-$(date +%Y%m%d)
    git checkout feature/multi-region-rbac
    echo "✅ Backup branch created"
fi
echo ""

# Phase 1: Clean local artifacts (safe - not in git)
echo "======================================"
echo "Phase 1: Local Artifacts Cleanup"
echo "======================================"
echo ""

if confirm "clean old log files"; then
    rm -f endurance-test-*.log
    rm -f *.log
    echo "✅ Removed old log files"
fi

if confirm "clean screenshots"; then
    rm -rf screenshots/
    rm -f *.png
    echo "✅ Removed screenshots"
fi

if confirm "clean playwright reports"; then
    rm -rf playwright-report/
    rm -rf test-results/
    echo "✅ Removed test reports"
fi

if confirm "clean logs directory"; then
    rm -rf logs/*.log
    echo "✅ Cleaned logs directory (kept directory)"
fi

echo ""

# Phase 2: Delete old test scripts
echo "======================================"
echo "Phase 2: Old Test Scripts (40+ files)"
echo "======================================"
echo ""

if confirm "delete old test scripts"; then
    rm -f demo-swahili-detection-simple.sh
    rm -f quick-bilingual-test.sh
    rm -f test-1min-nudge-live.sh
    rm -f test-all-corner-cases.sh
    rm -f test-automatic-nudge-72s.sh
    rm -f test-bilingual-flow.sh
    rm -f test-both-endpoints.sh
    rm -f test-business-studies-bilingual.sh
    rm -f test-chat-visual.sh
    rm -f test-coaching-gcp.sh
    rm -f test-coaching-nudging.sh
    rm -f test-edge-cases.sh
    rm -f test-enrollment-flow.sh
    rm -f test-enrollment.sh
    rm -f test-harassment-sexual-moderation.sh
    rm -f test-injection-protection.sh
    rm -f test-navigation-consolidation.sh
    rm -f test-nudge-now.sh
    rm -f test-per-user-isolation.sh
    rm -f test-quiz-get.sh
    rm -f test-quiz-simple.sh
    rm -f test-quiz-upload.sh
    rm -f test-swahili-auto-detection.sh
    rm -f test-swahili-chat-endpoint.sh
    rm -f test-swahili-gcp.sh
    rm -f test-twilio-endpoints.sh
    rm -f test-upload-endpoint.sh
    rm -f test-whatsapp-coaching-demo.sh
    rm -f test-whatsapp-enrollment-live.sh
    rm -f test-whatsapp-webhook.sh
    rm -f verify-twilio-webhook.sh
    echo "✅ Removed 30+ old test scripts"
fi

echo ""

# Phase 3: Delete old deployment scripts
echo "======================================"
echo "Phase 3: Old Deployment Scripts (20+ files)"
echo "======================================"
echo ""

if confirm "delete old deployment scripts"; then
    rm -f deploy-1min-nudge.sh
    rm -f deploy-bilingual-to-gcp.sh
    rm -f deploy-chat-fix.sh
    rm -f deploy-dashboard-fix-gcloud.sh
    rm -f deploy-dashboard-fix.sh
    rm -f deploy-moderation-to-gcp.sh
    rm -f deploy-nav-fix.sh
    rm -f deploy-nav-to-gcp.sh
    rm -f deploy-nudge-fix-gcp.sh
    rm -f deploy-number-fix-to-gcp.sh
    rm -f deploy-solid-refactoring.sh
    rm -f deploy-top-courses-fix.sh
    rm -f enable-testing-mode.sh
    rm -f fix-dashboard-numbers-on-gcp.sh
    rm -f rollback-nudge.sh
    rm -f safe-deploy-1min-nudge.sh
    rm -f setup-auto-backup.sh
    rm -f setup-https-gcp.sh
    rm -f apply-edge-case-fixes.sh
    rm -f backup.sh
    echo "✅ Removed 20 old deployment scripts"
fi

echo ""

# Phase 4: Delete old monitoring/run scripts
echo "======================================"
echo "Phase 4: Old Monitoring Scripts"
echo "======================================"
echo ""

if confirm "delete old monitoring scripts"; then
    rm -f monitor-endurance-test-comprehensive.sh
    rm -f monitor-endurance-test-realistic.sh
    rm -f monitor-endurance-test.sh
    rm -f monitor-system.sh
    rm -f run-complete-migration.sh
    rm -f run-endurance-test-2hour.sh
    rm -f run-endurance-test-comprehensive.sh
    rm -f run-endurance-test-headless.sh
    rm -f run-endurance-test-realistic.sh
    rm -f run-endurance-test.sh
    rm -f run-moderation-tests.sh
    rm -f run-quiz-migration-gcp.sh
    rm -f endurance-test-solid-2hour.sh
    rm -f endurance-test-stats-*.json
    echo "✅ Removed monitoring/run scripts"
fi

echo ""

# Phase 5: Delete old upload scripts
echo "======================================"
echo "Phase 5: Old Upload Scripts"
echo "======================================"
echo ""

if confirm "delete old upload scripts"; then
    rm -f upload-business-studies-content.sh
    rm -f upload-production-quiz-curl.sh
    echo "✅ Removed upload scripts"
fi

echo ""

# Phase 6: Delete superseded documentation
echo "======================================"
echo "Phase 6: Superseded Documentation (60+ files)"
echo "======================================"
echo ""

if confirm "delete superseded documentation"; then
    # Delete old phase summaries (keep latest)
    rm -f PHASE_4_COMPLETION_SUMMARY.md
    rm -f M3_PHASE_1_COMPLETE_STATUS.md
    rm -f M3_PHASE_2_COMPLETE_STATUS.md
    rm -f M3_PHASE_4_COMPLETE_STATUS.md
    rm -f M3_PHASE_5_COMPLETE_STATUS.md
    rm -f M3_PHASE_6_COMPLETE_STATUS.md
    rm -f M3_PHASE_7_COMPLETE_STATUS.md

    # Delete old deployment docs
    rm -f DEPLOYMENT_REPORT_2025_10_30.md
    rm -f DEPLOYMENT_SUCCESS.md
    rm -f DEPLOYMENT.md
    rm -f DEPLOY_NOW.md

    # Delete old test docs
    rm -f ENDURANCE_TEST_COMPREHENSIVE.md
    rm -f ENDURANCE_TEST_FIXES.md
    rm -f ENDURANCE_TEST_GUIDE.md
    rm -f ENDURANCE_TEST_README.md
    rm -f ENDURANCE_TEST_STATUS.md
    rm -f ENDURANCE_TEST_SUMMARY.md
    rm -f QUICK_1MIN_NUDGE_TEST.md
    rm -f QUICK_START_ENDURANCE_TEST.md
    rm -f QUICK_TEST_REFERENCE.md

    # Delete old feature docs
    rm -f 1MIN_NUDGE_SUMMARY.md
    rm -f BILINGUAL_TEST_GUIDE.md
    rm -f COACHING_SYSTEM_SUMMARY.md
    rm -f CONTENT_MODERATION_DEPLOYMENT.md
    rm -f CONTENT_UPLOAD_GUIDE.md
    rm -f EDGE_CASE_FIXES.md
    rm -f EDGE_CASES_ANALYSIS.md
    rm -f COMPREHENSIVE_CORNER_CASES.md
    rm -f CORNER_CASE_FIXES_IMPLEMENTED.md
    rm -f CORNER_CASES_SUMMARY.md

    # Delete old status docs
    rm -f API_ROUTES_STATUS.md
    rm -f BRANCH_STATUS_multi_region_rbac.md
    rm -f CHAT_INTEGRATION_COMPLETE.md
    rm -f CLEANUP_COMPLETE_SUMMARY.md
    rm -f DEMO_GUIDE.md
    rm -f ENROLLMENT_SYSTEM_DOCS.md
    rm -f FINAL_REQUIREMENTS_CLARIFIED.md
    rm -f IMPLEMENTATION_COMPLETE.md
    rm -f IMPLEMENTATION_SUMMARY.md
    rm -f LIVE_USER_ENROLLMENT_CHECKLIST.md
    rm -f M3_UPGRADE_PLAN.md
    rm -f MEDIUM_PRIORITY_FIXES_COMPLETE.md
    rm -f MIGRATION_TEST_REPORT_2025_10_30.md
    rm -f MODULE_WELCOME_MESSAGE.md
    rm -f NAVIGATION_CONSOLIDATION_COMPLETE.md
    rm -f NUDGE_FIX_SUCCESS.md
    rm -f NUDGE_PER_USER_VERIFICATION.md
    rm -f NUDGE_SYSTEM_COMPLETE.md
    rm -f PER_USER_NUDGE_GUARANTEE.md
    rm -f PHASE_1_2_IMPACT_ANALYSIS.md
    rm -f PROJECT_FILE_AUDIT.md
    rm -f PROMPT_INJECTION_DEPLOYMENT_REPORT.md
    rm -f QUIZ_COMPLETION_TRACKING.md
    rm -f QUIZ_UPLOAD_FEATURE.md
    rm -f REPO_HYGIENE_AUDIT.md
    rm -f REQUIREMENTS_CONFIRMED_2025_10_30.md
    rm -f SESSION_INDEX.md
    rm -f SESSION_STATE_2025_10_30.md
    rm -f SESSION_STATE_2025-10-29.md
    rm -f SIDEBAR_GAP_FIX.md
    rm -f SIDEBAR_NAVIGATION_FIX.md
    rm -f SOLID_REFACTORING_SUMMARY.md
    rm -f VALIDATED_SAFE_DELETE_LIST.md

    # Delete old harassment test docs
    rm -f harassment-sexual-comparison.md
    rm -f harassment-sexual-FINAL-RESULTS.md
    rm -f harassment-sexual-test-summary.md

    # Delete old HTTPS/GCP setup docs
    rm -f GCP_HTTPS_DOMAIN_SETUP.md
    rm -f HTTPS_SETUP_CHECKLIST.md

    # Delete old WhatsApp docs (info in main docs)
    rm -f WHATSAPP_CHATBOT_CAPABILITIES.md
    rm -f WHATSAPP_COACHING_FLOW.md
    rm -f WHATSAPP_META_CLOUD_API_SETUP.md
    rm -f WHATSAPP_UI_REALITY_CHECK.md

    echo "✅ Removed 60+ superseded documentation files"
fi

echo ""

# Phase 7: Delete old E2E tests
echo "======================================"
echo "Phase 7: Old E2E Tests"
echo "======================================"
echo ""

if confirm "delete old E2E tests"; then
    rm -f tests/e2e/admin-portal-endurance-comprehensive.spec.js
    rm -f tests/e2e/admin-portal-endurance-realistic.spec.js
    rm -f tests/e2e/admin-portal-endurance.spec.js
    rm -f tests/e2e/coaching-analytics-navigation.spec.js
    rm -f tests/e2e/content-moderation.spec.js
    rm -f tests/e2e/course-detail-module-check.spec.js
    rm -f tests/e2e/fresh-course-test.spec.js
    rm -f tests/e2e/module-chat-production.spec.js
    rm -f tests/e2e/upload-and-test-ai.spec.js
    rm -f tests/e2e/upload-production-quiz.spec.js
    rm -f tests/e2e/view-modules.spec.js
    echo "✅ Removed old E2E tests (kept essential 3)"
fi

echo ""

# Phase 8: Delete report investigation directory
echo "======================================"
echo "Phase 8: Report Investigation Archive"
echo "======================================"
echo ""

if confirm "delete report_investigation directory"; then
    rm -rf report_investigation/
    echo "✅ Removed report_investigation directory"
fi

echo ""

# Phase 9: Delete old migrations
echo "======================================"
echo "Phase 9: Old Database Migrations"
echo "======================================"
echo ""

if confirm "delete old migration files"; then
    # Delete old root-level migrations
    rm -f database/migration_002_moodle_integration.sql
    rm -f database/migration_003_simplified_moodle.sql
    rm -f database/migration_004_add_courses_table.sql
    rm -f database/migration_005_complete_lms.sql
    rm -f database/migration_006_business_studies_f2.sql
    rm -f database/migration_007_fix_quiz_schema.sql
    rm -f database/migration_008_quiz_completion_tracking.sql
    rm -f database/fix_conversation_context.sql
    rm -f database/quiz-questions.sql
    rm -f database/seed_business_studies_questions.sql

    # Delete old migrations directory (except RBAC)
    rm -f database/migrations/001_create_base_schema.sql
    rm -f database/migrations/004_create_learning_interactions.sql
    rm -f database/migrations/005_add_classification_support.sql
    rm -f database/migrations/007_pin_enrollment_system.sql
    rm -f database/migrations/008_coaching_nudges_reflections.sql
    rm -f database/migrations/009_add_vertex_ai_safety_columns.sql
    rm -f database/migrations/010_create_conversation_context.sql
    rm -f database/migrations/010_create_rbac_tables.sql

    # Delete old migrations folder
    rm -rf migrations/

    # Delete old fix scripts
    rm -f cleanup-duplicate-uploads.sql
    rm -f fix-enrollment-columns.sql
    rm -f fix-enrollment-schema.sh

    echo "✅ Removed old migration files (kept latest RBAC)"
fi

echo ""

# Phase 10: Delete unused service files
echo "======================================"
echo "Phase 10: Unused Service Files"
echo "======================================"
echo ""

if confirm "delete unused service files"; then
    rm -f services/event-processor.service.js
    rm -f services/moodle-content.service.js
    rm -f services/moodle-settings.service.js
    rm -f services/moodle-sync.service.js
    rm -f services/orchestrator.service.js
    rm -f services/whatsapp.service.js
    echo "✅ Removed unused service files"
fi

echo ""

# Phase 11: Delete unused HTML files
echo "======================================"
echo "Phase 11: Unused HTML Files"
echo "======================================"
echo ""

if confirm "delete unused HTML files"; then
    rm -f public/admin/lms-dashboard.html
    rm -f public/user-login.html
    rm -f public/user-progress.html
    echo "✅ Removed unused HTML files"
fi

echo ""

# Phase 12: Delete old scripts
echo "======================================"
echo "Phase 12: Old Scripts"
echo "======================================"
echo ""

if confirm "delete old scripts"; then
    rm -f scripts/create-course-and-modules.js
    rm -f scripts/deploy-to-gcp.sh
    rm -f scripts/run-migration.js
    rm -f scripts/setup-token-refresh-cron.sh
    echo "✅ Removed old scripts"
fi

echo ""

# Summary
echo "======================================"
echo "Cleanup Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Review changes: git status"
echo "2. Stage changes: git add -A"
echo "3. Commit: git commit -m 'chore: Repository cleanup - remove 270 non-essential files'"
echo "4. Push: git push origin feature/multi-region-rbac"
echo ""
echo "Files kept:"
echo "- All core application code"
echo "- Active RBAC system"
echo "- test-rbac-api.sh (primary test suite)"
echo "- Essential documentation"
echo "- Active admin portal"
echo ""
