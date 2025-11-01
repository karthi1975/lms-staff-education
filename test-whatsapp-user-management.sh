#!/bin/bash

# Test WhatsApp User Management (Create/Delete)
# Tests the user-management.html create/delete functionality for WhatsApp users

BASE_URL="http://34.162.168.124:3000"

echo "========================================="
echo "WhatsApp User Management API Test"
echo "========================================="
echo ""

# Step 1: Login as Super Admin (Lynda)
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
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful! Token obtained."
echo ""

# Step 2: Create a test WhatsApp user
echo "📝 Step 2: Creating a test WhatsApp user..."
CREATE_WHATSAPP_USER=$(curl -s -X POST "${BASE_URL}/api/admin/users/enroll" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test WhatsApp User",
    "phoneNumber": "+255999888777"
  }')

echo "Response: $CREATE_WHATSAPP_USER"

WHATSAPP_USER_ID=$(echo "$CREATE_WHATSAPP_USER" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$WHATSAPP_USER_ID" ]; then
  echo "✅ WhatsApp user created successfully! ID: $WHATSAPP_USER_ID"
else
  echo "⚠️  WhatsApp user creation response (may already exist)"
  # Try to get the ID from existing user
  EXISTING_USER=$(curl -s -X GET "${BASE_URL}/api/admin/users" \
    -H "Authorization: Bearer ${TOKEN}")
  WHATSAPP_USER_ID=$(echo "$EXISTING_USER" | grep -o '"whatsapp_id":"+255999888777"' -B 10 | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
  if [ -n "$WHATSAPP_USER_ID" ]; then
    echo "Found existing user with ID: $WHATSAPP_USER_ID"
  fi
fi
echo ""

# Step 3: List all WhatsApp users
echo "📝 Step 3: Fetching all WhatsApp users..."
WHATSAPP_USERS=$(curl -s -X GET "${BASE_URL}/api/admin/users" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Sample WhatsApp users:"
echo "$WHATSAPP_USERS" | grep -o '"whatsapp_id":"[^"]*' | head -5 | cut -d'"' -f4
echo ""

# Step 4: Test deleting the test WhatsApp user
if [ -n "$WHATSAPP_USER_ID" ]; then
  echo "📝 Step 4: Deleting test WhatsApp user (ID: $WHATSAPP_USER_ID)..."
  DELETE_WHATSAPP=$(curl -s -X DELETE "${BASE_URL}/api/admin/users/${WHATSAPP_USER_ID}" \
    -H "Authorization: Bearer ${TOKEN}")

  echo "Response: $DELETE_WHATSAPP"

  if echo "$DELETE_WHATSAPP" | grep -q '"success":true'; then
    echo "✅ WhatsApp user deleted successfully!"
  else
    echo "❌ Failed to delete WhatsApp user"
  fi
  echo ""
else
  echo "⚠️  Skipping delete test - no user ID available"
  echo ""
fi

# Step 5: Create another test user with different region
echo "📝 Step 5: Creating a WhatsApp user for Rwanda region..."
CREATE_RWANDA_USER=$(curl -s -X POST "${BASE_URL}/api/admin/users/enroll" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Rwanda WhatsApp User",
    "phoneNumber": "+250777666555"
  }')

echo "Response: $CREATE_RWANDA_USER"

RWANDA_USER_ID=$(echo "$CREATE_RWANDA_USER" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$RWANDA_USER_ID" ]; then
  echo "✅ Rwanda WhatsApp user created successfully! ID: $RWANDA_USER_ID"

  # Clean up
  echo ""
  echo "📝 Cleaning up: Deleting Rwanda test user..."
  DELETE_RWANDA=$(curl -s -X DELETE "${BASE_URL}/api/admin/users/${RWANDA_USER_ID}" \
    -H "Authorization: Bearer ${TOKEN}")

  if echo "$DELETE_RWANDA" | grep -q '"success":true'; then
    echo "✅ Rwanda test user cleaned up successfully!"
  fi
else
  echo "⚠️  Rwanda WhatsApp user creation response (may already exist)"
fi
echo ""

# Step 6: Verify final state
echo "📝 Step 6: Final verification - counting WhatsApp users by region..."
FINAL_USERS=$(curl -s -X GET "${BASE_URL}/api/admin/users" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Total WhatsApp users in system:"
echo "$FINAL_USERS" | grep -o '"whatsapp_id":"[^"]*' | wc -l | xargs echo
echo ""

echo "========================================="
echo "✅ WhatsApp User Management Test Complete!"
echo "========================================="
