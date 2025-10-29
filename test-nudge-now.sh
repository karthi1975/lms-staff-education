#!/bin/bash
# Test nudge delivery with 1-minute inactivity threshold
# This script sends a message and then monitors for the nudge

set -e

GCP_IP="34.162.168.124"
PHONE="whatsapp:+255712345678"  # Your test phone number
BOT_NUMBER="whatsapp:+14155238886"

echo "🧪 Nudge Test - 1 Minute Inactivity"
echo "===================================="
echo ""

echo "📱 Step 1: Sending message to trigger activity update..."
curl -s -X POST "http://${GCP_IP}:3000/webhook/twilio" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=${PHONE}" \
  -d "To=${BOT_NUMBER}" \
  -d "Body=Hello, I want to learn about entrepreneurship" \
  -d "MessageSid=SM_NUDGE_TEST_$(date +%s)" > /dev/null

echo "✅ Message sent at $(date '+%H:%M:%S')"
echo ""

echo "⏰ Step 2: Waiting 1 minute for inactivity threshold..."
echo "   (You will be considered inactive after 1 minute)"
echo ""

for i in {60..1}; do
  printf "\r   ⏳ Waiting... %02d seconds remaining" $i
  sleep 1
done
printf "\r   ✅ 1 minute elapsed - You are now inactive!              \n"
echo ""

echo "⏰ Step 3: Waiting for scheduler to detect inactivity..."
echo "   (Scheduler runs every 60 seconds, so max 1 minute wait)"
echo ""

for i in {60..1}; do
  printf "\r   ⏳ Waiting for nudge... %02d seconds" $i
  sleep 1
done
printf "\r   ✅ Check complete!                           \n"
echo ""

echo "📋 Step 4: Checking if nudge was sent..."
echo ""

gcloud compute ssh teachers-training --zone "us-east5-a" \
  --project "lms-tanzania-consultant" --command "
docker logs teachers_training_app_1 2>&1 | tail -50 | grep -A 2 -B 2 'Nudge sent successfully\|Sent.*inactivity nudges' | tail -15
" 2>&1 | grep -v ".zprofile"

echo ""
echo "===================================="
echo "📊 Test Complete!"
echo ""
echo "Expected outcome:"
echo "  - Your last_active_at was updated with the message"
echo "  - After 1 minute, you became inactive"
echo "  - Scheduler detected inactivity"
echo "  - 'welcome_back' nudge sent to your WhatsApp"
echo ""
echo "Check your WhatsApp for the nudge message!"
echo ""
echo "To run another test, wait 3 minutes (cooldown period) first."
echo "===================================="
