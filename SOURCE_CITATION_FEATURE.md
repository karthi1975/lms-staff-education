# Source Citation Feature - DEPLOYED ✅

## Summary
WhatsApp RAG responses now include source citations showing which PDF/DOCX documents were used to generate the answer.

## Deployment Status
- ✅ **Local**: Deployed and running
- ✅ **GCP Cloud**: Deployed to instance `teachers-training` (us-east5-a)
- ✅ **Both environments**: Docker containers restarted successfully

## The Feature

### What It Does
When a user asks a question via WhatsApp (e.g., "What is entrepreneurship & business ideas?"), the bot now includes:
1. The educational answer (from Vertex AI + RAG)
2. **📚 Sources:** section listing the PDF/DOCX files used
3. Section titles from within those documents (if available)

### Example WhatsApp Response

**Before** (no sources):
```
Entrepreneurship refers to the process of designing, launching, and running
a new business venture. It involves identifying opportunities, assessing risks,
and creating value through innovation.

💡 Ask another question or type "quiz please" to take the quiz!
```

**After** (with sources):
```
Entrepreneurship refers to the process of designing, launching, and running
a new business venture. It involves identifying opportunities, assessing risks,
and creating value through innovation.

📚 Sources:
📄 BS Syllabus Analysis.pdf - Introduction to Entrepreneurship
📄 Entrepreneurship Guide.docx - Business Ideas & Community Needs
📄 Business Fundamentals.pdf

💡 Ask another question or type "quiz please" to take the quiz!
```

## Technical Implementation

### File Modified
`services/moodle-orchestrator.service.js`

### Changes Made (lines 394-441)

**Added source citation logic:**
```javascript
// Build source citations from search results metadata
const sources = [];
const seenSources = new Set(); // Deduplicate sources

for (const result of searchResults) {
  if (result.metadata && result.metadata.filename) {
    const sourceName = result.metadata.filename;
    // Add chunk title if available for more specific citation
    const chunkTitle = result.metadata.chunk_title;

    const sourceKey = chunkTitle ? `${sourceName}:${chunkTitle}` : sourceName;

    if (!seenSources.has(sourceKey)) {
      seenSources.add(sourceKey);
      if (chunkTitle && chunkTitle.trim() !== '') {
        sources.push(`📄 ${sourceName} - ${chunkTitle}`);
      } else {
        sources.push(`📄 ${sourceName}`);
      }
    }
  }
}

// Format response with sources
let responseText = response;

if (sources.length > 0) {
  responseText += `\n\n📚 *Sources:*\n${sources.join('\n')}`;
}

responseText += `\n\n💡 _Ask another question or type *"quiz please"* to take the quiz!_`;

return {
  text: responseText
};
```

### How It Works

1. **RAG Search**: When user asks a question, ChromaDB returns top 3 most relevant chunks
2. **Metadata Extraction**: Each chunk has metadata including:
   - `filename`: Original PDF/DOCX name (e.g., "BS Syllabus Analysis.pdf")
   - `chunk_title`: Section title extracted from document (e.g., "Introduction to Entrepreneurship")
   - `module_id`: Which module the content belongs to
   - `chunk_index`: Position within the document
3. **Deduplication**: Same source + section is only shown once
4. **Formatting**: Sources are displayed with 📄 emoji and section titles for context
5. **WhatsApp Delivery**: Sources are appended before the quiz prompt

### Data Flow

```
User Question
    ↓
ChromaDB Search (by module_id)
    ↓
Top 3 Chunks Retrieved with Metadata:
  - chunk.content (text used for answer)
  - chunk.metadata.filename (source file)
  - chunk.metadata.chunk_title (section within file)
    ↓
Vertex AI Generates Answer
    ↓
Sources Formatted and Appended
    ↓
WhatsApp Message Sent
```

## Testing

### Test via WhatsApp
**Production Number**: +1 806 515 7636

**Test Flow**:
```
1. Send: "Hello"
2. Select course: "1" (Business Studies)
3. Select module: "2" (Entrepreneurship & Business Ideas)
4. Ask: "What is entrepreneurship & business ideas?"
5. Observe: Response should include "📚 Sources:" section
```

### Test via Local Logs
```bash
# Watch logs for RAG activity
docker logs -f teachers_training-app-1 2>&1 | grep -i "rag\|chromadb\|search"

# Should see:
# RAG query: "What is entrepreneurship?" for module ID: 2, name: Entrepreneurship & Business Ideas
# ChromaDB search found 3 results
```

### Test via GCP Cloud
```bash
# SSH to cloud
gcloud compute ssh teachers-training --zone=us-east5-a

# Watch logs
docker logs -f teachers_training_app_1 2>&1 | grep -i "rag\|chromadb"

# Check health
curl http://34.162.136.203:3000/health
```

## Source Metadata Available

From `document-processor.service.js` (line 221-239), each chunk includes:

| Metadata Field | Example Value | Usage |
|----------------|---------------|-------|
| `filename` | "BS Syllabus Analysis.pdf" | Primary source citation |
| `chunk_title` | "Introduction to Entrepreneurship" | Section-level citation |
| `module_id` | 2 | Filter by module |
| `content_id` | 5 | Track uploaded file |
| `chunk_index` | 0, 1, 2... | Position in document |
| `source` | "portal" | Upload source |
| `concepts` | "entrepreneurship, innovation" | Key terms extracted |
| `word_count` | 245 | Chunk size |
| `has_lists` | "true" | Content features |
| `has_questions` | "false" | Content features |
| `processed_at` | "2025-10-15T14:30:00Z" | Timestamp |

