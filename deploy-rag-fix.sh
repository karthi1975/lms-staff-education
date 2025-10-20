#!/bin/bash
# Deploy RAG cross-module search fix to GCP

echo "🚀 Deploying RAG Fix to GCP"
echo "============================"
echo ""

gcloud compute ssh teachers-training --zone=us-east5-a << 'ENDSSH'
  set -e
  cd /home/karthi/teachers_training

  echo "📥 Pulling latest code..."
  git pull origin feature/course-management-ui

  echo ""
  echo "🔄 Restarting app container..."
  docker restart teachers_training_app_1

  echo ""
  echo "⏳ Waiting for container to be ready..."
  sleep 5

  echo ""
  echo "🔍 Checking container logs..."
  docker logs teachers_training_app_1 --tail 20

  echo ""
  echo "✅ Deployment complete!"
  echo ""
  echo "📝 Test with: 'What is entrepreneurship?'"
ENDSSH
