-- ============================================================================
-- Migration 006: Dual Coaching Bot with Approval Workflow
-- ============================================================================
-- Description: Adds dual coaching mode functionality (Regular vs Socratic)
--              with Super Admin approval workflow for all prompt changes
-- Date: 2025-11-04
-- Impact: NEW FEATURE - No changes to existing tables
-- Safety: Completely additive, no breaking changes
-- ============================================================================

-- ============================================================================
-- TABLE 1: Course Bot Configurations (Active/Approved Prompts)
-- ============================================================================
-- Stores the currently active and approved bot prompts for each course
-- Both Regular and Socratic modes have separate prompts
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_bot_configs (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

  -- Active Regular Mode Configuration (approved and live)
  regular_prompt TEXT NOT NULL DEFAULT 'You are a helpful teaching assistant for this course. Provide clear, direct answers with examples and explanations. Help students understand concepts quickly.',
  regular_greeting TEXT DEFAULT 'Hello! I''m here to help you learn. Ask me anything!',
  regular_help_text TEXT DEFAULT 'I provide direct answers, explanations, and examples.',
  regular_version INTEGER DEFAULT 1,

  -- Active Socratic Mode Configuration (approved and live)
  socratic_prompt TEXT NOT NULL DEFAULT 'You are a Socratic teaching assistant. NEVER give direct answers. ONLY ask guiding questions to help students discover answers themselves. Guide through inquiry and critical thinking.',
  socratic_greeting TEXT DEFAULT 'Hello! Let''s discover the answers together through questions.',
  socratic_help_text TEXT DEFAULT 'I guide you through questions to help you discover answers yourself.',
  socratic_version INTEGER DEFAULT 1,

  -- Mode Settings
  default_mode VARCHAR(20) DEFAULT 'regular' CHECK (default_mode IN ('regular', 'socratic')),
  allow_mode_switching BOOLEAN DEFAULT TRUE,
  switch_cooldown_minutes INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_approved_at TIMESTAMP,
  last_approved_by INTEGER REFERENCES admin_users(id),

  UNIQUE(course_id)
);

COMMENT ON TABLE course_bot_configs IS 'Stores active/approved bot configurations for both coaching modes';
COMMENT ON COLUMN course_bot_configs.regular_prompt IS 'Active Regular Mode system prompt (approved)';
COMMENT ON COLUMN course_bot_configs.socratic_prompt IS 'Active Socratic Mode system prompt (approved)';
COMMENT ON COLUMN course_bot_configs.default_mode IS 'Default mode for new users (regular or socratic)';
COMMENT ON COLUMN course_bot_configs.allow_mode_switching IS 'Whether users can switch between modes';

-- ============================================================================
-- TABLE 2: Prompt Change Requests (Approval Workflow)
-- ============================================================================
-- All prompt changes go through this approval workflow
-- States: draft → pending_approval → approved/rejected → archived
-- ============================================================================

CREATE TABLE IF NOT EXISTS prompt_change_requests (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

  -- Prompt details
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('regular', 'socratic')),
  new_prompt TEXT NOT NULL,
  new_greeting TEXT,
  new_help_text TEXT,

  -- Change metadata
  change_reason TEXT NOT NULL, -- Why is this change needed?
  change_description TEXT, -- What's different?

  -- Workflow state
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'archived')),

  -- Requestor (Admin who created this)
  requested_by INTEGER NOT NULL REFERENCES admin_users(id),
  requested_at TIMESTAMP DEFAULT NOW(),

  -- Approver (Super Admin only)
  reviewed_by INTEGER REFERENCES admin_users(id),
  reviewed_at TIMESTAMP,
  review_notes TEXT, -- Feedback for approval/rejection

  -- Versioning
  version_number INTEGER NOT NULL DEFAULT 1,
  replaces_version INTEGER, -- Which version is this replacing?

  -- Activation
  activated_at TIMESTAMP, -- When it went live

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE prompt_change_requests IS 'Approval workflow for all prompt changes (draft → pending → approved/rejected)';
COMMENT ON COLUMN prompt_change_requests.status IS 'Workflow state: draft, pending_approval, approved, rejected, archived';
COMMENT ON COLUMN prompt_change_requests.change_reason IS 'Admin explanation for why this change is needed (required, min 20 chars)';
COMMENT ON COLUMN prompt_change_requests.replaces_version IS 'Version number this change will replace if approved';
COMMENT ON COLUMN prompt_change_requests.review_notes IS 'Super Admin feedback on approval/rejection';

-- ============================================================================
-- TABLE 3: Prompt Approval History (Complete Audit Trail)
-- ============================================================================
-- Immutable audit log of all prompt approval actions
-- Tracks: submitted, approved, rejected, activated, archived
-- ============================================================================

CREATE TABLE IF NOT EXISTS prompt_approval_history (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES prompt_change_requests(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id),

  -- Action details
  action VARCHAR(20) NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'activated', 'archived')),
  actor_id INTEGER NOT NULL REFERENCES admin_users(id),
  actor_role VARCHAR(20) NOT NULL, -- 'admin', 'super_admin'

  -- Context
  notes TEXT,
  previous_status VARCHAR(20),
  new_status VARCHAR(20),

  -- Metadata for security audit
  created_at TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

COMMENT ON TABLE prompt_approval_history IS 'Complete audit trail of all prompt approval actions';
COMMENT ON COLUMN prompt_approval_history.action IS 'Action taken: submitted, approved, rejected, activated, archived';
COMMENT ON COLUMN prompt_approval_history.actor_role IS 'Role of person who took action (admin or super_admin)';

