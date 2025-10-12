# RAG + GraphDB Integration Guide

## Overview
This system implements a powerful **dual-architecture content processing pipeline** that combines:
1. **RAG (Retrieval-Augmented Generation)** using ChromaDB for semantic search
2. **Knowledge Graph** using Neo4j for relationship mapping and topic discovery

When you upload a file to a module, the system automatically:
- Extracts text from documents (PDF, DOCX, TXT)
- Chunks content into manageable pieces
- Creates vector embeddings in ChromaDB for semantic search
- Builds a knowledge graph in Neo4j showing relationships between content chunks and topics

## Architecture

```
File Upload → Document Processing → 3-Way Storage
                                   ├─ PostgreSQL (metadata, chunks)
                                   ├─ ChromaDB (vector embeddings)
                                   └─ Neo4j (knowledge graph)
```

### Data Flow

1. **Upload**: Admin uploads content file for a module
2. **Processing**: Document processor extracts text and creates chunks
3. **Storage**:
   - **PostgreSQL**: Stores chunk text, metadata, and references
   - **ChromaDB**: Stores vector embeddings for semantic similarity search
   - **Neo4j**: Creates graph nodes and relationships for topic navigation
4. **Query**: Users can query via RAG (semantic search) or Graph (topic exploration)

## API Endpoints

### 1. Upload Content (Creates RAG + GraphDB)
```bash
POST /api/admin/portal/courses/:courseId/modules/:moduleId/upload
```

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data
```

**Body:**
```
file: <PDF/DOCX/TXT file>
```

**Response:**
```json
{
  "success": true,
  "message": "Content uploaded and processed successfully (RAG + GraphDB)",
  "data": {
    "chunks": 15,
    "embeddings": 15,
    "graph_nodes": 15,
    "graph_topics": 8
  }
}
```

### 2. Get Module Knowledge Graph
```bash
GET /api/admin/modules/:moduleId/graph
```

**Response:**
```json
{
  "success": true,
  "data": {
    "module": {
      "id": 1,
      "name": "Introduction to Business",
      "description": "..."
    },
    "chunks": [
      {
        "id": "chunk_123",
        "text": "Business fundamentals include...",
        "chunk_order": 0,
        "chunk_size": 512
      }
    ],
    "topics": [
      {
        "name": "business fundamentals",
        "created_at": "2025-10-12T03:00:00.000Z"
      },
      {
        "name": "marketing",
        "created_at": "2025-10-12T03:00:00.000Z"
      }
    ],
    "relationships": [...]
  }
}
```

### 3. Get Related Content
```bash
GET /api/admin/modules/:moduleId/related
```

Finds modules that share topics with the given module.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "module_id": 5,
      "module_name": "Advanced Marketing",
      "shared_topics": 3
    }
  ]
}
```

### 4. Search by Topic
```bash
GET /api/admin/search/topic/:topicName?limit=10
```

Searches the knowledge graph for content related to a topic.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "module_name": "Introduction to Business",
      "module_id": 1,
      "content_preview": "Business fundamentals include...",
      "topic": "business fundamentals"
    }
  ]
}
```

## Usage Examples

### Example 1: Create Course with Module and Upload Content

```bash
# 1. Login as admin
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"Admin123!"}' \
  | jq -r '.data.token')

# 2. Create a new course
COURSE=$(curl -s -X POST http://localhost:3000/api/admin/portal/courses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "course_name": "Business Studies 101",
    "course_code": "BUS-101",
    "description": "Introduction to business concepts",
    "category": "Business"
  }')

COURSE_ID=$(echo $COURSE | jq -r '.data.id')

# 3. Create a module
MODULE=$(curl -s -X POST http://localhost:3000/api/admin/portal/courses/$COURSE_ID/modules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "module_name": "Business Fundamentals",
    "description": "Core business concepts",
    "sequence_order": 1
  }')

MODULE_ID=$(echo $MODULE | jq -r '.data.id')

# 4. Upload content (creates RAG + GraphDB)
curl -X POST http://localhost:3000/api/admin/portal/courses/$COURSE_ID/modules/$MODULE_ID/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/business_fundamentals.pdf"

