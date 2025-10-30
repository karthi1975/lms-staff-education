# Multi-Region RBAC System Specification

**Version:** 1.0
**Date:** 2025-10-30
**Status:** Implementation Ready

---

## 1. OVERVIEW

A comprehensive Role-Based Access Control (RBAC) system with multi-region support, course management, and enrollment capabilities for the Teachers Training Platform.

### Key Features
1. ✅ Course-specific customizable chatbot prompts (admin-editable UI)
2. ✅ Regional access control (Tanzania, Rwanda, Kenya, Burundi)
3. ✅ Three-tier role hierarchy (Super Admin, Admin, User)
4. ✅ Super Admin full system control
5. ✅ Regional Admin boundaries
6. ✅ Individual user enrollment (Name + WhatsApp)
7. ✅ Bulk CSV enrollment
8. ✅ WhatsApp notifications for enrollments
9. ✅ Course access restrictions by region
10. ✅ Enrollment management (view, export, remove, history)

---

## 2. ROLE DEFINITIONS

### 2.1 Super Admin
**Powers:**
- ✅ Full system access across ALL regions
- ✅ Create and manage ALL admin users
- ✅ Create and manage courses in any region
- ✅ View all users, enrollments, and analytics
- ✅ Configure system-wide settings
- ✅ Manage regional assignments
- ✅ Export all data across regions

**Restrictions:**
- None (full control)

### 2.2 Regional Admin
**Powers:**
- ✅ Manage courses within assigned region(s)
- ✅ Enroll users to courses in their region
- ✅ Upload CSV for bulk enrollment (region-restricted)
- ✅ View users enrolled in their region's courses
- ✅ Export enrollment data for their region
- ✅ Update course chatbot prompts for their courses
- ✅ Send WhatsApp notifications to their enrollees

**Restrictions:**
- ❌ Cannot access courses in other regions
- ❌ Cannot create Super Admins
- ❌ Cannot modify system-wide settings
- ❌ Cannot view users from other regions

### 2.3 User (Learner)
**Powers:**
- ✅ Access courses available in their region
- ✅ Complete course modules and quizzes
- ✅ Receive WhatsApp notifications
- ✅ View their own progress

**Restrictions:**
- ❌ Cannot access admin dashboard
- ❌ Cannot view courses from restricted regions
- ❌ Cannot manage other users

---

## 3. REGIONAL STRUCTURE

### 3.1 Supported Regions
```
1. Tanzania (TZ)
2. Rwanda (RW)
3. Kenya (KE)
4. Burundi (BI)
5. All Regions (for system-wide courses)
```

### 3.2 Regional Assignment
- Admins assigned to one or more regions
- Courses assigned to specific regions or "All Regions"
- Users inherit region from enrollment
- Multi-region admins can manage multiple regions

---

## 4. DATABASE SCHEMA

### 4.1 New Tables

#### `roles` - User role definitions
```sql
CREATE TABLE roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(50) UNIQUE NOT NULL, -- 'super_admin', 'admin', 'user'
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  level INTEGER NOT NULL, -- 1=super_admin, 2=admin, 3=user
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `regions` - Geographic regions
```sql
CREATE TABLE regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code VARCHAR(10) UNIQUE NOT NULL, -- 'TZ', 'RW', 'KE', 'BI', 'ALL'
  name VARCHAR(100) NOT NULL, -- 'Tanzania', 'Rwanda', etc.
  description TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `admin_regions` - Admin-Region assignments
```sql
CREATE TABLE admin_regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  region_id INTEGER NOT NULL REFERENCES regions(id),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by INTEGER REFERENCES users(id), -- Super Admin who assigned
  UNIQUE(user_id, region_id)
);
```

#### `course_regions` - Course-Region restrictions
```sql
CREATE TABLE course_regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  region_id INTEGER NOT NULL REFERENCES regions(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  UNIQUE(course_id, region_id)
);
```

#### `course_chatbot_prompts` - Custom prompts per course
```sql
CREATE TABLE course_chatbot_prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL UNIQUE REFERENCES courses(id),
  system_prompt TEXT NOT NULL,
  instruction_style VARCHAR(50) DEFAULT 'conversational', -- conversational, formal, casual
  language_preference VARCHAR(50) DEFAULT 'english', -- english, swahili, bilingual
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER REFERENCES users(id)
);
```

