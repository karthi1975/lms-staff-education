-- Migration 010: Multi-Region RBAC System (PostgreSQL)
-- Created: 2025-10-30
-- Updated: 2025-10-30 (PostgreSQL syntax, merged with existing schema)
-- Purpose: Implement role-based access control with regional restrictions
--
-- CONFIRMED REQUIREMENTS:
-- 1. Use existing PostgreSQL database ✓
-- 2. CSV upload limit: 5,000 users
-- 3. WhatsApp rate limit: 60 notifications/minute
-- 4. Auto-assign existing users to Tanzania (changeable by Super Admin)
-- 5. Super Admin manually assigns courses to regions
-- 6. Only Super Admin creates new admins
-- 7. One course = One region (or "All Regions") - NO multi-region courses

-- ============================================
-- 1. ROLES TABLE (New)
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL, -- 'super_admin', 'admin', 'whatsapp_user'
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  level INTEGER NOT NULL, -- 1=super_admin, 2=admin, 3=whatsapp_user
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (name, display_name, description, level) VALUES
  ('super_admin', 'Super Administrator', 'Full system access across all regions', 1),
  ('admin', 'Regional Administrator', 'Manage courses and users within assigned regions', 2),
  ('whatsapp_user', 'WhatsApp User', 'Access enrolled courses via WhatsApp', 3)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 2. REGIONS TABLE (New)
-- ============================================
CREATE TABLE IF NOT EXISTS regions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL, -- 'TZ', 'RW', 'KE', 'BI', 'ALL'
  name VARCHAR(100) NOT NULL, -- 'Tanzania', 'Rwanda', etc.
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default regions
INSERT INTO regions (code, name, description) VALUES
  ('TZ', 'Tanzania', 'United Republic of Tanzania'),
  ('RW', 'Rwanda', 'Republic of Rwanda'),
  ('KE', 'Kenya', 'Republic of Kenya'),
  ('BI', 'Burundi', 'Republic of Burundi'),
  ('ALL', 'All Regions', 'System-wide access (no regional restrictions)')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 3. ADMIN-REGION ASSIGNMENTS (New)
