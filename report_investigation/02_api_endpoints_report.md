# API Endpoints Documentation Report
**Generated**: Wed Oct 29 05:47:31 MDT 2025
**Server**: Express.js on GCP

## Table of Contents
1. Authentication Routes
2. Admin Routes
3. User Routes
4. WhatsApp Routes
5. File Processing Routes

## 1. Authentication Routes (/api)
**File**: `routes/auth.routes.js`

- **UpostE** `/api/admin/login` (line 16)
- **UpostE** `/api/admin/logout` (line 46)
- **UpostE** `/api/admin/refresh` (line 59)
- **UpostE** `/api/users/identify` (line 91)
- **UpostE** `/api/admin/password/change` (line 131)
- **UpostE** `/api/admin/password/reset` (line 162)
- **UpostE** `/api/admin/create` (line 194)
- **UgetE** `/api/admin/profile` (line 224)

## 2. Admin Routes (/api/admin)
**File**: `routes/admin.routes.js`

### Enrollment Endpoints
- **UpostE** `/api/admin/users/enroll` (line 905)
- **UgetE** `/api/admin/users/:phoneNumber/enrollment-status` (line 986)
- **UgetE** `/api/admin/users/:userId/enrollment-history` (line 1043)

### User Management Endpoints
- **UgetE** `/api/admin/users` (line 178)
- **UgetE** `/api/admin/users/:userId/progress` (line 194)
- **UpostE** `/api/admin/users/register-with-verification` (line 813)
- **UpostE** `/api/admin/users/resend-verification` (line 856)
- **UgetE** `/api/admin/users/pending-verification` (line 882)
- **UpostE** `/api/admin/users/enroll` (line 905)
- **UpostE** `/api/admin/users/:phoneNumber/reset-pin` (line 950)
- **UgetE** `/api/admin/users/:phoneNumber/enrollment-status` (line 986)
- **UpostE** `/api/admin/users/:phoneNumber/unblock` (line 1023)
- **UgetE** `/api/admin/users/:userId/enrollment-history` (line 1043)
- **UgetE** `/api/admin/admin-users` (line 1504)
- **UpostE** `/api/admin/admin-users` (line 1526)
- **UdeleteE** `/api/admin/admin-users/:userId` (line 1646)
- **UdeleteE** `/api/admin/users/:userId` (line 1751)
- **UgetE** `/api/admin/users/:userId/progress-detailed` (line 1832)
- **UgetE** `/api/admin/users/:userId/quiz-attempts/:moduleId` (line 1910)

### Course Management Endpoints
- **UpostE** `/api/admin/courses` (line 287)
- **UpostE** `/api/admin/portal/courses` (line 351)
- **UgetE** `/api/admin/courses` (line 418)
- **UgetE** `/api/admin/portal/courses` (line 442)
- **UgetE** `/api/admin/courses/:courseId` (line 474)
- **UgetE** `/api/admin/portal/courses/:courseId/modules` (line 506)
- **UpostE** `/api/admin/portal/courses/:courseId/modules` (line 574)
- **UpostE** `/api/admin/portal/courses/:courseId/modules/:moduleId/upload` (line 626)
- **UgetE** `/api/admin/courses/:courseId/modules/:moduleId/quiz` (line 1254)
- **UdeleteE** `/api/admin/courses/:courseId/modules/:moduleId/quiz` (line 1327)
- **UdeleteE** `/api/admin/courses/:courseId` (line 1380)
- **UgetE** `/api/admin/courses/:courseId/modules` (line 1786)

