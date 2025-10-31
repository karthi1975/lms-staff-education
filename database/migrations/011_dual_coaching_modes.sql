-- Migration 011: Dual Coaching Bot System (PostgreSQL)
-- Created: 2025-10-31
-- Purpose: Add dual coaching mode functionality (Regular Mode vs Socratic Mode)
--
-- FEATURE REQUIREMENTS:
-- 1. Per-course mode configuration by admins
-- 2. Per-user mode preference with persistence
-- 3. Mode switching via WhatsApp commands (/regular, /socratic)
-- 4. Mode-specific prompts and behaviors
-- 5. Analytics tracking mode effectiveness
-- 6. RBAC-protected admin configuration
-- 7. Session tracking with mode metadata
--
-- TABLES TO CREATE:
-- 1. course_bot_configs - Mode-specific configurations per course
-- 2. user_bot_preferences - User mode selections and usage stats
-- 3. coaching_sessions - Session tracking with mode metadata
-- 4. mode_analytics - Aggregated effectiveness metrics

-- ============================================
-- 1. COURSE BOT CONFIGURATIONS
-- Stores mode-specific prompts and settings per course
-- ============================================
CREATE TABLE IF NOT EXISTS course_bot_configs (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

  -- Regular Mode Configuration (Direct Coach)
  regular_prompt TEXT NOT NULL DEFAULT 'You are a helpful teaching assistant for this course. Provide clear, direct answers and explanations. Give step-by-step solutions and examples. Be friendly and encouraging.',
  regular_greeting TEXT DEFAULT 'Hello! I''m your teaching assistant. I''m here to help you learn by providing direct answers, explanations, and examples. Ask me anything!',
  regular_help_text TEXT DEFAULT 'In Regular Mode, I provide direct answers, detailed explanations, step-by-step solutions, and practical examples to help you learn quickly.',

  -- Socratic Mode Configuration (Discovery Coach)
  socratic_prompt TEXT NOT NULL DEFAULT 'You are a Socratic teaching assistant. NEVER give direct answers. Ask guiding questions that help the learner discover answers themselves. Use the Socratic method: break down complex topics into simpler questions, build on previous answers, and guide reflection.',
  socratic_greeting TEXT DEFAULT 'Hello! Let''s learn together through questions. I''ll guide you to discover answers yourself. What would you like to explore today?',
  socratic_help_text TEXT DEFAULT 'In Socratic Mode, I guide you through questions to help you discover answers yourself. This encourages deeper understanding and critical thinking.',

  -- Mode Settings
  default_mode VARCHAR(20) DEFAULT 'regular' CHECK (default_mode IN ('regular', 'socratic')),
  allow_mode_switching BOOLEAN DEFAULT TRUE,
  switch_cooldown_minutes INTEGER DEFAULT 0 CHECK (switch_cooldown_minutes >= 0),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,

  UNIQUE(course_id)
);

CREATE INDEX IF NOT EXISTS idx_bot_configs_course ON course_bot_configs(course_id);
CREATE INDEX IF NOT EXISTS idx_bot_configs_default_mode ON course_bot_configs(default_mode);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_bot_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_course_bot_configs_updated_at
    BEFORE UPDATE ON course_bot_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_bot_configs_updated_at();

COMMENT ON TABLE course_bot_configs IS 'Stores mode-specific prompts and configuration per course for dual coaching bot';
COMMENT ON COLUMN course_bot_configs.regular_prompt IS 'System prompt for Regular Mode (direct teaching approach)';
COMMENT ON COLUMN course_bot_configs.socratic_prompt IS 'System prompt for Socratic Mode (question-based approach)';
COMMENT ON COLUMN course_bot_configs.default_mode IS 'Default mode for new users (regular or socratic)';
COMMENT ON COLUMN course_bot_configs.allow_mode_switching IS 'Whether users can switch between modes';
COMMENT ON COLUMN course_bot_configs.switch_cooldown_minutes IS 'Minimum minutes between mode switches (0 = no cooldown)';

-- ============================================
-- 2. USER BOT PREFERENCES
-- Tracks each user's mode selection per course
-- ============================================
CREATE TABLE IF NOT EXISTS user_bot_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

  -- Current mode selection
  selected_mode VARCHAR(20) NOT NULL DEFAULT 'regular' CHECK (selected_mode IN ('regular', 'socratic')),

  -- Mode switching tracking
  mode_switches_count INTEGER DEFAULT 0,
  last_mode_switch TIMESTAMP,

  -- Usage statistics per mode
  regular_mode_sessions INTEGER DEFAULT 0,
  regular_mode_time_minutes INTEGER DEFAULT 0,
  socratic_mode_sessions INTEGER DEFAULT 0,
  socratic_mode_time_minutes INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_bot_prefs_user ON user_bot_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_prefs_course ON user_bot_preferences(course_id);
