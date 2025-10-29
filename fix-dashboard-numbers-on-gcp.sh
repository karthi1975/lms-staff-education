#!/bin/bash

# Fix Dashboard Number Display Bug
# Run this script ON THE GCP SERVER

echo "🔧 Fixing Dashboard Number Display Bug"
echo "════════════════════════════════════════════════════════════════"
echo ""

echo "🐛 Issue: Modules Completed showing '02100000' instead of '3'"
echo "🔧 Solution: Convert PostgreSQL BIGINT strings to numbers"
echo ""

# Check if running on GCP server
if [ ! -d "/home/karthi/teachers_training" ]; then
    echo "❌ Error: This script must be run ON the GCP server"
    echo ""
    echo "To run this script:"
    echo "   1. SSH to GCP:"
    echo "      gcloud compute ssh --zone 'us-east5-a' 'teachers-training' --project 'lms-tanzania-consultant'"
    echo ""
    echo "   2. Run this script:"
    echo "      cd /home/karthi/teachers_training"
    echo "      ./fix-dashboard-numbers-on-gcp.sh"
    exit 1
fi

cd /home/karthi/teachers_training

# Step 1: Pull latest code
echo "📥 Step 1: Pulling latest code from GitHub..."
git pull origin feature/course-management-ui

if [ $? -ne 0 ]; then
    echo "❌ Git pull failed"
    exit 1
fi

echo "✅ Code updated"
echo ""

# Step 2: Deploy to Docker container
echo "🐳 Step 2: Deploying fixed files to Docker container..."

docker cp public/admin/dashboard.html teachers_training-app-1:/app/public/admin/dashboard.html
if [ $? -ne 0 ]; then
    echo "❌ Failed to copy dashboard.html"
    exit 1
fi
echo "   ✅ dashboard.html deployed"

docker cp public/admin/users.html teachers_training-app-1:/app/public/admin/users.html
if [ $? -ne 0 ]; then
    echo "❌ Failed to copy users.html"
    exit 1
fi
echo "   ✅ users.html deployed"

echo ""

# Step 3: Verify deployment
echo "🧪 Step 3: Verifying fix..."

# Test if parseInt is in the deployed file
docker exec teachers_training-app-1 grep -q "parseInt(u.modules_completed)" /app/public/admin/dashboard.html
if [ $? -eq 0 ]; then
    echo "   ✅ Fix verified in dashboard.html"
else
    echo "   ⚠️  Fix might not be deployed correctly"
fi

docker exec teachers_training-app-1 grep -q "parseInt(user.modules_completed)" /app/public/admin/users.html
if [ $? -eq 0 ]; then
    echo "   ✅ Fix verified in users.html"
else
    echo "   ⚠️  Fix might not be deployed correctly"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ Dashboard Number Fix Deployed!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "🧪 Test the fix NOW:"
echo "   1. Open: http://34.162.136.203:3000/admin/dashboard.html"
echo "   2. Login: admin@school.edu / Admin123!"
echo "   3. Check 'Modules Completed' stat card"
echo ""
echo "Expected Results:"
echo "   ❌ Before: 🎓 Modules Completed = 02100000"
echo "   ✅ After:  🎓 Modules Completed = 3"
echo ""
echo "📊 Also fixed:"
echo "   • User table: '2 / 5 modules' (not '021 / 5')"
echo "   • Users page: Badge numbers are now correct"
echo ""
echo "🔍 Technical Details:"
echo "   Files fixed:"
echo "   • public/admin/dashboard.html (lines 803, 832-833)"
echo "   • public/admin/users.html (lines 534, 537, 540)"
echo ""
echo "   Root cause:"
echo "   PostgreSQL COUNT() returns BIGINT as strings"
echo "   JavaScript was concatenating instead of adding"
echo ""
echo "   Solution:"
echo "   Wrapped all count values with parseInt()"
echo ""
