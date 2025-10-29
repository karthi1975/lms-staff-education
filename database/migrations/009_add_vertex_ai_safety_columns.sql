-- Migration: Add Vertex AI Safety Logging Columns
-- Purpose: Enable proper tracking of Layer 1 vs Layer 2 moderation effectiveness
-- Created: 2025-10-29
-- Applied: [TO BE APPLIED]

-- Add new columns for detailed moderation tracking
ALTER TABLE content_moderation_log
  ADD COLUMN IF NOT EXISTS blocked_by VARCHAR(20) DEFAULT 'local_filter',
  ADD COLUMN IF NOT EXISTS category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS moderation_reason VARCHAR(100);

-- Rename 'phone' to 'user_phone' for consistency with code
ALTER TABLE content_moderation_log
  RENAME COLUMN phone TO user_phone;

-- Update existing records to have proper blocked_by value
UPDATE content_moderation_log
SET blocked_by = 'local_filter'
WHERE blocked_by IS NULL;

-- Add indexes for analytics queries (performance optimization)
CREATE INDEX IF NOT EXISTS idx_moderation_blocked_by
  ON content_moderation_log(blocked_by);

CREATE INDEX IF NOT EXISTS idx_moderation_category
  ON content_moderation_log(category);

CREATE INDEX IF NOT EXISTS idx_moderation_user_phone
  ON content_moderation_log(user_phone);

-- Add column comments for documentation
COMMENT ON COLUMN content_moderation_log.blocked_by IS
  'Which layer blocked the content: local_filter or vertex_ai';

COMMENT ON COLUMN content_moderation_log.category IS
  'Moderation category: profanity, violence, threats, sexual, harassment, vertex_ai_safety, etc.';

COMMENT ON COLUMN content_moderation_log.moderation_reason IS
  'Detailed reason for blocking the content';

COMMENT ON COLUMN content_moderation_log.user_phone IS
  'User WhatsApp phone number';

-- Verify migration success
DO $$
BEGIN
  -- Check if all columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_moderation_log'
    AND column_name = 'blocked_by'
  ) THEN
    RAISE EXCEPTION 'Migration failed: blocked_by column missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_moderation_log'
    AND column_name = 'category'
  ) THEN
    RAISE EXCEPTION 'Migration failed: category column missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_moderation_log'
    AND column_name = 'user_phone'
  ) THEN
    RAISE EXCEPTION 'Migration failed: user_phone column missing';
  END IF;

  RAISE NOTICE 'Migration 009_add_vertex_ai_safety_columns.sql completed successfully';
END $$;
