# Bilingual RAG + OCR + GraphDB Integration Guide

**Date:** 2025-11-03
**Feature:** Multi-language document processing with OCR, RAG, and Knowledge Graph

---

## 📋 Overview

This feature provides comprehensive bilingual (English & Swahili) support for document processing, retrieval, and Q&A using:

- **OCR** (Tesseract.js): Extract text from scanned PDFs and images
- **RAG** (Retrieval-Augmented Generation): Context-aware Q&A from training materials
- **ChromaDB**: Separate vector collections for English and Swahili content
- **Neo4j**: Knowledge graph for learning paths and document relationships
- **Vertex AI**: Bilingual response generation

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                      DOCUMENT UPLOAD                                  │
│  PDF/DOCX/TXT/Images → OCR → Language Detection → Chunking          │
└────────────────────────┬─────────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌──────────────────┐          ┌──────────────────┐
│  ChromaDB        │          │    Neo4j         │
│  Collections:    │          │    Graph DB      │
│  - English       │          │                  │
│  - Swahili       │          │  Nodes:          │
│  - Mixed         │          │  - Document      │
│                  │          │  - Course        │
│  768-dim vectors │          │  - Module        │
│  (Vertex AI)     │          │  - Interaction   │
└────────┬─────────┘          └──────┬───────────┘
         │                           │
         │        QUERY RAG          │
         │     ┌─────────────┐       │
         └────►│ Bilingual   │◄──────┘
              │ RAG Service │
              └──────┬──────┘
                     │
                     ▼
              ┌────────────┐
              │ Vertex AI  │
              │ Response   │
              └────────────┘
```

---

## 🚀 Quick Start

### 1. Initialize Services

```bash
# Start required services
docker-compose up chromadb neo4j postgres

# Verify services are running
curl http://localhost:8000/api/v1/heartbeat  # ChromaDB
curl http://localhost:7474                    # Neo4j
```

### 2. Initialize Bilingual Collections

The collections are auto-created on first use:
- `teachers_training_english`
- `teachers_training_swahili`
- `teachers_training_mixed`

### 3. Upload Documents

```bash
# Upload bilingual document with auto language detection
curl -X POST "http://localhost:3000/api/admin/courses/10/upload-bilingual" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@document.pdf" \
  -F "language=auto" \
  -F "moduleId=1"
```

### 4. Query Content

```bash
# English query
curl -X POST "http://localhost:3000/api/admin/courses/10/query-bilingual" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are effective classroom management strategies?",
    "language": "english",
    "moduleId": 1
  }'

# Swahili query
curl -X POST "http://localhost:3000/api/admin/courses/10/query-bilingual" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Je, mikakati ya usimamizi wa darasa ni ipi?",
    "language": "swahili",
    "moduleId": 1
  }'
