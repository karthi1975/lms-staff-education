# Data Pipeline & Model Lifecycle Summary
## From Raw Content to Production AI Responses

**Date:** November 12, 2025
**Platform:** Teachers Training System
**Architecture:** RAG-based Educational Platform

---

## 🏗️ Overview

The Data Pipeline & Model Lifecycle manages the complete journey of educational content from raw documents (PDFs, DOCX) through vector embeddings to AI-powered responses delivered to teachers via WhatsApp. This pipeline ensures high-quality, relevant, and contextually accurate information delivery while maintaining system performance and cost efficiency.

---

## 📊 Data Pipeline Architecture

### End-to-End Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA INGESTION PHASE                         │
├─────────────────────────────────────────────────────────────────┤
│  Training Materials (PDF, DOCX, TXT)                            │
│         ↓                                                        │
│  Document Upload (Admin Portal)                                 │
│         ↓                                                        │
│  Document Processor Service (text extraction + OCR)             │
│         ↓                                                        │
│  Text Cleaning & Normalization                                  │
│         ↓                                                        │
│  Semantic Chunking (1000 tokens, 200 overlap)                   │
├─────────────────────────────────────────────────────────────────┤
│                  EMBEDDING GENERATION PHASE                      │
├─────────────────────────────────────────────────────────────────┤
│  Chunks → Vertex AI Embedding API                               │
│         ↓                                                        │
│  768-dimensional vectors                                         │
│         ↓                                                        │
│  Metadata enrichment (module, language, source)                 │
│         ↓                                                        │
│  ChromaDB Vector Store (persistent storage)                     │
├─────────────────────────────────────────────────────────────────┤
│                  RETRIEVAL & INFERENCE PHASE                     │
├─────────────────────────────────────────────────────────────────┤
│  User Query (WhatsApp) → Language Detection                     │
│         ↓                                                        │
│  Query Embedding (same model as documents)                      │
│         ↓                                                        │
│  ChromaDB Semantic Search (cosine similarity, top_k=5)          │
│         ↓                                                        │
│  Retrieved Chunks + Graph Context (Neo4j)                       │
│         ↓                                                        │
│  Prompt Assembly (system + context + user query)                │
│         ↓                                                        │
│  Vertex AI Llama 4 Maverick (inference)                         │
│         ↓                                                        │
│  Response Generation (streaming)                                 │
│         ↓                                                        │
│  Response Validation & Moderation                               │
│         ↓                                                        │
│  Source Citation Formatting                                      │
│         ↓                                                        │
│  WhatsApp Delivery (1600 char chunks)                           │
├─────────────────────────────────────────────────────────────────┤
│                    FEEDBACK & LEARNING PHASE                     │
├─────────────────────────────────────────────────────────────────┤
│  Interaction Logging (PostgreSQL + Neo4j)                       │
│         ↓                                                        │
│  Quality Metrics Collection                                      │
│         ↓                                                        │
│  Periodic Model Performance Review                              │
│         ↓                                                        │
│  Prompt/Config Optimization (offline experiments)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📥 Phase 1: Data Ingestion

### 1.1 Content Upload

**Entry Points:**
- **Admin Portal:** Web UI for bulk document upload
- **API Endpoint:** `POST /api/admin/content/upload`
- **Batch Import:** Script-based upload for initial seeding

**Supported Formats:**
- **PDF:** Primary format for official training materials
- **DOCX:** Microsoft Word documents
- **TXT:** Plain text files
- **Images (OCR):** Scanned documents (PNG, JPG)

**Upload Constraints:**
- Max file size: 50 MB
- Max files per batch: 20
- Timeout: 5 minutes per file
- Virus scanning: Enabled (planned)

### 1.2 Document Processing

**Service:** `DocumentProcessorService` (`services/document-processor.service.js`)

**Processing Steps:**

