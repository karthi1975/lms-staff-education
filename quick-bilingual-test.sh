#!/bin/bash

# Quick Bilingual Test for Business Studies
# Just run: ./quick-bilingual-test.sh

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌍 QUICK BILINGUAL TEST"
echo "   Business Studies Orientation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: English
echo "1️⃣  Sending ENGLISH query: 'Tell me about entrepreneurship'"
gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant" --command "
curl -s -X POST 'http://localhost:3000/webhook/twilio' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'From=whatsapp:+255712345678' \
  -d 'To=whatsapp:+14155238886' \
  -d 'Body=Tell me about entrepreneurship' \
  -d 'MessageSid=SM_QUICK_EN' > /dev/null
echo '✅ Sent'
"
sleep 5

# Test 2: Swahili
echo ""
echo "2️⃣  Sending SWAHILI query: 'Niambie kuhusu ujasiriamali'"
gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant" --command "
curl -s -X POST 'http://localhost:3000/webhook/twilio' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'From=whatsapp:+255712345678' \
  -d 'To=whatsapp:+14155238886' \
  -d 'Body=Niambie kuhusu ujasiriamali' \
  -d 'MessageSid=SM_QUICK_SW' > /dev/null
echo '✅ Sent'
"
sleep 5

# Show results
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 RESULTS (last 2 messages sent):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant" --command "
docker logs teachers_training_app_1 2>&1 | tail -100 | grep -B 1 'Body preview:' | tail -20
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TEST COMPLETE"
echo ""
echo "💡 To verify bilingual working:"
echo "   - Look for 'Body preview:' lines above"
echo "   - First response should be in ENGLISH"
echo "   - Second response should be in SWAHILI"
echo "   - Both should mention entrepreneurship/ujasiriamali"
echo ""
