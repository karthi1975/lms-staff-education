# Complete Quiz Upload Fix - Deployment Guide

## Problem Summary

1. **Module ID constraint violation** - Fixed ✅
2. **Module ID mismatch** - Module 13 doesn't exist, trying to upload to wrong module
3. **Course-module structure** - Need proper alignment (COURSE1→Module1, COURSE2→Module1)

## What's Been Fixed

### 1. Database Constraint Fix (✅ Complete)
- **Commit:** `5629a7e` - Added `module_id` to quiz_questions INSERT statement
- **Status:** Deployed to GitHub, needs deployment to GCP
- **Test Coverage:** 15/15 unit tests passing

### 2. Frontend Debugging (✅ Complete - Just Pushed)
- **Commit:** `9d3445c` - Added module ID debugging to quiz upload modal
- **Changes:**
  - Console logs show which module ID is being used
  - Modal subtitle displays "Database Module ID: X"
  - Upload requests are logged for debugging
- **Status:** Pushed to GitHub, needs deployment to GCP

### 3. Course-Module Structure Script (✅ Complete)
- **File:** `fix-course-module-structure.sh`
- **Purpose:** Creates proper course with modules 1-5
- **Status:** Ready to run on GCP

## Deployment Steps (Run on GCP)

### Step 1: Pull Latest Code

```bash
cd ~/teachers_training
git pull origin master
sudo docker-compose restart app
sleep 15
```

### Step 2: Set Up Proper Course-Module Structure

```bash
cd ~/teachers_training
chmod +x fix-course-module-structure.sh
./fix-course-module-structure.sh
```

This script will:
1. Create "Business Studies Form Two" course
2. Create modules 1-5 with proper titles:
   - Module 1: Production
   - Module 2: Financing
   - Module 3: Management
   - Module 4: Warehousing
   - Module 5: Opportunity
3. Show you the database IDs for each module
4. Provide upload commands for each quiz

### Step 3: Verify Course-Module Structure

```bash
sudo docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "
  SELECT
    c.code,
    m.id as module_db_id,
    m.sequence_order,
    m.title
  FROM courses c
  JOIN modules m ON m.course_id = c.id
  WHERE c.code = 'BUS-STUDIES-001'
  ORDER BY m.sequence_order;
"
```

Expected output:
```
     code         | module_db_id | sequence_order |    title
------------------+--------------+----------------+-------------
 BUS-STUDIES-001  |      X       |       1        | Production
 BUS-STUDIES-001  |      Y       |       2        | Financing
 BUS-STUDIES-001  |      Z       |       3        | Management
 ...
```

Note the `module_db_id` values - these are what you'll use for uploads.

### Step 4: Upload Quizzes

#### Option A: Via Admin Portal (Recommended)

1. Open browser: `http://YOUR_GCP_IP:3000/admin/lms-dashboard.html`
2. Open browser DevTools (F12) → Console tab
3. Navigate to "Business Studies Form Two" course
4. Expand modules to see the upload buttons
5. Click "📝 Upload Quiz" for Module 1
6. **Check console** - you'll see: `📝 Opening quiz upload modal for Module ID: X`
7. Select `module_01_production.json` file
8. Click Upload
9. **Check console** - you'll see: `🚀 Uploading quiz to module ID: X`
10. Verify success message

Repeat for modules 2-5 with their corresponding quiz files.

#### Option B: Via Command Line

Get the module IDs from Step 3, then:

```bash
# Login and get token
TOKEN=$(curl -s -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"Admin123!"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['tokens']['accessToken'])")

# Upload quiz for each module (replace MODULE_ID with actual database ID)
curl -X POST http://localhost:3000/api/admin/modules/MODULE_ID/quiz/upload \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @quizzes/CORRECT_MODULES/module_01_production.json
```

### Step 5: Verify Quiz Upload

```bash
sudo docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "
  SELECT
    m.sequence_order,
    m.title as module_title,
    q.id as quiz_id,
    COUNT(qq.id) as question_count
  FROM modules m
  LEFT JOIN quizzes q ON q.module_id = m.id
  LEFT JOIN quiz_questions qq ON qq.module_id = m.id
  WHERE m.course_id = (SELECT id FROM courses WHERE code = 'BUS-STUDIES-001')
  GROUP BY m.sequence_order, m.title, q.id
  ORDER BY m.sequence_order;
"
```

