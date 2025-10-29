#!/bin/bash
set -e

BASE_URL="http://34.162.168.124:3000"
QUIZ_FILE="/Users/karthi/business/staff_education/teachers_training/quizzes/CORRECT_MODULES/module_01_production.json"

echo "🔐 Step 1: Login as admin..."
LOGIN_RESPONSE=$(curl -s -X POST ${BASE_URL}/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"Admin123!"}')

echo "$LOGIN_RESPONSE" | jq '.' || echo "$LOGIN_RESPONSE"

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.tokens.accessToken // .token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed. Response:"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful. Token: ${TOKEN:0:20}..."

echo ""
echo "📋 Step 2: Get module ID for Production..."
MODULE_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/courses/1/modules" \
  -H "Authorization: Bearer $TOKEN")

echo "$MODULE_RESPONSE" | jq '.modules[] | select(.title == "Production") | {id, title}' || echo "$MODULE_RESPONSE"

MODULE_ID=$(echo "$MODULE_RESPONSE" | jq -r '.modules[] | select(.title == "Production") | .id')

if [ "$MODULE_ID" = "null" ] || [ -z "$MODULE_ID" ]; then
  echo "❌ Could not find Production module. Trying module ID 1..."
  MODULE_ID=1
fi

echo "✅ Production module ID: $MODULE_ID"

echo ""
echo "📤 Step 3: Upload quiz for Production module..."

# Read quiz file and send as JSON body
UPLOAD_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/admin/modules/${MODULE_ID}/quiz/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @"$QUIZ_FILE")

echo "$UPLOAD_RESPONSE" | jq '.' || echo "$UPLOAD_RESPONSE"

SUCCESS=$(echo "$UPLOAD_RESPONSE" | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
  echo ""
  echo "✅ Quiz uploaded successfully!"
  echo "$UPLOAD_RESPONSE" | jq '.quiz'
else
  echo ""
  echo "❌ Quiz upload failed:"
  echo "$UPLOAD_RESPONSE" | jq '.error' || echo "$UPLOAD_RESPONSE"
  exit 1
fi

echo ""
echo "🔍 Step 4: Verify quiz was uploaded..."
VERIFY_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/courses/1/modules/${MODULE_ID}/quiz" \
  -H "Authorization: Bearer $TOKEN")

echo "$VERIFY_RESPONSE" | jq '.questions | length' | xargs -I {} echo "✅ Quiz has {} questions"
echo "$VERIFY_RESPONSE" | jq '.questions[0] | {question, options, correct_answer}' || true

echo ""
echo "✅ All done! Production module quiz uploaded and verified."
