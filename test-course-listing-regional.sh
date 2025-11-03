#!/bin/bash

BASE_URL="http://34.162.168.124:3000"

echo "======================================================================="
echo "COURSE LISTING TEST - Regional Admin (test1)"
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

# Step 2: Get courses for test1
echo "📝 Step 2: Fetching courses for test1..."
COURSES_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/courses" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Courses response:"
echo "$COURSES_RESPONSE" | jq '.'
echo ""

COURSE_COUNT=$(echo "$COURSES_RESPONSE" | jq '.data | length')
echo "Course count: $COURSE_COUNT"
echo ""

if [ "$COURSE_COUNT" -gt 0 ]; then
  echo "✅ test1 can see $COURSE_COUNT course(s)"
  echo ""
  echo "Courses:"
  echo "$COURSES_RESPONSE" | jq -r '.data[] | "  - \(.title) (\(.code)) - Region: \(.region_id)"'
else
  echo "❌ test1 cannot see any courses (expected 2 Tanzania courses)"
fi

echo ""
echo "======================================================================="
echo "SUPER ADMIN COMPARISON"
echo "======================================================================="
echo ""

# Step 3: Login as Super Admin
echo "📝 Step 3: Login as Super Admin (Lynda)..."
SUPER_LOGIN=$(curl -s -X POST "${BASE_URL}/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "Lynda@admin.com",
    "password": "Admin123!"
  }')

SUPER_TOKEN=$(echo "$SUPER_LOGIN" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$SUPER_TOKEN" ]; then
  echo "❌ Super admin login failed!"
  exit 1
fi

echo "✅ Super admin login successful!"
echo ""

# Step 4: Get courses for Super Admin
echo "📝 Step 4: Fetching courses for Super Admin..."
SUPER_COURSES=$(curl -s -X GET "${BASE_URL}/api/admin/courses" \
  -H "Authorization: Bearer ${SUPER_TOKEN}")

SUPER_COUNT=$(echo "$SUPER_COURSES" | jq '.data | length')
echo "Super Admin can see: $SUPER_COUNT courses"
echo ""

echo "======================================================================="
echo "SUMMARY"
echo "======================================================================="
echo "test1 (Tanzania Regional Admin): $COURSE_COUNT courses"
echo "Lynda (Super Admin): $SUPER_COUNT courses"
echo ""

if [ "$COURSE_COUNT" -eq 2 ] && [ "$SUPER_COUNT" -eq 2 ]; then
  echo "✅ BOTH can see 2 courses (correct for Tanzania-only courses)"
elif [ "$COURSE_COUNT" -eq 2 ] && [ "$SUPER_COUNT" -gt "$COURSE_COUNT" ]; then
  echo "✅ RBAC WORKING: test1 sees 2 Tanzania courses, Super Admin sees all"
else
  echo "⚠️  Check results above"
fi