# Response:
# {
#   "success": true,
#   "message": "Content uploaded and processed successfully (RAG + GraphDB)",
#   "data": {
#     "chunks": 25,
#     "embeddings": 25,
#     "graph_nodes": 25,
#     "graph_topics": 12
#   }
# }
```

### Example 2: Query Knowledge Graph

```bash
# Get module's knowledge graph
curl -s http://localhost:3000/api/admin/modules/$MODULE_ID/graph \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Find related modules
curl -s http://localhost:3000/api/admin/modules/$MODULE_ID/related \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Search for content by topic
curl -s "http://localhost:3000/api/admin/search/topic/marketing?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

## Neo4j Knowledge Graph Schema

### Node Types

1. **Course**
   - Properties: `id`, `moodle_course_id`, `name`, `code`, `description`, `category`, `source`

2. **Module**
   - Properties: `id`, `name`, `description`, `order_index`, `module_type`

3. **ContentChunk**
   - Properties: `id`, `text`, `chunk_order`, `chunk_size`

4. **Topic**
   - Properties: `name`

### Relationships

- `(Course)-[:CONTAINS]->(Module)`
- `(Module)-[:HAS_CONTENT]->(ContentChunk)`
- `(ContentChunk)-[:FOLLOWED_BY]->(ContentChunk)`
- `(ContentChunk)-[:DISCUSSES]->(Topic)`
- `(Module)-[:COVERS_TOPIC]->(Topic)`

## Integration with RAG Pipeline

The system uses both RAG and Knowledge Graph together:

### RAG (Semantic Search)
- User asks: "What are the principles of marketing?"
- ChromaDB finds semantically similar chunks using vector similarity
- Returns relevant content even if exact keywords don't match

### Knowledge Graph (Topic Navigation)
- User browses by topic: "Show me all content about marketing"
- Neo4j traverses relationships to find all chunks and modules tagged with "marketing"
- Discovers related topics and modules through graph connections

### Combined Power
```javascript
// Pseudo-code for enhanced content retrieval
async function getRelevantContent(userQuery, moduleId) {
  // 1. RAG: Semantic search
  const semanticResults = await chromaDB.search(userQuery, limit: 5);

  // 2. Graph: Topic-based expansion
  const topics = extractTopics(semanticResults);
  const relatedContent = await neo4j.searchByTopics(topics);

  // 3. Combine and rank
  return mergeAndRank(semanticResults, relatedContent);
}
```

## System Benefits

### 1. Semantic Understanding
- ChromaDB enables finding content by meaning, not just keywords
- Handles synonyms and related concepts automatically

### 2. Relationship Discovery
- Neo4j reveals connections between topics and modules
- Identifies prerequisite knowledge and learning paths

### 3. Personalized Learning
- Graph tracks user progress and recommends next steps
- Adapts to learning patterns and preferences

### 4. Content Organization
- Automatic topic extraction and categorization
- Visual representation of knowledge structure

## Database Schema Updates

### PostgreSQL Tables

#### `moodle_courses`
- Added `source` field to distinguish portal vs Moodle courses
- Added `portal_created_by`, `portal_created_at` for audit trail

#### `moodle_modules`
- Added `source` field
- Added `portal_created_by`, `portal_created_at`
- Added `content_file_path` to store uploaded file path

#### `module_content_chunks`
- Stores text chunks with metadata
- Links to Neo4j via `neo4j_node_id`
- Links to ChromaDB via `embedding_id`

### ChromaDB Collections

Collection: `module_content`
- Documents: chunk text content
- Metadata: `module_id`, `chunk_id`, `source`, `filename`, `topics`
- Embeddings: Vector representations using Vertex AI

### Neo4j Graph

See schema above for node types and relationships.

## Service Layer Architecture

