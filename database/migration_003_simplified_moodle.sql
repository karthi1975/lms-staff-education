-- Migration 003: Simplified Moodle Integration
-- Simplified flow: Import Moodle → RAG/Graph → "teach me" → "quiz please"

-- ============================================================
-- MOODLE COURSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS moodle_courses (
  id SERIAL PRIMARY KEY,
  moodle_course_id INTEGER NOT NULL UNIQUE,
  course_name VARCHAR(255) NOT NULL,
  course_code VARCHAR(50),
  description TEXT,
  category VARCHAR(100),
  moodle_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_moodle_courses_code ON moodle_courses(course_code);

CREATE TRIGGER update_moodle_courses_updated_at
    BEFORE UPDATE ON moodle_courses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- MOODLE MODULES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS moodle_modules (
  id SERIAL PRIMARY KEY,
  moodle_course_id INTEGER REFERENCES moodle_courses(moodle_course_id) ON DELETE CASCADE,
  moodle_module_id INTEGER NOT NULL,
  module_name VARCHAR(255) NOT NULL,
  module_type VARCHAR(50), -- 'page', 'resource', 'quiz', 'label'
  sequence_order INTEGER,
  content_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(moodle_course_id, moodle_module_id)
);

CREATE INDEX idx_moodle_modules_course ON moodle_modules(moodle_course_id);
CREATE INDEX idx_moodle_modules_type ON moodle_modules(module_type);

CREATE TRIGGER update_moodle_modules_updated_at
    BEFORE UPDATE ON moodle_modules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- MOODLE QUIZZES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS moodle_quizzes (
  id SERIAL PRIMARY KEY,
  moodle_quiz_id INTEGER NOT NULL UNIQUE,
  moodle_module_id INTEGER REFERENCES moodle_modules(id) ON DELETE CASCADE,
  quiz_name VARCHAR(255) NOT NULL,
  quiz_intro TEXT,
  time_limit INTEGER, -- seconds
  attempts_allowed INTEGER,
  grade_to_pass DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_moodle_quizzes_module ON moodle_quizzes(moodle_module_id);

CREATE TRIGGER update_moodle_quizzes_updated_at
    BEFORE UPDATE ON moodle_quizzes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- QUIZ QUESTIONS TABLE (enhanced)
-- ============================================================
-- Add moodle_quiz_id to existing quiz_questions if it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quiz_questions' AND column_name = 'moodle_quiz_id'
  ) THEN
    ALTER TABLE quiz_questions ADD COLUMN moodle_quiz_id INTEGER REFERENCES moodle_quizzes(id) ON DELETE CASCADE;
    CREATE INDEX idx_quiz_questions_moodle ON quiz_questions(moodle_quiz_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quiz_questions' AND column_name = 'moodle_question_id'
  ) THEN
    ALTER TABLE quiz_questions ADD COLUMN moodle_question_id INTEGER;
  END IF;
END $$;

-- ============================================================
-- MODULE CONTENT CHUNKS TABLE (for RAG)
-- ============================================================
CREATE TABLE IF NOT EXISTS module_content_chunks (
  id SERIAL PRIMARY KEY,
  moodle_module_id INTEGER REFERENCES moodle_modules(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_order INTEGER NOT NULL,
  chunk_size INTEGER, -- character count
  metadata JSONB DEFAULT '{}'::jsonb,
  -- Metadata includes: {topic, keywords, difficulty, section}

  embedding_id VARCHAR(255), -- ChromaDB reference
  neo4j_node_id VARCHAR(100), -- Neo4j node reference

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chunks_module ON module_content_chunks(moodle_module_id);
CREATE INDEX idx_chunks_embedding ON module_content_chunks(embedding_id);
CREATE INDEX idx_chunks_metadata ON module_content_chunks USING GIN(metadata);

CREATE TRIGGER update_chunks_updated_at
    BEFORE UPDATE ON module_content_chunks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- CONVERSATION CONTEXT TABLE (simplified)
-- ============================================================
CREATE TABLE IF NOT EXISTS conversation_context (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  whatsapp_phone VARCHAR(50) NOT NULL,

  -- Current learning context
  current_course_id INTEGER REFERENCES moodle_courses(id),
  current_module_id INTEGER REFERENCES moodle_modules(id),

  -- Conversation state
  conversation_state VARCHAR(50) DEFAULT 'idle',
  -- States: 'idle', 'learning', 'quiz_active'

  -- Quiz context (when quiz_active)
  current_quiz_id INTEGER REFERENCES moodle_quizzes(id),
  current_question_index INTEGER DEFAULT 0,
  quiz_answers JSONB DEFAULT '[]'::jsonb,
  quiz_started_at TIMESTAMPTZ,

  -- General context data
  context_data JSONB DEFAULT '{}'::jsonb,
  -- Stores: last_topic, preferences, language, etc.

  -- Session tracking
  session_started_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

CREATE INDEX idx_context_user ON conversation_context(user_id);
CREATE INDEX idx_context_state ON conversation_context(conversation_state);
CREATE INDEX idx_context_last_message ON conversation_context(last_message_at);

CREATE TRIGGER update_conversation_context_updated_at
    BEFORE UPDATE ON conversation_context
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- LEARNING INTERACTIONS TABLE (track Q&A)
-- ============================================================
CREATE TABLE IF NOT EXISTS learning_interactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  moodle_module_id INTEGER REFERENCES moodle_modules(id) ON DELETE CASCADE,

  interaction_type VARCHAR(50) NOT NULL,
  -- Types: 'question', 'answer', 'feedback', 'summary'

  user_message TEXT,
  bot_response TEXT,

  -- RAG metadata
  rag_sources JSONB DEFAULT '[]'::jsonb,
  -- Array of {chunk_id, relevance_score, content_snippet}

  topics_detected JSONB DEFAULT '[]'::jsonb,
  -- Array of detected topics/keywords

  sentiment VARCHAR(20), -- positive, neutral, negative

  interaction_at TIMESTAMPTZ DEFAULT NOW(),
  response_time_ms INTEGER, -- track system performance

  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_interactions_user ON learning_interactions(user_id);
CREATE INDEX idx_interactions_module ON learning_interactions(moodle_module_id);
CREATE INDEX idx_interactions_type ON learning_interactions(interaction_type);
CREATE INDEX idx_interactions_time ON learning_interactions(interaction_at);

-- ============================================================
-- ENHANCE QUIZ_ATTEMPTS TABLE
-- ============================================================
-- Add moodle_quiz_id and moodle_attempt_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quiz_attempts' AND column_name = 'moodle_quiz_id'
  ) THEN
    ALTER TABLE quiz_attempts ADD COLUMN moodle_quiz_id INTEGER REFERENCES moodle_quizzes(id);
    CREATE INDEX idx_quiz_attempts_moodle ON quiz_attempts(moodle_quiz_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quiz_attempts' AND column_name = 'moodle_attempt_id'
  ) THEN
    ALTER TABLE quiz_attempts ADD COLUMN moodle_attempt_id INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quiz_attempts' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE quiz_attempts ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ============================================================
-- ENHANCE USERS TABLE
-- ============================================================
-- Add moodle_user_id and moodle_username if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'moodle_user_id'
  ) THEN
    ALTER TABLE users ADD COLUMN moodle_user_id INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'moodle_username'
  ) THEN
    ALTER TABLE users ADD COLUMN moodle_username VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'preferred_language'
  ) THEN
    ALTER TABLE users ADD COLUMN preferred_language VARCHAR(10) DEFAULT 'en';
  END IF;
