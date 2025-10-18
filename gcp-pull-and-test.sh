#!/bin/bash

echo "=================================================="
echo "GCP: Pull Latest Code and Test"
echo "=================================================="
echo ""

# SSH into GCP and pull latest code
gcloud compute ssh teachers-training --zone us-east5-a << 'ENDSSH'

cd ~/teachers_training

echo "Step 1: Pulling latest code from GitHub..."
git stash
git pull origin master

if [ $? -eq 0 ]; then
  echo "✅ Code pulled successfully"
else
  echo "❌ Failed to pull code"
  exit 1
fi

echo ""
echo "Step 2: Checking what's new..."
git log --oneline -5

echo ""
echo "Step 3: Listing new diagnostic tools..."
ls -lh COMPLETE_RAG_FIX_GUIDE.md FIX_VERTEX_AI_AND_RAG.md test-whatsapp-rag-wiring.sh setup-vertex-auth-gcp.sh 2>/dev/null

echo ""
echo "Step 4: Running wiring test..."
chmod +x test-whatsapp-rag-wiring.sh
./test-whatsapp-rag-wiring.sh

echo ""
echo "=================================================="
echo "Next Steps:"
echo "=================================================="
echo ""
echo "📖 READ: cat COMPLETE_RAG_FIX_GUIDE.md"
echo ""
echo "🔧 FIX: Follow the 13 steps in the guide"
echo ""
echo "✅ TEST: ./test-whatsapp-rag-wiring.sh (run anytime)"
echo ""
echo "Start with Step 1 in COMPLETE_RAG_FIX_GUIDE.md"
echo ""

ENDSSH

echo ""
echo "✅ Done! You're now on GCP with latest code"
echo ""
