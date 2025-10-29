-- Migration: Coaching, Nudges, and Reflections Tracking
-- Purpose: Store nudges and reflections for personalized learning coaching

-- ==================== NUDGES TABLE ====================

CREATE TABLE IF NOT EXISTS nudges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nudge_type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  reason VARCHAR(100),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  response_type VARCHAR(50),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for nudges
CREATE INDEX IF NOT EXISTS idx_nudges_user_id ON nudges(user_id);
CREATE INDEX IF NOT EXISTS idx_nudges_type ON nudges(nudge_type);
CREATE INDEX IF NOT EXISTS idx_nudges_sent_at ON nudges(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_nudges_responded ON nudges(responded_at) WHERE responded_at IS NOT NULL;

-- Comments for nudges
COMMENT ON TABLE nudges IS 'Tracks all nudges sent to users for engagement and coaching';
COMMENT ON COLUMN nudges.user_id IS 'Reference to the user who received the nudge';
COMMENT ON COLUMN nudges.nudge_type IS 'Type of nudge: welcome_back, inactive_gentle, quiz_reminder, quiz_retry, milestone_celebration, daily_tip';
COMMENT ON COLUMN nudges.message IS 'The actual nudge message sent to the user';
COMMENT ON COLUMN nudges.reason IS 'Why the nudge was sent (e.g., "inactive_3_days", "quiz_failed")';
COMMENT ON COLUMN nudges.sent_at IS 'When the nudge was sent';
COMMENT ON COLUMN nudges.responded_at IS 'When the user responded to the nudge (if any)';
COMMENT ON COLUMN nudges.response_type IS 'Type of response: immediate, delayed, ignored';
COMMENT ON COLUMN nudges.metadata IS 'Additional metadata (module context, engagement score, etc.)';

-- ==================== REFLECTIONS TABLE ====================

CREATE TABLE IF NOT EXISTS reflections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id INTEGER REFERENCES modules(id) ON DELETE SET NULL,
  reflection_type VARCHAR(50) NOT NULL,
  prompt_text TEXT,
  reflection_text TEXT NOT NULL,
  depth_level VARCHAR(20),
  emotional_tone VARCHAR(20),
  key_points JSONB,
  action_items JSONB,
  challenges JSONB,
  feedback_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for reflections
CREATE INDEX IF NOT EXISTS idx_reflections_user_id ON reflections(user_id);
CREATE INDEX IF NOT EXISTS idx_reflections_module_id ON reflections(module_id);
CREATE INDEX IF NOT EXISTS idx_reflections_type ON reflections(reflection_type);
CREATE INDEX IF NOT EXISTS idx_reflections_created_at ON reflections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reflections_depth ON reflections(depth_level);

-- Comments for reflections
COMMENT ON TABLE reflections IS 'Stores user reflections for learning insights and progress tracking';
COMMENT ON COLUMN reflections.user_id IS 'Reference to the user who wrote the reflection';
COMMENT ON COLUMN reflections.module_id IS 'Reference to the module (if reflection is module-specific)';
COMMENT ON COLUMN reflections.reflection_type IS 'Type: module_completion, weekly, quiz_reflection, milestone';
COMMENT ON COLUMN reflections.prompt_text IS 'The reflection prompt that was given';
COMMENT ON COLUMN reflections.reflection_text IS 'The user''s reflection response';
COMMENT ON COLUMN reflections.depth_level IS 'Depth analysis: surface, moderate, deep';
COMMENT ON COLUMN reflections.emotional_tone IS 'Emotional tone: positive, neutral, struggling';
COMMENT ON COLUMN reflections.key_points IS 'AI-extracted key learning points from reflection';
COMMENT ON COLUMN reflections.action_items IS 'AI-extracted action items or goals mentioned';
COMMENT ON COLUMN reflections.challenges IS 'AI-extracted challenges or concerns raised';
COMMENT ON COLUMN reflections.feedback_text IS 'Personalized feedback given to the user';
COMMENT ON COLUMN reflections.metadata IS 'Additional metadata (word count, AI confidence, etc.)';

-- ==================== REFLECTION REMINDERS TABLE ====================

CREATE TABLE IF NOT EXISTS reflection_reminders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  frequency VARCHAR(20) NOT NULL,
  next_reminder_at TIMESTAMP WITH TIME ZONE NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for reflection reminders
CREATE INDEX IF NOT EXISTS idx_reflection_reminders_user_id ON reflection_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reflection_reminders_next ON reflection_reminders(next_reminder_at) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_reflection_reminders_active ON reflection_reminders(active);

-- Comments for reflection reminders
COMMENT ON TABLE reflection_reminders IS 'Stores reflection reminder schedules for users';
COMMENT ON COLUMN reflection_reminders.frequency IS 'Reminder frequency: weekly, biweekly, monthly, module_end';
COMMENT ON COLUMN reflection_reminders.next_reminder_at IS 'When the next reminder should be sent';
COMMENT ON COLUMN reflection_reminders.active IS 'Whether reminders are currently active';

-- ==================== COACHING EVENTS LOG ====================

CREATE TABLE IF NOT EXISTS coaching_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for coaching events
CREATE INDEX IF NOT EXISTS idx_coaching_events_user_id ON coaching_events(user_id);
CREATE INDEX IF NOT EXISTS idx_coaching_events_type ON coaching_events(event_type);
CREATE INDEX IF NOT EXISTS idx_coaching_events_created_at ON coaching_events(created_at DESC);

-- Comments for coaching events
COMMENT ON TABLE coaching_events IS 'Logs all coaching-related events for analytics';
COMMENT ON COLUMN coaching_events.user_id IS 'User associated with event (NULL for system events)';
COMMENT ON COLUMN coaching_events.event_type IS 'Event type: nudge_sent, reflection_prompt, milestone_reached, etc.';
COMMENT ON COLUMN coaching_events.event_data IS 'Event-specific data and context';

-- ==================== VIEWS FOR ANALYTICS ====================

-- View: Nudge effectiveness
CREATE OR REPLACE VIEW nudge_effectiveness AS
SELECT
  nudge_type,
  COUNT(*) as total_sent,
  COUNT(responded_at) as total_responses,
  ROUND(
    (COUNT(responded_at)::DECIMAL / NULLIF(COUNT(*), 0) * 100), 2
  ) as response_rate_percent,
  AVG(EXTRACT(EPOCH FROM (responded_at - sent_at)) / 3600)::DECIMAL(10,2) as avg_response_time_hours
FROM nudges
GROUP BY nudge_type
ORDER BY response_rate_percent DESC;

COMMENT ON VIEW nudge_effectiveness IS 'Analytics view for nudge effectiveness by type';

-- View: User reflection statistics
CREATE OR REPLACE VIEW user_reflection_stats AS
SELECT
  u.id as user_id,
  u.name,
  u.whatsapp_id,
  COUNT(r.id) as total_reflections,
  COUNT(DISTINCT r.module_id) as modules_reflected_on,
  AVG(LENGTH(r.reflection_text)) as avg_reflection_length,
  COUNT(CASE WHEN r.depth_level = 'deep' THEN 1 END) as deep_reflections,
  COUNT(CASE WHEN r.emotional_tone = 'positive' THEN 1 END) as positive_reflections,
  MAX(r.created_at) as last_reflection_at
FROM users u
LEFT JOIN reflections r ON u.id = r.user_id
GROUP BY u.id, u.name, u.whatsapp_id
ORDER BY total_reflections DESC;

COMMENT ON VIEW user_reflection_stats IS 'User-level reflection statistics for coaching insights';

-- View: Recent coaching activity
CREATE OR REPLACE VIEW recent_coaching_activity AS
SELECT
  'nudge' as activity_type,
  n.user_id,
  u.name as user_name,
  n.nudge_type as detail,
  n.sent_at as activity_at,
  n.responded_at IS NOT NULL as completed
FROM nudges n
JOIN users u ON n.user_id = u.id
WHERE n.sent_at >= NOW() - INTERVAL '7 days'
UNION ALL
SELECT
  'reflection' as activity_type,
  r.user_id,
  u.name as user_name,
  r.reflection_type as detail,
  r.created_at as activity_at,
  TRUE as completed
FROM reflections r
JOIN users u ON r.user_id = u.id
WHERE r.created_at >= NOW() - INTERVAL '7 days'
ORDER BY activity_at DESC;

COMMENT ON VIEW recent_coaching_activity IS 'Recent coaching activity (last 7 days) for dashboard';

-- ==================== FUNCTIONS ====================

-- Function: Record nudge response
CREATE OR REPLACE FUNCTION record_nudge_response(
  p_nudge_id INTEGER,
  p_response_type VARCHAR(50) DEFAULT 'immediate'
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE nudges
  SET
    responded_at = NOW(),
    response_type = p_response_type
  WHERE id = p_nudge_id
    AND responded_at IS NULL;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_nudge_response IS 'Mark a nudge as responded to';

-- Function: Get user coaching summary
CREATE OR REPLACE FUNCTION get_user_coaching_summary(p_user_id INTEGER)
RETURNS TABLE(
  total_nudges_received BIGINT,
  nudges_responded BIGINT,
  response_rate_percent DECIMAL,
  total_reflections BIGINT,
  avg_reflection_depth VARCHAR,
  last_nudge_at TIMESTAMP WITH TIME ZONE,
  last_reflection_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(n.id),
    COUNT(n.responded_at),
    ROUND((COUNT(n.responded_at)::DECIMAL / NULLIF(COUNT(n.id), 0) * 100), 2),
    COUNT(r.id),
    MODE() WITHIN GROUP (ORDER BY r.depth_level),
    MAX(n.sent_at),
    MAX(r.created_at)
  FROM users u
  LEFT JOIN nudges n ON u.id = n.user_id
  LEFT JOIN reflections r ON u.id = r.user_id
  WHERE u.id = p_user_id
  GROUP BY u.id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_coaching_summary IS 'Get comprehensive coaching summary for a user';

-- Migration complete
SELECT 'Migration 008: Coaching, nudges, and reflections tables created successfully' as status;
