#!/bin/bash

# Check Region Assignment API

BASE_URL="http://34.162.168.124:3000"

echo "=========================================="
echo "Region Assignment API Check"
echo "=========================================="
echo ""

# Step 1: Login
echo "📝 Step 1: Login as Super Admin..."
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

echo "✅ Login successful!"
echo ""

# Step 2: Find test1 user ID
echo "📝 Step 2: Finding test1 user..."
ADMIN_USERS=$(curl -s -X GET "${BASE_URL}/api/admin/admin-users" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Admin users response:"
echo "$ADMIN_USERS" | head -50
echo ""

# Step 3: Check regions endpoint for test1 (assuming ID 12)
echo "📝 Step 3: Checking regions for admin user ID 12..."
REGIONS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/admin-users/12/regions" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Regions response:"
echo "$REGIONS_RESPONSE"
echo ""

# Step 4: Check if regions exist in database
echo "📝 Step 4: Checking database for regions..."
echo "Run this on GCP:"
echo "  docker exec -i teachers_training_postgres_1 psql -U teachers_user -d teachers_training << 'EOF'"
echo "    SELECT * FROM regions;"
echo "    SELECT * FROM admin_regions WHERE admin_user_id = 12;"
echo "    SELECT * FROM admin_users WHERE email = 'test1@school.edu';"
echo "  EOF"
echo ""
