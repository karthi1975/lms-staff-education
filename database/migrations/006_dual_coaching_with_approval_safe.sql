-- ============================================================================
-- Migration 006: Dual Coaching Bot with Approval Workflow (SAFE VERSION)
-- ============================================================================
-- This version safely handles partially existing tables
-- Uses ALTER TABLE ADD COLUMN IF NOT EXISTS for safety
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABLE 1: Course Bot Configurations
-- ============================================================================

-- Create table if not exists
CREATE TABLE IF NOT EXISTS course_bot_configs (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(course_id)
);

-- Add missing columns safely
ALTER TABLE course_bot_configs ADD COLUMN IF NOT EXISTS regular_prompt TEXT NOT NULL DEFAULT 'You are a helpful teaching assistant for this course. Provide clear, direct answers with examples and explanations. Help students understand concepts quickly.';
ALTER TABLE course_bot_configs ADD COLUMN IF NOT EXISTS regular_greeting TEXT DEFAULT 'Hello! I''m here to help you learn. Ask me anything!';
ALTER TABLE course_bot_configs ADD COLUMN IF NOT EXISTS regular_help_text TEXT DEFAULT 'I provide direct answers, explanations, and examples.';
ALTER TABLE course_bot_configs ADD COLUMN IF NOT EXISTS regular_version INTEGER DEFAULT 1;
ALTER TABLE course_bot_configs ADD COLUMN IF NOT EXISTS socratic_prompt TEXT NOT NULL DEFAULT 'You are a Socratic teaching assistant. NEVER give direct answers. ONLY ask guiding questions to help students discover answers themselves. Guide through inquiry and critical thinking.';
ALTER TABLE course_bot_configs ADD COLUMN IF NOT EXISTS socratic_greeting TEXT DEFAULT 'Hello! Let''s discover the answers together through questions.';
ALTER TABLE course_bot_configs ADD COLUMN IF NOT EXISTS socratic_help_text TEXT DEFAULT 'I guide you through questions to help you discover answers yourself.';
ALTER TABLE course_bot_configs ADD COLUMN IF NOT EXISTS socratic_version INTEGER DEFAULT 1;
ALTER TABLE course_bot_configs ADD COLUMN IF NOT EXISTS default_mode VARCHAR(20) DEFAULT 'regular';
ALTER TABLE course_bot_configs ADD COLUMN IF NOT EXISTS allow_mode_switching BOOLEAN DEFAULT TRUE;
ALTER TABLE course_bot_configs ADD COLUMN IF NOT EXISTS switch_cooldown_minutes INTEGER DEFAULT 0;
ALTER TABLE course_bot_configs ADD COLUMN IF NOT EXISTS last_approved_at TIMESTAMP;
ALTER TABLE course_bot_configs ADD COLUMN IF NOT EXISTS last_approved_by INTEGER REFERENCES admin_users(id);

-- Add constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_bot_configs_default_mode_check') THEN
    ALTER TABLE course_bot_configs ADD CONSTRAINT course_bot_configs_default_mode_check CHECK (default_mode IN ('regular', 'socratic'));
  END IF;
END$$;

-- ============================================================================
-- TABLE 2: Prompt Change Requests (NEW - Approval Workflow)
-- ============================================================================