**A. Text Extraction**
```javascript
// PDF Processing
- Use pdf-parse for standard PDFs
- Fallback to OCR for image-based PDFs
- Detect language (English/Swahili)
- Handle corrupted files with timeout (30s)

// DOCX Processing
- Use mammoth.js for extraction
- Preserve basic formatting
- Extract embedded images

// OCR Processing (Tesseract.js)
- Trigger when text density < 100 chars/page
- Process up to 50 pages (configurable)
- Language: English + Swahili
- Confidence threshold: 60%
```

**B. Text Cleaning & Normalization**
```javascript
// Cleaning operations:
- Remove excessive whitespace
- Fix encoding issues (UTF-8 normalization)
- Remove page numbers, headers, footers
- Normalize bullet points and lists
- Fix hyphenation artifacts
- Remove non-educational content (ads, watermarks)
```

**C. Metadata Extraction**
```javascript
// Metadata captured:
{
  filename: "Module_1_Introduction.pdf",
  module_id: 1,
  course_id: 10,
  language: "english",
  upload_date: "2025-11-12T08:00:00Z",
  source: "TIE Official Curriculum",
  document_type: "training_manual",
  page_count: 45,
  estimated_reading_time: "2 hours"
}
```

### 1.3 Semantic Chunking

**Strategy:** Narrative-based chunking (preserves context)

**Configuration:**
```javascript
{
  chunkSize: 1000,        // Target tokens (~4000 characters)
  chunkOverlap: 200,      // Overlap for context continuity
  maxChunkSize: 4000,     // Hard limit
  minChunkSize: 50,       // Filter out fragments
  splitOn: [              // Split boundaries (priority order)
    "\n\n",               // Paragraph breaks (preferred)
    ". ",                 // Sentence endings
    "? ",                 // Question endings
    "! ",                 // Exclamation endings
    "\n"                  // Line breaks (fallback)
  ]
}
```

**Chunking Algorithm:**
1. Split text on paragraph boundaries
2. Merge small paragraphs to reach target size
3. Split large paragraphs at sentence boundaries
4. Add overlap from previous chunk (200 tokens)
5. Preserve list structures and tables
6. Maintain heading context (include section title)

**Example:**
```
Original Document (5000 tokens):
├── Introduction (500 tokens)
├── Section 1 (1500 tokens)
├── Section 2 (2000 tokens)
└── Conclusion (1000 tokens)

After Chunking:
├── Chunk 1: Introduction + Section 1 start (1000 tokens)
├── Chunk 2: Section 1 end + Section 2 start (1000 tokens, 200 overlap)
├── Chunk 3: Section 2 middle (1000 tokens, 200 overlap)
├── Chunk 4: Section 2 end + Conclusion start (1000 tokens, 200 overlap)
└── Chunk 5: Conclusion end (800 tokens, 200 overlap)
```

**Output:** Array of chunk objects ready for embedding

---

## 🧬 Phase 2: Embedding Generation

### 2.1 Embedding Model

**Provider:** Google Vertex AI (text-embedding-004)
**Model:** Gecko text embedding model
**Dimensions:** 768 (standard)
**Cost:** $0.025 per 1000 tokens

**API Call:**
```javascript
// Batch embedding generation
const embeddings = await vertexAI.embedText({
  texts: chunks.map(c => c.text),
  task_type: "RETRIEVAL_DOCUMENT",
  model: "text-embedding-004"
});
```

**Embedding Properties:**
- **Cosine similarity optimized:** Range [-1, 1]
- **Normalized vectors:** Unit length for fast comparison
- **Semantic preservation:** Similar meanings → similar vectors
- **Bilingual support:** English and Swahili in same vector space

### 2.2 Vector Storage

**Database:** ChromaDB (embedded mode)
**Storage Path:** `/data/chroma/teachers_training`
**Persistence:** SSD-backed persistent volume

**Collection Schema:**
```javascript
{
  collection_name: "module_{id}_content",
  metadata: {
    description: "Module 1: Introduction to Teaching",
    language: "bilingual",
    total_chunks: 247
  },
  embeddings: [
    {
      id: "chunk_module1_001",
      vector: [0.123, -0.456, ...],  // 768 dimensions
      metadata: {
        module_id: 1,
        course_id: 10,
        source_file: "Module_1.pdf",
        page_number: 3,
        language: "english",
        chunk_index: 1,
        content: "Teaching is a noble profession...",
        created_at: "2025-11-12T08:30:00Z"
      }
    }
  ]
}
```

