# Course Platform Refactor Plan
## Module-Based RAG & Graph DB Architecture

**Last Updated:** 2025-10-18
**Status:** Ready for implementation
**Target:** Production-ready course platform with module-based learning

---

## Executive Summary

Refactor the Teachers Training System into a comprehensive **Module-Based Course Platform** with:
- ✅ RAG (Retrieval-Augmented Generation) for intelligent content search
- ✅ Neo4j GraphDB for knowledge relationships
- ✅ Module-centric content organization
- ✅ OCR-enabled document processing
- ✅ WhatsApp-based learning delivery
- ✅ Admin dashboard for course management

---

## Current System Analysis

### ✅ What's Working (Keep)
1. **Database Layer**
   - PostgreSQL: courses, modules, module_content, user_progress tables
   - Neo4j: Knowledge graph for content relationships
   - ChromaDB: Vector embeddings for RAG retrieval

2. **Content Processing**
   - OCR indexing script (`scripts/ocr-index-business-studies.js`)
   - Vertex AI embeddings generation
   - Automatic chunking (1000 chars per chunk)
   - Module-based filtering in ChromaDB

3. **API Endpoints**
   - Admin routes (`routes/admin.routes.js`) with 1400+ lines
   - Course/module CRUD operations
   - File upload with multer
   - Quiz management
   - User enrollment with PIN system

4. **WhatsApp Integration**
   - Course orchestrator service
   - Module-specific chat retrieval
   - Quiz delivery via WhatsApp
   - Twilio/Meta API adapters

### ⚠️ What Needs Refactoring

1. **Admin UI Gaps**
   - No visual course builder
   - Missing module content dashboard
   - No knowledge graph visualization
   - Limited quiz editor

2. **Content Upload Flow**
   - Manual script execution for OCR
   - No progress tracking for long-running uploads
   - Missing batch upload UI
   - No content preview before indexing

3. **RAG System Enhancements**
   - Add semantic search with filters (by topic, module, date)
   - Improve source attribution in responses
   - Add relevance scoring display
   - Context-aware follow-up questions

4. **Graph DB Utilization**
   - Underutilized Neo4j relationships
   - Missing prerequisite chains (Module 1 → Module 2)
   - No topic clustering visualization
   - Limited cross-module content discovery

5. **Quiz System**
   - No visual quiz builder
   - Manual JSON upload only
   - Missing analytics (pass rates, common errors)
   - No question bank management

---

## Key Constraint: WhatsApp User Journey

**IMPORTANT:** The WhatsApp user journey remains unchanged. All refactoring focuses on:
- **Admin Portal** improvements (course builder, bulk upload, analytics)
- **Backend** enhancements (automated pipeline, better RAG, graph DB)
- **Content Management** workflow upgrades

**WhatsApp User Flow (Unchanged):**
1. User sends message to WhatsApp number
2. System identifies user by phone number
3. If new user → enrollment with PIN
4. If enrolled → course selection → module selection → chat/quiz
5. Chat responses use RAG (ChromaDB + Vertex AI)
6. Quizzes delivered via WhatsApp
7. Progress tracked in PostgreSQL

All backend improvements enhance this flow without changing the user-facing interaction.

---

## Refactor Goals & Features

### 1️⃣ Define Course Modules
**Goal:** Create intuitive course/module structure as learning foundation

**Current State:**
```javascript
// routes/admin.routes.js:284-341
POST /api/admin/courses - Creates course
POST /api/admin/modules - Creates module for course
```

**Enhancements Needed:**
- ✅ Visual course builder UI with drag-drop module ordering
- ✅ Module prerequisite chains (enforce Module 1 before Module 2)
- ✅ Estimated completion time per module
- ✅ Learning objectives/outcomes per module
- ✅ Module tags/topics for better organization

**Implementation Plan:**
```
Phase 1.1: Admin UI - Course Builder
  - Create /public/admin/course-builder.html
  - Drag-drop interface for module ordering
  - Visual prerequisite chain editor
  - Batch operations (duplicate, archive, reorder)

Phase 1.2: Database Schema Updates
  - Add modules.prerequisites JSONB column (array of module IDs)
  - Add modules.estimated_hours INTEGER column
  - Add modules.learning_objectives JSONB column
  - Add modules.tags JSONB column

Phase 1.3: API Enhancements
  - PATCH /api/admin/modules/:moduleId/prerequisites
  - POST /api/admin/modules/:moduleId/reorder
  - GET /api/admin/modules/:moduleId/dependency-tree
```

