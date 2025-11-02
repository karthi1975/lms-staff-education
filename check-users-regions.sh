#!/bin/bash

# Check users and their region assignments
# This helps verify RBAC setup before testing

BASE_URL="${BASE_URL:-http://34.162.168.124:3000}"

echo "=========================================="
echo "Checking User Region Assignments"
echo "=========================================="
echo ""

# Step 1: Login as Super Admin
echo "📝 Step 1: Logging in as Super Admin..."
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

# Step 2: Check all WhatsApp users and their regions
echo "📝 Step 2: Fetching all WhatsApp users..."
USERS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/users" \
  -H "Authorization: Bearer ${TOKEN}")

echo "$USERS_RESPONSE" | grep -o '"name":"[^"]*' | cut -d'"' -f4 | head -10
echo ""

# Step 3: Check Regional Admin's region assignment
echo "📝 Step 3: Checking test.regional@school.edu region assignment..."

# Login as Regional Admin
REGIONAL_LOGIN=$(curl -s -X POST "${BASE_URL}/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.regional@school.edu",
    "password": "Test123!"
  }')

REGIONAL_TOKEN=$(echo "$REGIONAL_LOGIN" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$REGIONAL_TOKEN" ]; then
  echo "❌ Regional Admin login failed!"
  echo "Create Regional Admin first using: ./create-test-regional-admin.sh"
  exit 1
fi

# Get user data to check region
REGIONAL_USER=$(echo "$REGIONAL_LOGIN" | grep -o '"user":{[^}]*}')
echo "Regional Admin User Data: $REGIONAL_USER"
echo ""

# Step 4: Fetch users as Regional Admin
echo "📝 Step 4: Fetching users visible to Regional Admin..."
REGIONAL_USERS=$(curl -s -X GET "${BASE_URL}/api/admin/users" \
  -H "Authorization: Bearer ${REGIONAL_TOKEN}")

REGIONAL_COUNT=$(echo "$REGIONAL_USERS" | grep -o '"id":' | wc -l)
echo "Regional Admin can see: $REGIONAL_COUNT users"
echo ""

echo "=========================================="
echo "SUMMARY"
echo "=========================================="
echo "If Regional Admin sees 0 users, you need to:"
echo "  1. Assign primary_region_id to WhatsApp users"
echo "  2. Set primary_region_id = 1 (Tanzania) for test users"
echo ""
echo "SQL commands to fix:"
echo "  UPDATE users SET primary_region_id = 1 WHERE id IN (1, 2, 3);"
echo ""