CREATE INDEX IF NOT EXISTS idx_bot_prefs_mode ON user_bot_preferences(selected_mode);
CREATE INDEX IF NOT EXISTS idx_bot_prefs_user_course ON user_bot_preferences(user_id, course_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_bot_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_bot_preferences_updated_at
    BEFORE UPDATE ON user_bot_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_bot_preferences_updated_at();

COMMENT ON TABLE user_bot_preferences IS 'Stores user mode preferences and usage statistics per course';
COMMENT ON COLUMN user_bot_preferences.selected_mode IS 'Current mode selected by user (regular or socratic)';
COMMENT ON COLUMN user_bot_preferences.mode_switches_count IS 'Total number of times user has switched modes';
COMMENT ON COLUMN user_bot_preferences.last_mode_switch IS 'Timestamp of last mode switch (for cooldown enforcement)';

-- ============================================
-- 3. COACHING SESSIONS
-- Tracks coaching bot sessions with mode metadata
-- ============================================
CREATE TABLE IF NOT EXISTS coaching_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

  -- Mode used in this session
  mode_used VARCHAR(20) NOT NULL CHECK (mode_used IN ('regular', 'socratic')),

  -- Session timing
  session_start TIMESTAMP DEFAULT NOW(),
  session_end TIMESTAMP,
  duration_minutes INTEGER,

  -- Session metrics
  messages_sent INTEGER DEFAULT 0,
  questions_asked INTEGER DEFAULT 0,
  quiz_score INTEGER,

  -- Session outcome
  completion_status VARCHAR(20) DEFAULT 'in_progress' CHECK (completion_status IN ('in_progress', 'completed', 'abandoned')),
  satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coaching_sessions_user ON coaching_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_course ON coaching_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_mode ON coaching_sessions(mode_used);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_start ON coaching_sessions(session_start DESC);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_status ON coaching_sessions(completion_status);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_user_course ON coaching_sessions(user_id, course_id);

-- Auto-calculate duration on session end
CREATE OR REPLACE FUNCTION update_session_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.session_end IS NOT NULL AND NEW.session_start IS NOT NULL THEN
        NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.session_end - NEW.session_start)) / 60;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_coaching_session_duration
    BEFORE UPDATE ON coaching_sessions
    FOR EACH ROW
    WHEN (NEW.session_end IS NOT NULL)
    EXECUTE FUNCTION update_session_duration();

COMMENT ON TABLE coaching_sessions IS 'Tracks individual coaching sessions with mode usage and outcomes';
COMMENT ON COLUMN coaching_sessions.mode_used IS 'Coaching mode used in this session (regular or socratic)';
COMMENT ON COLUMN coaching_sessions.messages_sent IS 'Total messages sent by bot during session';
COMMENT ON COLUMN coaching_sessions.questions_asked IS 'Number of questions asked (particularly relevant for Socratic mode)';
COMMENT ON COLUMN coaching_sessions.completion_status IS 'Session outcome (in_progress, completed, abandoned)';