---

### 2️⃣ Upload & Process Course Materials
**Goal:** Streamlined file upload with automatic OCR, chunking, and indexing

**Current State:**
```javascript
// routes/admin.routes.js:625-672
POST /api/admin/portal/courses/:courseId/modules/:moduleId/upload
- Accepts PDF, DOCX, TXT
- Multer file upload
- portalContentService.uploadModuleContent()
```

**Gaps:**
- OCR script runs manually (not triggered by upload)
- No real-time progress tracking
- No content preview before indexing
- Missing bulk upload UI

**Enhancements Needed:**
- ✅ **Automated Pipeline:** Upload → OCR → Chunk → Embed → Index (all automatic)
- ✅ **Progress Tracking:** WebSocket/SSE for real-time upload progress
- ✅ **Content Preview:** Show extracted text preview before final indexing
- ✅ **Bulk Upload:** Drag-drop multiple files, batch processing
- ✅ **Error Handling:** Retry failed OCR, manual text correction
- ✅ **Metadata Tagging:** Auto-detect topics, keywords from content
- ✅ **Version Control:** Track content updates, maintain old versions

**Implementation Plan:**
```
Phase 2.1: Automated Processing Pipeline
  - Refactor portalContentService.uploadModuleContent() to:
    1. Save file to uploads/
    2. Trigger OCR extraction (if PDF/image)
    3. Extract text (if DOCX/TXT)
    4. Chunk text (1000 chars)
    5. Generate Vertex AI embeddings
    6. Store in ChromaDB with metadata
    7. Create Neo4j content nodes
  - Add processing status to module_content table
  - Create /api/admin/content/:contentId/status endpoint

Phase 2.2: Real-Time Progress Tracking
  - Add WebSocket server (socket.io)
  - Emit progress events: "upload", "ocr", "chunking", "embedding", "indexing", "complete"
  - Frontend: Real-time progress bars per file

Phase 2.3: Content Preview & Validation
  - GET /api/admin/content/:contentId/preview
  - Show first 500 chars of extracted text
  - Allow manual text editing before indexing
  - Validate content quality (min chars, topic relevance)

Phase 2.4: Bulk Upload UI
  - /public/admin/bulk-upload.html
  - Drag-drop multiple files (up to 10 at once)
  - Queue management (pause, resume, cancel)
  - Retry failed uploads
  - Batch status dashboard

Phase 2.5: Metadata & Topic Extraction
  - Use Vertex AI to extract topics from content
  - Auto-tag content with keywords
  - Store in module_content.metadata JSONB
  - Enable topic-based search in RAG
```

---

### 3️⃣ Build RAG System
**Goal:** Intelligent document retrieval for module-specific queries

**Current State:**
```javascript
// services/chroma.service.js
- searchSimilar(query, filters) - Module-based filtering
- Uses Vertex AI embeddings (textembedding-gecko@003)
- Returns top 3 results per query
```

**Enhancements Needed:**
- ✅ **Hybrid Search:** Combine semantic (embeddings) + keyword (BM25) search
- ✅ **Relevance Scoring:** Show confidence scores for retrieved chunks
- ✅ **Source Attribution:** Always cite source document + page number
- ✅ **Multi-Module Search:** Search across all modules with filters
- ✅ **Query Expansion:** Suggest related topics for follow-up
- ✅ **Context Window:** Retrieve surrounding chunks for better context

