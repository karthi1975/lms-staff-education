#!/bin/bash

# Complete Deployment and Testing for Region Assignment Feature
# This script must be run manually due to gcloud auth requirements

set -e

echo "=========================================="
echo "REGION ASSIGNMENT - DEPLOY & TEST"
echo "=========================================="
echo ""

echo "⚠️  IMPORTANT: You need to run these commands manually"
echo ""
echo "Step 1: SSH to GCP"
echo "===================="
echo "gcloud compute ssh teachers-training --zone 'us-east5-a' --project 'lms-tanzania-consultant'"
echo ""

echo "Step 2: On GCP server, run these commands:"
echo "==========================================="
cat << 'EOF'
cd /home/karthi/teachers_training

# Pull latest code
git fetch origin
git pull origin feature/multi-region-rbac

# Show what changed
echo "Files changed:"
git log --oneline -5

# Copy updated files to container
docker cp routes/admin.routes.js teachers_training_app_1:/app/routes/admin.routes.js
docker cp public/admin/admin-users-rbac.html teachers_training_app_1:/app/public/admin/admin-users-rbac.html

# Restart Node.js
docker exec teachers_training_app_1 sh -c 'pkill -f node'

# Wait for restart
sleep 5

# Check if Node is running
docker logs teachers_training_app_1 --tail 30

# Verify routes are loaded
docker exec teachers_training_app_1 cat /app/routes/admin.routes.js | grep -c "admin-users/:userId/regions" || echo "Routes not found!"

echo ""
echo "✅ Deployment complete!"
EOF

echo ""
echo "Step 3: Check database state"
echo "=============================="
cat << 'EOF'
# Check regions exist
docker exec -i teachers_training_postgres_1 psql -U teachers_user -d teachers_training << 'EOSQL'
SELECT 'REGIONS IN DATABASE:' as info;
SELECT id, code, name, is_active FROM regions ORDER BY id;

SELECT '' as spacer;
SELECT 'ADMIN USERS:' as info;
SELECT id, email, name, role_id, primary_region_id FROM admin_users ORDER BY id;

SELECT '' as spacer;
SELECT 'ADMIN REGION ASSIGNMENTS:' as info;
SELECT ar.id, au.email, r.name as region_name, ar.assigned_at
FROM admin_regions ar
JOIN admin_users au ON ar.admin_user_id = au.id
JOIN regions r ON ar.region_id = r.id
ORDER BY au.email;
EOSQL
EOF

echo ""
echo "Step 4: Test API endpoints"
echo "==========================="
echo "Exit SSH and run on local machine:"
echo "  ./check-region-api.sh"
echo ""

echo "Step 5: Run Playwright tests"
echo "============================="
echo "  node test-region-assignment.js"
echo ""

echo "=========================================="
echo "📋 CHECKLIST"
echo "=========================================="
echo "☐ SSH to GCP"
echo "☐ Pull latest code"
echo "☐ Copy files to container"
echo "☐ Restart Node.js"
echo "☐ Verify deployment"
echo "☐ Check database has regions"
echo "☐ Test API endpoints"
echo "☐ Run Playwright tests"
echo "☐ Test manually in browser"
echo ""
