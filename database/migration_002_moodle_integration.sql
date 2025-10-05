-- Migration 002: Moodle Integration
-- Adds Moodle user mapping to enable WhatsApp quiz sync to Moodle LMS
-- Date: 2025-10-05

-- Add Moodle user mapping columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS moodle_user_id INTEGER,
ADD COLUMN IF NOT EXISTS moodle_username VARCHAR(255);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_moodle_user_id ON users(moodle_user_id);
CREATE INDEX IF NOT EXISTS idx_users_moodle_username ON users(moodle_username);

-- Add comment
COMMENT ON COLUMN users.moodle_user_id IS 'Moodle user ID for quiz sync';
COMMENT ON COLUMN users.moodle_username IS 'Moodle username for quiz sync';
