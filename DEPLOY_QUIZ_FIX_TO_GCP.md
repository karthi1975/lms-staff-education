# Deploy Quiz Upload Fix to GCP

The quiz upload fix has been committed and pushed to GitHub. Follow these steps to deploy it to your GCP instance:

## Quick Deployment (Recommended)

SSH into your GCP instance and run:

```bash
cd ~/teachers_training
./gcp-pull-and-deploy.sh
```

This will:
1. Pull latest changes from GitHub (including the module_id fix)
2. Rebuild the Docker containers
3. Restart all services

## Manual Deployment (Alternative)

If the script doesn't work, run these commands manually:

```bash
# SSH into GCP
gcloud compute ssh teachers-training --zone=us-east5-a --project=lms-tanzania-consultant

# Navigate to project directory
cd ~/teachers_training

# Pull latest changes
git pull origin master

# Rebuild and restart containers
sudo docker-compose down
sudo docker-compose build app
sudo docker-compose up -d

# Wait for services to start
sleep 30

# Check status
sudo docker-compose ps

# Test the health endpoint
curl http://localhost:3000/health
```

## What Was Fixed

**Commit: `5629a7e`** - Fix: Add module_id to quiz_questions INSERT statement

The quiz upload endpoint (`POST /api/admin/modules/:moduleId/quiz/upload`) was missing the `module_id` parameter in the INSERT statement. This has been fixed:

**Before:**
```javascript
INSERT INTO quiz_questions (
  quiz_id,
  question_text,
  ...
) VALUES ($1, $2, ...)
```

**After:**
```javascript
INSERT INTO quiz_questions (
  module_id,  // ✅ Added
  quiz_id,
  question_text,
  ...
) VALUES ($1, $2, $3, ...)  // ✅ module_id as first parameter
```

## Verify the Fix

After deployment, test the quiz upload:

1. Login to admin portal: `http://YOUR_GCP_IP:3000/admin/login.html`
2. Go to a course and select a module
3. Upload a quiz JSON file
4. Should succeed without the "null value in module_id" error

## Test Files Available

Sample quiz files are in `/quizzes/CORRECT_MODULES/`:
- `module_01_production.json`
- `module_02_financing.json`
- `module_03_management.json`
- `module_04_warehousing.json`
- `module_05_opportunity.json`

## Unit Tests

Comprehensive unit tests have been added in `tests/unit/quiz-upload.test.js`:
- 15 test cases covering all scenarios
- All tests passing ✅
- Run locally with: `npm test -- tests/unit/quiz-upload.test.js`

## Troubleshooting

If you still get the error after deployment:

1. **Check Docker logs:**
   ```bash
   sudo docker logs teachers_training_app_1 --tail 50
   ```

2. **Verify the code was pulled:**
   ```bash
   git log --oneline -3
   # Should show: 5629a7e fix: Add module_id to quiz_questions INSERT statement
   ```

3. **Check the actual code in routes/admin.routes.js:**
   ```bash
   grep -A 10 "INSERT INTO quiz_questions" routes/admin.routes.js
   # Should show module_id in the INSERT statement
   ```

4. **Restart the app container:**
   ```bash
   sudo docker restart teachers_training_app_1
   ```

## Contact

If issues persist, check the container logs and verify the database schema matches the code.
