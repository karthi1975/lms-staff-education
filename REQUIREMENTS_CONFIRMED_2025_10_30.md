# Multi-Region RBAC - Requirements Confirmed & Schema Finalized

**Date:** 2025-10-30
**Branch:** feature/multi-region-rbac
**Status:** Phase 1 Complete - Requirements Confirmed, Schema Finalized

---

## ✅ CONFIRMED REQUIREMENTS

Based on user review and clarifications:

| # | Requirement | Confirmed Value | Status |
|---|-------------|-----------------|--------|
| 1 | **Database** | Use existing PostgreSQL | ✅ Confirmed |
| 2 | **CSV Size Limit** | 5,000 users maximum per upload | ✅ Confirmed |
| 3 | **WhatsApp Rate Limiting** | 60 notifications/minute | ✅ Confirmed |
| 4 | **Default Region** | Auto-assign existing users to Tanzania (changeable by Super Admin) | ✅ Confirmed |
| 5 | **Existing Courses** | Manual assignment by Super Admin only, pre-filtered for Regional Admins | ✅ Confirmed |
| 6 | **Admin Creation** | Only Super Admin creates new admins via dashboard | ✅ Confirmed |
| 7 | **Multi-Region Courses** | **NO** - One course = One region (or "All Regions") | ✅ Confirmed |
| 8 | **Region Management** | Super Admin can add new regions beyond initial 5 | ✅ Confirmed |

---

## 🔄 SCHEMA SIMPLIFICATION (Requirement #7)

### Original Design (Many-to-Many)
```sql
CREATE TABLE course_regions (
  course_id INTEGER,
  region_id INTEGER,
  UNIQUE(course_id, region_id)
);
```
**Allowed:** Course in multiple regions simultaneously (e.g., TZ + RW)

### Final Design (One-to-One)
```sql
ALTER TABLE courses ADD COLUMN region_id INTEGER;
```
**Allows:**
- ✅ Course in Tanzania OR Kenya (not both)
- ✅ Course in "All Regions" (available everywhere)
- ❌ Course in "Tanzania + Kenya" (but not all)

### Rationale
1. Simpler schema
2. Better performance
3. Easier queries
4. Clearer regional boundaries
5. Matches actual use case

---

## 📊 FINAL DATABASE SCHEMA

### New Tables (7)

1. **`roles`** (3 rows seeded)
   ```sql
   - super_admin (level 1)
   - admin (level 2)
   - user (level 3)
   ```

2. **`regions`** (5 rows seeded, expandable)
   ```sql
   - TZ (Tanzania)
   - RW (Rwanda)
   - KE (Kenya)
   - BI (Burundi)
   - ALL (All Regions)
   + Super Admin can add more (e.g., Uganda, Ethiopia)
   ```

3. **`admin_regions`** - Admin-region assignments
   ```sql
   - user_id → which admin
   - region_id → which region(s) they manage
   - assigned_by → who assigned them
   ```

4. **`course_chatbot_prompts`** - Custom AI prompts per course
   ```sql
   - course_id
   - system_prompt
   - instruction_style (conversational, formal, casual)
   - language_preference (english, swahili, bilingual)
   ```

5. **`enrollments`** - User-course enrollments
   ```sql
   - user_id
   - course_id
   - enrollment_method (manual, csv_upload, self)
   - status (active, suspended, completed, removed)
   ```

6. **`enrollment_history`** - Full audit trail
   ```sql
   - enrollment_id
   - action (enrolled, suspended, completed, removed)
   - performed_by
   - reason
   ```

7. **`csv_upload_logs`** - Bulk enrollment tracking
   ```sql
   - uploaded_by
   - course_id
   - total_rows
   - successful_enrollments
   - failed_enrollments
   - error_details (JSON)
   ```

8. **`whatsapp_notifications`** - Notification delivery log
   ```sql
   - user_id
   - message_type (enrollment, course_update, reminder)
   - delivery_status (pending, sent, delivered, failed)
   - twilio_message_sid
   ```

### Modified Tables (2)

**`users`:**
```sql
+ role_id INTEGER DEFAULT 3           -- Links to roles table
+ primary_region_id INTEGER            -- Links to regions table
```