#### `enrollments` - User-Course enrollments
```sql
CREATE TABLE enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  course_id INTEGER NOT NULL REFERENCES courses(id),
  enrolled_by INTEGER REFERENCES users(id), -- Admin who enrolled them
  enrollment_method VARCHAR(20) DEFAULT 'manual', -- 'manual', 'csv_upload', 'self'
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'suspended', 'completed', 'removed'
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  removed_at TIMESTAMP,
  removed_by INTEGER REFERENCES users(id),
  removal_reason TEXT,
  UNIQUE(user_id, course_id)
);
```

#### `enrollment_history` - Audit trail for enrollments
```sql
CREATE TABLE enrollment_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id),
  action VARCHAR(50) NOT NULL, -- 'enrolled', 'suspended', 'completed', 'removed', 'reactivated'
  performed_by INTEGER REFERENCES users(id),
  reason TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `csv_upload_logs` - Track CSV enrollment uploads
```sql
CREATE TABLE csv_upload_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  course_id INTEGER NOT NULL REFERENCES courses(id),
  filename VARCHAR(255) NOT NULL,
  total_rows INTEGER NOT NULL,
  successful_enrollments INTEGER DEFAULT 0,
  failed_enrollments INTEGER DEFAULT 0,
  error_details TEXT, -- JSON array of errors
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 Modified Tables

#### `users` - Add role_id and region
```sql
ALTER TABLE users ADD COLUMN role_id INTEGER DEFAULT 3 REFERENCES roles(id); -- Default to 'user'
ALTER TABLE users ADD COLUMN primary_region_id INTEGER REFERENCES regions(id);
ALTER TABLE users ADD COLUMN full_name VARCHAR(200);
ALTER TABLE users ADD COLUMN whatsapp_number VARCHAR(20) UNIQUE;
```

#### `courses` - Add chatbot integration
```sql
ALTER TABLE courses ADD COLUMN use_custom_prompt BOOLEAN DEFAULT 0;
ALTER TABLE courses ADD COLUMN is_regional BOOLEAN DEFAULT 1; -- Regional or global
ALTER TABLE courses ADD COLUMN created_by INTEGER REFERENCES users(id);
```

---

## 5. API ENDPOINTS

### 5.1 Role & Permission Management

```
GET    /api/admin/rbac/roles                 - List all roles
GET    /api/admin/rbac/roles/:id             - Get role details
POST   /api/admin/rbac/users/:id/role        - Assign role to user (Super Admin only)
```

### 5.2 Region Management

```
GET    /api/admin/regions                    - List all regions
GET    /api/admin/regions/:id                - Get region details
POST   /api/admin/regions                    - Create region (Super Admin only)
PUT    /api/admin/regions/:id                - Update region (Super Admin only)
GET    /api/admin/regions/:id/admins         - List admins in region
POST   /api/admin/regions/:id/admins         - Assign admin to region (Super Admin only)
DELETE /api/admin/regions/:id/admins/:userId - Remove admin from region (Super Admin only)
```

### 5.3 Course Management

```
GET    /api/admin/courses                    - List courses (filtered by admin's region)
GET    /api/admin/courses/:id                - Get course details
POST   /api/admin/courses                    - Create course (with region assignment)
PUT    /api/admin/courses/:id                - Update course
DELETE /api/admin/courses/:id                - Delete course
GET    /api/admin/courses/:id/regions        - Get course regions
POST   /api/admin/courses/:id/regions        - Add region to course
DELETE /api/admin/courses/:id/regions/:regionId - Remove region from course
```

### 5.4 Course Chatbot Prompts

```
GET    /api/admin/courses/:id/chatbot-prompt        - Get course chatbot prompt
PUT    /api/admin/courses/:id/chatbot-prompt        - Update chatbot prompt
POST   /api/admin/courses/:id/chatbot-prompt/test   - Test prompt with sample query
```

### 5.5 Enrollment Management

```
# Individual Enrollment
POST   /api/admin/enrollments                - Enroll single user
GET    /api/admin/enrollments                - List enrollments (filtered by region)
GET    /api/admin/enrollments/:id            - Get enrollment details
DELETE /api/admin/enrollments/:id            - Remove enrollment
PUT    /api/admin/enrollments/:id/status     - Update enrollment status

# Bulk CSV Enrollment
POST   /api/admin/enrollments/bulk/csv       - Upload CSV for bulk enrollment
GET    /api/admin/enrollments/bulk/template  - Download CSV template
GET    /api/admin/enrollments/bulk/logs      - View CSV upload history
GET    /api/admin/enrollments/bulk/logs/:id  - Get specific upload log

# Enrollment by Course
GET    /api/admin/courses/:id/enrollments    - List enrollments for course
POST   /api/admin/courses/:id/enrollments    - Enroll user to course
GET    /api/admin/courses/:id/enrollments/export - Export enrollments as CSV

# Enrollment History
GET    /api/admin/enrollments/:id/history    - Get enrollment history
```

