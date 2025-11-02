#!/bin/bash

# Setup RBAC Test Data
# This script:
# 1. Assigns role_id to the test Regional Admin
# 2. Assigns primary_region_id to test users
# 3. Verifies the setup

BASE_URL="${BASE_URL:-http://34.162.168.124:3000}"

echo "=========================================="
echo "Setting Up RBAC Test Data"
echo "=========================================="
echo ""

# Login as Super Admin
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

# Get database connection and run SQL updates
echo "📝 Step 2: Connecting to database on GCP..."
echo ""
echo "Please run the following SQL commands on GCP PostgreSQL:"
echo ""
echo "  gcloud compute ssh teachers-training --zone 'us-east5-a'"
echo ""
echo "Then run:"
echo ""
echo "  docker exec -it teachers_training_postgres_1 psql -U teachers_user -d teachers_training"
echo ""
echo "Execute these SQL commands:"
echo ""
echo "  -- Step 1: Fix Regional Admin role_id and primary_region_id"
echo "  UPDATE admin_users "
echo "  SET role_id = 2, primary_region_id = 1 "
echo "  WHERE email = 'test.regional@school.edu';"
echo ""
echo "  -- Step 2: Assign Tanzania region to existing WhatsApp users"
echo "  UPDATE users "
echo "  SET primary_region_id = 1 "
echo "  WHERE id <= 5;  -- Adjust this to assign first 5 users to Tanzania"
echo ""
echo "  -- Step 3: Verify assignments"
echo "  SELECT id, email, role_id, primary_region_id FROM admin_users WHERE email = 'test.regional@school.edu';"
echo "  SELECT id, name, whatsapp_id, primary_region_id FROM users WHERE primary_region_id = 1 LIMIT 10;"
echo ""
echo "  \\q  -- Exit psql"
echo ""
echo "✅ After running these SQL commands, test with:"
echo "  node test-user-management-rbac.js"
echo ""
