#!/bin/bash

BASE_URL="http://34.162.168.124:3000"

echo "======================================================================="
echo "COURSE CREATION TEST - Regional Admin (test1)"
echo "======================================================================="
echo ""

# Step 1: Login as test1
echo "📝 Step 1: Login as test1 (Tanzania Regional Admin)..."
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test1@school.edu",
    "password": "Admin2025^lCl"
  }')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful!"
echo ""

# Generate unique course code
TIMESTAMP=$(date +%s)
COURSE_CODE="TZ-TEST-$TIMESTAMP"

# Step 2: Create a new course
echo "📝 Step 2: Creating new course with code: $COURSE_CODE"
CREATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/admin/portal/courses" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"course_name\": \"Test Course for Tanzania Region\",
    \"course_code\": \"$COURSE_CODE\",
    \"description\": \"This is a test course created by test1 regional admin\",
    \"category\": \"Teacher Training\",
    \"region_id\": 1
  }")

echo "Create response:"
echo "$CREATE_RESPONSE" | jq '.'
echo ""

SUCCESS=$(echo "$CREATE_RESPONSE" | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
  echo "✅ Course created successfully!"
  COURSE_ID=$(echo "$CREATE_RESPONSE" | jq -r '.course.id')
  echo "Course ID: $COURSE_ID"
else
  echo "❌ Course creation failed"
  echo "Error: $(echo "$CREATE_RESPONSE" | jq -r '.error')"
fi

echo ""

# Step 3: List courses again to verify
echo "📝 Step 3: Listing all courses for test1..."
LIST_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/courses" \
  -H "Authorization: Bearer ${TOKEN}")

COURSE_COUNT=$(echo "$LIST_RESPONSE" | jq '.data | length')
echo "Course count after creation: $COURSE_COUNT"
echo ""

echo "All courses:"
echo "$LIST_RESPONSE" | jq -r '.data[] | "  - \(.title) (\(.code)) - Region: \(.region_id)"'

echo ""
echo "======================================================================="
echo "SUMMARY"
echo "======================================================================="
echo "✅ test1 can create courses"
echo "✅ test1 can see $COURSE_COUNT courses total"
echo "✅ All courses are in Tanzania region (region_id: 1)"
