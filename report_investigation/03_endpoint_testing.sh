#!/bin/bash
# Comprehensive Endpoint Testing Script
# Tests all critical endpoints and generates report

OUTPUT_FILE="/Users/karthi/business/staff_education/teachers_training/report_investigation/03_endpoint_testing_report.md"
BASE_URL="http://34.162.168.124:3000"

echo "# Endpoint Testing Report" > "$OUTPUT_FILE"
echo "**Generated**: $(date)" >> "$OUTPUT_FILE"
echo "**Base URL**: $BASE_URL" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Color codes for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_test() {
  local status=$1
  local endpoint=$2
  local message=$3

  if [ "$status" = "PASS" ]; then
    echo -e "${GREEN}✅ PASS${NC}: $endpoint - $message"
    echo "✅ **PASS**: \`$endpoint\` - $message" >> "$OUTPUT_FILE"
  elif [ "$status" = "FAIL" ]; then
    echo -e "${RED}❌ FAIL${NC}: $endpoint - $message"
    echo "❌ **FAIL**: \`$endpoint\` - $message" >> "$OUTPUT_FILE"
  else
    echo -e "${YELLOW}⚠️  WARN${NC}: $endpoint - $message"
    echo "⚠️  **WARN**: \`$endpoint\` - $message" >> "$OUTPUT_FILE"
  fi
}

echo "## Test Suite Results" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Test 1: Login as Admin
echo "### 1. Authentication Tests" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "Testing admin login..."
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST ${BASE_URL}/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"Admin123!"}')

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -1)
RESPONSE_BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  TOKEN=$(echo "$RESPONSE_BODY" | jq -r '.tokens.accessToken // .token')
  if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    log_test "PASS" "POST /api/admin/login" "Admin login successful (HTTP 200)"
    echo "  - Token: ${TOKEN:0:30}..." >> "$OUTPUT_FILE"
  else
    log_test "FAIL" "POST /api/admin/login" "No token in response"
    TOKEN=""
  fi
else
  log_test "FAIL" "POST /api/admin/login" "HTTP $HTTP_CODE - $RESPONSE_BODY"
  TOKEN=""
fi
echo "" >> "$OUTPUT_FILE"

if [ -z "$TOKEN" ]; then
  echo "❌ Cannot proceed without authentication token. Exiting tests." | tee -a "$OUTPUT_FILE"
  exit 1
fi

# Test 2: Enrollment Endpoints
echo "### 2. Enrollment Tests" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "Testing user enrollment..."
ENROLL_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST ${BASE_URL}/api/admin/users/enroll \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Investigation User","phoneNumber":"+255700000001"}')

