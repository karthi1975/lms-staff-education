# Current Implementation Plan - Teachers Training System

**Last Updated:** 2025-10-31
**Branch:** `feature/multi-region-rbac`
**Status:** Planning Complete - Ready for Implementation
**Complexity:** Medium-High
**Estimated Timeline:** 3-4 weeks

---

## 📍 Current State

### Environment
- **Production URL:** http://34.162.168.124:3000
- **GCP Project:** lms-tanzania-consultant
- **GCP Zone:** us-east5-a
- **GCP Instance:** teachers-training
- **Vertex AI Account:** karthi@kpitechllc.com

### Latest Commits
```
2d9d917 feat: Add Dual Coaching Bot implementation plan with Super Admin approval workflow
5203466 fix: Restore additional moodle service dependencies
84a4018 fix: Restore core service files deleted by cleanup script
cc94435 fix: Add stub whatsapp.service.js to prevent module not found error
d456332 fix: Disable coaching scheduler to prevent automated greeting/nudging messages
```

### Repository Status
- Working tree: Clean
- No uncommitted changes
- Ready for new development

---

## 🎯 Feature: Dual Coaching Bot Implementation

### Objective
Add dual coaching mode functionality allowing users to choose between two teaching approaches:

1. **Regular Mode (Direct Coach)**
   - Provides direct answers
   - Step-by-step explanations
   - Examples and solutions
   - Best for quick learning

2. **Socratic Mode (Discovery Coach)**
   - Uses only guiding questions
   - Encourages self-discovery
   - Reflective learning
   - Best for deep understanding

### Key Features
- ✅ Per-course mode configuration by admins
- ✅ Per-user mode preference with persistence
- ✅ Easy mode switching via WhatsApp commands (`/regular`, `/socratic`)
- ✅ Mode-specific prompts and behaviors
- ✅ Analytics tracking mode effectiveness
- ✅ RBAC-protected admin configuration
- ✅ Session tracking with mode metadata

---

## 📅 4-Week Implementation Plan

### **Week 1: Foundation (Database & Services)**
**Timeline:** Days 1-7
**Focus:** Database schema, core services, unit tests

#### Tasks:
- [ ] **Day 1-2: Database Schema**
  - Create migration file: `database/migrations/006_dual_coaching_modes.sql`
  - Add 4 new tables:
    1. `course_bot_configs` - Mode configurations per course
    2. `user_bot_preferences` - User mode selections & usage stats
    3. `coaching_sessions` - Session tracking with mode metadata
    4. `mode_analytics` - Aggregated effectiveness metrics
  - Run migration on dev environment
  - Verify all foreign keys and constraints

- [ ] **Day 3-4: Core Services**
  - Create `services/coaching/coaching-mode.service.js` (~500 lines)
    - Mode switching logic
    - Preference management
    - Session tracking
    - Analytics generation
  - Create `services/coaching/prompt-template.service.js` (~200 lines)
    - Regular mode prompt templates
    - Socratic mode prompt templates
    - Dynamic prompt generation
    - Validation logic

- [ ] **Day 5-6: Orchestrator Integration**
  - Update `services/orchestrator.service.js`
  - Add mode awareness to chat flow
  - Integrate CoachingModeService
  - Handle mode-specific responses

- [ ] **Day 7: Testing**
  - Write 20+ unit tests
  - Test mode switching logic
  - Validate prompt generation
  - Test session tracking
  - Verify analytics calculations

**Deliverables:**
- ✅ 4 database tables created
- ✅ 2 new services implemented
- ✅ Orchestrator updated
- ✅ 20+ unit tests passing

---

### **Week 2: APIs & WhatsApp Integration**
**Timeline:** Days 8-14
**Focus:** REST APIs, WhatsApp commands, integration tests

#### Tasks:
- [ ] **Day 8-9: User API Endpoints**
  - Create `routes/coaching-mode.routes.js`
  - Implement 8 user endpoints:
    1. `GET /api/coaching-mode/config/:courseId` - Get course config
    2. `POST /api/coaching-mode/switch` - Switch mode
    3. `GET /api/coaching-mode/preference/:userId/:courseId` - Get preference
    4. `POST /api/coaching-mode/session/start` - Start session
    5. `POST /api/coaching-mode/session/end` - End session
    6. `POST /api/coaching-mode/session/message` - Log message
    7. `GET /api/coaching-mode/session/history/:userId` - Get history
    8. `GET /api/coaching-mode/commands` - Get available commands

