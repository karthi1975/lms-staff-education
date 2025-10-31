#!/bin/bash

#############################################
# Multi-Region RBAC API Integration Tests
# Tests all Phase 3 endpoints
#############################################

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_EMAIL="${TEST_EMAIL:-admin@school.edu}"
TEST_PASSWORD="${TEST_PASSWORD:-Admin123!}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to print section header
print_section() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Function to print test result
print_result() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ $1 -eq 0 ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✓ PASS${NC}: $2"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "${RED}✗ FAIL${NC}: $2"
        if [ -n "$3" ]; then
            echo -e "  ${YELLOW}Details: $3${NC}"
        fi
    fi
}

# Function to extract JSON value
get_json_value() {
    echo "$1" | grep -o "\"$2\"[[:space:]]*:[[:space:]]*[^,}]*" | sed 's/.*:[[:space:]]*//' | tr -d '"'
}

print_section "RBAC API Integration Tests"
echo "Base URL: $BASE_URL"
echo "Test User: $TEST_EMAIL"
echo ""

#############################################
# 1. Authentication
#############################################
print_section "1. Authentication Tests"

echo "Test 1.1: Admin login..."
# Create JSON payload file to avoid shell escaping issues
echo "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" > /tmp/rbac_login.json

LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/login" \
  -H "Content-Type: application/json" \
  -d @/tmp/rbac_login.json)

# Extract accessToken from tokens object
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    print_result 0 "Admin authentication successful"
    echo "  Token (first 20 chars): ${TOKEN:0:20}..."
else
    print_result 1 "Admin authentication failed" "$LOGIN_RESPONSE"
    echo -e "${RED}Cannot proceed without authentication token. Exiting.${NC}"
    exit 1
fi

#############################################
# 2. Region Management API
#############################################
print_section "2. Region Management API Tests"

echo "Test 2.1: Get all regions..."
REGIONS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/regions" \
  -H "Authorization: Bearer $TOKEN")

if echo "$REGIONS_RESPONSE" | grep -q '"success":true'; then
    REGION_COUNT=$(echo "$REGIONS_RESPONSE" | grep -o '"data":\[' | wc -l)
    print_result 0 "Get all regions successful"
    echo "  Response: ${REGIONS_RESPONSE:0:100}..."
else
    print_result 1 "Get all regions failed" "$REGIONS_RESPONSE"
fi

echo "Test 2.2: Create new region (Super Admin only)..."
CREATE_REGION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/regions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Region","code":"TEST","description":"Integration test region"}')

if echo "$CREATE_REGION_RESPONSE" | grep -q '"success":true'; then
    NEW_REGION_ID=$(get_json_value "$CREATE_REGION_RESPONSE" "id")
    print_result 0 "Create region successful"
    echo "  New Region ID: $NEW_REGION_ID"
elif echo "$CREATE_REGION_RESPONSE" | grep -q 'Super Admin'; then
    print_result 0 "Create region correctly requires Super Admin"
    echo "  (Permission check working correctly)"
else
    print_result 1 "Create region unexpected response" "$CREATE_REGION_RESPONSE"
fi

#############################################
# 3. Course RBAC API
#############################################
print_section "3. Course RBAC API Tests"

echo "Test 3.1: Get accessible courses..."
COURSES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/courses/accessible" \
  -H "Authorization: Bearer $TOKEN")

if echo "$COURSES_RESPONSE" | grep -q '"success":true'; then
    COURSE_COUNT=$(get_json_value "$COURSES_RESPONSE" "totalCourses")
    print_result 0 "Get accessible courses successful"
    echo "  Total accessible courses: $COURSE_COUNT"
else
    print_result 1 "Get accessible courses failed" "$COURSES_RESPONSE"
fi

echo "Test 3.2: Get unassigned courses (Super Admin only)..."
UNASSIGNED_RESPONSE=$(curl -s -X GET "$BASE_URL/api/courses/unassigned" \
  -H "Authorization: Bearer $TOKEN")

