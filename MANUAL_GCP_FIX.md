# Manual GCP Fix - Quiz Upload Module ID Issue

Since you're getting the error on GCP, the instance hasn't pulled the latest code yet. Here's how to manually fix it:

## Option 1: Quick SSH Fix

1. SSH into your GCP instance (however you normally do it)
2. Navigate to the project:
   ```bash
   cd ~/teachers_training
   ```

3. Check current code version:
   ```bash
   git log --oneline -1
   # If you don't see: 5629a7e fix: Add module_id to quiz_questions INSERT statement
   # Then the fix hasn't been deployed yet
   ```

4. Pull latest changes:
   ```bash
   git pull origin master
   ```

5. Restart the app:
   ```bash
   sudo docker-compose restart app
   # OR
   sudo docker restart teachers_training_app_1
   ```

6. Wait 10 seconds and test

## Option 2: Direct File Edit on GCP

If git pull doesn't work, you can manually edit the file on GCP:

1. SSH into GCP instance

2. Edit the routes file:
   ```bash
   nano ~/teachers_training/routes/admin.routes.js
   ```

3. Find the quiz upload section (around line 1106-1127)

4. Look for this INSERT statement:
   ```javascript
   INSERT INTO quiz_questions (
     quiz_id,           // OLD - missing module_id
     question_text,
   ```

5. Change it to:
   ```javascript
   INSERT INTO quiz_questions (
     module_id,         // ✅ ADD THIS LINE
     quiz_id,
     question_text,
   ```

6. Update the VALUES line from:
   ```javascript
   ) VALUES ($1, $2, $3, $4, $5, $6, $7)
   ```

   To:
   ```javascript
   ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)  // ✅ 8 parameters now
   ```

7. Update the parameter array (around line 1118):
   ```javascript
   `, [
     moduleId,          // ✅ ADD THIS as first parameter
     quizId,
     q.question,
     'multichoice',
     JSON.stringify(q.options),
     q.correctAnswer.toString(),
     q.explanation || null,
     1.0
   ]);
   ```

8. Save file (Ctrl+O, Enter, Ctrl+X in nano)

9. Restart the app:
   ```bash
   sudo docker-compose restart app
   ```

## Option 3: Copy Fixed File to GCP

You can copy the fixed file from your local machine:

```bash
# From your local machine
scp routes/admin.routes.js YOUR_GCP_IP:~/teachers_training/routes/admin.routes.js
```

Then SSH into GCP and restart:
```bash
sudo docker-compose restart app
```

## Verify the Fix

After applying any of the above options:

1. Check the app logs:
   ```bash
   sudo docker logs teachers_training_app_1 --tail 50
   ```

2. Test quiz upload through the admin portal

3. You should no longer see the "null value in module_id" error

## The Exact Code Change

Here's the complete fixed section (lines 1106-1127 in routes/admin.routes.js):

```javascript
const result = await postgresService.pool.query(`
  INSERT INTO quiz_questions (
    module_id,           // ✅ ADDED
    quiz_id,
    question_text,
    question_type,
    options,
    correct_answer,
    explanation,
    points
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)  // ✅ 8 params
  RETURNING id
`, [
  moduleId,              // ✅ ADDED as $1
  quizId,                // $2
  q.question,            // $3
  'multichoice',         // $4
  JSON.stringify(q.options),  // $5
  q.correctAnswer.toString(), // $6
  q.explanation || null,      // $7
  1.0                    // $8
]);
```

The key changes are:
1. Added `module_id` to the column list
2. Changed VALUES from 7 to 8 parameters
3. Added `moduleId` as the first parameter in the array
