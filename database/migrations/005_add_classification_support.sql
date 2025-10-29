-- Migration: Add AI Classification Support
-- Created: 2025-10-18
-- Purpose: Add tables and columns to support AI-powered content classification

-- ============================================================================
-- 1. Add classification metadata to module_content table
-- ============================================================================

ALTER TABLE module_content
  ADD COLUMN IF NOT EXISTS classification_confidence FLOAT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS classification_topics TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_suggested_module VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS classification_metadata JSONB DEFAULT NULL;

-- Add index for confidence-based queries
CREATE INDEX IF NOT EXISTS idx_module_content_classification_confidence
  ON module_content(classification_confidence) WHERE classification_confidence IS NOT NULL;

-- Add index for topic searches
CREATE INDEX IF NOT EXISTS idx_module_content_classification_topics
  ON module_content USING GIN(classification_topics) WHERE classification_topics IS NOT NULL;

-- ============================================================================
-- 2. Add learning progression fields to modules table
-- ============================================================================

ALTER TABLE modules
  ADD COLUMN IF NOT EXISTS learning_level VARCHAR(50) DEFAULT 'intermediate',
  ADD COLUMN IF NOT EXISTS estimated_duration_hours INTEGER DEFAULT 4,
  ADD COLUMN IF NOT EXISTS prerequisites TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT NULL;

-- Add check constraint for valid learning levels
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'modules_learning_level_check'
  ) THEN
    ALTER TABLE modules
      ADD CONSTRAINT modules_learning_level_check
      CHECK (learning_level IN ('beginner', 'intermediate', 'advanced', 'expert'));
  END IF;
END $$;

-- Add index for learning level queries
CREATE INDEX IF NOT EXISTS idx_modules_learning_level
  ON modules(learning_level);

-- ============================================================================
-- 3. Create classification_temp table for storing pending classifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS classification_temp (
  id VARCHAR(255) PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  admin_user_id INTEGER NOT NULL,
  classifications JSONB NOT NULL,
  module_suggestions JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP DEFAULT NULL
);

-- Add index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_classification_temp_expires
  ON classification_temp(expires_at) WHERE NOT processed;

-- Add index for course lookups
CREATE INDEX IF NOT EXISTS idx_classification_temp_course
  ON classification_temp(course_id);

-- ============================================================================
-- 4. Create classification_history table for audit trail
-- ============================================================================

CREATE TABLE IF NOT EXISTS classification_history (
  id SERIAL PRIMARY KEY,
  classification_id VARCHAR(255) NOT NULL,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  admin_user_id INTEGER NOT NULL,
  total_files INTEGER NOT NULL,
  successful_classifications INTEGER NOT NULL,
  failed_classifications INTEGER NOT NULL,
  suggested_modules_count INTEGER NOT NULL,
  accepted_modules_count INTEGER DEFAULT NULL,
  acceptance_decision JSONB DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMP DEFAULT NULL
);

-- Add index for historical queries
CREATE INDEX IF NOT EXISTS idx_classification_history_course
  ON classification_history(course_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_classification_history_admin
  ON classification_history(admin_user_id, created_at DESC);

-- ============================================================================
-- 5. Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN module_content.classification_confidence IS
  'AI confidence score (0-1) for module assignment';

COMMENT ON COLUMN module_content.classification_topics IS
  'Array of topics extracted by AI classification';

COMMENT ON COLUMN module_content.ai_suggested_module IS
  'Module title originally suggested by AI (before admin review)';

COMMENT ON COLUMN module_content.classification_metadata IS
  'Full AI classification response including reasoning and alternatives';

COMMENT ON COLUMN modules.learning_level IS
  'Difficulty level: beginner, intermediate, advanced, expert';

COMMENT ON COLUMN modules.estimated_duration_hours IS
  'Estimated hours to complete this module';

COMMENT ON COLUMN modules.prerequisites IS
  'Array of prerequisite module IDs or topic names';

COMMENT ON COLUMN modules.topics IS
  'Main topics/concepts covered in this module';

COMMENT ON TABLE classification_temp IS
  'Temporary storage for AI classifications awaiting admin review (24-hour TTL)';

COMMENT ON TABLE classification_history IS
  'Audit trail of all classification sessions for reporting and analysis';

-- ============================================================================
-- 6. Create function to auto-cleanup expired classifications
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_classifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Move expired classifications to history
  INSERT INTO classification_history (
    classification_id,
    course_id,
    admin_user_id,
    total_files,
    successful_classifications,
    failed_classifications,
    suggested_modules_count,
    created_at
  )
  SELECT
    id,
    course_id,
    admin_user_id,
    (classifications->>'successful')::INTEGER,
    (classifications->>'successful')::INTEGER,
    (classifications->>'failed')::INTEGER,
    (module_suggestions->>'suggested_module_count')::INTEGER,
    created_at
  FROM classification_temp
  WHERE expires_at < NOW() AND NOT processed;

  -- Delete expired records
  DELETE FROM classification_temp
  WHERE expires_at < NOW() AND NOT processed
  RETURNING * INTO deleted_count;

  RETURN COALESCE(deleted_count, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_classifications() IS
  'Moves expired classifications to history and deletes temp records';

-- ============================================================================
-- 7. Create view for classification statistics
-- ============================================================================

CREATE OR REPLACE VIEW classification_stats AS
SELECT
  c.id as course_id,
  c.title as course_title,
  COUNT(DISTINCT ch.id) as total_classifications,
  SUM(ch.total_files) as total_files_classified,
  AVG(ch.successful_classifications::FLOAT / NULLIF(ch.total_files, 0)) as avg_success_rate,
  AVG(ch.suggested_modules_count) as avg_suggested_modules,
  COUNT(*) FILTER (WHERE ch.accepted_at IS NOT NULL) as accepted_count,
  MAX(ch.created_at) as last_classification_at
FROM courses c
LEFT JOIN classification_history ch ON c.id = ch.course_id
GROUP BY c.id, c.title;

COMMENT ON VIEW classification_stats IS
  'Aggregated statistics on AI classification usage per course';

-- ============================================================================
-- 8. Sample query templates (for documentation)
-- ============================================================================

/*
-- Get all files with high-confidence classifications for a course
SELECT
  mc.id,
  mc.file_name,
  m.title as module_title,
  mc.classification_confidence,
  mc.classification_topics,
  mc.classification_metadata->>'reasoning' as ai_reasoning
FROM module_content mc
JOIN modules m ON mc.module_id = m.id
WHERE m.course_id = :course_id
  AND mc.classification_confidence >= 0.8
ORDER BY mc.classification_confidence DESC;

-- Get learning progression for a course
SELECT
  m.sequence_order,
  m.title,
  m.learning_level,
  m.estimated_duration_hours,
  m.topics,
  COUNT(mc.id) as file_count,
  AVG(mc.classification_confidence) as avg_confidence
FROM modules m
LEFT JOIN module_content mc ON m.id = mc.module_id
WHERE m.course_id = :course_id
GROUP BY m.id, m.sequence_order, m.title, m.learning_level
ORDER BY m.sequence_order;

-- Find files that need manual review (low confidence)
SELECT
  mc.id,
  mc.file_name,
  mc.classification_confidence,
  mc.ai_suggested_module,
  m.title as assigned_module,
  mc.classification_topics
FROM module_content mc
JOIN modules m ON mc.module_id = m.id
WHERE m.course_id = :course_id
  AND mc.classification_confidence < 0.7
ORDER BY mc.classification_confidence ASC;
*/

-- ============================================================================
-- Migration complete!
-- ============================================================================