**`courses`:**
```sql
+ region_id INTEGER                    -- Links to regions table (one-to-one)
+ use_custom_prompt BOOLEAN DEFAULT 0  -- Uses course_chatbot_prompts
+ is_regional BOOLEAN DEFAULT 1        -- Regional or global course
+ created_by INTEGER                   -- Admin who created
```

### Views (3)

1. **`v_users_with_roles`** - Users with role and region details
2. **`v_courses_with_regions`** - Courses with single region assignment
3. **`v_active_enrollments`** - Active enrollments with user/course details

---

## 🎯 DEFAULT ASSIGNMENTS (Auto-Applied)

### Super Admin
```sql
UPDATE users
SET role_id = 1,              -- super_admin
    primary_region_id = 5      -- ALL regions
WHERE email = 'admin@school.edu';
```

### Existing Users
```sql
UPDATE users
SET role_id = 3,              -- user/learner
    primary_region_id = 1      -- Tanzania (TZ)
WHERE role_id IS NULL;
```

### Existing Courses
```
region_id = NULL (requires manual assignment by Super Admin)
```

---

## 🚀 USER EXPERIENCE FLOWS

### 1. Super Admin Creates Regional Admin

```
Super Admin Dashboard
└─ Users → Create New Admin
   ├─ Enter: Name, Email, WhatsApp
   ├─ Select Role: "Regional Administrator"
   ├─ Select Regions: ☑ Tanzania ☑ Kenya
   └─ Click "Create Admin"
      → Email sent with login credentials
      → Admin can now manage TZ + KE courses
```

### 2. Regional Admin Creates Course

```
Regional Admin (Tanzania) Dashboard
└─ Courses → Create New Course
   ├─ Enter: Title, Code, Description
   ├─ Region: [Tanzania] (auto-selected, locked)
   ├─ Use Custom Chatbot Prompt: ☑ Yes
   │  └─ Opens prompt editor
   └─ Click "Create Course"
      → Course created with region_id = 1 (TZ)
      → Only visible to TZ admins and enrolled TZ users
```

### 3. Admin Enrolls User (Individual)

```
Regional Admin Dashboard
└─ Enrollments → Enroll New User
   ├─ Full Name: "John Doe"
   ├─ WhatsApp: "+255712345678"
   ├─ Select Course: "Business Studies" (only TZ courses shown)
   └─ Click "Enroll"
      → System checks if user exists
      → Creates enrollment record
      → Sends WhatsApp notification
      → Shows success message
```

### 4. Admin Uploads CSV (Bulk)

```
Regional Admin Dashboard
└─ Enrollments → Bulk Upload
   ├─ Download CSV Template
   ├─ Fill with 500 users
   ├─ Drag & drop CSV file
   ├─ Preview first 10 rows
   ├─ Select Course: "Business Studies"
   └─ Click "Enroll All"
      → Progress bar: "Processing 450/500..."
      → Results: "495 success, 5 failed (view errors)"
      → WhatsApp notifications sent
      → Upload logged in csv_upload_logs
```

### 5. User Accesses Course via WhatsApp

```
User sends: "Tell me about entrepreneurship"
System checks:
  ├─ User region: Tanzania (TZ)
  ├─ Course region: Tanzania (TZ) ✅ Match
  ├─ User enrolled: Yes ✅
  ├─ Load course chatbot prompt
  └─ Generate response using custom prompt

If region mismatch:
  └─ Send: "❌ Access Denied. This course is not available in your region."
```

###6. Super Admin Adds New Region

```
Super Admin Dashboard
└─ Regions → Add New Region
   ├─ Code: "UG"
   ├─ Name: "Uganda"
   ├─ Description: "Republic of Uganda"
   └─ Click "Create Region"
      → New region available for course assignment
      → Can assign admins to Uganda region
```

---

## 📋 NEXT STEPS - IMPLEMENTATION ROADMAP

### Phase 2: Core Services (6-8 hours)
- [ ] `services/rbac.service.js` - Role & permission checking
- [ ] `services/region.service.js` - Region management & validation
- [ ] `services/enrollment.service.js` - Individual & bulk enrollment
- [ ] `services/course-chatbot.service.js` - Custom prompts per course
- [ ] `services/whatsapp-notification.service.js` - WhatsApp messaging
- [ ] `services/csv-processor.service.js` - Parse & validate CSV (5K limit)

