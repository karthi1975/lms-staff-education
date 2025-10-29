#!/bin/bash
set -e

BASE_URL="http://34.162.168.124:3000"

echo "🔐 Step 1: Login as admin..."
LOGIN_RESPONSE=$(curl -s -X POST ${BASE_URL}/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"Admin123!"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.tokens.accessToken // .token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  echo "$LOGIN_RESPONSE" | jq '.'
  exit 1
fi

echo "✅ Login successful"

echo ""
echo "👤 Step 2: Enroll a test user..."
PHONE_NUMBER="+255712345678"
USER_NAME="Test User"

ENROLL_RESPONSE=$(curl -s -X POST ${BASE_URL}/api/admin/users/enroll \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${USER_NAME}\",\"phoneNumber\":\"${PHONE_NUMBER}\"}")

echo "$ENROLL_RESPONSE" | jq '.'

SUCCESS=$(echo "$ENROLL_RESPONSE" | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
  echo ""
  echo "✅ Enrollment successful!"
  echo "📱 Phone: ${PHONE_NUMBER}"
  echo "👤 Name: ${USER_NAME}"
  echo "📍 PIN: $(echo "$ENROLL_RESPONSE" | jq -r '.data.pin')"
  echo "📅 Expires: $(echo "$ENROLL_RESPONSE" | jq -r '.data.expiresAt')"
else
  ERROR=$(echo "$ENROLL_RESPONSE" | jq -r '.error')
  echo ""
  if [[ "$ERROR" == *"already exists"* ]]; then
    echo "ℹ️  User already enrolled (this is OK for testing)"
  else
    echo "❌ Enrollment failed: $ERROR"
    exit 1
  fi
fi

echo ""
echo "✅ Enrollment system is working!"