-- ============================================================================
-- TABLE 4: User Bot Preferences (Per-Course Mode Selection)
-- ============================================================================
-- Tracks each WhatsApp user's selected coaching mode preference per course
-- Allows users to switch between Regular and Socratic modes
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_bot_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

  -- Current mode selection
  selected_mode VARCHAR(20) DEFAULT 'regular' CHECK (selected_mode IN ('regular', 'socratic')),

  -- Switch tracking
  mode_switches_count INTEGER DEFAULT 0,
  last_switched_at TIMESTAMP,
  last_switched_from VARCHAR(20),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, course_id)
);

COMMENT ON TABLE user_bot_preferences IS 'Tracks each user''s selected coaching mode preference per course';
COMMENT ON COLUMN user_bot_preferences.selected_mode IS 'Current mode: regular (direct answers) or socratic (guiding questions)';
COMMENT ON COLUMN user_bot_preferences.mode_switches_count IS 'How many times user has switched modes';

-- ============================================================================
-- TABLE 5: Coaching Sessions (Individual Chat Sessions)
-- ============================================================================
-- Tracks individual coaching sessions with mode and prompt version
-- Used for analytics and effectiveness measurement
-- ============================================================================

CREATE TABLE IF NOT EXISTS coaching_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id),

  -- Mode tracking
  mode_used VARCHAR(20) NOT NULL CHECK (mode_used IN ('regular', 'socratic')),
  prompt_version INTEGER NOT NULL, -- Which version of prompt was used?

  -- Session details
  session_start TIMESTAMP DEFAULT NOW(),
  session_end TIMESTAMP,
  message_count INTEGER DEFAULT 0,

  -- Engagement metrics
  user_satisfaction SMALLINT CHECK (user_satisfaction BETWEEN 1 AND 5),
  mode_switched_during_session BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE coaching_sessions IS 'Individual chat sessions with mode and version tracking';
COMMENT ON COLUMN coaching_sessions.prompt_version IS 'Version number of prompt used in this session';
COMMENT ON COLUMN coaching_sessions.user_satisfaction IS 'User rating 1-5 stars (optional)';

-- ============================================================================
-- TABLE 6: Mode Analytics (Aggregated Statistics)
-- ============================================================================
-- Aggregated statistics for measuring mode effectiveness
-- Updated daily/weekly for performance dashboards
-- ============================================================================

CREATE TABLE IF NOT EXISTS mode_analytics (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('regular', 'socratic')),

  -- Usage stats
  total_users INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  avg_session_duration_minutes DECIMAL(10,2),

  -- Performance stats
  avg_quiz_score DECIMAL(5,2),
  completion_rate DECIMAL(5,2),
  retention_rate DECIMAL(5,2),
  avg_satisfaction DECIMAL(3,2),

  -- Preference stats
  user_preference_percentage DECIMAL(5,2),
  switch_to_mode_count INTEGER DEFAULT 0,
  switch_from_mode_count INTEGER DEFAULT 0,

  -- Time period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(course_id, mode, period_start, period_end)
);

COMMENT ON TABLE mode_analytics IS 'Aggregated statistics for measuring mode effectiveness';
COMMENT ON COLUMN mode_analytics.avg_quiz_score IS 'Average quiz score for users using this mode';
COMMENT ON COLUMN mode_analytics.completion_rate IS 'Percentage of users who complete course in this mode';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
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
-- TRIGGERS FOR UPDATED_AT COLUMNS
-- ============================================================================

-- Function to update updated_at column (reuse if exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for each table
CREATE TRIGGER IF NOT EXISTS update_course_bot_configs_updated_at
  BEFORE UPDATE ON course_bot_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_prompt_requests_updated_at
  BEFORE UPDATE ON prompt_change_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_user_bot_preferences_updated_at
  BEFORE UPDATE ON user_bot_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS FOR CONVENIENCE
-- ============================================================================

-- View: Pending approval requests (for Super Admin dashboard)
CREATE OR REPLACE VIEW pending_prompt_approvals AS
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

COMMENT ON VIEW pending_prompt_approvals IS 'Quick view of all pending approval requests for Super Admin dashboard';

-- View: Active prompts with version info
CREATE OR REPLACE VIEW active_course_prompts AS
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

COMMENT ON VIEW active_course_prompts IS 'Shows currently active prompts for all courses with metadata';

-- ============================================================================
-- SEED DEFAULT DATA FOR EXISTING COURSES
-- ============================================================================
-- Initialize bot configs for all existing courses
-- Marks initial prompts as pre-approved (system defaults)
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
  last_approved_at
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
  NOW() -- Mark as pre-approved (initial system defaults)
FROM courses
WHERE id NOT IN (SELECT course_id FROM course_bot_configs)
ON CONFLICT (course_id) DO NOTHING;

-- ============================================================================
-- MIGRATION VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify migration success:
--
-- SELECT COUNT(*) FROM course_bot_configs;  -- Should equal course count
-- SELECT * FROM pending_prompt_approvals;   -- Should be empty initially
-- SELECT * FROM active_course_prompts;      -- Should show all courses
--
-- ============================================================================

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (IF NEEDED)
-- ============================================================================
-- To rollback this migration, run:
--
-- DROP VIEW IF EXISTS pending_prompt_approvals CASCADE;
-- DROP VIEW IF EXISTS active_course_prompts CASCADE;
-- DROP TABLE IF EXISTS mode_analytics CASCADE;
-- DROP TABLE IF EXISTS coaching_sessions CASCADE;
-- DROP TABLE IF EXISTS user_bot_preferences CASCADE;
-- DROP TABLE IF EXISTS prompt_approval_history CASCADE;
-- DROP TABLE IF EXISTS prompt_change_requests CASCADE;
-- DROP TABLE IF EXISTS course_bot_configs CASCADE;
--
-- ============================================================================

-- Migration complete
SELECT 'Migration 006: Dual Coaching Bot with Approval Workflow - COMPLETED' AS status;
