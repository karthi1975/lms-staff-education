#!/bin/bash

echo "=========================================="
echo "Testing AI Chat Wiring"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Check health
echo -e "${BLUE}Test 1: Health Check${NC}"
HEALTH=$(curl -s http://localhost:3000/health)
if echo "$HEALTH" | grep -q "healthy"; then
    echo -e "${GREEN}✓ Server is healthy${NC}"
else
    echo -e "${RED}✗ Server is not healthy${NC}"
    exit 1
fi
echo ""

# Test 2: Test chat endpoint (no auth required)
echo -e "${BLUE}Test 2: Chat API Endpoint (No Content)${NC}"
CHAT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello, can you help me?","module":"1","language":"english"}')

if echo "$CHAT_RESPONSE" | grep -q "success.*true"; then
    echo -e "${GREEN}✓ Chat endpoint is working${NC}"
    echo "Response preview: $(echo $CHAT_RESPONSE | jq -r '.response' 2>/dev/null | head -c 100)..."
else
    echo -e "${RED}✗ Chat endpoint failed${NC}"
    echo "Response: $CHAT_RESPONSE"
fi
echo ""

# Test 3: Test chat with specific question
echo -e "${BLUE}Test 3: Ask a specific question${NC}"
CHAT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is overview & textbooks?","module":"Overview & Textbooks","language":"english"}')

if echo "$CHAT_RESPONSE" | grep -q "success.*true"; then
    echo -e "${GREEN}✓ Chat responded to specific question${NC}"
    echo "Response: $(echo $CHAT_RESPONSE | jq -r '.response' 2>/dev/null)"
    echo ""
    echo "Context documents found: $(echo $CHAT_RESPONSE | jq -r '.context | length' 2>/dev/null)"
else
    echo -e "${RED}✗ Chat failed${NC}"
    echo "Response: $CHAT_RESPONSE"
fi
echo ""

# Test 4: Check ChromaDB stats
echo -e "${BLUE}Test 4: ChromaDB Content Check${NC}"
STATS=$(docker exec teachers_training-app-1 node -e "
const chromaService = require('./services/chroma.service');
chromaService.initialize().then(() => chromaService.getStats()).then(stats => console.log(JSON.stringify(stats))).catch(e => console.error(e));
" 2>&1 | grep -v "Warning\|Deprecated")

if echo "$STATS" | grep -q "totalDocuments"; then
    echo -e "${GREEN}✓ ChromaDB is accessible${NC}"
    echo "Stats: $STATS"
else
    echo -e "${RED}✗ ChromaDB stats not available${NC}"
fi
echo ""

# Test 5: Frontend files check
echo -e "${BLUE}Test 5: Frontend Chat Configuration${NC}"
LMS_CHAT=$(grep -c "fetch.*\/api\/chat" public/admin/lms-dashboard.html)
CHAT_HTML=$(grep -c "fetch.*\/api\/chat" public/admin/chat.html)

if [ "$LMS_CHAT" -gt 0 ] && [ "$CHAT_HTML" -gt 0 ]; then
    echo -e "${GREEN}✓ Frontend chat endpoints configured correctly${NC}"
    echo "  - lms-dashboard.html: $LMS_CHAT chat call(s)"
    echo "  - chat.html: $CHAT_HTML chat call(s)"
else
    echo -e "${RED}✗ Frontend chat configuration issue${NC}"
fi
echo ""

# Test 6: Test with module ID
echo -e "${BLUE}Test 6: Chat with Module Context${NC}"
CHAT_WITH_MODULE=$(curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Tell me about this module","module":"1","useContext":true,"language":"english"}')

if echo "$CHAT_WITH_MODULE" | grep -q "success.*true"; then
    echo -e "${GREEN}✓ Chat with module context works${NC}"
    VECTOR_SOURCES=$(echo $CHAT_WITH_MODULE | jq -r '.sources.vector_db' 2>/dev/null)
    GRAPH_SOURCES=$(echo $CHAT_WITH_MODULE | jq -r '.sources.graph_db' 2>/dev/null)
    echo "  - Vector DB sources: $VECTOR_SOURCES"
    echo "  - Graph DB sources: $GRAPH_SOURCES"
else
    echo -e "${RED}✗ Chat with module context failed${NC}"
fi
echo ""

# Summary
echo "=========================================="
echo -e "${GREEN}Chat Wiring Tests Complete!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Refresh your browser (F5 or Cmd+R)"
echo "2. Try the AI chat again"
echo "3. Upload content files for better responses"
echo ""
