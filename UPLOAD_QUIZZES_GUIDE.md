# Quiz Upload Guide - GCP Instance

## Problem
You're trying to upload quizzes to Module 13, but Module 13 doesn't exist in your database.

## Solution
Upload quizzes to **existing** modules only.

## Step 1: Check Which Modules Exist

SSH into your GCP instance and run:

```bash
sudo docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "
  SELECT m.id, m.title, c.title as course_title
  FROM modules m
  JOIN courses c ON c.id = m.course_id
  ORDER BY m.id;
"
```

This will show you all available modules with their IDs.

## Step 2: Match Quiz Files to Modules

You have these quiz files ready:
- `module_01_production.json` → Upload to Module with "Production" in title
- `module_02_financing.json` → Upload to Module with "Financing" in title
- `module_03_management.json` → Upload to Module with "Management" in title
- `module_04_warehousing.json` → Upload to Module with "Warehousing" in title
- `module_05_opportunity.json` → Upload to Module with "Opportunity" in title

## Step 3: Upload Quiz via Admin Portal

1. **Go to:** `http://YOUR_GCP_IP:3000/admin/lms-dashboard.html`

2. **Find the correct module** (one that actually exists, like module 1, 2, 3, etc.)

3. **Click on that module** to expand it

4. **Look for "Upload Quiz" or similar button**

5. **Select the corresponding JSON file** from your `quizzes/CORRECT_MODULES/` folder

6. **Upload** - Should now work without the module_id error ✅

## Step 4: Alternative - Upload via API (Command Line)

If the UI isn't working, you can upload via curl from your GCP instance:

```bash
# 1. Login to get token
TOKEN=$(curl -s -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"Admin123!"}' \
  | grep -o '"accessToken":"[^"]*"' | sed 's/"accessToken":"//; s/"$//')

# 2. Check the token
echo "Token: ${TOKEN:0:20}..."

# 3. Upload quiz for module 1 (adjust module ID as needed)
curl -X POST http://localhost:3000/api/admin/modules/1/quiz/upload \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @/path/to/quizzes/CORRECT_MODULES/module_01_production.json

# Repeat for other modules (2, 3, 4, 5)
```

## Common Issues

### Issue 1: "Module not found" (404)
**Cause:** Trying to upload to a module that doesn't exist
**Solution:** Check which modules exist (Step 1) and use the correct module ID

### Issue 2: "null value in module_id" constraint
**Cause:** Old code without the fix
**Solution:** Already fixed! Just restart: `sudo docker-compose restart app`

### Issue 3: 404 errors for graph-stats
**Cause:** These endpoints may not be implemented yet
**Solution:** Ignore these errors - they don't affect quiz upload

## Verification

After uploading, verify the quiz was saved:

```bash
sudo docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "
  SELECT
    qq.id,
    qq.module_id,
    qq.quiz_id,
    LEFT(qq.question_text, 50) as question
  FROM quiz_questions qq
  WHERE qq.module_id = 1  -- Change to your module ID
  ORDER BY qq.id
  LIMIT 10;
"
```

Should show your uploaded questions with both module_id and quiz_id populated ✅

## Next Steps

1. Find which modules exist in your database
2. Upload quizzes to those modules using the admin portal
3. Verify quizzes appear correctly
4. Test taking the quiz as a student (via WhatsApp or test interface)
