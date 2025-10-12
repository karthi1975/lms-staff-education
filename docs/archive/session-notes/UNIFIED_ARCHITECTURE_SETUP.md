# Unified Multi-Source Architecture - Setup Guide

## ⚠️ DISK SPACE ISSUE DETECTED

Your system is out of disk space. Please free up space before continuing.

```bash
# Check disk space
df -h

# Free up Docker space
docker system prune -a --volumes

# Check Docker disk usage
docker system df
```

---

## Architecture Overview

This system supports courses from **two sources**:
1. **Moodle LMS** - Auto-synced via API
2. **Admin Portal** - Manually uploaded PDFs/content

Both sources use the same:
- PostgreSQL (metadata)
- ChromaDB (RAG/embeddings)
- Neo4j (learning paths)

---

## Step 1: Database Migration (PENDING - Need disk space)

Run this once disk space is available:

```bash
# Inside Docker container
docker exec teachers_training-app-1 node scripts/run-migration.js
```

**Or manually run SQL:**

```sql
-- Add source tracking columns
ALTER TABLE moodle_courses
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'moodle' NOT NULL;

ALTER TABLE moodle_modules
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'moodle' NOT NULL;

ALTER TABLE quiz_questions
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'moodle' NOT NULL;

-- Add portal-specific fields
ALTER TABLE moodle_courses
  ADD COLUMN IF NOT EXISTS portal_created_by INT,
  ADD COLUMN IF NOT EXISTS portal_created_at TIMESTAMP;

ALTER TABLE moodle_modules
  ADD COLUMN IF NOT EXISTS portal_created_by INT,
  ADD COLUMN IF NOT EXISTS portal_created_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS content_file_path TEXT;

-- Create source tracking table
CREATE TABLE IF NOT EXISTS content_sources (
    id SERIAL PRIMARY KEY,
    course_id INT REFERENCES moodle_courses(id) ON DELETE CASCADE,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('moodle', 'portal')),
    source_url TEXT,
    source_file_path TEXT,
    last_synced_at TIMESTAMP,
    sync_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_courses_source ON moodle_courses(source);
CREATE INDEX IF NOT EXISTS idx_modules_source ON moodle_modules(source);
```

---

## Step 2: Files Created (Already Done ✅)

### Migration Files:
- ✅ `/migrations/002_add_source_columns.sql` - SQL migration
- ✅ `/scripts/run-migration.js` - Migration runner

### Services (To be created):
- 🔲 `/services/unified-course.service.js` - Unified course handler
- 🔲 `/services/portal-content.service.js` - Portal upload handler

### Routes (To be created):
- 🔲 `/routes/portal-course.routes.js` - Portal upload endpoints

### Admin UI (To be updated):
- 🔲 `/public/admin/lms-dashboard.html` - Add upload UI

---

## Step 3: How It Will Work

### Moodle Courses (Auto-Sync):
```javascript
// Existing - Already working
await moodleSyncService.syncCourse(courseId);
// Tags: source='moodle', moodle_course_id=123
```

### Portal Courses (Manual Upload):
```javascript
// New - To be implemented
POST /api/admin/portal/courses
{
  "courseName": "Business Studies",
  "courseCode": "BUS-001",
  "file": <PDF upload>
}

// Response:
// - Creates course with source='portal'
// - Processes PDF → chunks
// - Adds to ChromaDB
// - Builds Neo4j graph
```

### WhatsApp Bot (Unified):
```javascript
// Bot doesn't care about source!
await orchestrator.showCourseSelection();

// Returns ALL courses (Moodle + Portal)
// 1. 🔗 Business Studies (Moodle)
// 2. 📄 Entrepreneurship (Portal)
```

---

## Step 4: Implementation Checklist

Once disk space is freed:

### Phase 1: Database ✅
- [x] Create migration files
- [ ] Run migration (pending disk space)
- [ ] Verify columns added

### Phase 2: Services
- [ ] Create `unified-course.service.js`
- [ ] Create `portal-content.service.js`
- [ ] Update `moodle-orchestrator.service.js` to query all sources

### Phase 3: API Endpoints
- [ ] POST `/api/admin/portal/courses` - Create portal course
- [ ] POST `/api/admin/portal/courses/:id/modules` - Upload module content
- [ ] GET `/api/admin/courses` - List all courses (both sources)

### Phase 4: Admin UI
- [ ] Add "Upload Course" button
- [ ] Create upload modal (PDF/DOCX)
- [ ] Show source badge (Moodle 🔗 vs Portal 📄)

### Phase 5: Testing
- [ ] Upload portal course via UI
- [ ] Verify appears in WhatsApp bot
- [ ] Test RAG on portal content
- [ ] Verify quizzes work

---

## Architecture Benefits

✅ **Unified Interface** - Bot shows all courses seamlessly
✅ **Source Transparency** - Track where content came from
✅ **Flexible** - Easy to add more sources later (Google Classroom, Canvas, etc.)
✅ **Non-Breaking** - Existing Moodle sync continues to work
✅ **RAG-Enabled** - Both sources use ChromaDB/Neo4j

---

## Current Status

**✅ Completed:**
- Migration SQL written
- Migration runner created
- Architecture planned

**⏸️ Blocked:**
- Disk space full - cannot build Docker
- Migration not yet applied

**📋 Next Steps:**
1. Free up disk space (delete old Docker images, logs, etc.)
2. Run migration
3. Implement portal upload service
4. Update admin UI

---

## Quick Disk Cleanup Commands

```bash
# Remove unused Docker resources
docker system prune -a --volumes

# Remove old containers
docker container prune

# Remove old images
docker image prune -a

# Check what's using space
docker system df

# Remove specific images
docker images
docker rmi <image-id>
```

---

## Resume Point

When ready to continue:

```bash
# 1. Free up disk
docker system prune -a

# 2. Restart services
docker-compose up -d

# 3. Run migration
docker exec teachers_training-app-1 node scripts/run-migration.js

# 4. Verify
docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "\d moodle_courses"
```

You should see the `source` column added! ✅
