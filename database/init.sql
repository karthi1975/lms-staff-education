-- Teachers Training System Database Initialization
-- PostgreSQL 15+

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'instructor', 'viewer');

-- Create update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================
-- ADMIN USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role user_role DEFAULT 'viewer',
    ldap_dn VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_admin_email ON admin_users(email);

CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- WHATSAPP USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    whatsapp_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,
    current_module_id INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB
);

CREATE INDEX idx_users_whatsapp ON users(whatsapp_id);
CREATE INDEX idx_users_active ON users(is_active, last_active_at);
CREATE INDEX idx_users_metadata ON users USING GIN(metadata);

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    whatsapp_id VARCHAR(20) NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    context JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_sessions_user ON sessions(user_id, is_active);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);

-- ============================================================
-- QUIZ ATTEMPTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id INTEGER NOT NULL,
    attempt_number INTEGER NOT NULL,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    passed BOOLEAN NOT NULL,
    answers JSONB,
    attempted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quiz_user_module ON quiz_attempts(user_id, module_id);

-- ============================================================
-- COACHING EVENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS coaching_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    trigger_reason VARCHAR(100),
    message_sent TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX idx_coaching_user ON coaching_events(user_id, sent_at);

-- ============================================================
-- MODULES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS modules (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    sequence_order INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_modules_sequence ON modules(sequence_order);

CREATE TRIGGER update_modules_updated_at
    BEFORE UPDATE ON modules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- MODULE CONTENT TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS module_content (
    id SERIAL PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    content_text TEXT,
    chunk_count INTEGER DEFAULT 0,
    uploaded_by INTEGER REFERENCES admin_users(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    metadata JSONB
);

CREATE INDEX idx_content_module ON module_content(module_id);
CREATE INDEX idx_content_processed ON module_content(processed);

-- ============================================================
-- USER PROGRESS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS user_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'not_started', -- not_started, in_progress, completed
    progress_percentage INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    time_spent_minutes INTEGER DEFAULT 0,
    last_activity_at TIMESTAMPTZ,
    evidence_submitted JSONB,
    UNIQUE(user_id, module_id)
);

CREATE INDEX idx_progress_user ON user_progress(user_id);
CREATE INDEX idx_progress_module ON user_progress(module_id);
CREATE INDEX idx_progress_status ON user_progress(status);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Insert admin users with bcrypt hashed passwords
-- Password for all test users: "Admin123!"
-- Hash: $2b$10$rZ5fGYZ0xZ5fGYZ0xZ5fGu7XZJ8YZ0xZ5fGYZ0xZ5fGYZ0xZ5fGYZ0

INSERT INTO admin_users (email, password_hash, name, role) VALUES
('admin@school.edu', '$2b$10$rZ5fGYZ0xZ5fGYZ0xZ5fGu7XZJ8YZ0xZ5fGYZ0xZ5fGYZ0xZ5fGYZ0', 'System Admin', 'admin'),
('principal@lincoln.edu', '$2b$10$rZ5fGYZ0xZ5fGYZ0xZ5fGu7XZJ8YZ0xZ5fGYZ0xZ5fGYZ0xZ5fGYZ0', 'Dr. Margaret Anderson', 'admin'),
('coordinator@district.edu', '$2b$10$rZ5fGYZ0xZ5fGYZ0xZ5fGu7XZJ8YZ0xZ5fGYZ0xZ5fGYZ0xZ5fGYZ0', 'John Williams', 'instructor'),
('supervisor@training.edu', '$2b$10$rZ5fGYZ0xZ5fGYZ0xZ5fGu7XZJ8YZ0xZ5fGYZ0xZ5fGYZ0xZ5fGYZ0', 'Lisa Chen', 'admin'),
('instructor1@school.edu', '$2b$10$rZ5fGYZ0xZ5fGYZ0xZ5fGu7XZJ8YZ0xZ5fGYZ0xZ5fGYZ0xZ5fGYZ0', 'Robert Johnson', 'instructor'),
('instructor2@school.edu', '$2b$10$rZ5fGYZ0xZ5fGYZ0xZ5fGu7XZJ8YZ0xZ5fGYZ0xZ5fGYZ0xZ5fGYZ0', 'Sarah Miller', 'instructor'),
('viewer@district.edu', '$2b$10$rZ5fGYZ0xZ5fGYZ0xZ5fGu7XZJ8YZ0xZ5fGYZ0xZ5fGYZ0xZ5fGYZ0', 'James Thompson', 'viewer'),
('qa_lead@training.edu', '$2b$10$rZ5fGYZ0xZ5fGYZ0xZ5fGu7XZJ8YZ0xZ5fGYZ0xZ5fGYZ0xZ5fGYZ0', 'Emily Davis', 'admin'),
('support@school.edu', '$2b$10$rZ5fGYZ0xZ5fGYZ0xZ5fGu7XZJ8YZ0xZ5fGYZ0xZ5fGYZ0xZ5fGYZ0', 'Michael Brown', 'viewer')
ON CONFLICT (email) DO NOTHING;

-- Insert modules
INSERT INTO modules (title, description, sequence_order) VALUES
('Introduction to Teaching', 'Foundational concepts and principles of effective teaching', 1),
('Classroom Management', 'Strategies for creating and maintaining positive learning environments', 2),
('Lesson Planning', 'Designing effective, engaging, and standards-aligned lessons', 3),
('Assessment Strategies', 'Formative and summative assessment techniques', 4),
('Technology in Education', 'Integrating educational technology effectively', 5)
ON CONFLICT DO NOTHING;

-- Insert sample WhatsApp users
INSERT INTO users (whatsapp_id, name, current_module_id) VALUES
('+1234567890', 'John Teacher', 1),
('+0987654321', 'Jane Educator', 2),
('+14155551234', 'Sarah Johnson', 3),
('+14155551235', 'Michael Chen', 2),
('+14155551236', 'Emily Rodriguez', 4),
('+14155551237', 'David Kim', 1),
('+14155551238', 'Maria Garcia', 2),
('+14155551239', 'James Wilson', 3)
ON CONFLICT (whatsapp_id) DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO teachers_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO teachers_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO teachers_user;