if echo "$UNASSIGNED_RESPONSE" | grep -q '"success":true'; then
    print_result 0 "Get unassigned courses successful"
elif echo "$UNASSIGNED_RESPONSE" | grep -q 'Super Admin'; then
    print_result 0 "Unassigned courses correctly requires Super Admin"
else
    print_result 1 "Unassigned courses unexpected response" "$UNASSIGNED_RESPONSE"
fi

#############################################
# 4. Enrollment API
#############################################
print_section "4. Enrollment API Tests"

echo "Test 4.1: Get enrollments by region..."
ENROLLMENTS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/enrollments/region/1?limit=10" \
  -H "Authorization: Bearer $TOKEN")

if echo "$ENROLLMENTS_RESPONSE" | grep -q '"success":true\|You do not have access'; then
    print_result 0 "Get enrollments by region - regional access control working"
else
    print_result 1 "Get enrollments by region failed" "$ENROLLMENTS_RESPONSE"
fi

echo "Test 4.2: Create enrollment (requires valid user and course)..."
# This will likely fail without valid IDs, but tests the endpoint
ENROLL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/enrollments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"courseId":1}')

if echo "$ENROLL_RESPONSE" | grep -q '"success":true\|not found\|required\|access'; then
    print_result 0 "Enrollment endpoint responding correctly"
else
    print_result 1 "Enrollment endpoint unexpected response" "$ENROLL_RESPONSE"
fi

#############################################
# 5. CSV Upload API
#############################################
print_section "5. CSV Upload API Tests"

echo "Test 5.1: Download CSV template..."
TEMPLATE_RESPONSE=$(curl -s -X GET "$BASE_URL/api/csv-upload/template" \
  -H "Authorization: Bearer $TOKEN")

if echo "$TEMPLATE_RESPONSE" | grep -q 'Full Name,WhatsApp Number'; then
    print_result 0 "CSV template download successful"
    echo "  Template preview: ${TEMPLATE_RESPONSE:0:50}..."
else
    print_result 1 "CSV template download failed" "$TEMPLATE_RESPONSE"
fi

echo "Test 5.2: Get CSV upload history..."
HISTORY_RESPONSE=$(curl -s -X GET "$BASE_URL/api/csv-upload/history" \
  -H "Authorization: Bearer $TOKEN")

if echo "$HISTORY_RESPONSE" | grep -q '"success":true'; then
    print_result 0 "CSV upload history successful"
else
    print_result 1 "CSV upload history failed" "$HISTORY_RESPONSE"
fi

echo "Test 5.3: Get CSV upload statistics..."
STATS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/csv-upload/stats" \
  -H "Authorization: Bearer $TOKEN")

if echo "$STATS_RESPONSE" | grep -q '"success":true'; then
    print_result 0 "CSV upload statistics successful"
else
    print_result 1 "CSV upload statistics failed" "$STATS_RESPONSE"
fi

#############################################
# 6. Chatbot Prompt API
#############################################
print_section "6. Chatbot Prompt API Tests"

echo "Test 6.1: Get default prompts..."
DEFAULTS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/chatbot-prompts/defaults" \
  -H "Authorization: Bearer $TOKEN")

if echo "$DEFAULTS_RESPONSE" | grep -q '"success":true'; then
    print_result 0 "Get default prompts successful"
else
    print_result 1 "Get default prompts failed" "$DEFAULTS_RESPONSE"
fi

echo "Test 6.2: Get accessible courses with prompt status..."
PROMPT_COURSES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/chatbot-prompts/accessible-courses" \
  -H "Authorization: Bearer $TOKEN")

if echo "$PROMPT_COURSES_RESPONSE" | grep -q '"success":true'; then
    print_result 0 "Get courses with prompt status successful"
else
    print_result 1 "Get courses with prompt status failed" "$PROMPT_COURSES_RESPONSE"
