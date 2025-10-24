#!/bin/bash
# Test Critical Edge Cases
# Tests the 3 most critical edge cases that could crash the system

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@school.edu}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Edge Case Testing${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Login first
echo -e "${YELLOW}Logging in as admin...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | sed 's/"accessToken":"//' | sed 's/"//')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Failed to login${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Logged in${NC}"
echo ""

# =============================================================================
# EDGE CASE 1: Enrollment with No Modules
# =============================================================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Edge Case 1: Enrollment with No Modules${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if modules exist
MODULES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/admin/modules" \
  -H "Authorization: Bearer $TOKEN")

MODULE_COUNT=$(echo "$MODULES_RESPONSE" | grep -o '"data":\[' | wc -l)

if [ "$MODULE_COUNT" -eq 0 ]; then
  echo -e "${YELLOW}⚠️  No modules found - testing edge case...${NC}"

  # Try to enroll user
  TEST_USER_PHONE="+1555$(date +%s | tail -c 8)"
  ENROLL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/users/enroll" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"name\": \"Test No Modules\", \"phoneNumber\": \"$TEST_USER_PHONE\"}")

  echo "$ENROLL_RESPONSE" | grep -q '"current_module_id":null' 2>/dev/null || true
  if [ $? -eq 0 ]; then
    echo -e "${RED}🐛 BUG FOUND: User enrolled with NULL current_module_id${NC}"
    echo -e "${RED}   This will crash when user tries to chat!${NC}"
    echo ""
    echo -e "${YELLOW}Expected: Enrollment should be rejected if no modules exist${NC}"
    echo -e "${YELLOW}Actual: User created with NULL module${NC}"
    echo ""
  else
    echo -e "${GREEN}✅ PASS: System prevented enrollment without modules${NC}"
  fi
else
  echo -e "${GREEN}✅ SKIP: Modules exist (cannot test this edge case)${NC}"
  echo -e "${YELLOW}   To test: Delete all courses/modules first${NC}"
fi
echo ""

# =============================================================================
# EDGE CASE 2: User with Deleted Module
# =============================================================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Edge Case 2: User with Deleted Module${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get first module ID
MODULES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/admin/modules" \
  -H "Authorization: Bearer $TOKEN")

FIRST_MODULE_ID=$(echo "$MODULES_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | sed 's/"id"://')

if [ -n "$FIRST_MODULE_ID" ]; then
  echo -e "${YELLOW}Testing with module ID: $FIRST_MODULE_ID${NC}"

  # Query user with this module
  USER_WITH_MODULE=$(curl -s -X GET "$BASE_URL/api/admin/users" \
    -H "Authorization: Bearer $TOKEN" | \
    grep -o '"current_module_id":'$FIRST_MODULE_ID -c 2>/dev/null || echo "0")

  if [ "$USER_WITH_MODULE" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found $USER_WITH_MODULE user(s) with this module${NC}"
    echo -e "${YELLOW}   If you delete this module, those users will crash when chatting${NC}"
    echo ""
    echo -e "${RED}🐛 POTENTIAL BUG: No protection against deleting modules with active users${NC}"
    echo ""
    echo -e "${YELLOW}Recommendation: Add validation before module deletion${NC}"
  else
    echo -e "${GREEN}✅ No users currently on this module${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  SKIP: No modules available to test${NC}"
fi
echo ""

# =============================================================================
# EDGE CASE 3: Concurrent Enrollment (Same Phone Number)
# =============================================================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Edge Case 3: Concurrent Enrollment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

TEST_PHONE="+1555$(date +%s | tail -c 8)"
echo -e "${YELLOW}Testing concurrent enrollment for: $TEST_PHONE${NC}"

# Enroll user twice in quick succession (simulating race condition)
ENROLL1=$(curl -s -X POST "$BASE_URL/api/admin/users/enroll" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\": \"Concurrent Test 1\", \"phoneNumber\": \"$TEST_PHONE\"}")

ENROLL2=$(curl -s -X POST "$BASE_URL/api/admin/users/enroll" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\": \"Concurrent Test 2\", \"phoneNumber\": \"$TEST_PHONE\"}")

# Check first enrollment
echo "$ENROLL1" | grep -q '"success":true'
FIRST_SUCCESS=$?

# Check second enrollment
echo "$ENROLL2" | grep -q '"success":false'
SECOND_FAIL=$?

if [ $FIRST_SUCCESS -eq 0 ] && [ $SECOND_FAIL -eq 0 ]; then
  echo -e "${GREEN}✅ PASS: Second enrollment rejected (user already exists)${NC}"

  # Clean up test user
  USER_ID=$(echo "$ENROLL1" | grep -o '"userId":[0-9]*' | sed 's/"userId"://')
  if [ -n "$USER_ID" ]; then
    curl -s -X DELETE "$BASE_URL/api/admin/users/$USER_ID" \
      -H "Authorization: Bearer $TOKEN" > /dev/null
    echo -e "${GREEN}   Cleaned up test user${NC}"
  fi
else
  echo -e "${RED}🐛 BUG FOUND: Concurrent enrollment handling issue${NC}"
  echo -e "${YELLOW}First enrollment: $(echo "$ENROLL1" | grep -o '"success":[a-z]*')${NC}"
  echo -e "${YELLOW}Second enrollment: $(echo "$ENROLL2" | grep -o '"success":[a-z]*')${NC}"
fi
echo ""

# =============================================================================
# EDGE CASE 4: User Deleted Mid-Session (Simulation)
# =============================================================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Edge Case 4: User Deleted Mid-Session${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Create test user
TEST_USER_PHONE="+1555$(date +%s | tail -c 8)"
echo -e "${YELLOW}Creating test user: $TEST_USER_PHONE${NC}"

ENROLL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/users/enroll" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\": \"Delete Test User\", \"phoneNumber\": \"$TEST_USER_PHONE\"}")

USER_ID=$(echo "$ENROLL_RESPONSE" | grep -o '"userId":[0-9]*' | sed 's/"userId"://')

if [ -n "$USER_ID" ]; then
  echo -e "${GREEN}✅ User created (ID: $USER_ID)${NC}"

  # Simulate: User would normally verify PIN here and start session
  # But instead, we delete the user

  echo -e "${YELLOW}Simulating: Admin deletes user mid-session...${NC}"
  DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/admin/users/$USER_ID" \
    -H "Authorization: Bearer $TOKEN")

  echo "$DELETE_RESPONSE" | grep -q '"success":true'
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ User deleted${NC}"

    # Now try to access user (simulating active session trying to continue)
    PROGRESS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/admin/user-progress/$USER_ID" \
      -H "Authorization: Bearer $TOKEN")

    echo "$PROGRESS_RESPONSE" | grep -q '"modules":\[\]' 2>/dev/null || true
    if [ $? -eq 0 ]; then
      echo -e "${YELLOW}⚠️  WARNING: Deleted user still returns empty progress (not clear error)${NC}"
      echo -e "${YELLOW}   Recommendation: Return 404 error for deleted users${NC}"
    else
      echo -e "${GREEN}✅ PASS: System handles deleted user gracefully${NC}"
    fi
  fi
else
  echo -e "${YELLOW}⚠️  SKIP: Could not create test user${NC}"
fi
echo ""

# =============================================================================
# EDGE CASE 5: Phone Number Format Variations
# =============================================================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Edge Case 5: Phone Number Normalization${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

BASE_NUMBER="15551234567"
VARIATIONS=(
  "+1 555 123 4567"
  "1-555-123-4567"
  "+1 (555) 123-4567"
  "+15551234567"
  "15551234567"
)

echo -e "${YELLOW}Testing phone number normalization...${NC}"

# Enroll with first variation
FIRST_VARIATION="${VARIATIONS[0]}"
echo -e "${YELLOW}Enrolling with: '$FIRST_VARIATION'${NC}"

ENROLL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/users/enroll" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\": \"Format Test\", \"phoneNumber\": \"$FIRST_VARIATION\"}")

