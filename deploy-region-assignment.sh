#!/bin/bash

# Deploy Region Assignment Feature to GCP
# This script deploys the region assignment functionality

set -e

echo "=========================================="
echo "Region Assignment Deployment"
echo "=========================================="
echo ""

echo "📝 Step 1: SSH to GCP..."
echo ""
echo "Please run the following commands:"
echo ""
echo "  gcloud compute ssh teachers-training --zone 'us-east5-a' --project 'lms-tanzania-consultant'"
echo ""
echo "Then on the server, run:"
echo ""
echo "  cd /home/karthi/teachers_training"
echo "  git pull origin feature/multi-region-rbac"
echo "  docker cp routes/admin.routes.js teachers_training_app_1:/app/routes/admin.routes.js"
echo "  docker cp public/admin/admin-users-rbac.html teachers_training_app_1:/app/public/admin/admin-users-rbac.html"
echo "  docker exec teachers_training_app_1 sh -c 'pkill -f node'"
echo "  sleep 3"
echo "  docker logs teachers_training_app_1 --tail 20"
echo ""
echo "✅ After Node restarts, test with:"
echo "  node test-region-assignment.js"
echo ""
