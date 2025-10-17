#!/bin/bash

# Script to verify quiz upload fix is working on GCP
# Run this on the GCP instance after deployment

echo "============================================"
echo "Verifying Quiz Upload Fix on GCP"
echo "============================================"
echo ""

cd ~/teachers_training

echo "1. Checking git version..."
git log --oneline -1
echo ""

echo "2. Verifying module_id in code..."
if grep -q "module_id," routes/admin.routes.js; then
    echo "✅ module_id found in INSERT statement"
    echo ""
    echo "Code snippet:"
    grep -A 10 "INSERT INTO quiz_questions" routes/admin.routes.js | head -15
else
    echo "❌ module_id NOT found - fix not applied!"
    exit 1
fi

echo ""
echo "3. Checking Docker container status..."
sudo docker-compose ps | grep app

echo ""
echo "4. Checking app logs..."
sudo docker logs --tail 20 teachers_training_app_1

echo ""
echo "5. Testing health endpoint..."
curl -s http://localhost:3000/health | python3 -m json.tool 2>/dev/null || curl http://localhost:3000/health

echo ""
echo "============================================"
echo "✅ Verification complete!"
echo "============================================"
echo ""
echo "Next: Test quiz upload through the admin portal"
echo ""