```

---

## 📝 API Endpoints

### Upload Bilingual Documents

**Endpoint:** `POST /api/admin/courses/:courseId/upload-bilingual`

**Parameters:**
- `files` (multipart): PDF, DOCX, TXT, PNG, JPG files
- `language` (string): `auto`, `english`, or `swahili`
- `moduleId` (int): Optional module ID

**Response:**
```json
{
  "success": true,
  "processed": 1,
  "succeeded": 1,
  "failed": 0,
  "results": [
    {
      "filename": "classroom-management.pdf",
      "success": true,
      "language": "mixed",
      "chunks": 12,
      "chromaIds": ["uuid1", "uuid2", ...],
      "processingTime": "5.3s",
      "fileSize": 2456789
    }
  ]
}
```

### Query Bilingual RAG

**Endpoint:** `POST /api/admin/courses/:courseId/query-bilingual`

**Body:**
```json
{
  "query": "Your question here",
  "language": "auto",  // or "english", "swahili"
  "moduleId": 1        // optional
}
```

**Response:**
```json
{
  "success": true,
  "answer": "Classroom management strategies include...",
  "sources": [
    {
      "filename": "classroom-management.pdf",
      "language": "english",
      "distance": "0.2345"
    }
  ],
  "hasContext": true,
  "language": "english",
  "graphEnhanced": true
}
```

### Get Statistics

**Endpoint:** `GET /api/admin/courses/:courseId/bilingual-stats`

**Response:**
```json
{
  "success": true,
  "courseId": 10,
  "documents": [
    {
      "language": "english",
      "document_count": "15",
      "total_chunks": "234",
      "total_size": "12345678"
    },
    {
      "language": "swahili",
      "document_count": "8",
      "total_chunks": "156",
      "total_size": "6543210"
    }
  ],
  "chroma": {
    "english": { "count": 234, "name": "teachers_training_english" },
    "swahili": { "count": 156, "name": "teachers_training_swahili" },
    "mixed": { "count": 45, "name": "teachers_training_mixed" }
  },
  "rag": {
    "neo4j": { "connected": true }
  }
}
```

---

## 🔧 Services & Components

### 1. BilingualChromaService (`services/bilingual-chroma.service.js`)

Manages separate ChromaDB collections for each language.

**Key Methods:**
- `initialize()`: Create/connect to language collections
- `addDocument({content, language, courseId, metadata})`: Add document to appropriate collection
- `searchSimilar(query, {language, courseId, limit})`: Semantic search
- `detectLanguage(text)`: Auto-detect English/Swahili/Mixed

### 2. BilingualRAGService (`services/bilingual-rag.service.js`)

RAG pipeline with Neo4j integration.

**Key Methods:**
- `queryContent(query, {language, courseId, userId})`: Full RAG query
- `addDocument({content, language, courseId, metadata})`: Add to RAG + Graph
- `generateBilingualResponse(query, context, language)`: LLM response

### 3. Neo4jService (Extended)

**New Methods:**
- `createInteraction(data)`: Track user Q&A interactions
- `createDocument(data)`: Add document to knowledge graph
- `getUserModuleProgress(userId, courseId)`: Get learning context

### 4. DocumentProcessorService

Handles OCR extraction (existing service, already supports Tesseract.js).

**OCR Features:**
- Auto-detects image-based PDFs
- Processes scanned documents
- Configurable page limits for large files

---

## 🌍 Language Detection

The system uses a heuristic-based language detector:

**Swahili Markers:**
- Common words: `ni`, `na`, `wa`, `kwa`, `katika`, `au`, `lakini`
- Verbs: `kuwa`, `kufanya`, `kupata`, `kwenda`
- Greetings: `habari`, `asante`, `karibu`
- Education terms: `mwalimu`, `wanafunzi`, `shule`, `elimu`, `mafunzo`

**Detection Logic:**
- > 15% Swahili markers → **Swahili**
- 5-15% Swahili markers → **Mixed**
- < 5% Swahili markers → **English**

---

## 📊 Database Schema

### PostgreSQL

```sql
-- course_content table (already exists)
ALTER TABLE course_content ADD COLUMN IF NOT EXISTS language VARCHAR(20);
ALTER TABLE course_content ADD COLUMN IF NOT EXISTS chunks_count INTEGER;
```

### Neo4j Graph Structure

```cypher
// Document Node
(:Document {
  id: uuid,
  course_id: int,
  module_id: int,
  language: string,
  filename: string,
  created_at: datetime
})

// Interaction Node (Q&A tracking)
(:Interaction {
  id: uuid,
  query: string,
  response: string,
  language: string,
  course_id: int,
  timestamp: datetime
})

// Relationships
(Document)-[:BELONGS_TO]->(Course)
(Document)-[:PART_OF]->(Module)
(User)-[:ASKED]->(Interaction)
```

### ChromaDB Collections

```
teachers_training_english/
  ├─ metadata: { language: 'english', course_id, module_id, filename }
  ├─ embeddings: 768-dim vectors (Vertex AI)
  └─ documents: text chunks

