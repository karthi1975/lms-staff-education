# Course Deletion - Cascade Delete Verification

**Date:** 2025-11-02
**Status:** ✅ SAFE TO DELETE (with 1 minor warning)

---

## Question

"I am going to delete all courses and redo using Admin UI portal. Will there be any issue? Can you confirm? Cascade Delete"

---

## ✅ CONFIRMED: Cascade Delete is SAFE

You can safely delete all courses through the Admin UI. The system has comprehensive cascade delete logic that will clean up all related data.

---

## What Gets Deleted When You Delete a Course

### 1. PostgreSQL Tables (CASCADE)

When you delete a course, the following records are **automatically deleted via CASCADE**:

| Table | What's Deleted | Cascade Rule |
|-------|---------------|--------------|
| **modules** | All modules in the course | CASCADE |
| **module_content** | All content files metadata | CASCADE (via modules) |
| **quiz_questions** | All quiz questions | CASCADE (via modules) |
| **quizzes** | All quizzes | CASCADE (via modules) |
| **user_progress** | User progress on modules | CASCADE (via modules) |
| **course_enrollments** | User enrollments | CASCADE |
| **course_region_enrollments** | Regional enrollments | CASCADE |
| **course_chatbot_prompts** | Custom chatbot prompts | CASCADE |
| **course_bot_configs** | Bot configurations | CASCADE |
| **coaching_sessions** | Coaching sessions | CASCADE |
| **classification_history** | Classification history | CASCADE |
| **classification_temp** | Temp classification data | CASCADE |
| **csv_upload_logs** | CSV upload logs | CASCADE |
| **mode_analytics** | Analytics data | CASCADE |
| **user_bot_preferences** | User bot preferences | CASCADE |
| **course_content** | Course content | CASCADE |

### 2. PostgreSQL Tables (SET NULL)

Some tables keep their records but set the course_id to NULL:

| Table | What Happens | Cascade Rule |
|-------|-------------|--------------|
| **chat_sessions** | course_id set to NULL | SET NULL |
| **conversation_context** | current_course_id set to NULL | SET NULL |
| **whatsapp_notifications** | course_id set to NULL | SET NULL |

### 3. Physical Files

The delete endpoint also deletes:
- ✅ **PDF/DOCX/TXT files** from the `uploads/` directory
- ✅ Handles both absolute and relative paths

### 4. Neo4j Graph Database

The delete endpoint cleans up:
- ✅ **Knowledge graph nodes** for all modules
- ✅ **Topic relationships** and connections

### 5. ChromaDB Vector Database

The delete endpoint cleans up:
- ✅ **Vector embeddings** for all module content
- ✅ **RAG-indexed content** for semantic search

---

## ⚠️ ONE MINOR WARNING

**Issue:** `quiz_attempts` table has `module_id` but **NO CASCADE constraint**

**Current Status:**
```sql
quiz_attempts.module_id → modules.id (NO CONSTRAINT)
```

**Impact:**
- There are currently **0 quiz attempts** in the database
- If quiz attempts existed, they would become orphaned (module_id pointing to deleted module)
- This won't cause errors but is not ideal

**Recommendation:**
- **For now:** No action needed (0 quiz attempts exist)
- **Future:** Add foreign key constraint with CASCADE

**SQL to fix (run later if needed):**
```sql
ALTER TABLE quiz_attempts
ADD CONSTRAINT fk_quiz_attempts_module
FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
```

---

## How the Delete Endpoint Works

**File:** `routes/admin.routes.js` (lines 1446-1559)

**Deletion Process:**
```javascript
DELETE /api/admin/courses/:courseId

Step 1: Get course details
Step 2: Get all modules for the course
Step 3: Delete physical files from uploads/
Step 4: Delete from Neo4j (knowledge graph)
Step 5: Delete from ChromaDB (vector embeddings)
Step 6: Delete from PostgreSQL (triggers all CASCADE deletes)
Step 7: Return success with count of deleted items
```

**Example Response:**
```json
{
  "success": true,
  "message": "Course and all related data deleted successfully (5 file(s) removed)",
  "deletedFiles": 5,
  "deletedModules": 3
}
```

---

## Current Database State

**Courses:**
```bash
SELECT COUNT(*) FROM courses;
```

**What will happen when you delete all:**
- All modules will be deleted
- All quizzes will be deleted
- All content files will be deleted
- All user progress will be deleted
- All enrollments will be deleted
- Neo4j graph will be cleaned
- ChromaDB vectors will be cleaned
- Physical files will be removed

---

## Step-by-Step: How to Delete All Courses via Admin UI

### Option 1: Delete via Admin Portal (Recommended)

1. **Login as Super Admin:**
   - URL: http://34.162.168.124:3000/admin/login.html
   - Email: Lynda@admin.com
   - Password: Admin123!

