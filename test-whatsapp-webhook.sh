#!/bin/bash

echo "🧪 Testing WhatsApp Webhook with Swahili Auto-Detection"
echo "========================================================"
echo ""

BASE_URL="${1:-http://localhost:3000}"
echo "Testing on: $BASE_URL"
echo ""

# Test 1: Swahili message via WhatsApp webhook
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: Swahili Message (WhatsApp Webhook)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Endpoint: POST $BASE_URL/webhook/twilio"
echo "Message: 'Habari yako? Nina swali kuhusu elimu.'"
echo "Format: application/x-www-form-urlencoded (Twilio format)"
echo ""

curl -X POST $BASE_URL/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+255700111222" \
  -d "Body=Habari yako? Nina swali kuhusu elimu."

echo ""
echo ""

# Test 2: English message via WhatsApp webhook
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: English Message (WhatsApp Webhook)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Endpoint: POST $BASE_URL/webhook/twilio"
echo "Message: 'What is classroom management?'"
echo ""

curl -X POST $BASE_URL/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+255700333444" \
  -d "Body=What is classroom management?"

echo ""
echo ""

# Test 3: Mixed language
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 3: Mixed Language (WhatsApp Webhook)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Endpoint: POST $BASE_URL/webhook/twilio"
echo "Message: 'Asante for the help sana'"
echo ""

curl -X POST $BASE_URL/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+255700555666" \
  -d "Body=Asante for the help sana"

echo ""
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Tests Complete!"
echo ""
echo "📝 Note: Responses are sent asynchronously via Twilio."
echo "   Check your WhatsApp or Docker logs to see the responses:"
echo "   docker logs -f teachers_training_app_1 | grep -A5 'Education'"
echo ""
echo "💡 How It Works:"
echo "  1. Webhook receives URL-encoded Twilio payload"
echo "  2. Extracts 'From' (phone) and 'Body' (message)"
echo "  3. Auto-detects Swahili (2+ words trigger)"
echo "  4. Processes with education flow"
echo "  5. Sends response back via Twilio WhatsApp API"
echo ""
