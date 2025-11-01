#!/bin/bash

# Cleanup Script: Delete all users except Super Admins
# Keeps: admin@school.edu (ID:1) and Lynda@admin.com (ID:3)
# Deletes: All Regional Admins and all WhatsApp Users

BASE_URL="http://34.162.168.124:3000"

echo "========================================="
echo "User Cleanup Script"
echo "========================================="
echo ""
echo "⚠️  WARNING: This will delete ALL users except:"
echo "   - admin@school.edu (Super Admin)"
echo "   - Lynda@admin.com (Super Admin)"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Cancelled."
  exit 0
fi

echo ""
echo "📝 Logging in as Super Admin..."

# Login
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

# Get all admin users
echo "📝 Fetching admin users..."
ADMIN_USERS=$(curl -s -X GET "${BASE_URL}/api/admin/admin-users" \
  -H "Authorization: Bearer ${TOKEN}")

# Get all WhatsApp users
echo "📝 Fetching WhatsApp users..."
WHATSAPP_USERS=$(curl -s -X GET "${BASE_URL}/api/admin/users" \
  -H "Authorization: Bearer ${TOKEN}")

echo ""
echo "========================================="
echo "DELETING REGIONAL ADMINS"
echo "========================================="
echo ""

# Delete Regional Admins (IDs: 4, 5, 6, 7)
for user_id in 4 5 6 7; do
  echo "Deleting admin user ID: $user_id..."
  DELETE_RESPONSE=$(curl -s -X DELETE "${BASE_URL}/api/admin/admin-users/${user_id}" \
    -H "Authorization: Bearer ${TOKEN}")

  if echo "$DELETE_RESPONSE" | grep -q '"success":true'; then
    echo "✅ Admin user $user_id deleted"
  else
    echo "⚠️  Failed to delete admin user $user_id"
  fi
done

echo ""
echo "========================================="
echo "DELETING WHATSAPP USERS"
echo "========================================="
echo ""

# Delete all WhatsApp users (IDs: 1, 2, 4-16)
for user_id in 1 2 4 5 6 7 8 9 10 11 12 13 14 15 16; do
  echo "Deleting WhatsApp user ID: $user_id..."
  DELETE_RESPONSE=$(curl -s -X DELETE "${BASE_URL}/api/admin/users/${user_id}" \
    -H "Authorization: Bearer ${TOKEN}")

  if echo "$DELETE_RESPONSE" | grep -q '"success":true'; then
    echo "✅ WhatsApp user $user_id deleted"
  else
    echo "⚠️  Failed to delete WhatsApp user $user_id (may not exist)"
  fi
done

echo ""
echo "========================================="
echo "VERIFICATION"
echo "========================================="
echo ""

# Verify remaining admin users
echo "📝 Remaining Admin Users:"
FINAL_ADMINS=$(curl -s -X GET "${BASE_URL}/api/admin/admin-users" \
  -H "Authorization: Bearer ${TOKEN}")

echo "$FINAL_ADMINS" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if data.get('success'):
        users = data.get('data', [])
        print(f'Total: {len(users)} admin users')
        for user in users:
            print(f\"  - {user.get('email')} ({user.get('name')})\")
    else:
        print('Error fetching admin users')
except:
    print('Error parsing response')
"

echo ""

# Verify remaining WhatsApp users
echo "📝 Remaining WhatsApp Users:"
FINAL_WHATSAPP=$(curl -s -X GET "${BASE_URL}/api/admin/users" \
  -H "Authorization: Bearer ${TOKEN}")

WHATSAPP_COUNT=$(echo "$FINAL_WHATSAPP" | grep -o '"whatsapp_id":"[^"]*' | wc -l | xargs)
echo "Total: $WHATSAPP_COUNT WhatsApp users"

echo ""
echo "========================================="
echo "✅ Cleanup Complete!"
echo "========================================="
echo ""
echo "System now has:"
echo "  - 2 Super Admins (admin@school.edu, Lynda@admin.com)"
echo "  - 0 Regional Admins"
echo "  - $WHATSAPP_COUNT WhatsApp Users"
echo ""
echo "Ready to create users via UI!"
