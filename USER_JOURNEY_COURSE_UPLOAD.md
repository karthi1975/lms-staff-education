# User Journey: Course Content Upload & Processing

**Date**: 2025-10-19
**Feature**: Bulk File Upload with Background RAG+Graph+OCR Processing
**User**: Admin (Teacher Trainer)

---

## Overview

This document describes the complete user journey for uploading course content, processing it through the RAG pipeline, and making it available for WhatsApp-based learning.

**Architecture**: Upload → Store → Process (Background: OCR + RAG + Graph DB)

---

## Journey Stages

### Stage 1: Course Selection

**User Action**: Admin navigates to Course Management

1. Login to admin dashboard (`/admin/login.html`)
2. Click "Courses" from navigation
3. Select target course (e.g., "Business Studies - Grade 12")
4. Arrive at Course Detail page

**Page**: `/admin/course-detail.html?id={courseId}`

**UI Elements**:
- Course header with metadata (code, enrollment count, modules, files)
- Breadcrumb navigation
- Module list (sidebar)
- Upload zone (main area)
- Files table (bottom)

---

### Stage 2: File Upload (Bulk)

**User Action**: Upload training materials

#### Step 2.1: Select Files

**Options**:
1. **Drag & Drop**: Drag 1-100 files into upload zone
2. **Browse**: Click upload zone → file picker opens

**Supported Formats**: PDF, DOCX, TXT
**Max Files**: 100 per upload
**Max Size**: 100MB per file

**UI Feedback**:
- Dropzone highlights on drag-over (purple glow)
- File count displayed
- Upload progress spinner

#### Step 2.2: Upload to Server

**What Happens**:
```
1. Files sent to: POST /api/admin/courses/{courseId}/simple-upload
2. Server stores files in: /uploads/course_content/
3. Database records created:
   - Table: course_content
   - Status: 'uploaded'
   - Processing: false
4. Response: Upload successful
```

**Database Record**:
```sql
INSERT INTO course_content (
  course_id, file_name, original_name, file_path,
  file_type, file_size, uploaded_at,
  processed, processing_status
) VALUES (
  2, '1729380000-business_plan.pdf', 'business_plan.pdf', '/uploads/...',
  'application/pdf', 2458976, NOW(),
  false, 'uploaded'
);
```

**UI Response**:
- ✅ Success message: "10 files uploaded successfully!"
- Files appear in table with status: **Uploaded** (blue badge)
- "Process Files" button appears

**Timing**: 2-10 seconds (depending on file size)

---

### Stage 3: Initiate Processing

**User Action**: Click "Process Files" button

#### Step 3.1: Confirmation

**Modal**:
```
Start processing all uploaded files?

This will run:
- OCR extraction (all pages)
- Text chunking (512-1024 tokens)
- Embedding generation (Vertex AI)
- Index to RAG (ChromaDB)
- Index to Graph DB (Neo4j)

Processing time: ~5 minutes per file

[Cancel] [Start Processing]
```

#### Step 3.2: Start Background Job

**What Happens**:
```
1. Request: POST /api/admin/courses/{courseId}/process-files
2. Server queries database for files with status='uploaded'
3. Background job created:
   - Job ID: job-{courseId}-{timestamp}
   - Total files: 10
   - Estimated time: 50 minutes
4. Processing starts immediately (non-blocking)
5. Response: Job ID returned to client
```

**Response**:
```json
{
  "success": true,
  "job_id": "job-2-1729380123456",
  "total_files": 10,
  "estimated_minutes": 50,
  "message": "Processing started in background"
}
```

**UI Changes**:
- "Process Files" button hides
- Progress section appears (yellow gradient banner)
- Progress bar shows 0%
- Status: "Initializing..."

---

### Stage 4: Monitor Progress (Real-time)

**User Experience**: Watch files being processed

#### Step 4.1: Progress Polling

**Auto-refresh**: Every 2 seconds

**API Call**:
```
GET /api/admin/courses/{courseId}/processing-status/{jobId}
Authorization: Bearer {token}
```

**Response**:
```json
{
  "success": true,
  "job_id": "job-2-1729380123456",
  "status": "processing",
  "progress": 42,
  "total_files": 10,
  "processed_files": 4,
  "current_file": {
    "name": "business_plan_template.pdf",
    "operation": "Full OCR processing (page 15/24)..."
  },
  "errors": [],
  "estimated_remaining": "35 min"
}
```

#### Step 4.2: UI Updates

