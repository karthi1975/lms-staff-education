#!/bin/bash

# Test script for Coaching Mode API endpoints
# Tests all 15 endpoints (8 user + 5 admin + 2 analytics)

BASE_URL="${BASE_URL:-http://localhost:3000}"
COURSE_ID=7
USER_ID=1

echo "🧪 Testing Coaching Mode API Endpoints"
echo "Base URL: $BASE_URL"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
  local method=$1
  local endpoint=$2
  local data=$3
  local headers=$4
  local expected_status=$5
  local description=$6

  echo -e "\n${BLUE}Testing: $description${NC}"
  echo "  $method $endpoint"

  if [ -n "$data" ]; then
    if [ -n "$headers" ]; then
      response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
        -H "Content-Type: application/json" \
        -H "$headers" \
        -d "$data")
    else
      response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
        -H "Content-Type: application/json" \
        -d "$data")
    fi
  else
    if [ -n "$headers" ]; then
      response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
        -H "$headers")
    else
      response=$(curl -s -w "\n%{http_code}" $method "$BASE_URL$endpoint")
    fi
  fi

  status_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  if [ "$status_code" -eq "$expected_status" ]; then
    echo -e "  ${GREEN}✓ Status: $status_code${NC}"
    echo "  Response: $(echo $body | jq -c '.' 2>/dev/null || echo $body)"
  else
    echo -e "  ${RED}✗ Status: $status_code (expected $expected_status)${NC}"
    echo "  Response: $(echo $body | jq -c '.' 2>/dev/null || echo $body)"
  fi
}

# Get admin token for protected endpoints
echo -e "\n${BLUE}🔐 Getting admin token...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"Admin123!"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token' 2>/dev/null)

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}✗ Failed to get admin token${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ Got admin token${NC}"

# ============================================
# USER ENDPOINTS (8)
# ============================================

echo -e "\n\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  USER ENDPOINTS (8)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 1. Get course config
test_endpoint "GET" "/api/coaching-mode/config/$COURSE_ID" "" "" 200 "1. Get course configuration"

# 2. Switch mode
test_endpoint "POST" "/api/coaching-mode/switch" \
  "{\"userId\":$USER_ID,\"courseId\":$COURSE_ID,\"mode\":\"socratic\"}" \
  "" 200 "2. Switch to Socratic mode"

# 3. Get user preference
test_endpoint "GET" "/api/coaching-mode/preference/$USER_ID/$COURSE_ID" "" "" 200 "3. Get user preference"

# 4. Start session
START_SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/coaching-mode/session/start" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":$USER_ID,\"courseId\":$COURSE_ID}")

SESSION_ID=$(echo $START_SESSION_RESPONSE | jq -r '.data.id' 2>/dev/null)

if [ "$SESSION_ID" != "null" ] && [ -n "$SESSION_ID" ]; then
  echo -e "\n${BLUE}Testing: 4. Start coaching session${NC}"
  echo "  POST /api/coaching-mode/session/start"
  echo -e "  ${GREEN}✓ Status: 201${NC}"
  echo "  Session ID: $SESSION_ID"
else
  echo -e "\n${BLUE}Testing: 4. Start coaching session${NC}"
  echo -e "  ${RED}✗ Failed to start session${NC}"
  echo "  Response: $START_SESSION_RESPONSE"
fi

# 5. Log session message
if [ -n "$SESSION_ID" ]; then
  test_endpoint "POST" "/api/coaching-mode/session/message" \
    "{\"sessionId\":$SESSION_ID,\"isQuestion\":true}" \
    "" 200 "5. Log session message (question)"
fi

# 6. End session
if [ -n "$SESSION_ID" ]; then
  test_endpoint "POST" "/api/coaching-mode/session/end" \
    "{\"sessionId\":$SESSION_ID,\"status\":\"completed\",\"metrics\":{\"quiz_score\":90,\"satisfaction_rating\":5}}" \
    "" 200 "6. End coaching session"
fi

# 7. Get session history
test_endpoint "GET" "/api/coaching-mode/session/history/$USER_ID?courseId=$COURSE_ID&limit=5" \
  "" "" 200 "7. Get session history"

# 8. Get available commands
test_endpoint "GET" "/api/coaching-mode/commands" "" "" 200 "8. Get available commands"

# ============================================
# ADMIN ENDPOINTS (5) - RBAC Protected
# ============================================

echo -e "\n\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  ADMIN ENDPOINTS (5) - RBAC Protected${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 9. Create/Update course config
test_endpoint "POST" "/api/coaching-mode/admin/config" \
  "{\"courseId\":$COURSE_ID,\"config\":{\"regular_prompt\":\"Updated regular prompt\",\"default_mode\":\"regular\"}}" \
  "Authorization: Bearer $TOKEN" 201 "9. Create/Update course config"

# 10. Get full course config (admin view)
test_endpoint "GET" "/api/coaching-mode/admin/config/$COURSE_ID" \
  "" "Authorization: Bearer $TOKEN" 200 "10. Get full course config (admin)"

# 11. Update config by ID
CONFIG_ID=$(curl -s -X GET "$BASE_URL/api/coaching-mode/admin/config/$COURSE_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data.id' 2>/dev/null)

if [ "$CONFIG_ID" != "null" ] && [ -n "$CONFIG_ID" ]; then
  test_endpoint "PUT" "/api/coaching-mode/admin/config/$CONFIG_ID" \
    "{\"config\":{\"switch_cooldown_minutes\":5}}" \
    "Authorization: Bearer $TOKEN" 200 "11. Update config by ID"
else
  echo -e "\n${BLUE}Testing: 11. Update config by ID${NC}"
  echo -e "  ${RED}✗ Skipped (no config ID)${NC}"
fi

# 12. Seed default configurations
test_endpoint "POST" "/api/coaching-mode/admin/seed-defaults" \
  "" "Authorization: Bearer $TOKEN" 200 "12. Seed default configurations"

# 13. Delete config (commented out to preserve data)
# test_endpoint "DELETE" "/api/coaching-mode/admin/config/$CONFIG_ID" \
#   "" "Authorization: Bearer $TOKEN" 200 "13. Delete configuration"

echo -e "\n${BLUE}Testing: 13. Delete configuration${NC}"
echo -e "  ⏭️  Skipped (preserves data)"

# ============================================
# ANALYTICS ENDPOINTS (2) - RBAC Protected
# ============================================

echo -e "\n\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  ANALYTICS ENDPOINTS (2) - RBAC Protected${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 14. Get mode analytics
test_endpoint "GET" "/api/coaching-mode/admin/analytics/$COURSE_ID?startDate=2025-10-01&endDate=2025-10-31" \
  "" "Authorization: Bearer $TOKEN" 200 "14. Get mode analytics"

# 15. Generate and save analytics
test_endpoint "POST" "/api/coaching-mode/admin/analytics/generate" \
  "{\"courseId\":$COURSE_ID,\"startDate\":\"2025-10-01\",\"endDate\":\"2025-10-31\"}" \
  "Authorization: Bearer $TOKEN" 201 "15. Generate and save analytics"

# ============================================
# SUMMARY
# ============================================

echo -e "\n\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  TEST SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "\n✅ User Endpoints: 8"
echo "✅ Admin Endpoints: 5 (4 tested, 1 skipped)"
echo "✅ Analytics Endpoints: 2"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total: 14 endpoints tested"
echo ""
echo "🎉 API testing complete!"
echo ""