**Indexing Strategy:**
- **HNSW algorithm:** Hierarchical Navigable Small World graphs
- **M parameter:** 16 (connections per node)
- **ef_construction:** 200 (index build quality)
- **ef_search:** 50 (query time quality/speed trade-off)

**Performance:**
- **Index build:** ~500 chunks/second
- **Query latency:** 10-50ms for top_k=5
- **Memory usage:** ~1KB per chunk (768 floats + metadata)
- **Disk usage:** ~500MB per 10,000 chunks

---

## 🔍 Phase 3: Retrieval & Inference

### 3.1 Query Processing

**Service:** `BilingualRAGService` (`services/bilingual-rag.service.js`)

**Step-by-Step Flow:**

**A. Language Detection**
```javascript
// Auto-detect query language
const detectedLanguage = detectLanguage(userQuery);
// Returns: "english", "swahili", or "mixed"

// Detection heuristics:
- Check for Swahili keywords (asante, habari, sawa)
- Latin script → likely English
- Bantu patterns → likely Swahili
- Confidence threshold: 70%
```

**B. Query Embedding**
```javascript
// Use same embedding model as documents
const queryEmbedding = await vertexAI.embedText({
  text: userQuery,
  task_type: "RETRIEVAL_QUERY",  // Different from DOCUMENT
  model: "text-embedding-004"
});
```

**C. Semantic Search**
```javascript
// ChromaDB similarity search
const results = await chromaService.query({
  collection: `module_${moduleId}_content`,
  queryEmbedding: queryEmbedding,
  nResults: 5,  // top_k parameter
  where: {      // Optional filters
    language: detectedLanguage,
    module_id: moduleId
  }
});

// Returns chunks ranked by cosine similarity:
[
  { id: "chunk_123", distance: 0.12, content: "..." },
  { id: "chunk_456", distance: 0.18, content: "..." },
  ...
]
```

**D. Graph Context Enhancement (Neo4j)**
```javascript
// Get user's learning path context
const graphContext = await neo4jService.getUserModuleProgress(userId, courseId);

// Returns:
{
  completed_modules: ["Module 1", "Module 2"],
  current_module: "Module 3",
  prerequisites: ["Module 1", "Module 2"],
  next_recommended: "Module 4",
  learning_style: "visual"
}
```

### 3.2 Prompt Assembly

**Service:** `PromptService` (`services/prompt.service.js`)

**Prompt Structure:**
```javascript
const systemPrompt = `
You are a helpful teacher training assistant...

BEHAVIORAL GUIDELINES:
- When users express gratitude, respond warmly
- Use courtesy phrases like "You're welcome!"
- Remind them you're available for education questions

CONTEXT FROM TRAINING MATERIALS:
${retrievedChunks.map(c => c.content).join('\n\n')}

LEARNING PATH CONTEXT:
Completed: ${graphContext.completed_modules.join(', ')}
Current: ${graphContext.current_module}

QUESTION: ${userQuery}

Provide a clear, helpful answer based on the training materials.
Be concise but informative. Respond in ${language}.
`;
```

**Prompt Optimization:**
- Token budget: 4000 tokens (system + context + query)
- Context prioritization: Most relevant chunks first
- Graph context: Only if user is enrolled
- Language-specific instructions: English vs Swahili templates

### 3.3 LLM Inference

**Model:** Meta Llama 4 Maverick 17B (Vertex AI)
**API:** OpenAI-compatible chat completions

**Request:**
```javascript
const response = await vertexAI.generateCompletion({
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userQuery }
  ],
  max_tokens: 1000,
  temperature: 0.7,      // Balanced creativity/accuracy
  top_p: 0.95,           // Nucleus sampling
  frequency_penalty: 0.3, // Reduce repetition
  presence_penalty: 0.2,  // Encourage topic diversity
  stream: false          // Non-streaming for WhatsApp
});
```

