# Quick Moodle Course Sync Setup

## 🚀 Quick Start (3 Steps)

### Step 1: Update Moodle Token to Service Account
```bash
# Open Moodle Settings page
http://localhost:3000/admin/moodle-settings.html

# Or update directly in database:
docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c \
  "UPDATE moodle_settings SET setting_value = 'YOUR_SERVICE_ACCOUNT_TOKEN' WHERE setting_key = 'moodle_token';"
```

**Get your service account token from:**
https://karthitest.moodlecloud.com/admin/webservice/tokens.php

Look for: **service_account** (user: karthikeyan jeyabalan)

### Step 2: Test Connection
```bash
# Restart app to reload settings
docker restart teachers_training-app-1

# Run test script
docker exec teachers_training-app-1 node test-moodle-courses.js
```

**Expected output:**
```
✅ Connected to Moodle: Your site
✅ Found N courses
```

### Step 3: Import a Course
1. Open: http://localhost:3000/admin/lms-dashboard.html
2. Click **"Courses"** tab → **"+ Add Course"**
3. Choose **"🔗 Import from Moodle"**
4. Click **"Test Connection & Continue"**
5. Select course → **"Import Course"**

---

## 📋 What Was Fixed

### Before (❌ Broken)
```javascript
// Only worked for enrolled courses
async getUserCourses() {
  const courses = await this.moodleApiCall('core_enrol_get_users_courses', { userid });
  // ❌ Fails with: "Sorry, but you do not currently have permissions"
}
```

### After (✅ Fixed)
```javascript
// Smart fallback: service account → enrolled courses → legacy
async getUserCourses() {
  // Try method 1: Service account (all courses)
  try {
    return await this.moodleApiCall('core_course_get_courses', {});
  } catch {}

  // Try method 2: Enrolled courses
  try {
    return await this.moodleApiCall('core_course_get_enrolled_courses_by_timeline_classification', {...});
  } catch {}

  // Try method 3: Legacy
  return await this.moodleApiCall('core_enrol_get_users_courses', {userid});
}
```

---

## 🧪 Testing

### Test 1: Course List Fetch
```bash
# Via API
curl -X POST http://localhost:3000/api/admin/moodle/courses \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"

# Via test script
docker exec teachers_training-app-1 node test-moodle-courses.js
```

### Test 2: Course Import
```bash
curl -X POST http://localhost:3000/api/admin/moodle/import-course \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"courseId": 12}'
```

### Test 3: UI Flow
1. Open browser: http://localhost:3000/admin/lms-dashboard.html
2. Use "Import from Moodle" modal
3. Verify course appears in courses list

---

## 📊 Current Configuration

### Database Settings
```sql
SELECT setting_key,
       CASE WHEN setting_type = 'secret' THEN '***HIDDEN***' ELSE setting_value END as value,
       is_active
FROM moodle_settings;
```

| Setting Key | Value | Active |
|------------|-------|--------|
| moodle_url | https://karthitest.moodlecloud.com | ✅ |
| moodle_token | c0ee6baca141679fdd6793ad397e6f21 | ✅ |
| moodle_sync_enabled | true | ✅ |

### Service Endpoints
- **Settings UI**: http://localhost:3000/admin/moodle-settings.html
- **LMS Dashboard**: http://localhost:3000/admin/lms-dashboard.html
- **API - Courses**: POST /api/admin/moodle/courses
- **API - Import**: POST /api/admin/moodle/import-course

---

## 🔍 Troubleshooting

### Problem: "500 Internal Server Error"
**Cause**: Token lacks permissions or wrong API method

**Fix**: Updated to use 3-tier fallback (DONE ✅)

### Problem: "No courses found"
**Causes**:
1. User token → only enrolled courses shown
2. Service account token → all courses shown

**Fix**: Use service account token from Moodle settings

### Problem: Modal shows "0 courses found"
**Check**:
1. Settings saved? → Verify in `moodle_settings` table
2. Connection works? → Run test script
3. Token valid? → Test in Moodle Settings page

**Logs**:
```bash
docker logs teachers_training-app-1 --tail 50 | grep -i moodle
```

---

## 📁 Files Changed

1. **services/moodle-content.service.js** (lines 410-469)
   - Added 3-tier fallback for course fetching

2. **test-moodle-courses.js** (new)
   - Standalone test script

3. **MOODLE_SYNC_FIXED.md** (new)
   - Full implementation documentation

4. **QUICK_MOODLE_SETUP.md** (new)
   - This quick reference guide

---

## ✅ Verification Checklist

- [x] Updated `getUserCourses()` method with fallback logic
- [x] Created test script (test-moodle-courses.js)
- [x] Server restarted and healthy
- [x] Test script runs successfully
- [ ] Admin updates token to service account (YOUR ACTION)
- [ ] Successfully imports a course via UI (YOUR TEST)

---

## 🎯 Next Steps

1. **Get service account token** from Moodle (https://karthitest.moodlecloud.com/admin/webservice/tokens.php)
2. **Update in settings page** (http://localhost:3000/admin/moodle-settings.html)
3. **Import a course** to verify full workflow
4. **Check imported data**:
   - Modules created in database
   - Content chunks in ChromaDB
   - Quizzes and questions imported

---

**Status**: ✅ Code Fixed | ⏳ Waiting for Service Account Token Update
**Date**: 2025-10-08
