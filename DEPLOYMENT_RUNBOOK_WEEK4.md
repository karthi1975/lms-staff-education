# Deployment Runbook: Dual Coaching Bot Feature (Week 4)

**Feature:** Dual Coaching Bot System (Regular Mode vs Socratic Mode)
**Branch:** `feature/multi-region-rbac`
**Environment:** GCP Production (teachers-training)
**Date:** 2025-10-31
**Version:** 1.0

---

## 📋 Pre-Deployment Checklist

### Development Environment Verification
- [x] All code committed to GitHub (`feature/multi-region-rbac` branch)
- [x] Week 3 completed: Security & Performance tests passing (65/65 tests)
- [x] Code review completed
- [x] Database migration file exists: `database/migrations/011_dual_coaching_modes.sql`

### Production Environment Status
- **GCP Instance:** teachers-training (us-east5-a)
- **Project:** lms-tanzania-consultant
- **IP Address:** 34.162.168.124:3000
- **Current Services Running:**
  - ✅ PostgreSQL (teachers_training_postgres_1) - Up 17h, Healthy
  - ✅ Neo4j (teachers_training_neo4j_1) - Up 17h
  - ✅ App (teachers_training_app_1) - Up 4h, Healthy
  - ✅ ChromaDB (chromadb) - Up 2d

### Database State
- **Existing Tables:** 37 tables in production
- **New Tables to Add:** 4 tables (course_bot_configs, user_bot_preferences, coaching_sessions, mode_analytics)
- **New Views to Add:** 3 views
- **New Functions/Triggers:** 4 triggers

---

## 🎯 Deployment Objectives

### Primary Goals
1. Deploy Dual Coaching Bot feature to production
2. Run database migration safely (zero downtime)
3. Maintain existing functionality (no regressions)
4. Enable new REST API endpoints (15 new endpoints)
5. Deploy admin UI for coaching mode configuration

### Success Criteria
- ✅ All 4 new database tables created successfully
- ✅ All services remain healthy during deployment
- ✅ New API endpoints respond correctly
- ✅ Admin UI accessible and functional
- ✅ Security & performance tests pass in production
- ✅ Zero data loss or corruption
- ✅ Existing users unaffected

---

## 📦 Deployment Components

### 1. Database Changes
**File:** `database/migrations/011_dual_coaching_modes.sql`

**New Tables:**
- `course_bot_configs` - Mode-specific configurations per course
- `user_bot_preferences` - User mode selections and usage stats
- `coaching_sessions` - Session tracking with mode metadata
- `mode_analytics` - Aggregated effectiveness metrics

**New Views:**
- `v_user_mode_preferences` - Current user preferences with details
- `v_active_coaching_sessions` - Live session monitoring
- `v_mode_analytics_summary` - Analytics comparison view

**Triggers:**
- Auto-update timestamps on configs
- Auto-update timestamps on preferences
- Auto-calculate session duration
- Default config seeding for existing courses

### 2. Backend Services
**New Services:**
- `services/coaching-mode.service.js` - Core mode management
- `services/prompt-template.service.js` - Prompt generation

**Updated Services:**
- `services/orchestrator.service.js` - Integration with coaching modes
- `services/whatsapp.service.js` - Mode switching commands

### 3. REST API Endpoints
**15 New Endpoints:**

**Configuration Endpoints (Admin):**
- `POST /api/coaching-mode/admin/config` - Create/update course config
- `GET /api/coaching-mode/config/:courseId` - Get course config
- `DELETE /api/coaching-mode/admin/config/:courseId` - Delete config

**Mode Switching (User):**
- `POST /api/coaching-mode/switch` - Switch user mode
- `GET /api/coaching-mode/preference/:userId/:courseId` - Get user preference

**Prompt Management:**
- `GET /api/coaching-mode/prompt/:userId/:courseId` - Get mode-specific prompt
- `POST /api/coaching-mode/admin/prompt/validate` - Validate prompt
- `POST /api/coaching-mode/admin/prompt/preview` - Preview prompt