END $$;

-- ============================================================
-- VIEWS FOR EASIER QUERYING
-- ============================================================

-- View: User's current learning status
CREATE OR REPLACE VIEW user_learning_status AS
SELECT
  u.id as user_id,
  u.whatsapp_id,
  u.name as user_name,
  cc.conversation_state,
  mc.course_name,
  mm.module_name,
  cc.last_message_at,
  COUNT(DISTINCT li.id) as total_interactions,
  MAX(qa.attempted_at) as last_quiz_attempt
FROM users u
LEFT JOIN conversation_context cc ON u.id = cc.user_id
LEFT JOIN moodle_courses mc ON cc.current_course_id = mc.id
LEFT JOIN moodle_modules mm ON cc.current_module_id = mm.id
LEFT JOIN learning_interactions li ON u.id = li.user_id AND li.moodle_module_id = mm.id
LEFT JOIN quiz_attempts qa ON u.id = qa.user_id AND qa.module_id = mm.id
GROUP BY u.id, u.whatsapp_id, u.name, cc.conversation_state, mc.course_name, mm.module_name, cc.last_message_at;

-- View: Module content summary
CREATE OR REPLACE VIEW module_content_summary AS
SELECT
  mm.id as module_id,
  mm.module_name,
  mc.course_name,
  COUNT(DISTINCT mcc.id) as total_chunks,
  SUM(mcc.chunk_size) as total_content_size,
  COUNT(DISTINCT mq.id) as total_quizzes,
  COUNT(DISTINCT li.user_id) as unique_learners
FROM moodle_modules mm
JOIN moodle_courses mc ON mm.moodle_course_id = mc.moodle_course_id
LEFT JOIN module_content_chunks mcc ON mm.id = mcc.moodle_module_id
LEFT JOIN moodle_quizzes mq ON mm.id = mq.moodle_module_id
LEFT JOIN learning_interactions li ON mm.id = li.moodle_module_id
GROUP BY mm.id, mm.module_name, mc.course_name;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Insert Business Studies course (from your Moodle)
INSERT INTO moodle_courses (moodle_course_id, course_name, course_code, description, category)
VALUES (
  11,
  'Business Studies',
  'BUS-001',
  'Educational platform for Business Studies training',
  'Business Education'
)
ON CONFLICT (moodle_course_id) DO UPDATE
SET course_name = EXCLUDED.course_name,
    course_code = EXCLUDED.course_code,
    updated_at = NOW();

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO teachers_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO teachers_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO teachers_user;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 003: Simplified Moodle Integration completed successfully';
  RAISE NOTICE 'Created tables: moodle_courses, moodle_modules, moodle_quizzes, module_content_chunks, conversation_context, learning_interactions';
  RAISE NOTICE 'Enhanced tables: quiz_attempts, quiz_questions, users';
  RAISE NOTICE 'Created views: user_learning_status, module_content_summary';
END $$;
