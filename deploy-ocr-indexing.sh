#!/bin/bash
# Deploy OCR indexing solution to GCP with RAG + GraphDB support

set -e

GCP_INSTANCE="teachers-training"
GCP_ZONE="us-east5-a"

echo "🚀 Deploying OCR Indexing with RAG + GraphDB"
echo "=============================================="
echo ""

# Step 1: Upload scripts
echo "1️⃣ Uploading OCR scripts to GCP..."
gcloud compute scp scripts/ocr-index-business-studies.js \
  ${GCP_INSTANCE}:~/teachers_training/scripts/ \
  --zone=${GCP_ZONE}

gcloud compute scp scripts/install-ocr-dependencies.sh \
  ${GCP_INSTANCE}:~/teachers_training/scripts/ \
  --zone=${GCP_ZONE}

echo ""
echo "2️⃣ Installing OCR dependencies on GCP..."
gcloud compute ssh ${GCP_INSTANCE} --zone=${GCP_ZONE} -- \
  'bash ~/teachers_training/scripts/install-ocr-dependencies.sh'

echo ""
echo "3️⃣ Copying scripts into Docker container..."
gcloud compute ssh ${GCP_INSTANCE} --zone=${GCP_ZONE} -- bash << 'ENDSSH'

cd ~/teachers_training

# Copy OCR script into container
docker cp scripts/ocr-index-business-studies.js teachers_training_app_1:/app/scripts/

# Verify PDF is in container
if docker exec teachers_training_app_1 test -f /app/business_studies_f2.pdf; then
  echo "✅ PDF file found in container"
else
  echo "⚠️  Copying PDF to container..."
  docker cp ~/business_studies_f2.pdf teachers_training_app_1:/app/
fi

ENDSSH

echo ""
echo "4️⃣ Running OCR indexing with RAG + GraphDB..."
echo "   This will take 2-3 minutes for OCR processing..."
echo ""

gcloud compute ssh ${GCP_INSTANCE} --zone=${GCP_ZONE} -- \
  'docker exec teachers_training_app_1 node /app/scripts/ocr-index-business-studies.js'

echo ""
echo "=============================================="
echo "🎉 OCR Indexing Complete!"
echo ""
echo "✅ Content indexed in:"
echo "   - ChromaDB (RAG - Vector similarity search)"
echo "   - Neo4j (GraphDB - Knowledge graph relationships)"
echo ""
echo "🧪 Test the system:"
echo '   curl -X POST http://YOUR_GCP_IP:3000/api/chat \'
echo '     -H "Content-Type: application/json" \'
echo '     -d '"'"'{"phone": "test", "message": "What are the factors of production?", "language": "english"}'"'"
echo ""
