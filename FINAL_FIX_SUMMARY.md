# ✅ FINAL FIX - Prompt Viewer Course Access

**Date**: 2025-11-04 19:10 PST
**Issue**: Super Admin couldn't see courses in prompt viewer
**Root Cause**: Frontend calling wrong API endpoints
**Status**: ✅ **FIXED AND DEPLOYED**

---

## 🐛 The Problem

The user reported seeing "No accessible courses found" even after Docker rebuild. This was because:

### **Backend was correct** ✅
- Routes: `/api/prompt-approval/accessible-courses`
- Service: Properly handles region_id=5 ("All Regions")
- Database: Super Admin assigned to region_id=5

### **Frontend was wrong** ❌
- Was calling: `/api/chatbot-prompts/accessible-courses`
- Should call: `/api/prompt-approval/accessible-courses`
- **Endpoints didn't match!**

---

## 🔧 The Fix

### **Changed in prompt-viewer.html:**
```javascript
// BEFORE (Wrong - 404 error)
fetch(`${API_BASE}/chatbot-prompts/my-regions`)
fetch(`${API_BASE}/chatbot-prompts/accessible-courses`)
fetch(`${API_BASE}/chatbot-prompts/courses/${courseId}/default-prompt`)

// AFTER (Correct)
fetch(`${API_BASE}/prompt-approval/my-regions`)
fetch(`${API_BASE}/prompt-approval/accessible-courses`)
fetch(`${API_BASE}/prompt-approval/courses/${courseId}/default-prompt`)
```

### **Changed in prompt-editor.html:**
```javascript
// Fixed all /chatbot-prompts/ → /prompt-approval/
```

---

## 📊 Deployment Steps Completed

1. ✅ **Identified Issue**: Frontend/backend endpoint mismatch
2. ✅ **Fixed Files**:
   - public/admin/prompt-viewer.html (3 endpoints)
   - public/admin/prompt-editor.html (2 endpoints)
3. ✅ **Committed to GitHub**: Commit `6656f8c`
4. ✅ **Deployed to GCP**:
   - Pulled latest code
   - Copied HTML files to running container
   - Verified endpoints in container
5. ✅ **Created Playwright Test**: Automated verification

---

## 🧪 Testing Instructions

### **Method 1: Browser (Manual)**

1. **Hard Refresh** (IMPORTANT!):
   - Press `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
   - This bypasses browser cache

2. **Login**:
   - URL: http://34.162.168.124:3000/admin/login.html
   - Email: `admin@school.edu`
   - Password: `Admin123!`

3. **Navigate**:
   - Click "View Prompts" in sidebar
   - OR: http://34.162.168.124:3000/admin/prompt-viewer.html

4. **Expected Result**:
   ```
   ✅ NO blue warning message
   ✅ Course dropdown has "Business Studies Orientation (BS-ORIENT-001)"
   ✅ Select course → Both prompts display
   ✅ Regular Mode: Version 3
   ✅ Socratic Mode: Version 10
   ```

### **Method 2: Playwright (Automated)**

```bash
# Run the test
npx playwright test tests/e2e/prompt-viewer-fix-test.spec.js --project=chromium

