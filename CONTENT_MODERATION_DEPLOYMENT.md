# Content Moderation System - Deployment Guide

## 🛡️ Overview

Hybrid content moderation system with local pre-filtering and Vertex AI safety detection to protect against:
- **Critical**: Suicide, self-harm
- **High**: Violence, threats, sexual content
- **Medium**: Aggression, harassment
- **Low**: Profanity, vulgarity

## ✅ Implementation Complete (Local)

### 1. Services Created
- ✅ `services/content-moderation.service.js` - Local filtering with pattern matching
- ✅ `services/vertexai.service.js` - Enhanced with safety block detection
- ✅ `services/course-orchestrator.service.js` - WhatsApp webhook pre-filtering
- ✅ `server.js` - Admin chat API pre-filtering

### 2. Database Schema
- ✅ `migrations/009_content_moderation_log.sql` - Logging table created locally
- ✅ Indexes for efficient querying
- ✅ Support for both local and Vertex AI blocks

### 3. NPM Packages Installed
- ✅ `bad-words@3.0.4` - English profanity filtering
- ✅ `leo-profanity@1.7.0` - Multi-language profanity detection

### 4. Tests Created
- ✅ `tests/e2e/content-moderation.spec.js` - 9 comprehensive test suites
- ✅ `run-moderation-tests.sh` - Test execution script

### 5. Code Committed & Pushed
- ✅ Branch: `feature/course-management-ui`
- ✅ Commit: `79f6b0c - feat: Implement hybrid content moderation system`
- ✅ Pushed to GitHub

---

## 📋 Manual Deployment to GCP (Required)

Since SSH authentication needs refresh, please manually deploy following these steps:

### Step 1: SSH into GCP VM

```bash
# Option A: Using gcloud (after auth refresh)
gcloud auth login
gcloud compute ssh karthi@teachers-training-vm --zone=us-central1-a

# Option B: Using direct SSH (if configured)
ssh karthi@34.162.136.203
```

### Step 2: Navigate to Project

```bash
cd /home/karthi/teachers_training
```

### Step 3: Pull Latest Code

```bash
git fetch origin
git checkout feature/course-management-ui
git pull origin feature/course-management-ui
```

### Step 4: Install NPM Packages

```bash
npm install
```

This will install:
- `bad-words@3.0.4`
- `leo-profanity@1.7.0`

### Step 5: Run Database Migration

```bash
# Copy migration to PostgreSQL container
docker cp migrations/009_content_moderation_log.sql teachers_training-postgres-1:/tmp/

# Execute migration
docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -f /tmp/009_content_moderation_log.sql
```

**Note**: If you see errors about existing table/indexes, the migration may have already run. This is safe to ignore.

### Step 6: Restart App Container

```bash
docker restart teachers_training-app-1
```

### Step 7: Verify Deployment

```bash
# Wait 30 seconds for container to start
sleep 30

# Check container status
docker ps | grep teachers_training

# Verify moderation service exists
docker exec teachers_training-app-1 ls -la services/content-moderation.service.js

# Check app logs
docker logs teachers_training-app-1 --tail 30
```

---

## 🧪 Testing Production Deployment

### From Local Machine

Run Playwright tests against production:

```bash
TEST_BASE_URL=http://34.162.136.203:3000 \
npx playwright test tests/e2e/content-moderation.spec.js \
  --project=chromium \
  --workers=1 \
  --reporter=list
```

### Manual Testing via UI

1. **Navigate to**: http://34.162.136.203:3000/admin/chat.html
2. **Login** with admin credentials
3. **Select a module**
4. **Test profanity**: Type "fuck this training" → Should see respectful redirect
5. **Test violence**: Type "I will kill you" → Should see educational redirect
6. **Test suicide**: Type "I want to kill myself" → Should see crisis hotline info
7. **Test clean content**: Type "What is production?" → Should get normal response

### Database Verification

```sql
-- Connect to PostgreSQL
docker exec -it teachers_training-postgres-1 psql -U teachers_user -d teachers_training

-- Check moderation logs
SELECT
  id,
  user_phone,
  moderation_reason,
  severity,
  blocked_by,
  created_at
FROM content_moderation_log
ORDER BY created_at DESC
LIMIT 10;

-- Get moderation statistics
SELECT
  category,
  severity,
  COUNT(*) as count,
  blocked_by
FROM content_moderation_log
GROUP BY category, severity, blocked_by
ORDER BY count DESC;
```

---

## 📊 Expected Behavior

### Profanity (Low Severity)
**Input**: "fuck this training"
**Response**: "Let's keep our conversation professional. How can I help with your training?"
**Logged**: ✅ Yes (local_filter)

### Suicide/Self-Harm (Critical Severity)
**Input**: "I want to kill myself"
**Response**: Crisis hotline information + educational redirect
**Logged**: ✅ Yes (local_filter)
**Always Blocked**: Even in educational context

### Violence/Threats (High Severity)
**Input**: "I will hurt someone"
**Response**: "I can only assist with educational topics..."
**Logged**: ✅ Yes (local_filter)

### Clean Educational Content
**Input**: "What is production in business?"
**Response**: Normal RAG-powered response with sources
**Logged**: ❌ No (not blocked)

---

## 🔍 Troubleshooting

### Issue: Moderation not working
**Check**:
1. Are NPM packages installed? `docker exec teachers_training-app-1 npm list | grep profanity`
2. Is service imported? `docker exec teachers_training-app-1 grep -r "content-moderation.service" server.js`
3. Check logs: `docker logs teachers_training-app-1 | grep moderation`

### Issue: Database errors
**Check**:
1. Table exists? `docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "\dt content_moderation_log"`
2. Permissions? `docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "\dp content_moderation_log"`

### Issue: False positives
**Solution**: Educational context detection is built-in, but you can adjust patterns in `services/content-moderation.service.js` lines 28-64.

---

## 📁 Files Modified/Created

### Created
- `services/content-moderation.service.js` (252 lines)
- `migrations/009_content_moderation_log.sql` (47 lines)
- `tests/e2e/content-moderation.spec.js` (312 lines)
- `run-moderation-tests.sh`
- `deploy-moderation-to-gcp.sh`
- `CONTENT_MODERATION_DEPLOYMENT.md` (this file)

### Modified
- `package.json` - Added bad-words, leo-profanity
- `server.js` - Added moderation check in /api/chat (lines 544-561)
- `services/vertexai.service.js` - Added safety block detection (lines 181-210)
- `services/course-orchestrator.service.js` - Added moderation check (lines 106-115)

---

## 🎯 Next Steps

1. ✅ **Deploy to GCP** (follow manual steps above)
2. ✅ **Run production tests** (Playwright against live URL)
3. ✅ **Monitor logs** for first 24 hours to catch edge cases
4. ✅ **Review moderation_log** weekly for false positives
5. ⏳ **Optional**: Add admin dashboard page to view moderation statistics

---

## 📞 Support

**Testing Commands**:
```bash
# Local testing
./run-moderation-tests.sh

# Production testing
TEST_BASE_URL=http://34.162.136.203:3000 npx playwright test tests/e2e/content-moderation.spec.js

# Check moderation logs
docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "SELECT * FROM content_moderation_log ORDER BY created_at DESC LIMIT 5;"
```

**GitHub Commit**: `79f6b0c`
**Branch**: `feature/course-management-ui`
**Date**: 2025-10-21
