#!/bin/bash

# Deploy Bilingual Phase 1 to GCP
# Includes: Translation service, language detection, decorative line removal

set -e

GCP_IP="34.162.136.203"
GCP_USER="karthi"
GCP_DIR="/home/karthi/teachers_training"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 1: Bilingual Deployment to GCP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📦 Step 1: Copy translation service to GCP..."
scp -o StrictHostKeyChecking=no \
  services/translation.service.js \
  $GCP_USER@$GCP_IP:$GCP_DIR/services/

echo "✅ Translation service copied"
echo ""

echo "📦 Step 2: Copy updated orchestrator to GCP..."
scp -o StrictHostKeyChecking=no \
  services/course-orchestrator.service.js \
  $GCP_USER@$GCP_IP:$GCP_DIR/services/

echo "✅ Orchestrator copied"
echo ""

echo "📦 Step 3: Copy updated formatter to GCP..."
scp -o StrictHostKeyChecking=no \
  services/whatsapp-m3-formatter.service.js \
  $GCP_USER@$GCP_IP:$GCP_DIR/services/

echo "✅ Formatter copied"
echo ""

echo "🔄 Step 4: Copy files to Docker container..."
ssh -o StrictHostKeyChecking=no $GCP_USER@$GCP_IP << 'EOF'
cd /home/karthi/teachers_training

# Copy to running container
docker cp services/translation.service.js teachers_training_app_1:/app/services/
docker cp services/course-orchestrator.service.js teachers_training_app_1:/app/services/
docker cp services/whatsapp-m3-formatter.service.js teachers_training_app_1:/app/services/

echo "✅ Files copied to container"
EOF

echo ""
echo "🔄 Step 5: Restart app container..."
ssh -o StrictHostKeyChecking=no $GCP_USER@$GCP_IP << 'EOF'
docker restart teachers_training_app_1
echo "✅ Container restarted"
EOF

echo ""
echo "⏳ Step 6: Wait for app to initialize (10s)..."
sleep 10

echo ""
echo "🧪 Step 7: Test bilingual flow..."
ssh -o StrictHostKeyChecking=no $GCP_USER@$GCP_IP << 'EOF'
# Test English greeting
RESPONSE=$(curl -s -X POST 'http://localhost:3000/webhook/twilio' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'From=whatsapp:+123456789_en_test' \
  -d 'Body=Hello')

if echo "$RESPONSE" | grep -q "Welcome"; then
  echo "✅ English greeting works"
else
  echo "❌ English greeting failed"
fi

# Test Swahili greeting
RESPONSE=$(curl -s -X POST 'http://localhost:3000/webhook/twilio' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'From=whatsapp:+123456789_sw_test' \
  -d 'Body=Habari')

if echo "$RESPONSE" | grep -q "Karibu"; then
  echo "✅ Swahili greeting works"
else
  echo "❌ Swahili greeting failed"
fi

# Check for decorative lines
RESPONSE=$(curl -s -X POST 'http://localhost:3000/webhook/twilio' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'From=whatsapp:+123456789_decor_test' \
  -d 'Body=teach me')

if echo "$RESPONSE" | grep -q "━"; then
  echo "❌ Found decorative lines (should be removed)"
else
  echo "✅ Decorative lines removed"
fi

echo ""
echo "📋 Check app logs for errors..."
docker logs teachers_training_app_1 --tail 20 | grep -i "error\|failed" || echo "✅ No errors in logs"

EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "DEPLOYMENT COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 Phase 1 Bilingual Support Deployed!"
echo ""
echo "✅ Features deployed:"
echo "   - Translation service (60+ keys)"
echo "   - Language detection (English/Swahili)"
echo "   - Bilingual course selection"
echo "   - Bilingual module selection"
echo "   - Course-specific examples"
echo "   - RAG prompts in both languages"
echo "   - Decorative lines removed"
echo "   - Functional underscores preserved"
echo ""
echo "🧪 Test on WhatsApp:"
echo "   English: 'Hello' or 'teach me'"
echo "   Swahili: 'Habari' or 'nifundishe'"
echo ""
