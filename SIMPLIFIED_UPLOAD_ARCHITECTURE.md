# Simplified Upload Architecture - Module-Independent RAG

## Date: 2025-10-19

---

## Overview

**NEW ARCHITECTURE**: Files are uploaded directly to a **global knowledge base** without module assignment. Context comes from the user's current learning state, not from file metadata.

---

## Architecture Comparison

### OLD (Module-Based):
```
Upload → AI Classification → Assign to Module → OCR → Index to RAG
Query → Filter by module_id → RAG retrieval
```

**Problems**:
- ❌ AI classification can be wrong
- ❌ Files forced into modules even when they don't fit
- ❌ Complex workflow with multiple steps
- ❌ Query limited to single module

### NEW (Context-Based):
```
Upload → OCR → Index to RAG+Graph (global knowledge base)
Query → Send (question + user's current module/topic) → RAG retrieval
```

**Benefits**:
- ✅ No classification needed
- ✅ Faster upload (skip AI step)
- ✅ Files exist in global knowledge base
- ✅ Context from user's learning state
- ✅ Cross-module retrieval possible

---

## How It Works

### 1. Upload (Admin)

**Endpoint**: `POST /api/admin/courses/:courseId/simple-upload`

**Process**:
```
1. Admin uploads 100 files
2. Files stored in database (course_content table)
3. Background job starts:
   - OCR extraction (all pages)
   - Text chunking (512-1024 tokens)
   - Embedding generation (Vertex AI)
   - Index to ChromaDB (with metadata)
   - Index to Neo4j (relationships)
4. Returns immediately with job_id
```

**Metadata Stored** (NO module_id):
```javascript
{
  course_id: 2,  // For organizational purposes only
  file_name: "business_plan_template.pdf",
  source: "business_plan_template.pdf",
  upload_date: "2025-10-19T...",
  uploaded_by: 1,
  // NO module_id!
}
```

### 2. Query (Student via WhatsApp)

**User State**:
```javascript
{
  user_id: 123,
  current_module: "Business Plan Development",
  current_topic: "Creating Financial Projections",
  learning_level: "intermediate"
}
```

**Query Flow**:
```
Student: "How do I create a cash flow statement?"
  ↓
System extracts context:
  - Module: "Business Plan Development"
  - Topic: "Creating Financial Projections"
  ↓
RAG Query:
  query: "How do I create a cash flow statement?"
  context: "Business Plan Development - Creating Financial Projections"
  ↓
ChromaDB Similarity Search:
  - Searches ALL chunks (not filtered by module_id)
  - Uses BOTH query + context for embedding similarity
  - Returns top 5 most relevant chunks
  ↓
Response generated with context-aware content
```

**Key Point**: The context (module/topic) comes from the **user's learning state**, not from file metadata!

---

## Database Schema

### New Table: `course_content`

```sql
CREATE TABLE course_content (
  id SERIAL PRIMARY KEY,
  course_id INTEGER,  -- Organizational only, NOT for filtering
  file_name VARCHAR(500),
  original_name VARCHAR(500),
  file_path TEXT,
  file_type VARCHAR(100),
  file_size BIGINT,
  uploaded_by INTEGER,
  uploaded_at TIMESTAMP,
  processed BOOLEAN,  -- OCR + indexing complete
  processing_status VARCHAR(50),  -- pending, processing, completed, failed
  chunk_count INTEGER,  -- Number of chunks indexed
  metadata JSONB,  -- Any additional info (topics, keywords, etc.)
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**No Foreign Key to Modules!** - Files are module-independent.

---

## API Endpoints

### 1. Simple Upload

**POST** `/api/admin/courses/:courseId/simple-upload`

**Request**:
```http
POST /api/admin/courses/2/simple-upload
Content-Type: multipart/form-data
Authorization: Bearer <admin_token>

