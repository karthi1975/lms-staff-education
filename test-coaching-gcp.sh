#!/bin/bash

# Test Coaching Features on GCP
# Quick test script for deployed coaching system

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

GCP_IP="34.162.136.203"
BASE_URL="http://${GCP_IP}:3000"
API_BASE="${BASE_URL}/api/coaching"

echo "======================================"
echo "  COACHING SYSTEM - GCP TEST"
echo "======================================"
echo ""
echo "Testing on: $BASE_URL"
echo ""

# Test 1: Health check
echo -e "${YELLOW}Test 1: Server Health Check${NC}"
HEALTH=$(curl -s "${BASE_URL}/health")
echo "Response: $HEALTH"
if echo "$HEALTH" | grep -q '"status":"healthy"'; then
  echo -e "${GREEN}✅ PASS: Server is healthy${NC}"
else
  echo -e "${RED}❌ FAIL: Server health check failed${NC}"
  exit 1
fi
echo ""

# Test 2: Dashboard accessibility
echo -e "${YELLOW}Test 2: Dashboard Accessibility${NC}"
DASHBOARD_CODE=$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/admin/dashboard.html")
echo "HTTP Status: $DASHBOARD_CODE"
if [ "$DASHBOARD_CODE" = "200" ]; then
  echo -e "${GREEN}✅ PASS: Dashboard accessible${NC}"
else
  echo -e "${RED}❌ FAIL: Dashboard not accessible${NC}"
fi
echo ""

# Test 3: Coaching analytics page
echo -e "${YELLOW}Test 3: Coaching Analytics Page${NC}"
COACHING_CODE=$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/admin/coaching-analytics.html")
echo "HTTP Status: $COACHING_CODE"
if [ "$COACHING_CODE" = "200" ]; then
  echo -e "${GREEN}✅ PASS: Coaching analytics page accessible${NC}"
else
  echo -e "${RED}❌ FAIL: Coaching analytics page not accessible${NC}"
fi
echo ""

# Test 4: Check if tables exist
echo -e "${YELLOW}Test 4: Verify Database Tables${NC}"
echo "Connecting via gcloud..."
TABLES=$(gcloud compute ssh --zone "us-east5-a" "teachers-training" \
  --project "lms-tanzania-consultant" \
  --command "docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -t -c 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '\''public'\'' AND (table_name LIKE '\''%nudge%'\'' OR table_name LIKE '\''%reflection%'\'' OR table_name LIKE '\''%coaching%'\'')'" 2>/dev/null)

TABLE_COUNT=$(echo "$TABLES" | tr -d ' ')
echo "Coaching tables found: $TABLE_COUNT"
if [ "$TABLE_COUNT" -ge "4" ]; then
  echo -e "${GREEN}✅ PASS: Database tables exist${NC}"
else
  echo -e "${RED}❌ FAIL: Database tables not found${NC}"
fi
echo ""

# Test 5: Check scheduler status in logs
echo -e "${YELLOW}Test 5: Coaching Scheduler Status${NC}"
echo "Checking recent logs..."
SCHEDULER_LOG=$(gcloud compute ssh --zone "us-east5-a" "teachers-training" \
  --project "lms-tanzania-consultant" \
  --command "docker logs teachers_training_app_1 2>&1 | grep -i 'coaching scheduler' | tail -3" 2>/dev/null)

echo "$SCHEDULER_LOG"
if echo "$SCHEDULER_LOG" | grep -q "Coaching scheduler started"; then
  echo -e "${GREEN}✅ PASS: Coaching scheduler is running${NC}"
else
  echo -e "${YELLOW}⚠️  WARNING: Scheduler status unclear${NC}"
fi
echo ""

# Test 6: Test coaching API (no auth needed for stats)
echo -e "${YELLOW}Test 6: Coaching Routes Registered${NC}"
# Try to hit coaching endpoint (will fail with auth error if routes are registered)
ROUTES_TEST=$(curl -s "${API_BASE}/nudges/stats" 2>&1)
if echo "$ROUTES_TEST" | grep -q "Invalid token\|Unauthorized\|success"; then
  echo -e "${GREEN}✅ PASS: Coaching routes are registered${NC}"
else
  echo -e "${RED}❌ FAIL: Coaching routes not found${NC}"
  echo "Response: $ROUTES_TEST"
fi
echo ""

# Summary
echo "======================================"
echo "  TEST SUMMARY"
echo "======================================"
echo ""
echo -e "${GREEN}✅ GCP deployment tests completed${NC}"
echo ""
echo "Access points:"
echo "  Dashboard: ${BASE_URL}/admin/dashboard.html"
echo "  Coaching:  ${BASE_URL}/admin/coaching-analytics.html"
echo ""
echo "To run full API tests:"
echo "  BASE_URL=${BASE_URL} ./test-coaching-nudging.sh"
echo ""
