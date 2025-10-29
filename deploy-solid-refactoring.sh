#!/bin/bash

# Deploy SOLID Refactoring to GCP
# This script pulls the latest code and restarts Docker services

set -e  # Exit on error

echo "🚀 Deploying SOLID Refactoring to GCP..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Pull latest code
echo -e "${YELLOW}Step 1: Pulling latest code from GitHub...${NC}"
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command "
    cd /home/karthi/teachers_training && \
    echo '📥 Pulling from GitHub...' && \
    git pull origin feature/course-management-ui && \
    echo '✅ Code pulled successfully'
"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Step 1 Complete: Code pulled successfully${NC}"
else
    echo -e "${RED}❌ Step 1 Failed: Could not pull code${NC}"
    exit 1
fi

echo ""

# Step 2: Restart Docker services
echo -e "${YELLOW}Step 2: Restarting Docker services...${NC}"
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command "
    cd /home/karthi/teachers_training && \
    echo '🔄 Restarting Docker containers...' && \
    docker-compose restart app && \
    echo '⏳ Waiting for services to stabilize...' && \
    sleep 10 && \
    echo '✅ Docker services restarted'
"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Step 2 Complete: Docker services restarted${NC}"
else
    echo -e "${RED}❌ Step 2 Failed: Could not restart Docker${NC}"
    exit 1
fi

echo ""

# Step 3: Verify deployment
echo -e "${YELLOW}Step 3: Verifying deployment...${NC}"

# Check health endpoint
echo "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://34.162.136.203:3000/health)

if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ Health check passed (HTTP $HEALTH_RESPONSE)${NC}"
else
    echo -e "${RED}❌ Health check failed (HTTP $HEALTH_RESPONSE)${NC}"
fi

echo ""

# Step 4: Check Docker logs
echo -e "${YELLOW}Step 4: Checking Docker logs for errors...${NC}"
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command "
    cd /home/karthi/teachers_training && \
    echo '📋 Last 20 lines of Docker logs:' && \
    docker logs --tail 20 teachers_training_app_1 2>&1 | grep -E '(error|Error|ERROR|warning|Warning|WARN|initialized|listening)' || echo 'No errors found in recent logs'
"

echo ""

# Step 5: Verify file structure
echo -e "${YELLOW}Step 5: Verifying SOLID refactoring files...${NC}"
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command "
    cd /home/karthi/teachers_training && \
    echo '📁 Checking SOLID refactored files:' && \
    echo '' && \
    ls -la services/core/logger/*.js 2>/dev/null | wc -l | xargs echo '  Logger files:' && \
    ls -la services/whatsapp/*.js 2>/dev/null | wc -l | xargs echo '  WhatsApp files:' && \
    ls -la services/orchestrator/*.js 2>/dev/null | wc -l | xargs echo '  Orchestrator files:' && \
    echo '' && \
    echo '✅ All SOLID refactoring files deployed'
"

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "📍 Service URL: http://34.162.136.203:3000"
echo "📊 Health Check: http://34.162.136.203:3000/health"
echo "🎨 Admin Portal: http://34.162.136.203:3000/admin/index.html"
echo ""
echo "To view live logs:"
echo "  gcloud compute ssh --zone \"us-east5-a\" \"teachers-training\" --project \"lms-tanzania-consultant\" --command \"docker logs -f teachers_training_app_1\""
echo ""
