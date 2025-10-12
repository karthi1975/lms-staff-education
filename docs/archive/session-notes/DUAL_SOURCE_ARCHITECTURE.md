# Dual-Source Educational Chatbot Architecture

## Overview
This system is a **Twilio WhatsApp-based educational chatbot** running on **port 3000** with **dual content sources**:
1. **Moodle LMS** - Auto-synced courses, modules, and quizzes
2. **Portal Documents** - Admin-uploaded training materials (PDF, DOCX, TXT)

Both sources leverage:
- **RAG Pipeline** (ChromaDB + Vertex AI LLM)
- **Graph Database** (Neo4j for learning paths)
- **PostgreSQL** (user management, course metadata)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   WhatsApp Users                             │
│                        ↓↑                                    │
│                   Twilio API                                 │
│                        ↓↑                                    │
│              ngrok: https://5a7cfbd9994f.ngrok-free.app     │
└─────────────────────────────────────────────────────────────┘
                         ↓↑
┌─────────────────────────────────────────────────────────────┐
│         Express Server (Port 3000)                           │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Twilio Webhook Handler                            │     │
│  │  /webhook/twilio → twilioWebhookRoutes             │     │
│  └────────────────────────────────────────────────────┘     │
│                         ↓                                    │
│  ┌────────────────────────────────────────────────────┐     │
│  │  WhatsApp Adapter Service                          │     │
│  │  (Supports both Meta & Twilio)                     │     │
│  │  WHATSAPP_PROVIDER=twilio                          │     │
│  └────────────────────────────────────────────────────┘     │
│                         ↓                                    │
│  ┌────────────────────────────────────────────────────┐     │
│  │  WhatsApp Handler Service                          │     │
│  │  (Session Management, Message Routing)             │     │
│  └────────────────────────────────────────────────────┘     │
│                         ↓                                    │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Moodle Orchestrator Service                       │     │
│  │  (Unified flow: Course → Module → Chat → Quiz)     │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                 Content Sources                              │
│  ┌────────────────────┐   ┌─────────────────────────┐       │
│  │  Moodle LMS        │   │  Portal Documents       │       │
│  │  (API Sync)        │   │  (Admin Upload)         │       │
│  │  - Courses         │   │  - PDFs                 │       │
│  │  - Modules         │   │  - DOCX                 │       │
│  │  - Quizzes         │   │  - TXT                  │       │
│  └────────────────────┘   └─────────────────────────┘       │
│           ↓                         ↓                        │
│  ┌─────────────────────────────────────────────────┐        │
│  │         PostgreSQL Database                      │        │
│  │  - moodle_courses (source='moodle'/'portal')     │        │
│  │  - moodle_modules                                │        │
│  │  - moodle_quizzes                                │        │
│  │  - quiz_questions                                │        │
│  │  - users, user_progress                          │        │
│  └─────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    AI/RAG Pipeline                           │
│  ┌────────────────────┐   ┌─────────────────────────┐       │
│  │  ChromaDB          │   │  Vertex AI LLM          │       │
│  │  (Vector Store)    │   │  (Llama 4 Maverick)     │       │
│  │  - Embeddings      │   │  - Q&A Generation       │       │
│  │  - Semantic Search │   │  - Quiz Generation      │       │
│  └────────────────────┘   └─────────────────────────┘       │
│  ┌────────────────────┐                                      │
│  │  Neo4j             │                                      │
│  │  (Learning Paths)  │                                      │
│  │  - Module Graphs   │                                      │
│  │  - Prerequisites   │                                      │
│  └────────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. **WhatsApp Integration (Twilio)**
- **Service**: `services/twilio-whatsapp.service.js`
- **Routes**: `routes/twilio-webhook.routes.js`
- **Adapter**: `services/whatsapp-adapter.service.js` (switches between Meta/Twilio)
- **Environment**: `WHATSAPP_PROVIDER=twilio`
- **Webhook**: `POST /webhook/twilio`
- **Ngrok URL**: `https://5a7cfbd9994f.ngrok-free.app/webhook/twilio`

### 2. **Content Sources**

#### A. Moodle LMS (Auto-Sync)
- **Service**: `services/moodle-sync.service.js`
- **Sync Flow**:
  1. Fetch courses from Moodle API
  2. Extract modules and quizzes
  3. Parse GIFT format quiz questions
  4. Store in PostgreSQL with `source='moodle'`
  5. Add content to ChromaDB for RAG

