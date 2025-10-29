#!/bin/bash

# Run 120-minute Admin Portal Endurance Test (Headless)
# Runs in background without visible browser

echo "🤖 Starting 120-Minute Admin Portal Endurance Test (Headless)"
echo "══════════════════════════════════════════════════════════════"
echo ""
echo "⏱️  Duration: 120 minutes"  
echo "🔄 Action delay: 5 seconds"
echo "📄 Page load delay: 5 seconds"
echo "👻 Mode: Headless (no visible browser)"
echo ""
echo "Output will be logged to: endurance-test.log"
echo ""

TEST_BASE_URL=http://34.162.136.203:3000 \
npx playwright test tests/e2e/admin-portal-endurance.spec.js \
  --project=chromium \
  --workers=1 \
  --reporter=list \
  2>&1 | tee endurance-test.log

echo ""
echo "✅ Endurance test complete! Check endurance-test.log for details."