**Session Tracking:**
- `POST /api/coaching-mode/session/start` - Start new session
- `PUT /api/coaching-mode/session/:sessionId/end` - End session
- `GET /api/coaching-mode/session/:sessionId` - Get session details

**Analytics:**
- `GET /api/coaching-mode/analytics/:courseId` - Get course analytics
- `GET /api/coaching-mode/analytics/:courseId/mode/:mode` - Get mode-specific analytics
- `POST /api/coaching-mode/admin/analytics/generate` - Generate analytics
- `GET /api/coaching-mode/admin/analytics/compare/:courseId` - Compare modes

### 4. Frontend (Admin UI)
**New Pages:**
- `public/admin/coaching-modes.html` - Main coaching mode dashboard
- `public/admin/coaching-mode-config.html` - Configuration interface
- `public/admin/coaching-analytics.html` - Analytics dashboard

**Features:**
- Mode configuration per course
- Real-time mode switching preview
- Analytics visualization (mode comparison)
- User preference management

---

## 🚀 Deployment Steps

### Phase 1: Pre-Deployment Validation (Local)

#### Step 1.1: Run Local Tests
```bash
# Run all security & performance tests
./scripts/run-security-performance-tests.sh

# Expected: 65/65 tests passing
```

#### Step 1.2: Verify Migration Script
```bash
# Test migration on local database (dry run)
psql -U teachers_user -d teachers_training_test -f database/migrations/011_dual_coaching_modes.sql

# Verify tables created
psql -U teachers_user -d teachers_training_test -c "\dt course_bot_configs user_bot_preferences coaching_sessions mode_analytics"
```

#### Step 1.3: Verify Code is Committed and Pushed
```bash
# Check git status
git status

# Push to GitHub if needed
git push origin feature/multi-region-rbac
```

---

### Phase 2: Backup Production Database

#### Step 2.1: Create Database Backup
```bash
# SSH to GCP instance
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant"

# Inside GCP instance
cd /home/karthi/teachers_training

# Create backup
BACKUP_DATE=$(date +"%Y%m%d_%H%M%S")
docker exec teachers_training_postgres_1 pg_dump -U teachers_user -d teachers_training > backup_before_coaching_bot_$BACKUP_DATE.sql

# Verify backup
ls -lh backup_before_coaching_bot_$BACKUP_DATE.sql

# Expected: File size > 0, recent timestamp
```

#### Step 2.2: Test Backup Restoration (Optional but Recommended)
```bash
# Create test database
docker exec teachers_training_postgres_1 psql -U teachers_user -d postgres -c "CREATE DATABASE teachers_training_backup_test;"

# Restore backup to test database
docker exec -i teachers_training_postgres_1 psql -U teachers_user -d teachers_training_backup_test < backup_before_coaching_bot_$BACKUP_DATE.sql

# Verify table count
docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training_backup_test -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"

# Expected: 37 tables (current count)

# Drop test database
docker exec teachers_training_postgres_1 psql -U teachers_user -d postgres -c "DROP DATABASE teachers_training_backup_test;"
```

---

### Phase 3: Deploy Code Updates

#### Step 3.1: Pull Latest Code from GitHub
```bash
# SSH to GCP instance (if not already connected)
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant"

# Navigate to project directory
cd /home/karthi/teachers_training

# Stash any local changes (backup files)
git stash

# Pull latest code
git pull origin feature/multi-region-rbac

# Verify correct commit
git log --oneline -1
# Expected: f480d2e feat: Add military-grade security & performance testing
```

#### Step 3.2: Check Files Updated
```bash
# View files in latest commits
git diff HEAD~5 --name-only | head -20

# Verify migration file exists
ls -l database/migrations/011_dual_coaching_modes.sql

# Verify service files exist
ls -l services/coaching-mode.service.js
ls -l services/prompt-template.service.js

# Verify admin UI files exist
ls -l public/admin/coaching-*.html
```

---

### Phase 4: Run Database Migration

