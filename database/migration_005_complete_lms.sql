-- Complete LMS Schema Migration
-- Course → Module → Content → (Optional) Quiz hierarchy
-- Quizzes are OPTIONAL - modules can be completed without taking quizzes
-- Inspired by Google Material Design and modern LMS systems

-- ============================================================
-- QUIZZES TABLE (Optional quiz per module)
-- ============================================================
CREATE TABLE IF NOT EXISTS quizzes (
    id SERIAL PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    pass_threshold INTEGER DEFAULT 70, -- Percentage required to pass (if user chooses to take quiz)
    max_attempts INTEGER DEFAULT 2,
    time_limit_minutes INTEGER, -- NULL means no time limit
    shuffle_questions BOOLEAN DEFAULT TRUE,
    shuffle_options BOOLEAN DEFAULT TRUE,
    show_correct_answers BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    is_optional BOOLEAN DEFAULT TRUE, -- Quizzes are optional by default
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(module_id) -- One quiz per module for simplicity
);

CREATE INDEX idx_quizzes_module ON quizzes(module_id);
CREATE INDEX idx_quizzes_active ON quizzes(is_active);

CREATE TRIGGER update_quizzes_updated_at
    BEFORE UPDATE ON quizzes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE quizzes IS 'Optional quizzes per module - modules can be completed without taking the quiz';
COMMENT ON COLUMN quizzes.is_optional IS 'TRUE = quiz is optional for module completion (default), FALSE = quiz is mandatory';

-- ============================================================
-- UPDATE QUIZ_QUESTIONS TABLE
-- Add foreign key to quizzes table
-- ============================================================
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id);

-- ============================================================
-- VERIFICATION CODES TABLE (WhatsApp verification)
-- ============================================================
CREATE TABLE IF NOT EXISTS verification_codes (
    id SERIAL PRIMARY KEY,
    whatsapp_id VARCHAR(20) NOT NULL,
    name VARCHAR(100),
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_verification_whatsapp ON verification_codes(whatsapp_id);
CREATE INDEX idx_verification_code ON verification_codes(code);
CREATE INDEX idx_verification_expires ON verification_codes(expires_at);

COMMENT ON TABLE verification_codes IS 'WhatsApp verification codes for new user registration';

-- ============================================================
-- WHATSAPP MESSAGES LOG (Track all messages for debugging)
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    whatsapp_id VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL, -- 'inbound' or 'outbound'
    message_type VARCHAR(20) DEFAULT 'text', -- text, image, document, interactive
    message_content TEXT,
    twilio_message_sid VARCHAR(100),
    status VARCHAR(20), -- sent, delivered, read, failed
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_messages_user ON whatsapp_messages(user_id);
CREATE INDEX idx_whatsapp_messages_whatsapp_id ON whatsapp_messages(whatsapp_id);
CREATE INDEX idx_whatsapp_messages_direction ON whatsapp_messages(direction);
CREATE INDEX idx_whatsapp_messages_created ON whatsapp_messages(created_at DESC);

-- ============================================================
-- COURSE ENROLLMENTS (Track which users are enrolled in which courses)
-- ============================================================
CREATE TABLE IF NOT EXISTS course_enrollments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    progress_percentage INTEGER DEFAULT 0,
    current_module_id INTEGER REFERENCES modules(id),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(user_id, course_id)
);

CREATE INDEX idx_enrollments_user ON course_enrollments(user_id);
CREATE INDEX idx_enrollments_course ON course_enrollments(course_id);
CREATE INDEX idx_enrollments_active ON course_enrollments(is_active);

-- ============================================================
-- UPDATE USER_PROGRESS TABLE
-- Add optional quiz tracking (quiz is not required for completion)
-- ============================================================
ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS quiz_taken BOOLEAN DEFAULT FALSE;
ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS quiz_passed BOOLEAN DEFAULT NULL; -- NULL = not taken, TRUE = passed, FALSE = failed
ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS quiz_score INTEGER;
ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS quiz_attempts_count INTEGER DEFAULT 0;
ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS completed_without_quiz BOOLEAN DEFAULT FALSE; -- User completed module without taking quiz

COMMENT ON COLUMN user_progress.quiz_taken IS 'Whether user has attempted the quiz (quiz is optional)';
COMMENT ON COLUMN user_progress.completed_without_quiz IS 'User chose to complete module without taking optional quiz';

-- ============================================================
-- UPDATE QUIZ_ATTEMPTS TABLE
-- Add more detailed tracking
-- ============================================================
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS quiz_id INTEGER REFERENCES quizzes(id) ON DELETE SET NULL;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);

-- ============================================================
-- CHAT SESSIONS TABLE (For context management)
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id INTEGER REFERENCES modules(id) ON DELETE SET NULL,
    course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    message_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_module ON chat_sessions(module_id);
CREATE INDEX idx_chat_sessions_active ON chat_sessions(is_active);

-- ============================================================
-- Ensure chat_messages table exists (from migration 004)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO teachers_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO teachers_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO teachers_user;

-- ============================================================
-- SEED DEFAULT COURSE AND MODULES
-- ============================================================
-- Insert default course (Teacher Training)
INSERT INTO courses (title, code, description, category, difficulty_level, duration_weeks, sequence_order, is_active)
VALUES (
    'Teacher Training Fundamentals',
    'TEACH-001',
    'Comprehensive training program for new and aspiring teachers covering essential pedagogical concepts and classroom management strategies',
    'Teacher Development',
    'beginner',
    10,
    1,
    TRUE
)
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description;