### 5.6 User Access Control

```
GET    /api/user/courses                     - List courses accessible to user
GET    /api/user/courses/:id                 - Access course (region-restricted)
POST   /api/user/courses/:id/access          - Check access permission
```

### 5.7 WhatsApp Notifications

```
POST   /api/admin/notifications/enrollment   - Send enrollment notification
POST   /api/admin/notifications/course-update - Send course update to enrollees
GET    /api/admin/notifications/history      - View notification history
```

---

## 6. SERVICES IMPLEMENTATION

### 6.1 Core Services

#### `rbac.service.js` - Role-based access control
```javascript
class RBACService {
  // Check if user has permission
  async checkPermission(userId, resource, action, context)

  // Get user's role
  async getUserRole(userId)

  // Get user's regions
  async getUserRegions(userId)

  // Check if user can access region
  async canAccessRegion(userId, regionId)

  // Check if user can manage course
  async canManageCourse(userId, courseId)
}
```

#### `region.service.js` - Regional management
```javascript
class RegionService {
  // Get all regions
  async getAllRegions()

  // Get region by ID
  async getRegionById(regionId)

  // Assign admin to region
  async assignAdminToRegion(adminId, regionId, assignedBy)

  // Remove admin from region
  async removeAdminFromRegion(adminId, regionId)

  // Get admins for region
  async getRegionAdmins(regionId)
}
```

#### `enrollment.service.js` - Enrollment management
```javascript
class EnrollmentService {
  // Enroll single user
  async enrollUser(userId, courseId, enrolledBy, method)

  // Bulk enroll from CSV
  async bulkEnrollFromCSV(csvData, courseId, enrolledBy)

  // Remove enrollment
  async removeEnrollment(enrollmentId, removedBy, reason)

  // Get course enrollments
  async getCourseEnrollments(courseId, filters)

  // Export enrollments to CSV
  async exportEnrollments(courseId)

  // Get enrollment history
  async getEnrollmentHistory(enrollmentId)

  // Check if user is enrolled
  async isEnrolled(userId, courseId)
}
```

#### `course-chatbot.service.js` - Custom chatbot prompts
```javascript
class CourseChatbotService {
  // Get course chatbot prompt
  async getCoursePrompt(courseId)

  // Update course chatbot prompt
  async updateCoursePrompt(courseId, promptData, updatedBy)

  // Get effective prompt (custom or default)
  async getEffectivePrompt(courseId)

  // Test prompt with sample query
  async testPrompt(courseId, sampleQuery)
}
```

#### `whatsapp-notification.service.js` - WhatsApp messaging
```javascript
class WhatsAppNotificationService {
  // Send enrollment confirmation
  async sendEnrollmentNotification(userId, courseId)

  // Send course update notification
  async sendCourseUpdateNotification(courseId, message)

  // Send bulk notifications
  async sendBulkNotifications(userIds, message)

  // Get notification history
  async getNotificationHistory(filters)
}
```

---

## 7. ADMIN UI PAGES

### 7.1 Dashboard (`/admin/index.html`)
- Overview of courses, users, enrollments (by region)
- Quick stats (total users, active courses, pending enrollments)
- Recent activity feed

### 7.2 Users Management (`/admin/users-rbac.html`)
- List all users (Super Admin) or regional users (Admin)
- Assign roles (Super Admin only)
- Assign regions to admins (Super Admin only)
- View user details and enrollments

### 7.3 Region Management (`/admin/regions.html`)
- List all regions
- Assign admins to regions (Super Admin only)
- View regional statistics

### 7.4 Course Management (`/admin/courses-rbac.html`)
- List courses (filtered by region for Admins)
- Create/edit courses
- Assign regions to courses
- Configure chatbot prompts
- View course enrollments

### 7.5 Chatbot Prompt Editor (`/admin/course-chatbot-prompt.html`)
- Rich text editor for system prompt
- Style selection (conversational, formal, casual)
- Language preference
- Test prompt with sample queries
- Preview mode

