#!/bin/bash

echo "=================================================="
echo "WhatsApp + RAG + GraphDB Wiring Test"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Check all services are running
echo "1️⃣  Checking Service Health..."
HEALTH=$(curl -s http://34.162.136.203:3000/health)
echo "$HEALTH" | python3 -m json.tool

if echo "$HEALTH" | grep -q '"status":"healthy"'; then
  echo -e "${GREEN}✅ All services healthy${NC}"
else
  echo -e "${RED}❌ Services not healthy${NC}"
  exit 1
fi
echo ""

# Test 2: Check if content is uploaded
echo "2️⃣  Checking Content Upload..."
gcloud compute ssh teachers-training --zone us-east5-a -- "docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c 'SELECT COUNT(*) as content_files, SUM(chunk_count) as total_chunks FROM module_content' 2>&1" | grep -A 2 "content_files"

echo ""

# Test 3: Check ChromaDB has embeddings
echo "3️⃣  Checking ChromaDB Data..."
gcloud compute ssh teachers-training --zone us-east5-a -- "ls -lh /home/karthi/chromadb_data/chroma.sqlite3 && du -sh /home/karthi/chromadb_data"

echo ""

# Test 4: Check Vertex AI credentials
echo "4️⃣  Checking Vertex AI Credentials..."
gcloud compute ssh teachers-training --zone us-east5-a -- "cd ~/teachers_training && test -f gcp-key.json && echo '✅ GCP key exists' || echo '❌ GCP key missing'"
gcloud compute ssh teachers-training --zone us-east5-a -- "cd ~/teachers_training && grep -E 'VERTEX|GOOGLE|GCP_PROJECT' .env | grep -v '^#' | head -5"

echo ""

# Test 5: Check Neo4j has knowledge graph
echo "5️⃣  Checking Neo4j Knowledge Graph..."
gcloud compute ssh teachers-training --zone us-east5-a -- "docker exec teachers_training_neo4j_1 cypher-shell -u neo4j -p password 'MATCH (n) RETURN COUNT(n) as node_count' 2>&1" | grep -A 1 "node_count"

echo ""

# Test 6: Check for processing errors
echo "6️⃣  Checking Recent Processing Logs..."
gcloud compute ssh teachers-training --zone us-east5-a -- "docker logs teachers_training_app_1 --tail 50 2>&1 | grep -E '(Processing|chunk|error|vertex)' | tail -10"

echo ""

# Test 7: Test WhatsApp webhook
echo "7️⃣  Testing WhatsApp Webhook..."
curl -s -X GET "http://34.162.136.203:3000/webhook?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=education_bot_verify_2024" | head -20

echo ""
echo ""

echo "=================================================="
echo "Summary"
echo "=================================================="
echo ""
echo "✅ = Working | ❌ = Broken | ⚠️  = Needs Attention"
echo ""
echo "Services:"
echo "  - PostgreSQL, Neo4j, ChromaDB: ✅"
echo ""
echo "Content:"
echo "  - Files uploaded: Check above"
echo "  - Chunks processed: Check above (should be > 0)"
echo ""
echo "Vertex AI:"
echo "  - Credentials: Check above"
echo "  - If seeing 'Unable to obtain access token': ❌ BROKEN"
echo ""
echo "Next Steps:"
echo "  1. If chunks = 0: Content processing failed"
echo "  2. If Vertex AI broken: Need to fix authentication"
echo "  3. If all OK: Test WhatsApp chat"
echo ""