-- Insert modules for the course
WITH course_data AS (
    SELECT id FROM courses WHERE code = 'TEACH-001'
)
INSERT INTO modules (course_id, title, description, sequence_order, is_active)
SELECT
    (SELECT id FROM course_data),
    unnest(ARRAY[
        'Introduction to Teaching',
        'Classroom Management',
        'Lesson Planning',
        'Assessment Strategies',
        'Technology in Education'
    ]),
    unnest(ARRAY[
        'Foundational concepts of effective teaching, learner-centered approaches, and pedagogical content knowledge',
        'Strategies for creating positive learning environments, establishing routines, and managing student behavior effectively',
        'Backward design, learning objectives, instructional strategies, and creating effective lesson plans',
        'Formative and summative assessment, effective feedback, rubrics, and using assessment data to improve instruction',
        'Integrating technology effectively, digital citizenship, SAMR/TPACK frameworks, and using edtech tools purposefully'
    ]),
    unnest(ARRAY[1, 2, 3, 4, 5]),
    TRUE
ON CONFLICT DO NOTHING;

-- Create OPTIONAL quizzes for each module
INSERT INTO quizzes (module_id, title, description, pass_threshold, max_attempts, shuffle_questions, shuffle_options, is_active, is_optional)
SELECT
    m.id,
    CONCAT(m.title, ' - Optional Assessment'),
    CONCAT('Optional quiz covering key concepts from ', m.title, '. You can complete the module without taking this quiz.'),
    70,
    2,
    TRUE,
    TRUE,
    TRUE,
    TRUE -- Quiz is optional
FROM modules m
WHERE m.course_id = (SELECT id FROM courses WHERE code = 'TEACH-001')
ON CONFLICT (module_id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    is_optional = TRUE;

-- Link existing quiz questions to quizzes
UPDATE quiz_questions qq
SET quiz_id = (
    SELECT q.id
    FROM quizzes q
    WHERE q.module_id = qq.module_id
)
WHERE qq.quiz_id IS NULL;

-- ============================================================
-- CREATE VIEWS FOR EASIER QUERYING
-- ============================================================

-- View: User Progress Summary
CREATE OR REPLACE VIEW v_user_progress_summary AS
SELECT
    u.id AS user_id,
    u.name AS user_name,
    u.whatsapp_id,
    ce.course_id,
    c.title AS course_title,
    ce.progress_percentage AS course_progress,
    ce.current_module_id,
    m.title AS current_module_title,
    up.status AS current_module_status,
    up.progress_percentage AS module_progress,
    up.quiz_taken,
    up.quiz_passed,
    up.quiz_score,
    up.quiz_attempts_count,
    up.completed_without_quiz,
    ce.enrolled_at,
    ce.started_at,
    u.last_active_at
FROM users u
LEFT JOIN course_enrollments ce ON u.id = ce.user_id AND ce.is_active = TRUE
LEFT JOIN courses c ON ce.course_id = c.id
LEFT JOIN modules m ON ce.current_module_id = m.id
LEFT JOIN user_progress up ON u.id = up.user_id AND ce.current_module_id = up.module_id
WHERE u.is_active = TRUE;

-- View: Quiz Performance by Module (only for users who took optional quiz)
CREATE OR REPLACE VIEW v_quiz_performance AS
SELECT
    m.id AS module_id,
    m.title AS module_title,
    q.id AS quiz_id,
    q.title AS quiz_title,
    q.is_optional,
    COUNT(DISTINCT qa.user_id) AS unique_users_attempted,
    COUNT(qa.id) AS total_attempts,
    AVG(qa.score::float / qa.total_questions * 100) AS avg_score,
    SUM(CASE WHEN qa.passed THEN 1 ELSE 0 END) AS passed_count,
    SUM(CASE WHEN NOT qa.passed THEN 1 ELSE 0 END) AS failed_count,
    -- Count users who completed module without taking quiz
    (SELECT COUNT(*) FROM user_progress up
     WHERE up.module_id = m.id
     AND up.status = 'completed'
     AND up.completed_without_quiz = TRUE) AS completed_without_quiz_count
FROM modules m
LEFT JOIN quizzes q ON m.id = q.module_id
LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id
WHERE q.is_active = TRUE OR q.is_active IS NULL
GROUP BY m.id, m.title, q.id, q.title, q.is_optional;

-- View: Course Enrollment Statistics
CREATE OR REPLACE VIEW v_course_statistics AS
SELECT
    c.id AS course_id,
    c.title AS course_title,
    c.code AS course_code,
    COUNT(DISTINCT ce.user_id) AS total_enrolled,
    SUM(CASE WHEN ce.completed_at IS NOT NULL THEN 1 ELSE 0 END) AS completed_count,
    SUM(CASE WHEN ce.started_at IS NOT NULL AND ce.completed_at IS NULL THEN 1 ELSE 0 END) AS in_progress_count,
    SUM(CASE WHEN ce.started_at IS NULL THEN 1 ELSE 0 END) AS not_started_count,
    AVG(ce.progress_percentage) AS avg_progress_percentage
FROM courses c
LEFT JOIN course_enrollments ce ON c.id = ce.course_id AND ce.is_active = TRUE
WHERE c.is_active = TRUE
GROUP BY c.id, c.title, c.code;

-- Grant view permissions
GRANT SELECT ON v_user_progress_summary TO teachers_user;
GRANT SELECT ON v_quiz_performance TO teachers_user;
GRANT SELECT ON v_course_statistics TO teachers_user;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 005 completed successfully!';
    RAISE NOTICE '📊 Tables created: quizzes (optional), verification_codes, whatsapp_messages, course_enrollments, chat_sessions';
    RAISE NOTICE '📈 Views created: v_user_progress_summary, v_quiz_performance, v_course_statistics';
    RAISE NOTICE '🎯 Key Feature: Quizzes are OPTIONAL - users can complete modules without taking quizzes';
    RAISE NOTICE '📚 Seeded: Teacher Training Fundamentals course with 5 modules';
END $$;
