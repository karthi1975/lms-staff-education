#!/bin/bash
# Deploy RAG fix to GCP instance

set -e

INSTANCE_NAME="teachers-training"
ZONE="us-east5-a"
FILE_TO_UPDATE="services/moodle-orchestrator.service.js"

echo "=========================================="
echo "Deploying RAG Fix to GCP"
echo "=========================================="
echo ""
echo "Instance: $INSTANCE_NAME"
echo "Zone: $ZONE"
echo ""

# Step 1: Copy the fixed file to cloud
echo "1. Copying fixed file to cloud instance..."
gcloud compute scp \
  ./$FILE_TO_UPDATE \
  $INSTANCE_NAME:~/teachers_training/$FILE_TO_UPDATE \
  --zone=$ZONE

if [ $? -eq 0 ]; then
  echo "✅ File copied successfully"
else
  echo "❌ Failed to copy file"
  exit 1
fi

echo ""

# Step 2: Restart Docker on cloud
echo "2. Restarting Docker containers on cloud..."
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="cd ~/teachers_training && docker-compose restart app"

if [ $? -eq 0 ]; then
  echo "✅ Docker restarted successfully"
else
  echo "❌ Failed to restart Docker"
  exit 1
fi

echo ""

# Step 3: Verify deployment
echo "3. Verifying deployment..."
sleep 5

# Check if app is running
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="docker ps | grep teachers_training-app-1"

if [ $? -eq 0 ]; then
  echo "✅ App container is running"
else
  echo "⚠️  App container status unknown"
fi

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Test WhatsApp: Send 'Hello' to +1 806 515 7636"
echo "2. Select course: 1"
echo "3. Select module: 2"
echo "4. Ask: 'What is entrepreneurship?'"
echo "5. Should now get educational content!"
echo ""
echo "Check logs:"
echo "  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command='docker logs teachers_training-app-1 2>&1 | grep -i \"RAG query\" | tail -10'"

