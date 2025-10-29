#!/bin/bash

# Get token
echo "Getting token..."
LOGIN=$(curl -s -X POST "http://34.162.136.203:3000/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@school.edu", "password": "Admin123!"}')

TOKEN=$(echo "$LOGIN" | python3 -c "import sys, json; print(json.load(sys.stdin).get('accessToken', ''))")

echo "Token: ${TOKEN:0:30}..."

# Get quiz
echo ""
echo "Getting quiz for module 6..."
curl -s -X GET "http://34.162.136.203:3000/api/admin/courses/2/modules/6/quiz" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
