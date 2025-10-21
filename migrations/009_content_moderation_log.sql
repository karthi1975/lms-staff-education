-- Migration: Content Moderation Log Table
-- Purpose: Track all blocked/flagged messages for review and compliance
-- Version: 009
-- Date: 2025-10-21

-- Create content moderation log table
CREATE TABLE IF NOT EXISTS content_moderation_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_phone VARCHAR(20),
    message TEXT NOT NULL,
    moderation_reason VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    blocked_by VARCHAR(20) NOT NULL CHECK (blocked_by IN ('local_filter', 'vertex_ai')),
    category VARCHAR(50),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX idx_moderation_log_user_id ON content_moderation_log(user_id);
CREATE INDEX idx_moderation_log_user_phone ON content_moderation_log(user_phone);
CREATE INDEX idx_moderation_log_created_at ON content_moderation_log(created_at DESC);
CREATE INDEX idx_moderation_log_severity ON content_moderation_log(severity);
CREATE INDEX idx_moderation_log_category ON content_moderation_log(category);
CREATE INDEX idx_moderation_log_blocked_by ON content_moderation_log(blocked_by);

-- Create composite index for common queries
CREATE INDEX idx_moderation_log_stats ON content_moderation_log(category, severity, blocked_by, created_at DESC);

-- Add comment to table
COMMENT ON TABLE content_moderation_log IS 'Logs all blocked or flagged messages for content moderation review and compliance';

-- Add comments to columns
COMMENT ON COLUMN content_moderation_log.user_id IS 'Reference to user who sent the message (NULL for unauthenticated)';
COMMENT ON COLUMN content_moderation_log.user_phone IS 'Phone number of user (for WhatsApp users)';
COMMENT ON COLUMN content_moderation_log.message IS 'The original message that was flagged';
COMMENT ON COLUMN content_moderation_log.moderation_reason IS 'Why the message was flagged (profanity, violence, etc.)';
COMMENT ON COLUMN content_moderation_log.severity IS 'Severity level: low, medium, high, critical';
COMMENT ON COLUMN content_moderation_log.blocked_by IS 'Which system flagged it: local_filter or vertex_ai';
COMMENT ON COLUMN content_moderation_log.category IS 'Specific category of violation (suicide, threats, etc.)';
COMMENT ON COLUMN content_moderation_log.metadata IS 'Additional metadata (Vertex AI safety ratings, etc.)';

-- Grant permissions
GRANT SELECT, INSERT ON content_moderation_log TO teachers_user;
GRANT USAGE, SELECT ON SEQUENCE content_moderation_log_id_seq TO teachers_user;
