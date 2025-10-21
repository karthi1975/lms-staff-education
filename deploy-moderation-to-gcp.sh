#!/bin/bash

# Deploy Content Moderation to GCP
# Pulls latest code, installs packages, runs migration, restarts containers

set -e

GCP_IP="34.162.136.203"
GCP_USER="karthi"
BRANCH="feature/course-management-ui"

echo "🛡️ Deploying Content Moderation System to GCP"
echo "=============================================="
echo ""
echo "Target: $GCP_USER@$GCP_IP"
echo "Branch: $BRANCH"
echo ""

# SSH and deploy
ssh -o StrictHostKeyChecking=no $GCP_USER@$GCP_IP << 'ENDSSH'
    set -e

    echo "📦 Step 1/5: Navigating to project directory..."
    cd /home/karthi/teachers_training

    echo "📥 Step 2/5: Pulling latest code from GitHub..."
    git fetch origin
    git checkout feature/course-management-ui
    git pull origin feature/course-management-ui

    echo "📦 Step 3/5: Installing NPM packages (bad-words, leo-profanity)..."
    npm install

    echo "🗄️ Step 4/5: Running database migration..."
    docker cp migrations/009_content_moderation_log.sql teachers_training-postgres-1:/tmp/
    docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -f /tmp/009_content_moderation_log.sql || echo "Migration may have already run"

    echo "🔄 Step 5/5: Restarting app container..."
    docker restart teachers_training-app-1

    echo ""
    echo "⏳ Waiting for container to be ready (30 seconds)..."
    sleep 30

    echo ""
    echo "✅ Deployment complete!"
    echo ""
    echo "📊 Container status:"
    docker ps --format "table {{.Names}}\t{{.Status}}" | grep teachers_training

    echo ""
    echo "🔍 Checking for moderation service..."
    docker exec teachers_training-app-1 ls -la services/content-moderation.service.js || echo "⚠️ File not found"

    echo ""
    echo "📝 Recent app logs:"
    docker logs teachers_training-app-1 --tail 20
ENDSSH

echo ""
echo "=============================================="
echo "✅ Content Moderation Deployed to GCP"
echo "=============================================="
echo ""
echo "🧪 Run production tests:"
echo "   TEST_BASE_URL=http://$GCP_IP:3000 npx playwright test tests/e2e/content-moderation.spec.js"
echo ""
echo "📊 Test endpoints:"
echo "   http://$GCP_IP:3000/admin/chat.html"
echo ""