- [ ] **Day 10-11: Admin API Endpoints**
  - Implement 5 admin endpoints (RBAC protected):
    1. `POST /api/admin/coaching-mode/config` - Create config
    2. `PUT /api/admin/coaching-mode/config/:id` - Update config
    3. `GET /api/admin/coaching-mode/config/:courseId` - Get config
    4. `DELETE /api/admin/coaching-mode/config/:id` - Delete config
    5. `POST /api/admin/coaching-mode/seed-defaults` - Seed defaults

- [ ] **Day 12: Analytics API Endpoints**
  - Implement 2 analytics endpoints:
    1. `GET /api/admin/coaching-mode/analytics/:courseId` - Get analytics
    2. `POST /api/admin/coaching-mode/analytics/generate` - Generate report

- [ ] **Day 13: WhatsApp Integration**
  - Update `services/whatsapp.service.js`
  - Add mode command detection:
    - `/regular` or `/direct` → Switch to Regular Mode
    - `/socratic` or `/discovery` → Switch to Socratic Mode
    - `/mode` → Show current mode
    - `/modes` → List available modes
  - Add mode indicators in responses
  - Update help text with mode info

- [ ] **Day 14: Testing & Documentation**
  - Test all API endpoints
  - Write integration tests
  - Create API documentation
  - Test WhatsApp commands

**Deliverables:**
- ✅ 15 REST API endpoints
- ✅ WhatsApp mode commands
- ✅ Integration tests
- ✅ API documentation

---

### **Week 3: UI & Testing**
**Timeline:** Days 15-21
**Focus:** Admin portal UI, comprehensive testing, security

#### Tasks:
- [ ] **Day 15-16: Bot Configuration UI**
  - Create `public/admin/bot-config.html`
  - Dual editor interface:
    - Regular mode prompt editor
    - Socratic mode prompt editor
    - Live preview
    - Validation
    - Save/Cancel buttons
  - Course selection dropdown
  - Default mode selector
  - Mode switching settings

- [ ] **Day 17-18: Analytics Dashboard**
  - Create `public/admin/mode-analytics.html`
  - Display metrics:
    - Mode adoption rates
    - Average session duration per mode
    - Messages per mode
    - Quiz scores by mode
    - Completion rates
    - User preferences chart
  - Date range selector
  - Export to CSV/PDF
  - Comparison charts

- [ ] **Day 19: User Interface Updates**
  - Add mode indicators to chat responses
  - Add mode selector in user profile
  - Update help text
  - Add mode switching confirmation

- [ ] **Day 20: Comprehensive Testing**
  - Write 15+ integration tests:
    - End-to-end mode switching flow
    - API endpoint validation
    - RBAC enforcement
    - Session tracking
    - Analytics accuracy
  - Write 5+ E2E tests:
    - WhatsApp mode switching
    - Admin configuration flow
    - Analytics generation
    - Multi-user scenarios
  - Performance testing:
    - Mode switching latency < 200ms
    - Prompt generation < 100ms
    - Analytics query < 1s

- [ ] **Day 21: Security Validation**
  - SQL injection testing
  - XSS vulnerability scanning
  - RBAC enforcement verification
  - Input validation testing
  - Rate limiting validation
  - Audit log verification

**Deliverables:**
- ✅ 2 new admin UI pages
- ✅ 20+ comprehensive tests
- ✅ 80%+ code coverage
- ✅ Security validation passed

---

### **Week 4: Deployment & Monitoring**
**Timeline:** Days 22-28
**Focus:** Production deployment, monitoring, documentation

#### Tasks:
- [ ] **Day 22: Staging Deployment**
  - Deploy to GCP staging environment
  - Run database migration
  - Seed default configurations
  - Test all endpoints on staging
  - Verify WhatsApp integration

- [ ] **Day 23: Production Database Migration**
  - Backup production database
  - Run migration: `database/migrations/006_dual_coaching_modes.sql`
  - Verify all tables created
  - Check foreign key constraints
  - Rollback plan ready

- [ ] **Day 24: Seed Default Configurations**
  - Create default bot configs for all existing courses
  - Set default mode to 'regular'
  - Enable mode switching for all courses
  - Verify configurations