#### B. Portal Documents (Admin Upload)
- **Routes**: `routes/admin.routes.js`
- **Upload Flow**:
  1. Admin uploads PDF/DOCX/TXT via portal
  2. Document processor extracts text
  3. Text chunked into semantic units
  4. Store in PostgreSQL with `source='portal'`
  5. Generate embeddings via Vertex AI
  6. Add to ChromaDB with metadata

### 3. **Database Schema (Dual-Source Support)**

```sql
-- Courses can come from Moodle OR Portal
CREATE TABLE moodle_courses (
    id SERIAL PRIMARY KEY,
    moodle_course_id INT,
    course_name VARCHAR(255),
    course_code VARCHAR(50),
    source VARCHAR(20) DEFAULT 'moodle', -- 'moodle' or 'portal'
    portal_created_by INT,                -- Admin user ID if portal
    portal_created_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Modules linked to courses
CREATE TABLE moodle_modules (
    id SERIAL PRIMARY KEY,
    moodle_course_id INT REFERENCES moodle_courses(id),
    moodle_module_id INT,
    module_name VARCHAR(255),
    module_type VARCHAR(50),
    source VARCHAR(20) DEFAULT 'moodle', -- 'moodle' or 'portal'
    content_file_path TEXT,               -- File path if portal upload
    sequence_order INT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Quizzes (Moodle-synced or portal-generated)
CREATE TABLE moodle_quizzes (
    id SERIAL PRIMARY KEY,
    moodle_quiz_id INT,
    moodle_module_id INT REFERENCES moodle_modules(id),
    quiz_name VARCHAR(255),
    source VARCHAR(20) DEFAULT 'moodle',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Quiz questions
CREATE TABLE quiz_questions (
    id SERIAL PRIMARY KEY,
    moodle_quiz_id INT REFERENCES moodle_quizzes(id),
    question_text TEXT,
    question_type VARCHAR(50),
    options JSONB,
    correct_answer TEXT,
    source VARCHAR(20) DEFAULT 'moodle',
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 4. **Orchestrator Flow (Moodle Orchestrator)**
File: `services/moodle-orchestrator.service.js`

**Conversation Flow**:
1. **Welcome** → Show all courses (Moodle + Portal)
2. **Select Course** → Show modules for that course
3. **Select Module** → Enter chat mode (RAG-powered Q&A)
4. **Type "quiz"** → Start quiz for current module
5. **Answer Questions** → Track score in PostgreSQL
6. **Quiz Complete** → Show results, unlock next module

### 5. **RAG Pipeline**

**Components**:
- **ChromaDB**: Vector store for semantic search
- **Vertex AI**: LLM for answer generation and quiz creation
- **Document Processor**: Extracts text from PDFs/DOCX

**Flow**:
```
User Question
    ↓
Embed question (Vertex AI)
    ↓
Search ChromaDB (semantic similarity)
    ↓
Retrieve top 3-5 relevant chunks
    ↓
Generate answer (Vertex AI + context)
    ↓
Return to user via WhatsApp
```

### 6. **Admin Portal (Port 3000)**

**Pages**:
- `/admin/login.html` - Admin authentication
- `/admin/index.html` - Dashboard (upload content, view analytics)
- `/admin/modules.html` - Module management
- `/admin/users.html` - User list with progress tracking
- `/admin/lms-dashboard.html` - Moodle sync dashboard

**Features**:
- Upload training documents (PDF, DOCX, TXT)
- Sync Moodle courses
- View user progress
- Generate quizzes
- Test chatbot responses

---

## Environment Configuration

### Required `.env` Variables

```env
# Server
PORT=3000

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=<your-twilio-account-sid>
TWILIO_AUTH_TOKEN=<your-twilio-auth-token>
TWILIO_PHONE_NUMBER=<your-twilio-phone-number>
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
TWILIO_SKIP_VALIDATION=false
WHATSAPP_PROVIDER=twilio

# PostgreSQL (Docker)
DB_HOST=postgres
DB_PORT=5432
DB_NAME=teachers_training
DB_USER=teachers_user
DB_PASSWORD=teachers_pass_2024

# ChromaDB (Docker)
CHROMA_URL=http://chromadb:8000
CHROMA_HOST=chromadb
CHROMA_PORT=8000

