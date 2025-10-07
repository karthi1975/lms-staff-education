# Quick Start Guide

## System Status
✅ **Docker & Ngrok**: Running
- App: http://localhost:3000
- Webhook: https://9c3008b6d5c7.ngrok-free.app
- PostgreSQL: localhost:5432
- Neo4j: localhost:7687
- ChromaDB: localhost:8000

## Test the Complete Flow

### 1. Add Test Data to Database

Since Moodle API course listing requires additional permissions, manually add Business Studies:

```bash
docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training << 'EOF'
-- Insert Business Studies course
INSERT INTO moodle_courses (moodle_course_id, course_name, course_code, description)
VALUES (4, 'Business Studies', 'BUS-101', 'Learn business fundamentals and entrepreneurship')
ON CONFLICT (moodle_course_id) DO NOTHING;

-- Insert Entrepreneurship module
INSERT INTO moodle_modules (
  moodle_course_id, moodle_module_id, module_name, module_type, sequence_order
)
VALUES (4, 101, 'Entrepreneurship & Business Ideas', 'page', 1)
ON CONFLICT (moodle_course_id, moodle_module_id) DO NOTHING;

-- Get the module ID
WITH mod AS (
  SELECT id FROM moodle_modules WHERE moodle_module_id = 101
)
-- Insert quiz
INSERT INTO moodle_quizzes (
  moodle_quiz_id, moodle_module_id, quiz_name, quiz_intro, grade_to_pass
)
SELECT 4, id, 'Entrepreneurship Quiz', 'Test your knowledge!', 7.0
FROM mod
ON CONFLICT (moodle_quiz_id) DO NOTHING;

-- Add sample content chunks for RAG
WITH mod AS (SELECT id FROM moodle_modules WHERE moodle_module_id = 101)
INSERT INTO module_content_chunks (
  moodle_module_id, chunk_text, chunk_order, chunk_size, embedding_id
)
SELECT
  mod.id,
  'Entrepreneurship is the process of starting and managing a new business venture. Entrepreneurs identify opportunities, take risks, and create value by introducing innovative products or services to the market.',
  0,
  200,
  'bus_entrepreneurship_chunk_0'
FROM mod
ON CONFLICT DO NOTHING;

-- Add sample quiz question
WITH quiz AS (SELECT id FROM moodle_quizzes WHERE moodle_quiz_id = 4),
     mod AS (SELECT id FROM moodle_modules WHERE moodle_module_id = 101)
INSERT INTO quiz_questions (
  module_id, moodle_quiz_id, moodle_question_id,
  question_text, question_type, options, sequence_order
)
SELECT
  mod.id,
  quiz.id,
  1,
  'What is the primary role of an entrepreneur?',
  'multichoice',
  '["Employee", "Facilitator", "Innovator", "Consumer"]'::jsonb,
  1
FROM quiz, mod
ON CONFLICT DO NOTHING;

SELECT 'Test data added successfully!' as status;
EOF
```

### 2. Test WhatsApp Flow

Send messages to your WhatsApp number (configured in .env):

```
User: hi
→ Bot shows course list (Business Studies)

User: 1  (or select from list)
→ Bot shows module list (Entrepreneurship)

User: 1  (or select from list)
→ Bot confirms module start, offers to chat

User: What is entrepreneurship?
→ Bot responds with RAG-powered answer from ChromaDB

User: quiz please
→ Bot starts quiz with 5 questions

User: C
→ Bot records answer, shows next question

[Continue answering...]

→ Bot completes quiz, syncs to Moodle, shows grade
```

### 3. Verify Moodle Sync

Check Moodle:
1. Log into https://karthitest.moodlecloud.com
2. Navigate to Business Studies course
3. View Quiz attempts
4. Verify attempt was created with correct answers

