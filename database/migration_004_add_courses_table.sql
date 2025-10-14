-- Migration 004: Add courses table and fix schema structure
-- Purpose: Create proper courses table and ensure modules table uses course_id foreign key
-- Date: 2025-10-13

-- =====================================================================
-- STEP 1: Create courses table
-- =====================================================================

CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  difficulty_level VARCHAR(50) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  duration_weeks INTEGER,
  sequence_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code);
CREATE INDEX IF NOT EXISTS idx_courses_active ON courses(is_active);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);

-- =====================================================================
-- STEP 2: Ensure modules table has course_id foreign key
-- =====================================================================

-- Check if course_id column exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modules' AND column_name = 'course_id'
  ) THEN
    ALTER TABLE modules ADD COLUMN course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE;
    CREATE INDEX idx_modules_course_id ON modules(course_id);
  END IF;
END $$;

-- =====================================================================
-- STEP 3: Update modules table structure to match requirements
-- =====================================================================

-- Ensure all necessary columns exist in modules table
DO $$
BEGIN
  -- Add code column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modules' AND column_name = 'code'
  ) THEN
    ALTER TABLE modules ADD COLUMN code VARCHAR(50) UNIQUE;
  END IF;

  -- Add duration_weeks column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modules' AND column_name = 'duration_weeks'
  ) THEN
    ALTER TABLE modules ADD COLUMN duration_weeks INTEGER DEFAULT 2;
  END IF;

  -- Add is_active column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modules' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE modules ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_modules_code ON modules(code);
CREATE INDEX IF NOT EXISTS idx_modules_sequence ON modules(sequence_order);
CREATE INDEX IF NOT EXISTS idx_modules_active ON modules(is_active);

-- =====================================================================
-- STEP 4: Update module_content table to reference modules correctly
-- =====================================================================

-- Ensure module_content uses module_id (not moodle_module_id)
DO $$
BEGIN
  -- Add module_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'module_content' AND column_name = 'module_id'
  ) THEN
    ALTER TABLE module_content ADD COLUMN module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE;
    CREATE INDEX idx_module_content_module_id ON module_content(module_id);
  END IF;
END $$;

-- =====================================================================
-- STEP 5: Update module_content_chunks to reference modules correctly
-- =====================================================================

DO $$
BEGIN
  -- Add module_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'module_content_chunks' AND column_name = 'module_id'
  ) THEN
    ALTER TABLE module_content_chunks ADD COLUMN module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE;
    CREATE INDEX idx_module_content_chunks_module_id ON module_content_chunks(module_id);
  END IF;
END $$;

-- =====================================================================
-- STEP 6: Update trigger for courses updated_at
-- =====================================================================

CREATE OR REPLACE FUNCTION update_courses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW
  EXECUTE FUNCTION update_courses_updated_at();

-- =====================================================================
-- STEP 7: Comments for documentation
-- =====================================================================

COMMENT ON TABLE courses IS 'Main courses table for organizing training modules';
COMMENT ON COLUMN courses.code IS 'Unique course code (e.g., BSTT-001)';
COMMENT ON COLUMN courses.difficulty_level IS 'Course difficulty: beginner, intermediate, or advanced';
COMMENT ON COLUMN courses.sequence_order IS 'Order in which courses should be displayed';

COMMENT ON COLUMN modules.course_id IS 'Foreign key to courses table';
COMMENT ON COLUMN modules.code IS 'Unique module code (e.g., BSTT-001-M01)';
COMMENT ON COLUMN modules.duration_weeks IS 'Estimated duration in weeks for this module';

-- =====================================================================
-- Migration complete
-- =====================================================================
