#!/bin/bash

# Create a Test Regional Admin to verify RBAC controls

BASE_URL="http://34.162.168.124:3000"

echo "==========================================="
echo "Creating Test Regional Admin"
echo "==========================================="
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

# Step 2: Create Test Regional Admin for Tanzania
echo "📝 Step 2: Creating Test Regional Admin (Tanzania)..."
CREATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/admin/admin-users" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.regional@school.edu",
    "name": "Test Regional Admin",
    "password": "Test123!",
    "role_name": "admin",
    "region_ids": [1]
  }')

echo "Response: $CREATE_RESPONSE"

ADMIN_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$ADMIN_ID" ]; then
  echo ""
  echo "✅ Test Regional Admin created successfully!"
  echo ""
  echo "==========================================="
  echo "Test Credentials"
  echo "==========================================="
  echo "Email: test.regional@school.edu"
  echo "Password: Test123!"
  echo "Role: Regional Administrator"
  echo "Assigned Region: Tanzania (TZ)"
  echo ""
  echo "Next Step: Login with these credentials and verify:"
  echo "  1. Administration section is HIDDEN in sidebar"
  echo "  2. Trying to access admin-users-rbac.html redirects to dashboard"
  echo "  3. Trying to access regions.html redirects to dashboard"
  echo ""
else
  echo "⚠️  Failed to create test admin (may already exist)"
fi