### 7.6 Enrollment Management (`/admin/enrollments.html`)
- **Individual Enrollment Tab:**
  - Form: Full Name, WhatsApp Number, Select Course
  - Search existing users
  - Enroll button with confirmation

- **Bulk CSV Upload Tab:**
  - Download CSV template button
  - Drag-and-drop CSV upload
  - Preview uploaded data
  - Validate and enroll button
  - Progress indicator

- **Enrolled Users Tab:**
  - Table: Name, WhatsApp, Course, Enrolled Date, Status
  - Filter by course, region, status
  - Search by name or WhatsApp
  - Actions: View Details, Remove, Send Message
  - Export to CSV button

- **Upload History Tab:**
  - List of CSV uploads
  - Date, Admin, Course, Success/Fail counts
  - View error details
  - Re-download original CSV

### 7.7 Enrollment Details (`/admin/enrollment-detail.html`)
- User information
- Course details
- Enrollment timeline
- Progress tracking
- Action history
- Remove enrollment with reason

---

## 8. USER EXPERIENCE FLOWS

### 8.1 Admin Enrolls User Manually
```
1. Admin clicks "Enroll User" button
2. Form appears: Full Name, WhatsApp Number, Select Course
3. Admin enters: "John Doe", "+255712345678", "Business Studies"
4. System validates WhatsApp number format
5. System checks if user exists (by WhatsApp)
   - If new: Create user account
   - If exists: Use existing account
6. System checks enrollment doesn't exist
7. Create enrollment record
8. Send WhatsApp confirmation message
9. Show success notification
10. Add to enrollment list
```

### 8.2 Admin Uploads CSV for Bulk Enrollment
```
1. Admin clicks "Bulk Enrollment" tab
2. Downloads CSV template (columns: Full Name, WhatsApp Number)
3. Fills CSV with user data
4. Drags CSV file to upload area
5. System validates CSV format
6. System shows preview table (first 10 rows)
7. Admin reviews and clicks "Enroll All"
8. System processes each row:
   - Validate WhatsApp format
   - Create/find user
   - Create enrollment
   - Log success/failure
9. Show progress bar (e.g., "Processing 45/100...")
10. Display final results:
    - "Successfully enrolled: 95"
    - "Failed: 5 (view errors)"
11. Send WhatsApp notifications to all successfully enrolled
12. Save upload log for audit trail
```

### 8.3 User Accesses Course via WhatsApp
```
1. User sends message to WhatsApp bot
2. System identifies user by phone number
3. System checks user's enrollments
4. System filters courses by user's region
5. If course not in user's region:
   - Send: "❌ Access Denied. This course is not available in your region."
6. If enrolled and region matches:
   - Use course-specific chatbot prompt (if configured)
   - Process message with custom prompt
   - Send educational response
7. If not enrolled:
   - Send: "You're not enrolled in this course. Contact your administrator."
```

### 8.4 Admin Updates Course Chatbot Prompt
```
1. Admin navigates to course list
2. Clicks "Edit Chatbot Prompt" for a course
3. Editor loads with current prompt (or default)
4. Admin edits system prompt:
   "You are a business studies tutor specializing in entrepreneurship..."
5. Selects style: "Conversational"
6. Selects language: "Bilingual (English/Swahili)"
7. Tests prompt with sample query: "What is a business plan?"
8. Sees preview response using new prompt
9. Clicks "Save Prompt"
10. All enrolled users now get responses using this custom prompt
```

---

## 9. CSV UPLOAD FORMAT

### 9.1 Template Structure
```csv
Full Name,WhatsApp Number
John Doe,+255712345678
Jane Smith,+255723456789
Peter Mwangi,+254720123456
```

### 9.2 Validation Rules
- **Full Name:** Required, 2-200 characters
- **WhatsApp Number:** Required, E.164 format (+country_code + number)
- **Duplicate Detection:** Check existing enrollments
- **Region Validation:** User's number country code must match admin's region

### 9.3 Error Handling
```json
{
  "total": 100,
  "successful": 95,
  "failed": 5,
  "errors": [
    {
      "row": 12,
      "name": "Invalid User",
      "whatsapp": "invalid_number",
      "error": "Invalid WhatsApp number format"
    },
    {
      "row": 45,
      "name": "John Doe",
      "whatsapp": "+255712345678",
      "error": "User already enrolled in this course"
    }
  ]
}
```

---

## 10. WHATSAPP NOTIFICATIONS

