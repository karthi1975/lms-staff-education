# Quiz Answer Accumulation - ROOT CAUSE FOUND & FIXED

## Date: 2025-10-07

## Problem
Only 1 out of 4 quiz answers was being saved, resulting in 0.0/10 Moodle grade.

## Root Cause
**PostgreSQL JSONB Double-Parse Error**

The `quiz_answers` column is type `jsonb` in PostgreSQL. The PostgreSQL driver (`pg`) automatically parses JSONB columns into JavaScript objects/arrays when fetching data.

However, the code was treating it as a JSON **string** and calling `JSON.parse()` on an already-parsed object:

```javascript
// BEFORE (BROKEN)
const quizAnswersStr = context.quiz_answers || '[]';  // This is already an array!
answers = JSON.parse(quizAnswersStr);  // ❌ Trying to parse an object throws error
```

### What Was Happening:
1. **Question 1**: `quiz_answers = []` (empty array from DB)
   - Code tries: `JSON.parse([])` → **ERROR** (can't parse object)
   - Catch block resets: `answers = []` ✓
   - Adds answer: `answers = [{ Q1 }]`
   - Saves to DB: `JSON.stringify([{ Q1 }])` ✓

2. **Question 2**: `quiz_answers = [{ Q1 }]` (array object from DB)
   - Code tries: `JSON.parse([{ Q1 }])` → **ERROR** (can't parse object)
   - Catch block resets: `answers = []` ❌ **LOST Q1**
   - Adds answer: `answers = [{ Q2 }]` (only Q2, Q1 lost!)
   - Saves to DB: `JSON.stringify([{ Q2 }])` ❌

3. **Question 3**: Same issue - only Q3 saved
4. **Question 4**: Same issue - only Q4 saved

### Evidence from Logs:
```
[DEBUG] quiz_answers from DB: [object Object]
Failed to parse quiz_answers: Unexpected token o in JSON at position 1
Now have 1 total answers (just added Q4)  ← Should be 4!
Prepared 1 answers for Moodle  ← Should be 4!
```

## Fix Applied

### File: `services/moodle-orchestrator.service.js`

#### Before (Lines 579-587):
```javascript
let answers = [];
try {
  const quizAnswersStr = context.quiz_answers || '[]';
  answers = quizAnswersStr ? JSON.parse(quizAnswersStr) : [];
  logger.info(`Retrieved ${answers.length} previous answers from context`);
} catch (parseError) {
  logger.warn('Failed to parse quiz_answers, starting fresh:', parseError.message);
  answers = [];
}
```

#### After (Lines 579-597):
```javascript
let answers = [];
try {
  const quizAnswersData = context.quiz_answers;
  logger.info(`[DEBUG] quiz_answers from DB (type: ${typeof quizAnswersData}):`, JSON.stringify(quizAnswersData));

  // PostgreSQL jsonb is already parsed as object/array by the driver
  if (Array.isArray(quizAnswersData)) {
    answers = quizAnswersData;  // ✅ Use directly if already an array
  } else if (typeof quizAnswersData === 'string') {
    answers = JSON.parse(quizAnswersData);  // Parse if still a string
  } else {
    answers = [];  // Fallback to empty
  }

  logger.info(`Retrieved ${answers.length} previous answers from context`);
} catch (parseError) {
  logger.warn('Failed to parse quiz_answers, starting fresh:', parseError.message);
  answers = [];
}
```

### Key Change:
✅ **Check type before parsing** - if it's already an array, use it directly
✅ **Only parse if it's a string** - handles both JSONB (object) and TEXT (string) columns

## Database Schema
```sql
Column: quiz_answers
Type: jsonb
Default: '[]'::jsonb
```

When fetched via `pg` driver:
- **Returns**: JavaScript `[]` (empty array) or `[{...}]` (array of objects)
- **NOT**: JSON string `"[]"`

## Testing Results

### Expected Flow (After Fix):
1. **Question 1**:
   - Retrieve: `[]` (array)
   - Add Q1: `[{ Q1 }]`
   - Save: `JSON.stringify([{ Q1 }])` → DB gets `[{ Q1 }]`

2. **Question 2**:
   - Retrieve: `[{ Q1 }]` (array) ✓
   - Add Q2: `[{ Q1 }, { Q2 }]` ✓
   - Save: `JSON.stringify([{ Q1 }, { Q2 }])` → DB gets `[{ Q1 }, { Q2 }]`

3. **Question 3**:
   - Retrieve: `[{ Q1 }, { Q2 }]` (array) ✓
   - Add Q3: `[{ Q1 }, { Q2 }, { Q3 }]` ✓

4. **Question 4**:
   - Retrieve: `[{ Q1 }, { Q2 }, { Q3 }]` (array) ✓
   - Add Q4: `[{ Q1 }, { Q2 }, { Q3 }, { Q4 }]` ✓
   - **Complete quiz**: All 4 answers sent to Moodle! ✓

### Expected Logs:
```
[DEBUG] quiz_answers from DB (type: object): []
Retrieved 0 previous answers from context
Now have 1 total answers (just added Q1)

[DEBUG] quiz_answers from DB (type: object): [{"questionId":139,"userAnswer":"A",...}]
Retrieved 1 previous answers from context
Now have 2 total answers (just added Q2)

[DEBUG] quiz_answers from DB (type: object): [{"questionId":139,...},{"questionId":140,...}]
Retrieved 2 previous answers from context
Now have 3 total answers (just added Q3)

[DEBUG] quiz_answers from DB (type: object): [{"questionId":139,...},{"questionId":140,...},{"questionId":141,...}]
Retrieved 3 previous answers from context
Now have 4 total answers (just added Q4)

Prepared 4 answers for Moodle
Moodle grade: 10.0/10 (or appropriate score)
```

## Related Issues Fixed

### Database Reset:
```sql
UPDATE conversation_context
SET conversation_state = 'idle',
    quiz_answers = '[]'::jsonb,
    current_question_index = 0,
    current_quiz_id = NULL,
    quiz_started_at = NULL,
    context_data = '{}'::jsonb
WHERE user_id = 1;
```

## Status
✅ **FIXED** - PostgreSQL JSONB auto-parsing now handled correctly

## Next Steps
1. ✅ Database cleared
2. ✅ App restarted
3. ⏳ User to test quiz again in WhatsApp
4. ⏳ Verify all 4 answers are saved
5. ⏳ Verify Moodle grade is correct

## Files Modified
- `services/moodle-orchestrator.service.js` (lines 579-597)

---

**Ready for testing!** Type "HI" in WhatsApp to start fresh, then take the quiz.
