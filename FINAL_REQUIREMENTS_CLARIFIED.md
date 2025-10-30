# Final Requirements - Clarified & Approved

**Date:** 2025-10-30
**Status:** ✅ APPROVED - Ready for Implementation
**Branch:** feature/multi-region-rbac

---

## ✅ USER CONFIRMED REQUIREMENTS

All requirements reviewed and approved with the following clarifications:

---

### 1. **Role Terminology** ✅ UPDATED

**CHANGED:** "User" → "WhatsApp User"

```
Roles (3):
├─ Super Admin (Level 1)
├─ Regional Administrator (Level 2)
└─ WhatsApp User (Level 3) ← UPDATED TERMINOLOGY
```

**Rationale:** Better reflects that these users interact via WhatsApp messaging

**Database Update:**
```sql
role name: 'whatsapp_user'
display_name: 'WhatsApp User'
```

---

### 2. **Regions** ✅ CONFIRMED

```
Initial 5 Regions:
├─ Tanzania (TZ)
├─ Rwanda (RW)
├─ Kenya (KE)
├─ Burundi (BI)
└─ All Regions (ALL)
```

**Super Admin Powers:**
- ✅ Can ADD new regions (e.g., Uganda, Ethiopia)
- ✅ Can UPDATE existing region details
- ✅ Expandable system

---

### 3. **Course-Region Relationship** ✅ CONFIRMED

**User Confirmed:**
> "ONE REGION can have MANY courses"

**Implementation:**
```
Relationship: Region (1) → (Many) Courses

Examples:
Tanzania Region:
├─ Business Studies for Entrepreneurs
├─ Teacher Training Fundamentals
├─ Classroom Management
└─ ... (many courses)

Kenya Region:
├─ Business Studies (separate from TZ version)
├─ Education Technology
└─ ... (many courses)

All Regions:
├─ System-Wide Course
└─ Global Training Module
```

**Database:**
```sql
courses.region_id → regions.id (one-to-one foreign key)
One course = One region
One region = Many courses ✓
```

---

### 4. **Default Region Assignment** ✅ CONFIRMED

**Behavior:**
```
Auto-assign existing users to Tanzania:
├─ role_id = 3 (whatsapp_user)
└─ primary_region_id = 1 (Tanzania)

Super Admin can change:
├─ Via user management UI
└─ Reassign user to different region
```

---

### 5. **CSV Upload - Region Assignment** ✅ CRITICAL CLARIFICATION

**User Confirmed:**
> "The upload should add in database with region of the Admin. Super user can also upload for other region"

**Implementation:**

**Regional Admin (e.g., Tanzania):**
```
CSV Upload Flow:
1. Admin uploads CSV with (Name, WhatsApp)
2. System AUTO-ASSIGNS all users to Tanzania
3. No region selector shown
4. Users get primary_region_id = 1 (Tanzania)
```

**Super Admin:**
```
CSV Upload Flow:
1. Admin uploads CSV with (Name, WhatsApp)
2. System SHOWS region dropdown selector
3. Super Admin selects target region (TZ, RW, KE, BI, ALL)
4. All uploaded users assigned to selected region
```

**UI Mockup:**

**Regional Admin View:**
```
╔═══════════════════════════════════════╗
║ Bulk CSV Upload                       ║
╠═══════════════════════════════════════╣
║ Select Course: [Dropdown ▼]          ║
║ Upload CSV:    [Drag & Drop Area]    ║
║                                       ║
║ Note: All users will be assigned to  ║
║ Tanzania region automatically.        ║
║                                       ║
║ [Preview] [Enroll All]                ║
╚═══════════════════════════════════════╝
```

**Super Admin View:**
```
╔═══════════════════════════════════════╗
║ Bulk CSV Upload                       ║
╠═══════════════════════════════════════╣
║ Select Region: [Tanzania ▼]          ║ ← ADDED
║ Select Course: [Dropdown ▼]          ║
║ Upload CSV:    [Drag & Drop Area]    ║
║                                       ║
║ [Preview] [Enroll All]                ║
╚═══════════════════════════════════════╝
```

**CSV Format (Unchanged):**
```csv
Full Name,WhatsApp Number
John Doe,+255712345678
Jane Smith,+255723456789
```

**No region column needed - system assigns automatically!**

---

### 6. **WhatsApp Messages - Language Support** ✅ IMPORTANT

**User Confirmed:**
> "It can be both based on the course content"

