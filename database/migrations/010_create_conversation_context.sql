-- Migration: Create conversation_context table
-- Purpose: Track user conversation state for course orchestrator flow
-- Created: 2025-10-29
-- Priority: CRITICAL (WhatsApp flow broken without this)

-- Create conversation_context table
CREATE TABLE IF NOT EXISTS conversation_context (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  whatsapp_phone VARCHAR(50),
  conversation_state VARCHAR(50) DEFAULT 'idle' NOT NULL,
  current_course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  current_module_id INTEGER REFERENCES modules(id) ON DELETE SET NULL,
  current_question_index INTEGER DEFAULT 0,
  current_quiz_id INTEGER,
  quiz_answers JSONB DEFAULT '[]'::jsonb,
  quiz_started_at TIMESTAMP WITH TIME ZONE,
  context_data JSONB DEFAULT '{}'::jsonb,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversation_context_user_id
  ON conversation_context(user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_context_whatsapp_phone
  ON conversation_context(whatsapp_phone);

CREATE INDEX IF NOT EXISTS idx_conversation_context_state
  ON conversation_context(conversation_state);

-- Add column comments
COMMENT ON TABLE conversation_context IS
  'Tracks user conversation state for course selection and quiz flows';

COMMENT ON COLUMN conversation_context.conversation_state IS
  'Current state: idle, course_selection, module_selection, learning, quiz_active';

COMMENT ON COLUMN conversation_context.context_data IS
  'Additional context data (course_name, module_name, quiz metadata)';

COMMENT ON COLUMN conversation_context.quiz_answers IS
  'Array of quiz answers: [{questionId, userAnswer, correct, ...}]';

-- Verify migration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'conversation_context'
  ) THEN
    RAISE EXCEPTION 'Migration failed: conversation_context table not created';
  END IF;

  RAISE NOTICE 'Migration 010_create_conversation_context.sql completed successfully';
END $$;