**Implementation Plan:**
```
Phase 3.1: Enhanced Search API
  - POST /api/rag/search
    {
      "query": "What is entrepreneurship?",
      "module_ids": [1, 2, 3],  // optional filter
      "search_type": "hybrid",  // semantic | keyword | hybrid
      "limit": 5,
      "include_context": true   // retrieve surrounding chunks
    }
  - Response includes:
    - chunks: array of results
    - relevance_scores: 0-1 confidence
    - sources: [{file, page, module}]
    - suggested_topics: array of related topics

Phase 3.2: Hybrid Search Implementation
  - Combine ChromaDB (semantic) + PostgreSQL full-text (keyword)
  - Weight: 70% semantic + 30% keyword
  - Re-rank results by combined score

Phase 3.3: Source Attribution Enhancements
  - Store page_number in ChromaDB metadata
  - Return full citation: "BUSINESS STUDIES F2.pdf, Page 15, Module 1: Production"
  - Add timestamps for content version tracking

Phase 3.4: Context Window Retrieval
  - When chunk X is retrieved, also fetch chunks X-1 and X+1
  - Store chunk_index in metadata for ordering
  - Return expanded context for better LLM understanding

Phase 3.5: Query Expansion & Suggestions
  - Use Vertex AI to extract key topics from user query
  - Find related topics in Neo4j graph
  - Suggest follow-up questions based on content gaps
```

---

### 4️⃣ Create Graph Database Structure
**Goal:** Map relationships between modules, documents, quiz content, and user interactions

**Current State:**
```javascript
// services/neo4j.service.js
- createContentGraph(moduleId, chunks) - Creates Content nodes
- createTopicRelationships() - Limited topic linking
- getModuleContentGraph(moduleId) - Returns nodes/edges
```

**Gaps:**
- Missing Module → Document → Topic hierarchy
- No user interaction tracking (queries, clicks)
- No prerequisite chains
- Underutilized for recommendations

**Enhancements Needed:**
- ✅ **Complete Knowledge Graph:**
  ```
  (Course) -[:HAS_MODULE]-> (Module) -[:CONTAINS]-> (Content)
  (Content) -[:ABOUT]-> (Topic)
  (Topic) -[:RELATED_TO]-> (Topic)
  (Module) -[:PREREQUISITE_FOR]-> (Module)
  (User) -[:COMPLETED]-> (Module)
  (User) -[:QUERIED]-> (Content)
  (Quiz) -[:TESTS]-> (Module)
  ```
- ✅ **Smart Recommendations:** Based on user progress and topic gaps
- ✅ **Learning Path Visualization:** Show prerequisite chains
- ✅ **Content Similarity:** Find similar content across modules
- ✅ **Analytics:** Track most-queried topics, popular content

**Implementation Plan:**
```
Phase 4.1: Expand Graph Schema
  - Create Course nodes
  - Create Module nodes with prerequisites
  - Create Topic nodes with relationships
  - Create User interaction nodes (Query, Click, Completion)
  - Create Quiz nodes linked to modules

Phase 4.2: Graph Population
  - Update scripts/ocr-index-business-studies.js to:
    1. Create Course node
    2. Create Module nodes with [:HAS_MODULE] edges
    3. Create Content nodes with [:CONTAINS] edges
    4. Extract topics and create [:ABOUT] edges
    5. Find related topics and create [:RELATED_TO] edges

Phase 4.3: Smart Recommendations
  - GET /api/graph/recommendations/:userId
  - Algorithm:
    1. Get user's completed modules
    2. Find next module in prerequisite chain
    3. Find topics user struggled with (low quiz scores)
    4. Recommend content about those topics
  - Return: {next_module, recommended_content[]}

Phase 4.4: Learning Path Visualization
  - GET /api/graph/learning-path/:courseId
  - Return all modules with prerequisite edges
  - Frontend: D3.js/Cytoscape.js visualization
  - Show user's current position on path

Phase 4.5: Analytics Dashboard
  - GET /api/graph/analytics
  - Track:
    - Most-queried topics
    - Most-accessed content
    - Common prerequisite violations (users skipping modules)
    - Quiz performance by topic
  - Admin dashboard: /public/admin/analytics.html
```

---

### 5️⃣ Module-Linked Quiz & Chat
**Goal:** Module-specific quizzes and chat grounded in course materials

**Current State:**
```javascript
// Quizzes
POST /api/admin/modules/:moduleId/quiz/upload - Upload quiz JSON
- Stores in quizzes + quiz_questions tables
- Linked to modules via module_id

// Chat
POST /api/webhook/whatsapp - Receives WhatsApp messages
- course-orchestrator.service.js handles routing
- Retrieves from ChromaDB filtered by module_id
- Generates answers via Vertex AI
```