**Implementation:**

**Course Settings:**
```
course_chatbot_prompts table:
├─ language_preference VARCHAR(50)
   ├─ 'english' → English only
   ├─ 'swahili' → Swahili only
   └─ 'bilingual' → Both languages
```

**Message Behavior:**

**English Only Course:**
```
🎉 Welcome to Business Studies!

You have been enrolled...
```

**Swahili Only Course:**
```
🎉 Karibu kwenye Masomo ya Biashara!

Umesajiliwa...
```

**Bilingual Course:**
```
🎉 Welcome to Business Studies!
   Karibu kwenye Masomo ya Biashara!

You have been enrolled in our program.
Umesajiliwa katika programu yetu.

To get started, send "menu" | Ili kuanza, tuma "menu"
```

**System Implementation:**
```javascript
// Pseudo-code
if (course.language_preference === 'bilingual') {
  message = generateBilingualMessage(templateKey);
} else if (course.language_preference === 'swahili') {
  message = generateSwahiliMessage(templateKey);
} else {
  message = generateEnglishMessage(templateKey);
}
```

---

### 7. **Regional Admin Permissions** ✅ CONFIRMED

**User Confirmed:**
> "Right admin can do anything within the region. CRUD operations allowed only for their region"

**Full CRUD Powers Within Region:**

| Operation | Regional Admin (Tanzania) |
|-----------|---------------------------|
| **Create** | ✅ Courses in TZ<br>✅ Enroll users to TZ courses<br>✅ Upload CSV (auto TZ region)<br>✅ Create chatbot prompts for TZ courses |
| **Read** | ✅ View all TZ courses<br>✅ View TZ enrollments<br>✅ View TZ users<br>✅ View TZ upload history |
| **Update** | ✅ Edit TZ courses<br>✅ Update enrollment status (suspend/reactivate)<br>✅ Update chatbot prompts<br>✅ Change user details (TZ users) |
| **Delete** | ✅ Delete TZ courses<br>✅ Remove enrollments<br>✅ Remove users from TZ courses |

**Cannot Do:**
- ❌ Create/edit courses in other regions
- ❌ View users from other regions
- ❌ Create Super Admins or other Regional Admins
- ❌ Add new regions
- ❌ Change system-wide settings

---

### 8. **Course Assignment** ✅ CONFIRMED

**User Confirmed:**
> "Existing courses need manual assignment - OK? Yes"

**Behavior:**
```
After migration:
├─ Existing courses: region_id = NULL
├─ Super Admin must manually assign regions
└─ Courses with NULL region not visible to Regional Admins

Super Admin Dashboard:
├─ List shows courses with [Not Assigned] badge
├─ Bulk assign option available
└─ Can assign individually
```

---

## 📊 UPDATED DATABASE SCHEMA

### Roles Table (Updated)
```sql
INSERT INTO roles (name, display_name, description, level) VALUES
  ('super_admin', 'Super Administrator', 'Full system access', 1),
  ('admin', 'Regional Administrator', 'Regional management', 2),
  ('whatsapp_user', 'WhatsApp User', 'Course access via WhatsApp', 3);
                    ↑ CHANGED
```

### CSV Upload Table (Enhancement Needed)
```sql
CREATE TABLE csv_upload_logs (
  ...existing columns...
  target_region_id INTEGER,  -- ← ADD THIS
  -- Region that was selected for this upload
  -- For Regional Admin: auto-filled with their region
  -- For Super Admin: from dropdown selection
  FOREIGN KEY (target_region_id) REFERENCES regions(id)
);
```

---

## 🎯 KEY USER FLOWS (Updated)

### Flow 1: Regional Admin Uploads CSV

```
Tanzania Regional Admin logs in
└─ Enrollments → Bulk Upload
   ├─ Selects Course: "Business Studies" (only TZ courses shown)
   ├─ Uploads CSV: "teachers_list.csv"
   ├─ System Preview:
   │  ├─ Row 1: John Doe, +255712345678 ✓
   │  ├─ Row 2: Jane Smith, +255723456789 ✓
   │  └─ Region: Tanzania (auto-assigned) 🔒
   ├─ Clicks "Enroll All"
   ├─ Progress: "Processing 95/100..."
   ├─ Results: "100 success, 0 failed"
   └─ All users created with:
      ├─ role_id = 3 (whatsapp_user)
      ├─ primary_region_id = 1 (Tanzania) ← AUTO
      └─ enrolled in selected TZ course
```

