#!/bin/bash

# Run 120-Minute Comprehensive Admin Portal Endurance Test
# Tests ALL admin portal features with realistic user simulation

echo "🚀 Starting 120-Minute Comprehensive Admin Portal Endurance Test"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "⏱️  Duration: 120 minutes (2 hours)"
echo "🎯 Coverage: ALL Admin Portal Features"
echo ""
echo "📋 Features Being Tested:"
echo "   ✓ LMS Dashboard (metrics, stats, navigation)"
echo "   ✓ Course Management (list, detail, file uploads)"
echo "   ✓ Module Management (list, detail, create)"
echo "   ✓ User Management (list, detail, admin users)"
echo "   ✓ Quiz Functionality (questions, answers)"
echo "   ✓ AI Chat Assistant (v1 & v2, RAG-powered)"
echo "   ✓ Moodle Settings (configuration)"
echo "   ✓ Navigation & Theme (breadcrumbs, styling)"
echo ""
echo "🎭 Realistic User Simulation:"
echo "   - Mouse movements and hovers"
echo "   - Natural typing patterns"
echo "   - Tab/Shift+Tab keyboard navigation"
echo "   - Scroll behaviors"
echo "   - Human-like delays (1.5-4 seconds)"
echo ""
echo "👻 Mode: Headless (no visible browser)"
echo ""
echo "📊 Output: endurance-test-comprehensive.log"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Starting test... (This will take 2 hours)"
echo ""

# Run the Playwright test in headless mode (default)
npx playwright test tests/e2e/admin-portal-endurance-comprehensive.spec.js \
  --project=chromium \
  > endurance-test-comprehensive.log 2>&1

# Show completion message
if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Comprehensive endurance test complete!"
  echo ""
  echo "📊 View results: endurance-test-comprehensive.log"
  echo ""
  echo "📈 Summary:"
  tail -30 endurance-test-comprehensive.log | grep -A 20 "COMPREHENSIVE ENDURANCE TEST COMPLETE"
  echo ""
else
  echo ""
  echo "⚠️ Endurance test encountered issues."
  echo ""
  echo "📋 Check log for details: endurance-test-comprehensive.log"
  echo ""
  echo "🔍 Last 20 lines of log:"
  tail -20 endurance-test-comprehensive.log
  echo ""
fi
