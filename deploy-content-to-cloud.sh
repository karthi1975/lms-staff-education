#!/bin/bash
# Deploy and reindex content on cloud instance

set -e

CLOUD_IP="34.162.136.203"
INSTANCE_NAME="teachers-training-vm"  # Update this with actual instance name
ZONE="us-central1-a"  # Update this with actual zone

echo "=========================================="
echo "Deploy Content to Cloud Instance"
echo "=========================================="
echo ""

# Step 1: Check if we have content locally
echo "1. Checking local content..."
if [ ! -d "uploads" ] || [ -z "$(ls -A uploads 2>/dev/null)" ]; then
    echo "❌ No content found in uploads/ directory"
    echo "   Please upload content files first"
    exit 1
fi

CONTENT_COUNT=$(find uploads -type f | wc -l)
echo "✅ Found $CONTENT_COUNT files in uploads/"
echo ""

# Step 2: SSH and upload
echo "2. You need to run these commands:"
echo ""
echo "# SSH to cloud instance"
echo "gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
echo ""
echo "# Once in the cloud instance, run:"
echo "cd /path/to/teachers_training"
echo ""
echo "# Check current ChromaDB status"
echo "docker exec teachers_training-app-1 node -e \"const chromaService = require('./services/chroma.service'); chromaService.initialize().then(() => chromaService.getStats()).then(stats => console.log('Before:', stats))\""
echo ""
echo "# Reindex all content"
echo "docker exec teachers_training-app-1 node scripts/reindex-chromadb.js"
echo ""
echo "# Check ChromaDB after reindexing"
echo "docker exec teachers_training-app-1 node -e \"const chromaService = require('./services/chroma.service'); chromaService.initialize().then(() => chromaService.getStats()).then(stats => console.log('After:', stats))\""
echo ""

# Step 3: Alternative - Copy from local
echo "=========================================="
echo "OR - Copy content from local to cloud:"
echo "=========================================="
echo ""
echo "# Copy uploads directory to cloud"
echo "gcloud compute scp --recurse ./uploads $INSTANCE_NAME:~/teachers_training/uploads --zone=$ZONE"
echo ""
echo "# Copy database migrations if needed"
echo "gcloud compute scp --recurse ./database $INSTANCE_NAME:~/teachers_training/database --zone=$ZONE"
echo ""
echo "# Then SSH and run reindex"
echo "gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
echo "cd ~/teachers_training"
echo "docker exec teachers_training-app-1 node scripts/reindex-chromadb.js"
echo ""

# Step 4: Verification
echo "=========================================="
echo "Verification Steps:"
echo "=========================================="
echo ""
echo "1. Check ChromaDB has documents:"
echo "   curl http://$CLOUD_IP:3000/health"
echo ""
echo "2. Test RAG retrieval:"
echo "   Send WhatsApp: 'What is entrepreneurship?'"
echo ""
echo "3. Check logs for RAG activity:"
echo "   docker logs teachers_training-app-1 | grep -i 'rag\|chromadb\|search'"
echo ""