**Enhancements Needed:**
- ✅ **Visual Quiz Builder:** No-code quiz creation UI
- ✅ **Question Bank:** Reusable question pool per topic
- ✅ **Adaptive Quizzes:** Difficulty adjusts based on user performance
- ✅ **Quiz Analytics:** Pass rates, common errors, time stats
- ✅ **Chat Improvements:** Better source attribution, follow-up suggestions
- ✅ **Grounded Responses:** Always cite specific course materials
- ✅ **Multimodal Chat:** Support images, diagrams from PDFs

**Implementation Plan:**
```
Phase 5.1: Visual Quiz Builder
  - /public/admin/quiz-builder.html
  - Drag-drop question creation (MCQ, True/False, Short Answer)
  - Rich text editor for questions/explanations
  - Image upload for visual questions
  - Preview mode before publishing

Phase 5.2: Question Bank System
  - Create question_bank table:
    - id, topic, difficulty, question_text, options, correct_answer
  - GET /api/admin/question-bank?topic=entrepreneurship
  - Reuse questions across multiple quizzes
  - Tag questions by topic for easy search

Phase 5.3: Adaptive Quiz Engine
  - Start with medium difficulty questions
  - If user answers correctly, increase difficulty
  - If user fails, decrease difficulty
  - Track difficulty progression in quiz_attempts.metadata

Phase 5.4: Quiz Analytics
  - GET /api/admin/quizzes/:quizId/analytics
  - Return:
    - Pass rate (%)
    - Average score
    - Most-failed questions
    - Average completion time
    - Difficulty distribution
  - Admin dashboard visualization with charts

Phase 5.5: Chat Enhancements
  - Improve source attribution:
    - Always include: "Source: [filename], Page [X], Module [Y]"
    - Add metadata.page_number to ChromaDB chunks
  - Add follow-up suggestions:
    - After each answer, suggest 3 related questions
    - Use Neo4j graph to find related topics
  - Grounded responses:
    - Never hallucinate - only use retrieved chunks
    - If no relevant content found, say: "This topic is not covered in Module X"

Phase 5.6: Multimodal Chat Support
  - Extract images/diagrams from PDFs during OCR
  - Store images in /uploads/images/
  - Store image paths in module_content.metadata
  - When relevant, include diagram URLs in chat responses
  - WhatsApp: Send image URLs as media messages
```

---

## Implementation Roadmap

### Sprint 1: Foundation (Week 1-2)
- [ ] Phase 1.2: Database schema updates (prerequisites, tags, hours)
- [ ] Phase 2.1: Automated processing pipeline
- [ ] Phase 4.1: Expand Neo4j graph schema
- [ ] Testing: Upload 5 PDFs, verify OCR → Chunking → Embedding → Indexing

### Sprint 2: Admin UI (Week 3-4)
- [ ] Phase 1.1: Course builder UI with drag-drop
- [ ] Phase 2.4: Bulk upload UI
- [ ] Phase 5.1: Visual quiz builder
- [ ] Phase 2.2: Real-time progress tracking (WebSockets)
- [ ] Testing: Admin can create course, upload files, build quiz

### Sprint 3: RAG Enhancements (Week 5)
- [ ] Phase 3.1: Enhanced search API with filters
- [ ] Phase 3.2: Hybrid search (semantic + keyword)
- [ ] Phase 3.3: Source attribution improvements
- [ ] Phase 3.4: Context window retrieval
- [ ] Testing: Query "What is entrepreneurship?" returns Business Studies F2 content with page numbers

### Sprint 4: Graph DB & Recommendations (Week 6)
- [ ] Phase 4.2: Graph population with all relationships
- [ ] Phase 4.3: Smart recommendations engine
- [ ] Phase 4.4: Learning path visualization
- [ ] Testing: User completes Module 1 → Recommended Module 2 content

### Sprint 5: Quiz & Analytics (Week 7)
- [ ] Phase 5.2: Question bank system
- [ ] Phase 5.3: Adaptive quiz engine
- [ ] Phase 5.4: Quiz analytics dashboard
- [ ] Phase 4.5: Graph analytics
- [ ] Testing: Admin views quiz pass rates, most-queried topics