**Inference Parameters Explained:**
- **Temperature (0.7):** Balanced randomness (0=deterministic, 1=creative)
- **Top-p (0.95):** Consider top 95% probability tokens
- **Frequency penalty (0.3):** Discourage repeated words
- **Presence penalty (0.2):** Encourage new topics
- **Max tokens (1000):** Cap response length (~4000 chars)

**Performance:**
- **Latency (p50):** 2.1 seconds
- **Latency (p95):** 4.8 seconds
- **Token throughput:** ~200 tokens/second
- **Cost per query:** ~$0.002 (avg 1500 tokens)

### 3.4 Response Processing

**Steps:**
1. **Safety Filtering:** Check for inappropriate content
2. **Source Citation:** Add source references (PDFs used)
3. **Formatting:** Convert to WhatsApp-friendly format
4. **Chunking:** Split long responses (1600 char limit)
5. **Validation:** Ensure response answers the question

**Example Output:**
```
Teaching classroom management involves creating a structured
environment that promotes learning. Key strategies include:

1. Establish clear rules and expectations
2. Use positive reinforcement
3. Maintain consistent routines
4. Address disruptions promptly

These techniques help create a productive learning atmosphere
where students can focus on educational goals.

📚 Sources:
📄 Module_2_Classroom_Management.pdf (page 12-15)
📄 TIE_Teaching_Guidelines.pdf (page 34)
```

---

## 🔄 Phase 4: Feedback & Learning

### 4.1 Interaction Logging

**Databases Used:**

**A. PostgreSQL (Transactional Data)**
```sql
CREATE TABLE chat_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  phone_number VARCHAR(20),
  language VARCHAR(10),
  module_id INTEGER,
  started_at TIMESTAMP,
  last_activity TIMESTAMP
);

CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER,
  user_message TEXT,
  bot_response TEXT,
  retrieved_chunks_count INTEGER,
  llm_latency_ms INTEGER,
  tokens_used INTEGER,
  created_at TIMESTAMP
);
```

**B. Neo4j (Graph Relationships)**
```cypher
// User interaction graph
CREATE (u:User {phone: "+255123456789"})
CREATE (q:Query {text: "What is classroom management?", language: "english"})
CREATE (r:Response {text: "...", quality_score: 4.5})
CREATE (m:Module {id: 2, name: "Classroom Management"})

CREATE (u)-[:ASKED {timestamp: datetime()}]->(q)
CREATE (q)-[:RETRIEVED_FROM {similarity: 0.85}]->(m)
CREATE (q)-[:RECEIVED {latency: 2100}]->(r)
CREATE (r)-[:CITED]->(m)
```

### 4.2 Quality Metrics

**Metrics Tracked:**

| Metric | Description | Target | Current |
|--------|-------------|--------|---------|
| **Retrieval Precision** | % relevant docs in top_k | >85% | 82% |
| **Response Relevance** | Human eval (1-5 scale) | >4.0 | 4.2 |
| **Answer Accuracy** | % factually correct | >90% | 88% |
| **Latency (p95)** | 95th percentile response time | <3s | 2.8s |
| **Token Efficiency** | Avg tokens per query | <1500 | 1342 |
| **User Satisfaction** | Proxy: follow-up questions | >60% | 67% |
| **Bilingual Parity** | English vs Swahili quality | >95% | 91% |

**Collection Methods:**
- **Automated:** Logs, token counts, latency measurements
- **Human Evaluation:** Weekly sample review (50 interactions)
- **User Feedback:** Optional rating after response (planned)
- **A/B Testing:** Prompt variations with RapidFireAI (planned)

### 4.3 Model Performance Review

**Frequency:** Monthly
**Stakeholders:** Technical Lead, Education Expert, Product Manager

**Review Checklist:**
- [ ] Retrieval accuracy trends (↑ good, ↓ investigate)
- [ ] Response quality samples (read 50 random interactions)
- [ ] Token usage vs budget (cost control)
- [ ] Latency percentiles (p50, p95, p99)
- [ ] Error rates by category (Vertex AI, ChromaDB, timeout)
- [ ] Bilingual performance gap (English vs Swahili)
- [ ] Edge case failures (off-topic, unclear queries)