#### Step 4.1: Verify Migration File
```bash
# Check migration file size and content
wc -l database/migrations/011_dual_coaching_modes.sql
# Expected: ~372 lines

# Preview migration (first 50 lines)
head -50 database/migrations/011_dual_coaching_modes.sql
```

#### Step 4.2: Execute Migration
```bash
# Run migration
docker exec -i teachers_training_postgres_1 psql -U teachers_user -d teachers_training < database/migrations/011_dual_coaching_modes.sql

# Expected output:
# CREATE TABLE
# CREATE INDEX
# CREATE TRIGGER
# CREATE VIEW
# INSERT 0 X (seed data)
# GRANT
```

#### Step 4.3: Verify Migration Success
```bash
# Check new tables exist
docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c "
SELECT table_name
FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('course_bot_configs', 'user_bot_preferences', 'coaching_sessions', 'mode_analytics')
ORDER BY table_name;
"

# Expected: 4 rows
# - coaching_sessions
# - course_bot_configs
# - mode_analytics
# - user_bot_preferences

# Check views exist
docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c "
SELECT table_name
FROM information_schema.views
WHERE table_schema='public'
  AND table_name IN ('v_user_mode_preferences', 'v_active_coaching_sessions', 'v_mode_analytics_summary')
ORDER BY table_name;
"

# Expected: 3 rows

# Check default configs seeded
docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c "
SELECT COUNT(*) FROM course_bot_configs;
"

# Expected: Count = number of active courses

# Check table structure
docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c "
\d course_bot_configs
"
```

---

### Phase 5: Restart Application Services

#### Step 5.1: Check Current Service Status
```bash
# Check docker container status
docker ps

# Check app health
curl -s http://localhost:3000/health || echo "Health endpoint not responding"
```

#### Step 5.2: Rebuild and Restart App Container
```bash
# Stop app container
docker-compose stop app

# Rebuild app image (includes new code)
docker-compose build app

# Start app container
docker-compose up -d app

# Wait for app to be healthy
sleep 10
docker ps | grep app
```

#### Step 5.3: Verify Services Running
```bash
# Check all containers running
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Expected:
# teachers_training_app_1       Up X minutes (healthy)
# teachers_training_postgres_1  Up X hours (healthy)
# teachers_training_neo4j_1     Up X hours
# chromadb                      Up X days

# Check app logs for errors
docker logs teachers_training_app_1 --tail 50

# Should see: "Server running on port 3000" with no errors
```

---

### Phase 6: Smoke Tests

#### Step 6.1: Test Health Endpoint
```bash
# Test health endpoint
curl -s http://localhost:3000/health | python3 -m json.tool

# Expected:
# {
#   "status": "healthy",
#   "database": "connected",
#   ...
# }
```

#### Step 6.2: Test Authentication
```bash
# Test admin login
curl -s -X POST http://localhost:3000/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"Admin123!"}' \
  | python3 -m json.tool

# Expected: 200 OK with JWT token
# Save token for next tests
export TOKEN="<jwt_token_here>"
```

#### Step 6.3: Test New API Endpoints

**Test 1: Get Course Config**
```bash
curl -s http://localhost:3000/api/coaching-mode/config/1 | python3 -m json.tool

# Expected: 200 OK with default config or 404 if no courses
```

**Test 2: Create Course Config (Admin)**
```bash
curl -s -X POST http://localhost:3000/api/coaching-mode/admin/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "courseId": 1,
    "config": {
      "regular_prompt": "You are a helpful teaching assistant.",
      "socratic_prompt": "Guide students through questions.",
      "default_mode": "regular",
      "allow_mode_switching": true,
      "switch_cooldown_minutes": 5
    }
  }' | python3 -m json.tool

# Expected: 201 Created
```

**Test 3: Switch User Mode**
```bash
curl -s -X POST http://localhost:3000/api/coaching-mode/switch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "courseId": 1,
    "mode": "socratic"
  }' | python3 -m json.tool

# Expected: 200 OK with success message
```

**Test 4: Get User Preference**
```bash
curl -s http://localhost:3000/api/coaching-mode/preference/1/1 | python3 -m json.tool

# Expected: 200 OK with user preference data
```

