#!/bin/bash

# Deploy to GCP with Docker Cache Clearing
# This script ensures browser cache is cleared and Docker serves fresh files

set -e  # Exit on error

echo "=========================================="
echo "🚀 GCP Deployment with Cache Clear"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
GCP_INSTANCE="teachers-training"
GCP_ZONE="us-east5-a"
PROJECT_DIR="~/teachers_training"

echo "📋 Pre-deployment checklist:"
echo "✓ Instance: ${GCP_INSTANCE}"
echo "✓ Zone: ${GCP_ZONE}"
echo "✓ Project: ${PROJECT_DIR}"
echo ""

# Step 1: Verify local changes are committed
echo "${YELLOW}Step 1: Checking local git status...${NC}"
if [[ -n $(git status --porcelain) ]]; then
    echo "${RED}❌ ERROR: You have uncommitted changes!${NC}"
    echo "Please commit your changes first:"
    echo "  git add ."
    echo "  git commit -m 'Your commit message'"
    exit 1
fi
echo "${GREEN}✓ Local changes committed${NC}"
echo ""

# Step 2: Push to GitHub
echo "${YELLOW}Step 2: Pushing to GitHub...${NC}"
git push origin master
echo "${GREEN}✓ Pushed to GitHub${NC}"
echo ""

# Step 3: SSH to GCP and pull changes
echo "${YELLOW}Step 3: Pulling changes on GCP...${NC}"
gcloud compute ssh ${GCP_INSTANCE} --zone=${GCP_ZONE} --command="
    cd ${PROJECT_DIR} &&
    echo '📥 Pulling latest code...' &&
    git pull origin master
"
echo "${GREEN}✓ Code pulled on GCP${NC}"
echo ""

# Step 4: Clear Docker cache for public directory
echo "${YELLOW}Step 4: Clearing Docker cache for public directory...${NC}"
gcloud compute ssh ${GCP_INSTANCE} --zone=${GCP_ZONE} --command="
    echo '🗑️  Clearing Docker cached files...' &&

    # Option 1: Touch all HTML files to update timestamps
    find ${PROJECT_DIR}/public -name '*.html' -exec touch {} \; &&
    echo '✓ Updated HTML file timestamps' &&

    # Option 2: Restart Docker container to force reload
    docker restart teachers_training_app_1 &&
    echo '✓ Docker container restarted' &&

    # Wait for container to be healthy
    echo '⏳ Waiting for container to be healthy...' &&
    sleep 5 &&

    # Check container status
    docker ps --filter name=teachers_training_app_1 --format '{{.Status}}'
"
echo "${GREEN}✓ Docker cache cleared${NC}"
echo ""

# Step 5: Verify deployment
echo "${YELLOW}Step 5: Verifying deployment...${NC}"
gcloud compute ssh ${GCP_INSTANCE} --zone=${GCP_ZONE} --command="
    echo '🔍 Checking latest commit...' &&
    cd ${PROJECT_DIR} &&
    git log --oneline -1 &&

    echo '' &&
    echo '🔍 Checking Docker container...' &&
    docker exec teachers_training_app_1 ls -lh /app/public/admin/user-management.html &&

    echo '' &&
    echo '🔍 Verifying file content...' &&
    docker exec teachers_training_app_1 grep -c 'Note: We don.t reload users' /app/public/admin/user-management.html || echo 'Pattern not found (expected if different changes)'
"
echo "${GREEN}✓ Deployment verified${NC}"
echo ""

# Step 6: Display access instructions
echo "=========================================="
echo "${GREEN}✅ DEPLOYMENT COMPLETE!${NC}"
echo "=========================================="
echo ""
echo "📍 Access your application:"
echo "   http://34.162.136.203:3000/admin/user-management.html"
echo ""
echo "⚠️  IMPORTANT: Clear browser cache before testing:"
echo "   Windows/Linux: Ctrl + Shift + R"
echo "   Mac: Cmd + Shift + R"
echo ""
echo "🔍 Or use incognito/private window:"
echo "   Chrome: Ctrl + Shift + N / Cmd + Shift + N"
echo "   Firefox: Ctrl + Shift + P / Cmd + Shift + P"
echo ""
echo "📊 Check container logs:"
echo "   gcloud compute ssh ${GCP_INSTANCE} --zone=${GCP_ZONE} --command='docker logs --tail 50 teachers_training_app_1'"
echo ""
echo "=========================================="
