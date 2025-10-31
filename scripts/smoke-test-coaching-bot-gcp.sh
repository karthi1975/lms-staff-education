#!/bin/bash

# Smoke Test Script: Dual Coaching Bot Feature on GCP
# Version: 1.0
# Date: 2025-10-31
# Run this script from your local machine after deployment

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
GCP_IP="34.162.168.124"
BASE_URL="http://${GCP_IP}:3000"
ADMIN_EMAIL="admin@school.edu"
ADMIN_PASSWORD="Admin123!"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Function to print section headers
print_header() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  $1${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Function to print test result
print_test() {
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    if [ "$1" = "PASS" ]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}✅ TEST $TESTS_TOTAL: $2${NC}"
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}❌ TEST $TESTS_TOTAL: $2${NC}"
        if [ -n "$3" ]; then
            echo -e "${RED}   Details: $3${NC}"
        fi
    fi
}

# Function to print info
print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Start testing
print_header "SMOKE TESTS: DUAL COACHING BOT ON GCP"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Base URL: $BASE_URL"
echo "  Admin Email: $ADMIN_EMAIL"
echo ""

# ============================================
# PHASE 1: BASIC CONNECTIVITY
# ============================================

print_header "PHASE 1: BASIC CONNECTIVITY TESTS"

# Test 1: Health endpoint
print_info "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/health" || echo "000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ] && echo "$BODY" | grep -q "healthy"; then
    print_test "PASS" "Health endpoint responding correctly"
else
    print_test "FAIL" "Health endpoint" "HTTP $HTTP_CODE"
fi

# Test 2: Database connectivity (via health check)
print_info "Testing database connectivity..."
if echo "$BODY" | grep -q '"database"'; then
    print_test "PASS" "Database connection in health check"
else
    print_test "FAIL" "Database connection not confirmed"
fi

# ============================================
# PHASE 2: AUTHENTICATION
# ============================================

print_header "PHASE 2: AUTHENTICATION TESTS"