**Test 5: Start Coaching Session**
```bash
curl -s -X POST http://localhost:3000/api/coaching-mode/session/start \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "courseId": 1,
    "mode": "regular"
  }' | python3 -m json.tool

# Expected: 201 Created with session_id
```

#### Step 6.4: Test Admin UI Pages
```bash
# Test admin UI pages accessible
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin/coaching-modes.html
# Expected: 200

curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin/coaching-mode-config.html
# Expected: 200

curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin/coaching-analytics.html
# Expected: 200
```

#### Step 6.5: Verify Existing Functionality (Regression Tests)
```bash
# Test user endpoints still work
curl -s http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -20

# Expected: 200 OK with user list

# Test course endpoints still work
curl -s http://localhost:3000/api/admin/courses \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -20

# Expected: 200 OK with course list

# Test WhatsApp webhook still works
curl -s -X POST http://localhost:3000/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+1234567890&Body=test&MessageSid=TEST123"

# Expected: 200 OK
```

---

### Phase 7: Verify Vertex AI Integration

#### Step 7.1: Refresh Vertex AI Token
```bash
# Run token refresh script
./scripts/refresh-vertex-token.sh

# Expected: "Token refreshed successfully"
```

#### Step 7.2: Test Vertex AI Response with New Prompts
```bash
# Test chat with coaching mode prompt
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "test_user",
    "message": "What is classroom management?",
    "language": "english"
  }' | python3 -m json.tool

# Expected: 200 OK with AI response
```

---

### Phase 8: Monitoring and Validation

#### Step 8.1: Check Database Metrics
```bash
# Check table sizes
docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c "
SELECT
  table_name,
  pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('course_bot_configs', 'user_bot_preferences', 'coaching_sessions', 'mode_analytics')
ORDER BY table_name;
"

# Expected: All tables present with reasonable sizes
```

#### Step 8.2: Check Application Logs
```bash
# Check for errors in app logs
docker logs teachers_training_app_1 --since 10m | grep -i error

# Expected: No critical errors

# Check for warnings
docker logs teachers_training_app_1 --since 10m | grep -i warning

# Expected: No unusual warnings
```

#### Step 8.3: Monitor Resource Usage
```bash
# Check container resource usage
docker stats --no-stream

# Expected: App container CPU < 50%, Memory < 80%
```

---

## ✅ Post-Deployment Checklist

### Immediate Verification (T+0)
- [ ] All 4 new database tables created successfully
- [ ] All 3 new views created successfully
- [ ] Default configs seeded for existing courses
- [ ] All Docker containers running and healthy
- [ ] App health endpoint responding
- [ ] Admin authentication working
- [ ] New API endpoints responding correctly
- [ ] Admin UI pages accessible (3 pages)
- [ ] Existing functionality unaffected (regression tests pass)
- [ ] No critical errors in logs

### Short-Term Monitoring (T+1 hour)
- [ ] Application logs clean (no repeated errors)
- [ ] Database connections stable
- [ ] API response times within thresholds (< 500ms)
- [ ] Memory usage stable (no leaks)
- [ ] Vertex AI integration working

### Medium-Term Monitoring (T+24 hours)
- [ ] User acceptance testing completed
- [ ] Admin users can configure coaching modes
- [ ] WhatsApp users can switch modes
- [ ] Analytics data being collected
- [ ] Performance metrics meeting thresholds
- [ ] No production incidents reported

---

## 🔄 Rollback Procedure

### When to Rollback
Rollback immediately if:
- Critical errors in application logs
- Database corruption detected
- API endpoints returning 500 errors consistently
- User data loss detected
- Performance degradation > 50%

### Rollback Steps

#### 1. Stop Application
```bash
docker-compose stop app
```

