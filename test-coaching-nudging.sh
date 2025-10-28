#!/bin/bash

# Test Coaching & Nudging Features
# Tests all coaching, nudging, and reflection endpoints

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
API_BASE="${BASE_URL}/api/coaching"

echo "======================================"
echo "  COACHING & NUDGING TEST SUITE"
echo "======================================"
echo ""
echo "Base URL: $BASE_URL"
echo ""

# Step 1: Login to get token
echo -e "${YELLOW}Step 1: Authenticating...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST \
  "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"Admin123!"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Authenticated successfully${NC}"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Step 2: Get all users to test with
echo -e "${YELLOW}Step 2: Fetching users...${NC}"
USERS_RESPONSE=$(curl -s -X GET \
  "${BASE_URL}/api/admin/users" \
  -H "Authorization: Bearer $TOKEN")

USER_COUNT=$(echo $USERS_RESPONSE | grep -o '"id"' | wc -l)
echo -e "${GREEN}✅ Found $USER_COUNT users${NC}"

# Get first user ID for testing
USER_ID=$(echo $USERS_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
if [ -z "$USER_ID" ]; then
  echo -e "${RED}❌ No users found - please register a user first${NC}"
  exit 1
fi
echo "Testing with User ID: $USER_ID"
echo ""

# Test Section: NUDGING
echo "======================================"
echo "  TESTING NUDGING FEATURES"
echo "======================================"
echo ""

# Test 1: Get nudge statistics
echo -e "${YELLOW}Test 1: Get Nudge Statistics${NC}"
NUDGE_STATS=$(curl -s -X GET \
  "${API_BASE}/nudges/stats" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $NUDGE_STATS" | head -c 200
echo ""
if echo "$NUDGE_STATS" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ PASS: Nudge statistics retrieved${NC}"
else
  echo -e "${RED}❌ FAIL: Failed to get nudge statistics${NC}"
fi
echo ""

# Test 2: Send nudge to specific user
echo -e "${YELLOW}Test 2: Send Nudge to User $USER_ID${NC}"
SEND_NUDGE=$(curl -s -X POST \
  "${API_BASE}/nudges/send/${USER_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nudgeType":"welcome_back","variables":{"name":"Test User"}}')

echo "Response: $SEND_NUDGE"
if echo "$SEND_NUDGE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ PASS: Nudge sent successfully${NC}"
else
  echo -e "${YELLOW}⚠️  WARNING: Nudge may not have been sent (WhatsApp might not be configured)${NC}"
fi
echo ""

# Test 3: Send milestone celebration
echo -e "${YELLOW}Test 3: Send Milestone Celebration${NC}"
MILESTONE=$(curl -s -X POST \
  "${API_BASE}/nudges/milestone/${USER_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"milestone":"Completed first module!"}')

echo "Response: $MILESTONE"
if echo "$MILESTONE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ PASS: Milestone celebration sent${NC}"
else
  echo -e "${YELLOW}⚠️  WARNING: Milestone may not have been sent${NC}"
fi
echo ""

# Test 4: Trigger manual nudge check for all users
echo -e "${YELLOW}Test 4: Trigger Manual Nudge Check${NC}"
MANUAL_NUDGE=$(curl -s -X POST \
  "${API_BASE}/nudges/send-all" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $MANUAL_NUDGE" | head -c 300
echo ""
if echo "$MANUAL_NUDGE" | grep -q '"success":true'; then
  NUDGES_SENT=$(echo $MANUAL_NUDGE | grep -o '"total_sent":[0-9]*' | cut -d':' -f2)
  echo -e "${GREEN}✅ PASS: Manual nudge check completed (Sent: ${NUDGES_SENT:-0} nudges)${NC}"
else
  echo -e "${RED}❌ FAIL: Manual nudge check failed${NC}"
fi
echo ""

# Test Section: REFLECTIONS
echo "======================================"
echo "  TESTING REFLECTION FEATURES"
echo "======================================"
echo ""

# Test 5: Generate reflection prompt
echo -e "${YELLOW}Test 5: Generate Reflection Prompt${NC}"
REFLECTION_PROMPT=$(curl -s -X POST \
  "${API_BASE}/reflections/prompt/${USER_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"context":{"module":"Module 1"}}')

echo "Response: $REFLECTION_PROMPT" | head -c 300
echo ""
if echo "$REFLECTION_PROMPT" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ PASS: Reflection prompt generated${NC}"
else
  echo -e "${RED}❌ FAIL: Failed to generate reflection prompt${NC}"
fi
echo ""

# Test 6: Submit a reflection
echo -e "${YELLOW}Test 6: Submit User Reflection${NC}"
SUBMIT_REFLECTION=$(curl -s -X POST \
  "${API_BASE}/reflections/submit/${USER_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reflection":"I learned a lot about classroom management. The key takeaway was being proactive rather than reactive. I plan to implement the traffic light system in my class.",
    "promptType":"module_completion"
  }')

echo "Response: $SUBMIT_REFLECTION" | head -c 300
echo ""
if echo "$SUBMIT_REFLECTION" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ PASS: Reflection submitted successfully${NC}"
else
  echo -e "${RED}❌ FAIL: Failed to submit reflection${NC}"
fi
echo ""

# Test 7: Get reflection history
echo -e "${YELLOW}Test 7: Get Reflection History${NC}"
REFLECTION_HISTORY=$(curl -s -X GET \
  "${API_BASE}/reflections/history/${USER_ID}?limit=5" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $REFLECTION_HISTORY" | head -c 300
echo ""
if echo "$REFLECTION_HISTORY" | grep -q '"success":true'; then
  REFLECTION_COUNT=$(echo $REFLECTION_HISTORY | grep -o '"id"' | wc -l)
  echo -e "${GREEN}✅ PASS: Reflection history retrieved (${REFLECTION_COUNT} reflections)${NC}"
else
  echo -e "${RED}❌ FAIL: Failed to get reflection history${NC}"
fi
echo ""

# Test 8: Generate progress report
echo -e "${YELLOW}Test 8: Generate Progress Report${NC}"
PROGRESS_REPORT=$(curl -s -X GET \
  "${API_BASE}/reflections/report/${USER_ID}" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $PROGRESS_REPORT" | head -c 300
echo ""
if echo "$PROGRESS_REPORT" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ PASS: Progress report generated${NC}"
else
  echo -e "${RED}❌ FAIL: Failed to generate progress report${NC}"
fi
echo ""

# Test 9: Schedule reflection reminders
echo -e "${YELLOW}Test 9: Schedule Reflection Reminders${NC}"
SCHEDULE_REMINDER=$(curl -s -X POST \
  "${API_BASE}/reflections/schedule/${USER_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"frequency":"weekly"}')

echo "Response: $SCHEDULE_REMINDER" | head -c 300
echo ""
if echo "$SCHEDULE_REMINDER" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ PASS: Reflection reminders scheduled${NC}"
else
  echo -e "${RED}❌ FAIL: Failed to schedule reflection reminders${NC}"
fi
echo ""

# Test Section: COACHING ENGINE
echo "======================================"
echo "  TESTING COACHING ENGINE"
echo "======================================"
echo ""

# Test 10: Analyze user engagement
echo -e "${YELLOW}Test 10: Analyze User Engagement${NC}"
ENGAGEMENT=$(curl -s -X GET \
  "${API_BASE}/engagement/${USER_ID}" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $ENGAGEMENT" | head -c 300
echo ""
if echo "$ENGAGEMENT" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ PASS: Engagement analysis retrieved${NC}"
else
  echo -e "${RED}❌ FAIL: Failed to analyze engagement${NC}"
fi
echo ""

# Test 11: Get personalized recommendations
echo -e "${YELLOW}Test 11: Get Personalized Recommendations${NC}"
RECOMMENDATIONS=$(curl -s -X GET \
  "${API_BASE}/recommendations/${USER_ID}" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $RECOMMENDATIONS" | head -c 300
echo ""
if echo "$RECOMMENDATIONS" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ PASS: Recommendations retrieved${NC}"
else
  echo -e "${RED}❌ FAIL: Failed to get recommendations${NC}"
fi
echo ""

# Test 12: Provide adaptive coaching
echo -e "${YELLOW}Test 12: Provide Adaptive Coaching${NC}"
ADAPTIVE_COACHING=$(curl -s -X POST \
  "${API_BASE}/adaptive/${USER_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"context":{"struggling_with":"quiz"}}')

echo "Response: $ADAPTIVE_COACHING" | head -c 300
echo ""
if echo "$ADAPTIVE_COACHING" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ PASS: Adaptive coaching provided${NC}"
else
  echo -e "${RED}❌ FAIL: Failed to provide adaptive coaching${NC}"
fi
echo ""

# Test Section: ANALYTICS
echo "======================================"
echo "  TESTING ANALYTICS"
echo "======================================"
echo ""

# Test 13: Get coaching analytics overview
echo -e "${YELLOW}Test 13: Get Coaching Analytics Overview${NC}"
ANALYTICS=$(curl -s -X GET \
  "${API_BASE}/analytics/overview" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $ANALYTICS" | head -c 300
echo ""
if echo "$ANALYTICS" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ PASS: Analytics overview retrieved${NC}"
else
  echo -e "${RED}❌ FAIL: Failed to get analytics overview${NC}"
fi
echo ""

# Test 14: Get engagement trends
echo -e "${YELLOW}Test 14: Get Engagement Trends${NC}"
TRENDS=$(curl -s -X GET \
  "${API_BASE}/analytics/trends?days=30" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $TRENDS" | head -c 300
echo ""
if echo "$TRENDS" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ PASS: Engagement trends retrieved${NC}"
else
  echo -e "${RED}❌ FAIL: Failed to get engagement trends${NC}"
fi
echo ""

# Final Summary
echo "======================================"
echo "  TEST SUMMARY"
echo "======================================"
echo ""
echo -e "${GREEN}✅ All coaching API endpoints tested${NC}"
echo ""
echo "Note: Some features require WhatsApp configuration and active users"
echo "to fully test nudge delivery and reflection workflows."
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Access dashboard: ${BASE_URL}/admin/coaching-analytics.html"
echo "2. View nudge statistics in admin UI"
echo "3. Monitor scheduler logs for automated nudges"
echo ""
echo "Test completed at: $(date)"
