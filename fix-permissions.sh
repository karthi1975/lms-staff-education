#!/bin/bash

# Fix file upload permissions
# Run this if you encounter upload permission errors

echo "Fixing upload permissions..."

# Local Docker
if docker ps | grep -q "teachers_training-app-1"; then
    echo "Fixing local Docker permissions..."
    docker exec -u root teachers_training-app-1 sh -c "
        mkdir -p /app/uploads /app/logs /app/cache &&
        chown -R nodejs:nodejs /app/uploads /app/logs /app/cache &&
        chmod -R 755 /app/uploads /app/logs /app/cache
    "
    echo "✅ Local permissions fixed"
fi

# Host directory
if [ -d "uploads" ]; then
    chmod 777 uploads
    echo "✅ Host uploads directory permissions fixed"
fi

echo ""
echo "Testing upload endpoint..."
TOKEN=$(curl -s http://localhost:3000/api/admin/login \
    -H 'Content-Type: application/json' \
    --data-binary @- <<'EOF' | python3 -c 'import sys, json; print(json.load(sys.stdin)["tokens"]["accessToken"])' 2>/dev/null
{"email":"admin@school.edu","password":"Admin123!"}
EOF
)

if [ -n "$TOKEN" ]; then
    echo "✅ Login successful, token obtained"
    echo ""
    echo "You can now test file upload in the admin panel:"
    echo "http://localhost:3000/admin/lms-dashboard.html"
else
    echo "❌ Could not get auth token"
fi