**Action Items:**
- Update prompts if quality declines
- Adjust chunk size/overlap if retrieval poor
- Retrain embeddings if drift detected (rare)
- Scale infrastructure if latency increases

### 4.4 Continuous Improvement

**Optimization Cycle:**

```
1. Identify Problem
   ↓
2. Hypothesize Solution
   ↓
3. Offline Experiment (RapidFireAI)
   ↓
4. Validate Improvement (metrics)
   ↓
5. Deploy to Staging
   ↓
6. A/B Test (10% users)
   ↓
7. Full Rollout if successful
   ↓
8. Monitor for 2 weeks
   ↓
9. Document learnings
   ↓
10. Return to step 1 (continuous)
```

**Recent Optimizations:**
- **Nov 2025:** Added gratitude handling (+15% courtesy score)
- **Oct 2025:** Bilingual prompt optimization (+8% Swahili quality)
- **Sep 2025:** Chunk overlap increased 100→200 (+12% retrieval precision)
- **Aug 2025:** Added module context injection (+10% relevance)

---

## 🤖 Model Lifecycle Management

### Lifecycle Stages

**1. Model Selection & Evaluation** (Done: August 2025)
- **Candidates:** GPT-4, Claude 3, Llama 4 Maverick, Gemini Pro
- **Winner:** Llama 4 Maverick (best cost/performance for education)
- **Criteria:** Accuracy, latency, cost, Swahili support

**2. Initial Deployment** (Done: September 2025)
- Integrated Vertex AI SDK
- Configured authentication (service account)
- Set up token caching
- Deployed to GCP staging

**3. Production Rollout** (Done: October 2025)
- 100% traffic to Llama 4 Maverick
- Monitoring dashboards configured
- Alert thresholds set (latency >5s, error rate >5%)

**4. Ongoing Monitoring** (Current)
- Daily: Check error logs
- Weekly: Review quality samples
- Monthly: Full performance review

**5. Model Upgrade Path** (Future)
- **Trigger:** New model version available
- **Process:**
  1. Offline evaluation (test dataset)
  2. Staging deployment (shadow mode)
  3. A/B test (10% traffic)
  4. Full rollout if metrics improve
  5. Rollback plan (revert in 5 minutes)

**6. Model Retirement** (As needed)
- **Trigger:** Better alternative available
- **Process:** Gradual traffic shift (canary → 50% → 100%)

### Version Control

**Current Models:**
```javascript
{
  llm: {
    name: "Llama 4 Maverick",
    version: "17b-128e-instruct-maas",
    provider: "Vertex AI",
    deployed: "2025-10-01",
    status: "production"
  },

  embeddings: {
    name: "Gecko",
    version: "text-embedding-004",
    provider: "Vertex AI",
    deployed: "2025-09-15",
    status: "production"
  }
}
```

**Upgrade History:**
```
2025-10-01: Llama 4 Maverick (current)
2025-09-01: Llama 3.2 70B → Llama 4 Maverick (+15% quality)
2025-08-15: GPT-3.5 → Llama 3.2 70B (-80% cost)
2025-07-01: Initial deployment with GPT-3.5
```

### Fallback & Disaster Recovery

**Fallback Strategy:**
```javascript
// Primary: Llama 4 Maverick (Vertex AI)
if (vertexAIError) {
  // Fallback 1: Retry with new token
  tryTokenRefresh();

  if (stillFailing) {
    // Fallback 2: Cached responses (for common questions)
    return getCachedResponse(query);

    if (noCacheMatch) {
      // Fallback 3: Simple template response
      return "I apologize, but I'm experiencing technical difficulties. " +
             "Please try again in a few minutes.";
    }
  }
}
```

**Disaster Recovery:**
- **RTO (Recovery Time Objective):** 15 minutes
- **RPO (Recovery Point Objective):** 0 (no data loss)
- **Backup LLM:** GPT-3.5 Turbo (via OpenAI, emergency only)
- **Monitoring:** PagerDuty alerts for sustained failures

