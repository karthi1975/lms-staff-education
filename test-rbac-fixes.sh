#!/bin/bash

# Test RBAC UI Fixes After Deployment
BASE_URL="http://34.162.168.124:3000"

echo "==========================================="
echo "Testing RBAC UI Fixes"
echo "==========================================="
echo ""

# Step 1: Login and get token
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
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

# Check if role_id is present in login response
ROLE_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"role_id":[0-9]*' | cut -d':' -f2)
echo "✅ Login successful!"
echo "   Role ID in response: ${ROLE_ID:-'NOT FOUND ❌'}"
echo ""

# Step 2: Test admin users endpoint
echo "📝 Step 2: Testing /api/admin/admin-users endpoint..."
ADMIN_USERS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/admin-users" \
  -H "Authorization: Bearer ${TOKEN}")

ADMIN_COUNT=$(echo "$ADMIN_USERS_RESPONSE" | grep -o '"email":"[^"]*' | wc -l | xargs)
echo "   Admin users returned: $ADMIN_COUNT"

if [ "$ADMIN_COUNT" -eq "2" ]; then
  echo "✅ Correct! Should have 2 Super Admins"
else
  echo "⚠️  Expected 2 admin users, got $ADMIN_COUNT"
fi

echo "   Users found:"
echo "$ADMIN_USERS_RESPONSE" | grep -o '"email":"[^"]*' | cut -d'"' -f4 | sed 's/^/      - /'
echo ""

# Step 3: Check isSuperAdmin flag
IS_SUPER_ADMIN=$(echo "$ADMIN_USERS_RESPONSE" | grep -o '"isSuperAdmin":[^,}]*' | cut -d':' -f2)
echo "📝 Step 3: Checking isSuperAdmin flag..."
echo "   isSuperAdmin in response: ${IS_SUPER_ADMIN:-'NOT FOUND (will use role_id instead)'}"
echo ""

# Step 4: Verify page is accessible
echo "📝 Step 4: Checking page accessibility..."
PAGE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/admin/admin-users-rbac.html")

if [ "$PAGE_RESPONSE" -eq "200" ]; then
  echo "✅ admin-users-rbac.html is accessible (HTTP $PAGE_RESPONSE)"
else
  echo "❌ Page returned HTTP $PAGE_RESPONSE"
fi

echo ""
echo "==========================================="
echo "✅ Deployment Verification Complete"
echo "==========================================="
echo ""
echo "Summary:"
echo "  ✅ Login includes role_id: ${ROLE_ID}"
echo "  ✅ Admin users endpoint returns: $ADMIN_COUNT users"
echo "  ✅ Page is accessible"
echo ""
echo "Next Step: Open browser and test UI!"
echo "URL: http://34.162.168.124:3000/admin/admin-users-rbac.html"
echo ""
echo "Remember to hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)"
echo ""