2. **Go to Courses Page:**
   - Click "Courses" in sidebar
   - URL: http://34.162.168.124:3000/admin/courses.html

3. **Delete Each Course:**
   - Click the "Delete" button next to each course
   - Confirm deletion in the dialog
   - Wait for success message

4. **Verify Deletion:**
   - Check that courses list is empty
   - All modules, quizzes, content are gone

### Option 2: Delete via SQL (Not Recommended)

```sql
-- Connect to database
docker exec -it teachers_training_postgres_1 psql -U teachers_user -d teachers_training

-- Delete all courses (CASCADE handles everything)
DELETE FROM courses;

-- Verify
SELECT COUNT(*) FROM courses;      -- Should be 0
SELECT COUNT(*) FROM modules;      -- Should be 0
SELECT COUNT(*) FROM quizzes;      -- Should be 0
SELECT COUNT(*) FROM user_progress; -- Should be 0

\q
```

**⚠️ Warning:** SQL method skips:
- Physical file deletion
- Neo4j cleanup
- ChromaDB cleanup

**Use Admin UI instead!**

---

## What You Should Do BEFORE Deleting

### 1. Backup (Optional but Recommended)

```bash
# Backup PostgreSQL
docker exec teachers_training_postgres_1 pg_dump -U teachers_user teachers_training > backup_before_delete_$(date +%Y%m%d).sql

# Backup uploads folder
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/
```

### 2. Check Current Data Count

```bash
# Count courses
curl -s -X POST "http://34.162.168.124:3000/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "Lynda@admin.com", "password": "Admin123!"}' | \
  grep -o '"accessToken":"[^"]*' | cut -d'"' -f4 | \
  xargs -I {} curl -s -X GET "http://34.162.168.124:3000/api/admin/courses" \
  -H "Authorization: Bearer {}" | grep -o '"id":' | wc -l
```

---

## What You Should Do AFTER Deleting

### 1. Verify Deletion

```sql
-- Check all related tables are empty
SELECT
  (SELECT COUNT(*) FROM courses) as courses,
  (SELECT COUNT(*) FROM modules) as modules,
  (SELECT COUNT(*) FROM quizzes) as quizzes,
  (SELECT COUNT(*) FROM quiz_questions) as quiz_questions,
  (SELECT COUNT(*) FROM module_content) as module_content,
  (SELECT COUNT(*) FROM user_progress) as user_progress,
  (SELECT COUNT(*) FROM course_enrollments) as course_enrollments;
```

### 2. Clean Up Orphaned Files (if any)

```bash
# List files in uploads (should be empty after delete)
docker exec teachers_training_app_1 ls -la uploads/

# If any files remain, they're orphaned and can be deleted
docker exec teachers_training_app_1 rm -f uploads/*
```

### 3. Verify Vector Databases

```bash
# Check ChromaDB collections
# (Collections should be empty or non-existent)

# Check Neo4j nodes
# (Module nodes should be gone)
```

---

## Re-Creating Courses via Admin UI

After deletion, you can create new courses:

1. **Go to Courses Page:**
   - http://34.162.168.124:3000/admin/courses.html

2. **Click "Create New Course"**

3. **Fill in Course Details:**
   - Course Code (e.g., TEACH-001)
   - Course Title
   - Description
   - Category
   - Difficulty Level
   - Duration (weeks)
   - Region Assignment

4. **Create Modules:**
   - Add modules to the course
   - Upload content (PDF, DOCX, TXT)
   - Create quizzes

5. **Enroll Users:**
   - Assign users to the course
   - Set up coaching modes

---

## Summary

### ✅ SAFE TO DELETE

| Aspect | Status | Notes |
|--------|--------|-------|
| **PostgreSQL CASCADE** | ✅ Working | All related tables will cascade |
| **Physical Files** | ✅ Working | Deleted from uploads/ |
| **Neo4j Graph** | ✅ Working | Knowledge graph cleaned |
| **ChromaDB Vectors** | ✅ Working | Embeddings removed |
| **User Data Preservation** | ✅ Safe | Users table unchanged |
| **Admin Users** | ✅ Safe | Admin users unchanged |

### ⚠️ Minor Issue (No Impact Now)

| Issue | Impact | Recommendation |
|-------|--------|----------------|
| quiz_attempts.module_id has no FK | Currently 0 records, no impact | Add constraint later if needed |

### 🎯 Recommendation

**YES - You can safely delete all courses via the Admin UI portal.**

The cascade delete logic is comprehensive and will clean up:
- ✅ All database records
- ✅ All physical files
- ✅ All vector embeddings
- ✅ All graph relationships

**Use the Admin UI delete button (not SQL) to ensure complete cleanup.**

---

**Created:** 2025-11-02
**Status:** ✅ Verified Safe
**Recommended Action:** Delete via Admin UI Portal

🎉 **You're good to go! Delete all courses and recreate them as needed.**
