#!/bin/bash

# Deploy Dashboard Number Fix to GCP using gcloud

echo "🔧 Deploying Dashboard Number Fix to GCP"
echo "════════════════════════════════════════"
echo ""

echo "📝 Fix: Convert PostgreSQL BIGINT strings to numbers"
echo "   - Dashboard: Modules Completed stat"
echo "   - Dashboard: User table display"
echo "   - Users page: Badge counts"
echo ""

# Copy files to GCP using gcloud
echo "📤 Step 1: Copying fixed files to GCP..."

gcloud compute scp --zone "us-east5-a" \
  public/admin/dashboard.html \
  public/admin/users.html \
  teachers-training:/tmp/ \
  --project "lms-tanzania-consultant"

if [ $? -ne 0 ]; then
  echo "❌ Failed to copy files"
  exit 1
fi

echo "✅ Files copied to GCP"
echo ""

# Deploy to Docker container
echo "🐳 Step 2: Deploying to Docker container..."

gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" << 'ENDSSH'
  cd /home/karthi/teachers_training

  # Copy files from /tmp to container
  docker cp /tmp/dashboard.html teachers_training-app-1:/app/public/admin/dashboard.html
  docker cp /tmp/users.html teachers_training-app-1:/app/public/admin/users.html

  # Clean up temp files
  rm /tmp/dashboard.html /tmp/users.html

  echo "✅ Files deployed to container"
ENDSSH

if [ $? -ne 0 ]; then
  echo "❌ Deployment failed"
  exit 1
fi

echo ""
echo "════════════════════════════════════════"
echo "✅ Dashboard Fix Deployed Successfully!"
echo "════════════════════════════════════════"
echo ""
echo "🧪 Test the fix:"
echo "   1. Open: http://34.162.136.203:3000/admin/dashboard.html"
echo "   2. Check 'Modules Completed' stat (should show proper number)"
echo "   3. Check user table (should show 'X / 5 modules' correctly)"
echo "   4. Open: http://34.162.136.203:3000/admin/users.html"
echo "   5. Check badge numbers (should be integers)"
echo ""
echo "🐛 Bug Fixed:"
echo "   Before: 🎓 Modules Completed = 02100000 (string concatenation)"
echo "   After:  🎓 Modules Completed = 3 (proper addition)"
echo ""
