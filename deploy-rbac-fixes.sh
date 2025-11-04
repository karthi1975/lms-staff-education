#!/bin/bash

# Deploy RBAC UI fixes to production
# This script deploys the fixed admin-users-rbac.html and auth service to GCP

echo "==========================================="
echo "Deploying RBAC UI Fixes to Production"
echo "==========================================="
echo ""

echo "📝 Connecting to GCP instance..."
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" << 'EOF'

# Navigate to project directory
cd /home/karthi/teachers_training

# Pull latest code
echo "📝 Pulling latest code from GitHub..."
git pull origin feature/multi-region-rbac

# Copy fixed files to Docker container
echo "📝 Deploying fixed files..."
docker cp public/admin/admin-users-rbac.html teachers_training_app_1:/app/public/admin/admin-users-rbac.html
docker cp services/auth/admin.auth.service.js teachers_training_app_1:/app/services/auth/admin.auth.service.js

# Restart app to apply auth service changes
echo "📝 Restarting application..."
docker restart teachers_training_app_1

echo ""
echo "⏳ Waiting for app to restart (10 seconds)..."
sleep 10

echo ""
echo "==========================================="
echo "✅ Deployment Complete!"
echo "==========================================="
echo ""
echo "Fixed Issues:"
echo "  1. Admin users now load correctly (changed API endpoint)"
echo "  2. Create Admin User button now visible for Super Admins"
echo "  3. role_id included in login response"
echo ""
echo "Test at: http://34.162.168.124:3000/admin/admin-users-rbac.html"
echo ""

EOF

echo "Done! You may need to hard refresh (Cmd+Shift+R) the page to see changes."
