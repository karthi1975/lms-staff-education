#!/bin/bash
##############################################
# Automated Repository Cleanup
# Removes non-essential files automatically
# Review with: git status
##############################################

set -e

echo "🧹 Starting automated cleanup..."
echo ""

# Create backup branch
echo "📦 Creating backup branch..."
git checkout -b archive/pre-cleanup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || echo "Branch already exists"
git push origin archive/pre-cleanup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || echo "Could not push backup"
git checkout feature/multi-region-rbac 2>/dev/null || echo "Already on feature branch"

echo ""
echo "Phase 1: Local artifacts..."
rm -f *.log *.png 2>/dev/null || true
rm -rf screenshots/ playwright-report/ test-results/ 2>/dev/null || true
echo "✅ Removed local artifacts"

echo ""
echo "Phase 2: Old test scripts (30+)..."
rm -f demo-swahili-detection-simple.sh quick-bilingual-test.sh \
      test-1min-nudge-live.sh test-all-corner-cases.sh \
      test-automatic-nudge-72s.sh test-bilingual-flow.sh \
      test-both-endpoints.sh test-business-studies-bilingual.sh \
      test-chat-visual.sh test-coaching-gcp.sh test-coaching-nudging.sh \
      test-edge-cases.sh test-enrollment-flow.sh test-enrollment.sh \
      test-harassment-sexual-moderation.sh test-injection-protection.sh \
      test-navigation-consolidation.sh test-nudge-now.sh \
      test-per-user-isolation.sh test-quiz-get.sh test-quiz-simple.sh \
      test-quiz-upload.sh test-swahili-auto-detection.sh \
      test-swahili-chat-endpoint.sh test-swahili-gcp.sh \
      test-twilio-endpoints.sh test-upload-endpoint.sh \
      test-whatsapp-coaching-demo.sh test-whatsapp-enrollment-live.sh \
      test-whatsapp-webhook.sh verify-twilio-webhook.sh 2>/dev/null || true
echo "✅ Removed old test scripts"

echo ""
echo "Phase 3: Old deployment scripts (20+)..."
rm -f deploy-1min-nudge.sh deploy-bilingual-to-gcp.sh deploy-chat-fix.sh \
      deploy-dashboard-fix-gcloud.sh deploy-dashboard-fix.sh \
      deploy-moderation-to-gcp.sh deploy-nav-fix.sh deploy-nav-to-gcp.sh \
      deploy-nudge-fix-gcp.sh deploy-number-fix-to-gcp.sh \
      deploy-solid-refactoring.sh deploy-top-courses-fix.sh \
      enable-testing-mode.sh fix-dashboard-numbers-on-gcp.sh \
      rollback-nudge.sh safe-deploy-1min-nudge.sh setup-auto-backup.sh \
      setup-https-gcp.sh apply-edge-case-fixes.sh backup.sh 2>/dev/null || true
echo "✅ Removed old deployment scripts"

echo ""
echo "Phase 4: Old monitoring/run scripts..."
rm -f monitor-*.sh run-*.sh endurance-test-*.sh endurance-test-*.json 2>/dev/null || true
echo "✅ Removed monitoring scripts"

echo ""
echo "Phase 5: Old upload scripts..."
rm -f upload-*.sh 2>/dev/null || true
echo "✅ Removed upload scripts"

