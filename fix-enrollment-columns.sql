-- Fix Enrollment Schema: Add missing columns to users table
-- This script ensures all enrollment-related columns exist

BEGIN;

-- Show current schema before changes
SELECT 'BEFORE: Checking existing columns...' as status;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('enrollment_pin', 'enrollment_status', 'pin_attempts',
                       'pin_expires_at', 'enrolled_by', 'enrolled_at', 'is_verified')
ORDER BY column_name;

-- Add enrollment columns if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS enrollment_pin VARCHAR(60);
ALTER TABLE users ADD COLUMN IF NOT EXISTS enrollment_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_attempts INTEGER DEFAULT 3;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS enrolled_by INTEGER REFERENCES admin_users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Create index for faster lookup by enrollment status
CREATE INDEX IF NOT EXISTS idx_users_enrollment_status ON users(enrollment_status);

-- Create enrollment_history table for audit trail
CREATE TABLE IF NOT EXISTS enrollment_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'enrolled', 'pin_verified', 'pin_failed', 'blocked', 'pin_reset'
  performed_by INTEGER REFERENCES admin_users(id),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrollment_history_user_id ON enrollment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_history_action ON enrollment_history(action);

-- Update existing users to 'active' status if they're already verified or created before
UPDATE users
SET enrollment_status = 'active',
    is_verified = true,
    pin_attempts = 3
WHERE is_verified = true OR created_at < NOW() - INTERVAL '1 day';

-- Set pending status for users without status
UPDATE users
SET enrollment_status = 'pending',
    pin_attempts = 3
WHERE enrollment_status IS NULL;

-- Drop constraint if exists (to recreate it)
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_enrollment_status;

-- Add constraint to ensure enrollment_status is valid
ALTER TABLE users
ADD CONSTRAINT check_enrollment_status
CHECK (enrollment_status IN ('pending', 'active', 'blocked'));

-- Show schema after changes
SELECT 'AFTER: All enrollment columns now exist:' as status;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('enrollment_pin', 'enrollment_status', 'pin_attempts',
                       'pin_expires_at', 'enrolled_by', 'enrolled_at', 'is_verified')
ORDER BY column_name;

-- Show enrollment_history table status
SELECT 'Enrollment history table:' as status;
SELECT table_name,
       (SELECT COUNT(*) FROM enrollment_history) as row_count
FROM information_schema.tables
WHERE table_name = 'enrollment_history';

COMMIT;

SELECT '✅ Enrollment schema migration complete!' as message;
