#!/bin/bash

# Run 120-minute Admin Portal Endurance Test
# Tests all admin features with 5-second delays

echo "🎭 Starting 120-Minute Admin Portal Endurance Test"
echo "════════════════════════════════════════════════════"
echo ""
echo "⏱️  Duration: 120 minutes"
echo "🔄 Action delay: 5 seconds"
echo "📄 Page load delay: 5 seconds"
echo "👀 Mode: Headed (visible browser)"
echo "🐌 Slow motion: 500ms per action"
echo ""
echo "Features tested:"
echo "  1. Dashboard"
echo "  2. Course Management"
echo "  3. User Management"
echo "  4. Module Chat with RAG"
echo "  5. Content Section"
echo "  6. Module Management"
echo "  7. Settings/Communication"
echo ""
echo "Press Ctrl+C to stop the test at any time"
echo ""

TEST_BASE_URL=http://34.162.136.203:3000 \
npx playwright test tests/e2e/admin-portal-endurance.spec.js \
  --project=chromium \
  --headed \
  --slow-mo=500 \
  --workers=1 \
  --reporter=list

echo ""
echo "✅ Endurance test complete!"