-- ============================================
CREATE TABLE IF NOT EXISTS admin_regions (
  id SERIAL PRIMARY KEY,
  admin_user_id INTEGER NOT NULL, -- References admin_users (existing table)
  region_id INTEGER NOT NULL,
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by INTEGER, -- Super Admin who assigned (admin_users.id)
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES admin_users(id) ON DELETE SET NULL,
  UNIQUE(admin_user_id, region_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_regions_admin ON admin_regions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_regions_region ON admin_regions(region_id);

-- ============================================
-- 4. COURSE CHATBOT PROMPTS (New)
-- ============================================
CREATE TABLE IF NOT EXISTS course_chatbot_prompts (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL UNIQUE,
  system_prompt TEXT NOT NULL,
  instruction_style VARCHAR(50) DEFAULT 'conversational', -- conversational, formal, casual
  language_preference VARCHAR(50) DEFAULT 'english', -- english, swahili, bilingual
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by INTEGER, -- admin_users.id
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chatbot_prompts_course ON course_chatbot_prompts(course_id);

-- ============================================
-- 5. COURSE REGION ENROLLMENTS (New)
-- ============================================
-- Renamed from 'enrollments' to avoid conflict with existing course_enrollments
CREATE TABLE IF NOT EXISTS course_region_enrollments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL, -- WhatsApp user
  course_id INTEGER NOT NULL,
  enrolled_by INTEGER, -- Admin who enrolled them (admin_users.id)
  enrollment_method VARCHAR(20) DEFAULT 'manual', -- 'manual', 'csv_upload', 'self'
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'suspended', 'completed', 'removed'
  enrolled_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  removed_at TIMESTAMP,
  removed_by INTEGER, -- admin_users.id
  removal_reason TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (enrolled_by) REFERENCES admin_users(id) ON DELETE SET NULL,
  FOREIGN KEY (removed_by) REFERENCES admin_users(id) ON DELETE SET NULL,
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_region_enrollments_user ON course_region_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_region_enrollments_course ON course_region_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_region_enrollments_status ON course_region_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_region_enrollments_enrolled_by ON course_region_enrollments(enrolled_by);

-- ============================================
-- 6. COURSE REGION ENROLLMENT HISTORY (New)
-- ============================================
-- Renamed to avoid conflict with existing enrollment_history
CREATE TABLE IF NOT EXISTS course_region_enrollment_history (
  id SERIAL PRIMARY KEY,
  enrollment_id INTEGER NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'enrolled', 'suspended', 'completed', 'removed', 'reactivated'
  performed_by INTEGER, -- admin_users.id
  reason TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (enrollment_id) REFERENCES course_region_enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (performed_by) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_region_enroll_history_enrollment ON course_region_enrollment_history(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_region_enroll_history_timestamp ON course_region_enrollment_history(timestamp DESC);

-- ============================================
-- 7. CSV UPLOAD LOGS (New)
-- ============================================
CREATE TABLE IF NOT EXISTS csv_upload_logs (
  id SERIAL PRIMARY KEY,
  uploaded_by INTEGER NOT NULL, -- admin_users.id
  course_id INTEGER NOT NULL,
  target_region_id INTEGER NOT NULL, -- Region assigned to uploaded users
  filename VARCHAR(255) NOT NULL,
  total_rows INTEGER NOT NULL,
  successful_enrollments INTEGER DEFAULT 0,
  failed_enrollments INTEGER DEFAULT 0,
  error_details TEXT, -- JSON array of errors
  uploaded_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (uploaded_by) REFERENCES admin_users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (target_region_id) REFERENCES regions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_csv_logs_uploaded_by ON csv_upload_logs(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_csv_logs_course ON csv_upload_logs(course_id);
CREATE INDEX IF NOT EXISTS idx_csv_logs_uploaded_at ON csv_upload_logs(uploaded_at DESC);

-- ============================================
-- 8. WHATSAPP NOTIFICATIONS LOG (New)
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  message_type VARCHAR(50) NOT NULL, -- 'enrollment', 'course_update', 'reminder', 'custom'
  message_content TEXT NOT NULL,
  course_id INTEGER,
  sent_by INTEGER, -- admin_users.id
  sent_at TIMESTAMP DEFAULT NOW(),
  delivery_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
  twilio_message_sid VARCHAR(100),
  error_message TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  FOREIGN KEY (sent_by) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON whatsapp_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_course ON whatsapp_notifications(course_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON whatsapp_notifications(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON whatsapp_notifications(delivery_status);

-- ============================================
-- 9. MODIFY ADMIN_USERS TABLE (Existing)
-- ============================================
-- Add role_id column linking to roles table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='admin_users' AND column_name='role_id') THEN
    ALTER TABLE admin_users ADD COLUMN role_id INTEGER;
    CREATE INDEX idx_admin_users_role ON admin_users(role_id);
    -- Note: Cannot add FK constraint to existing column easily in PostgreSQL
    -- Will be enforced at application level
  END IF;
END $$;

-- Add primary_region_id for regional admins
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='admin_users' AND column_name='primary_region_id') THEN
    ALTER TABLE admin_users ADD COLUMN primary_region_id INTEGER;
    CREATE INDEX idx_admin_users_primary_region ON admin_users(primary_region_id);
  END IF;
END $$;

-- ============================================
-- 10. MODIFY USERS TABLE (Existing)
-- ============================================
-- Add role_id column (default to whatsapp_user role = 3)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='users' AND column_name='role_id') THEN
    ALTER TABLE users ADD COLUMN role_id INTEGER DEFAULT 3;
    CREATE INDEX idx_users_role ON users(role_id);
  END IF;
END $$;

-- Add primary_region_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='users' AND column_name='primary_region_id') THEN
    ALTER TABLE users ADD COLUMN primary_region_id INTEGER;
    CREATE INDEX idx_users_primary_region ON users(primary_region_id);
  END IF;
END $$;

-- Note: phone column already exists (used for whatsapp_id)
-- Note: name column already exists (used for full_name)

-- ============================================
-- 11. MODIFY COURSES TABLE (Existing)
-- ============================================
-- Add region_id (one course = one region, or "All Regions")
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='courses' AND column_name='region_id') THEN
    ALTER TABLE courses ADD COLUMN region_id INTEGER;
    CREATE INDEX idx_courses_region ON courses(region_id);
  END IF;
END $$;

-- Add use_custom_prompt
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='courses' AND column_name='use_custom_prompt') THEN
    ALTER TABLE courses ADD COLUMN use_custom_prompt BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add is_regional (kept for backward compatibility)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='courses' AND column_name='is_regional') THEN
    ALTER TABLE courses ADD COLUMN is_regional BOOLEAN DEFAULT TRUE;
    CREATE INDEX idx_courses_is_regional ON courses(is_regional);
  END IF;
END $$;

-- Add created_by (references admin_users)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='courses' AND column_name='created_by') THEN
    ALTER TABLE courses ADD COLUMN created_by INTEGER;
    CREATE INDEX idx_courses_created_by ON courses(created_by);
  END IF;
END $$;

-- ============================================
-- 12. VIEWS FOR EASY QUERYING
-- ============================================

-- View: Admin users with role and region
CREATE OR REPLACE VIEW v_admin_users_with_roles AS
SELECT
  a.id,
  a.email,
  a.name AS full_name,
  a.role AS legacy_role, -- Keep existing ENUM role
  a.role_id,
  r.name AS new_role_name,
  r.display_name AS role_display_name,
  r.level AS role_level,
  a.primary_region_id,
  reg.code AS region_code,
  reg.name AS region_name,
  a.is_active,
  a.created_at,
  a.last_login_at
FROM admin_users a
LEFT JOIN roles r ON a.role_id = r.id
LEFT JOIN regions reg ON a.primary_region_id = reg.id;

-- View: WhatsApp users with role and region
CREATE OR REPLACE VIEW v_users_with_roles AS
SELECT
  u.id,
  u.whatsapp_id,
  u.name AS full_name,
  u.role_id,
  r.name AS role_name,
  r.display_name AS role_display_name,
  r.level AS role_level,
  u.primary_region_id,
  reg.code AS region_code,
  reg.name AS region_name,
  u.is_active,
  u.created_at,
  u.last_active_at
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
LEFT JOIN regions reg ON u.primary_region_id = reg.id;

-- View: Courses with regions (simplified - one course = one region)
CREATE OR REPLACE VIEW v_courses_with_regions AS
SELECT
  c.id AS course_id,
  c.title,
  c.code,
  c.region_id,
  c.is_regional,
  c.use_custom_prompt,
  c.created_by,
  reg.code AS region_code,
  reg.name AS region_name,
  creator.name AS created_by_name,
  c.is_active,
  c.created_at
FROM courses c
LEFT JOIN regions reg ON c.region_id = reg.id
LEFT JOIN admin_users creator ON c.created_by = creator.id;

-- View: Active region enrollments with details
CREATE OR REPLACE VIEW v_active_region_enrollments AS
SELECT
  e.id AS enrollment_id,
  e.user_id,
  u.name AS user_name,
  u.whatsapp_id,
  e.course_id,
  c.title AS course_title,
  c.code AS course_code,
  c.region_id,
  reg.name AS course_region_name,
  e.status,
  e.enrollment_method,
  e.enrolled_at,
  e.enrolled_by,
  admin.name AS enrolled_by_name
FROM course_region_enrollments e
JOIN users u ON e.user_id = u.id
JOIN courses c ON e.course_id = c.id
LEFT JOIN regions reg ON c.region_id = reg.id
LEFT JOIN admin_users admin ON e.enrolled_by = admin.id
WHERE e.status = 'active';

-- ============================================
-- 13. SEED DEFAULT SUPER ADMIN
-- ============================================
-- Update existing admin user to super_admin role
UPDATE admin_users
SET role_id = 1, -- super_admin
    primary_region_id = 5 -- ALL regions
WHERE email = 'admin@school.edu'
  AND role_id IS NULL;

-- If no admin@school.edu, update first admin
UPDATE admin_users
SET role_id = 1, -- super_admin
    primary_region_id = 5 -- ALL regions
WHERE id = (SELECT MIN(id) FROM admin_users WHERE role = 'admin')
  AND role_id IS NULL;

-- ============================================
-- 14. AUTO-ASSIGN EXISTING USERS TO TANZANIA
-- ============================================
-- Per requirement #4: Auto-assign existing WhatsApp users to Tanzania
-- Super Admin can change later if needed
UPDATE users
SET role_id = 3, -- whatsapp_user role
    primary_region_id = 1 -- Tanzania (TZ)
WHERE role_id IS NULL OR primary_region_id IS NULL;

-- ============================================
-- 15. GRANT PERMISSIONS (Optional, depends on setup)
-- ============================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO teachers_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO teachers_user;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Tables created: 7 new tables
--   - roles
--   - regions
--   - admin_regions
--   - course_chatbot_prompts
--   - course_region_enrollments (renamed from enrollments)
--   - course_region_enrollment_history (renamed)
--   - csv_upload_logs
--   - whatsapp_notifications
--
-- Tables modified: admin_users, users, courses
--   - admin_users: added role_id, primary_region_id
--   - users: added role_id, primary_region_id
--   - courses: added region_id, use_custom_prompt, is_regional, created_by
--
-- Views created: 4
--   - v_admin_users_with_roles
--   - v_users_with_roles
--   - v_courses_with_regions
--   - v_active_region_enrollments
--
-- Indexes created: 25+
-- Default data seeded: 3 roles, 5 regions
-- Users auto-assigned: Tanzania (changeable by Super Admin)
-- Courses: Manual assignment by Super Admin required
--
-- NOTES:
-- 1. Merged with existing schema (admin_users, users, courses, enrollment_history)
-- 2. Renamed tables to avoid conflicts (course_region_enrollments)
-- 3. Foreign keys reference admin_users for admin actions
-- 4. Uses PostgreSQL syntax (SERIAL, NOW(), DO blocks)
-- 5. Safe to run multiple times (IF NOT EXISTS checks)
