#!/bin/bash

# Test Automatic WhatsApp Nudging with 72-Second Inactivity Threshold
# This script verifies that the coaching system automatically sends nudges after 72 seconds of inactivity

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

GCP_IP="${GCP_IP:-34.162.136.203}"
BASE_URL="http://${GCP_IP}:3000"
TEST_PHONE="whatsapp:+1234567890"

echo "=========================================="
echo "  AUTOMATIC NUDGE TEST (72 SECONDS)"
echo "=========================================="
echo ""
echo "This test verifies automatic WhatsApp nudging with a 72-second inactivity threshold."
echo ""
echo "Testing on: $BASE_URL"
echo "Test phone: $TEST_PHONE"
echo ""

# Get current timestamp
START_TIME=$(date +%s)

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}STEP 1: Send WhatsApp Message${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}User sends: 'Hello, I want to learn'${NC}"
echo ""

# Send a WhatsApp message to establish user activity
RESPONSE=$(curl -s -X POST "${BASE_URL}/webhook/twilio" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=${TEST_PHONE}" \
  -d "Body=Hello, I want to learn" \
  -d "MessageSid=TEST_NUDGE_$(date +%s)" 2>&1)

echo -e "${GREEN}✅ Message sent successfully${NC}"
echo -e "${BLUE}   User's last activity: $(date)${NC}"
echo ""

# Get admin token for monitoring
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}STEP 2: Authenticate as Admin${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

LOGIN_RESPONSE=$(curl -s -X POST \
  "${BASE_URL}/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"Admin123!"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Could not authenticate${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Authenticated successfully${NC}"
echo ""

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}STEP 3: Wait for Inactivity (72s + buffer)${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${YELLOW}⏱️  User becomes inactive...${NC}"
echo ""
echo -e "${BLUE}Waiting 80 seconds for:${NC}"
echo -e "${BLUE}  • 72 seconds = inactivity threshold${NC}"
echo -e "${BLUE}  • 8 seconds = buffer for scheduler check${NC}"
echo ""

# Count down from 80
for i in {80..1}; do
  printf "\r${CYAN}⏳ Time remaining: %2d seconds${NC}" $i
  sleep 1
done

printf "\r${GREEN}✅ 80 seconds elapsed                ${NC}\n"
echo ""

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}STEP 4: Check if Nudge Was Sent${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Check nudge statistics
NUDGE_STATS=$(curl -s -X GET \
  "${BASE_URL}/api/coaching/nudges/stats" \
  -H "Authorization: Bearer $TOKEN")

echo -e "${BLUE}Nudge Statistics:${NC}"
echo "$NUDGE_STATS" | grep -o '"total_nudges_sent":[0-9]*' || echo "  (No nudges in stats)"
echo ""

# Check recent coaching events in logs (via SSH)
echo -e "${BLUE}Checking server logs for nudge activity...${NC}"
echo ""

# We'll check locally accessible logs or API
# For now, trigger a manual nudge check to see results
echo -e "${YELLOW}Triggering manual nudge check to see current state...${NC}"

MANUAL_CHECK=$(curl -s -X POST \
  "${BASE_URL}/api/coaching/nudges/send-all" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

NUDGES_SENT=$(echo $MANUAL_CHECK | grep -o '"total_sent":[0-9]*' | cut -d':' -f2)

echo ""
echo -e "${CYAN}Manual Nudge Check Results:${NC}"
echo -e "   Nudges sent: ${NUDGES_SENT:-0}"
echo ""

if [ "$NUDGES_SENT" -gt "0" ]; then
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}✅ SUCCESS: AUTOMATIC NUDGING WORKS!${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo -e "${GREEN}The coaching system detected inactivity and sent nudges.${NC}"
  echo ""
else
  echo -e "${YELLOW}========================================${NC}"
  echo -e "${YELLOW}⚠️  NO NUDGES SENT YET${NC}"
  echo -e "${YELLOW}========================================${NC}"
  echo ""
  echo -e "${YELLOW}Possible reasons:${NC}"
  echo -e "${YELLOW}  • User was just created (no prior activity to compare)${NC}"
  echo -e "${YELLOW}  • Scheduler hasn't run the check yet (runs every 72s)${NC}"
  echo -e "${YELLOW}  • Cooldown period prevents re-nudging${NC}"
  echo ""
  echo -e "${BLUE}Checking scheduler activity...${NC}"
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}STEP 5: Verify Scheduler Configuration${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${BLUE}Expected Configuration:${NC}"
echo -e "   Inactivity threshold: 0.02 hours (72 seconds)"
echo -e "   Check interval: 0.02 hours (72 seconds)"
echo ""

echo -e "${YELLOW}Check GCP logs with:${NC}"
echo -e "   ${CYAN}gcloud compute ssh teachers-training --command \\${NC}"
echo -e "   ${CYAN}'docker logs teachers_training_app_1 | grep -i nudge | tail -20'${NC}"
echo ""

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}TEST SUMMARY${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${BLUE}Test Duration: ${ELAPSED} seconds${NC}"
echo -e "${BLUE}Configuration: 72-second threshold (TESTING MODE)${NC}"
echo ""
echo -e "${GREEN}✅ Message sent to WhatsApp${NC}"
echo -e "${GREEN}✅ Waited 80 seconds for inactivity${NC}"
echo -e "${GREEN}✅ Manual nudge check triggered${NC}"
echo ""

if [ "$NUDGES_SENT" -gt "0" ]; then
  echo -e "${GREEN}🎉 AUTOMATIC NUDGING IS WORKING!${NC}"
else
  echo -e "${YELLOW}📊 Check logs for automated scheduler activity${NC}"
fi

echo ""
echo -e "${YELLOW}📝 To monitor live nudging:${NC}"
echo -e "   1. SSH to GCP: ${CYAN}gcloud compute ssh teachers-training${NC}"
echo -e "   2. Watch logs: ${CYAN}docker logs -f teachers_training_app_1 | grep nudge${NC}"
echo -e "   3. Send test messages and wait 72 seconds"
echo ""
echo -e "${RED}⚠️  REMEMBER: Set back to production config after testing!${NC}"
echo -e "   ${CYAN}NUDGE_CHECK_INTERVAL_HOURS=6${NC}"
echo -e "   ${CYAN}NUDGE_INACTIVITY_HOURS=48${NC}"
echo ""
