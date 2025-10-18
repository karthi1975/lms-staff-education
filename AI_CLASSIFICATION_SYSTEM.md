# AI-Powered Content Classification System

## 🎯 Overview

Intelligent system that automatically analyzes uploaded course content and determines:
- Which module/topic each file belongs to
- Key concepts and learning topics covered
- Appropriate learning level (beginner/intermediate/advanced)
- Suggested module structure based on content clustering

**User uploads ALL files at once → AI figures out the rest!**

---

## 📊 Complete Workflow

### Phase 1: Bulk Upload & Classification
```
Admin Action: Upload 100+ PDFs to course
             ↓
System: Extract text from each file (OCR if needed)
             ↓
Vertex AI LLM: Analyze content and classify
             ↓
Output: Classification report with:
  - Suggested modules (auto-grouped)
  - Topics per file
  - Confidence scores
  - Files needing review
```

### Phase 2: Review & Accept
```
Admin Reviews:
  ✅ Module 1: Python Basics (12 files, 94% avg confidence)
      - variables.pdf
      - syntax.pdf
      - ...

  ⚠️ Module 2: Advanced Topics (3 files, 68% avg confidence)
      [Needs Review]

  ❌ Unmatched Files (2 files)
      [Manual Assignment]

Admin: [Accept All] or [Edit Structure] → [Create Modules & Process]
```

### Phase 3: Auto-Create & Process
```
System:
  1. Creates modules from accepted suggestions
  2. Assigns files to respective modules
  3. Processes all files (RAG + Graph indexing)
  4. Updates admin dashboard
```

---

## 🏗️ Technical Architecture

### 1. AI Classification Service
**File**: `services/content-classification.service.js`

**Key Methods**:
- `classifyBatch(files, options)` - Classify multiple files
- `classifyFile(file, options)` - Classify single file
- `clusterClassifications()` - Group similar content
- `suggestModuleStructure()` - Propose module organization

**LLM Prompt**:
```
Given document excerpt, determine:
1. Which module does this belong to?
2. What topics does it cover?
3. What's the learning level?
4. Confidence score (0-100)?

Existing Modules: [...]
Document: [first 3000 words]

Return JSON with classification.
```

### 2. Bulk Upload Endpoint
**Endpoint**: `POST /api/admin/courses/:courseId/classify-bulk`

**Request**:
```bash
curl -X POST http://localhost:3000/api/admin/courses/1/classify-bulk \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@file1.pdf" \
  -F "files=@file2.pdf" \
  ...
  -F "files=@file100.pdf"
```

**Response**:
```json
{
  "success": true,
  "classification_id": "classification_1234567_admin1",
  "summary": {
    "total_files": 100,
    "successful": 98,
    "failed": 2,
    "suggested_modules": 5,
    "high_confidence": 85,
    "needs_review": 13
  },
  "module_suggestions": [
    {
      "sequence_order": 1,
      "title": "Python Fundamentals",
      "description": "Auto-generated module covering: variables, data types, syntax",
      "topics": ["variables", "data types", "syntax", "print", "input"],
      "learning_level": "beginner",
      "estimated_duration_hours": 8,
      "file_count": 15,
      "avg_confidence": 0.94,
      "files": [
        {
          "file_name": "python_intro.pdf",
          "topics": ["variables", "syntax"],
          "confidence": 0.95
        },
        ...
      ]
    },
    ...
  ]
}
```

### 3. Accept Classification Endpoint
**Endpoint**: `POST /api/admin/courses/:courseId/accept-classification`

**Request**:
```json
{
  "classification_id": "classification_1234567_admin1",
  "module_decisions": [
    {
      "action": "create",  // or "merge" to use existing module
      "title": "Python Fundamentals",
      "description": "...",
      "sequence_order": 1,
      "topics": ["variables", "syntax"],
      "learning_level": "beginner",
      "estimated_duration_hours": 8,
      "files": [
        {
          "file_name": "python_intro.pdf",
          "file_path": "uploads/file-123.pdf",
          "file_type": "application/pdf",
          "file_size": 1234567,
          "topics": ["variables"],
          "confidence": 0.95
        }
      ]
    }
  ],
  "auto_process": true  // Process files immediately
}
```

**Response**:
```json
{
  "success": true,
  "message": "Created 5 modules and assigned files",
  "created_modules": [
    {"id": 1, "title": "Python Fundamentals"},
    {"id": 2, "title": "Control Flow"},
    ...
  ],
  "processed_files": 98,
  "auto_processed": true
}
```

---

## 🎨 UI Components

### 1. Bulk Upload Page
**File**: `public/admin/bulk-upload.html` (to be created)

**Features**:
- Drag & drop zone for multiple files
- Progress indicator during upload
- File list with preview
- Classification status updates

### 2. Classification Review Page
**File**: `public/admin/classification-review.html` (to be created)

**Features**:
- Module suggestions with confidence scores
- Expandable file lists per module
- Edit module names/descriptions
- Merge/split module suggestions
- Accept all or individual modules
- Manual assignment for low-confidence files