### Flow 2: Super Admin Uploads CSV for Kenya

```
Super Admin logs in
└─ Enrollments → Bulk Upload
   ├─ Selects Region: [Kenya ▼] ← ADDITIONAL STEP
   ├─ Selects Course: "Teacher Training" (can see all courses)
   ├─ Uploads CSV: "kenya_teachers.csv"
   ├─ System Preview:
   │  ├─ Row 1: Peter Mwangi, +254720123456 ✓
   │  ├─ Row 2: Sarah Njeri, +254731234567 ✓
   │  └─ Region: Kenya (selected) ✓
   ├─ Clicks "Enroll All"
   └─ All users created with:
      ├─ role_id = 3 (whatsapp_user)
      ├─ primary_region_id = 3 (Kenya) ← FROM DROPDOWN
      └─ enrolled in selected KE course
```

### Flow 3: WhatsApp User Receives Bilingual Message

```
User enrolled in bilingual course sends message
System responds based on course.language_preference:

If language_preference = 'bilingual':
  ┌─────────────────────────────────────┐
  │ 📚 Business Studies Module 1        │
  │    Somo la 1 la Masomo ya Biashara  │
  │                                     │
  │ What is entrepreneurship?           │
  │ Ujasiriamali ni nini?              │
  │                                     │
  │ [English explanation]                │
  │ [Swahili explanation]                │
  │                                     │
  │ Ask more questions! | Uliza zaidi!  │
  └─────────────────────────────────────┘
```

---

## 🔄 CHANGES SUMMARY

| Item | Before | After | Reason |
|------|--------|-------|--------|
| **Role Name** | 'user' | 'whatsapp_user' | Better describes WhatsApp interaction |
| **CSV Region Assignment** | Not specified | Auto (Regional Admin) or Dropdown (Super Admin) | User clarification |
| **WhatsApp Language** | English only assumed | English, Swahili, or Bilingual | User requirement |
| **Regional Admin CRUD** | Implied | Explicitly full CRUD within region | User confirmation |

---

## ✅ IMPLEMENTATION CHECKLIST

### Database (Phase 1) - IN PROGRESS
- [x] Update role name to 'whatsapp_user'
- [ ] Add target_region_id to csv_upload_logs table
- [ ] Add language_preference options documentation
- [ ] Run migration locally
- [ ] Test seeded data

### Services (Phase 2) - NEXT
- [ ] CSV processor: Auto-assign region based on admin role
- [ ] WhatsApp notification: Support bilingual messages
- [ ] Region service: CRUD for Super Admin
- [ ] Enrollment service: Region-aware enrollment
- [ ] RBAC service: Check regional permissions

### API Endpoints (Phase 3)
- [ ] CSV upload endpoint: Region handling logic
- [ ] Region CRUD endpoints (Super Admin only)
- [ ] Course endpoints: Regional filtering
- [ ] User endpoints: Regional filtering

### UI (Phase 4)
- [ ] CSV upload: Conditional region selector
- [ ] Course form: Language preference selector
- [ ] Regional dashboard: Show only assigned regions
- [ ] Region management page (Super Admin)

### WhatsApp Integration (Phase 5)
- [ ] Bilingual message templates
- [ ] Language detection (if needed)
- [ ] Message translation service
- [ ] Test all 3 language modes

---

## 📋 FINAL CONFIRMATION

**All Requirements Approved:**
- ✅ Roles: Super Admin, Regional Admin, WhatsApp User
- ✅ Regions: TZ, RW, KE, BI, ALL (expandable by Super Admin)
- ✅ Course-Region: One course = One region; One region = Many courses
- ✅ Default Region: Auto Tanzania (changeable by Super Admin)
- ✅ CSV Upload: Auto-region for Regional Admin, dropdown for Super Admin
- ✅ WhatsApp: Bilingual support based on course content
- ✅ Permissions: Full CRUD for Regional Admin within their region
- ✅ Course Assignment: Manual by Super Admin

**Status:** ✅ APPROVED - Ready to Build

---

**Branch:** feature/multi-region-rbac
**Next Step:** Commit updates and start Phase 2 implementation
**Estimated Time:** 30-35 hours remaining

---

**Document Version:** 2.0 (Final Approved)
**Last Updated:** 2025-10-30
**Approved By:** User Confirmation (Option A Review)
