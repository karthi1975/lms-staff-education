-- Migration 010: Multi-Region RBAC System
-- Created: 2025-10-30
-- Updated: 2025-10-30 (Simplified course-region relationship)
-- Purpose: Implement role-based access control with regional restrictions
--
-- CONFIRMED REQUIREMENTS:
-- 1. Use existing PostgreSQL database
-- 2. CSV upload limit: 5,000 users
-- 3. WhatsApp rate limit: 60 notifications/minute
-- 4. Auto-assign existing users to Tanzania (changeable by Super Admin)
-- 5. Super Admin manually assigns courses to regions
-- 6. Only Super Admin creates new admins
-- 7. One course = One region (or "All Regions") - NO multi-region courses

-- ============================================
-- 1. ROLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(50) UNIQUE NOT NULL, -- 'super_admin', 'admin', 'user'
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  level INTEGER NOT NULL, -- 1=super_admin, 2=admin, 3=user
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles
INSERT OR IGNORE INTO roles (name, display_name, description, level) VALUES
  ('super_admin', 'Super Administrator', 'Full system access across all regions', 1),
  ('admin', 'Regional Administrator', 'Manage courses and users within assigned regions', 2),
  ('user', 'Learner', 'Access enrolled courses', 3);

-- ============================================
-- 2. REGIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code VARCHAR(10) UNIQUE NOT NULL, -- 'TZ', 'RW', 'KE', 'BI', 'ALL'
  name VARCHAR(100) NOT NULL, -- 'Tanzania', 'Rwanda', etc.
  description TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default regions
INSERT OR IGNORE INTO regions (code, name, description) VALUES
  ('TZ', 'Tanzania', 'United Republic of Tanzania'),
  ('RW', 'Rwanda', 'Republic of Rwanda'),
  ('KE', 'Kenya', 'Republic of Kenya'),
  ('BI', 'Burundi', 'Republic of Burundi'),
  ('ALL', 'All Regions', 'System-wide access (no regional restrictions)');

-- ============================================
-- 3. ADMIN-REGION ASSIGNMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS admin_regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  region_id INTEGER NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by INTEGER, -- Super Admin who assigned
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, region_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_regions_user ON admin_regions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_regions_region ON admin_regions(region_id);

-- ============================================
-- 4. COURSE CHATBOT PROMPTS
-- ============================================
-- NOTE: Course-region assignment is now handled by courses.region_id column
-- One course = One region (or "All Regions")
-- No multi-region courses allowed per requirement #7
-- ============================================
CREATE TABLE IF NOT EXISTS course_chatbot_prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL UNIQUE,
  system_prompt TEXT NOT NULL,
  instruction_style VARCHAR(50) DEFAULT 'conversational', -- conversational, formal, casual
  language_preference VARCHAR(50) DEFAULT 'english', -- english, swahili, bilingual
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chatbot_prompts_course ON course_chatbot_prompts(course_id);

