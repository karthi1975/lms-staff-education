#!/bin/bash
# Check if ChromaDB on cloud has content

echo "Testing ChromaDB on cloud instance..."
echo ""
echo "1. Checking if ChromaDB is accessible:"
curl -s http://34.162.136.203:8000/api/v1/heartbeat || echo "ChromaDB not accessible"
echo ""
echo ""
echo "2. You need to SSH to the cloud instance and run:"
echo "   gcloud compute ssh <instance-name> --zone=<zone>"
echo ""
echo "3. Then run this command to check ChromaDB stats:"
echo "   docker exec teachers_training-app-1 node -e \"const chromaService = require('./services/chroma.service'); chromaService.initialize().then(() => chromaService.getStats()).then(stats => console.log('ChromaDB stats:', stats)).catch(err => console.error('Error:', err))\""
echo ""
echo "4. Check if content needs to be reindexed on cloud:"
echo "   docker exec teachers_training-app-1 node scripts/reindex-chromadb.js"
