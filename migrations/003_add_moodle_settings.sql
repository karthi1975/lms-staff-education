-- Migration: Add Moodle connection settings table
-- This migration creates a table to store Moodle connection configuration

-- Create moodle_settings table
CREATE TABLE IF NOT EXISTS moodle_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(20) DEFAULT 'string' CHECK (setting_type IN ('string', 'boolean', 'number', 'secret')),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by INT REFERENCES users(id) ON DELETE SET NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_moodle_settings_key ON moodle_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_moodle_settings_active ON moodle_settings(is_active);

-- Insert default Moodle settings from .env
INSERT INTO moodle_settings (setting_key, setting_value, setting_type, description, is_active) VALUES
    ('moodle_url', 'https://karthitest.moodlecloud.com', 'string', 'Moodle instance URL', true),
    ('moodle_token', 'c0ee6baca141679fdd6793ad397e6f21', 'secret', 'Moodle web service token', true),
    ('moodle_sync_enabled', 'true', 'boolean', 'Enable/disable Moodle synchronization', true)
ON CONFLICT (setting_key) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE moodle_settings IS 'Stores Moodle connection configuration and settings';
COMMENT ON COLUMN moodle_settings.setting_type IS 'Type of setting: string, boolean, number, or secret (for sensitive data)';
COMMENT ON COLUMN moodle_settings.is_active IS 'Whether this setting is currently active';
