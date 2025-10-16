#!/bin/bash
# Deploy Business Studies PDF indexing script to GCP and execute

set -e

GCP_INSTANCE="teachers-training"
GCP_ZONE="us-east5-a"
PDF_PATH="/Users/karthi/business/staff_education/education_materials/BUSINESS STUDIES F2.pdf"

echo "📦 Deploying Business Studies indexing to GCP..."
echo ""

# 1. Copy the indexing script to GCP
echo "1️⃣ Uploading indexing script..."
gcloud compute scp scripts/index-business-studies.js \
  ${GCP_INSTANCE}:~/teachers_training/scripts/ \
  --zone=${GCP_ZONE}

# 2. Copy the PDF file to GCP (if not already there)
echo ""
echo "2️⃣ Uploading Business Studies F2.pdf (13MB)..."
gcloud compute scp "${PDF_PATH}" \
  ${GCP_INSTANCE}:~/business_studies_f2.pdf \
  --zone=${GCP_ZONE}

# 3. SSH and run the indexing
echo ""
echo "3️⃣ Running indexing script on GCP..."
gcloud compute ssh ${GCP_INSTANCE} --zone=${GCP_ZONE} -- bash << 'ENDSSH'

# Navigate to project
cd ~/teachers_training

# Update the script to use the correct PDF path
sed -i "s|/Users/karthi/business/staff_education/education_materials/BUSINESS STUDIES F2.pdf|/home/$(whoami)/business_studies_f2.pdf|g" scripts/index-business-studies.js

# Run the indexing script
echo "🚀 Starting Business Studies PDF indexing..."
docker exec teachers_training_app_1 node scripts/index-business-studies.js

# Check the results
echo ""
echo "✅ Indexing complete! Verifying ChromaDB..."
docker exec teachers_training_app_1 node -e "
const chromaService = require('./services/chroma.service');
(async () => {
  await chromaService.initialize();
  const stats = await chromaService.getStats();
  console.log('📊 ChromaDB Statistics:');
  console.log('   Total documents:', stats.total_documents);
})();
"

ENDSSH

echo ""
echo "🎉 Business Studies indexing deployment complete!"
echo ""
echo "Next steps:"
echo "  - Test RAG queries to verify 'BUSINESS STUDIES F2.pdf' appears as source"
echo "  - Check WhatsApp responses for correct source citations"
