#!/bin/bash

BASE_URL="http://34.162.168.124:3000"

# Login
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "Lynda@admin.com",
    "password": "Admin123!"
  }')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

echo "========================================="
echo "All WhatsApp Users"
echo "========================================="
echo ""

USERS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/users" \
  -H "Authorization: Bearer ${TOKEN}")

echo "$USERS_RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if data.get('success'):
    users = data.get('data', [])
    print(f'Total users: {len(users)}')
    print()
    for user in users:
        print(f\"ID: {user.get('id'):3}  |  WhatsApp: {user.get('whatsapp_id'):20}  |  Name: {user.get('name')}\")
"