**Progress Bar**:
- Width animates from 0% → 100%
- Color: Green gradient
- Shows percentage inside bar

**Stats Display**:
```
Progress: 42%
Files: 4/10
Remaining: 35 min
```

**Current File**:
```
Processing: business_plan_template.pdf - Full OCR processing (page 15/24)...
```

**Status Badges** (in files table):
- 🔄 Processing (animated pulse)
- ✅ Completed (green)
- ❌ Failed (red, with error tooltip)

---

### Stage 5: Background Processing Pipeline

**What Happens Behind the Scenes** (per file):

#### Step 5.1: OCR Extraction

**Service**: `document-processor.service.js`

```javascript
1. Update status to 'processing'
2. Load file from disk
3. Run OCR:
   - PDF: Extract all pages using pdf-parse
   - DOCX: Extract using mammoth
   - TXT: Read directly
4. Result: Full text extracted
```

**Example**:
```
File: business_plan.pdf (24 pages)
OCR Output: ~15,000 words
```

#### Step 5.2: Text Chunking

**Algorithm**: Recursive character splitting

```javascript
1. Split text into chunks:
   - Target size: 512-1024 tokens (~2000-4000 characters)
   - Overlap: 200 characters (preserve context)
2. Add metadata to each chunk:
   - source: "business_plan.pdf"
   - course_id: 2
   - chunk_index: 0, 1, 2, ...
   - total_chunks: 8
```

**Example**:
```
Input: 15,000 words
Output: 8 chunks (avg 1875 words each)
```

#### Step 5.3: Embedding Generation

**Service**: Vertex AI (`vertexai.service.js`)

```javascript
1. For each chunk:
   - Send to Vertex AI textembedding-gecko model
   - Receive 768-dimensional vector
2. Store embeddings array
```

**API Call** (per chunk):
```json
POST https://us-east5-aiplatform.googleapis.com/v1/projects/{project}/locations/us-east5/publishers/google/models/textembedding-gecko:predict

Request:
{
  "instances": [
    {"content": "A business plan is a strategic document..."}
  ]
}

Response:
{
  "predictions": [
    {"embeddings": {"values": [0.02, -0.15, 0.43, ...]}}
  ]
}
```

**Timing**: ~500ms per chunk

#### Step 5.4: Index to ChromaDB (RAG)

**Service**: `chroma.service.js`

```javascript
1. Create/Get collection: "course_content_{courseId}"
2. Add chunks with embeddings:
   - ids: ["file123_chunk0", "file123_chunk1", ...]
   - embeddings: [[0.02, -0.15, ...], [...], ...]
   - metadatas: [{source, course_id, chunk_index}, ...]
   - documents: ["chunk text 1", "chunk text 2", ...]
3. ChromaDB stores in vector database
```

**Collection**: `course_content_2`

**Result**: Fast semantic search enabled

**Example Query**:
```javascript
// Student asks: "How do I create a financial projection?"
const results = await chromaCollection.query({
  query_texts: ["How do I create a financial projection?"],
  n_results: 5,
  where: {course_id: 2}
});

// Returns top 5 most relevant chunks from all processed files
```

#### Step 5.5: Index to Neo4j (Graph DB)

**Service**: `neo4j.service.js`

**Graph Structure**:
```cypher
// Create file node
CREATE (f:File {
  id: 123,
  name: "business_plan.pdf",
  course_id: 2,
  upload_date: "2025-10-19",
  chunk_count: 8
})

// Create chunk nodes
CREATE (c1:Chunk {
  id: "file123_chunk0",
  text: "A business plan is...",
  index: 0
})

// Create relationships
CREATE (f)-[:HAS_CHUNK]->(c1)

// Link to course
MATCH (course:Course {id: 2})
MATCH (f:File {id: 123})
CREATE (course)-[:CONTAINS_FILE]->(f)

// Link to user (admin who uploaded)
MATCH (admin:Admin {id: 10})
MATCH (f:File {id: 123})
CREATE (admin)-[:UPLOADED]->(f)
```

**Purpose**: Track user progress through content

**Example Query** (student progress):
```cypher
// Find chunks user has read
MATCH (u:User {phone: "+255123456789"})-[:READ]->(c:Chunk)
RETURN c.id, c.text
```

#### Step 5.6: Update Database

**Final step**: Mark file as processed

```sql
UPDATE course_content
SET
  processed = true,
  processing_status = 'completed',
  processed_at = NOW(),
  chunk_count = 8
WHERE id = 123;
```