### `portal-content.service.js`
Main orchestrator that:
1. Processes uploaded files
2. Coordinates storage across all three databases
3. Handles errors gracefully (partial failures don't break upload)

### `neo4j.service.js`
Knowledge graph operations:
- `createCourse()` - Create course node
- `createModuleInCourse()` - Create module linked to course
- `createContentGraph()` - Build content graph from chunks
- `getModuleContentGraph()` - Retrieve graph visualization data
- `searchByTopic()` - Find content by topic
- `getRelatedContent()` - Discover related modules

### `chroma.service.js`
Vector database operations:
- `addDocument()` - Store document with embeddings
- `search()` - Semantic similarity search
- `deleteByModule()` - Clean up module content

## Testing the Integration

### Prerequisites
```bash
# Ensure all services are running
docker-compose up -d

# Check status
docker-compose ps
```

### Test Steps

1. **Login**
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@school.edu","password":"Admin123!"}'
   ```

2. **Create Course**
   ```bash
   curl -X POST http://localhost:3000/api/admin/portal/courses \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"course_name":"Test Course","course_code":"TEST-001"}'
   ```

3. **Create Module**
   ```bash
   curl -X POST http://localhost:3000/api/admin/portal/courses/1/modules \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"module_name":"Test Module"}'
   ```

4. **Upload File**
   ```bash
   curl -X POST http://localhost:3000/api/admin/portal/courses/1/modules/1/upload \
     -H "Authorization: Bearer $TOKEN" \
     -F "file=@test.pdf"
   ```

5. **Verify Knowledge Graph**
   ```bash
   curl http://localhost:3000/api/admin/modules/1/graph \
     -H "Authorization: Bearer $TOKEN"
   ```

6. **Query Neo4j Directly** (optional)
   ```bash
   docker exec -it teachers_training-neo4j-1 cypher-shell -u neo4j -p password

   # Query all modules
   MATCH (m:Module) RETURN m;

   # Query content chunks for a module
   MATCH (m:Module {id: 1})-[:HAS_CONTENT]->(c:ContentChunk)
   RETURN c;

   # Query topics
   MATCH (t:Topic)<-[:DISCUSSES]-(c:ContentChunk)
   RETURN t.name, count(c) as chunk_count
   ORDER BY chunk_count DESC;
   ```

## Performance Considerations

### Chunk Size
- Default: 512-1024 tokens per chunk
- Larger chunks: Better context, slower processing
- Smaller chunks: Faster processing, may lose context

### Embedding Generation
- Uses Vertex AI for embeddings
- Processing time: ~100-200ms per chunk
- Bulk processing recommended for large documents

### Graph Complexity
- Neo4j performance degrades with very large graphs (>1M nodes)
- Current design: ~100-1000 chunks per module is optimal
- Use pagination for large result sets

## Troubleshooting

### Neo4j Connection Errors
```bash
# Check Neo4j is running
docker logs teachers_training-neo4j-1

# Verify connection
curl http://localhost:7474
```

### ChromaDB Errors
```bash
# Check ChromaDB is running
docker logs teachers_training-chromadb-1

# Test connection
curl http://localhost:8000/api/v1/heartbeat
```

### No Topics Extracted
- Ensure document processor is extracting metadata
- Check that chunks have `metadata.topics` or `metadata.keywords`
- Verify Neo4j `createContentGraph()` is receiving topic data

### Partial Upload Success
The system is designed to be resilient:
- If Neo4j fails, content is still stored in PostgreSQL and ChromaDB
- If ChromaDB fails, content is still in PostgreSQL and Neo4j
- Check logs for specific errors

## Future Enhancements

1. **Graph Visualization UI**
   - Interactive graph explorer in admin dashboard
   - D3.js or Cytoscape.js visualization

2. **Advanced Recommendations**
   - Machine learning-based content suggestions
   - User behavior analysis in graph

3. **Multi-Language Support**
   - Language-specific embeddings
   - Cross-language topic mapping

4. **Automated Topic Extraction**
   - NLP-based keyword extraction
   - Topic modeling (LDA, BERT)

## Conclusion

The RAG + GraphDB integration provides a powerful dual approach to content management:
- **RAG** for semantic search and intelligent Q&A
- **Knowledge Graph** for relationship discovery and navigation

This architecture enables personalized learning experiences, content recommendations, and intelligent tutoring capabilities.

---

**Generated**: 2025-10-12
**Version**: 1.0
**Author**: Teachers Training System - AI Assistant
