-- Migration: Add source tracking columns (non-breaking)
-- This migration adds source tracking to support both Moodle and Portal courses

-- Add source column to moodle_courses (default to 'moodle' for existing data)
ALTER TABLE moodle_courses
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'moodle' NOT NULL;

-- Add source column to moodle_modules (default to 'moodle' for existing data)
ALTER TABLE moodle_modules
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'moodle' NOT NULL;

-- Add source column to quiz_questions (default to 'moodle' for existing data)
ALTER TABLE quiz_questions
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'moodle' NOT NULL;

-- Add optional portal-specific fields to courses
ALTER TABLE moodle_courses
ADD COLUMN IF NOT EXISTS portal_created_by INT,
ADD COLUMN IF NOT EXISTS portal_created_at TIMESTAMP;

-- Add optional portal-specific fields to modules
ALTER TABLE moodle_modules
ADD COLUMN IF NOT EXISTS portal_created_by INT,
ADD COLUMN IF NOT EXISTS portal_created_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS content_file_path TEXT;

-- Create content_sources tracking table
CREATE TABLE IF NOT EXISTS content_sources (
    id SERIAL PRIMARY KEY,
    course_id INT REFERENCES moodle_courses(id) ON DELETE CASCADE,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('moodle', 'portal')),
    source_url TEXT,
    source_file_path TEXT,
    last_synced_at TIMESTAMP,
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed', 'processing')),
    sync_error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster source queries
CREATE INDEX IF NOT EXISTS idx_courses_source ON moodle_courses(source);
CREATE INDEX IF NOT EXISTS idx_modules_source ON moodle_modules(source);
CREATE INDEX IF NOT EXISTS idx_content_sources_course ON content_sources(course_id);

-- Update existing Moodle data to have correct source tag
UPDATE moodle_courses
SET source = 'moodle'
WHERE moodle_course_id IS NOT NULL AND source IS NULL;

UPDATE moodle_modules
SET source = 'moodle'
WHERE moodle_module_id IS NOT NULL AND source IS NULL;

UPDATE quiz_questions
SET source = 'moodle'
WHERE module_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN moodle_courses.source IS 'Source of the course: moodle or portal';
COMMENT ON COLUMN moodle_modules.source IS 'Source of the module: moodle or portal';
COMMENT ON TABLE content_sources IS 'Tracks sync status and metadata for courses from different sources';