# Neo4j (Docker)
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Vertex AI (Google Cloud)
GCP_PROJECT_ID=staff-education
VERTEX_AI_REGION=us-east5
VERTEX_AI_MODEL=meta/llama-4-maverick-17b-128e-instruct-maas
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
USE_APPLICATION_DEFAULT_CREDENTIALS=true

# Moodle LMS
MOODLE_URL=https://karthitest.moodlecloud.com
MOODLE_TOKEN=c0ee6baca141679fdd6793ad397e6f21
MOODLE_SYNC_ENABLED=true

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h
```

---

## Setup Instructions

### 1. **Start Docker Services**
```bash
# Start PostgreSQL, ChromaDB, Neo4j
docker-compose up -d

# Verify containers are running
docker ps
```

### 2. **Run Database Migrations**
```bash
# Run migration to add source tracking columns
docker exec teachers_training-app-1 node scripts/run-migration.js

# Or manually via psql
PGPASSWORD=teachers_pass_2024 psql -h localhost -U teachers_user -d teachers_training < migrations/002_add_source_columns.sql
```

### 3. **Start ngrok (for Twilio webhooks)**
```bash
# Start ngrok tunnel
ngrok http 3000

# Copy the HTTPS URL (e.g., https://5a7cfbd9994f.ngrok-free.app)
```

### 4. **Configure Twilio Webhook**
1. Go to [Twilio Console](https://console.twilio.com)
2. Navigate to **Messaging** → **Try it out** → **Send a WhatsApp message**
3. Under **Sandbox Configuration**, set:
   - **When a message comes in**: `https://5a7cfbd9994f.ngrok-free.app/webhook/twilio`
   - **Method**: `HTTP POST`
4. Click **Save**

### 5. **Join Twilio Sandbox**
1. From WhatsApp, send a message to `+1 415 523 8886`
2. Send: `join <your-code>` (shown in Twilio Console)
3. You should receive a confirmation message

### 6. **Start Application**
```bash
# Start Node.js server
npm start

# Server starts on http://localhost:3000
```

### 7. **Test the System**

#### Test 1: Send WhatsApp Message
1. Send `hello` to Twilio sandbox number
2. Bot should respond with course selection

#### Test 2: Admin Portal
1. Visit `http://localhost:3000/admin/login.html`
2. Login with admin credentials
3. Upload a PDF document via Modules page
4. Content should appear in chatbot

#### Test 3: Moodle Sync
1. Visit `http://localhost:3000/admin/lms-dashboard.html`
2. Click "Sync Moodle Course"
3. Enter Moodle course ID
4. Verify course appears in WhatsApp bot

---

## Dual-Source Content Flow

### Scenario 1: User Asks Question from Moodle Content
```
User: "What is constructivism in teaching?"
    ↓
ChromaDB searches all embeddings (source doesn't matter)
    ↓
Finds chunks from Moodle course "Educational Psychology"
    ↓
Vertex AI generates answer using retrieved context
    ↓
Response sent via Twilio WhatsApp
```

### Scenario 2: User Asks Question from Portal Upload
```
User: "Tell me about classroom discipline techniques"
    ↓
ChromaDB searches all embeddings
    ↓
Finds chunks from admin-uploaded PDF "Classroom Management Guide"
    ↓
Vertex AI generates answer
    ↓
Response sent via WhatsApp
```

### Scenario 3: Quiz from Moodle
```
User: "quiz"
    ↓
Load quiz questions from PostgreSQL (moodle_quizzes)
    ↓
Send questions one by one via WhatsApp
    ↓
Track answers in quiz_attempts table
    ↓
Calculate score and update user_progress
```

---

## Key Services

| Service | File | Purpose |
|---------|------|---------|
| **Twilio WhatsApp** | `services/twilio-whatsapp.service.js` | Send/receive WhatsApp messages |
| **WhatsApp Adapter** | `services/whatsapp-adapter.service.js` | Unified interface (Meta/Twilio) |
| **WhatsApp Handler** | `services/whatsapp-handler.service.js` | Session management, routing |
| **Moodle Orchestrator** | `services/moodle-orchestrator.service.js` | Conversational flow |
| **Moodle Sync** | `services/moodle-sync.service.js` | Sync courses from Moodle |
| **Document Processor** | `services/document-processor.service.js` | Extract text from uploads |
| **ChromaDB** | `services/chroma.service.js` | Vector embeddings, search |
| **Vertex AI** | `services/vertexai.service.js` | LLM for Q&A, quiz gen |
| **Neo4j** | `services/neo4j.service.js` | Learning path graphs |
| **PostgreSQL** | `services/database/postgres.service.js` | User/course data |