Expected output:
```
 sequence_order | module_title | quiz_id | question_count
----------------+--------------+---------+----------------
       1        | Production   |    X    |       5
       2        | Financing    |    Y    |       5
       3        | Management   |    Z    |       5
       4        | Warehousing  |    A    |       5
       5        | Opportunity  |    B    |       5
```

## Understanding Course-Module Structure

### Current Structure (What You Want)

```
COURSE: Business Studies Form Two (BUS-STUDIES-001)
├── Module 1: Production       (DB ID: varies, sequence: 1)
├── Module 2: Financing        (DB ID: varies, sequence: 2)
├── Module 3: Management       (DB ID: varies, sequence: 3)
├── Module 4: Warehousing      (DB ID: varies, sequence: 4)
└── Module 5: Opportunity      (DB ID: varies, sequence: 5)

COURSE: Teacher Training (if you create another course)
├── Module 1: Introduction     (DB ID: varies, sequence: 1)
├── Module 2: Classroom Mgmt   (DB ID: varies, sequence: 2)
└── ...
```

### Key Points

1. **Database ID (module.id)** - Unique across ALL modules in the system
2. **Sequence Order (module.sequence_order)** - Position within a course (1, 2, 3...)
3. **Quiz Upload** - Uses Database ID, not sequence order
4. **Frontend Display** - Shows "Module {sequence_order}" but uses {module.id} for API calls

## Debugging Tips

### If Module ID Still Wrong

1. **Check browser console** when opening upload modal:
   ```
   📝 Opening quiz upload modal for Module ID: 13
   ```
   If you see 13 but Module 13 doesn't exist, you're viewing the wrong course or modules.

2. **Verify you're in the right course:**
   - Make sure you clicked on "Business Studies Form Two"
   - Not a different course

3. **Check which modules exist:**
   ```bash
   sudo docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "SELECT id, title, course_id FROM modules ORDER BY id;"
   ```

### If Upload Still Fails

1. **Check app logs:**
   ```bash
   sudo docker logs teachers_training_app_1 --tail 50
   ```

2. **Verify the fix is deployed:**
   ```bash
   grep -A 5 "INSERT INTO quiz_questions" routes/admin.routes.js | grep module_id
   ```
   Should show `module_id,` in the INSERT statement.

3. **Test health endpoint:**
   ```bash
   curl http://localhost:3000/health
   ```

## Complete File Mapping

| Quiz File | Module Title | Sequence Order | Upload To |
|-----------|--------------|----------------|-----------|
| `module_01_production.json` | Production | 1 | Module with sequence_order=1 in BUS-STUDIES-001 |
| `module_02_financing.json` | Financing | 2 | Module with sequence_order=2 in BUS-STUDIES-001 |
| `module_03_management.json` | Management | 3 | Module with sequence_order=3 in BUS-STUDIES-001 |
| `module_04_warehousing.json` | Warehousing | 4 | Module with sequence_order=4 in BUS-STUDIES-001 |
| `module_05_opportunity.json` | Opportunity | 5 | Module with sequence_order=5 in BUS-STUDIES-001 |

## Success Criteria

✅ Business Studies course created with 5 modules
✅ Each module has correct title and sequence order
✅ Console logs show correct module ID when opening upload modal
✅ Quiz uploads succeed without constraint violation
✅ Database shows 5 questions per module
✅ Both module_id and quiz_id populated in quiz_questions table

## Next Steps After Successful Upload

1. Test quiz taking functionality
2. Verify quiz scoring works correctly
3. Test student progress tracking
4. Upload training content (PDFs, DOCX) for each module
5. Test AI assistant with quiz questions

## Support

If you still encounter issues:

1. Share the output of `fix-course-module-structure.sh`
2. Share browser console logs when clicking "Upload Quiz"
3. Share output of the verification SQL queries above
4. Check `sudo docker logs teachers_training_app_1`

All fixes are now in GitHub. Simply pull, restart, run the setup script, and upload quizzes!