- [ ] **Day 25: Production Deployment**
  - SSH to GCP: `gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant"`
  - Pull latest code: `cd /home/karthi/teachers_training && git pull origin feature/multi-region-rbac`
  - Rebuild Docker containers
  - Update environment variables
  - Restart services
  - Clear Vertex AI cache
  - Test production endpoints

- [ ] **Day 26: Monitoring & Metrics**
  - Monitor application logs
  - Track API response times
  - Monitor database performance
  - Check error rates
  - Verify analytics generation
  - Set up alerts

- [ ] **Day 27: User Acceptance Testing**
  - Test with real users
  - Gather feedback
  - Monitor user behavior
  - Track mode switching patterns
  - Identify issues

- [ ] **Day 28: Bug Fixes & Documentation**
  - Fix critical bugs
  - Address user feedback
  - Complete documentation:
    - User guide for mode switching
    - Admin guide for configuration
    - API documentation
    - Troubleshooting guide
  - Update CLAUDE.md
  - Create release notes

**Deliverables:**
- ✅ Production deployment complete
- ✅ Monitoring in place
- ✅ Documentation complete
- ✅ User feedback collected

---

## 🏗️ Technical Architecture

### New Database Schema

```sql
-- 1. Course Bot Configurations
course_bot_configs (
  id, course_id,
  regular_prompt, regular_greeting, regular_help_text,
  socratic_prompt, socratic_greeting, socratic_help_text,
  default_mode, allow_mode_switching, switch_cooldown_minutes,
  created_at, updated_at, created_by
)

-- 2. User Bot Preferences
user_bot_preferences (
  id, user_id, course_id,
  selected_mode, mode_switches_count, last_mode_switch,
  regular_mode_sessions, regular_mode_time_minutes,
  socratic_mode_sessions, socratic_mode_time_minutes,
  created_at, updated_at
)

-- 3. Coaching Sessions
coaching_sessions (
  id, user_id, course_id, mode_used,
  session_start, session_end, duration_minutes,
  messages_sent, questions_asked, quiz_score,
  completion_status, satisfaction_rating,
  created_at
)

-- 4. Mode Analytics
mode_analytics (
  id, course_id, mode, period_start, period_end,
  total_users, total_sessions, total_messages,
  avg_session_duration_minutes, avg_quiz_score,
  completion_rate, user_preference_percentage,
  created_at
)
```

### New Services

```
services/coaching/
├── coaching-mode.service.js       (~500 lines)
│   ├── getCourseConfig()
│   ├── switchMode()
│   ├── getUserPreference()
│   ├── startSession()
│   ├── endSession()
│   ├── trackModeTime()
│   └── generateModeAnalytics()
│
├── prompt-template.service.js     (~200 lines)
│   ├── getRegularPrompt()
│   ├── getSocraticPrompt()
│   ├── generatePrompt()
│   └── validatePrompt()
│
└── mode-analytics.service.js      (~300 lines)
    ├── calculateAdoptionRate()
    ├── calculateEngagement()
    ├── compareModesEffectiveness()
    └── generateReport()
```

### New API Routes

```javascript
// User Endpoints (8)
GET    /api/coaching-mode/config/:courseId
POST   /api/coaching-mode/switch
GET    /api/coaching-mode/preference/:userId/:courseId
POST   /api/coaching-mode/session/start
POST   /api/coaching-mode/session/end
POST   /api/coaching-mode/session/message
GET    /api/coaching-mode/session/history/:userId
GET    /api/coaching-mode/commands

// Admin Endpoints (5) - RBAC Protected
POST   /api/admin/coaching-mode/config
PUT    /api/admin/coaching-mode/config/:id
GET    /api/admin/coaching-mode/config/:courseId
DELETE /api/admin/coaching-mode/config/:id
POST   /api/admin/coaching-mode/seed-defaults

// Analytics Endpoints (2) - RBAC Protected
GET    /api/admin/coaching-mode/analytics/:courseId
POST   /api/admin/coaching-mode/analytics/generate
```

### New Admin UI Pages

```
public/admin/
├── bot-config.html              (Dual editor for mode prompts)
└── mode-analytics.html          (Analytics dashboard)
```

### WhatsApp Commands

```
/regular    or /direct     → Switch to Regular Mode
/socratic   or /discovery  → Switch to Socratic Mode
/mode                      → Show current mode
/modes                     → List available modes
/help                      → Show all commands
```