### Module Management Endpoints
- **UgetE** `/api/admin/modules` (line 48)
- **UgetE** `/api/admin/modules/:moduleId` (line 63)
- **UgetE** `/api/admin/modules/:moduleId/content` (line 84)
- **UpostE** `/api/admin/modules/:moduleId/content` (line 100)
- **UgetE** `/api/admin/portal/courses/:courseId/modules` (line 506)
- **UpostE** `/api/admin/modules` (line 543)
- **UpostE** `/api/admin/portal/courses/:courseId/modules` (line 574)
- **UpostE** `/api/admin/portal/courses/:courseId/modules/:moduleId/upload` (line 626)
- **UpostE** `/api/admin/modules/:moduleId/process-content` (line 680)
- **UgetE** `/api/admin/modules/:moduleId/processing-status` (line 707)
- **UgetE** `/api/admin/modules/:moduleId/graph` (line 736)
- **UgetE** `/api/admin/modules/:moduleId/related` (line 766)
- **UpostE** `/api/admin/modules/:moduleId/quiz/upload` (line 1079)
- **UgetE** `/api/admin/courses/:courseId/modules/:moduleId/quiz` (line 1254)
- **UdeleteE** `/api/admin/courses/:courseId/modules/:moduleId/quiz` (line 1327)
- **UgetE** `/api/admin/courses/:courseId/modules` (line 1786)

### Quiz Management Endpoints
- **UpostE** `/api/admin/modules/:moduleId/quiz/upload` (line 1079)
- **UgetE** `/api/admin/courses/:courseId/modules/:moduleId/quiz` (line 1254)
- **UdeleteE** `/api/admin/courses/:courseId/modules/:moduleId/quiz` (line 1327)
- **UgetE** `/api/admin/users/:userId/quiz-attempts/:moduleId` (line 1910)

## 3. User Routes (/api/users)
**File**: `routes/user.routes.js`

- **UpostE** `/api/users/user/verify` (line 11)
- **UgetE** `/api/users/user/quiz/:moduleId` (line 67)
- **UpostE** `/api/users/user/quiz/:moduleId/submit` (line 171)
- **UgetE** `/api/users/user/quiz/:moduleId/attempts` (line 351)

## 4. WhatsApp Routes (/whatsapp)
**File**: `routes/whatsapp.routes.js`

*File not found*

## 5. File Processing Routes (/api/file-processing)
**File**: `routes/file-processing.routes.js`

- **UpostE** `/api/file-processing/courses/:courseId/process-files` (line 24)
- **UgetE** `/api/file-processing/courses/:courseId/processing-status/:jobId` (line 107)

## 6. All Route Files

```
-rw-r--r--@ 1 karthi  staff  60737 Oct 28 22:50 /Users/karthi/business/staff_education/teachers_training/routes/admin.routes.js
-rw-r--r--@ 1 karthi  staff   5411 Oct 22 17:14 /Users/karthi/business/staff_education/teachers_training/routes/auth.routes.js
-rw-r--r--@ 1 karthi  staff   3897 Oct  6 17:53 /Users/karthi/business/staff_education/teachers_training/routes/certificate.routes.js
-rw-r--r--@ 1 karthi  staff  13299 Oct 28 18:17 /Users/karthi/business/staff_education/teachers_training/routes/classification.routes.js
-rw-r--r--@ 1 karthi  staff  11337 Oct 28 18:17 /Users/karthi/business/staff_education/teachers_training/routes/coaching.routes.js
-rw-r--r--@ 1 karthi  staff  12682 Oct 28 18:17 /Users/karthi/business/staff_education/teachers_training/routes/enhanced-rag.routes.js
-rw-r--r--@ 1 karthi  staff   5755 Oct 28 18:17 /Users/karthi/business/staff_education/teachers_training/routes/file-list.routes.js
-rw-r--r--@ 1 karthi  staff  11517 Oct 28 21:54 /Users/karthi/business/staff_education/teachers_training/routes/file-processing.routes.js
-rw-r--r--@ 1 karthi  staff   4626 Oct 28 21:18 /Users/karthi/business/staff_education/teachers_training/routes/simple-upload.routes.js
-rw-r--r--@ 1 karthi  staff   5019 Oct 28 18:17 /Users/karthi/business/staff_education/teachers_training/routes/twilio-webhook.routes.js
-rw-r--r--@ 1 karthi  staff  10963 Oct 28 18:17 /Users/karthi/business/staff_education/teachers_training/routes/user.routes.js
```
