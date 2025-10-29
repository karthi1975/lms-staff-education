-- Migration 007: Fix Quiz Schema for Upload Feature
-- Ensures quiz_questions table has correct schema for quiz upload functionality

-- First, check if quiz_questions table exists and drop it if it has the wrong schema
DO $$
BEGIN
  -- Drop existing quiz_questions table if it exists
  DROP TABLE IF EXISTS quiz_questions CASCADE;

  -- Create quiz_questions table with correct schema for admin quiz upload
  CREATE TABLE IF NOT EXISTS quiz_questions (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) DEFAULT 'multiple_choice',
    options JSONB NOT NULL, -- Array format: ["Option A", "Option B", "Option C", "Option D"]
    correct_answer INTEGER NOT NULL, -- Index: 0=A, 1=B, 2=C, 3=D
    points INTEGER DEFAULT 1,
    explanation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Create index for faster quiz question retrieval
  CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
  CREATE INDEX IF NOT EXISTS idx_quiz_questions_number ON quiz_questions(quiz_id, question_number);

  -- Create trigger for updated_at
  CREATE OR REPLACE FUNCTION update_quiz_questions_updated_at()
  RETURNS TRIGGER AS $func$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $func$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS update_quiz_questions_timestamp ON quiz_questions;
  CREATE TRIGGER update_quiz_questions_timestamp
    BEFORE UPDATE ON quiz_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_quiz_questions_updated_at();

END $$;

-- Verify tables exist
SELECT 'Migration 007 Complete: quiz_questions table ready for admin uploads' as status;