---

## API Endpoints

### Public Endpoints
- `GET /health` - Health check
- `POST /webhook/twilio` - Twilio webhook (incoming messages)
- `POST /webhook/twilio/status` - Message status updates

### Admin API (JWT Protected)
- `POST /api/admin/login` - Admin authentication
- `GET /api/admin/courses` - List all courses (Moodle + Portal)
- `POST /api/admin/portal/courses` - Create portal course
- `POST /api/admin/portal/courses/:id/modules` - Upload module content
- `POST /api/admin/moodle/sync/:courseId` - Sync Moodle course
- `GET /api/admin/users` - List users with progress
- `GET /api/admin/users/:id/progress` - User progress details

### Content API
- `POST /api/chat` - Test RAG chat (admin dashboard)
- `POST /api/search` - Search content
- `GET /api/modules/:moduleId/content` - Get module content
- `POST /api/modules/:moduleId/content` - Upload content

---

## Database Tables (Key Fields)

### Users
```sql
users (id, whatsapp_id, name, current_module_id, created_at)
user_progress (user_id, module_id, status, progress_percentage)
```

### Content (Dual Source)
```sql
moodle_courses (id, course_name, source='moodle'|'portal')
moodle_modules (id, moodle_course_id, module_name, source)
moodle_quizzes (id, moodle_module_id, quiz_name, source)
quiz_questions (id, moodle_quiz_id, question_text, options, source)
```

### Quiz Tracking
```sql
quiz_attempts (id, user_id, moodle_quiz_id, score, completed_at)
quiz_answers (id, quiz_attempt_id, question_id, user_answer, is_correct)
```

---

## Monitoring & Debugging

### Check Service Status
```bash
# Docker containers
docker ps

# Application logs
docker logs -f teachers_training-app-1

# PostgreSQL
PGPASSWORD=teachers_pass_2024 psql -h localhost -U teachers_user -d teachers_training -c "SELECT COUNT(*) FROM moodle_courses;"

# ChromaDB
curl http://localhost:8000/api/v1/heartbeat

# Neo4j
# Access browser at http://localhost:7474
```

### Twilio Webhook Debugging
```bash
# Check ngrok tunnel
curl http://localhost:4040/api/tunnels

# Test webhook manually
curl -X POST https://5a7cfbd9994f.ngrok-free.app/webhook/twilio \
  -d "From=whatsapp:+1234567890" \
  -d "To=whatsapp:+14155238886" \
  -d "Body=hello" \
  -d "MessageSid=SM123"
```

---

## Production Checklist

- [ ] Apply for Twilio WhatsApp Business API approval
- [ ] Replace ngrok with production domain
- [ ] Enable Twilio signature validation (`TWILIO_SKIP_VALIDATION=false`)
- [ ] Set strong `JWT_SECRET`
- [ ] Use managed PostgreSQL (not Docker)
- [ ] Set up monitoring (Datadog, New Relic)
- [ ] Configure backups (PostgreSQL, ChromaDB, Neo4j)
- [ ] Add rate limiting to API endpoints
- [ ] Enable HTTPS on all endpoints
- [ ] Store credentials in secrets manager (AWS Secrets Manager, Google Secret Manager)

---

## Troubleshooting

### Issue: "Docker not running"
**Solution**: Start Docker Desktop or Docker daemon

### Issue: "Twilio webhook not receiving messages"
**Solution**:
1. Verify ngrok is running: `curl http://localhost:4040`
2. Check webhook URL in Twilio matches ngrok URL
3. Test with manual curl command

### Issue: "ChromaDB connection failed"
**Solution**:
```bash
docker restart chromadb
docker logs chromadb
```

### Issue: "Moodle sync fails"
**Solution**: Check `MOODLE_TOKEN` has quiz API permissions

---

## Next Steps

1. ✅ Docker containers running
2. ✅ Twilio webhook configured
3. ✅ ngrok tunnel active
4. 🔲 Apply database migration (add source columns)
5. 🔲 Test portal document upload
6. 🔲 Test Moodle course sync
7. 🔲 End-to-end WhatsApp flow test
8. 🔲 Production deployment

---

**Generated**: 2025-10-07
**Ngrok URL**: https://5a7cfbd9994f.ngrok-free.app
**Server Port**: 3000
**WhatsApp Provider**: Twilio