HTTP_CODE=$(echo "$ENROLL_RESPONSE" | tail -1)
RESPONSE_BODY=$(echo "$ENROLL_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  SUCCESS=$(echo "$RESPONSE_BODY" | jq -r '.success')
  if [ "$SUCCESS" = "true" ]; then
    log_test "PASS" "POST /api/admin/users/enroll" "User enrolled successfully"
    USER_ID=$(echo "$RESPONSE_BODY" | jq -r '.data.userId')
    PIN=$(echo "$RESPONSE_BODY" | jq -r '.data.pin')
    echo "  - User ID: $USER_ID" >> "$OUTPUT_FILE"
    echo "  - PIN: $PIN" >> "$OUTPUT_FILE"
  else
    ERROR=$(echo "$RESPONSE_BODY" | jq -r '.error')
    if [[ "$ERROR" == *"already exists"* ]]; then
      log_test "PASS" "POST /api/admin/users/enroll" "User already enrolled (expected)"
    else
      log_test "FAIL" "POST /api/admin/users/enroll" "Error: $ERROR"
    fi
  fi
else
  log_test "FAIL" "POST /api/admin/users/enroll" "HTTP $HTTP_CODE"
fi
echo "" >> "$OUTPUT_FILE"

# Test 3: Get All Users
echo "### 3. User Management Tests" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "Testing get all users..."
USERS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET ${BASE_URL}/api/admin/users \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$USERS_RESPONSE" | tail -1)
RESPONSE_BODY=$(echo "$USERS_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  USER_COUNT=$(echo "$RESPONSE_BODY" | jq -r '.users | length')
  log_test "PASS" "GET /api/admin/users" "Retrieved $USER_COUNT users"
  echo "  - Total users: $USER_COUNT" >> "$OUTPUT_FILE"
else
  log_test "FAIL" "GET /api/admin/users" "HTTP $HTTP_CODE"
fi
echo "" >> "$OUTPUT_FILE"

# Test 4: Course Management
echo "### 4. Course Management Tests" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "Testing get all courses..."
COURSES_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET ${BASE_URL}/api/admin/courses \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$COURSES_RESPONSE" | tail -1)
RESPONSE_BODY=$(echo "$COURSES_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  COURSE_COUNT=$(echo "$RESPONSE_BODY" | jq -r '.courses | length')
  log_test "PASS" "GET /api/admin/courses" "Retrieved $COURSE_COUNT courses"
  echo "  - Total courses: $COURSE_COUNT" >> "$OUTPUT_FILE"

  # Get first course ID for module testing
  COURSE_ID=$(echo "$RESPONSE_BODY" | jq -r '.courses[0].id')
else
  log_test "FAIL" "GET /api/admin/courses" "HTTP $HTTP_CODE"
fi
echo "" >> "$OUTPUT_FILE"

# Test 5: Module Management
echo "### 5. Module Management Tests" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

if [ -n "$COURSE_ID" ] && [ "$COURSE_ID" != "null" ]; then
  echo "Testing get modules for course $COURSE_ID..."
  MODULES_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET ${BASE_URL}/api/admin/courses/${COURSE_ID}/modules \
    -H "Authorization: Bearer $TOKEN")

  HTTP_CODE=$(echo "$MODULES_RESPONSE" | tail -1)
  RESPONSE_BODY=$(echo "$MODULES_RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ]; then
    MODULE_COUNT=$(echo "$RESPONSE_BODY" | jq -r '.modules | length')
    log_test "PASS" "GET /api/admin/courses/${COURSE_ID}/modules" "Retrieved $MODULE_COUNT modules"
    echo "  - Total modules: $MODULE_COUNT" >> "$OUTPUT_FILE"

    # Get first module ID for quiz testing
    MODULE_ID=$(echo "$RESPONSE_BODY" | jq -r '.modules[0].id')
  else
    log_test "FAIL" "GET /api/admin/courses/${COURSE_ID}/modules" "HTTP $HTTP_CODE"
  fi
else
  log_test "WARN" "GET /api/admin/courses/:courseId/modules" "Skipped - no course found"
fi
echo "" >> "$OUTPUT_FILE"

# Test 6: Quiz Management
echo "### 6. Quiz Management Tests" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

if [ -n "$MODULE_ID" ] && [ "$MODULE_ID" != "null" ]; then
  echo "Testing get quiz for module $MODULE_ID..."
  QUIZ_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET ${BASE_URL}/api/admin/courses/${COURSE_ID}/modules/${MODULE_ID}/quiz \
    -H "Authorization: Bearer $TOKEN")

  HTTP_CODE=$(echo "$QUIZ_RESPONSE" | tail -1)
  RESPONSE_BODY=$(echo "$QUIZ_RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ]; then
    QUESTION_COUNT=$(echo "$RESPONSE_BODY" | jq -r '.questions | length')
    log_test "PASS" "GET /api/admin/courses/${COURSE_ID}/modules/${MODULE_ID}/quiz" "Retrieved quiz with $QUESTION_COUNT questions"
    echo "  - Total questions: $QUESTION_COUNT" >> "$OUTPUT_FILE"
  else
    log_test "FAIL" "GET /api/admin/courses/${COURSE_ID}/modules/${MODULE_ID}/quiz" "HTTP $HTTP_CODE"
  fi
else
  log_test "WARN" "GET /api/admin/courses/:courseId/modules/:moduleId/quiz" "Skipped - no module found"
fi
echo "" >> "$OUTPUT_FILE"

# Test 7: User Progress
echo "### 7. User Progress Tests" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
  echo "Testing get user progress..."
  PROGRESS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET ${BASE_URL}/api/admin/users/${USER_ID}/progress \
    -H "Authorization: Bearer $TOKEN")

  HTTP_CODE=$(echo "$PROGRESS_RESPONSE" | tail -1)
  RESPONSE_BODY=$(echo "$PROGRESS_RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ]; then
    log_test "PASS" "GET /api/admin/users/${USER_ID}/progress" "Retrieved user progress"
    echo '```json' >> "$OUTPUT_FILE"
    echo "$RESPONSE_BODY" | jq '.' >> "$OUTPUT_FILE"
    echo '```' >> "$OUTPUT_FILE"
  else
    log_test "WARN" "GET /api/admin/users/${USER_ID}/progress" "HTTP $HTTP_CODE - User may not have progress yet"
  fi
else
  log_test "WARN" "GET /api/admin/users/:userId/progress" "Skipped - no user found"
fi
echo "" >> "$OUTPUT_FILE"

# Test 8: Chat History
echo "### 8. Chat History Tests" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
  echo "Testing get chat history..."
  CHAT_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/api/admin/users/${USER_ID}/chat-history?limit=10" \
    -H "Authorization: Bearer $TOKEN")

  HTTP_CODE=$(echo "$CHAT_RESPONSE" | tail -1)
  RESPONSE_BODY=$(echo "$CHAT_RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ]; then
    MESSAGE_COUNT=$(echo "$RESPONSE_BODY" | jq -r '.messages | length')
    log_test "PASS" "GET /api/admin/users/${USER_ID}/chat-history" "Retrieved $MESSAGE_COUNT messages"
    echo "  - Total messages: $MESSAGE_COUNT" >> "$OUTPUT_FILE"
  else
    log_test "WARN" "GET /api/admin/users/${USER_ID}/chat-history" "HTTP $HTTP_CODE - User may not have chat history yet"
  fi
else
  log_test "WARN" "GET /api/admin/users/:userId/chat-history" "Skipped - no user found"
fi
echo "" >> "$OUTPUT_FILE"

# Test 9: File Processing Status
echo "### 9. File Processing Tests" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "Testing get file processing status..."
FILE_STATUS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET ${BASE_URL}/api/file-processing/status \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$FILE_STATUS_RESPONSE" | tail -1)
RESPONSE_BODY=$(echo "$FILE_STATUS_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  log_test "PASS" "GET /api/file-processing/status" "Retrieved file processing status"
  echo '```json' >> "$OUTPUT_FILE"
  echo "$RESPONSE_BODY" | jq '.' >> "$OUTPUT_FILE"
  echo '```' >> "$OUTPUT_FILE"
else
  log_test "WARN" "GET /api/file-processing/status" "HTTP $HTTP_CODE"
fi
echo "" >> "$OUTPUT_FILE"

# Summary
echo "## Test Summary" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
PASS_COUNT=$(grep -c "✅ \*\*PASS\*\*" "$OUTPUT_FILE" || echo 0)
FAIL_COUNT=$(grep -c "❌ \*\*FAIL\*\*" "$OUTPUT_FILE" || echo 0)
WARN_COUNT=$(grep -c "⚠️  \*\*WARN\*\*" "$OUTPUT_FILE" || echo 0)
TOTAL_TESTS=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT))

echo "- **Total Tests**: $TOTAL_TESTS" >> "$OUTPUT_FILE"
echo "- **Passed**: $PASS_COUNT" >> "$OUTPUT_FILE"
echo "- **Failed**: $FAIL_COUNT" >> "$OUTPUT_FILE"
echo "- **Warnings**: $WARN_COUNT" >> "$OUTPUT_FILE"

if [ $FAIL_COUNT -eq 0 ]; then
  echo "" >> "$OUTPUT_FILE"
  echo "✅ **All critical endpoints are functional!**" >> "$OUTPUT_FILE"
else
  echo "" >> "$OUTPUT_FILE"
  echo "⚠️  **Some endpoints failed. Review the failures above.**" >> "$OUTPUT_FILE"
fi

echo ""
echo "✅ Endpoint testing report generated: $OUTPUT_FILE"
echo "   - Passed: $PASS_COUNT"
echo "   - Failed: $FAIL_COUNT"
echo "   - Warnings: $WARN_COUNT"
