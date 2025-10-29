#!/bin/bash

# Deploy Dashboard Number Fix to GCP
# Fixes the "02100000" bug in Modules Completed stat

echo "🔧 Deploying Dashboard Number Fix to GCP"
echo "════════════════════════════════════════════════════════════════"
echo ""

echo "🐛 Bug: Modules Completed showing 02100000 instead of 3"
echo "🔧 Fix: Convert PostgreSQL BIGINT strings to integers with parseInt()"
echo ""

# Step 1: Pull latest code on GCP
echo "📥 Step 1: Pulling latest code from GitHub..."
gcloud compute ssh --zone "us-east5-a" "teachers-training" \
  --project "lms-tanzania-consultant" \
  --command "cd /home/karthi/teachers_training && git pull origin feature/course-management-ui"

if [ $? -ne 0 ]; then
  echo "❌ Failed to pull code from GitHub"
  exit 1
fi

echo "✅ Code pulled successfully"
echo ""

# Step 2: Deploy files to Docker container
echo "🐳 Step 2: Deploying fixed files to Docker container..."
gcloud compute ssh --zone "us-east5-a" "teachers-training" \
  --project "lms-tanzania-consultant" << 'ENDSSH'
  cd /home/karthi/teachers_training

  echo "   📄 Copying dashboard.html..."
  docker cp public/admin/dashboard.html teachers_training-app-1:/app/public/admin/dashboard.html

  echo "   📄 Copying users.html..."
  docker cp public/admin/users.html teachers_training-app-1:/app/public/admin/users.html

  echo "   ✅ Files deployed to container"
ENDSSH

if [ $? -ne 0 ]; then
  echo "❌ Deployment failed"
  exit 1
fi

echo ""

# Step 3: Verify deployment
echo "🧪 Step 3: Verifying deployment..."
gcloud compute ssh --zone "us-east5-a" "teachers-training" \
  --project "lms-tanzania-consultant" \
  --command "curl -s http://localhost:3000/admin/dashboard.html | grep -A2 'Modules Completed' | head -5"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ Dashboard Number Fix Deployed!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "🧪 Test the fix:"
echo "   1. Open: http://34.162.136.203:3000/admin/dashboard.html"
echo "   2. Login with: admin@school.edu / Admin123!"
echo "   3. Check 'Modules Completed' stat"
echo ""
echo "Expected:"
echo "   Before: 🎓 02100000 ❌"
echo "   After:  🎓 3        ✅"
echo ""
echo "🔍 What was fixed:"
echo "   • dashboard.html line 803: Added parseInt() to sum calculation"
echo "   • dashboard.html lines 832-833: Added parseInt() to user table"
echo "   • users.html lines 534, 537, 540: Added parseInt() to badges"
echo ""
echo "🎯 Root cause:"
echo "   PostgreSQL COUNT() returns BIGINT as strings, not numbers"
echo "   JavaScript was concatenating: 0 + '0' + '2' + '1' = '021' ❌"
echo "   Now properly adding: 0 + 0 + 2 + 1 = 3 ✅"
echo ""
