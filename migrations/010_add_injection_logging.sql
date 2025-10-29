-- Migration: Add Prompt Injection Logging Table
-- Date: 2025-10-21
-- Purpose: Track and monitor prompt injection attempts for security

-- Create table for logging injection attempts
CREATE TABLE IF NOT EXISTS content_injection_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_phone VARCHAR(20),
  message TEXT NOT NULL,
  injection_pattern VARCHAR(255) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  blocked BOOLEAN DEFAULT true,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_injection_user ON content_injection_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_injection_phone ON content_injection_log(user_phone) WHERE user_phone IS NOT NULL;
CREATE INDEX idx_injection_severity ON content_injection_log(severity);
CREATE INDEX idx_injection_created ON content_injection_log(created_at DESC);
CREATE INDEX idx_injection_pattern ON content_injection_log(injection_pattern);

-- Create view for security monitoring
CREATE OR REPLACE VIEW injection_summary AS
SELECT
  DATE(created_at) as attack_date,
  injection_pattern,
  severity,
  COUNT(*) as attempt_count,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT user_phone) as unique_phones
FROM content_injection_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), injection_pattern, severity
ORDER BY attack_date DESC, attempt_count DESC;

-- Grant permissions
GRANT SELECT, INSERT ON content_injection_log TO teachers_user;
GRANT SELECT ON injection_summary TO teachers_user;

COMMENT ON TABLE content_injection_log IS 'Logs all prompt injection and jailbreak attempts for security monitoring';
COMMENT ON COLUMN content_injection_log.injection_pattern IS 'Type of injection detected (e.g., instruction_override, role_hijacking)';
COMMENT ON COLUMN content_injection_log.severity IS 'Severity level: low, medium, high, critical';
COMMENT ON COLUMN content_injection_log.blocked IS 'Whether the attempt was successfully blocked';