echo ""
echo "Phase 6: Superseded documentation (60+)..."
rm -f PHASE_4_COMPLETION_SUMMARY.md M3_PHASE_*_COMPLETE_STATUS.md \
      DEPLOYMENT_REPORT_*.md DEPLOYMENT_SUCCESS.md DEPLOYMENT.md DEPLOY_NOW.md \
      ENDURANCE_TEST_*.md QUICK_*_TEST.md \
      1MIN_NUDGE_SUMMARY.md BILINGUAL_TEST_GUIDE.md COACHING_SYSTEM_SUMMARY.md \
      CONTENT_MODERATION_DEPLOYMENT.md CONTENT_UPLOAD_GUIDE.md \
      EDGE_CASE*.md CORNER_CASE*.md COMPREHENSIVE_CORNER_CASES.md \
      API_ROUTES_STATUS.md BRANCH_STATUS_*.md CHAT_INTEGRATION_COMPLETE.md \
      CLEANUP_COMPLETE_SUMMARY.md DEMO_GUIDE.md ENROLLMENT_SYSTEM_DOCS.md \
      FINAL_REQUIREMENTS_CLARIFIED.md IMPLEMENTATION_*.md \
      LIVE_USER_ENROLLMENT_CHECKLIST.md M3_UPGRADE_PLAN.md \
      MEDIUM_PRIORITY_FIXES_COMPLETE.md MIGRATION_TEST_REPORT_*.md \
      MODULE_WELCOME_MESSAGE.md NAVIGATION_CONSOLIDATION_COMPLETE.md \
      NUDGE_*.md PER_USER_NUDGE_GUARANTEE.md PHASE_1_2_IMPACT_ANALYSIS.md \
      PROJECT_FILE_AUDIT.md PROMPT_INJECTION_DEPLOYMENT_REPORT.md \
      QUIZ_COMPLETION_TRACKING.md QUIZ_UPLOAD_FEATURE.md \
      REPO_HYGIENE_AUDIT.md REQUIREMENTS_CONFIRMED_*.md \
      SESSION_*.md SIDEBAR_*.md SOLID_REFACTORING_SUMMARY.md \
      VALIDATED_SAFE_DELETE_LIST.md harassment-sexual-*.md \
      GCP_HTTPS_DOMAIN_SETUP.md HTTPS_SETUP_CHECKLIST.md \
      WHATSAPP_*.md 2>/dev/null || true
echo "✅ Removed superseded documentation"

echo ""
echo "Phase 7: Old E2E tests..."
rm -f tests/e2e/admin-portal-endurance*.spec.js \
      tests/e2e/coaching-analytics-navigation.spec.js \
      tests/e2e/content-moderation.spec.js \
      tests/e2e/course-detail-module-check.spec.js \
      tests/e2e/fresh-course-test.spec.js \
      tests/e2e/module-chat-production.spec.js \
      tests/e2e/upload-and-test-ai.spec.js \
      tests/e2e/upload-production-quiz.spec.js \
      tests/e2e/view-modules.spec.js 2>/dev/null || true
echo "✅ Removed old E2E tests"

echo ""
echo "Phase 8: Report investigation..."
rm -rf report_investigation/ 2>/dev/null || true
echo "✅ Removed report_investigation directory"

echo ""
echo "Phase 9: Old migrations..."
rm -f database/migration_*.sql database/fix_*.sql \
      database/quiz-questions.sql database/seed_*.sql \
      database/migrations/001_*.sql database/migrations/004_*.sql \
      database/migrations/005_*.sql database/migrations/007_*.sql \
      database/migrations/008_*.sql database/migrations/009_*.sql \
      database/migrations/010_create_conversation_context.sql \
      database/migrations/010_create_rbac_tables.sql \
      cleanup-duplicate-uploads.sql fix-enrollment-*.sql 2>/dev/null || true
rm -rf migrations/ 2>/dev/null || true
echo "✅ Removed old migrations"

echo ""
echo "Phase 10: Unused services..."
rm -f services/event-processor.service.js services/moodle-*.service.js \
      services/orchestrator.service.js services/whatsapp.service.js 2>/dev/null || true
echo "✅ Removed unused services"

echo ""
echo "Phase 11: Unused HTML..."
rm -f public/admin/lms-dashboard.html public/user-login.html \
      public/user-progress.html 2>/dev/null || true
echo "✅ Removed unused HTML"

echo ""
echo "Phase 12: Old scripts..."
rm -f scripts/create-course-and-modules.js scripts/deploy-to-gcp.sh \
      scripts/run-migration.js scripts/setup-token-refresh-cron.sh 2>/dev/null || true
echo "✅ Removed old scripts"

echo ""
echo "✨ Cleanup complete!"
echo ""
echo "📊 Summary:"
git status --short | wc -l | xargs -I {} echo "  {} files changed"
echo ""
echo "Next steps:"
echo "  1. Review: git status"
echo "  2. Review: git diff"
echo "  3. Commit: git add -A && git commit -m 'chore: Repository cleanup - remove non-essential files'"
echo "  4. Push: git push origin feature/multi-region-rbac"
