#!/bin/bash

# Simple Bilingual Test for Business Studies Orientation Course
# GCP Instance: http://34.162.168.124:3000

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌍 Business Studies Bilingual Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test user phone number
PHONE="+255712345678"

echo "1️⃣  Test: English - Ask about Business Studies"
echo "   Query: 'Tell me about Business Studies'"
echo ""

gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant" --command "
curl -s -X POST 'http://localhost:3000/webhook/twilio' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'From=whatsapp:$PHONE' \
  -d 'To=whatsapp:+14155238886' \
  -d 'Body=Tell me about Business Studies' \
  -d 'MessageSid=SM11111111111111111111111111111111' > /dev/null

sleep 4
docker logs teachers_training_app_1 --tail 10 | grep -A 2 'Body preview:' | tail -5
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "2️⃣  Test: Swahili - Ask about Business Studies"
echo "   Query: 'Niambie kuhusu Masomo ya Biashara'"
echo ""

gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant" --command "
curl -s -X POST 'http://localhost:3000/webhook/twilio' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'From=whatsapp:$PHONE' \
  -d 'To=whatsapp:+14155238886' \
  -d 'Body=Niambie kuhusu Masomo ya Biashara' \
  -d 'MessageSid=SM22222222222222222222222222222222' > /dev/null

sleep 4
docker logs teachers_training_app_1 --tail 10 | grep -A 2 'Body preview:' | tail -5
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "3️⃣  Test: English - Ask about Entrepreneurship"
echo "   Query: 'What is entrepreneurship?'"
echo ""

gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant" --command "
curl -s -X POST 'http://localhost:3000/webhook/twilio' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'From=whatsapp:$PHONE' \
  -d 'To=whatsapp:+14155238886' \
  -d 'Body=What is entrepreneurship?' \
  -d 'MessageSid=SM33333333333333333333333333333333' > /dev/null

sleep 5
docker logs teachers_training_app_1 --tail 10 | grep -A 2 'Body preview:' | tail -5
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "4️⃣  Test: Swahili - Ask about Entrepreneurship"
echo "   Query: 'Ujasiriamali ni nini?'"
echo ""

gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant" --command "
curl -s -X POST 'http://localhost:3000/webhook/twilio' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'From=whatsapp:$PHONE' \
  -d 'To=whatsapp:+14155238886' \
  -d 'Body=Ujasiriamali ni nini?' \
  -d 'MessageSid=SM44444444444444444444444444444444' > /dev/null

sleep 5
docker logs teachers_training_app_1 --tail 10 | grep -A 2 'Body preview:' | tail -5
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "5️⃣  Test: Mixed - Ask about Business Management"
echo "   Query: 'Je, naweza kujifunza business management?'"
echo ""

gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant" --command "
curl -s -X POST 'http://localhost:3000/webhook/twilio' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'From=whatsapp:$PHONE' \
  -d 'To=whatsapp:+14155238886' \
  -d 'Body=Je, naweza kujifunza business management?' \
  -d 'MessageSid=SM55555555555555555555555555555555' > /dev/null

sleep 5
docker logs teachers_training_app_1 --tail 10 | grep -A 2 'Body preview:' | tail -5
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Test Complete!"
echo ""
echo "💡 Tips:"
echo "   - English responses should be in English"
echo "   - Swahili responses should be in Swahili"
echo "   - Mixed queries should detect primary language"
echo "   - All responses should mention Business Studies content"
echo ""