**On Error**:
```sql
UPDATE course_content
SET
  processing_status = 'failed',
  error_message = 'OCR extraction failed: Invalid PDF structure'
WHERE id = 123;
```

---

### Stage 6: Processing Complete

**User Experience**: Notification & verification

#### Step 6.1: Completion Alert

**UI**:
```
✅ All files processed successfully!

Files completed: 10/10
Total chunks indexed: 87
Processing time: 48 minutes
```

**Or** (with errors):
```
⚠️ Processing completed with some errors

Files completed: 8/10
Files failed: 2
Check failed files for details
```

#### Step 6.2: Files Table Update

**Status Badges**:
- ✅ **Completed** (green): 8 files
- ❌ **Failed** (red): 2 files

**Chunks Column**:
- Shows chunk count per file
- Example: "12 chunks", "8 chunks", "-" (for failed)

**Failed Files** (hover for error):
```
❌ Failed
Error: PDF is password protected - cannot extract text
```

---

## Technical Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      ADMIN UPLOADS FILES                        │
│  Drag & Drop or Click → Select 10 PDFs → Upload to Server      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FILES STORED ON DISK                        │
│  /uploads/course_content/1729380000-business_plan.pdf          │
│  Database: INSERT INTO course_content (status='uploaded')      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                 ADMIN CLICKS "PROCESS FILES"                    │
│  Confirm → POST /process-files → Background job starts         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BACKGROUND PROCESSING LOOP                    │
│  FOR EACH FILE:                                                 │
│    1. Update status to 'processing'                             │
│    2. OCR Extraction (all pages)                                │
│    3. Text Chunking (512-1024 tokens)                           │
│    4. Embedding Generation (Vertex AI)                          │
│    5. Index to ChromaDB (vector store)                          │
│    6. Index to Neo4j (graph relationships)                      │
│    7. Update status to 'completed'                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     REAL-TIME PROGRESS                          │
│  UI polls every 2 seconds → Shows progress bar → Updates stats │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PROCESSING COMPLETE                           │
│  Alert: "✅ 10 files processed successfully!"                  │
│  Files table shows: ✅ Completed (with chunk counts)           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Status Lifecycle

```
[Not Uploaded]
     │
     │ Upload files
     ▼
[Uploaded] ────────┐
     │             │
     │ Click       │ (stays here until user clicks "Process")
     │ "Process"   │
     │             │
     ▼             │
[Processing] ◄─────┘
     │
     │ OCR + RAG + Graph
     │
     ├─── Success ──→ [Completed] ✅
     │
     └─── Error ────→ [Failed] ❌
```

**Key Point**: Files stay in "Uploaded" status until admin explicitly clicks "Process Files" button.

---

## Error Handling

### Common Errors & Solutions

#### Error 1: File Too Large
**Error**: `File size exceeds 100MB limit`

**Solution**:
- Split large PDFs into smaller files
- Compress images in PDF before upload

#### Error 2: Password-Protected PDF
**Error**: `PDF is password protected - cannot extract text`

**Solution**:
- Remove password protection
- Re-upload unlocked version

#### Error 3: Corrupted File
**Error**: `Invalid file format or corrupted data`

**Solution**:
- Verify file can be opened manually
- Re-export from source application
- Upload fresh copy

#### Error 4: Vertex AI Quota Exceeded
**Error**: `Quota exceeded for embedding generation`

**Solution**:
- Wait for quota reset (usually 24 hours)
- Increase quota in GCP console
- Process files in smaller batches

#### Error 5: ChromaDB Connection Failed
**Error**: `Failed to connect to ChromaDB at http://172.17.0.1:8000`

**Solution**:
- Verify ChromaDB container is running: `docker ps | grep chroma`
- Restart ChromaDB: `docker restart chromadb`
- Check logs: `docker logs chromadb`

---

## Performance Metrics

### Upload Phase
- **Time**: 2-10 seconds (for 100 files)
- **Factors**: Network speed, file sizes
- **User Waits**: Yes (shows spinner)

### Processing Phase (per file)
- **OCR**: 30-120 seconds (depends on page count)
- **Chunking**: <1 second
- **Embeddings**: 500ms per chunk × 8 chunks = 4 seconds
- **ChromaDB Indexing**: 1-2 seconds
- **Neo4j Indexing**: 1 second
- **Total**: ~1-3 minutes per file

### Batch Processing
- **10 files**: ~20-30 minutes
- **50 files**: ~1.5-2.5 hours
- **100 files**: ~3-5 hours

**Optimization**: Processing runs in background, admin can close browser and return later.

