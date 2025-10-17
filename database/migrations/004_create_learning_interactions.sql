-- Migration: Create learning_interactions table
-- Purpose: Track user learning interactions for analytics and coaching

CREATE TABLE IF NOT EXISTS learning_interactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  moodle_module_id INTEGER REFERENCES modules(id) ON DELETE SET NULL,
  interaction_type VARCHAR(50) NOT NULL DEFAULT 'question',
  user_message TEXT,
  bot_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_learning_interactions_user_id ON learning_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_interactions_module_id ON learning_interactions(moodle_module_id);
CREATE INDEX IF NOT EXISTS idx_learning_interactions_type ON learning_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_learning_interactions_created_at ON learning_interactions(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE learning_interactions IS 'Tracks user learning interactions for analytics, coaching, and personalization';
COMMENT ON COLUMN learning_interactions.user_id IS 'Reference to the user who made the interaction';
COMMENT ON COLUMN learning_interactions.moodle_module_id IS 'Reference to the module being studied (nullable)';
COMMENT ON COLUMN learning_interactions.interaction_type IS 'Type of interaction: question, answer, reflection, etc.';
COMMENT ON COLUMN learning_interactions.user_message IS 'The user''s message or query';
COMMENT ON COLUMN learning_interactions.bot_response IS 'The system''s response';
COMMENT ON COLUMN learning_interactions.metadata IS 'Additional metadata (RAG sources, confidence scores, etc.)';
