#!/bin/bash

# Test quiz upload endpoint

# Login to get token
echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"Admin123!"}')

echo "Login response: $LOGIN_RESPONSE"

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*"' | sed 's/"accessToken":"//; s/"$//')

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token"
  exit 1
fi

echo "✅ Got token: ${TOKEN:0:20}..."

# Test uploading quiz for module 1
echo -e "\n📤 Uploading quiz for module 1..."
curl -s -X POST http://localhost:3000/api/admin/modules/1/quiz/upload \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @quizzes/CORRECT_MODULES/module_01_production.json | jq '.'

echo -e "\n✅ Quiz upload test complete"
