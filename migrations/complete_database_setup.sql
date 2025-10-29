-- ============================================================
-- COMPLETE DATABASE SETUP FOR TEACHERS TRAINING SYSTEM
-- This migration creates all necessary tables in the correct order
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'instructor', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 1. USERS TABLE (Base table)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    whatsapp_id VARCHAR(50) UNIQUE,
    phone_number VARCHAR(50),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    current_module_id INTEGER,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_whatsapp ON users(whatsapp_id);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- ============================================================
-- 2. ADMIN USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. COURSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(100),
    difficulty_level VARCHAR(50) DEFAULT 'beginner',
    duration_weeks INTEGER,
    sequence_order INTEGER,
    moodle_course_id INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code);
CREATE INDEX IF NOT EXISTS idx_courses_active ON courses(is_active);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. MODULES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS modules (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    sequence_order INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_modules_course ON modules(course_id);
CREATE INDEX IF NOT EXISTS idx_modules_sequence ON modules(course_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_modules_active ON modules(is_active);

CREATE TRIGGER update_modules_updated_at BEFORE UPDATE ON modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. COURSE_CONTENT TABLE (File uploads)
-- ============================================================
CREATE TABLE IF NOT EXISTS course_content (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    file_name VARCHAR(500) NOT NULL,
    original_name VARCHAR(500) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    uploaded_by INTEGER REFERENCES admin_users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE,
    processing_status VARCHAR(50) DEFAULT 'uploaded',
    processed_at TIMESTAMP WITH TIME ZONE,
    chunk_count INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_content_course_id ON course_content(course_id);
CREATE INDEX IF NOT EXISTS idx_course_content_processed ON course_content(processed);
CREATE INDEX IF NOT EXISTS idx_course_content_status ON course_content(processing_status);
CREATE INDEX IF NOT EXISTS idx_course_content_uploaded_at ON course_content(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_content_metadata ON course_content USING GIN (metadata);

COMMENT ON TABLE course_content IS 'Module-independent file storage for RAG+Graph DB indexing';

-- ============================================================
-- 6. QUIZZES TABLE (Optional per module)
-- ============================================================
CREATE TABLE IF NOT EXISTS quizzes (
    id SERIAL PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    pass_threshold INTEGER DEFAULT 70,
    max_attempts INTEGER DEFAULT 2,
    time_limit_minutes INTEGER,
    shuffle_questions BOOLEAN DEFAULT TRUE,
    shuffle_options BOOLEAN DEFAULT TRUE,
    show_correct_answers BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    is_optional BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(module_id)
);

CREATE INDEX IF NOT EXISTS idx_quizzes_module ON quizzes(module_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_active ON quizzes(is_active);

CREATE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON quizzes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 7. QUIZ_QUESTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_questions (
    id SERIAL PRIMARY KEY,
    module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
    quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    difficulty VARCHAR(20) DEFAULT 'medium',
    sequence_order INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_module ON quiz_questions(module_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id);

CREATE TRIGGER update_quiz_questions_updated_at BEFORE UPDATE ON quiz_questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 8. COURSE_ENROLLMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS course_enrollments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    progress_percentage INTEGER DEFAULT 0,
    current_module_id INTEGER REFERENCES modules(id),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user ON course_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_active ON course_enrollments(is_active);

-- ============================================================
-- 9. USER_PROGRESS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS user_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'not_started',
    progress_percentage INTEGER DEFAULT 0,
    quiz_taken BOOLEAN DEFAULT FALSE,
    quiz_passed BOOLEAN,
    quiz_score INTEGER,
    quiz_attempts_count INTEGER DEFAULT 0,
    completed_without_quiz BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_module ON user_progress(module_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_status ON user_progress(status);

-- ============================================================
-- 10. QUIZ_ATTEMPTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    quiz_id INTEGER REFERENCES quizzes(id) ON DELETE SET NULL,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    passed BOOLEAN NOT NULL,
    answers JSONB,
    time_spent_seconds INTEGER,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_module ON quiz_attempts(module_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);

-- ============================================================
-- 11. CHAT_SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id INTEGER REFERENCES modules(id) ON DELETE SET NULL,
    course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    message_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_module ON chat_sessions(module_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_active ON chat_sessions(is_active);

-- ============================================================
-- 12. CHAT_MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_role VARCHAR(20) NOT NULL,
    message_content TEXT NOT NULL,
    module_id INTEGER REFERENCES modules(id) ON DELETE SET NULL,
    context_sources JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);

-- ============================================================
-- 13. WHATSAPP_MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    whatsapp_id VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    message_content TEXT,
    twilio_message_sid VARCHAR(100),
    status VARCHAR(20),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user ON whatsapp_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_whatsapp_id ON whatsapp_messages(whatsapp_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON whatsapp_messages(created_at DESC);

-- ============================================================
-- 14. VERIFICATION_CODES TABLE (PIN enrollment)
-- ============================================================
CREATE TABLE IF NOT EXISTS verification_codes (
    id SERIAL PRIMARY KEY,
    whatsapp_id VARCHAR(20) NOT NULL,
    name VARCHAR(100),
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP WITH TIME ZONE,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_whatsapp ON verification_codes(whatsapp_id);
CREATE INDEX IF NOT EXISTS idx_verification_code ON verification_codes(code);

-- ============================================================
-- 15. SYSTEM_EVENTS TABLE (Logging)
-- ============================================================
CREATE TABLE IF NOT EXISTS system_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    admin_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_created ON system_events(created_at DESC);

-- ============================================================
-- 16. CONTENT_MODERATION_LOG TABLE (Security)
-- ============================================================
CREATE TABLE IF NOT EXISTS content_moderation_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    phone VARCHAR(50),
    message TEXT NOT NULL,
    blocked BOOLEAN NOT NULL,
    reason VARCHAR(100),
    severity VARCHAR(20),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_log_user ON content_moderation_log(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_log_blocked ON content_moderation_log(blocked);
CREATE INDEX IF NOT EXISTS idx_moderation_log_created ON content_moderation_log(created_at DESC);

-- ============================================================
-- 17. PROMPT_INJECTION_LOG TABLE (Security)
-- ============================================================
CREATE TABLE IF NOT EXISTS prompt_injection_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    phone VARCHAR(50),
    original_message TEXT NOT NULL,
    pattern VARCHAR(100),
    severity VARCHAR(20),
    blocked BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_injection_log_user ON prompt_injection_log(user_id);
CREATE INDEX IF NOT EXISTS idx_injection_log_created ON prompt_injection_log(created_at DESC);

-- ============================================================
-- 18. COACHING_NUDGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS coaching_nudges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nudge_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered BOOLEAN DEFAULT FALSE,
    opened BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_coaching_nudges_user ON coaching_nudges(user_id);
CREATE INDEX IF NOT EXISTS idx_coaching_nudges_type ON coaching_nudges(nudge_type);
CREATE INDEX IF NOT EXISTS idx_coaching_nudges_sent ON coaching_nudges(sent_at DESC);

-- ============================================================
-- SEED DEFAULT ADMIN USER
-- ============================================================
DO $$
DECLARE
    admin_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_count FROM admin_users WHERE email = 'admin@school.edu';

    IF admin_count = 0 THEN
        INSERT INTO admin_users (email, password_hash, name, role, is_active)
        VALUES (
            'admin@school.edu',
            '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', -- Admin123!
            'Admin User',
            'admin',
            TRUE
        );
        RAISE NOTICE '✅ Default admin user created: admin@school.edu / Admin123!';
    END IF;
END $$;

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO teachers_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO teachers_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO teachers_user;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE '✅ COMPLETE DATABASE SETUP SUCCESSFUL!';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '📊 Tables Created:';
    RAISE NOTICE '   - users, admin_users, courses, modules';
    RAISE NOTICE '   - course_content (file uploads)';
    RAISE NOTICE '   - quizzes, quiz_questions, quiz_attempts';
    RAISE NOTICE '   - course_enrollments, user_progress';
    RAISE NOTICE '   - chat_sessions, chat_messages';
    RAISE NOTICE '   - whatsapp_messages, verification_codes';
    RAISE NOTICE '   - system_events, content_moderation_log';
    RAISE NOTICE '   - prompt_injection_log, coaching_nudges';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '🔐 Default Admin: admin@school.edu / Admin123!';
    RAISE NOTICE '============================================================';
END $$;