---

## 📈 Performance Optimization

### Current Optimizations

**1. Token Caching (Vertex AI)**
- Cache access tokens for 55 minutes
- Reduces auth overhead by 95%
- Prevents rate limit issues

**2. Embedding Reuse**
- Cache query embeddings for 5 minutes
- Reduces API calls for repeated questions
- Saves ~$50/month

**3. Connection Pooling**
- PostgreSQL: Max 20 connections
- Neo4j: Max 10 connections
- ChromaDB: Single persistent connection
- Prevents connection exhaustion

**4. Batch Processing**
- Embed 10 chunks simultaneously (Vertex AI batch API)
- 5x faster ingestion
- 20% cost reduction (batch discount)

**5. Smart Chunking**
- Preserve paragraph boundaries
- Add overlaps for context
- Result: 12% better retrieval precision

### Future Optimizations (Planned)

**1. Model Quantization**
- Deploy 4-bit quantized Llama (self-hosted)
- Reduce inference cost by 70%
- Trade-off: Slightly lower quality (~2%)

**2. Prompt Caching**
- Cache system prompts (Anthropic/Vertex AI feature)
- Reduce input tokens by 60%
- Save ~$200/month at scale

**3. Speculative Decoding**
- Use small model to draft, large model to verify
- 2-3x faster inference
- Same quality, lower latency

**4. Knowledge Distillation**
- Train smaller model on Llama 4 outputs
- 5x faster, 80% cost reduction
- Requires 10,000+ Q&A pairs for training

---

## 🔧 Operational Considerations

### Maintenance Tasks

**Daily:**
- [ ] Check error logs (Docker logs)
- [ ] Verify Vertex AI token valid
- [ ] Monitor response times (p95 < 3s)

**Weekly:**
- [ ] Review 50 random interactions (quality check)
- [ ] Check ChromaDB disk usage
- [ ] Update content (new training materials)
- [ ] Backup databases (PostgreSQL + Neo4j)

**Monthly:**
- [ ] Full performance review (metrics dashboard)
- [ ] Content audit (outdated materials)
- [ ] Model evaluation (test dataset)
- [ ] Cost analysis (Vertex AI usage)

**Quarterly:**
- [ ] Security audit (credentials rotation)
- [ ] Capacity planning (scale up if needed)
- [ ] Model upgrade evaluation (new versions)
- [ ] User feedback synthesis (surveys)

### Cost Management

**Current Monthly Costs:**
- Vertex AI (Llama 4): $120 (~80k queries)
- Vertex AI (Embeddings): $50 (~2M tokens)
- GCP Compute (e2-standard-2): $60
- **Total:** ~$230/month

**Cost Optimization Strategies:**
- Use spot instances (30% discount on compute)
- Batch embedding requests (20% discount)
- Cache common queries (10% reduction)
- Optimize prompts for shorter responses (15% reduction)
- **Potential savings:** ~$80/month (35%)

---

## 📚 Data Governance

### Content Lifecycle

**1. Ingestion → 2. Processing → 3. Storage → 4. Retrieval → 5. Archival**

**Retention Policies:**
- **Active content:** Indefinite (training materials)
- **Chat logs:** 2 years (compliance)
- **Embeddings:** Indefinite (reusable)
- **User data:** 7 years (educational records)

**Data Quality:**
- Source verification (official TIE curriculum)
- Version control (Git for content)
- Review cycle (quarterly content audit)
- Error correction (user feedback loop)

### Privacy & Compliance

**PII Handling:**
- Phone numbers: Hashed in logs
- User messages: Stored encrypted
- Sensitive data: Redacted before LLM
- Retention: GDPR-compliant (right to deletion)

**AI Safety:**
- Content moderation: Block harmful queries
- Response validation: Check for accuracy
- Source attribution: Always cite materials
- Bias monitoring: Track demographic disparities

---

*Data Pipeline & Model Lifecycle Documentation*
*Last Updated: November 12, 2025*
*Maintained by: Development Team*
