#!/bin/bash

# Test Admin User Management (Create/Delete)
# Tests both API endpoints and protection mechanisms

BASE_URL="http://34.162.168.124:3000"

echo "========================================="
echo "Admin User Management API Test"
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

# Step 2: Create a new Super Admin user
echo "📝 Step 2: Creating a new Super Admin user..."
CREATE_SUPER_ADMIN=$(curl -s -X POST "${BASE_URL}/api/admin/admin-users" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.superadmin@school.edu",
    "name": "Test Super Administrator",
    "password": "TestPass123!",
    "role_name": "super_admin"
  }')

echo "Response: $CREATE_SUPER_ADMIN"

SUPER_ADMIN_ID=$(echo "$CREATE_SUPER_ADMIN" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$SUPER_ADMIN_ID" ]; then
  echo "✅ Super Admin created successfully! ID: $SUPER_ADMIN_ID"
else
  echo "⚠️  Super Admin creation response (may already exist)"
fi
echo ""

# Step 3: Create a new Regional Admin user for Tanzania (region_id=1)
echo "📝 Step 3: Creating a new Regional Admin user (Tanzania)..."
CREATE_REGIONAL_ADMIN=$(curl -s -X POST "${BASE_URL}/api/admin/admin-users" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.regionaladmin@school.edu",
    "name": "Test Regional Administrator",
    "password": "TestPass123!",
    "role_name": "admin",
    "region_ids": [1]
  }')

echo "Response: $CREATE_REGIONAL_ADMIN"

REGIONAL_ADMIN_ID=$(echo "$CREATE_REGIONAL_ADMIN" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$REGIONAL_ADMIN_ID" ]; then
  echo "✅ Regional Admin created successfully! ID: $REGIONAL_ADMIN_ID"
else
  echo "⚠️  Regional Admin creation response (may already exist)"
fi
echo ""

# Step 4: List all admin users
echo "📝 Step 4: Fetching all admin users..."
ADMIN_USERS=$(curl -s -X GET "${BASE_URL}/api/admin/admin-users" \
  -H "Authorization: Bearer ${TOKEN}")

echo "$ADMIN_USERS" | grep -o '"email":"[^"]*' | cut -d'"' -f4
echo ""

# Step 5: Test deleting the test users
if [ -n "$SUPER_ADMIN_ID" ]; then
  echo "📝 Step 5a: Deleting test Super Admin user (ID: $SUPER_ADMIN_ID)..."
  DELETE_SUPER=$(curl -s -X DELETE "${BASE_URL}/api/admin/admin-users/${SUPER_ADMIN_ID}" \
    -H "Authorization: Bearer ${TOKEN}")

  echo "Response: $DELETE_SUPER"

  if echo "$DELETE_SUPER" | grep -q '"success":true'; then
    echo "✅ Super Admin deleted successfully!"
  else
    echo "❌ Failed to delete Super Admin"
  fi
  echo ""
fi

if [ -n "$REGIONAL_ADMIN_ID" ]; then
  echo "📝 Step 5b: Deleting test Regional Admin user (ID: $REGIONAL_ADMIN_ID)..."
  DELETE_REGIONAL=$(curl -s -X DELETE "${BASE_URL}/api/admin/admin-users/${REGIONAL_ADMIN_ID}" \
    -H "Authorization: Bearer ${TOKEN}")

  echo "Response: $DELETE_REGIONAL"

  if echo "$DELETE_REGIONAL" | grep -q '"success":true'; then
    echo "✅ Regional Admin deleted successfully!"
  else
    echo "❌ Failed to delete Regional Admin"
  fi
  echo ""
fi

# Step 6: Test protection - attempt to delete system admin (should fail)
echo "📝 Step 6: Testing protection - attempting to delete system admin (admin@school.edu, ID: 1)..."
DELETE_SYSTEM=$(curl -s -X DELETE "${BASE_URL}/api/admin/admin-users/1" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Response: $DELETE_SYSTEM"

if echo "$DELETE_SYSTEM" | grep -q '"success":false'; then
  echo "✅ System admin deletion blocked (as expected)!"
else
  echo "❌ WARNING: System admin deletion was not blocked!"
fi
echo ""

# Step 7: Verify final state
echo "📝 Step 7: Final verification - listing all admin users..."
FINAL_USERS=$(curl -s -X GET "${BASE_URL}/api/admin/admin-users" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Current admin users:"
echo "$FINAL_USERS" | grep -o '"email":"[^"]*' | cut -d'"' -f4
echo ""

echo "========================================="
echo "✅ Admin User Management Test Complete!"
echo "========================================="
