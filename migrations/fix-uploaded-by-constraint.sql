-- Fix course_content.uploaded_by foreign key constraint
-- Issue: Admin users (from admin_users table) can't upload files because
-- uploaded_by references users table (WhatsApp users)

-- Solution: Make uploaded_by nullable so admins can upload without FK constraint issues

-- Step 1: Make uploaded_by nullable
ALTER TABLE course_content
ALTER COLUMN uploaded_by DROP NOT NULL;

-- Note: We keep the foreign key constraint. When uploaded_by is NULL,
-- it means the content was uploaded by an admin (system upload).
-- When uploaded_by has a value, it references a WhatsApp user.

-- Step 2: Add a comment for clarity
COMMENT ON COLUMN course_content.uploaded_by IS 'References users.id for WhatsApp user uploads. NULL for admin/system uploads.';