### 10.1 Enrollment Confirmation
```
🎉 Welcome to [Course Name]!

You have been enrolled in our teachers training program.

📚 Course: [Course Name]
🆔 Your ID: [User ID]
📱 Your Number: [WhatsApp Number]

To get started, send:
• "menu" - View course menu
• "help" - Get assistance
• Or ask any question!

Happy learning! 📖
```

### 10.2 Course Update Notification
```
📢 Course Update: [Course Name]

[Admin's custom message]

Questions? Just ask!
```

### 10.3 Access Denied Message
```
❌ Access Denied

This course is not available in your region.

Available regions: [Region List]
Your region: [User Region]

Contact your administrator for more information.
```

---

## 11. PERMISSIONS MATRIX

| Action | Super Admin | Regional Admin | User |
|--------|-------------|----------------|------|
| View all courses | ✅ | ❌ (Region only) | ❌ (Enrolled only) |
| Create course | ✅ | ✅ (Own region) | ❌ |
| Edit course | ✅ | ✅ (Own region) | ❌ |
| Delete course | ✅ | ✅ (Own region) | ❌ |
| Update chatbot prompt | ✅ | ✅ (Own region) | ❌ |
| Enroll user | ✅ | ✅ (Own region) | ❌ |
| Upload CSV | ✅ | ✅ (Own region) | ❌ |
| Remove enrollment | ✅ | ✅ (Own region) | ❌ |
| Export enrollments | ✅ | ✅ (Own region) | ❌ |
| Create admin | ✅ | ❌ | ❌ |
| Assign regions | ✅ | ❌ | ❌ |
| View all regions | ✅ | ✅ (Assigned only) | ❌ |
| Send notifications | ✅ | ✅ (Own region) | ❌ |
| Access course content | ✅ | ✅ | ✅ (If enrolled) |

---

## 12. SECURITY CONSIDERATIONS

### 12.1 Authentication
- All admin endpoints require JWT authentication
- Token includes user_id, role_id, and assigned regions
- Session timeout: 8 hours

### 12.2 Authorization
- Every request validated against RBAC rules
- Regional restrictions enforced at service layer
- SQL injection protection (already implemented)
- Prompt injection protection (already implemented)

### 12.3 Data Privacy
- Admins can only see users in their regions
- WhatsApp numbers encrypted at rest
- Audit trail for all enrollment changes
- GDPR-compliant data export

---

## 13. IMPLEMENTATION PHASES

### Phase 1: Database & Core Services (Day 1)
- ✅ Create all database tables
- ✅ Implement RBAC service
- ✅ Implement region service
- ✅ Implement enrollment service
- ✅ Seed initial data (roles, regions)

### Phase 2: API Endpoints (Day 1-2)
- ✅ Implement role & region endpoints
- ✅ Implement course management endpoints
- ✅ Implement enrollment endpoints
- ✅ Add RBAC middleware to all routes

### Phase 3: Admin UI (Day 2)
- ✅ Create region management page
- ✅ Create users with roles page
- ✅ Create enrollment management page
- ✅ Create chatbot prompt editor

### Phase 4: CSV & Notifications (Day 2-3)
- ✅ Implement CSV upload processor
- ✅ Implement WhatsApp notifications
- ✅ Create bulk upload UI
- ✅ Add notification history

### Phase 5: Testing & Deployment (Day 3)
- ✅ Unit tests for services
- ✅ Integration tests for workflows
- ✅ Deploy to GCP
- ✅ Documentation

---

## 14. SUCCESS METRICS

- ✅ Super Admin can create admins for any region
- ✅ Regional Admin can only manage their region
- ✅ Users only see courses in their region
- ✅ CSV upload processes 1000+ users without errors
- ✅ WhatsApp notifications sent within 5 seconds
- ✅ Access denied for cross-region access attempts
- ✅ Enrollment history tracks all changes
- ✅ Custom chatbot prompts work per course

---

## 15. ROLLOUT PLAN

### Week 1: Setup & Training
- Deploy system to production
- Train Super Admin on system
- Create initial regions and admins

### Week 2: Pilot
- Enroll 100 test users across 2 regions
- Test CSV uploads
- Validate WhatsApp notifications

### Week 3: Full Launch
- Enroll all users
- Monitor for issues
- Collect feedback

---

**Specification Approved:** Ready for Implementation
**Estimated Duration:** 3 days
**Priority:** High
**Dependencies:** Security system (deployed ✅)

---

**Next Step:** Begin Phase 1 - Database Schema & Migrations