## Benefits

1. **Transparency**: Users know where information comes from
2. **Trust**: Cites real uploaded educational materials
3. **Follow-up**: Users can request specific sections or documents
4. **Verification**: Admins can trace answers back to source PDFs
5. **Educational**: Teaches students about citing sources

## Edge Cases Handled

### No Sources Available
If ChromaDB search returns results but metadata is missing:
```javascript
if (result.metadata && result.metadata.filename) {
  // Only add sources that have metadata
}
```
Response will still work, just without sources section.

### Duplicate Sources
If same document appears in multiple chunks:
```javascript
const seenSources = new Set();
if (!seenSources.has(sourceKey)) {
  // Only add unique sources
}
```
Each unique source + section appears only once.

### Missing Chunk Titles
If document has no section markers:
```javascript
if (chunkTitle && chunkTitle.trim() !== '') {
  sources.push(`📄 ${sourceName} - ${chunkTitle}`);
} else {
  sources.push(`📄 ${sourceName}`);
}
```
Shows filename only, without section.

## Related Files

### Content Upload & Processing
- `services/portal-content.service.js` (line 194-207): Adds metadata when uploading content
- `services/document-processor.service.js` (line 221-239): Extracts chunk_title and concepts
- `services/chroma.service.js` (line 186-191): Returns search results with metadata

### RAG Query Handler
- `services/moodle-orchestrator.service.js` (line 372-446): processContentQuery() function
  - Line 378: Logs RAG query with module ID and name
  - Line 381-384: ChromaDB search with module_id filter (fixed in previous deployment)
  - Line 394-395: Builds RAG context from chunks
  - Line 398-402: Vertex AI generates educational response
  - Line 407-428: **NEW** - Builds source citations from metadata
  - Line 433-435: **NEW** - Appends sources to response

## Next Steps

### User Testing
- [x] Deploy to local
- [x] Deploy to cloud
- [ ] Test WhatsApp conversation flow
- [ ] Verify sources appear correctly
- [ ] Confirm sources match uploaded PDFs

### Optional Enhancements (Future)
1. **Click-to-download**: Include URLs to download referenced PDFs
2. **Page numbers**: Extract and show specific page numbers from PDFs
3. **Relevance scores**: Show "Top 3 most relevant sources"
4. **Multiple languages**: Translate source labels to user's language
5. **Admin dashboard**: Show which documents are most cited

## Troubleshooting

### Sources Not Showing
**Problem**: Response has no "📚 Sources:" section

**Possible causes**:
1. ChromaDB search returned 0 results → Check module content is uploaded
2. Metadata missing from ChromaDB → Reindex content
3. Different code path used → Verify user is in "learning" state

**Debug steps**:
```bash
# Check ChromaDB has content
docker exec teachers_training-app-1 node -e \
  "const chromaService = require('./services/chroma.service'); \
   chromaService.initialize().then(() => chromaService.getStats()) \
   .then(console.log)"

# Expected: { total_documents: 81 } (or similar)

# Check specific module content
docker exec -i teachers_training-postgres-1 psql -U teachers_user -d teachers_training \
  -c "SELECT COUNT(*) FROM module_content WHERE module_id = 2 AND processed = true;"

# Expected: 1 or more
```

### Wrong Sources Showing
**Problem**: Sources don't match the question topic

**Possible cause**: RAG retrieved irrelevant chunks

**Solution**: Improve question specificity or reindex with better content

### Duplicate Sources
**Problem**: Same PDF listed multiple times

**Should not happen** - deduplication logic prevents this. If it does:
```javascript
const seenSources = new Set();  // line 409
if (!seenSources.has(sourceKey)) {  // line 419
```

## Deployment History

| Date | Environment | Status | Notes |
|------|-------------|--------|-------|
| 2025-10-15 | Local | ✅ Deployed | Docker restarted successfully |
| 2025-10-15 | GCP Cloud | ✅ Deployed | teachers-training (us-east5-a) |

## Cloud Instance Details
- **Instance Name**: teachers-training
- **Zone**: us-east5-a
- **IP**: 34.162.136.203:3000
- **WhatsApp Number**: +1 806 515 7636
- **Container**: teachers_training_app_1

## Quick Commands

```bash
# Local: Restart with new code
docker-compose restart app

# Cloud: Deploy and restart
gcloud compute scp ./services/moodle-orchestrator.service.js \
  teachers-training:~/teachers_training/services/moodle-orchestrator.service.js \
  --zone=us-east5-a

gcloud compute ssh teachers-training --zone=us-east5-a \
  --command="cd ~/teachers_training && docker-compose restart app"

# Watch logs for RAG activity
docker logs -f teachers_training-app-1 2>&1 | grep -i "rag\|sources"
```

---

**Deployment Status**: ✅ COMPLETE
**Feature**: Source Citation in WhatsApp RAG Responses
**Cloud Instance**: teachers-training (us-east5-a)
**Date**: 2025-10-15

**Next Step**: Test WhatsApp conversation and verify sources appear in responses!