Check local database:
```sql
-- Check latest quiz attempt
SELECT
  qa.*,
  qa.metadata->>'moodle_attempt_id' as moodle_attempt_id,
  qa.metadata->>'moodle_grade' as moodle_grade
FROM quiz_attempts qa
ORDER BY attempted_at DESC
LIMIT 1;

-- Check conversation context
SELECT
  cc.conversation_state,
  cc.context_data,
  mc.course_name,
  mm.module_name
FROM conversation_context cc
LEFT JOIN moodle_courses mc ON cc.current_course_id = mc.id
LEFT JOIN moodle_modules mm ON cc.current_module_id = mm.id;
```

## Testing Individual Components

### Test Moodle API Connection
```bash
node -e "
const moodleContent = require('./services/moodle-content.service');
moodleContent.moodleApiCall('mod_quiz_view_quiz', {quizid: 4})
  .then(r => console.log('✅ Moodle API works:', r))
  .catch(e => console.error('❌ Error:', e.message));
"
```

### Test ChromaDB RAG
```bash
node -e "
const chromaService = require('./services/chroma.service');
chromaService.initialize().then(() => {
  return chromaService.searchSimilar('What is entrepreneurship?', {nResults: 3});
}).then(results => {
  console.log('✅ RAG results:', results.length, 'chunks found');
  results.forEach((r, i) => console.log(i+1 + ':', r.content.substring(0, 100)));
}).catch(e => console.error('❌ Error:', e));
"
```

### Test Neo4j Graph
```bash
node -e "
const neo4jService = require('./services/neo4j.service');
neo4jService.initialize().then(() => {
  return neo4jService.runQuery(
    'MATCH (c:Course)-[:HAS_MODULE]->(m:Module) RETURN c.name, m.name LIMIT 5'
  );
}).then(result => {
  console.log('✅ Neo4j graph:', result);
}).catch(e => console.error('❌ Error:', e));
"
```

## Troubleshooting

### Docker not running
```bash
docker-compose up -d
docker-compose ps  # Verify all 4 containers healthy
```

### Ngrok tunnel expired
```bash
# Find ngrok process
pgrep -f ngrok

# If not running, restart
ngrok http 3000
```

### Database connection errors
```bash
# Check PostgreSQL
docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "SELECT COUNT(*) FROM moodle_courses;"

# Check Neo4j
docker exec teachers_training-neo4j-1 cypher-shell -u neo4j -p teachers123 "MATCH (n) RETURN count(n);"

# Check ChromaDB
curl http://localhost:8000/api/v1/collections
```

### Moodle sync failing
1. Check `MOODLE_SYNC_ENABLED=true` in `.env`
2. Verify Moodle token: `echo $MOODLE_TOKEN`
3. Check quiz ID exists in Moodle
4. Review logs: `docker logs teachers_training-app-1 | grep -i moodle`

### RAG not returning results
1. Verify ChromaDB has data:
   ```bash
   curl http://localhost:8000/api/v1/collections/teachers_training_content | jq
   ```
2. Check content chunks in PostgreSQL:
   ```sql
   SELECT COUNT(*) FROM module_content_chunks;
   ```
3. Try re-embedding content (if using import script)

## Monitoring

### Watch logs in real-time
```bash
# All services
docker-compose logs -f

# Just app
docker logs -f teachers_training-app-1

# Filter for WhatsApp
docker logs -f teachers_training-app-1 | grep -i whatsapp

# Filter for quiz sync
docker logs -f teachers_training-app-1 | grep -i "quiz\|moodle"
```

### Check system health
```bash
curl http://localhost:3000/health
```

## Key Files Reference

**Services**:
- `services/moodle-orchestrator.service.js` - Main flow orchestration
- `services/moodle-content.service.js` - Moodle API integration
- `services/moodle-sync.service.js` - Quiz attempt creation
- `services/chroma.service.js` - RAG/vector search
- `services/neo4j.service.js` - Learning graph
- `services/whatsapp-handler.service.js` - WhatsApp message handling

**Scripts**:
- `scripts/import-moodle-course.js` - Course import automation
- `server.js` - Express app & webhook

**Database**:
- `database/migration_003_simplified_moodle.sql` - Schema

**Docs**:
- `IMPLEMENTATION_SUMMARY.md` - Full implementation details
- `QUICK_START.md` - This file

---

🎉 **Ready to test!** Start with "hi" in WhatsApp.
