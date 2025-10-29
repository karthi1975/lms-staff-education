#!/bin/bash

# Run Module Chat Assistant test in visible mode with slow motion
# This allows you to see the chat interaction happening in real-time

echo "🎭 Running Module Chat Assistant test in VISUAL mode..."
echo "   - Browser window will open"
echo "   - Actions will be slowed down (300ms per action)"
echo "   - You can watch the chat interaction happen"
echo ""

TEST_BASE_URL=http://34.162.136.203:3000 \
npx playwright test tests/e2e/module-chat-production.spec.js \
  --project=chromium \
  --headed \
  --slow-mo=300 \
  --workers=1

echo ""
echo "✅ Visual test complete!"
