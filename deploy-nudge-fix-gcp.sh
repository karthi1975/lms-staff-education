#!/bin/bash

# Run this script ON the GCP machine (teachers-training)
# Either:
# 1. SSH to GCP: gcloud compute ssh teachers-training --zone us-east5-a
# 2. Run this script: ./deploy-nudge-fix-gcp.sh

echo "=========================================="
echo "  DEPLOYING NUDGING FIX (ON GCP)"
echo "=========================================="
echo ""

cd /home/karthi/teachers_training

echo "📥 Pulling latest code from GitHub..."
git pull origin feature/course-management-ui

echo ""
echo "🔄 Restarting Docker container to ensure changes are loaded..."
docker restart teachers_training_app_1

echo ""
echo "⏳ Waiting 10 seconds for container to restart..."
sleep 10

echo ""
echo "✅ Deployment complete! Checking container status..."
docker ps | grep teachers_training_app_1

echo ""
echo "=========================================="
echo "  DEPLOYMENT SUMMARY"
echo "=========================================="
echo ""
echo "✅ Code updated from GitHub"
echo "✅ Docker container restarted"
echo ""
echo "📝 Next: Test the nudging system"
echo "   1. Trigger manual nudge check via API"
echo "   2. Check logs: docker logs -f teachers_training_app_1 | grep -i nudge"
echo ""