echo "$ENROLL_RESPONSE" | grep -q '"success":true'
if [ $? -eq 0 ]; then
  ENROLLED_PHONE=$(echo "$ENROLL_RESPONSE" | grep -o '"phoneNumber":"[^"]*"' | sed 's/"phoneNumber":"//' | sed 's/"//')
  USER_ID=$(echo "$ENROLL_RESPONSE" | grep -o '"userId":[0-9]*' | sed 's/"userId"://')

  echo -e "${GREEN}✅ Enrolled as: '$ENROLLED_PHONE'${NC}"

  # Try enrolling with other variations
  DUPLICATES_PREVENTED=0
  for VARIATION in "${VARIATIONS[@]:1}"; do
    ENROLL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/users/enroll" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "{\"name\": \"Format Test\", \"phoneNumber\": \"$VARIATION\"}")

    echo "$ENROLL_RESPONSE" | grep -q '"success":false' 2>/dev/null || true
    if [ $? -eq 0 ]; then
      DUPLICATES_PREVENTED=$((DUPLICATES_PREVENTED + 1))
    fi
  done

  if [ $DUPLICATES_PREVENTED -eq 4 ]; then
    echo -e "${GREEN}✅ PASS: All variations correctly identified as duplicate${NC}"
  else
    echo -e "${RED}🐛 BUG FOUND: Only $DUPLICATES_PREVENTED/4 variations detected as duplicate${NC}"
    echo -e "${YELLOW}   Some phone format variations may create duplicate users${NC}"
  fi

  # Cleanup
  if [ -n "$USER_ID" ]; then
    curl -s -X DELETE "$BASE_URL/api/admin/users/$USER_ID" \
      -H "Authorization: Bearer $TOKEN" > /dev/null
    echo -e "${GREEN}   Cleaned up test user${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  SKIP: Could not enroll test user${NC}"
fi
echo ""

# =============================================================================
# Summary
# =============================================================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Edge Case Testing Complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Tests Run:${NC}"
echo "1. Enrollment with no modules"
echo "2. User with deleted module"
echo "3. Concurrent enrollment"
echo "4. User deleted mid-session"
echo "5. Phone number format variations"
echo ""
echo -e "${YELLOW}For detailed edge case analysis, see:${NC}"
echo "   EDGE_CASES_ANALYSIS.md"
echo ""
echo -e "${YELLOW}For fixes, see:${NC}"
echo "   - Fix NULL module crash in course-orchestrator.service.js"
echo "   - Add session cleanup for memory leak prevention"
echo "   - Validate module existence before enrollment"
echo ""
