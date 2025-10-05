# WhatsApp → Moodle Quiz Sync

Automatically syncs WhatsApp quiz attempts to Moodle LMS with correct answer matching.

## Features

✅ HTML parsing with aria-labelledby support
✅ Multi-page quiz handling (one question per page)
✅ Text-based answer matching (handles randomized options)
✅ Auto-clear blocking in-progress attempts
✅ Retry logic with delays for reliability
✅ User mapping (WhatsApp → Moodle accounts)

## Setup

### 1. Database Migration
```bash
psql -U teachers_user -d teachers_training -f database/migration_002_moodle_integration.sql
```

### 2. Environment Variables
Add to `.env`:
```env
MOODLE_URL=https://your-moodle.com
MOODLE_TOKEN=your_student_token_with_quiz_api_access
MOODLE_SYNC_ENABLED=true
```

### 3. Install Dependencies
```bash
npm install
# jsdom@24.0.0 will be installed (Node 18 compatible)
```

### 4. Map WhatsApp Users to Moodle
```sql
UPDATE users
SET moodle_username = 'student_username',
    moodle_user_id = 123
WHERE whatsapp_id = '+1234567890';
```

## How It Works

1. User completes quiz in WhatsApp (answers A, B, C, D)
2. System converts letters to answer text (e.g., A → "Facilitator of Learning")
3. Starts Moodle quiz attempt via API
4. Fetches all quiz pages (handles one-question-per-page layout)
5. Parses HTML to find option values for each answer
6. Matches answers by text (handles Moodle's randomized option order)
7. Submits all answers to Moodle
8. Retrieves grade and stores attempt ID
9. User sees results in both WhatsApp and Moodle

## Key Files

- `services/moodle-sync.service.js` - Main sync service
- `services/whatsapp-handler.service.js` - Calls sync after quiz completion
- `database/migration_002_moodle_integration.sql` - DB schema
- `package.json` - Dependencies (jsdom)

## Testing

```bash
# Watch logs
docker logs -f teachers_training-app-1 | grep "Moodle"

# Start quiz in WhatsApp
# Send "quiz" to mapped WhatsApp number

# Verify in Moodle
# https://your-moodle.com/mod/quiz/view.php?id=XX
```

## Troubleshooting

**Issue**: Attempt shows "in progress" with blank answers
**Solution**: Clear blocking attempts - the next attempt will work correctly

**Issue**: "Can't find data record" error
**Solution**: Retry logic handles this automatically (up to 3 retries)

**Issue**: Grade not retrieved
**Solution**: Grade retrieval has fallback - sync still succeeds

## Technical Details

- Uses `mod_quiz_*` web service functions
- Parses HTML with jsdom for option extraction
- Matches by normalized text (lowercase, collapsed whitespace)
- Delays between API calls prevent race conditions
- Stores Moodle attempt ID in quiz_attempts.metadata
