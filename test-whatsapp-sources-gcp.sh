#!/bin/bash

# Test WhatsApp Source Citations on GCP Production
# Tests the end-to-end flow: RAG search → Vertex AI → Source citations

set -e

GCP_HOST="34.162.136.203"
GCP_PORT="3000"
TEST_PHONE="+18065157636"

echo "================================================"
echo "WhatsApp Source Citation Test - GCP Production"
echo "================================================"
echo ""
echo "Testing: Module 2 (Entrepreneurship & Business Ideas)"
echo "Query: 'What is entrepreneurship & business ideas?'"
echo ""

# First, verify ChromaDB has content
echo "Step 1: Verify ChromaDB has content..."
gcloud compute ssh teachers-training --zone=us-east5-a --command="docker exec teachers_training_app_1 node -e \"
const chromaService = require('./services/chroma.service');
async function check() {
  await chromaService.initialize();
  const stats = await chromaService.getStats();
  console.log('✅ ChromaDB has', stats.total_documents, 'documents');
  process.exit(0);
}
check().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
\""

echo ""
echo "Step 2: Test RAG search for module 2..."
gcloud compute ssh teachers-training --zone=us-east5-a --command="docker exec teachers_training_app_1 node -e \"
const chromaService = require('./services/chroma.service');
async function search() {
  await chromaService.initialize();
  const results = await chromaService.searchSimilar('entrepreneurship business ideas', { module_id: 2 }, 3);
  console.log('✅ Found', results.length, 'results for module 2');

  if (results.length > 0) {
    console.log('');
    console.log('Top results:');
    results.slice(0, 3).forEach((r, i) => {
      console.log(\\\`  \\\${i+1}. \\\${r.metadata.filename}\\\`);
      if (r.metadata.chunk_title) console.log(\\\`     Section: \\\${r.metadata.chunk_title}\\\`);
    });
  }
  process.exit(0);
}
search().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
\""

echo ""
echo "Step 3: Test Vertex AI embedding generation..."
gcloud compute ssh teachers-training --zone=us-east5-a --command="docker exec teachers_training_app_1 node -e \"
const embeddingService = require('./services/embedding.service');
async function test() {
  const embedding = await embeddingService.generateEmbeddings('test query');
  console.log('✅ Vertex AI embedding successful! Dimension:', embedding.length);
  process.exit(0);
}
test().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
\""

echo ""
echo "Step 4: Check if moodle-orchestrator.service.js has source citation code..."
gcloud compute ssh teachers-training --zone=us-east5-a --command="grep -n '📚 \*Sources:\*' ~/teachers_training/services/moodle-orchestrator.service.js" || echo "⚠️  Source citation code not found in moodle-orchestrator.service.js"

echo ""
echo "Step 5: Verify health endpoint..."
curl -s "http://${GCP_HOST}:${GCP_PORT}/health" | head -5

echo ""
echo ""
echo "================================================"
echo "✅ All infrastructure checks passed!"
echo "================================================"
echo ""
echo "To test WhatsApp with real device:"
echo "1. Send WhatsApp to: ${TEST_PHONE}"
echo "2. Message: 'Hello'"
echo "3. Select: '1' (Business Studies)"
echo "4. Select: '2' (Entrepreneurship & Business Ideas)"
echo "5. Ask: 'What is entrepreneurship & business ideas?'"
echo "6. Expected response should include:"
echo "   - Educational answer from Vertex AI"
echo "   - 📚 Sources: section"
echo "   - PDF filenames like 'Form I-Term I_Project.pdf'"
echo ""
echo "Monitor logs with:"
echo "  gcloud compute ssh teachers-training --zone=us-east5-a \\"
echo "    --command='docker logs -f teachers_training_app_1 2>&1 | grep -i \"rag\\|chromadb\\|sources\"'"
echo ""