---

## Database Changes

### Before Processing

```sql
SELECT * FROM course_content WHERE course_id = 2;

id  | file_name                 | processed | processing_status | chunk_count
----|---------------------------|-----------|-------------------|-------------
123 | business_plan.pdf         | false     | uploaded          | NULL
124 | financial_projections.pdf | false     | uploaded          | NULL
125 | marketing_strategy.pdf    | false     | uploaded          | NULL
```

### During Processing

```sql
id  | file_name                 | processed | processing_status | chunk_count
----|---------------------------|-----------|-------------------|-------------
123 | business_plan.pdf         | false     | completed         | 8
124 | financial_projections.pdf | false     | processing        | NULL
125 | marketing_strategy.pdf    | false     | uploaded          | NULL
```

### After Processing

```sql
id  | file_name                 | processed | processing_status | chunk_count | processed_at
----|---------------------------|-----------|-------------------|-------------|-------------------------
123 | business_plan.pdf         | true      | completed         | 8           | 2025-10-19 14:35:21
124 | financial_projections.pdf | true      | completed         | 12          | 2025-10-19 14:38:45
125 | marketing_strategy.pdf    | true      | completed         | 6           | 2025-10-19 14:40:12
```

---

## WhatsApp Integration (Student Side)

**Once processed**, content becomes available for RAG-powered chat.

### Example Student Interaction

**Student** (via WhatsApp):
```
How do I create a cash flow statement for my business plan?
```

**System** (RAG Query):
```javascript
// Get user context
const user = await getUserByPhone("+255123456789");
const context = {
  module: "Business Plan Development",
  topic: "Financial Projections",
  level: "intermediate"
};

// Query ChromaDB
const query = `${context.module} - ${context.topic}: How do I create a cash flow statement?`;
const results = await chromaCollection.query({
  query_texts: [query],
  n_results: 5,
  where: {course_id: 2}
});

// Returns chunks from financial_projections.pdf
```

**Response** (Generated by Vertex AI):
```
Here's how to create a cash flow statement for your business plan:

1. **Operating Activities**
   - List all cash inflows from sales
   - Subtract cash outflows for expenses
   - Calculate net operating cash flow

2. **Investing Activities**
   - Include equipment purchases
   - Account for asset sales

3. **Financing Activities**
   - Add loan proceeds
   - Subtract loan repayments

[Sources: financial_projections.pdf, business_plan_template.pdf]

Would you like me to explain any of these sections in detail?
```

**Graph DB Update** (track learning progress):
```cypher
MATCH (u:User {phone: "+255123456789"})
MATCH (c:Chunk {id: "file124_chunk3"})
CREATE (u)-[:READ {timestamp: datetime(), topic: "Cash Flow"}]->(c)

// Later: Track module completion
MATCH (u:User {phone: "+255123456789"})-[:READ]->(c:Chunk)
WITH u, count(c) as chunks_read
WHERE chunks_read >= 25
CREATE (u)-[:COMPLETED]->(m:Module {id: 2, name: "Business Plan Development"})
```

---

## Success Criteria

### Admin Experience
- ✅ Upload 100 files in <10 seconds
- ✅ See real-time progress (2-second refresh)
- ✅ Clear status badges (uploaded, processing, completed, failed)
- ✅ Error messages for failed files
- ✅ Can close browser during processing (job continues)

### Student Experience
- ✅ Ask any question via WhatsApp
- ✅ Receive context-aware answers from uploaded content
- ✅ See source citations (which files answered the question)
- ✅ Learning progress tracked in Graph DB
- ✅ Personalized content recommendations

### System Performance
- ✅ Process 100 files in 3-5 hours
- ✅ RAG retrieval < 500ms
- ✅ 99% uptime for background jobs
- ✅ Handle 1000+ concurrent student queries

---

## Next Steps

1. **Test End-to-End** (Task 6)
   - Upload 10 test files
   - Process and verify
   - Check ChromaDB collections
   - Verify Graph DB relationships

2. **Monitor Production**
   - Set up job failure alerts
   - Track processing times
   - Monitor Vertex AI quota usage

3. **Optimize**
   - Batch embedding requests (reduce API calls)
   - Parallel OCR processing (faster throughput)
   - Cache frequently accessed chunks

4. **Scale**
   - Increase Vertex AI quota for larger batches
   - Add Redis queue for job management
   - Implement retry logic for failed files

---

**Document Status**: ✅ Complete
**Last Updated**: 2025-10-19
**Next Review**: After Task 6 testing
