#!/bin/bash

echo "🧪 Swahili Auto-Detection Test Suite"
echo "====================================="
echo ""

# Test 1: Pure Swahili message (should auto-detect)
echo "📝 Test 1: Pure Swahili Message (NO language parameter)"
echo "Message: 'Habari yako? Nina swali kuhusu elimu.'"
echo "Expected: Auto-detect Swahili → Respond in Swahili"
echo ""
curl -s -X POST http://localhost:3000/api/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "test_autodetect_001",
    "message": "Habari yako? Nina swali kuhusu elimu."
  }' | jq -r '.response' || echo "Error: Could not connect to local server"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 2: Pure English message (should default to English)
echo "📝 Test 2: Pure English Message (NO language parameter)"
echo "Message: 'Hello, I have a question about teaching.'"
echo "Expected: Default to English → Respond in English"
echo ""
curl -s -X POST http://localhost:3000/api/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "test_autodetect_002",
    "message": "Hello, I have a question about teaching."
  }' | jq -r '.response' || echo "Error: Could not connect to local server"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 3: Mixed Swahili-English (should detect Swahili)
echo "📝 Test 3: Mixed Message with Swahili Indicators"
echo "Message: 'Asante for the help sana'"
echo "Expected: Auto-detect Swahili (2 words: asante, sana)"
echo ""
curl -s -X POST http://localhost:3000/api/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "test_autodetect_003",
    "message": "Asante for the help sana"
  }' | jq -r '.response' || echo "Error: Could not connect to local server"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 4: Educational question in Swahili
echo "📝 Test 4: Educational Question in Swahili"
echo "Message: 'Vipi naweza kuboresha classroom management?'"
echo "Expected: Auto-detect Swahili → Educational response in Swahili"
echo ""
curl -s -X POST http://localhost:3000/api/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "test_autodetect_004",
    "message": "Vipi naweza kuboresha classroom management?"
  }' | jq -r '.response' || echo "Error: Could not connect to local server"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 5: Only 1 Swahili word (should NOT auto-detect)
echo "📝 Test 5: Single Swahili Word (False Positive Protection)"
echo "Message: 'Nina is a nice teacher' (only 1 word: nina)"
echo "Expected: Default to English (needs 2+ words)"
echo ""
curl -s -X POST http://localhost:3000/api/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "test_autodetect_005",
    "message": "Nina is a nice teacher"
  }' | jq -r '.response' || echo "Error: Could not connect to local server"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "✅ All auto-detection tests complete!"
echo ""
echo "💡 Key Observations:"
echo "  - Tests 1, 3, 4: Should respond in Swahili (2+ indicators found)"
echo "  - Tests 2, 5: Should respond in English (< 2 indicators)"
echo "  - NO language parameter needed in any request"
echo "  - System automatically detects and responds appropriately"
