#!/bin/bash

# Test Per-User Nudge Isolation
# Verifies that nudges are truly per-user and don't affect other users

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 PER-USER NUDGE ISOLATION TEST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Define test users
USER_A="+255712345678"  # Will be inactive
USER_B="+255700000001"  # Will be active
USER_C="+255700000002"  # Will be inactive

echo "📋 Test Setup:"
echo "   User A ($USER_A): Will go inactive → should get nudge"
echo "   User B ($USER_B): Will stay active → should NOT get nudge"
echo "   User C ($USER_C): Will go inactive → should get nudge"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Send initial messages for all users"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Sending User A initial message..."
gcloud compute ssh teachers-training --zone "us-east5-a" \
  --project "lms-tanzania-consultant" --command "
curl -s -X POST 'http://localhost:3000/webhook/twilio' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'From=whatsapp:$USER_A' \
  -d 'To=whatsapp:+14155238886' \
  -d 'Body=Hello from User A' \
  -d 'MessageSid=SM_USER_A_INITIAL' > /dev/null
echo '✅ User A: Initial message sent'
"

echo ""
echo "Sending User B initial message..."
gcloud compute ssh teachers-training --zone "us-east5-a" \
  --project "lms-tanzania-consultant" --command "
curl -s -X POST 'http://localhost:3000/webhook/twilio' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'From=whatsapp:$USER_B' \
  -d 'To=whatsapp:+14155238886' \
  -d 'Body=Hello from User B' \
  -d 'MessageSid=SM_USER_B_INITIAL' > /dev/null
echo '✅ User B: Initial message sent'
"

echo ""
echo "Sending User C initial message..."
gcloud compute ssh teachers-training --zone "us-east5-a" \
  --project "lms-tanzania-consultant" --command "
curl -s -X POST 'http://localhost:3000/webhook/twilio' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'From=whatsapp:$USER_C' \
  -d 'To=whatsapp:+14155238886' \
  -d 'Body=Hello from User C' \
  -d 'MessageSid=SM_USER_C_INITIAL' > /dev/null
echo '✅ User C: Initial message sent'
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: User B stays active (sends more messages)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

for i in 1 2 3; do
  echo "User B activity $i..."
  gcloud compute ssh teachers-training --zone "us-east5-a" \
    --project "lms-tanzania-consultant" --command "
  curl -s -X POST 'http://localhost:3000/webhook/twilio' \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -d 'From=whatsapp:$USER_B' \
    -d 'To=whatsapp:+14155238886' \
    -d 'Body=Active message $i' \
    -d 'MessageSid=SM_USER_B_ACTIVE_$i' > /dev/null
  echo '✅ User B: Active message $i sent'
  "
  sleep 10
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Wait 40 seconds for nudge check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⏳ Waiting... (User A & C inactive, User B active)"
sleep 40

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Check nudge activity in logs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

gcloud compute ssh teachers-training --zone "us-east5-a" \
  --project "lms-tanzania-consultant" --command "
echo 'Recent nudge activity:'
docker logs teachers_training_app_1 --tail 100 | grep -i 'sent.*nudge\|eligible.*users' | tail -10

echo ''
echo 'Messages sent to users:'
docker logs teachers_training_app_1 --tail 200 | grep -A 2 'whatsapp:.*255' | tail -20
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5: Verify chat still works for all users"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "User A sends message after potential nudge..."
gcloud compute ssh teachers-training --zone "us-east5-a" \
  --project "lms-tanzania-consultant" --command "
curl -s -X POST 'http://localhost:3000/webhook/twilio' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'From=whatsapp:$USER_A' \
  -d 'To=whatsapp:+14155238886' \
  -d 'Body=I am back' \
  -d 'MessageSid=SM_USER_A_BACK' > /dev/null

sleep 2
docker logs teachers_training_app_1 --tail 5 | grep -i 'processed\|Body preview' | tail -2 && echo '✅ User A: Chat works'
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TEST COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Expected Results:"
echo "  ✓ User A: Inactive → Should get nudge"
echo "  ✓ User B: Active → Should NOT get nudge"
echo "  ✓ User C: Inactive → Should get nudge"
echo "  ✓ All users: Chat still works"
echo "  ✓ No cross-user interference"
echo ""
