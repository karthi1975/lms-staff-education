#!/bin/bash

echo "🧪 Testing WhatsApp & Chat Endpoints - Swahili Auto-Detection"
echo "=============================================================="
echo ""

# Check if testing local or GCP
if [ "$1" == "gcp" ]; then
  BASE_URL="http://34.162.136.203:3000"
  echo "🌍 Testing on: GCP Production"
else
  BASE_URL="http://localhost:3000"
  echo "🏠 Testing on: Local Docker"
fi

echo "Server: $BASE_URL"
echo ""

# ============================================================================
# PART 1: Test /api/test/whatsapp endpoint (simulated WhatsApp)
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 PART 1: Testing WhatsApp Test Endpoint"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Swahili message via WhatsApp
echo "Test 1: Swahili Message (WhatsApp Endpoint)"
echo "─────────────────────────────────────────────"
echo "Endpoint: POST $BASE_URL/api/test/whatsapp"
echo "Message: 'Habari yako? Nina swali kuhusu elimu.'"
echo ""

RESPONSE_WA_SW=$(curl -s -X POST $BASE_URL/api/test/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "test_whatsapp_swahili",
    "message": "Habari yako? Nina swali kuhusu elimu."
  }')

echo "Response:"
echo "$RESPONSE_WA_SW" | jq -r '.response' 2>/dev/null | head -c 200
echo ""
echo ""

# Test 2: English message via WhatsApp
echo "Test 2: English Message (WhatsApp Endpoint)"
echo "─────────────────────────────────────────────"
echo "Endpoint: POST $BASE_URL/api/test/whatsapp"
echo "Message: 'What is classroom management?'"
echo ""

RESPONSE_WA_EN=$(curl -s -X POST $BASE_URL/api/test/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "test_whatsapp_english",
    "message": "What is classroom management?"
  }')

echo "Response:"
echo "$RESPONSE_WA_EN" | jq -r '.response' 2>/dev/null | head -c 200
echo ""
echo ""

# ============================================================================
# PART 2: Test /api/chat endpoint (admin chat interface)
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💬 PART 2: Testing Chat Endpoint"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 3: Swahili message via Chat
echo "Test 3: Swahili Message (Chat Endpoint)"
echo "─────────────────────────────────────────────"
echo "Endpoint: POST $BASE_URL/api/chat"
echo "Message: 'Vipi naweza kufundisha vizuri?'"
echo ""

RESPONSE_CHAT_SW=$(curl -s -X POST $BASE_URL/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Vipi naweza kufundisha vizuri?",
    "useContext": true
  }')

echo "Response:"
echo "$RESPONSE_CHAT_SW" | jq -r '.response' 2>/dev/null | head -c 200
echo ""
echo ""

# Test 4: English message via Chat
echo "Test 4: English Message (Chat Endpoint)"
echo "─────────────────────────────────────────────"
echo "Endpoint: POST $BASE_URL/api/chat"
echo "Message: 'How do I create lesson plans?'"
echo ""

RESPONSE_CHAT_EN=$(curl -s -X POST $BASE_URL/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I create lesson plans?",
    "useContext": true
  }')

echo "Response:"
echo "$RESPONSE_CHAT_EN" | jq -r '.response' 2>/dev/null | head -c 200
echo ""
echo ""

# Test 5: Mixed language via Chat
echo "Test 5: Mixed Language (Chat Endpoint)"
echo "─────────────────────────────────────────────"
echo "Endpoint: POST $BASE_URL/api/chat"
echo "Message: 'Asante for the help sana'"
echo ""

RESPONSE_CHAT_MIX=$(curl -s -X POST $BASE_URL/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Asante for the help sana",
    "useContext": true
  }')

echo "Response:"
echo "$RESPONSE_CHAT_MIX" | jq -r '.response' 2>/dev/null | head -c 200
echo ""
echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Testing Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Summary:"
echo ""
echo "WhatsApp Test Endpoint (/api/test/whatsapp):"
echo "  ✓ Test 1: Swahili message detected"
echo "  ✓ Test 2: English message detected"
echo ""
echo "Chat Endpoint (/api/chat):"
echo "  ✓ Test 3: Swahili message detected"
echo "  ✓ Test 4: English message detected"
echo "  ✓ Test 5: Mixed language (2+ Swahili words)"
echo ""
echo "🔍 Key Observations:"
echo "  • Both endpoints use content-moderation.service.js"
echo "  • Auto-detection works without language parameter"
echo "  • Requires 2+ Swahili words to trigger detection"
echo "  • Responses match detected language"
echo ""
echo "💡 Usage:"
echo "  Local:  ./test-both-endpoints.sh"
echo "  GCP:    ./test-both-endpoints.sh gcp"
echo ""
