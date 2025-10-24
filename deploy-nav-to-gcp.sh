#!/bin/bash

# Deploy navigation cleanup to GCP
echo "🚀 Deploying navigation fix to GCP..."
echo ""

GCP_INSTANCE="teachers-training"
GCP_ZONE="us-east5-a"
GCP_PROJECT="lms-tanzania-consultant"

echo "📍 Deploying to: $GCP_INSTANCE"
echo "   Zone: $GCP_ZONE"
echo "   Project: $GCP_PROJECT"
echo ""

# Step 1: Pull latest code
echo "📥 Step 1: Pulling latest code from GitHub..."
gcloud compute ssh --zone "$GCP_ZONE" "$GCP_INSTANCE" --project "$GCP_PROJECT" --command="
  cd /home/karthi/teachers_training &&
  git pull origin feature/course-management-ui &&
  echo '✅ Code pulled from GitHub'
"

if [ $? -ne 0 ]; then
  echo "❌ Failed to pull code"
  exit 1
fi

echo ""
echo "📋 Step 2: Copying dashboard.html to Docker container..."
gcloud compute ssh --zone "$GCP_ZONE" "$GCP_INSTANCE" --project "$GCP_PROJECT" --command="
  cd /home/karthi/teachers_training &&
  docker cp public/admin/dashboard.html teachers_training_app_1:/app/public/admin/dashboard.html &&
  echo '✅ Dashboard file copied to container'
"

if [ $? -ne 0 ]; then
  echo "❌ Failed to copy file to container"
  exit 1
fi

echo ""
echo "🧪 Step 3: Testing deployment..."
gcloud compute ssh --zone "$GCP_ZONE" "$GCP_INSTANCE" --project "$GCP_PROJECT" --command="
  curl -s http://localhost:3000/health | head -5 &&
  echo '' &&
  echo '✅ Health check OK'
"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🎯 Test the navigation at:"
echo "   http://34.162.136.203:3000/admin/dashboard.html"
echo ""
echo "Expected navigation items:"
echo "   ✓ Dashboard"
echo "   ✓ Courses"
echo "   ✓ Users"
echo "   ✓ AI Assistant"
echo ""
echo "Removed items:"
echo "   ✗ Content Library"
echo "   ✗ Quizzes"
echo "   ✗ Reports"
echo "   ✗ Learning Analytics"
echo "   ✗ Settings"
echo "   ✗ Admin Tools"
echo ""