### Phase 3: API Endpoints (6-8 hours)
- [ ] `routes/rbac.routes.js` - Role assignment (Super Admin only)
- [ ] `routes/region.routes.js` - Region CRUD (Super Admin + viewing)
- [ ] `routes/course-rbac.routes.js` - Course CRUD with region filtering
- [ ] `routes/enrollment.routes.js` - Individual enrollment
- [ ] `routes/csv-enrollment.routes.js` - Bulk CSV upload
- [ ] `routes/whatsapp-notification.routes.js` - Send notifications
- [ ] `middleware/rbac-auth.js` - Check permissions on all routes

### Phase 4: Admin UI (8-10 hours)
- [ ] `/admin/users-rbac.html` - User management with roles
- [ ] `/admin/regions.html` - Region management (Super Admin)
- [ ] `/admin/courses-rbac.html` - Courses with regional filtering
- [ ] `/admin/course-chatbot-prompt.html` - Prompt editor
- [ ] `/admin/enrollments.html` - 4 tabs (individual, bulk, list, history)
- [ ] `/admin/enrollment-detail.html` - View/edit enrollment
- [ ] Update existing `/admin/index.html` - Add RBAC dashboard widgets

### Phase 5: CSV & WhatsApp (3-4 hours)
- [ ] CSV template generator
- [ ] CSV parser with validation
- [ ] Progress tracking UI (WebSocket or polling)
- [ ] WhatsApp templates (enrollment, update, denied)
- [ ] Rate limiter (60/minute)
- [ ] Delivery status tracking

### Phase 6: Testing & Deployment (4-6 hours)
- [ ] Unit tests for services
- [ ] Integration tests for workflows
- [ ] Test CSV with 5,000 users
- [ ] Test regional access restrictions
- [ ] Test WhatsApp notifications
- [ ] Run migration on local DB
- [ ] Deploy to GCP
- [ ] Run migration on production
- [ ] Smoke tests on production

---

## 🔐 PERMISSIONS MATRIX (Finalized)

| Action | Super Admin | Regional Admin (TZ) | User |
|--------|-------------|---------------------|------|
| View all courses | ✅ All regions | ✅ TZ only | ❌ Enrolled only |
| Create course | ✅ Any region | ✅ TZ only (auto-assigned) | ❌ |
| Edit course | ✅ All | ✅ TZ only | ❌ |
| Delete course | ✅ All | ✅ TZ only | ❌ |
| Update chatbot prompt | ✅ All | ✅ TZ only | ❌ |
| Enroll user (manual) | ✅ All | ✅ TZ only | ❌ |
| Upload CSV | ✅ All | ✅ TZ only | ❌ |
| Create admin | ✅ | ❌ | ❌ |
| Assign regions to admin | ✅ | ❌ | ❌ |
| Add new region | ✅ | ❌ | ❌ |
| View users | ✅ All | ✅ TZ only | ❌ Own only |
| Send notifications | ✅ All | ✅ TZ only | ❌ |

---

## 📊 PROGRESS SUMMARY

**Completed:**
- ✅ Requirements gathering & confirmation
- ✅ Database schema design (simplified)
- ✅ Migration SQL file (7 tables, 2 modified, 3 views)
- ✅ Default data seeding (roles, regions, assignments)
- ✅ Git branch created & committed
- ✅ Documentation (spec, branch status, requirements)

**Overall Progress:** 25% (Phase 1 complete)

**Time Spent:** ~5 hours (design & planning)
**Time Remaining:** ~30-35 hours (implementation & testing)

---

## 🚦 READY TO BUILD

All requirements confirmed. Schema finalized. Ready to implement:

**Next Immediate Steps:**
1. Run database migration locally
2. Start building services (rbac, region, enrollment)
3. Create API endpoints with middleware
4. Build admin UI pages
5. Implement CSV processor & WhatsApp notifications
6. Test everything
7. Deploy to GCP

**Estimated Completion:** 3-4 days of focused work

---

**Branch:** feature/multi-region-rbac
**Last Commit:** 9eb342a - Simplified schema based on confirmed requirements
**GitHub:** https://github.com/karthi1975/lms-staff-education/tree/feature/multi-region-rbac

**Ready for:** Phase 2 - Core Services Implementation

---

**Created:** 2025-10-30
**Status:** ✅ Requirements Finalized - Ready to Build
