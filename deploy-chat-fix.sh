#!/bin/bash

# Deploy chat RAG fix to GCP
echo "🚀 Deploying chat RAG fix to GCP..."
echo ""

# Find GCP instance
GCP_INSTANCE=$(gcloud compute instances list --format="get(name)" --filter="status=RUNNING" | head -1)
GCP_ZONE=$(gcloud compute instances list --format="get(zone)" --filter="status=RUNNING" | head -1)

if [ -z "$GCP_INSTANCE" ]; then
  echo "❌ No running GCP instance found"
  exit 1
fi

echo "📍 Found instance: $GCP_INSTANCE in zone: $GCP_ZONE"
echo ""

# Deploy to GCP
echo "📥 Pulling latest code from GitHub..."
gcloud compute ssh $GCP_INSTANCE --zone=$GCP_ZONE --command="
  cd /home/karthi/teachers_training &&
  git pull origin feature/course-management-ui &&
  echo '✅ Code updated'
"

echo ""
echo "🔄 Restarting Docker containers..."
gcloud compute ssh $GCP_INSTANCE --zone=$GCP_ZONE --command="
  cd /home/karthi/teachers_training &&
  docker restart teachers_training_app_1 &&
  echo '✅ Container restarted'
"

echo ""
echo "⏳ Waiting for services to start..."
sleep 5

echo ""
echo "🧪 Testing health endpoint..."
curl -s http://34.162.136.203:3000/health | python3 -m json.tool

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🎯 Test the chat at: http://34.162.136.203:3000/admin/chat.html"
echo ""
