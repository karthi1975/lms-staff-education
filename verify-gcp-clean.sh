#!/bin/bash

echo "🧪 Verifying GCP Database is Clean"
echo "=================================="
echo ""

# Login
echo "1. Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST http://34.162.136.203:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"Admin123!"}')

TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tokens',{}).get('accessToken',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"
echo ""

# Check courses
echo "2. Checking courses..."
COURSES=$(curl -s http://34.162.136.203:3000/api/admin/courses \
  -H "Authorization: Bearer $TOKEN")

echo "$COURSES" | python3 -m json.tool
echo ""

COURSE_COUNT=$(echo "$COURSES" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('courses',[])))" 2>/dev/null)

if [ "$COURSE_COUNT" = "0" ]; then
  echo "✅ Database is clean - 0 courses found"
else
  echo "⚠️  Found $COURSE_COUNT courses (expected 0)"
fi
