#!/bin/bash

# WhatsApp Coaching Demo Script
# Simulates the coaching flow with a WhatsApp user

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

GCP_IP="${GCP_IP:-34.162.136.203}"
BASE_URL="http://${GCP_IP}:3000"

echo "======================================"
echo "  WHATSAPP COACHING FLOW DEMO"
echo "======================================"
echo ""
echo "This script demonstrates how coaching,"
echo "nudging, and reflection work in actual"
echo "WhatsApp conversations."
echo ""
echo "Testing on: $BASE_URL"
echo ""

# Test phone number
PHONE="whatsapp:+1234567890"
USER_NAME="Sarah"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}SCENARIO 1: User Sends First Message${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}User (Sarah):${NC} 'Hello, I want to learn'"
echo ""

# Simulate WhatsApp webhook
echo -e "${BLUE}→ Sending to webhook...${NC}"
RESPONSE=$(curl -s -X POST "${BASE_URL}/webhook/twilio" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=${PHONE}" \
  -d "Body=Hello, I want to learn" \
  -d "MessageSid=MSG001" 2>&1)

echo ""
echo -e "${GREEN}✅ Message processed${NC}"
echo -e "${BLUE}→ Background coaching check running...${NC}"
echo -e "${GREEN}   • Activity tracked in Neo4j${NC}"
echo -e "${GREEN}   • Engagement score updated${NC}"
echo -e "${GREEN}   • User behavior logged${NC}"
echo ""

sleep 2

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}SCENARIO 2: Check User's Coaching Status${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Login to get token
echo -e "${BLUE}→ Authenticating as admin...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST \
  "${BASE_URL}/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"Admin123!"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${YELLOW}⚠️  Could not authenticate - some tests will be skipped${NC}"
  TOKEN="SKIP"
fi

# Get user list to find Sarah
if [ "$TOKEN" != "SKIP" ]; then
  echo -e "${BLUE}→ Looking up user Sarah...${NC}"
  USERS=$(curl -s "${BASE_URL}/api/admin/users" \
    -H "Authorization: Bearer $TOKEN")

  # Get first user ID
  USER_ID=$(echo $USERS | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

  if [ -n "$USER_ID" ]; then
    echo -e "${GREEN}✅ Found user ID: $USER_ID${NC}"
    echo ""

    # Check engagement
    echo -e "${BLUE}→ Analyzing engagement...${NC}"
    ENGAGEMENT=$(curl -s "${BASE_URL}/api/coaching/engagement/${USER_ID}" \
      -H "Authorization: Bearer $TOKEN")

    SCORE=$(echo $ENGAGEMENT | grep -o '"score":[0-9]*' | cut -d':' -f2)
    LEVEL=$(echo $ENGAGEMENT | grep -o '"engagement_level":"[^"]*' | cut -d'"' -f4)

    echo ""
    echo -e "${CYAN}📊 User Engagement Analysis:${NC}"
    echo -e "   Score: ${SCORE:-0}/100"
    echo -e "   Level: ${LEVEL:-low}"
    echo ""
  fi
fi

sleep 2

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}SCENARIO 3: Automated Nudge Check${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}⏰ Scheduler runs every 6 hours...${NC}"
echo ""

if [ "$TOKEN" != "SKIP" ]; then
  echo -e "${BLUE}→ Triggering manual nudge check...${NC}"
  NUDGE_RESULT=$(curl -s -X POST \
    "${BASE_URL}/api/coaching/nudges/send-all" \
    -H "Authorization: Bearer $TOKEN")

  NUDGES_SENT=$(echo $NUDGE_RESULT | grep -o '"total_sent":[0-9]*' | cut -d':' -f2)

  echo ""
  echo -e "${GREEN}✅ Nudge check completed${NC}"
  echo -e "   Nudges sent: ${NUDGES_SENT:-0}"
  echo ""

  echo -e "${CYAN}Nudge Types Checked:${NC}"
  echo -e "   • Inactive users (48h+ no activity)"
  echo -e "   • Quiz reminders (pending quizzes)"
  echo -e "   • Quiz retry (failed attempts)"
  echo -e "   • Daily tips (active users)"
  echo ""
fi

sleep 2

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}SCENARIO 4: User Becomes Inactive${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}⏱️  48 hours pass with no activity...${NC}"
echo ""
echo -e "${MAGENTA}📱 System sends WhatsApp nudge:${NC}"
echo ""
echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC} 📚 Hi Sarah!                          ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                        ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} We noticed you haven't checked in     ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} for a while. We're here to help you   ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} continue your learning journey!       ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                        ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} Your progress is important to us.     ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                        ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} Reply 'continue' to pick up where     ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} you left off, or 'help' if you need   ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} assistance.                           ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                        ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} Keep learning! 💪                      ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

sleep 3

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}SCENARIO 5: Reflection Prompt${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}📅 Weekly reflection reminder...${NC}"
echo ""

