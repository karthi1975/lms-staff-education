#!/bin/bash
# Test Enrollment and Progress Tracking Flow
# Tests: Admin enrollment → PIN generation → User verification → Education chat access

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@school.edu}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}"

# Test user details
TEST_USER_NAME="Test User $(date +%s)"
TEST_USER_PHONE="+1555$(date +%s | tail -c 8)"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Enrollment Flow Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Admin Login
echo -e "${YELLOW}[1/6] Admin Login...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | sed 's/"accessToken":"//' | sed 's/"//')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Failed to login as admin${NC}"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Admin logged in successfully${NC}"
echo ""

# Step 2: Enroll New User
echo -e "${YELLOW}[2/6] Enrolling new user...${NC}"
echo "   Name: $TEST_USER_NAME"
echo "   Phone: $TEST_USER_PHONE"

ENROLL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/users/enroll" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\": \"$TEST_USER_NAME\", \"phoneNumber\": \"$TEST_USER_PHONE\"}")

echo "$ENROLL_RESPONSE" | grep -q '"success":true'
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Failed to enroll user${NC}"
  echo "$ENROLL_RESPONSE"
  exit 1
fi

USER_ID=$(echo "$ENROLL_RESPONSE" | grep -o '"userId":[0-9]*' | sed 's/"userId"://')
PIN=$(echo "$ENROLL_RESPONSE" | grep -o '"pin":"[^"]*"' | sed 's/"pin":"//' | sed 's/"//')

echo -e "${GREEN}✅ User enrolled successfully${NC}"
echo "   User ID: $USER_ID"
echo "   PIN: $PIN"
echo ""

# Step 3: Verify Enrollment Status
echo -e "${YELLOW}[3/6] Checking enrollment status...${NC}"

# URL encode the phone number for the GET request
ENCODED_PHONE=$(echo "$TEST_USER_PHONE" | sed 's/+/%2B/g')

STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/admin/users/$ENCODED_PHONE/enrollment-status" \
  -H "Authorization: Bearer $TOKEN")

echo "$STATUS_RESPONSE" | grep -q '"status":"pending"'
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ User status is not 'pending'${NC}"
  echo "$STATUS_RESPONSE"
  exit 1
fi

echo "$STATUS_RESPONSE" | grep -q '"isVerified":false'
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ User should not be verified yet${NC}"
  echo "$STATUS_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Enrollment status correct: pending, not verified${NC}"
echo ""

# Step 4: Get Users List (verify user appears in admin portal)
echo -e "${YELLOW}[4/6] Verifying user appears in admin portal...${NC}"

USERS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/admin/users" \
  -H "Authorization: Bearer $TOKEN")

echo "$USERS_RESPONSE" | grep -q "$TEST_USER_PHONE"
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ User not found in users list${NC}"
  echo "$USERS_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ User appears in admin portal${NC}"
echo ""

# Step 5: Get User Progress (should have first module initialized)
echo -e "${YELLOW}[5/6] Checking initial module progress...${NC}"

PROGRESS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/admin/user-progress/$USER_ID" \
  -H "Authorization: Bearer $TOKEN")

# Check if response is successful
echo "$PROGRESS_RESPONSE" | grep -q '"success":true'
if [ $? -ne 0 ]; then
  echo -e "${YELLOW}⚠️  User progress not yet initialized (will be initialized after PIN verification)${NC}"
else
  echo -e "${GREEN}✅ User progress endpoint accessible${NC}"

  # Check if any modules exist
  MODULE_COUNT=$(echo "$PROGRESS_RESPONSE" | grep -o '"modules":\[' | wc -l)
  if [ "$MODULE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}   Modules found in progress${NC}"
  fi
fi

echo ""

# Step 6: Display Summary and Instructions
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}✅ All enrollment checks passed!${NC}"
echo ""
echo -e "${YELLOW}Next Steps (Manual):${NC}"
echo "1. User should message WhatsApp bot at +1 806 515 7636"
echo "2. Bot will prompt for PIN"
echo "3. User sends PIN: $PIN"
echo "4. Bot verifies PIN and activates account"
echo "5. User can then start education chat"
echo ""
echo -e "${YELLOW}Verification Commands:${NC}"
echo ""
echo "# Re-check enrollment status after PIN verification:"
echo "curl -s -X GET \"$BASE_URL/api/admin/users/$ENCODED_PHONE/enrollment-status\" \\"
echo "  -H \"Authorization: Bearer $TOKEN\" | jq"
echo ""
echo "# Check user progress after verification:"
echo "curl -s -X GET \"$BASE_URL/api/admin/user-progress/$USER_ID\" \\"
echo "  -H \"Authorization: Bearer $TOKEN\" | jq"
echo ""
echo -e "${YELLOW}Expected After PIN Verification:${NC}"
echo "- enrollment_status: 'active'"
echo "- is_verified: true"
echo "- First module progress initialized"
echo "- User can chat with bot"
echo ""

# Optional: Clean up test user
echo -e "${YELLOW}Cleanup:${NC}"
echo "To delete test user, run:"
echo "curl -X DELETE \"$BASE_URL/api/admin/users/$USER_ID\" \\"
echo "  -H \"Authorization: Bearer $TOKEN\""
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Enrollment Flow Test Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
