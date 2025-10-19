# Claude Code Project Instructions: Module-Based Course Platform with RAG + Graph DB

**Date**: 2025-10-19
**Project**: Teachers Training System
**Architecture**: Module-Context RAG + Neo4j Progress Tracking
**UI**: Material Design 3 (https://m3.material.io/)

---

## System Workflow

### 1. Course & Module Setup
**User Action**: Create course and define modules/topics

**UI Flow**:
```
1. User creates a course (e.g., "Business Studies - Grade 12")
2. User defines modules with topic names:
   - Module 1: Introduction to Entrepreneurship
   - Module 2: Business Planning Fundamentals
   - Module 3: Financial Management
   - Module 4: Marketing Strategies
   - Module 5: Operations Management
```

**Backend**:
- Store course metadata
- Create module structure with topic context
- Each module becomes a separate RAG collection namespace

---

### 2. File Upload & Processing
**User Action**: Upload all course files and click "Process"

**UI Flow**:
```
1. User uploads 50-100 files (PDFs, images, documents) for entire course
2. User maps files to modules (or system auto-classifies)
3. User clicks "Process" button
4. System runs OCR + RAG indexing + Graph DB creation
```

**Backend Processing** (per file):
```
File → OCR Extraction → Module Assignment → RAG Indexing → Neo4j Graph
```

---

### 3. RAG + Graph DB Indexing (On "Process" Click)

**Step 1: OCR Extraction**
```javascript
for each uploaded file:
  - Run OCR (handle scanned PDFs, images)
  - Extract all text content
  - Preserve document structure
```

**Step 2: Module-Context RAG Indexing**
```javascript
for each file:
  - Assign to module (e.g., "Module 1: Entrepreneurship")
  - Chunk text (512-1024 tokens)
  - Generate embeddings (Vertex AI)
  - Index to ChromaDB with metadata:
    {
      course_id: 2,
      module_id: 1,
      module_name: "Introduction to Entrepreneurship",
      file_name: "entrepreneurship_basics.pdf",
      chunk_index: 0,
      topic_context: "entrepreneurship, innovation, startups"
    }
```

**Key**: Each module gets its own RAG namespace/collection for isolated retrieval.

**Step 3: Neo4j Graph Database**
```cypher
// Create course node
CREATE (course:Course {
  id: 2,
  name: "Business Studies - Grade 12",
  created_at: datetime()
})

// Create module nodes
CREATE (m1:Module {
  id: 1,
  course_id: 2,
  name: "Introduction to Entrepreneurship",
  sequence: 1,
  topic_context: "entrepreneurship, innovation, startups"
})

CREATE (m2:Module {
  id: 2,
  course_id: 2,
  name: "Business Planning Fundamentals",
  sequence: 2,
  topic_context: "business plans, market analysis, financial projections"
})

// Link modules to course
CREATE (course)-[:HAS_MODULE]->(m1)
CREATE (course)-[:HAS_MODULE]->(m2)

// Create document nodes
CREATE (doc1:Document {
  id: 123,
  name: "entrepreneurship_basics.pdf",
  module_id: 1,
  course_id: 2,
  chunk_count: 12,
  upload_date: datetime()
})

// Link documents to modules
CREATE (m1)-[:CONTAINS_DOCUMENT]->(doc1)

// Create content chunk nodes
CREATE (chunk1:ContentChunk {
  id: "doc123_chunk0",
  text: "Entrepreneurship is the process of...",
  module_id: 1,
  doc_id: 123,
  chunk_index: 0
})

// Link chunks to documents
CREATE (doc1)-[:HAS_CHUNK]->(chunk1)

// Link chunks to modules (for quick filtering)
CREATE (m1)-[:HAS_CONTENT]->(chunk1)
```

---

### 4. Module-Aware Chat with Similarity Retrieval

**User Scenario**: Student is in "Module 1: Entrepreneurship" and asks a question

**Chat Flow**:
```
Student in Module 1: "What are the key characteristics of an entrepreneur?"
  ↓
System identifies: user_context = {module_id: 1, module_name: "Entrepreneurship"}
  ↓
RAG Query: Search ONLY in Module 1's collection
  ↓
ChromaDB Query:
  collection: "course_2_module_1"
  query: "What are the key characteristics of an entrepreneur?"
  filter: {module_id: 1}
  n_results: 5
  ↓
Returns: Top 5 chunks from Module 1 documents ONLY
  ↓
Vertex AI generates response using ONLY Module 1 content
  ↓
Response: "Based on Module 1 materials, entrepreneurs typically have..."
```

**Key Implementation**:
```javascript
async function chatWithModuleContext(query, userId, moduleId) {
  // Get user's current module from Neo4j
  const userModule = await neo4j.run(`
    MATCH (u:User {id: $userId})-[:CURRENTLY_IN]->(m:Module {id: $moduleId})
    RETURN m.id, m.name, m.topic_context
  `, {userId, moduleId});

  // Query RAG with module filter
  const ragResults = await chroma.query({
    collection_name: `course_${courseId}_module_${moduleId}`,
    query_texts: [query],
    n_results: 5,
    where: {
      module_id: moduleId  // CRITICAL: Filter by module
    }
  });

  // Generate response using module-specific context
  const response = await vertexAI.generateText({
    prompt: `Context from ${userModule.name}: ${ragResults.documents}

    Question: ${query}

    Answer using ONLY the context provided from ${userModule.name}:`,
    temperature: 0.3
  });

  // Track interaction in Neo4j
  await trackModuleInteraction(userId, moduleId, query, response);

  return response;
}
```

---

### 5. User Progress Tracking (Neo4j)

**Graph Structure**:
```cypher
// User node
CREATE (user:User {
  id: 12345,
  phone: "+255123456789",
  name: "John Doe",
  enrolled_at: datetime()
})

// Enrollment relationship
MATCH (user:User {id: 12345})
MATCH (course:Course {id: 2})
CREATE (user)-[:ENROLLED_IN {
  enrolled_at: datetime(),
  status: "active"
}]->(course)

// Module progress
MATCH (user:User {id: 12345})
MATCH (module:Module {id: 1})
CREATE (user)-[:STUDYING {
  started_at: datetime(),
  progress_percent: 0,
  status: "in_progress"
}]->(module)

// Content interactions
MATCH (user:User {id: 12345})
MATCH (chunk:ContentChunk {id: "doc123_chunk0"})
CREATE (user)-[:READ {
  read_at: datetime(),
  duration_seconds: 45
}]->(chunk)

// Quiz attempts
MATCH (user:User {id: 12345})
MATCH (module:Module {id: 1})
CREATE (user)-[:COMPLETED_QUIZ {
  attempted_at: datetime(),
  score: 85,
  passed: true,
  attempt_number: 1
}]->(module)

// Module completion
MATCH (user:User {id: 12345})
MATCH (module:Module {id: 1})
CREATE (user)-[:COMPLETED {
  completed_at: datetime(),
  final_score: 85
}]->(module)
```

**Query Examples**:

**Get User's Overall Progress**:
```cypher
MATCH (u:User {id: 12345})-[:ENROLLED_IN]->(c:Course {id: 2})
MATCH (c)-[:HAS_MODULE]->(m:Module)
OPTIONAL MATCH (u)-[s:STUDYING]->(m)
OPTIONAL MATCH (u)-[comp:COMPLETED]->(m)
RETURN
  m.name AS module,
  COALESCE(s.progress_percent, 0) AS progress,
  COALESCE(comp.final_score, null) AS score,
  CASE
    WHEN comp IS NOT NULL THEN 'completed'
    WHEN s IS NOT NULL THEN 'in_progress'
    ELSE 'not_started'
  END AS status
ORDER BY m.sequence
```

**Get Module-Specific Activity**:
```cypher
MATCH (u:User {id: 12345})-[:READ]->(chunk:ContentChunk)-[:BELONGS_TO]->(m:Module {id: 1})
WITH u, m, COUNT(chunk) AS chunks_read
MATCH (m)-[:HAS_CONTENT]->(allChunks:ContentChunk)
WITH u, m, chunks_read, COUNT(allChunks) AS total_chunks
RETURN
  m.name,
  chunks_read,
  total_chunks,
  (chunks_read * 100 / total_chunks) AS completion_percent
```

**Get Learning Path**:
```cypher
MATCH path = (u:User {id: 12345})-[:COMPLETED*]->(m:Module)
RETURN m.name, m.sequence
ORDER BY m.sequence
```

---

## Implementation Requirements

### Database Schema Updates

**PostgreSQL** (course_content table):
```sql
ALTER TABLE course_content ADD COLUMN module_id INTEGER;
ALTER TABLE course_content ADD COLUMN topic_context TEXT;
ALTER TABLE course_content ADD COLUMN indexed_to_rag BOOLEAN DEFAULT false;
ALTER TABLE course_content ADD COLUMN indexed_to_graph BOOLEAN DEFAULT false;

-- Add foreign key
ALTER TABLE course_content
ADD CONSTRAINT fk_module
FOREIGN KEY (module_id) REFERENCES modules(id);
```

**ChromaDB Collections**:
```javascript
// Separate collection per course-module combination
collection_name: `course_${courseId}_module_${moduleId}`

// Example:
// - course_2_module_1  (Entrepreneurship content)
// - course_2_module_2  (Business Planning content)
// - course_2_module_3  (Financial Management content)
```

**Neo4j Constraints**:
```cypher
CREATE CONSTRAINT unique_user IF NOT EXISTS ON (u:User) ASSERT u.id IS UNIQUE;
CREATE CONSTRAINT unique_course IF NOT EXISTS ON (c:Course) ASSERT c.id IS UNIQUE;
CREATE CONSTRAINT unique_module IF NOT EXISTS ON (m:Module) ASSERT m.id IS UNIQUE;
CREATE CONSTRAINT unique_document IF NOT EXISTS ON (d:Document) ASSERT d.id IS UNIQUE;
CREATE INDEX module_course IF NOT EXISTS FOR (m:Module) ON (m.course_id);
CREATE INDEX document_module IF NOT EXISTS FOR (d:Document) ON (d.module_id);
```

---

## API Endpoints

### 1. Create Course with Modules
```javascript
POST /api/admin/courses/create-with-modules
Body:
{
  "course": {
    "title": "Business Studies - Grade 12",
    "code": "BUS-G12",
    "description": "Comprehensive business education"
  },
  "modules": [
    {
      "title": "Introduction to Entrepreneurship",
      "sequence": 1,
      "topic_context": "entrepreneurship, innovation, startups",
      "duration_weeks": 2
    },
    {
      "title": "Business Planning Fundamentals",
      "sequence": 2,
      "topic_context": "business plans, market analysis, financial projections",
      "duration_weeks": 3
    }
  ]
}

Response:
{
  "success": true,
  "course_id": 2,
  "modules": [
    {id: 1, title: "Introduction to Entrepreneurship"},
    {id: 2, title: "Business Planning Fundamentals"}
  ]
}
```

### 2. Bulk Upload with Module Mapping
```javascript
POST /api/admin/courses/:courseId/bulk-upload-with-modules
Content-Type: multipart/form-data

Files: file1.pdf, file2.pdf, ...
Body:
{
  "file_module_mapping": {
    "file1.pdf": 1,  // Module 1
    "file2.pdf": 1,  // Module 1
    "file3.pdf": 2,  // Module 2
    "file4.pdf": 2   // Module 2
  }
}

Response:
{
  "success": true,
  "total_files": 50,
  "files_by_module": {
    "1": 12,
    "2": 15,
    "3": 10,
    "4": 8,
    "5": 5
  }
}
```

### 3. Process Course (RAG + Graph DB)
```javascript
POST /api/admin/courses/:courseId/process-course
Body:
{
  "create_rag": true,
  "create_graph": true,
  "run_ocr": true
}

Response:
{
  "success": true,
  "job_id": "process-course-2-1729380000",
  "estimated_minutes": 120,
  "tasks": {
    "ocr": true,
    "rag_indexing": true,
    "graph_creation": true
  }
}
```

### 4. Module-Aware Chat
```javascript
POST /api/chat/module-aware
Body:
{
  "user_id": 12345,
  "module_id": 1,
  "query": "What are the key characteristics of an entrepreneur?",
  "language": "english"
}

Response:
{
  "success": true,
  "module_name": "Introduction to Entrepreneurship",
  "answer": "Based on Module 1 materials, entrepreneurs typically have...",
  "sources": [
    {
      "file": "entrepreneurship_basics.pdf",
      "page": 5,
      "relevance": 0.92
    }
  ],
  "next_steps": "Continue to Module 2: Business Planning"
}
```

### 5. User Progress Dashboard
```javascript
GET /api/users/:userId/progress/:courseId

Response:
{
  "success": true,
  "user": {
    "id": 12345,
    "name": "John Doe",
    "phone": "+255123456789"
  },
  "course": {
    "id": 2,
    "title": "Business Studies - Grade 12",
    "overall_progress": 45
  },
  "modules": [
    {
      "id": 1,
      "title": "Introduction to Entrepreneurship",
      "status": "completed",
      "progress": 100,
      "quiz_score": 85,
      "completed_at": "2025-10-15T14:30:00Z"
    },
    {
      "id": 2,
      "title": "Business Planning Fundamentals",
      "status": "in_progress",
      "progress": 60,
      "quiz_score": null,
      "last_activity": "2025-10-19T10:15:00Z"
    },
    {
      "id": 3,
      "title": "Financial Management",
      "status": "not_started",
      "progress": 0
    }
  ],
  "learning_path": [
    "Module 1: Entrepreneurship → Module 2: Business Planning → ..."
  ]
}
```

---

## UI Design (Material Design 3)

### Color Palette
```css
/* Primary Colors (from m3.material.io) */
--md-sys-color-primary: #6750A4;
--md-sys-color-on-primary: #FFFFFF;
--md-sys-color-primary-container: #EADDFF;
--md-sys-color-on-primary-container: #21005D;

/* Secondary Colors */
--md-sys-color-secondary: #625B71;
--md-sys-color-on-secondary: #FFFFFF;
--md-sys-color-secondary-container: #E8DEF8;

/* Tertiary Colors */
--md-sys-color-tertiary: #7D5260;
--md-sys-color-on-tertiary: #FFFFFF;
--md-sys-color-tertiary-container: #FFD8E4;

/* Error Colors */
--md-sys-color-error: #B3261E;
--md-sys-color-on-error: #FFFFFF;
--md-sys-color-error-container: #F9DEDC;

/* Surface Colors */
--md-sys-color-surface: #FEF7FF;
--md-sys-color-on-surface: #1D1B20;
--md-sys-color-surface-variant: #E7E0EC;
```

### Component Styles
```css
/* Cards - Material Design 3 */
.md-card {
  background: var(--md-sys-color-surface);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
  transition: box-shadow 0.3s;
}

.md-card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23);
}

/* Buttons - Material Design 3 */
.md-btn-filled {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  padding: 10px 24px;
  border-radius: 20px;
  border: none;
  font-weight: 500;
  letter-spacing: 0.1px;
}

.md-btn-tonal {
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
  padding: 10px 24px;
  border-radius: 20px;
}

/* Progress Indicators */
.md-linear-progress {
  height: 4px;
  background: var(--md-sys-color-surface-variant);
  border-radius: 2px;
  overflow: hidden;
}

.md-linear-progress-bar {
  height: 100%;
  background: var(--md-sys-color-primary);
  transition: width 0.3s;
}

/* Chips (Status Badges) */
.md-chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.md-chip-assist {
  background: var(--md-sys-color-surface-variant);
  color: var(--md-sys-color-on-surface-variant);
}

.md-chip-filter {
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}
```

---

## Success Criteria

### Phase 1: Course & Module Setup ✓
- [ ] Create course with 5 modules
- [ ] Define topic context for each module
- [ ] UI shows module structure clearly

### Phase 2: Bulk Upload ✓
- [ ] Upload 50 files for entire course
- [ ] Map files to modules (manual or auto)
- [ ] UI shows file distribution across modules

### Phase 3: Processing ✓
- [ ] Click "Process" button
- [ ] OCR runs on all files
- [ ] RAG indexes per module (separate collections)
- [ ] Neo4j graph created with course/module/document structure

### Phase 4: Module-Aware Chat ✓
- [ ] User in Module 1 asks question
- [ ] RAG retrieves ONLY from Module 1 content
- [ ] Response cites Module 1 sources
- [ ] Neo4j tracks interaction

### Phase 5: Progress Tracking ✓
- [ ] Neo4j shows user's module progress
- [ ] Dashboard displays completion percentages
- [ ] Learning path visualization works
- [ ] Quiz scores tracked per module

---

## Next Steps

1. **Build Module-Based UI** (Material Design 3)
2. **Create Module Management APIs**
3. **Implement Module-Context RAG**
4. **Build Neo4j Progress Schema**
5. **Test Module-Aware Chat**
6. **Create Progress Dashboard**

---

**Status**: Ready for Implementation
**Priority**: High
**Estimated Time**: 2-3 days
