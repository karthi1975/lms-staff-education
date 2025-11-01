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

# Get users and show first user details
echo "Fetching user details for +255712345001..."
USERS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/users" \
  -H "Authorization: Bearer ${TOKEN}")

# Find the user with phone +255712345001 and show full details
echo "$USERS_RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if data.get('success'):
    users = data.get('data', [])
    target_user = [u for u in users if u.get('whatsapp_id') == '+255712345001']
    if target_user:
        user = target_user[0]
        print(f\"User ID: {user.get('id')}\")
        print(f\"Name: {user.get('name')}\")
        print(f\"WhatsApp ID: {user.get('whatsapp_id')}\")
    else:
        print('User not found')
"
