#!/bin/bash

# Get token
echo "Getting token..."
TOKEN=$(curl -s -X POST "http://34.162.136.203:3000/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@school.edu", "password": "Admin123!"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin).get('accessToken', ''))")

echo "Token: ${TOKEN:0:30}..."

# Test upload
echo ""
echo "Testing quiz upload..."

curl -v -X POST "http://34.162.136.203:3000/api/admin/courses/2/modules/6/quiz" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "questions": [
    {
      "question": "Test question?",
      "options": {
        "A": "Option A",
        "B": "Option B",
        "C": "Option C",
        "D": "Option D"
      },
      "correct_answer": "B"
    }
  ]
}
EOF