**UI Mockup**:
```
┌─────────────────────────────────────────────────────┐
│ AI Classification Results                           │
│                                                     │
│ 📊 Summary: 100 files → 5 suggested modules        │
│     ✅ 85 high confidence  ⚠️  13 review  ❌ 2 failed │
│                                                     │
│ [Filter: All | High Confidence | Needs Review]     │
│                                                     │
│ ✅ Module 1: Python Fundamentals (15 files, 94%)   │
│    Topics: variables, data types, syntax           │
│    Duration: 8 hours | Level: Beginner             │
│    [View Files ▼] [Edit Module] [Accept]           │
│                                                     │
│ ⚠️  Module 2: Advanced Topics (3 files, 68%)       │
│    Topics: decorators, metaclasses                 │
│    Duration: 4 hours | Level: Advanced             │
│    [View Files ▼] [Edit Module] [Review]           │
│                                                     │
│ [Accept All & Process] [Save Draft] [Cancel]       │
└─────────────────────────────────────────────────────┘
```

---

## 📂 Database Schema Changes

### New Columns in `module_content`
```sql
ALTER TABLE module_content
  ADD COLUMN classification_confidence FLOAT,
  ADD COLUMN classification_topics TEXT[],
  ADD COLUMN ai_suggested_module VARCHAR(255),
  ADD COLUMN classification_metadata JSONB;
```

### New Columns in `modules`
```sql
ALTER TABLE modules
  ADD COLUMN learning_level VARCHAR(50) DEFAULT 'intermediate',
  ADD COLUMN estimated_duration_hours INTEGER DEFAULT 4;
```

### Classification Metadata Example
```json
{
  "classification": {
    "topics": ["variables", "data types", "syntax"],
    "confidence": 0.95,
    "learning_level": "beginner",
    "reasoning": "Document introduces basic Python concepts...",
    "prerequisites": [],
    "classified_at": "2025-10-18T12:00:00Z",
    "classified_by_model": "gemini-1.5-pro"
  }
}
```

---

## 🔄 Processing Flow

### Detailed Step-by-Step

1. **Upload Phase**
   ```
   Admin uploads files → Files saved to uploads/
   ```

2. **Classification Phase** (runs in background)
   ```
   For each file:
     1. Extract text (OCR if needed)
     2. Get 3000-word sample
     3. Call Vertex AI with classification prompt
     4. Parse JSON response
     5. Store classification result

   Cluster classifications:
     1. Group files with similar module suggestions
     2. Calculate avg confidence per group
     3. Generate module proposals
   ```

3. **Review Phase**
   ```
   Admin reviews in UI:
     - High confidence (>80%): Auto-accept
     - Medium confidence (60-80%): Review
     - Low confidence (<60%): Manual assign

   Admin can:
     - Edit module titles
     - Merge modules
     - Reassign files
     - Exclude files
   ```

4. **Execution Phase**
   ```
   On "Accept & Process":
     1. Create modules in database
     2. Assign files to modules
     3. For each file:
        - Extract full text
        - Chunk content
        - Generate embeddings
        - Store in ChromaDB (with module_id filter)
        - Create Neo4j graph nodes
        - Update progress
   ```

---

## 🎯 Benefits

### For Admin
- **Time Savings**: No manual file assignment
- **Smart Organization**: AI groups related content
- **Confidence Scores**: Know which need review
- **Flexible**: Can override AI suggestions

### For System
- **Better Module Structure**: Content-driven organization
- **Consistent Topics**: AI extracts key concepts
- **Learning Progression**: AI detects difficulty levels
- **Quality Metadata**: Rich classification data for RAG

### For Users
- **Better Content Discovery**: Files in logical modules
- **Relevant Retrieval**: Module-scoped RAG queries
- **Progressive Learning**: Beginner → Advanced path
- **Complete Coverage**: No orphaned content

---

## 📝 Example Use Case

### Scenario: New Python Course

**Admin Actions**:
1. Creates course: "Complete Python Programming"
2. Uploads 150 Python PDF files in bulk
3. Waits 5-10 minutes for AI classification
4. Reviews suggestions:
   - Module 1: Basics (20 files, 96% confidence) ✅
   - Module 2: Data Structures (35 files, 91%) ✅
   - Module 3: OOP (28 files, 87%) ✅
   - Module 4: Advanced (18 files, 72%) ⚠️ Review
   - Unmatched (4 files) ❌ Manual assign
5. Accepts modules 1-3, reviews Module 4
6. Clicks "Accept & Process"

**System Output**:
- 4 modules created automatically
- 146 files processed successfully
- 4 files queued for manual assignment
- Full RAG + Graph indexing complete
- Course ready for students

**Time Saved**: Manual organization would take 4-8 hours → AI does it in 10 minutes!

---

## 🚀 Next Steps to Complete Implementation

1. ✅ AI Classification Service (`content-classification.service.js`)
2. ⏳ Add endpoints to `admin.routes.js` (see `NEW_ENDPOINTS.md`)
3. ⏳ Create database migration (add classification columns)
4. ⏳ Build `bulk-upload.html` UI
5. ⏳ Build `classification-review.html` UI
6. ⏳ Add background job processing (optional, for large uploads)
7. ⏳ Add Redis caching for classification results
8. ⏳ Create admin guide documentation

---

*Created: 2025-10-18*
*Status: Foundation complete, endpoints & UI pending*
