#!/bin/bash

BASE_URL="http://34.162.168.124:3000"

echo "Reset test1 password"
echo "===================="

# Step 1: Login as Super Admin
echo "Logging in as Super Admin..."
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "Lynda@admin.com",
    "password": "Admin123!"
  }')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  exit 1
fi

echo "✅ Logged in"
echo ""

# Step 2: Reset test1's password
echo "Resetting test1's password to 'Test123!'..."
RESET_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/admin/admin-users/12/reset-password" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "newPassword": "Test123!"
  }')

echo "Response:"
echo "$RESET_RESPONSE" | jq '.'
echo ""

# Step 3: Test login with new password
echo "Testing login with new password..."
TEST_LOGIN=$(curl -s -X POST "${BASE_URL}/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test1@school.edu",
    "password": "Test123!"
  }')

TEST_TOKEN=$(echo "$TEST_LOGIN" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TEST_TOKEN" ]; then
  echo "❌ Login still failed!"
  echo "$TEST_LOGIN"
else
  echo "✅ Login successful with new password!"
fi
