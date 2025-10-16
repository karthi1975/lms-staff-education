-- Migration 007: PIN Enrollment System
-- Add PIN-based enrollment for WhatsApp users

-- Add new columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS enrollment_pin VARCHAR(60),
ADD COLUMN IF NOT EXISTS enrollment_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS pin_attempts INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS pin_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS enrolled_by INTEGER REFERENCES admin_users(id),
ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMP;

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

-- Update existing users to 'active' status if they're already verified
UPDATE users
SET enrollment_status = 'active',
    is_verified = true,
    pin_attempts = 3
WHERE is_verified = true OR created_at < NOW() - INTERVAL '1 day';

-- Set pending users
UPDATE users
SET enrollment_status = 'pending',
    pin_attempts = 3
WHERE enrollment_status IS NULL;

-- Add constraint to ensure enrollment_status is valid
ALTER TABLE users
ADD CONSTRAINT check_enrollment_status
CHECK (enrollment_status IN ('pending', 'active', 'blocked'));

-- Add comment for documentation
COMMENT ON COLUMN users.enrollment_pin IS 'Bcrypt hashed 4-digit PIN for user verification';
COMMENT ON COLUMN users.enrollment_status IS 'Enrollment status: pending (not verified), active (verified), blocked (failed attempts)';
COMMENT ON COLUMN users.pin_attempts IS 'Remaining PIN verification attempts (max 3)';
COMMENT ON COLUMN users.pin_expires_at IS 'PIN expiration timestamp (optional, 7 days from generation)';
