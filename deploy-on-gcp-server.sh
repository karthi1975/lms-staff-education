#!/bin/bash

# Region Assignment Deployment Script
# Run this script ON the GCP server

set -e

echo "=========================================="
echo "DEPLOYING REGION ASSIGNMENT FEATURE"
echo "=========================================="
echo ""

# Navigate to project directory
cd /home/karthi/teachers_training

# Pull latest code
echo "📥 Step 1: Pulling latest code from GitHub..."
git fetch origin
git pull origin feature/multi-region-rbac
echo "✅ Code pulled"
echo ""

# Show what changed
echo "📋 Recent commits:"
git log --oneline -3
echo ""

# Copy files to Docker container
echo "📦 Step 2: Copying files to Docker container..."
docker cp routes/admin.routes.js teachers_training_app_1:/app/routes/admin.routes.js
echo "  ✅ routes/admin.routes.js copied"

docker cp public/admin/admin-users-rbac.html teachers_training_app_1:/app/public/admin/admin-users-rbac.html
echo "  ✅ admin-users-rbac.html copied"
echo ""

# Verify files are in container
echo "🔍 Step 3: Verifying files in container..."
ROUTE_COUNT=$(docker exec teachers_training_app_1 grep -c "admin-users/:userId/regions" /app/routes/admin.routes.js || echo "0")
echo "  Found $ROUTE_COUNT region assignment endpoints in routes file"

if [ "$ROUTE_COUNT" -lt "3" ]; then
    echo "  ⚠️  Warning: Expected 3+ endpoints, found $ROUTE_COUNT"
else
    echo "  ✅ All endpoints present"
fi
echo ""

# Restart Node.js
echo "🔄 Step 4: Restarting Node.js application..."
docker exec teachers_training_app_1 sh -c 'pkill -f node'
echo "  ✅ Node.js process killed"
echo "  ⏳ Waiting 5 seconds for restart..."
sleep 5
echo ""

# Check logs
echo "📊 Step 5: Checking application logs..."
docker logs teachers_training_app_1 --tail 20
echo ""

# Verify Node is running
echo "🏥 Step 6: Health check..."
sleep 2
HEALTH=$(curl -s http://localhost:3000/health || echo "FAILED")
if echo "$HEALTH" | grep -q "ok"; then
    echo "  ✅ Application is healthy"
else
    echo "  ⚠️  Health check returned: $HEALTH"
fi
echo ""

echo "=========================================="
echo "DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Exit this SSH session"
echo "  2. Run on local machine: ./check-region-api.sh"
echo "  3. Run on local machine: node test-region-assignment-comprehensive.js"
echo ""
echo "The UI modal should now show region checkboxes!"
echo ""
