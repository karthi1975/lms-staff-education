#!/bin/bash

# Deploy User Management RBAC to GCP
# This script pulls the latest code and restarts the Node.js app

echo "=========================================="
echo "Deploying User Management RBAC to GCP"
echo "=========================================="
echo ""

echo "📝 Step 1: Pull latest code from GitHub..."
echo ""
echo "Please run the following commands manually on GCP:"
echo ""
echo "  gcloud compute ssh teachers-training --zone 'us-east5-a' --project 'lms-tanzania-consultant'"
echo ""
echo "Then on the server, run:"
echo ""
echo "  cd /home/karthi/teachers_training"
echo "  git pull origin feature/multi-region-rbac"
echo "  docker exec teachers_training_app_1 sh -c 'pkill -f node'"
echo "  sleep 3"
echo "  docker logs -f teachers_training_app_1 --tail 20"
echo ""
echo "✅ Once Node restarts, test with:"
echo "  node test-user-management-rbac.js"
echo ""