### Sprint 6: Chat & Multimodal (Week 8)
- [ ] Phase 5.5: Chat enhancements (follow-ups, grounding)
- [ ] Phase 5.6: Multimodal chat (images, diagrams)
- [ ] Phase 2.3: Content preview & validation
- [ ] Testing: WhatsApp chat returns diagrams from PDFs

### Sprint 7: Polish & Production (Week 9-10)
- [ ] Phase 2.5: Metadata & topic extraction
- [ ] Phase 3.5: Query expansion & suggestions
- [ ] Error handling, retry mechanisms
- [ ] Performance optimization (caching, indexing)
- [ ] Security audit (input validation, SQL injection)
- [ ] Documentation (API docs, admin guides)
- [ ] Production deployment & monitoring

---

## Technical Architecture

### System Flow
```
┌─────────────────────────────────────────────────────────┐
│                      ADMIN PORTAL                       │
│  • Course Builder  • Bulk Upload  • Quiz Builder        │
│  • Analytics       • User Management                    │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    CONTENT PIPELINE                      │
│  Upload → OCR → Extract → Chunk → Embed → Index         │
│  (Tesseract)  (text)  (1000 chars) (Vertex AI)          │
└───────────┬─────────────────────────┬───────────────────┘
            │                         │
            ▼                         ▼
┌─────────────────────┐    ┌─────────────────────┐
│    PostgreSQL       │    │     ChromaDB        │
│  • courses          │    │  • Vector search    │
│  • modules          │    │  • Embeddings       │
│  • module_content   │    │  • Module filter    │
│  • quizzes          │    └─────────────────────┘
│  • user_progress    │
└─────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────┐
│                      Neo4j GraphDB                       │
│  (Course) -[:HAS_MODULE]-> (Module) -[:CONTAINS]->      │
│  (Content) -[:ABOUT]-> (Topic) -[:RELATED_TO]-> (Topic) │
│  (User) -[:COMPLETED]-> (Module) -[:PREREQUISITE_FOR]-> │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                   RAG ORCHESTRATOR                       │
│  Query → Embed → Search (ChromaDB + PostgreSQL FTS)     │
│  → Re-rank → Retrieve Context → Generate (Vertex AI)    │
│  → Cite Sources → Track (Neo4j)                         │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  WHATSAPP INTERFACE                      │
│  • Module-specific chat  • Quiz delivery                │
│  • Progress tracking     • Nudges/coaching              │
└─────────────────────────────────────────────────────────┘
```

### Technology Stack
- **Backend:** Node.js + Express.js
- **Databases:**
  - PostgreSQL 15+ (relational data)
  - ChromaDB (vector embeddings)
  - Neo4j 5+ (knowledge graph)
- **AI/ML:**
  - Vertex AI (text-gecko@003 embeddings)
  - Vertex AI (Gemini for text generation)
- **File Processing:**
  - Tesseract OCR 5.5
  - pdf2image (poppler-utils)
  - Mammoth (DOCX parsing)
- **Real-time:**
  - Socket.io (WebSockets)
- **WhatsApp:**
  - Twilio API / Meta Business API
- **Frontend:**
  - Vanilla JS + Bootstrap 5
  - D3.js / Cytoscape.js (graph viz)
  - Chart.js (analytics)

---

## Database Schema Changes

### New Tables
```sql
-- Question bank for reusable quiz questions
CREATE TABLE question_bank (
  id SERIAL PRIMARY KEY,
  topic VARCHAR(100),
  difficulty VARCHAR(20), -- easy, medium, hard
  question_text TEXT NOT NULL,
  question_type VARCHAR(50),
  options JSONB,
  correct_answer TEXT,
  explanation TEXT,
  created_by INTEGER REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  usage_count INTEGER DEFAULT 0
);

-- Content processing jobs (for async processing)
CREATE TABLE content_processing_jobs (
  id SERIAL PRIMARY KEY,
  content_id INTEGER REFERENCES module_content(id) ON DELETE CASCADE,
  status VARCHAR(50), -- queued, processing, completed, failed
  stage VARCHAR(50), -- upload, ocr, chunking, embedding, indexing
  progress_percent INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB
);
```