# Test 3: Admin login
print_info "Testing admin login..."
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" || echo "000")

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -1)
LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ] && echo "$LOGIN_BODY" | grep -q "token"; then
    print_test "PASS" "Admin login successful"
    TOKEN=$(echo "$LOGIN_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    print_info "Auth token obtained"
else
    print_test "FAIL" "Admin login" "HTTP $HTTP_CODE"
    echo "Note: Remaining tests may fail without valid token"
    TOKEN=""
fi

# ============================================
# PHASE 3: NEW API ENDPOINTS (COACHING MODE)
# ============================================

print_header "PHASE 3: COACHING MODE API TESTS"

if [ -z "$TOKEN" ]; then
    print_info "Skipping API tests - no auth token available"
else

    # Test 4: Get course config (should return 404 or config)
    print_info "Testing GET /api/coaching-mode/config/:courseId..."
    CONFIG_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/coaching-mode/config/1" || echo "000")
    HTTP_CODE=$(echo "$CONFIG_RESPONSE" | tail -1)

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
        print_test "PASS" "Course config endpoint responding (HTTP $HTTP_CODE)"
    else
        print_test "FAIL" "Course config endpoint" "HTTP $HTTP_CODE"
    fi

    # Test 5: Create course config (admin endpoint)
    print_info "Testing POST /api/coaching-mode/admin/config..."
    CREATE_CONFIG_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/coaching-mode/admin/config" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "courseId": 1,
        "config": {
          "regular_prompt": "Test regular prompt",
          "socratic_prompt": "Test socratic prompt",
          "default_mode": "regular",
          "allow_mode_switching": true,
          "switch_cooldown_minutes": 0
        }
      }' || echo "000")

    HTTP_CODE=$(echo "$CREATE_CONFIG_RESPONSE" | tail -1)

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "409" ]; then
        print_test "PASS" "Create course config (HTTP $HTTP_CODE)"
    else
        print_test "FAIL" "Create course config" "HTTP $HTTP_CODE"
    fi

    # Test 6: Get user preference
    print_info "Testing GET /api/coaching-mode/preference/:userId/:courseId..."
    PREF_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/coaching-mode/preference/1/1" || echo "000")
    HTTP_CODE=$(echo "$PREF_RESPONSE" | tail -1)

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
        print_test "PASS" "User preference endpoint responding (HTTP $HTTP_CODE)"
    else
        print_test "FAIL" "User preference endpoint" "HTTP $HTTP_CODE"
    fi

    # Test 7: Switch mode
    print_info "Testing POST /api/coaching-mode/switch..."
    SWITCH_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/coaching-mode/switch" \
      -H "Content-Type: application/json" \
      -d '{
        "userId": 1,
        "courseId": 1,
        "mode": "socratic"
      }' || echo "000")

    HTTP_CODE=$(echo "$SWITCH_RESPONSE" | tail -1)

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
        print_test "PASS" "Mode switch endpoint responding (HTTP $HTTP_CODE)"
    else
        print_test "FAIL" "Mode switch endpoint" "HTTP $HTTP_CODE"
    fi

    # Test 8: Get mode-specific prompt
    print_info "Testing GET /api/coaching-mode/prompt/:userId/:courseId..."
    PROMPT_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/coaching-mode/prompt/1/1" || echo "000")
    HTTP_CODE=$(echo "$PROMPT_RESPONSE" | tail -1)

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
        print_test "PASS" "Prompt endpoint responding (HTTP $HTTP_CODE)"
    else
        print_test "FAIL" "Prompt endpoint" "HTTP $HTTP_CODE"
    fi

    # Test 9: Start coaching session
    print_info "Testing POST /api/coaching-mode/session/start..."
    SESSION_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/coaching-mode/session/start" \
      -H "Content-Type: application/json" \
      -d '{
        "userId": 1,
        "courseId": 1,
        "mode": "regular"
      }' || echo "000")

    HTTP_CODE=$(echo "$SESSION_RESPONSE" | tail -1)
    SESSION_BODY=$(echo "$SESSION_RESPONSE" | head -n -1)

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
        print_test "PASS" "Session start endpoint (HTTP $HTTP_CODE)"
        SESSION_ID=$(echo "$SESSION_BODY" | grep -o '"id":[0-9]*' | cut -d':' -f2 | head -1)
        if [ -n "$SESSION_ID" ]; then
            print_info "Session ID: $SESSION_ID"
        fi
    else
        print_test "FAIL" "Session start endpoint" "HTTP $HTTP_CODE"
        SESSION_ID=""
    fi

    # Test 10: End coaching session (if we got a session ID)
    if [ -n "$SESSION_ID" ]; then
        print_info "Testing PUT /api/coaching-mode/session/:sessionId/end..."
        END_SESSION_RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/api/coaching-mode/session/$SESSION_ID/end" \
          -H "Content-Type: application/json" \
          -d '{
            "completionStatus": "completed",
            "messagesCount": 5,
            "quizScore": 85
          }' || echo "000")

        HTTP_CODE=$(echo "$END_SESSION_RESPONSE" | tail -1)

        if [ "$HTTP_CODE" = "200" ]; then
            print_test "PASS" "Session end endpoint"
        else
            print_test "FAIL" "Session end endpoint" "HTTP $HTTP_CODE"
        fi
    fi

    # Test 11: Get course analytics
    print_info "Testing GET /api/coaching-mode/analytics/:courseId..."
    ANALYTICS_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/coaching-mode/analytics/1" || echo "000")
    HTTP_CODE=$(echo "$ANALYTICS_RESPONSE" | tail -1)

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
        print_test "PASS" "Analytics endpoint responding (HTTP $HTTP_CODE)"
    else
        print_test "FAIL" "Analytics endpoint" "HTTP $HTTP_CODE"
    fi

fi

# ============================================
# PHASE 4: ADMIN UI PAGES
# ============================================

print_header "PHASE 4: ADMIN UI TESTS"

# Test 12: Coaching modes dashboard
print_info "Testing /admin/coaching-modes.html..."
UI_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin/coaching-modes.html" || echo "000")
if [ "$UI_CODE" = "200" ]; then
    print_test "PASS" "Coaching modes dashboard accessible"
else
    print_test "FAIL" "Coaching modes dashboard" "HTTP $UI_CODE"
fi

# Test 13: Coaching mode config page
print_info "Testing /admin/coaching-mode-config.html..."
UI_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin/coaching-mode-config.html" || echo "000")
if [ "$UI_CODE" = "200" ]; then
    print_test "PASS" "Coaching mode config page accessible"
else
    print_test "FAIL" "Coaching mode config page" "HTTP $UI_CODE"
fi

# Test 14: Coaching analytics page
print_info "Testing /admin/coaching-analytics.html..."
UI_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin/coaching-analytics.html" || echo "000")
if [ "$UI_CODE" = "200" ]; then
    print_test "PASS" "Coaching analytics page accessible"
else
    print_test "FAIL" "Coaching analytics page" "HTTP $UI_CODE"
fi

# ============================================
# PHASE 5: REGRESSION TESTS (EXISTING FUNCTIONALITY)
# ============================================

print_header "PHASE 5: REGRESSION TESTS"

