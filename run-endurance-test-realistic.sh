#!/bin/bash

# Run 120-Minute Admin Portal Endurance Test with REALISTIC USER SIMULATION
# Includes mouse movements, natural typing, keyboard navigation, and human-like delays

echo "🤖 Starting 120-Minute Admin Portal Endurance Test (REALISTIC MODE)"
echo "══════════════════════════════════════════════════════════════"
echo ""
echo "⏱️  Duration: 120 minutes"
echo "🔄 Action delay: 5 seconds"
echo "📄 Page load delay: 5 seconds"
echo "👻 Mode: Headless (no visible browser)"
echo "🎭 Realistic user simulation:"
echo "   - Mouse movements and hovers"
echo "   - Natural typing patterns"
echo "   - Tab/Shift+Tab navigation"
echo "   - Scroll behaviors"
echo "   - Human-like delays"
echo ""
echo "Output will be logged to: endurance-test-realistic.log"
echo ""
echo ""

# Run the Playwright test in headless mode (default)
npx playwright test tests/e2e/admin-portal-endurance-realistic.spec.js \
  --project=chromium \
  > endurance-test-realistic.log 2>&1

# Show completion message
if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Endurance test complete! Check endurance-test-realistic.log for details."
  echo ""
else
  echo ""
  echo "⚠️ Endurance test encountered issues. Check endurance-test-realistic.log for details."
  echo ""
fi