-- ============================================
-- 6. ENROLLMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  enrolled_by INTEGER, -- Admin who enrolled them
  enrollment_method VARCHAR(20) DEFAULT 'manual', -- 'manual', 'csv_upload', 'self'
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'suspended', 'completed', 'removed'
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  removed_at TIMESTAMP,
  removed_by INTEGER,
  removal_reason TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (enrolled_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (removed_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_enrolled_by ON enrollments(enrolled_by);

-- ============================================
-- 7. ENROLLMENT HISTORY (Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS enrollment_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id INTEGER NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'enrolled', 'suspended', 'completed', 'removed', 'reactivated'
  performed_by INTEGER,
  reason TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_enrollment_history_enrollment ON enrollment_history(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_history_timestamp ON enrollment_history(timestamp DESC);

-- ============================================
-- 8. CSV UPLOAD LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS csv_upload_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uploaded_by INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  filename VARCHAR(255) NOT NULL,
  total_rows INTEGER NOT NULL,
  successful_enrollments INTEGER DEFAULT 0,
  failed_enrollments INTEGER DEFAULT 0,
  error_details TEXT, -- JSON array of errors
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_csv_logs_uploaded_by ON csv_upload_logs(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_csv_logs_course ON csv_upload_logs(course_id);
CREATE INDEX IF NOT EXISTS idx_csv_logs_uploaded_at ON csv_upload_logs(uploaded_at DESC);

-- ============================================
-- 9. MODIFY USERS TABLE
-- ============================================
-- Add role_id column (default to 'user' role = 3)
ALTER TABLE users ADD COLUMN role_id INTEGER DEFAULT 3;

-- Add primary_region_id
ALTER TABLE users ADD COLUMN primary_region_id INTEGER;

-- Add full_name (may already exist)
-- Check if column exists before adding
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- So we'll handle this in the migration script

-- Add whatsapp_number (already exists as 'phone')
-- Will use existing 'phone' column

-- Add foreign key constraints (SQLite limitation - cannot add FK to existing table)
-- Will be enforced at application level

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_region ON users(primary_region_id);

-- ============================================
-- 10. MODIFY COURSES TABLE
-- ============================================
-- Add region_id (one course = one region, or "All Regions")
ALTER TABLE courses ADD COLUMN region_id INTEGER;

-- Add use_custom_prompt
ALTER TABLE courses ADD COLUMN use_custom_prompt BOOLEAN DEFAULT 0;

-- Add is_regional (kept for backward compatibility, but region_id is primary)
ALTER TABLE courses ADD COLUMN is_regional BOOLEAN DEFAULT 1;

-- Add created_by
ALTER TABLE courses ADD COLUMN created_by INTEGER;

CREATE INDEX IF NOT EXISTS idx_courses_region ON courses(region_id);
CREATE INDEX IF NOT EXISTS idx_courses_is_regional ON courses(is_regional);
CREATE INDEX IF NOT EXISTS idx_courses_created_by ON courses(created_by);

-- Auto-assign existing courses to "All Regions" (region_id = 5)
-- This will be done manually by Super Admin after migration, so commenting out
-- UPDATE courses SET region_id = 5 WHERE region_id IS NULL;

-- ============================================
-- 11. WHATSAPP NOTIFICATIONS LOG
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  message_type VARCHAR(50) NOT NULL, -- 'enrollment', 'course_update', 'reminder', 'custom'
  message_content TEXT NOT NULL,
  course_id INTEGER,
  sent_by INTEGER,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delivery_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
  twilio_message_sid VARCHAR(100),
  error_message TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON whatsapp_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_course ON whatsapp_notifications(course_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON whatsapp_notifications(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON whatsapp_notifications(delivery_status);

-- ============================================
-- 12. VIEWS FOR EASY QUERYING
-- ============================================

-- View: User with role and region
CREATE VIEW IF NOT EXISTS v_users_with_roles AS
SELECT
  u.id,
  u.email,
  u.phone AS whatsapp_number,
  u.name AS full_name,
  u.role_id,
  r.name AS role_name,
  r.display_name AS role_display_name,
  r.level AS role_level,
  u.primary_region_id,
  reg.code AS region_code,
  reg.name AS region_name,
  u.created_at
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
LEFT JOIN regions reg ON u.primary_region_id = reg.id;

-- View: Courses with regions (simplified - one course = one region)
CREATE VIEW IF NOT EXISTS v_courses_with_regions AS
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
  creator.name AS created_by_name
FROM courses c
LEFT JOIN regions reg ON c.region_id = reg.id
LEFT JOIN users creator ON c.created_by = creator.id;

-- View: Active enrollments with details
CREATE VIEW IF NOT EXISTS v_active_enrollments AS
SELECT
  e.id AS enrollment_id,
  e.user_id,
  u.name AS user_name,
  u.phone AS whatsapp_number,
  e.course_id,
  c.title AS course_title,
  c.code AS course_code,
  e.status,
  e.enrollment_method,
  e.enrolled_at,
  e.enrolled_by,
  admin.name AS enrolled_by_name
FROM enrollments e
JOIN users u ON e.user_id = u.id
JOIN courses c ON e.course_id = c.id
LEFT JOIN users admin ON e.enrolled_by = admin.id
WHERE e.status = 'active';

-- ============================================
-- 13. SEED DEFAULT SUPER ADMIN
-- ============================================
-- Update existing admin user to super_admin role
UPDATE users
SET role_id = 1, -- super_admin
    primary_region_id = 5 -- ALL regions
WHERE email = 'admin@school.edu'
  OR id = (SELECT MIN(id) FROM users WHERE email LIKE '%admin%');

-- ============================================
-- 14. AUTO-ASSIGN EXISTING USERS TO TANZANIA
-- ============================================
-- Per requirement #4: Auto-assign existing users to Tanzania
-- Super Admin can change later if needed
UPDATE users
SET role_id = 3, -- user/learner role
    primary_region_id = 1 -- Tanzania (TZ)
WHERE role_id IS NULL
  OR primary_region_id IS NULL;

-- ============================================
-- 15. REGION MANAGEMENT (Super Admin Only)
-- ============================================
-- Super Admin can add new regions via:
-- INSERT INTO regions (code, name, description) VALUES ('UG', 'Uganda', 'Republic of Uganda');
-- This allows expansion beyond initial 5 regions

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Tables created: 7 new tables (removed course_regions junction table)
-- Tables modified: users, courses
-- Views created: 3
-- Indexes created: 18+
-- Default data seeded: 3 roles, 5 regions
-- Users auto-assigned: Tanzania (changeable by Super Admin)
-- Courses: Manual assignment by Super Admin required
