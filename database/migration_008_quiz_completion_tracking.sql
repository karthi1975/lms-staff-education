-- Migration 008: Quiz Completion Tracking
-- Ensures complete quiz tracking and module completion on quiz pass

BEGIN;

-- ============================================================
-- 1. Ensure user_progress table has quiz tracking fields
-- ============================================================
ALTER TABLE user_progress
  ADD COLUMN IF NOT EXISTS quiz_taken BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS quiz_passed BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS quiz_score INTEGER,
  ADD COLUMN IF NOT EXISTS quiz_attempts_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_without_quiz BOOLEAN DEFAULT FALSE;

-- ============================================================
-- 2. Create module_completions table for detailed tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS module_completions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    quiz_id INTEGER REFERENCES quizzes(id) ON DELETE SET NULL,

    -- Completion details
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completion_method VARCHAR(20) NOT NULL, -- 'quiz_pass', 'manual', 'content_only'

    -- Quiz details (if completed via quiz)
    quiz_score INTEGER,
    quiz_percentage DECIMAL(5,2),
    quiz_attempt_number INTEGER,
    quiz_passed BOOLEAN,

    -- Metadata
    time_to_complete_minutes INTEGER, -- Time from first module access to completion
    total_attempts INTEGER, -- Total quiz attempts before passing

    UNIQUE(user_id, module_id)
);

CREATE INDEX idx_module_completions_user ON module_completions(user_id);
CREATE INDEX idx_module_completions_module ON module_completions(module_id);
CREATE INDEX idx_module_completions_date ON module_completions(completed_at DESC);
CREATE INDEX idx_module_completions_method ON module_completions(completion_method);

-- ============================================================
-- 3. Update quiz_attempts table to link to quiz_id
-- ============================================================
ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS quiz_id INTEGER REFERENCES quizzes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS percentage DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS time_taken_seconds INTEGER;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);

-- ============================================================
-- 4. Create function to mark module complete on quiz pass
-- ============================================================
CREATE OR REPLACE FUNCTION mark_module_complete_on_quiz_pass()
RETURNS TRIGGER AS $$
DECLARE
  v_module_id INTEGER;
  v_quiz_threshold INTEGER;
  v_time_to_complete INTEGER;
  v_total_attempts INTEGER;
BEGIN
  -- Only proceed if quiz was passed
  IF NEW.passed = TRUE THEN

    -- Get module_id from quiz
    SELECT module_id, pass_threshold
    INTO v_module_id, v_quiz_threshold
    FROM quizzes
    WHERE id = NEW.quiz_id;

    -- Calculate time to complete (from first module access to now)
    SELECT EXTRACT(EPOCH FROM (NOW() - MIN(started_at)))/60
    INTO v_time_to_complete
    FROM user_progress
    WHERE user_id = NEW.user_id AND module_id = v_module_id;

    -- Get total attempts for this quiz
    SELECT COUNT(*)
    INTO v_total_attempts
    FROM quiz_attempts
    WHERE user_id = NEW.user_id AND module_id = v_module_id;

    -- Update user_progress to mark module as completed
    UPDATE user_progress
    SET
      status = 'completed',
      completed_at = NOW(),
      quiz_taken = TRUE,
      quiz_passed = TRUE,
      quiz_score = NEW.score,
      quiz_attempts_count = v_total_attempts,
      progress_percentage = 100,
      last_activity_at = NOW()
    WHERE user_id = NEW.user_id
      AND module_id = v_module_id
      AND status != 'completed'; -- Don't overwrite existing completion

    -- Insert into module_completions (or update if exists)
    INSERT INTO module_completions (
      user_id,
      module_id,
      quiz_id,
      completed_at,
      completion_method,
      quiz_score,
      quiz_percentage,
      quiz_attempt_number,
      quiz_passed,
      time_to_complete_minutes,
      total_attempts
    ) VALUES (
      NEW.user_id,
      v_module_id,
      NEW.quiz_id,
      NOW(),
      'quiz_pass',
      NEW.score,
      NEW.percentage,
      NEW.attempt_number,
      TRUE,
      v_time_to_complete::INTEGER,
      v_total_attempts
    )
    ON CONFLICT (user_id, module_id)
    DO UPDATE SET
      completed_at = NOW(),
      quiz_score = NEW.score,
      quiz_percentage = NEW.percentage,
      quiz_attempt_number = NEW.attempt_number,
      total_attempts = v_total_attempts;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_mark_module_complete ON quiz_attempts;
CREATE TRIGGER trigger_mark_module_complete
  AFTER INSERT ON quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION mark_module_complete_on_quiz_pass();

-- ============================================================
-- 5. Create view for easy admin portal queries
-- ============================================================
CREATE OR REPLACE VIEW user_module_progress_summary AS
SELECT
  u.id as user_id,
  u.whatsapp_id,
  u.name as full_name,
  m.id as module_id,
  m.title as module_title,
  m.sequence_order as module_number,
  c.id as course_id,
  c.title as course_title,

  -- Progress status
  COALESCE(up.status, 'not_started') as status,
  COALESCE(up.progress_percentage, 0) as progress_percentage,
  up.started_at,
  up.completed_at,
  up.time_spent_minutes,
  up.last_activity_at,

  -- Quiz info
  up.quiz_taken,
  up.quiz_passed,
  up.quiz_score,
  up.quiz_attempts_count,

  -- Completion info
  mc.completion_method,
  mc.quiz_percentage as final_quiz_percentage,
  mc.time_to_complete_minutes,

  -- Quiz availability
  (SELECT COUNT(*) FROM quiz_questions qq
   INNER JOIN quizzes q ON qq.quiz_id = q.id
   WHERE q.module_id = m.id) as quiz_questions_available

FROM users u
CROSS JOIN modules m
LEFT JOIN courses c ON m.course_id = c.id
LEFT JOIN user_progress up ON u.id = up.user_id AND m.id = up.module_id
LEFT JOIN module_completions mc ON u.id = mc.user_id AND m.id = mc.module_id
WHERE u.is_active = TRUE
ORDER BY u.id, m.sequence_order;

-- ============================================================
-- 6. Create function to get user completion stats
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_completion_stats(p_user_id INTEGER)
RETURNS TABLE (
  total_modules INTEGER,
  completed_modules INTEGER,
  in_progress_modules INTEGER,
  quizzes_taken INTEGER,
  quizzes_passed INTEGER,
  average_quiz_score DECIMAL,
  completion_percentage DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT m.id)::INTEGER as total_modules,
    COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN m.id END)::INTEGER as completed_modules,
    COUNT(DISTINCT CASE WHEN up.status = 'in_progress' THEN m.id END)::INTEGER as in_progress_modules,
    COUNT(DISTINCT CASE WHEN up.quiz_taken = TRUE THEN m.id END)::INTEGER as quizzes_taken,
    COUNT(DISTINCT CASE WHEN up.quiz_passed = TRUE THEN m.id END)::INTEGER as quizzes_passed,
    AVG(CASE WHEN up.quiz_passed = TRUE THEN up.quiz_score END) as average_quiz_score,
    (COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN m.id END)::DECIMAL /
     NULLIF(COUNT(DISTINCT m.id), 0) * 100) as completion_percentage
  FROM modules m
  LEFT JOIN user_progress up ON m.id = up.module_id AND up.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Verification
SELECT 'Migration 008 Complete: Quiz completion tracking ready' as status;
