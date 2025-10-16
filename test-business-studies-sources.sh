#!/bin/bash
# Test Business Studies RAG retrieval to verify source attribution

set -e

echo "🔍 Testing Business Studies RAG Source Attribution"
echo "=================================================="
echo ""

# Test queries for each module
QUERIES=(
  "What are the factors of production?"
  "What are the sources of financing for small businesses?"
  "How do you manage a cash book?"
  "What is FIFO inventory method?"
  "How do you identify business opportunities?"
)

for query in "${QUERIES[@]}"; do
  echo "📝 Query: $query"
  echo "----------------------------------------"

  curl -s -X POST http://localhost:3000/api/chat \
    -H 'Content-Type: application/json' \
    -d "{
      \"phone\": \"test_business_source_check\",
      \"message\": \"$query\",
      \"language\": \"english\"
    }" | jq -r '.sources[]? | "   ✓ Source: \(.file_name // .original_file // "Unknown") (Module: \(.module_title // "Unknown"))"'

  echo ""
done

echo "=================================================="
echo "✅ Test complete!"
echo ""
echo "Expected result: All sources should show 'BUSINESS STUDIES F2.pdf'"
echo "If you see intermediate filenames, rerun the indexing script"