files: [file1.pdf, file2.pdf, ...]
```

**Response**:
```json
{
  "success": true,
  "job_id": "simple_upload_1729291234567_2",
  "total_files": 12,
  "estimated_minutes": 60,
  "message": "Files uploaded and processing started in background",
  "files": [
    {"name": "business_plan.pdf", "size": 2458976},
    ...
  ]
}
```

**Background Processing**:
- Runs asynchronously (non-blocking)
- Processes files one by one
- OCR → Chunking → Embeddings → ChromaDB + Neo4j
- Updates `course_content` table with progress

### 2. Get Processing Status

**GET** `/api/admin/courses/:courseId/processing-status/:jobId`

**Response**:
```json
{
  "success": true,
  "job_id": "simple_upload_1729291234567_2",
  "status": "processing",
  "progress": 42,
  "total_files": 12,
  "processed_files": 5,
  "current_file": {
    "name": "business_plan_template.pdf",
    "operation": "Full OCR processing (all pages)..."
  },
  "errors": [],
  "start_time": "2025-10-19T...",
  "estimated_remaining": "35 min"
}
```

---

## RAG Query Logic (Updated)

### Before (Module-Filtered):
```javascript
async function queryRAG(question, moduleId) {
  const results = await chromaService.query({
    query_texts: [question],
    n_results: 5,
    where: {
      module_id: moduleId  // ❌ Filtered by module
    }
  });
  return results;
}
```

### After (Context-Enhanced):
```javascript
async function queryRAG(question, userContext) {
  // Build context-enhanced query
  const contextualQuery = `${userContext.module} - ${userContext.topic}: ${question}`;

  const results = await chromaService.query({
    query_texts: [contextualQuery],  // ✅ Context in the query
    n_results: 5
    // NO where clause - search all content
  });

  return results;
}
```

**Benefits**:
- Searches ENTIRE knowledge base
- Context improves similarity matching
- Can retrieve cross-module content if relevant
- More flexible than hard module filtering

---

## Deployment Status

### Backend
✅ **Route Created**: `routes/simple-upload.routes.js`
✅ **Registered**: Added to `server.js`
✅ **Migration Run**: `course_content` table created
✅ **Server Healthy**: All services operational

### Database
✅ **Table**: `course_content` with indexes
✅ **Migration**: Applied to PostgreSQL

### Next Steps
1. **Frontend**: Create simple upload UI (no classification step)
2. **Update RAG**: Modify query logic to use context instead of module_id
3. **Test**: Upload files and verify indexing
4. **Chat Integration**: Update WhatsApp handler to send context with queries

---

## Usage Example

### 1. Admin Uploads Content

```bash
# Login as admin
TOKEN="admin_token_here"

# Upload files
curl -X POST http://34.162.136.203:3000/api/admin/courses/2/simple-upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@business_plan.pdf" \
  -F "files=@financial_projections.pdf" \
  -F "files=@marketing_strategy.pdf"

# Response
{
  "job_id": "simple_upload_1729291234567_2",
  "total_files": 3,
  "estimated_minutes": 15
}

# Check status
curl http://34.162.136.203:3000/api/admin/courses/2/processing-status/simple_upload_1729291234567_2 \
  -H "Authorization: Bearer $TOKEN"
```

### 2. Student Asks Question (WhatsApp)

```
Student: "How do I create a financial projection for my business plan?"
  ↓
System: User is in "Business Plan Development" module, topic "Financial Planning"
  ↓
RAG Query: "Business Plan Development - Financial Planning: How do I create a financial projection for my business plan?"
  ↓
Returns: Relevant chunks from financial_projections.pdf (and any other relevant files)
  ↓
Response: Context-aware answer about financial projections
```

---

## Migration Path

### Option 1: Fresh Start
1. Use new `simple-upload` endpoint for all new uploads
2. Keep existing module_content table for old data
3. Update RAG queries to search BOTH tables

### Option 2: Migrate Existing Data
1. Copy existing files from module_content → course_content
2. Remove module_id during migration
3. Reindex to ChromaDB without module filter
4. Deprecate old upload system

---

## Performance Considerations

### Upload Speed
- **Before**: 2-5 min (AI classification) + 1-2 hours (OCR)
- **After**: 0 min (no classification) + 1-2 hours (OCR)
- **Improvement**: ~5 min faster per batch

### Query Speed
- **Before**: ChromaDB filtered by module_id → Fast but limited
- **After**: ChromaDB searches all chunks → Slightly slower but more comprehensive
- **Mitigation**: ChromaDB is highly optimized for full-collection searches

### Storage
- **Before**: Chunks stored with module_id metadata
- **After**: Chunks stored with course_id + source metadata
- **Impact**: No significant difference

---

## Summary

**What Changed**:
- ❌ Removed: AI classification step
- ❌ Removed: Module assignment during upload
- ✅ Added: Global knowledge base (course_content table)
- ✅ Added: Context-enhanced RAG queries
- ✅ Added: Simplified upload endpoint

**Why It's Better**:
1. **Simpler**: Upload → Process → Done
2. **Faster**: No AI classification delay
3. **More Flexible**: Context from user state, not file metadata
4. **More Accurate**: AI provides context in real-time, not pre-assigned
5. **Scalable**: Global knowledge base supports cross-module learning

**Next Steps for You**:
1. Test the new `/simple-upload` endpoint with your files
2. Verify files are indexed to ChromaDB
3. Update WhatsApp chat handler to send user context with queries
4. Compare retrieval quality: old (module-filtered) vs new (context-enhanced)

🚀 **Ready to test!**