# Expected output:
✅ Login successful
✅ Navigated to prompt viewer
✅ No error message displayed
✅ Course dropdown has options
✅ Selected a course
✅ Prompt container is visible
✅ Both prompt modes are visible
```

---

## 🔍 Verification Checklist

After hard refresh, you should see:

- [ ] **NO** "No accessible courses found" message
- [ ] Course dropdown is populated
- [ ] Dropdown shows: "Business Studies Orientation (BS-ORIENT-001)"
- [ ] Can select the course
- [ ] Regular Mode prompt displays
- [ ] Socratic Mode prompt displays
- [ ] Version numbers show (Regular: 3, Socratic: 10)
- [ ] Last updated dates show
- [ ] Admin emails show
- [ ] "Create Custom Prompt" button appears

---

## 🎯 What Was Fixed

| Component | Before | After | Status |
|-----------|--------|-------|--------|
| **Backend Routes** | `/prompt-approval/*` | `/prompt-approval/*` | ✅ Always correct |
| **Backend Service** | Handles region_id=5 | Handles region_id=5 | ✅ Fixed in earlier commit |
| **Frontend Viewer** | `/chatbot-prompts/*` ❌ | `/prompt-approval/*` ✅ | ✅ FIXED |
| **Frontend Editor** | `/chatbot-prompts/*` ❌ | `/prompt-approval/*` ✅ | ✅ FIXED |

---

## 🚀 Files Changed

### **Commit 1: Backend Fix** (4ee8b4b)
```
services/prompt-approval.service.js
- Added region_id=5 ("All Regions") handling
- getAccessibleCourses() now checks for ALL_REGIONS_ID
- canAdminAccessCourse() grants access for ALL_REGIONS_ID
```

### **Commit 2: Frontend Fix** (6656f8c)
```
public/admin/prompt-viewer.html
- /chatbot-prompts/my-regions → /prompt-approval/my-regions
- /chatbot-prompts/accessible-courses → /prompt-approval/accessible-courses
- /chatbot-prompts/courses/:id/default-prompt → /prompt-approval/courses/:id/default-prompt

public/admin/prompt-editor.html
- /chatbot-prompts/accessible-courses → /prompt-approval/accessible-courses
- /chatbot-prompts/courses/:id/default-prompt → /prompt-approval/courses/:id/default-prompt
```

---

## 📸 Expected Screenshots

### **Before Fix:**
```
╔══════════════════════════════════════════════════╗
║ View Coaching Bot Prompts                       ║
╠══════════════════════════════════════════════════╣
║ [ℹ️ No accessible courses found. You need to    ║
║    be assigned to a region with courses.]       ║
║                                                  ║
║ SELECT COURSE                                    ║
║ [-- Select a course -- ▼]                       ║
║                                                  ║
║         📝 No Prompts Found                      ║
║   This course does not have any prompts         ║
║   configured yet.                                ║
╚══════════════════════════════════════════════════╝
```

### **After Fix:**
```
╔══════════════════════════════════════════════════╗
║ View Coaching Bot Prompts                       ║
║ Your Regions: All Regions                       ║
╠══════════════════════════════════════════════════╣
║ SELECT COURSE                                    ║
║ [Business Studies Orientation (BS-ORIENT-001) ▼]║
║                                                  ║
║ ┌─ Regular Mode ──┐  ┌─ Socratic Mode ─────┐   ║
║ │ Version: 3      │  │ Version: 10         │   ║
║ │ [Prompt text...]│  │ [Prompt text...]    │   ║
║ └─────────────────┘  └─────────────────────┘   ║
║                                                  ║
║ [📝 Create Custom Prompt]                       ║
╚══════════════════════════════════════════════════╝
```

---

## 🐞 Debugging (If Still Not Working)

If you still see the error after hard refresh:

### **1. Check Browser Console**
```
Press F12 → Console Tab

✅ Should see:
- No 404 errors
- Successful API responses

❌ Should NOT see:
- 404 Not Found for /chatbot-prompts/
- CORS errors
- Authentication errors
```

### **2. Check Network Tab**
```
Press F12 → Network Tab → Refresh page

Look for:
/api/prompt-approval/accessible-courses

Click on it → Response tab → Should show:
{
  "success": true,
  "count": 1,
  "courses": [
    {
      "id": 8,
      "title": "Business Studies Orientation",
      "code": "BS-ORIENT-001",
      "region_id": 1,
      "region_name": "Tanzania"
    }
  ]
}
```

### **3. Try Incognito Mode**
```
Open new incognito/private window
Go to: http://34.162.168.124:3000/admin/login.html
Login and test
```

### **4. Check Container**
```bash
# SSH to GCP
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant"

# Verify frontend file is updated
docker exec teachers_training_app_1 grep -n "prompt-approval" /app/public/admin/prompt-viewer.html | head -5

# Should show lines with /prompt-approval/ (not /chatbot-prompts/)
```

---

## 📞 Next Steps

1. **Hard refresh your browser** (Cmd+Shift+R or Ctrl+Shift+R)
2. **Login** as admin@school.edu
3. **Go to** "View Prompts"
4. **Verify** dropdown has course
5. **Select** course and see prompts
6. **Share screenshot** if still not working

---

## 🎉 Success Criteria

When the fix is working:
- ✅ NO warning message about regions
- ✅ Course dropdown populated
- ✅ Can select course
- ✅ Prompts display for both modes
- ✅ Can click "Create Custom Prompt"
- ✅ Can submit prompt for approval

---

*Fix deployed: 2025-11-04 19:10 PST*
*Endpoint: http://34.162.168.124:3000*
*Status: LIVE - Frontend using correct API paths*