teachers_training_swahili/
  ├─ metadata: { language: 'swahili', course_id, module_id, filename }
  ├─ embeddings: 768-dim vectors (Vertex AI)
  └─ documents: text chunks

teachers_training_mixed/
  └─ bilingual documents
```

---

## 🧪 Testing

### Run Comprehensive Test

```bash
chmod +x test-bilingual-ocr-rag.sh
./test-bilingual-ocr-rag.sh
```

**Test Coverage:**
1. Document upload with language detection
2. OCR text extraction (if scanned)
3. ChromaDB collection routing
4. English RAG queries
5. Swahili RAG queries
6. Neo4j graph integration
7. Statistics endpoint

### Manual Testing Steps

1. **Upload English Document:**
   ```bash
   curl -X POST "http://localhost:3000/api/admin/courses/10/upload-bilingual" \
     -H "Authorization: Bearer $TOKEN" \
     -F "files=@english-doc.pdf" \
     -F "language=english"
   ```

2. **Upload Swahili Document:**
   ```bash
   curl -X POST "http://localhost:3000/api/admin/courses/10/upload-bilingual" \
     -H "Authorization: Bearer $TOKEN" \
     -F "files=@swahili-doc.pdf" \
     -F "language=swahili"
   ```

3. **Upload Scanned PDF (OCR):**
   ```bash
   curl -X POST "http://localhost:3000/api/admin/courses/10/upload-bilingual" \
     -H "Authorization: Bearer $TOKEN" \
     -F "files=@scanned-image.pdf" \
     -F "language=auto"
   ```

4. **Query in English:**
   ```bash
   curl -X POST "http://localhost:3000/api/admin/courses/10/query-bilingual" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"query": "What is effective teaching?", "language": "english"}'
   ```

5. **Query in Swahili:**
   ```bash
   curl -X POST "http://localhost:3000/api/admin/courses/10/query-bilingual" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"query": "Ni nini ufundishaji mzuri?", "language": "swahili"}'
   ```

---

## 🔍 Troubleshooting

### Issue: "ChromaDB not connected"

**Solution:**
```bash
# Check ChromaDB status
curl http://localhost:8000/api/v1/heartbeat

# Restart ChromaDB
docker-compose restart chromadb

# Check logs
docker logs teachers_training_chromadb_1
```

### Issue: "No context found"

**Possible Causes:**
1. Collections are empty (no documents uploaded)
2. Language mismatch (querying English in Swahili collection)
3. ChromaDB not initialized

**Solution:**
```bash
# Check collection stats
curl -X GET "http://localhost:3000/api/admin/courses/10/bilingual-stats" \
  -H "Authorization: Bearer $TOKEN"

# Upload documents first
# Then query with correct language parameter
```

### Issue: "OCR timeout on large PDFs"

**Solution:**
- Files > 100 pages are auto-limited to prevent timeout
- For very large documents, split into smaller files
- Increase timeout in `document-processor.service.js` if needed

### Issue: "Neo4j not connected"

**Solution:**
```bash
# Check Neo4j status
curl http://localhost:7474

# Restart Neo4j
docker-compose restart neo4j