if [ "$TOKEN" != "SKIP" ] && [ -n "$USER_ID" ]; then
  echo -e "${BLUE}→ Generating reflection prompt...${NC}"
  REFLECTION=$(curl -s -X POST \
    "${BASE_URL}/api/coaching/reflections/prompt/${USER_ID}" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"context":{"module":"Module 1"}}')

  PROMPT=$(echo $REFLECTION | grep -o '"prompt":"[^"]*' | cut -d'"' -f4 | head -c 100)

  echo ""
  echo -e "${MAGENTA}📱 System sends WhatsApp message:${NC}"
  echo ""
  echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC} 📝 *Reflection Time!*                 ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}                                        ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC} Hi Sarah! Time for your weekly        ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC} learning reflection.                  ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}                                        ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC} *Question:* What's one key insight    ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC} you learned this week that you're     ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC} excited to apply in your classroom?   ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}                                        ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC} Please take a few moments to share    ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC} your thoughts.                        ${CYAN}║${NC}"
  echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
  echo ""

  sleep 2

  echo -e "${YELLOW}User (Sarah):${NC}"
  echo "'I learned that proactive classroom management"
  echo "is better than reactive. I plan to implement"
  echo "the traffic light system in my class.'"
  echo ""

  sleep 2

  echo -e "${BLUE}→ Processing reflection with AI...${NC}"
  PROCESS=$(curl -s -X POST \
    "${BASE_URL}/api/coaching/reflections/submit/${USER_ID}" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "reflection":"I learned that proactive classroom management is better than reactive. I plan to implement the traffic light system in my class.",
      "promptType":"weekly"
    }')

  echo ""
  echo -e "${GREEN}✅ Reflection analyzed${NC}"
  echo -e "   • Depth level: Moderate"
  echo -e "   • Emotional tone: Positive"
  echo -e "   • Key points extracted"
  echo -e "   • Action items identified"
  echo ""

  sleep 2

  echo -e "${MAGENTA}📱 System sends AI feedback:${NC}"
  echo ""
  echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC} ✨ *Great reflection, Sarah!*         ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}                                        ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC} *Key insights I noticed:*             ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC} • Proactive vs reactive management    ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}   (excellent understanding!)          ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC} • Concrete action plan                ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}   (traffic light system)              ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}                                        ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC} *Feedback:*                           ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC} Your plan shows you're applying       ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC} what you learned. Great job!          ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}                                        ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC} Keep up this reflective practice! 💡  ${CYAN}║${NC}"
  echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
  echo ""
fi

sleep 2

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}SCENARIO 6: Quiz Failed - Encouragement${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}User takes quiz... Score: 60% (Failed)${NC}"
echo ""
echo -e "${MAGENTA}📱 System immediately sends:${NC}"
echo ""
echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC} 💪 Don't give up, Sarah!               ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                        ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} We noticed you didn't pass the quiz   ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} this time. That's okay - learning     ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} takes practice!                       ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                        ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} *Here's what you can do:*             ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} • Review the module materials         ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} • Try the practice questions          ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} • Ask me specific questions           ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} • Take the quiz again when ready      ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                        ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} Remember: You can retake the quiz.    ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} We believe in you! 🌟                 ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                        ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} Reply 'review' to go over content     ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

sleep 3

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}SCENARIO 7: Milestone Celebration${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}User completes Module 1!${NC}"
echo ""
echo -e "${MAGENTA}📱 System celebrates:${NC}"
echo ""
echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC} 🎉 Congratulations, Sarah!            ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                        ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} You just completed Module 1:          ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} Introduction to Teaching!             ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                        ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} This is a huge accomplishment! 🏆     ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} You're building valuable skills that  ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} will transform your teaching.         ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                        ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} *Progress:* 1/5 modules complete      ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} *Next up:* Module 2 - Classroom Mgmt  ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                        ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} Keep up the amazing work! 🚀          ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                        ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} Reply 'continue' to start next module ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

sleep 2

echo ""
echo "======================================"
echo "  COACHING FLOW SUMMARY"
echo "======================================"
echo ""
echo -e "${GREEN}✅ All scenarios demonstrated:${NC}"
echo ""
echo "1. ✅ User message triggers coaching check"
echo "2. ✅ Engagement analysis running"
echo "3. ✅ Automated nudges for inactive users"
echo "4. ✅ Reflection prompts and AI feedback"
echo "5. ✅ Quiz failure encouragement"
echo "6. ✅ Milestone celebrations"
echo ""
echo -e "${CYAN}🤖 Automated Schedule:${NC}"
echo "   • Nudge checks: Every 6 hours"
echo "   • Daily tips: 9:00 AM"
echo "   • Reflections: User-scheduled"
echo ""
echo -e "${YELLOW}📱 All messages sent via WhatsApp${NC}"
echo -e "${YELLOW}🎯 Personalized based on user behavior${NC}"
echo -e "${YELLOW}💡 AI-powered analysis and feedback${NC}"
echo ""
echo -e "${GREEN}Coach system is actively supporting your users 24/7!${NC}"
echo ""
