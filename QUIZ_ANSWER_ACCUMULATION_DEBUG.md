# Quiz Answer Accumulation Bug - Debugging

## Date: 2025-10-06

## Issue
Only 1 out of 4 quiz answers is being saved and sent to Moodle, resulting in 0.0/10 grade even when user answers all questions correctly.

## Evidence
- Database shows only 1 answer in `quiz_attempts.answers` column
- Moodle sync logs show "Prepared 1 answers for Moodle" instead of 4
- User answered all questions correctly (A, B, C, C) but got 0.0/10

## Investigation

### Code Flow
1. User answers Question 1 → `handleQuizState` adds answer to array
2. Array saved to `conversation_context.quiz_answers` via `updateConversationState`
3. User answers Question 2 → `handleQuizState` retrieves saved answers from DB
4. **PROBLEM**: Only seeing 1 answer instead of 2

### Potential Causes
1. ✅ **quiz_answers column exists** (type: jsonb, default: '[]'::jsonb)
2. ✅ **getConversationContext fetches all columns** (SELECT *)
3. ✅ **updateConversationState saves the field** (dynamic SET clause)
4. ❓ **Type conversion issue?** (JSON string → JSONB column)
5. ❓ **Context not refreshed between messages?**
6. ❓ **Concurrent update race condition?**

### Code Changes Made

#### 1. Added Debug Logging in handleQuizState
**File**: `services/moodle-orchestrator.service.js:582`

```javascript
const quizAnswersStr = context.quiz_answers || '[]';
logger.info(`[DEBUG] quiz_answers from DB: ${quizAnswersStr}`);
answers = quizAnswersStr ? JSON.parse(quizAnswersStr) : [];
logger.info(`Retrieved ${answers.length} previous answers from context`);
```

#### 2. Added Debug Logging Before Save
**File**: `services/moodle-orchestrator.service.js:609-610`

```javascript
const answersJson = JSON.stringify(answers);
logger.info(`[DEBUG] Saving ${answers.length} answers to DB: ${answersJson.substring(0, 200)}...`);
```

#### 3. Added Verification After DB Update
**File**: `services/moodle-orchestrator.service.js:880-885`

```javascript
// Verify update
const verify = await postgresService.query(
  'SELECT quiz_answers::text FROM conversation_context WHERE user_id = $1',
  [userId]
);
logger.info(`[DEBUG] After update, quiz_answers in DB: ${verify.rows[0]?.quiz_answers || 'NULL'}`);
```

## Expected Debug Output

When user takes quiz, we should see:

### Question 1
```
[DEBUG] quiz_answers from DB: []
Retrieved 0 previous answers from context
Now have 1 total answers (just added Q1)
[DEBUG] Saving 1 answers to DB: [{"questionId":139,"userAnswer":"A",...}]
[DEBUG] updateConversationState for user 1: {"current_question_index":1,"quiz_answers":"[{\"questionId\":139,\"userAnswer\":\"A\",...]"}
[DEBUG] After update, quiz_answers in DB: [{"questionId":139,"userAnswer":"A",...}]
```

### Question 2
```
[DEBUG] quiz_answers from DB: [{"questionId":139,"userAnswer":"A",...}]
Retrieved 1 previous answers from context
Now have 2 total answers (just added Q2)
[DEBUG] Saving 2 answers to DB: [{"questionId":139,"userAnswer":"A",...},{"questionId":140,"userAnswer":"B",...}]
[DEBUG] After update, quiz_answers in DB: [{"questionId":139,...},{"questionId":140,...}]
```

### Question 3
```
[DEBUG] quiz_answers from DB: [{"questionId":139,...},{"questionId":140,...}]
Retrieved 2 previous answers from context
Now have 3 total answers (just added Q3)
```

### Question 4 (Completion)
```
[DEBUG] quiz_answers from DB: [{"questionId":139,...},{"questionId":140,...},{"questionId":141,...}]
Retrieved 3 previous answers from context
Now have 4 total answers (just added Q4)
Score: 4/4 (100%)
Prepared 4 answers for Moodle
```

## Next Steps

1. **Test the quiz again in WhatsApp**
2. **Check application logs** (`docker-compose logs -f app`)
3. **Look for the [DEBUG] lines** to see where answers are lost
4. **Compare actual vs expected output**

### If answers are NOT persisting:
- Check PostgreSQL logs for errors
- Verify JSON escaping in SQL query
- Check if column type needs explicit casting

### If answers ARE persisting but not retrieving:
- Check context retrieval timing
- Verify JSON parsing logic
- Check if context is cached somewhere

## Reference Files
- Working Python script: `h5p-conversion/quiz_complete_working.py`
- Moodle sync service: `services/moodle-sync.service.js` (multi-page logic)
- Orchestrator: `services/moodle-orchestrator.service.js` (quiz flow)

## Status
🔍 **DEBUGGING** - Waiting for test run with enhanced logging

---

**User Action Required**: Please test the quiz in WhatsApp and share the logs or let me know the results.