#### 2. Restore Database Backup
```bash
# Verify backup file exists
ls -lh backup_before_coaching_bot_*.sql

# Drop new tables (optional - backup already has state without them)
docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c "
DROP VIEW IF EXISTS v_mode_analytics_summary CASCADE;
DROP VIEW IF EXISTS v_active_coaching_sessions CASCADE;
DROP VIEW IF EXISTS v_user_mode_preferences CASCADE;
DROP TABLE IF EXISTS mode_analytics CASCADE;
DROP TABLE IF EXISTS coaching_sessions CASCADE;
DROP TABLE IF EXISTS user_bot_preferences CASCADE;
DROP TABLE IF EXISTS course_bot_configs CASCADE;
"

# Restore backup (if full restore needed)
# docker exec -i teachers_training_postgres_1 psql -U teachers_user -d teachers_training < backup_before_coaching_bot_$BACKUP_DATE.sql
```

#### 3. Revert Code
```bash
# Checkout previous stable commit
git checkout <previous_stable_commit>

# Rebuild app
docker-compose build app
docker-compose up -d app
```

#### 4. Verify Rollback
```bash
# Check services running
docker ps

# Check health
curl http://localhost:3000/health

# Verify old table count
docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"

# Expected: 37 tables (original count)
```

---

## 📊 Deployment Metrics

### Performance Benchmarks (Expected)
- API Response Time: < 500ms (military-grade threshold)
- Mode Switching: < 200ms
- Database Query: < 100ms
- Health Check: < 100ms
- Memory Usage: < 1GB per container

### Deployment Timeline (Estimated)
- Phase 1 (Pre-Deployment): 15 minutes
- Phase 2 (Backup): 10 minutes
- Phase 3 (Code Deploy): 5 minutes
- Phase 4 (Migration): 5 minutes
- Phase 5 (Restart): 5 minutes
- Phase 6 (Smoke Tests): 15 minutes
- Phase 7 (Vertex AI): 5 minutes
- Phase 8 (Monitoring): 10 minutes

**Total Deployment Time: ~70 minutes**

---

## 🔐 Security Considerations

### Data Protection
- ✅ Database backup before migration
- ✅ Parameterized queries prevent SQL injection
- ✅ JWT authentication for admin endpoints
- ✅ RBAC enforcement on sensitive operations
- ✅ Input validation on all endpoints
- ✅ XSS protection on admin UI

### Access Control
- Admin endpoints require JWT token with admin role
- User mode switching requires valid user ID
- Course configs protected by RBAC
- Analytics endpoints restricted to admins

### Audit Trail
- All mode switches logged in user_bot_preferences
- All sessions tracked in coaching_sessions
- Admin changes tracked with created_by field
- Timestamps on all operations

---

## 📝 Documentation Updates

After successful deployment, update:
- [x] Production deployment log
- [ ] User documentation (mode switching commands)
- [ ] Admin documentation (configuration guide)
- [ ] API documentation (new endpoints)
- [ ] Monitoring runbook
- [ ] Incident response procedures

---

## 📞 Support and Escalation

### Deployment Team
- **Primary:** Claude (AI Assistant)
- **Secondary:** Karthi (karthi@kpitechllc.com)

### Escalation Path
1. Check application logs: `docker logs teachers_training_app_1`
2. Check database logs: `docker logs teachers_training_postgres_1`
3. Review deployment runbook (this document)
4. Execute rollback procedure if critical
5. Contact support team

### Useful Commands
```bash
# Quick health check
docker ps && curl http://localhost:3000/health

# Quick log check
docker logs teachers_training_app_1 --tail 100 | grep -i error

# Quick database check
docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c "SELECT COUNT(*) FROM course_bot_configs;"
```

---

## ✨ Success Indicators

Deployment is successful when:
- ✅ All 8 deployment phases completed without errors
- ✅ All 10 immediate verification checks passed
- ✅ Smoke tests all returned expected results
- ✅ No critical errors in logs
- ✅ Performance metrics within thresholds
- ✅ Existing functionality unaffected
- ✅ New features accessible and working

---

**Deployment Status:** Ready for Execution
**Last Updated:** 2025-10-31
**Version:** 1.0
**Approved By:** Week 3 Testing Complete (65/65 tests passing)
