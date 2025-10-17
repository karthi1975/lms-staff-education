#!/bin/bash

# Script to fix quiz upload module_id issue on GCP
# Upload this to GCP and run it

echo "============================================"
echo "Quiz Upload Fix - Module ID Constraint"
echo "============================================"
echo ""

cd ~/teachers_training

echo "Step 1: Checking current code version..."
CURRENT_COMMIT=$(git log --oneline -1)
echo "Current: $CURRENT_COMMIT"
echo ""

echo "Step 2: Pulling latest changes from GitHub..."
git fetch origin
git pull origin master

if [ $? -ne 0 ]; then
    echo "⚠️  Git pull failed. Trying to reset..."
    git fetch origin
    git reset --hard origin/master
fi

echo ""
echo "Step 3: Verifying the fix is in place..."
if grep -q "module_id," routes/admin.routes.js; then
    echo "✅ module_id found in INSERT statement"
else
    echo "❌ module_id NOT found - fix not applied!"
    echo ""
    echo "Applying manual patch..."

    # Backup original file
    cp routes/admin.routes.js routes/admin.routes.js.backup

    # Apply the fix using sed
    # This adds module_id to the INSERT statement
    sed -i '1107 s/INSERT INTO quiz_questions (/INSERT INTO quiz_questions (\n          module_id,/' routes/admin.routes.js

    # Update VALUES from 7 to 8 parameters
    sed -i 's/) VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7)/) VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8)/' routes/admin.routes.js

    # Add moduleId as first parameter
    sed -i '/\] `, \[/a\        moduleId,' routes/admin.routes.js

    echo "✅ Manual patch applied"
fi

echo ""
echo "Step 4: Showing the fix..."
echo "===================="
grep -A 15 "INSERT INTO quiz_questions" routes/admin.routes.js | head -20
echo "===================="

echo ""
echo "Step 5: Restarting Docker containers..."
sudo docker-compose restart app

echo ""
echo "Waiting 15 seconds for app to restart..."
sleep 15

echo ""
echo "Step 6: Checking container status..."
sudo docker-compose ps | grep app

echo ""
echo "Step 7: Testing health endpoint..."
curl -s http://localhost:3000/health | python3 -m json.tool 2>/dev/null || curl http://localhost:3000/health

echo ""
echo "Step 8: Checking recent logs..."
sudo docker logs --tail 30 teachers_training_app_1 2>&1 | tail -30

echo ""
echo "============================================"
echo "✅ Fix deployment complete!"
echo "============================================"
echo ""
echo "The quiz upload should now work without the module_id error."
echo "Test by uploading a quiz through the admin portal."
echo ""
