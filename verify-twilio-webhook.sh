#!/bin/bash
# Verify Twilio Webhook Configuration

BASE_URL="http://34.162.168.124:3000"
GCP_URL="http://34.162.168.124:3000"

echo "🔍 Twilio Webhook Verification Report"
echo "======================================"
echo ""

echo "## 1. Webhook Endpoints Configuration"
echo ""
echo "✅ Primary Webhook:"
echo "   URL: ${GCP_URL}/webhook/twilio"
echo "   Method: POST"
echo "   Purpose: Receive incoming WhatsApp messages"
echo ""
echo "✅ Alternative (with trailing slash):"
echo "   URL: ${GCP_URL}/webhook/twilio/"
echo "   Method: POST"
echo ""
echo "✅ Status Callback:"
echo "   URL: ${GCP_URL}/webhook/twilio/status"
echo "   Method: POST"
echo "   Purpose: Receive message delivery status updates"
echo ""
echo "✅ Test Send Endpoint:"
echo "   URL: ${GCP_URL}/api/twilio/send"
echo "   Method: POST"
echo "   Purpose: Send test messages"
echo ""

echo "## 2. Testing Webhook Endpoints"
echo ""

# Test 1: Check if webhook endpoint responds
echo "### Test 1: Webhook Endpoint Accessibility"
WEBHOOK_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST ${BASE_URL}/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+1234567890&Body=test" 2>&1)

HTTP_CODE=$(echo "$WEBHOOK_RESPONSE" | tail -1)
RESPONSE_BODY=$(echo "$WEBHOOK_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Webhook endpoint responds: HTTP 200"
  echo "   Response: TwiML XML (expected)"
else
  echo "❌ Webhook endpoint issue: HTTP $HTTP_CODE"
  echo "   Response: $RESPONSE_BODY"
fi
echo ""

# Test 2: Check trailing slash variant
echo "### Test 2: Webhook with Trailing Slash"
WEBHOOK_SLASH_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST ${BASE_URL}/webhook/twilio/ \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+1234567890&Body=test" 2>&1)

HTTP_CODE_SLASH=$(echo "$WEBHOOK_SLASH_RESPONSE" | tail -1)

if [ "$HTTP_CODE_SLASH" = "200" ]; then
  echo "✅ Webhook with trailing slash responds: HTTP 200"
else
  echo "❌ Webhook with trailing slash issue: HTTP $HTTP_CODE_SLASH"
fi
echo ""

# Test 3: Check status callback
echo "### Test 3: Status Callback Endpoint"
STATUS_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST ${BASE_URL}/webhook/twilio/status \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "MessageSid=SM123&MessageStatus=delivered" 2>&1)

HTTP_CODE_STATUS=$(echo "$STATUS_RESPONSE" | tail -1)

if [ "$HTTP_CODE_STATUS" = "200" ]; then
  echo "✅ Status callback endpoint responds: HTTP 200"
else
  echo "❌ Status callback issue: HTTP $HTTP_CODE_STATUS"
fi
echo ""

echo "## 3. Twilio Console Configuration"
echo ""
echo "📝 Configure these URLs in Twilio Console:"
echo ""
echo "1. Go to: https://console.twilio.com/us1/develop/sms/settings/whatsapp-senders"
echo "2. Select your WhatsApp sender"
echo "3. Configure webhook:"
echo ""
echo "   **When a message comes in:**"
echo "   URL: ${GCP_URL}/webhook/twilio"
echo "   HTTP Method: POST"
echo ""
echo "   **Status callback URL (optional):**"
echo "   URL: ${GCP_URL}/webhook/twilio/status"
echo "   HTTP Method: POST"
echo ""

echo "## 4. Required Environment Variables"
echo ""
echo "Check .env file has:"
echo "  - TWILIO_ACCOUNT_SID=AC..."
echo "  - TWILIO_AUTH_TOKEN=..."
echo "  - TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886"
echo ""

echo "## 5. Webhook Security (Optional)"
echo ""
echo "⚠️  Current Status: Webhook signature validation disabled"
echo "    (For development/testing)"
echo ""
echo "📌 Production Recommendation:"
echo "   Enable Twilio signature validation in production"
echo "   Add: twilioSignature middleware to routes"
echo ""

echo "## 6. Testing from Twilio"
echo ""
echo "Send test message:"
echo "1. Open WhatsApp"
echo "2. Send to: whatsapp:+14155238886 (Twilio Sandbox)"
echo "3. Join code: join <your-sandbox-code>"
echo "4. Send any message"
echo "5. Check logs: docker logs teachers_training_app_1"
echo ""

echo "## Summary"
echo ""
if [ "$HTTP_CODE" = "200" ] && [ "$HTTP_CODE_SLASH" = "200" ] && [ "$HTTP_CODE_STATUS" = "200" ]; then
  echo "✅ All webhook endpoints are operational!"
  echo ""
  echo "Next steps:"
  echo "1. Configure Twilio Console with webhook URL"
  echo "2. Test by sending WhatsApp message"
  echo "3. Monitor logs for incoming messages"
else
  echo "⚠️  Some endpoints have issues. Review test results above."
fi
