#!/bin/bash
##############################################
# Deploy Top Courses Fix to GCP
# - Pull latest code from GitHub
# - Restart Docker container
# - Verify fix with integration tests
##############################################

set -e

echo "========================================="
echo "Deploying Top Courses Fix to GCP"
echo "========================================="
echo ""

# GCP Server Details
GCP_HOST="34.162.168.124"
GCP_USER="karthi"
GCP_PROJECT_DIR="/home/karthi/teachers_training"

echo "Step 1: Pull latest code from GitHub..."
ssh -o StrictHostKeyChecking=no ${GCP_USER}@${GCP_HOST} "
  cd ${GCP_PROJECT_DIR} && \
  git fetch origin && \
  git checkout feature/multi-region-rbac && \
  git pull origin feature/multi-region-rbac
"
echo "✅ Code updated"
echo ""

echo "Step 2: Copy updated file to Docker container..."
ssh -o StrictHostKeyChecking=no ${GCP_USER}@${GCP_HOST} "
  cd ${GCP_PROJECT_DIR} && \
  docker cp routes/statistics.routes.js teachers_training_app_1:/app/routes/statistics.routes.js
"
echo "✅ File copied to container"
echo ""

echo "Step 3: Restart Node.js app in container..."
ssh -o StrictHostKeyChecking=no ${GCP_USER}@${GCP_HOST} "
  docker exec teachers_training_app_1 pkill -f 'node server.js' || true && \
  sleep 2
"
echo "✅ App restarted (PM2 or Docker will auto-restart)"
echo ""

echo "Step 4: Wait for app to be ready..."
sleep 5

echo "Step 5: Test top-courses endpoint..."
ssh -o StrictHostKeyChecking=no ${GCP_USER}@${GCP_HOST} "
  TOKEN=\\\$(curl -s -X POST 'http://localhost:3000/api/admin/login' \
    -H 'Content-Type: application/json' \
    -d '{\"email\":\"admin@school.edu\",\"password\":\"AdminPass123\"}' \
    | grep -o '\"accessToken\":\"[^\"]*\"' | cut -d'\"' -f4) && \
  echo \"Testing endpoint...\" && \
  curl -s -X GET 'http://localhost:3000/api/statistics/top-courses?limit=5' \
    -H \"Authorization: Bearer \\\$TOKEN\"
"
echo ""

echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Run full integration tests:"
echo "BASE_URL=http://34.162.168.124:3000 ./test-rbac-api.sh"