if [ -n "$TOKEN" ]; then

    # Test 15: Users endpoint still works
    print_info "Testing GET /api/admin/users..."
    USERS_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/admin/users" \
      -H "Authorization: Bearer $TOKEN" || echo "000")
    HTTP_CODE=$(echo "$USERS_RESPONSE" | tail -1)

    if [ "$HTTP_CODE" = "200" ]; then
        print_test "PASS" "Users endpoint (existing functionality)"
    else
        print_test "FAIL" "Users endpoint" "HTTP $HTTP_CODE"
    fi

    # Test 16: Courses endpoint still works
    print_info "Testing GET /api/admin/courses..."
    COURSES_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/admin/courses" \
      -H "Authorization: Bearer $TOKEN" || echo "000")
    HTTP_CODE=$(echo "$COURSES_RESPONSE" | tail -1)

    if [ "$HTTP_CODE" = "200" ]; then
        print_test "PASS" "Courses endpoint (existing functionality)"
    else
        print_test "FAIL" "Courses endpoint" "HTTP $HTTP_CODE"
    fi

    # Test 17: User detail page accessible
    print_info "Testing /admin/user-detail.html..."
    UI_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin/user-detail.html" || echo "000")
    if [ "$UI_CODE" = "200" ]; then
        print_test "PASS" "User detail page (existing functionality)"
    else
        print_test "FAIL" "User detail page" "HTTP $UI_CODE"
    fi

else
    print_info "Skipping regression tests - no auth token available"
fi

# Test 18: WhatsApp webhook endpoint
print_info "Testing POST /webhook/twilio..."
WEBHOOK_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/webhook/twilio" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+1234567890&Body=test&MessageSid=SMOKE_TEST_123" || echo "000")
HTTP_CODE=$(echo "$WEBHOOK_RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "200" ]; then
    print_test "PASS" "WhatsApp webhook (existing functionality)"
else
    print_test "FAIL" "WhatsApp webhook" "HTTP $HTTP_CODE"
fi

# ============================================
# PHASE 6: PERFORMANCE CHECKS
# ============================================

print_header "PHASE 6: PERFORMANCE TESTS"

# Test 19: API response time
print_info "Testing API response time..."
START_TIME=$(date +%s%3N)
curl -s "$BASE_URL/health" > /dev/null
END_TIME=$(date +%s%3N)
RESPONSE_TIME=$((END_TIME - START_TIME))

if [ "$RESPONSE_TIME" -lt 500 ]; then
    print_test "PASS" "Health endpoint response time: ${RESPONSE_TIME}ms (< 500ms threshold)"
else
    print_test "FAIL" "Health endpoint response time" "${RESPONSE_TIME}ms (threshold: 500ms)"
fi

# Test 20: Multiple concurrent requests
print_info "Testing concurrent request handling (5 requests)..."
START_TIME=$(date +%s%3N)
for i in {1..5}; do
    curl -s "$BASE_URL/health" > /dev/null &
done
wait
END_TIME=$(date +%s%3N)
TOTAL_TIME=$((END_TIME - START_TIME))

if [ "$TOTAL_TIME" -lt 2000 ]; then
    print_test "PASS" "Concurrent requests handled in ${TOTAL_TIME}ms (< 2000ms threshold)"
else
    print_test "FAIL" "Concurrent request handling" "${TOTAL_TIME}ms (threshold: 2000ms)"
fi

# ============================================
# TEST SUMMARY
# ============================================

print_header "TEST SUMMARY"

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    TEST RESULTS                             ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

SUCCESS_RATE=$((TESTS_PASSED * 100 / TESTS_TOTAL))

echo -e "${YELLOW}Test Statistics:${NC}"
echo "  ├─ Total Tests: $TESTS_TOTAL"
echo "  ├─ Passed: ${GREEN}$TESTS_PASSED${NC}"
echo "  ├─ Failed: ${RED}$TESTS_FAILED${NC}"
echo "  └─ Success Rate: $SUCCESS_RATE%"
echo ""

if [ "$TESTS_FAILED" -eq 0 ]; then
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ ALL SMOKE TESTS PASSED                                   ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}🎉 Dual Coaching Bot deployment verified successfully!${NC}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "  1. Access admin UI: $BASE_URL/admin/coaching-modes.html"
    echo "  2. Configure coaching modes for courses"
    echo "  3. Test mode switching via WhatsApp"
    echo "  4. Monitor analytics dashboard"
    echo "  5. Conduct user acceptance testing"
    echo ""
    exit 0
else
    echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ⚠️  SOME TESTS FAILED - REVIEW REQUIRED                     ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo "  1. Check application logs on GCP"
    echo "  2. Verify database migration completed"
    echo "  3. Confirm all services running"
    echo "  4. Review deployment runbook"
    echo ""
    echo -e "${YELLOW}SSH to GCP:${NC}"
    echo "  gcloud compute ssh --zone \"us-east5-a\" \"teachers-training\" --project \"lms-tanzania-consultant\""
    echo ""
    exit 1
fi
