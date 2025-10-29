#!/bin/bash
# Test Twilio Webhook Endpoints from Console Screenshot

BASE_URL="http://34.162.168.124:3000"

echo "🔍 Verifying Twilio Webhook Endpoints from Console Screenshot"
echo "=============================================================="
echo ""
echo "WhatsApp Sender: +18065157636"
echo "Business Name: Educate"
echo ""

# Test 1: Primary webhook (from screenshot)
echo "### Test 1: Primary Webhook (from Twilio Console)"
echo "URL: ${BASE_URL}/webhook/twilio"
echo "Method: HTTP POST"
echo ""

RESPONSE1=$(curl -s -w "\n%{http_code}" -X POST ${BASE_URL}/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+18065157636&To=whatsapp:+255712345678&Body=Hello" 2>&1)

HTTP_CODE1=$(echo "$RESPONSE1" | tail -1)
RESPONSE_BODY1=$(echo "$RESPONSE1" | sed '$d')

if [ "$HTTP_CODE1" = "200" ]; then
  echo "✅ PASS: Endpoint responds HTTP 200"
  echo "   Response type: TwiML XML"
  if [[ "$RESPONSE_BODY1" == *"<?xml"* ]] || [[ "$RESPONSE_BODY1" == *"<Response"* ]]; then
    echo "   ✅ Valid TwiML response detected"
  fi
else
  echo "❌ FAIL: HTTP $HTTP_CODE1"
  echo "   Response: $RESPONSE_BODY1"
fi
echo ""

# Test 2: Fallback URL (from screenshot)
echo "### Test 2: Fallback URL (from Twilio Console)"
echo "URL: ${BASE_URL}/webhook/twilio/status"
echo "Method: HTTP POST"
echo ""

RESPONSE2=$(curl -s -w "\n%{http_code}" -X POST ${BASE_URL}/webhook/twilio/status \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "MessageSid=SM123456&MessageStatus=delivered&From=whatsapp:+18065157636" 2>&1)

HTTP_CODE2=$(echo "$RESPONSE2" | tail -1)
RESPONSE_BODY2=$(echo "$RESPONSE2" | sed '$d')

if [ "$HTTP_CODE2" = "200" ]; then
  echo "✅ PASS: Endpoint responds HTTP 200"
  echo "   Response: OK (status callback acknowledged)"
else
  echo "❌ FAIL: HTTP $HTTP_CODE2"
  echo "   Response: $RESPONSE_BODY2"
fi
echo ""

# Test 3: Check if endpoints are properly mounted
echo "### Test 3: Verify Routes in Server Code"
echo ""

# Check server.js for route mounting
if grep -q "twilioWebhookRoutes" /Users/karthi/business/staff_education/teachers_training/server.js; then
  echo "✅ twilio-webhook.routes.js is imported in server.js"
else
  echo "❌ twilio-webhook.routes.js NOT imported in server.js"
fi

if grep -q "app.use('/', twilioWebhookRoutes)" /Users/karthi/business/staff_education/teachers_training/server.js; then
  echo "✅ Webhook routes are mounted at root path ('/')"
else
  echo "❌ Webhook routes NOT mounted correctly"
fi
echo ""

# Test 4: Check route definitions
echo "### Test 4: Route Definitions in Code"
echo ""

if grep -q "router.post('/webhook/twilio'" /Users/karthi/business/staff_education/teachers_training/routes/twilio-webhook.routes.js; then
  echo "✅ POST /webhook/twilio route is defined"
else
  echo "❌ POST /webhook/twilio route NOT found"
fi

if grep -q "router.post('/webhook/twilio/status'" /Users/karthi/business/staff_education/teachers_training/routes/twilio-webhook.routes.js; then
  echo "✅ POST /webhook/twilio/status route is defined"
else
  echo "❌ POST /webhook/twilio/status route NOT found"
fi
echo ""

# Summary
echo "## Summary"
echo "========="
echo ""

if [ "$HTTP_CODE1" = "200" ] && [ "$HTTP_CODE2" = "200" ]; then
  echo "✅ ALL ENDPOINTS WORKING CORRECTLY!"
  echo ""
  echo "Your Twilio Console configuration is correct:"
  echo "  - Primary webhook: ${BASE_URL}/webhook/twilio ✅"
  echo "  - Fallback URL: ${BASE_URL}/webhook/twilio/status ✅"
  echo ""
  echo "⚠️  RECOMMENDATION:"
  echo "  Update 'Status callback URL' in Twilio Console from:"
  echo "    https://example.com/status_callback"
  echo "  To:"
  echo "    ${BASE_URL}/webhook/twilio/status"
  echo ""
  echo "This will enable delivery status tracking for sent messages."
else
  echo "❌ SOME ENDPOINTS HAVE ISSUES"
  echo ""
  echo "Primary webhook: $([ "$HTTP_CODE1" = "200" ] && echo "✅ Working" || echo "❌ Failed (HTTP $HTTP_CODE1)")"
  echo "Fallback URL: $([ "$HTTP_CODE2" = "200" ] && echo "✅ Working" || echo "❌ Failed (HTTP $HTTP_CODE2)")"
fi
echo ""

# Test on GCP server
echo "## Testing on GCP Server"
echo "========================"
echo ""
echo "Checking if endpoints respond on actual GCP instance..."
echo ""

GCP_TEST=$(curl -s -w "%{http_code}" -o /dev/null -X POST http://34.162.168.124:3000/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+18065157636&Body=test" --max-time 5 2>&1)

if [ "$GCP_TEST" = "200" ]; then
  echo "✅ GCP endpoint responds: HTTP 200"
  echo "   Your Twilio webhook is ready to receive messages!"
else
  echo "⚠️  GCP endpoint status: HTTP $GCP_TEST"
  echo "   This may be normal if testing from different network"
fi
