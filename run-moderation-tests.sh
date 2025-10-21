#!/bin/bash

# Test Content Moderation System
# Tests profanity, violence, threats, suicide detection
# Tests database logging and UI integration

echo "🛡️ Running Content Moderation Tests"
echo "====================================="
echo ""
echo "Testing:"
echo "  - Profanity filtering"
echo "  - Suicide/self-harm detection"
echo "  - Violence/threats detection"
echo "  - Educational context preservation"
echo "  - Database logging"
echo "  - UI integration"
echo ""

TEST_BASE_URL=http://localhost:3000 \
npx playwright test tests/e2e/content-moderation.spec.js \
  --project=chromium \
  --workers=1 \
  --reporter=list

echo ""
echo "✅ Moderation tests complete!"