---

## 🔐 Security Requirements

### RBAC Enforcement
- All admin endpoints protected with `authenticateToken` + role check
- Only admins can configure bot modes
- Only course instructors can view analytics
- Users can only modify their own preferences

### Input Validation
- Validate all mode configurations
- Sanitize prompt text (prevent XSS)
- Validate course_id and user_id
- Check mode values against enum

### SQL Injection Prevention
- Use parameterized queries
- Validate all input parameters
- Use PostgreSQL prepared statements

### Rate Limiting
- Mode switching: Max 5 switches per hour per user
- Analytics generation: Max 10 requests per hour
- API endpoints: Standard rate limits

### Audit Logging
- Log all configuration changes
- Track mode switches
- Record session starts/ends
- Monitor analytics queries

---

## ✅ Success Metrics

### After 2 Weeks of Production:

**Adoption:**
- [ ] 40%+ users try mode switching
- [ ] 20%+ users actively use both modes

**Engagement:**
- [ ] Socratic mode shows 20%+ higher message count
- [ ] Average session duration increases by 15%

**Learning Outcomes:**
- [ ] Both modes achieve 70%+ quiz pass rate
- [ ] Completion rate remains stable or improves

**Performance:**
- [ ] Mode switching latency < 200ms
- [ ] Prompt generation < 100ms
- [ ] Analytics queries < 1s

**Stability:**
- [ ] Zero security vulnerabilities
- [ ] 99.5%+ uptime
- [ ] < 1% error rate on mode switching

---

## 🚨 Risk Mitigation

### Technical Risks
1. **Database Migration Failure**
   - Mitigation: Test on staging first, have rollback script ready

2. **Performance Degradation**
   - Mitigation: Index all foreign keys, monitor query performance

3. **Vertex AI Prompt Issues**
   - Mitigation: Test prompts thoroughly, have fallback prompts

### User Experience Risks
1. **Mode Confusion**
   - Mitigation: Clear mode indicators, help text, onboarding

2. **Frequent Mode Switching**
   - Mitigation: Add cooldown period, track switches

---

## 📝 Important Commands

### GCP Access
```bash
# SSH to production server
gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant"

# Production URL
http://34.162.168.124:3000
```

### Database Migration
```bash
# Run migration
DB_HOST=localhost DB_PORT=5432 DB_NAME=teachers_training DB_USER=teachers_user DB_PASSWORD=teachers_pass_2024 node scripts/run-migration.js

# Verify tables
PGPASSWORD=teachers_pass_2024 psql -h localhost -U teachers_user -d teachers_training -c "\dt"
```

### Git Operations
```bash
# Always commit and push changes
git add .
git commit -m "feat: [description]"
git push origin feature/multi-region-rbac

# Deploy to GCP
ssh karthi@34.162.168.124
cd /home/karthi/teachers_training
git pull origin feature/multi-region-rbac
docker-compose down && docker-compose up -d --build
```

### Vertex AI Refresh
```bash
# Refresh Vertex AI token
./scripts/refresh-vertex-token.sh
```

---

## 📚 Reference Documents

1. **Detailed Implementation Plan:** `DUAL_COACHING_BOT_IMPLEMENTATION_PLAN.md`
2. **Original Spec:** `/Users/karthi/specs/002-rag-pipeline-with/spec.md`
3. **Planning Document:** `/Users/karthi/specs/002-rag-pipeline-with/plan.md`
4. **Project Context:** `CLAUDE.md`

---

## 🎯 Next Immediate Steps

1. **Start Week 1, Day 1: Database Migration**
   - Create migration file
   - Define all 4 tables
   - Add indexes and constraints
   - Test on local environment

2. **Review Existing Code**
   - Check current service structure
   - Identify integration points
   - Review orchestrator logic

3. **Setup Development Environment**
   - Verify database connections
   - Check all dependencies
   - Test existing endpoints

---

## 📞 Quick Reference

- **Vertex AI Account:** karthi@kpitechllc.com
- **GCP Project:** lms-tanzania-consultant
- **Production IP:** 34.162.168.124
- **Database:** PostgreSQL (teachers_training)
- **Port:** 3000

---

**Status:** Ready to begin Week 1 implementation
**Next Action:** Create database migration file for dual coaching modes
**Last Updated:** 2025-10-31