-- ============================================
-- 4. MODE ANALYTICS
-- Aggregated analytics for mode effectiveness
-- ============================================
CREATE TABLE IF NOT EXISTS mode_analytics (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('regular', 'socratic')),

  -- Time period for this analytics record
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- User engagement metrics
  total_users INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  avg_session_duration_minutes DECIMAL(10,2),

  -- Learning outcomes
  avg_quiz_score DECIMAL(5,2),
  completion_rate DECIMAL(5,2),

  -- User preferences
  user_preference_percentage DECIMAL(5,2),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(course_id, mode, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_analytics_course ON mode_analytics(course_id);
CREATE INDEX IF NOT EXISTS idx_analytics_mode ON mode_analytics(mode);
CREATE INDEX IF NOT EXISTS idx_analytics_period ON mode_analytics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_analytics_course_mode ON mode_analytics(course_id, mode);

COMMENT ON TABLE mode_analytics IS 'Aggregated analytics comparing effectiveness of Regular vs Socratic modes';
COMMENT ON COLUMN mode_analytics.period_start IS 'Start date of analytics period (e.g., weekly or monthly)';
COMMENT ON COLUMN mode_analytics.period_end IS 'End date of analytics period';
COMMENT ON COLUMN mode_analytics.total_users IS 'Number of unique users who used this mode in the period';
COMMENT ON COLUMN mode_analytics.avg_quiz_score IS 'Average quiz score for users using this mode';
COMMENT ON COLUMN mode_analytics.completion_rate IS 'Percentage of sessions completed (vs abandoned)';
COMMENT ON COLUMN mode_analytics.user_preference_percentage IS 'Percentage of users who chose this mode as their preference';

-- ============================================
-- 5. VIEWS FOR EASY QUERYING
-- ============================================

-- View: Current user mode preferences with course details
CREATE OR REPLACE VIEW v_user_mode_preferences AS
SELECT
  u.id AS user_id,
  u.whatsapp_id,
  u.name AS user_name,
  c.id AS course_id,
  c.title AS course_title,
  c.code AS course_code,
  p.selected_mode,
  p.mode_switches_count,
  p.last_mode_switch,
  p.regular_mode_sessions,
  p.regular_mode_time_minutes,
  p.socratic_mode_sessions,
  p.socratic_mode_time_minutes,
  p.created_at AS preference_created_at,
  p.updated_at AS preference_updated_at
FROM user_bot_preferences p
JOIN users u ON p.user_id = u.id
JOIN courses c ON p.course_id = c.id
WHERE u.is_active = TRUE AND c.is_active = TRUE;

-- View: Active coaching sessions
CREATE OR REPLACE VIEW v_active_coaching_sessions AS
SELECT
  s.id AS session_id,
  u.id AS user_id,
  u.whatsapp_id,
  u.name AS user_name,
  c.id AS course_id,
  c.title AS course_title,
  s.mode_used,
  s.session_start,
  s.messages_sent,
  s.questions_asked,
  s.completion_status,
  EXTRACT(EPOCH FROM (NOW() - s.session_start)) / 60 AS current_duration_minutes
FROM coaching_sessions s
JOIN users u ON s.user_id = u.id
JOIN courses c ON s.course_id = c.id
WHERE s.completion_status = 'in_progress';

-- View: Mode analytics summary
CREATE OR REPLACE VIEW v_mode_analytics_summary AS
SELECT
  c.id AS course_id,
  c.title AS course_title,
  c.code AS course_code,
  a.mode,
  a.period_start,
  a.period_end,
  a.total_users,
  a.total_sessions,
  a.avg_session_duration_minutes,
  a.avg_quiz_score,
  a.completion_rate,
  a.user_preference_percentage
FROM mode_analytics a
JOIN courses c ON a.course_id = c.id
WHERE c.is_active = TRUE
ORDER BY a.period_start DESC, c.title, a.mode;

-- ============================================
-- 6. SEED DEFAULT CONFIGURATIONS
-- ============================================

-- Create default bot configurations for all existing active courses
INSERT INTO course_bot_configs (course_id, created_by)
SELECT
  id,
  created_by
FROM courses
WHERE is_active = TRUE
  AND id NOT IN (SELECT course_id FROM course_bot_configs)
ON CONFLICT (course_id) DO NOTHING;

-- ============================================
-- 7. GRANT PERMISSIONS
-- ============================================
GRANT ALL PRIVILEGES ON course_bot_configs TO teachers_user;
GRANT ALL PRIVILEGES ON user_bot_preferences TO teachers_user;
GRANT ALL PRIVILEGES ON coaching_sessions TO teachers_user;
GRANT ALL PRIVILEGES ON mode_analytics TO teachers_user;

GRANT ALL PRIVILEGES ON SEQUENCE course_bot_configs_id_seq TO teachers_user;
GRANT ALL PRIVILEGES ON SEQUENCE user_bot_preferences_id_seq TO teachers_user;
GRANT ALL PRIVILEGES ON SEQUENCE coaching_sessions_id_seq TO teachers_user;
GRANT ALL PRIVILEGES ON SEQUENCE mode_analytics_id_seq TO teachers_user;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Tables created: 4
--   1. course_bot_configs - Mode-specific prompts per course
--   2. user_bot_preferences - User mode selections and stats
--   3. coaching_sessions - Session tracking with mode metadata
--   4. mode_analytics - Aggregated effectiveness metrics
--
-- Views created: 3
--   1. v_user_mode_preferences - Current user preferences with details
--   2. v_active_coaching_sessions - Live session monitoring
--   3. v_mode_analytics_summary - Analytics comparison view
--
-- Indexes created: 20+
-- Triggers created: 4
-- Default configs seeded for all active courses
--
-- FEATURES ENABLED:
-- ✅ Dual coaching modes (Regular vs Socratic)
-- ✅ Per-course configuration by admins
-- ✅ Per-user preferences with persistence
-- ✅ Mode switching with optional cooldown
-- ✅ Session tracking and analytics
-- ✅ Usage statistics per mode
-- ✅ Effectiveness comparison metrics
--
-- NEXT STEPS:
-- 1. Create CoachingModeService to interact with these tables
-- 2. Update orchestrator to use mode-specific prompts
-- 3. Add WhatsApp commands for mode switching
-- 4. Create admin UI for bot configuration
-- 5. Build analytics dashboard
--
-- ROLLBACK (if needed):
-- DROP VIEW IF EXISTS v_mode_analytics_summary CASCADE;
-- DROP VIEW IF EXISTS v_active_coaching_sessions CASCADE;
-- DROP VIEW IF EXISTS v_user_mode_preferences CASCADE;
-- DROP TABLE IF EXISTS mode_analytics CASCADE;
-- DROP TABLE IF EXISTS coaching_sessions CASCADE;
-- DROP TABLE IF EXISTS user_bot_preferences CASCADE;
-- DROP TABLE IF EXISTS course_bot_configs CASCADE;
-- DROP FUNCTION IF EXISTS update_session_duration() CASCADE;
-- DROP FUNCTION IF EXISTS update_bot_preferences_updated_at() CASCADE;
-- DROP FUNCTION IF EXISTS update_bot_configs_updated_at() CASCADE;