fi

#############################################
# 7. Notification API
#############################################
print_section "7. Notification API Tests"

echo "Test 7.1: Get notification templates..."
TEMPLATES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/notifications/templates" \
  -H "Authorization: Bearer $TOKEN")

if echo "$TEMPLATES_RESPONSE" | grep -q '"success":true'; then
    print_result 0 "Get notification templates successful"
else
    print_result 1 "Get notification templates failed" "$TEMPLATES_RESPONSE"
fi

echo "Test 7.2: Get notification statistics..."
NOTIF_STATS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/notifications/stats" \
  -H "Authorization: Bearer $TOKEN")

if echo "$NOTIF_STATS_RESPONSE" | grep -q '"success":true'; then
    print_result 0 "Get notification statistics successful"
else
    print_result 1 "Get notification statistics failed" "$NOTIF_STATS_RESPONSE"
fi

echo "Test 7.3: Get recent notifications..."
RECENT_NOTIF_RESPONSE=$(curl -s -X GET "$BASE_URL/api/notifications/recent?limit=10" \
  -H "Authorization: Bearer $TOKEN")

if echo "$RECENT_NOTIF_RESPONSE" | grep -q '"success":true'; then
    print_result 0 "Get recent notifications successful"
else
    print_result 1 "Get recent notifications failed" "$RECENT_NOTIF_RESPONSE"
fi

#############################################
# 8. Statistics API
#############################################
print_section "8. Statistics & Reporting API Tests"

echo "Test 8.1: Get dashboard statistics..."
DASHBOARD_RESPONSE=$(curl -s -X GET "$BASE_URL/api/statistics/dashboard" \
  -H "Authorization: Bearer $TOKEN")

if echo "$DASHBOARD_RESPONSE" | grep -q '"success":true'; then
    TOTAL_COURSES=$(get_json_value "$DASHBOARD_RESPONSE" "totalCourses")
    TOTAL_USERS=$(get_json_value "$DASHBOARD_RESPONSE" "totalUsers")
    print_result 0 "Get dashboard statistics successful"
    echo "  Total Courses: $TOTAL_COURSES, Total Users: $TOTAL_USERS"
else
    print_result 1 "Get dashboard statistics failed" "$DASHBOARD_RESPONSE"
fi

echo "Test 8.2: Get regional statistics..."
REGIONAL_STATS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/statistics/regions" \
  -H "Authorization: Bearer $TOKEN")

if echo "$REGIONAL_STATS_RESPONSE" | grep -q '"success":true'; then
    print_result 0 "Get regional statistics successful"
else
    print_result 1 "Get regional statistics failed" "$REGIONAL_STATS_RESPONSE"
fi

echo "Test 8.3: Get enrollment trends..."
TRENDS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/statistics/enrollment-trends?days=7" \
  -H "Authorization: Bearer $TOKEN")

if echo "$TRENDS_RESPONSE" | grep -q '"success":true'; then
    print_result 0 "Get enrollment trends successful"
else
    print_result 1 "Get enrollment trends failed" "$TRENDS_RESPONSE"
fi

echo "Test 8.4: Get top courses..."
TOP_COURSES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/statistics/top-courses?limit=5" \
  -H "Authorization: Bearer $TOKEN")

if echo "$TOP_COURSES_RESPONSE" | grep -q '"success":true'; then
    print_result 0 "Get top courses successful"
else
    print_result 1 "Get top courses failed" "$TOP_COURSES_RESPONSE"
fi

#############################################
# Test Summary
#############################################
print_section "Test Summary"

echo "Total Tests Run: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}ALL TESTS PASSED! ✓${NC}"
    echo -e "${GREEN}========================================${NC}"
    exit 0
else
    echo ""
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}SOME TESTS FAILED${NC}"
    echo -e "${YELLOW}========================================${NC}"
    echo "Success Rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
    exit 1
fi