### Schema Modifications
```sql
-- Add to modules table
ALTER TABLE modules ADD COLUMN prerequisites JSONB DEFAULT '[]';
ALTER TABLE modules ADD COLUMN estimated_hours DECIMAL(4,2);
ALTER TABLE modules ADD COLUMN learning_objectives JSONB;
ALTER TABLE modules ADD COLUMN tags JSONB DEFAULT '[]';

-- Add to module_content table
ALTER TABLE module_content ADD COLUMN processing_job_id INTEGER REFERENCES content_processing_jobs(id);
ALTER TABLE module_content ADD COLUMN page_count INTEGER;
ALTER TABLE module_content ADD COLUMN topics JSONB; -- auto-extracted topics
ALTER TABLE module_content ADD COLUMN version INTEGER DEFAULT 1;

-- Add to quizzes table
ALTER TABLE quizzes ADD COLUMN is_adaptive BOOLEAN DEFAULT FALSE;
ALTER TABLE quizzes ADD COLUMN question_bank_ids JSONB; -- array of question_bank IDs

-- Add to quiz_attempts table
ALTER TABLE quiz_attempts ADD COLUMN difficulty_progression JSONB; -- track difficulty changes
```

---

## API Endpoints Summary

### Course Management
```
POST   /api/admin/courses                    - Create course
GET    /api/admin/courses                    - List all courses
GET    /api/admin/courses/:id                - Get course details
PATCH  /api/admin/courses/:id                - Update course
DELETE /api/admin/courses/:id                - Delete course
```

### Module Management
```
POST   /api/admin/modules                    - Create module
GET    /api/admin/modules                    - List all modules
GET    /api/admin/modules/:id                - Get module details
PATCH  /api/admin/modules/:id                - Update module
DELETE /api/admin/modules/:id                - Delete module
PATCH  /api/admin/modules/:id/prerequisites  - Update prerequisites
POST   /api/admin/modules/:id/reorder        - Reorder module
GET    /api/admin/modules/:id/dependency-tree - Get prerequisite tree
```

### Content Management
```
POST   /api/admin/modules/:id/upload         - Upload content file
GET    /api/admin/modules/:id/content        - List module content
GET    /api/admin/content/:id                - Get content details
GET    /api/admin/content/:id/preview        - Preview extracted text
GET    /api/admin/content/:id/status         - Get processing status
PATCH  /api/admin/content/:id                - Update content metadata
DELETE /api/admin/content/:id                - Delete content
POST   /api/admin/bulk-upload                - Bulk upload files
```

### RAG Search
```
POST   /api/rag/search                       - Enhanced search
GET    /api/rag/suggest-topics               - Get topic suggestions
GET    /api/rag/related-questions            - Get follow-up questions
```

### Knowledge Graph
```
GET    /api/graph/learning-path/:courseId    - Get learning path
GET    /api/graph/recommendations/:userId    - Get recommendations
GET    /api/graph/analytics                  - Get graph analytics
GET    /api/graph/topics                     - Get all topics
GET    /api/graph/topic/:name/related        - Get related topics
```

### Quiz Management
```
POST   /api/admin/modules/:id/quiz           - Create quiz
GET    /api/admin/quizzes/:id                - Get quiz details
POST   /api/admin/quizzes/:id/questions      - Add questions
GET    /api/admin/quizzes/:id/analytics      - Get quiz analytics
DELETE /api/admin/quizzes/:id                - Delete quiz

-- Question Bank
GET    /api/admin/question-bank              - List questions
POST   /api/admin/question-bank              - Create question
GET    /api/admin/question-bank/:id          - Get question
PATCH  /api/admin/question-bank/:id          - Update question
DELETE /api/admin/question-bank/:id          - Delete question
```

---

## Success Metrics

### Phase 1 Success (Weeks 1-2)
- [ ] 5 courses created via admin portal
- [ ] 25 modules created with prerequisites
- [ ] 100+ PDFs uploaded and auto-indexed
- [ ] ChromaDB contains 500+ chunks