CREATE TABLE IF NOT EXISTS prompt_change_requests (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('regular', 'socratic')),
  new_prompt TEXT NOT NULL,
  new_greeting TEXT,
  new_help_text TEXT,
  change_reason TEXT NOT NULL,
  change_description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'archived')),
  requested_by INTEGER NOT NULL REFERENCES admin_users(id),
  requested_at TIMESTAMP DEFAULT NOW(),
  reviewed_by INTEGER REFERENCES admin_users(id),
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  version_number INTEGER NOT NULL DEFAULT 1,
  replaces_version INTEGER,
  activated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- TABLE 3: Prompt Approval History (NEW - Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS prompt_approval_history (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES prompt_change_requests(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  action VARCHAR(20) NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'activated', 'archived')),
  actor_id INTEGER NOT NULL REFERENCES admin_users(id),
  actor_role VARCHAR(20) NOT NULL,
  notes TEXT,
  previous_status VARCHAR(20),
  new_status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- ============================================================================
-- TABLE 4: User Bot Preferences
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_bot_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- Add missing columns safely
ALTER TABLE user_bot_preferences ADD COLUMN IF NOT EXISTS selected_mode VARCHAR(20) DEFAULT 'regular';
ALTER TABLE user_bot_preferences ADD COLUMN IF NOT EXISTS mode_switches_count INTEGER DEFAULT 0;
ALTER TABLE user_bot_preferences ADD COLUMN IF NOT EXISTS last_switched_at TIMESTAMP;
ALTER TABLE user_bot_preferences ADD COLUMN IF NOT EXISTS last_switched_from VARCHAR(20);

-- Add constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_bot_preferences_selected_mode_check') THEN
    ALTER TABLE user_bot_preferences ADD CONSTRAINT user_bot_preferences_selected_mode_check CHECK (selected_mode IN ('regular', 'socratic'));
  END IF;
END$$;

-- ============================================================================
-- TABLE 5: Coaching Sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS coaching_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  session_start TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add missing columns safely
ALTER TABLE coaching_sessions ADD COLUMN IF NOT EXISTS mode_used VARCHAR(20) CHECK (mode_used IN ('regular', 'socratic'));
ALTER TABLE coaching_sessions ADD COLUMN IF NOT EXISTS prompt_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE coaching_sessions ADD COLUMN IF NOT EXISTS session_end TIMESTAMP;
ALTER TABLE coaching_sessions ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;
ALTER TABLE coaching_sessions ADD COLUMN IF NOT EXISTS user_satisfaction SMALLINT CHECK (user_satisfaction BETWEEN 1 AND 5);
ALTER TABLE coaching_sessions ADD COLUMN IF NOT EXISTS mode_switched_during_session BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- TABLE 6: Mode Analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS mode_analytics (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('regular', 'socratic')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(course_id, mode, period_start, period_end)
);

-- Add missing columns safely
ALTER TABLE mode_analytics ADD COLUMN IF NOT EXISTS total_users INTEGER DEFAULT 0;
ALTER TABLE mode_analytics ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0;
ALTER TABLE mode_analytics ADD COLUMN IF NOT EXISTS total_messages INTEGER DEFAULT 0;
ALTER TABLE mode_analytics ADD COLUMN IF NOT EXISTS avg_session_duration_minutes DECIMAL(10,2);
ALTER TABLE mode_analytics ADD COLUMN IF NOT EXISTS avg_quiz_score DECIMAL(5,2);
ALTER TABLE mode_analytics ADD COLUMN IF NOT EXISTS completion_rate DECIMAL(5,2);
ALTER TABLE mode_analytics ADD COLUMN IF NOT EXISTS retention_rate DECIMAL(5,2);
ALTER TABLE mode_analytics ADD COLUMN IF NOT EXISTS avg_satisfaction DECIMAL(3,2);
ALTER TABLE mode_analytics ADD COLUMN IF NOT EXISTS user_preference_percentage DECIMAL(5,2);
ALTER TABLE mode_analytics ADD COLUMN IF NOT EXISTS switch_to_mode_count INTEGER DEFAULT 0;
ALTER TABLE mode_analytics ADD COLUMN IF NOT EXISTS switch_from_mode_count INTEGER DEFAULT 0;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_course_bot_configs_course ON course_bot_configs(course_id);
CREATE INDEX IF NOT EXISTS idx_prompt_requests_course ON prompt_change_requests(course_id);
CREATE INDEX IF NOT EXISTS idx_prompt_requests_status ON prompt_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_prompt_requests_requestor ON prompt_change_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_prompt_requests_reviewer ON prompt_change_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_prompt_history_request ON prompt_approval_history(request_id);
CREATE INDEX IF NOT EXISTS idx_prompt_history_actor ON prompt_approval_history(actor_id);
CREATE INDEX IF NOT EXISTS idx_user_bot_prefs_user_course ON user_bot_preferences(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_user_bot_prefs_mode ON user_bot_preferences(selected_mode);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_user ON coaching_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_course ON coaching_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_mode ON coaching_sessions(mode_used);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_start ON coaching_sessions(session_start);
CREATE INDEX IF NOT EXISTS idx_mode_analytics_course_period ON mode_analytics(course_id, period_start, period_end);

-- ============================================================================
-- TRIGGERS (Drop old ones first to avoid conflicts)
-- ============================================================================

DROP TRIGGER IF EXISTS update_course_bot_configs_updated_at ON course_bot_configs;
DROP TRIGGER IF EXISTS update_prompt_requests_updated_at ON prompt_change_requests;
DROP TRIGGER IF EXISTS update_user_bot_preferences_updated_at ON user_bot_preferences;

-- Function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_course_bot_configs_updated_at
  BEFORE UPDATE ON course_bot_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_requests_updated_at
  BEFORE UPDATE ON prompt_change_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_bot_preferences_updated_at
  BEFORE UPDATE ON user_bot_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS
-- ============================================================================

DROP VIEW IF EXISTS pending_prompt_approvals CASCADE;
CREATE VIEW pending_prompt_approvals AS
SELECT
  pcr.id AS request_id,
  pcr.course_id,
  c.title AS course_title,
  pcr.mode,
  pcr.new_prompt,
  pcr.change_reason,
  pcr.change_description,
  pcr.requested_by,
  au_req.name AS requested_by_name,
  au_req.email AS requested_by_email,
  pcr.requested_at,
  pcr.status,
  LENGTH(pcr.new_prompt) AS prompt_length,
  pcr.version_number
FROM prompt_change_requests pcr
JOIN courses c ON pcr.course_id = c.id
JOIN admin_users au_req ON pcr.requested_by = au_req.id
WHERE pcr.status = 'pending_approval'
ORDER BY pcr.requested_at ASC;

DROP VIEW IF EXISTS active_course_prompts CASCADE;
CREATE VIEW active_course_prompts AS
SELECT
  cbc.course_id,
  c.title AS course_title,
  cbc.regular_prompt,
  cbc.regular_version,
  cbc.socratic_prompt,
  cbc.socratic_version,
  cbc.default_mode,
  cbc.allow_mode_switching,
  cbc.last_approved_at,
  au.name AS last_approved_by_name
FROM course_bot_configs cbc
JOIN courses c ON cbc.course_id = c.id
LEFT JOIN admin_users au ON cbc.last_approved_by = au.id;

-- ============================================================================
-- SEED DATA (Only for courses that don't have configs yet)
-- ============================================================================

INSERT INTO course_bot_configs (
  course_id,
  regular_prompt,
  regular_greeting,
  regular_help_text,
  socratic_prompt,
  socratic_greeting,
  socratic_help_text,
  default_mode,
  allow_mode_switching,
  created_at,
  last_approved_at,
  regular_version,
  socratic_version
)
SELECT
  id,
  'You are a helpful teaching assistant for this course. Provide clear, direct answers with examples and explanations. Help students understand concepts quickly and effectively.',
  'Hello! I''m here to help you learn. Ask me anything about the course!',
  'I provide direct answers, explanations, and examples to help you learn quickly.',
  'You are a Socratic teaching assistant. NEVER give direct answers. ONLY ask guiding questions to help students discover answers themselves. Guide them through inquiry, critical thinking, and self-discovery.',
  'Hello! Let''s discover the answers together through thoughtful questions.',
  'I guide you with questions to help you discover answers yourself through critical thinking.',
  'regular',
  TRUE,
  NOW(),
  NOW(), -- Mark as pre-approved (initial system defaults)
  1, -- regular_version
  1  -- socratic_version
FROM courses
WHERE id NOT IN (SELECT course_id FROM course_bot_configs)
ON CONFLICT (course_id) DO NOTHING;

COMMIT;

-- Verification
SELECT
  'Migration 006 SAFE - COMPLETED' AS status,
  COUNT(*) AS course_configs_count
FROM course_bot_configs;

SELECT * FROM pending_prompt_approvals LIMIT 5;
