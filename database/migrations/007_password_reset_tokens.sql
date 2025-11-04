-- ============================================================================
-- Migration 007: Password Reset Tokens (Security Fix)
-- ============================================================================
-- Description: Adds password reset tokens table to replace plain text
--              password returns in API responses
-- Security Fix: Addresses BE-001 critical vulnerability
-- Date: 2025-11-03
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABLE: Password Reset Tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  admin_user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_by INTEGER NOT NULL REFERENCES admin_users(id), -- Super Admin who created it
  created_at TIMESTAMP DEFAULT NOW(),
  ip_address INET, -- IP where token was created
  user_agent TEXT  -- Browser info for audit
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON password_reset_tokens(expires_at);

-- Comments
COMMENT ON TABLE password_reset_tokens IS 'Secure password reset tokens with expiration';
COMMENT ON COLUMN password_reset_tokens.token IS 'Cryptographically secure random token (SHA-256)';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Token expiration (typically 1 hour from creation)';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'When token was used (null if unused)';
COMMENT ON COLUMN password_reset_tokens.created_by IS 'Super Admin who triggered the reset';

-- ============================================================================
-- CLEANUP: Remove expired tokens (run daily)
-- ============================================================================
-- Note: Add this to a cron job or scheduled task
-- DELETE FROM password_reset_tokens WHERE expires_at < NOW() AND used_at IS NULL;

COMMIT;

-- Verification
SELECT
  'Migration 007 - Password Reset Tokens - COMPLETED' AS status,
  COUNT(*) AS tokens_count
FROM password_reset_tokens;
