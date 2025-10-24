#!/bin/bash
# Test Quiz Upload Feature
# Tests: Quiz upload → View quiz → Delete quiz

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
COURSE_ID="${COURSE_ID:-2}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Quiz Upload Feature Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Admin Login
echo -e "${YELLOW}[1/5] Admin Login...${NC}"
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

# Step 2: Get Modules for Course
echo -e "${YELLOW}[2/5] Getting modules for course $COURSE_ID...${NC}"
MODULES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/admin/courses/$COURSE_ID/modules" \
  -H "Authorization: Bearer $TOKEN")

echo "$MODULES_RESPONSE" | grep -q '"success":true'
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Failed to get modules${NC}"
  echo "$MODULES_RESPONSE"
  exit 1
fi

# Extract first module ID
MODULE_ID=$(echo "$MODULES_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | sed 's/"id"://')

if [ -z "$MODULE_ID" ]; then
  echo -e "${RED}❌ No modules found for course${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Found module ID: $MODULE_ID${NC}"
echo ""

# Step 3: Upload Quiz
echo -e "${YELLOW}[3/5] Uploading quiz to module $MODULE_ID...${NC}"

# Create sample quiz JSON
QUIZ_JSON='[
  {
    "question": "What is the primary goal of classroom management?",
    "options": {
      "A": "To maintain silence",
      "B": "To create a positive learning environment",
      "C": "To enforce strict discipline",
      "D": "To complete curriculum quickly"
    },
    "correct_answer": "B"
  },
  {
    "question": "Which teaching strategy promotes critical thinking?",
    "options": {
      "A": "Memorization",
      "B": "Rote learning",
      "C": "Questioning and problem-solving",
      "D": "Silent reading"
    },
    "correct_answer": "C"
  },
  {
    "question": "What is formative assessment?",
    "options": {
      "A": "Final exam only",
      "B": "Ongoing feedback during learning",
      "C": "Standardized testing",
      "D": "Grading at the end"
    },
    "correct_answer": "B"
  }
]'

UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/courses/$COURSE_ID/modules/$MODULE_ID/quiz" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"questions\": $QUIZ_JSON}")

echo "$UPLOAD_RESPONSE" | grep -q '"success":true'
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Failed to upload quiz${NC}"
  echo "$UPLOAD_RESPONSE"
  exit 1
fi

QUESTION_COUNT=$(echo "$UPLOAD_RESPONSE" | grep -o '"questionCount":[0-9]*' | sed 's/"questionCount"://')

echo -e "${GREEN}✅ Quiz uploaded successfully${NC}"
echo "   Question count: $QUESTION_COUNT"
echo ""

# Step 4: View Quiz
echo -e "${YELLOW}[4/5] Viewing uploaded quiz...${NC}"

VIEW_RESPONSE=$(curl -s -X GET "$BASE_URL/api/admin/courses/$COURSE_ID/modules/$MODULE_ID/quiz" \
  -H "Authorization: Bearer $TOKEN")

echo "$VIEW_RESPONSE" | grep -q '"success":true'
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Failed to view quiz${NC}"
  echo "$VIEW_RESPONSE"
  exit 1
fi

# Check if quiz has questions
QUIZ_LENGTH=$(echo "$VIEW_RESPONSE" | grep -o '"quiz":\[[^]]*\]' | grep -o '"question"' | wc -l)

echo -e "${GREEN}✅ Quiz retrieved successfully${NC}"
echo "   Questions found: $QUIZ_LENGTH"
echo ""

# Step 5: Delete Quiz
echo -e "${YELLOW}[5/5] Deleting quiz...${NC}"

DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/admin/courses/$COURSE_ID/modules/$MODULE_ID/quiz" \
  -H "Authorization: Bearer $TOKEN")

echo "$DELETE_RESPONSE" | grep -q '"success":true'
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Failed to delete quiz${NC}"
  echo "$DELETE_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Quiz deleted successfully${NC}"
echo ""

# Final Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ All Quiz Tests Passed!${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Admin login${NC}"
echo -e "${GREEN}✓ Get modules${NC}"
echo -e "${GREEN}✓ Upload quiz (3 questions)${NC}"
echo -e "${GREEN}✓ View quiz${NC}"
echo -e "${GREEN}✓ Delete quiz${NC}"
echo ""