# Note: App works without Neo4j (graph features disabled)
```

---

## 📈 Performance Considerations

### Document Processing Time

- **Text PDF** (10 pages): ~2-5 seconds
- **Scanned PDF (OCR)** (10 pages): ~30-60 seconds
- **Large PDF** (100+ pages): ~5-10 minutes

### Optimization Tips

1. **Batch Uploads**: Upload multiple files in one request (up to 10 files)
2. **Page Limits**: Use `ocrPageLimit` for large scanned documents
3. **Background Processing**: For very large documents, use the background processing endpoint
4. **Chunk Size**: Default 1000 chars, adjust in `document-processor.service.js`

---

## 🔐 Security

### File Upload Restrictions

- Max file size: **50MB**
- Allowed types: PDF, DOCX, DOC, TXT, MD, PNG, JPG, JPEG
- Authentication required: Admin token
- Role-based access: Admin only

### Content Moderation

- OCR results are validated before storage
- Minimum chunk size enforced (50 chars)
- Maximum chunk size enforced (4000 chars)

---

## 🚀 Deployment to GCP

### Prerequisites

```bash
# Services running on GCP:
- PostgreSQL (teachers_training_postgres_1)
- Neo4j (teachers_training_neo4j_1)
- ChromaDB (teachers_training_chromadb_1)
- App (teachers_training_app_1)
```

### Deployment Steps

1. **Commit and Push:**
   ```bash
   git add .
   git commit -m "feat: Add bilingual RAG + OCR + GraphDB support"
   git push origin feature/multi-region-rbac
   ```

2. **SSH to GCP:**
   ```bash
   gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant"
   ```

3. **Deploy on GCP:**
   ```bash
   cd /home/karthi/teachers_training
   git pull origin feature/multi-region-rbac

   # Copy new files
   docker cp services/bilingual-chroma.service.js teachers_training_app_1:/app/services/
   docker cp services/bilingual-rag.service.js teachers_training_app_1:/app/services/
   docker cp routes/bilingual-upload.routes.js teachers_training_app_1:/app/routes/
   docker cp services/neo4j.service.js teachers_training_app_1:/app/services/
   docker cp server.js teachers_training_app_1:/app/

   # Restart Node.js
   docker exec teachers_training_app_1 sh -c 'pkill -f node'
   sleep 5
   docker logs teachers_training_app_1 --tail 30
   ```

4. **Verify Deployment:**
   ```bash
   # Test endpoint
   curl http://34.162.168.124:3000/health

   # Test bilingual stats
   curl http://34.162.168.124:3000/api/admin/courses/10/bilingual-stats \
     -H "Authorization: Bearer $TOKEN"
   ```

---

## 📚 Usage Examples

### Example 1: Upload Mixed-Language Training Manual

```bash
# Document contains both English and Swahili sections
curl -X POST "http://localhost:3000/api/admin/courses/10/upload-bilingual" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@teacher-training-manual-bilingual.pdf" \
  -F "language=auto" \
  -F "moduleId=1"

# Response shows detected language: "mixed"
```

### Example 2: Query with Automatic Language Detection

```bash
# System auto-detects Swahili query
curl -X POST "http://localhost:3000/api/admin/courses/10/query-bilingual" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Je, ni jinsi gani ya kuboresha ujuzi wa kufundisha?",
    "language": "auto"
  }'

# Searches Swahili collection and responds in Swahili
```

### Example 3: Upload Scanned Image Document (OCR)

```bash
# Scanned PDF with image-based text
curl -X POST "http://localhost:3000/api/admin/courses/10/upload-bilingual" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@scanned-training-material.pdf" \
  -F "language=auto"

# System detects low text density, runs OCR via Tesseract.js
# Processing time: ~45 seconds for 10-page document
```

---

## ✅ Feature Checklist

- [x] OCR support for scanned documents
- [x] Bilingual ChromaDB collections (English/Swahili/Mixed)
- [x] Auto language detection
- [x] Neo4j knowledge graph integration
- [x] Bilingual Q&A with Vertex AI
- [x] Document upload API
- [x] Query API with language routing
- [x] Statistics endpoint
- [x] Comprehensive testing script
- [x] Documentation

---

## 🎯 Next Steps

1. **Deploy to GCP** ✅
2. **Test with real Swahili documents**
3. **Monitor performance metrics**
4. **Add WhatsApp integration for bilingual queries**
5. **Build admin UI for document management**
6. **Add translation service for cross-language queries**

---

**Status:** Ready for production deployment
**Tested:** Local environment ✅
**GCP Deployment:** Pending
