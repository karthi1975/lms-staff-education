#!/bin/bash

# Pull latest changes from GitHub and redeploy on GCP
# Run this on GCP VM: ./gcp-pull-and-deploy.sh

INSTANCE_NAME="teachers-training"
ZONE="us-east5-a"
PROJECT_ID="lms-tanzania-consultant"

echo "========================================="
echo "GCP Pull and Deploy from GitHub"
echo "========================================="
echo ""

# Option 1: Run locally to trigger remote deployment
if [ "$1" == "remote" ]; then
    echo "Triggering deployment on GCP from local machine..."
    gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --project=$PROJECT_ID << 'REMOTE_SCRIPT'
    cd ~/teachers_training

    echo "Step 1: Pulling latest changes from GitHub..."
    git pull origin master

    echo ""
    echo "Step 2: Stopping containers..."
    sudo docker-compose down

    echo ""
    echo "Step 3: Rebuilding app container (if Dockerfile changed)..."
    sudo docker-compose build app

    echo ""
    echo "Step 4: Starting containers..."
    sudo docker-compose up -d

    echo ""
    echo "Waiting 30 seconds for services to start..."
    sleep 30

    echo ""
    echo "Container status:"
    sudo docker-compose ps

    echo ""
    echo "✅ Deployment complete!"
    echo ""
    echo "Testing health endpoint..."
    curl -s http://localhost:3000/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/health
REMOTE_SCRIPT

    # Get external IP
    EXTERNAL_IP=$(gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --project=$PROJECT_ID --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

    echo ""
    echo "========================================="
    echo "✅ DEPLOYMENT COMPLETE!"
    echo "========================================="
    echo ""
    echo "Application URL: http://$EXTERNAL_IP:3000/admin/login.html"
    echo ""
    exit 0
fi

# Option 2: Run directly on GCP VM
echo "Running on GCP VM..."
echo ""

echo "Step 1: Pulling latest changes from GitHub..."
git pull origin master

if [ $? -ne 0 ]; then
    echo "❌ Git pull failed. Check your repository status."
    exit 1
fi

echo ""
echo "Step 2: Stopping containers..."
sudo docker-compose down

echo ""
echo "Step 3: Rebuilding app container (if Dockerfile changed)..."
sudo docker-compose build app

echo ""
echo "Step 4: Starting containers..."
sudo docker-compose up -d

echo ""
echo "Waiting 30 seconds for services to start..."
sleep 30

echo ""
echo "Container status:"
sudo docker-compose ps

echo ""
echo "Testing health endpoint..."
curl -s http://localhost:3000/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/health

echo ""
echo "Recent app logs:"
sudo docker logs --tail 20 teachers_training_app_1

echo ""
echo "✅ Deployment complete!"
echo ""
echo "To view logs: sudo docker logs -f teachers_training_app_1"
echo ""
