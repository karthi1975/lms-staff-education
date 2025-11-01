#!/bin/bash

# Test WhatsApp User Deletion
# Tests the delete functionality for WhatsApp users

BASE_URL="http://34.162.168.124:3000"

echo "========================================="
echo "WhatsApp User Deletion Test"
echo "========================================="
echo ""

# Step 1: Login as Super Admin
echo "📝 Step 1: Logging in as Super Admin (Lynda@admin.com)..."
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

echo "✅ Login successful!"
echo ""

# Step 2: Get list of WhatsApp users
echo "📝 Step 2: Fetching all WhatsApp users..."
USERS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/users" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Current WhatsApp users (first 5):"
echo "$USERS_RESPONSE" | grep -o '"whatsapp_id":"[^"]*' | head -5 | cut -d'"' -f4
echo ""

# Get a test user ID (one of the users we created earlier)
# Let's try to find the "Test WhatsApp User" or use a known test ID
TEST_USER_ID=$(echo "$USERS_RESPONSE" | grep -B 5 '"+255712345001"' | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -z "$TEST_USER_ID" ]; then
  echo "❌ Could not find a test user to delete"
  echo "Available users:"
  echo "$USERS_RESPONSE" | grep -o '"id":[0-9]*,"whatsapp_id":"[^"]*' | head -10
  exit 1
fi

echo "Found test user ID: $TEST_USER_ID (Amina Hassan - +255712345001)"
echo ""

# Step 3: Test delete endpoint
echo "📝 Step 3: Testing DELETE /api/admin/users/${TEST_USER_ID}..."
DELETE_RESPONSE=$(curl -s -X DELETE "${BASE_URL}/api/admin/users/${TEST_USER_ID}" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Response: $DELETE_RESPONSE"
echo ""

if echo "$DELETE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Delete endpoint works!"
  echo ""

  # Verify user is deleted
  echo "📝 Verifying user is deleted..."
  VERIFY_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/users" \
    -H "Authorization: Bearer ${TOKEN}")

  if echo "$VERIFY_RESPONSE" | grep -q "+255712345001"; then
    echo "❌ User still exists in database"
  else
    echo "✅ User successfully removed from database"
  fi
else
  echo "❌ Delete failed"
fi

echo ""
echo "========================================="
echo "Delete Test Complete"
echo "========================================="
