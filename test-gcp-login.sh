#!/bin/bash

# Test GCP admin login
EXTERNAL_IP="34.152.120.95"

echo "Testing admin login on GCP..."
echo ""

response=$(curl -s http://$EXTERNAL_IP:3000/api/admin/login \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'EOF'
{"email":"admin@school.edu","password":"Admin123!"}
EOF
)

echo "Response:"
echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"

# Extract and display token if successful
if echo "$response" | grep -q '"success":true'; then
    echo ""
    echo "✅ Login successful!"

    # Extract access token
    token=$(echo "$response" | python3 -c 'import sys, json; print(json.load(sys.stdin)["tokens"]["accessToken"])' 2>/dev/null)

    if [ -n "$token" ]; then
        echo ""
        echo "Access Token (first 50 chars):"
        echo "${token:0:50}..."

        # Test authenticated endpoint
        echo ""
        echo "Testing authenticated endpoint (GET /api/admin/users):"
        curl -s http://$EXTERNAL_IP:3000/api/admin/users \
            -H "Authorization: Bearer $token" \
            -H 'Content-Type: application/json' \
            | python3 -m json.tool 2>/dev/null | head -20
    fi
else
    echo ""
    echo "❌ Login failed"
fi
