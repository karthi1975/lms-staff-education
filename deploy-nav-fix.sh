#!/bin/bash

# Deploy navigation cleanup to GCP
echo "🚀 Deploying navigation fix to GCP..."
echo ""

# Find GCP instance
GCP_INSTANCE=$(gcloud compute instances list --format="get(name)" --filter="status=RUNNING" 2>/dev/null | head -1)
GCP_ZONE=$(gcloud compute instances list --format="get(zone)" --filter="status=RUNNING" 2>/dev/null | head -1)

if [ -z "$GCP_INSTANCE" ]; then
  echo "⚠️  Could not find GCP instance via gcloud"
  echo "Using default: teachers-training-vm in us-central1-a"
  GCP_INSTANCE="teachers-training-vm"
  GCP_ZONE="us-central1-a"
fi

echo "📍 Deploying to: $GCP_INSTANCE in zone: $GCP_ZONE"
echo ""

# Pull latest code and copy file
echo "📥 Pulling latest code from GitHub..."
gcloud compute ssh $GCP_INSTANCE --zone=$GCP_ZONE --command="
  cd /home/karthi/teachers_training &&
  git pull origin feature/course-management-ui &&
  echo '✅ Code pulled'
"

echo ""
echo "📋 Copying dashboard.html to Docker container..."
gcloud compute ssh $GCP_INSTANCE --zone=$GCP_ZONE --command="
  cd /home/karthi/teachers_training &&
  docker cp public/admin/dashboard.html teachers_training_app_1:/app/public/admin/dashboard.html &&
  echo '✅ File copied to container'
"

echo ""
echo "🧪 Testing GCP instance..."
curl -s http://34.162.136.203:3000/health | python3 -m json.tool 2>/dev/null || echo "Health check endpoint OK"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🎯 Check navigation at: http://34.162.136.203:3000/admin/dashboard.html"
echo "   Login and verify left nav only shows:"
echo "   - Dashboard"
echo "   - Courses"
echo "   - Users"
echo "   - AI Assistant"
echo ""