### Phase 2 Success (Weeks 3-5)
- [ ] Admin can upload file and see real-time progress
- [ ] 90%+ OCR accuracy on test documents
- [ ] Search query returns results in < 500ms
- [ ] Source attribution includes page numbers

### Phase 3 Success (Weeks 6-8)
- [ ] Neo4j graph contains 1000+ nodes
- [ ] Recommendations accuracy > 80%
- [ ] Quiz pass rate tracked per module
- [ ] WhatsApp chat returns diagrams

### Production Ready (Weeks 9-10)
- [ ] 100+ users enrolled
- [ ] 1000+ messages processed
- [ ] 95%+ uptime
- [ ] Admin portal used daily
- [ ] Quiz completion rate > 70%

---

## Migration Strategy

### Phase 1: Database Migration
1. Run new schema migrations (prerequisites, tags, hours)
2. Populate existing modules with default values
3. Create content_processing_jobs table
4. Backfill existing content with processing status

### Phase 2: Code Refactoring
1. Refactor `portalContentService.uploadModuleContent()` to use new pipeline
2. Add WebSocket server for progress tracking
3. Update `chroma.service.js` for hybrid search
4. Enhance `neo4j.service.js` with new graph schema

### Phase 3: Admin UI Deployment
1. Deploy new admin pages (course-builder, bulk-upload, quiz-builder)
2. Add real-time progress dashboards
3. Integrate graph visualization (D3.js)
4. Add analytics charts (Chart.js)

### Phase 4: WhatsApp Enhancements
1. Update `course-orchestrator.service.js` for better source attribution
2. Add multimodal support (images)
3. Implement follow-up question suggestions
4. Track user interactions in Neo4j

### Phase 5: Testing & Validation
1. End-to-end testing (upload → index → search → chat)
2. Load testing (100 concurrent users)
3. Security audit (SQL injection, XSS, file upload vulnerabilities)
4. Performance optimization (caching, query optimization)

---

## Risk Mitigation

### Risk 1: OCR Processing Time
- **Risk:** Large PDFs (500+ pages) may take 10+ minutes to process
- **Mitigation:**
  - Use background job queue (Bull/BullMQ)
  - Split large PDFs into batches
  - Cache OCR results to avoid re-processing
  - Show estimated time to admin

### Risk 2: Vector DB Scaling
- **Risk:** ChromaDB performance degrades with 10,000+ chunks
- **Mitigation:**
  - Use collection partitioning by course
  - Implement query caching
  - Consider upgrading to Weaviate/Pinecone for larger scale

### Risk 3: Neo4j Graph Complexity
- **Risk:** Complex graph queries may slow down with 100,000+ nodes
- **Mitigation:**
  - Use graph indexes on frequently queried properties
  - Limit graph traversal depth (max 3 hops)
  - Cache common queries (learning paths, recommendations)

### Risk 4: WhatsApp Rate Limits
- **Risk:** Twilio/Meta API has message rate limits
- **Mitigation:**
  - Implement message queuing with rate limiting
  - Use exponential backoff for retries
  - Monitor usage and upgrade plan if needed

---

## Next Steps

1. **Review & Approve** this refactor plan with stakeholders
2. **Prioritize Features** - Which phases are MVP vs. nice-to-have?
3. **Assign Resources** - Developers, designers, QA testers
4. **Create Detailed Tickets** - Break down each phase into JIRA/GitHub issues
5. **Set Sprint Schedule** - Start Sprint 1 on [DATE]
6. **Begin Development** - Follow implementation roadmap

---

## Questions for Stakeholders

1. **Priority:** Which features are must-have for MVP?
   - [ ] Automated content pipeline
   - [ ] Visual quiz builder
   - [ ] Knowledge graph recommendations
   - [ ] Analytics dashboard

2. **Timeline:** Is 10-week timeline acceptable, or do we need to compress?

3. **Budget:** Any constraints on GCP Vertex AI usage (embeddings/generation)?

4. **User Load:** Expected number of concurrent users at launch?

5. **Content Volume:** How many courses/modules/files do we expect to manage?

6. **Integrations:** Any other systems to integrate (LMS, CRM, payment gateway)?

---

**Document Owner:** Claude Code
**Last Review:** 2025-10-18
**Status:** Ready for stakeholder review
