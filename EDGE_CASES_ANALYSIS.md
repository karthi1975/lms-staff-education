# Edge Cases Analysis - Enrollment & Progress Tracking System

## Critical Edge Cases Discovered

### 🔴 CRITICAL: No Modules Exist When User Enrolls

**Location:** `services/enrollment.service.js:108-118`

**Issue:**
```javascript
const firstModuleResult = await postgresService.query(
  `SELECT m.id FROM modules m
   JOIN courses c ON m.course_id = c.id
   ORDER BY c.sequence_order, m.sequence_order
   LIMIT 1`
);

const firstModuleId = firstModuleResult.rows.length > 0
  ? firstModuleResult.rows[0].id
  : null;  // ⚠️ CAN BE NULL
```

**Impact:**
- User enrolled with `current_module_id = NULL`
- PIN verification succeeds (lines 289-296 check for NULL)
- But course orchestrator CRASHES when user tries to chat

**Crash Point:** `services/course-orchestrator.service.js:416`
```javascript
const moduleId = parseInt(context.current_module_id, 10);  // NaN if NULL
```

**Reproduction:**
1. Delete all courses/modules from database
2. Enroll new user via admin portal
3. User verifies PIN successfully
4. User sends any message to WhatsApp bot
5. **CRASH**: `NaN` passed to RAG queries

**Solution Needed:**
- Prevent enrollment if no modules exist
- OR show "No courses available" message in chat instead of crashing

---

### 🔴 CRITICAL: Module Deleted While User Has Progress

**Location:** Multiple locations

**Issue:**
User has `current_module_id = 5`, but module ID 5 is deleted by admin.

**Impact Chain:**
1. User messages WhatsApp bot
2. `getOrCreateSession` succeeds (line 252): `currentModule: user.current_module_id` (= 5, deleted)
3. Course orchestrator tries to query deleted module
4. RAG service tries to retrieve content for non-existent module
5. **No content found, user gets empty or error responses**

**Crash Points:**
- `course-orchestrator.service.js:416` - parseInt of deleted module ID
- `course-orchestrator.service.js:569` - Quiz lookup for deleted module
- `course-orchestrator.service.js:636` - Progress update for deleted module

**Reproduction:**
1. User enrolled and starts Module 1
2. Admin deletes Module 1 from courses.html
3. User sends message to WhatsApp bot
4. User gets no responses or errors

**Solution Needed:**
- Check if `current_module_id` references existing module
- Reset user to first available module if current module deleted
- Show friendly message: "Your module was updated. Starting from Module 1..."

---

### 🟡 HIGH: User Deleted and Re-Enrolled with Same Phone Number

**Location:** `services/whatsapp-handler.service.js:218-244`

**Issue:**
User session cache uses phone number as key, but user_id changes when deleted and re-enrolled.

**Current Handling:**
```javascript
if (this.userSessions.has(normalizedPhone)) {
  const cachedSession = this.userSessions.get(normalizedPhone);
  if (cachedSession.userId === user.id) {
    // ✅ GOOD: Return cached session
  } else {
    // ✅ GOOD: Invalidate old session
    logger.info(`User ${normalizedPhone} re-registered with new ID`);
    this.userSessions.delete(normalizedPhone);
  }
}
```

**Status:** ✅ **HANDLED CORRECTLY**

**Edge Case Within Edge Case:**
User deleted DURING active session (race condition).

**Scenario:**
1. User chatting with bot (session exists)
2. Admin deletes user from portal
3. User sends next message
4. `getOrCreateSession` called
5. Database query returns 0 rows (user deleted)
6. **CRASH**: "User not enrolled" error thrown

**Solution Needed:**
- Graceful handling when user deleted mid-session
- Send message: "Your account was deactivated. Contact administrator."

---

### 🟡 HIGH: PIN Expires During Verification Attempt

**Location:** `services/enrollment.service.js:224-231`

**Issue:**
PIN expires at exactly 7 days. User tries to verify at 7 days + 1 second.

**Current Handling:**
```javascript
// Check if PIN expired
if (user.pin_expires_at && new Date() > new Date(user.pin_expires_at)) {
  await this.recordHistory(user.id, 'pin_expired', null, { pin_expires_at: user.pin_expires_at });
  return {
    verified: false,
    message: '⏰ Your PIN has expired.\n\nPlease contact your administrator for a new PIN.'
  };
}
```

**Status:** ✅ **HANDLED CORRECTLY**

**Edge Case Within Edge Case:**
Admin resets PIN while user typing old PIN.

**Race Condition:**
1. User has PIN "1234" (expires in 1 minute)
2. Admin resets PIN to "5678" (new expiry: 7 days)
3. User sends "1234" (old PIN)
4. Old PIN is overwritten, so verification fails
5. User gets "Incorrect PIN" message
6. **Confusion:** User thinks they mistyped, wastes attempts

**Solution Needed:**
- Check if PIN was recently reset
- Show specific message: "Your PIN was reset. Check your new PIN."

---

### 🟡 HIGH: RAG Query with NULL session_id or user_id

**Location:** `routes/enhanced-rag.routes.js:31-50`

**Issue:**
RAG endpoint tries to create session for WhatsApp user, but enrollment check not enforced.

**Code:**
```javascript
if (!sessionId && req.body.whatsapp_id) {
  // WhatsApp user
  const session = await SessionService.getOrCreateSession(req.body.whatsapp_id);
  sessionId = session.session_id;
  userId = session.user_id;
}

if (!sessionId || !userId) {
  return res.status(400).json({
    success: false,
    error: 'Session or user identification required'
  });
}
```

**Problem:**
- `SessionService.getOrCreateSession` may AUTO-CREATE users (bypassing enrollment)
- Unenrolled users could potentially access RAG if session service doesn't validate

**Check Needed:**
Let me verify if SessionService validates enrollment.

---

### 🟡 HIGH: Concurrent Enrollment of Same Phone Number

**Location:** `services/enrollment.service.js:70-88`

**Issue:**
Two admins enroll same phone number simultaneously.

**Race Condition:**
```
Admin 1 checks: User exists? → No
Admin 2 checks: User exists? → No
Admin 1 inserts: INSERT INTO users (whatsapp_id = '+1234567890')
Admin 2 inserts: INSERT INTO users (whatsapp_id = '+1234567890')
Result: DATABASE ERROR - Unique constraint violation
```

**Current Handling:**
```javascript
// Check if user already exists
const existingUser = await postgresService.query(
  'SELECT id, name, enrollment_status FROM users WHERE whatsapp_id = $1',
  [normalizedPhone]
);

if (existingUser.rows.length > 0) {
  return {
    success: false,
    message: `User "${user.name}" already exists with status: ${user.enrollment_status}`
  };
}
// Insert (can fail if race condition)
```

**Solution Needed:**
- Use `ON CONFLICT` clause
- OR catch unique constraint error and return existing user
- OR use database transaction with advisory locks

---

### 🟡 HIGH: Progress Initialization Fails Silently

**Location:** `services/enrollment.service.js:283-296`

**Issue:**
Progress initialization uses `ON CONFLICT DO NOTHING`, which silently fails if constraint violated.

**Code:**
```javascript
if (moduleCheck.rows[0].current_module_id) {
  await postgresService.query(
    `INSERT INTO user_progress (user_id, module_id, status, progress_percentage, started_at, last_activity_at)
     VALUES ($1, $2, 'not_started', 0, NOW(), NOW())
     ON CONFLICT (user_id, module_id) DO NOTHING`,  // ⚠️ SILENT FAILURE
    [user.id, moduleCheck.rows[0].current_module_id]
  );
}
```

**Problem:**
- If progress record already exists (shouldn't happen), it's not updated
- No error thrown, no logging
- User appears enrolled but may have stale progress data

**Solution Needed:**
- Use `ON CONFLICT UPDATE` to refresh timestamps
- OR check RETURNING clause to log if record existed
- Add logging for debugging

---

### 🟡 MEDIUM: Phone Number Format Variations

**Location:** `services/enrollment.service.js:52-58`

**Issue:**
Phone number normalization may create duplicates.

**Examples:**
- "+1 555 1234567" → "+15551234567"
- "1-555-123-4567" → "+15551234567"
- "+1 (555) 123-4567" → "+15551234567"
- "15551234567" → "+15551234567"

**Current Normalization:**
```javascript
normalizePhoneNumber(phoneNumber) {
  let normalized = phoneNumber.replace(/[\s\(\)\-]/g, '');  // Remove spaces, (), -
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }
  return normalized;
}
```

**Edge Cases:**
1. User enrolled as "+1 555 1234567"
2. Admin searches "+15551234567" (no spaces)
3. **NOT FOUND** (different format in DB)

**Solution Needed:**
- Always store normalized format in database
- Normalize before every query
- Validate phone number format (E.164 standard)

---

### 🟡 MEDIUM: User Progress Record Missing

**Location:** `routes/admin.routes.js:247-277`

**Issue:**
Admin tries to view user progress, but no progress records exist.

**Scenario:**
1. User enrolled before modules existed (current_module_id = NULL)
2. No progress records created
3. Admin clicks user in portal
4. **Empty progress modal** (no error, but confusing)

**Current Handling:**
```javascript
if (result.rows.length === 0) {
  // No check for empty progress
}
```

**Solution Needed:**
- Show friendly message: "No modules started yet"
- OR auto-initialize progress when admin views
- Check if modules exist and suggest assigning user to course

---

### 🟡 MEDIUM: Session Cache Memory Leak

**Location:** `services/whatsapp-handler.service.js:16-18`

**Issue:**
```javascript
constructor() {
  // User session state: phoneNumber -> { userId, currentModule, quizState, ... }
  this.userSessions = new Map();  // ⚠️ NEVER CLEANED
}
```

**Problem:**
- Sessions stored in memory indefinitely
- Inactive users never removed
- Memory grows unbounded over time
- Server restart = all sessions lost

**Edge Case:**
1. 10,000 users enrolled
2. All message bot once
3. 10,000 sessions cached in memory
4. Only 100 active daily
5. **9,900 stale sessions consume memory**

**Solution Needed:**
- Implement session TTL (24 hour timeout)
- Periodic cleanup of inactive sessions
- OR use Redis for distributed session storage
- Add max session limit

---

### 🟡 MEDIUM: Multiple Admins Reset Same User's PIN

**Location:** `services/enrollment.service.js:330-391`

**Issue:**
Two admins reset same user's PIN simultaneously.

**Race Condition:**
```
Admin 1: Generates PIN "1234", hashes it
Admin 2: Generates PIN "5678", hashes it
Admin 1: Updates DB with PIN "1234" hash
Admin 2: Updates DB with PIN "5678" hash
Admin 1 shares "1234" with user
User tries "1234" → FAILS (DB has "5678" hash)
```

**Current Handling:**
- No transaction isolation
- Last write wins
- No conflict detection

**Solution Needed:**
- Show recent PIN resets in admin portal
- Lock user during PIN reset
- OR show warning if PIN reset in last 5 minutes

---

### 🟢 LOW: User Sends PIN in Wrong Format

**Location:** `services/enrollment.service.js:180-184`

**Issue:**
User sends PIN with spaces, dashes, or extra characters.

**Examples:**
- "12 34" (space)
- "12-34" (dash)
- "pin: 1234" (text prefix)
- "1234 " (trailing space)

**Current Validation:**
```javascript
if (!/^\d{4}$/.test(pin)) {  // ✅ STRICT: Exactly 4 digits
  return {
    verified: false,
    message: '❌ Invalid PIN format. Please send a 4-digit PIN.'
  };
}
```

**Status:** ✅ **HANDLED CORRECTLY**

**Enhancement Suggestion:**
- Auto-trim whitespace: `pin.trim()`
- Extract digits: `pin.replace(/\D/g, '')` then validate
- More helpful message: "Please send ONLY 4 digits (e.g., 1234)"

---

### 🟢 LOW: Admin Views Deleted User's Progress

**Location:** `routes/admin.routes.js:247-277`

**Issue:**
Admin has user page open, deletes user, then tries to refresh progress.

**Current Handling:**
```javascript
const result = await postgresService.pool.query(`...`, [parseInt(userId)]);
// If user deleted, result.rows is empty
```

**Impact:**
- No crash (graceful empty array)
- No error message shown to admin
- Confusing UX (looks like user has no progress vs. deleted)

**Solution Needed:**
- Check if user exists before querying progress
- Return 404 error: "User not found (may have been deleted)"
- Admin portal shows error modal

---

### 🟢 LOW: Enrollment History Not Recorded on Error

**Location:** `services/enrollment.service.js:527-538`

**Issue:**
```javascript
async recordHistory(userId, action, performedBy = null, metadata = {}) {
  try {
    await postgresService.query(/*...*/);
  } catch (error) {
    logger.error('Error recording enrollment history:', error);
    // Don't throw - history logging shouldn't break main flow
  }
}
```

**Problem:**
- If history insert fails, error is logged but ignored
- No notification to admin
- Audit trail incomplete (compliance issue for some orgs)

**Solution Needed:**
- Track failed history writes in separate error log
- Alert admin if critical actions (enrollment, unblock) fail to log
- OR use database triggers for audit trail (guaranteed logging)

---

## Edge Cases by Category

### Database Integrity
1. ✅ **User deleted mid-session** → Needs graceful handling
2. ✅ **Module deleted while user has progress** → Reset to first module
3. ✅ **No modules exist when enrolling** → Prevent enrollment or show message
4. ✅ **Concurrent enrollment** → Use ON CONFLICT or transactions
5. ⚠️ **Progress initialization silent failure** → Add logging/validation

### Session Management
1. ✅ **Session cache never cleaned** → Add TTL and cleanup
2. ✅ **User re-enrolled same phone** → Already handled correctly
3. ⚠️ **Session service bypasses enrollment** → Needs verification

### PIN & Security
1. ✅ **PIN expires during verification** → Already handled correctly
2. ✅ **Multiple admins reset PIN** → Add coordination
3. ✅ **PIN format variations** → Already handled correctly
4. ⚠️ **PIN reset race condition** → Show recent reset warning

### Data Consistency
1. ✅ **Phone number format variations** → Already normalized
2. ⚠️ **current_module_id is NULL** → Crashes in course orchestrator
3. ⚠️ **Progress record missing** → Show friendly message
4. ⚠️ **Enrollment history fails silently** → Add alerting

### User Experience
1. ✅ **Deleted user viewed in portal** → Show 404 message
2. ✅ **Empty progress shown** → Clarify "no modules started"
3. ✅ **Confused about PIN reset** → Better messaging

---

## Recommendations by Priority

### 🔴 CRITICAL (Fix Immediately)

1. **Fix NULL module crash** (`course-orchestrator.service.js:416`)
   ```javascript
   // Before:
   const moduleId = parseInt(context.current_module_id, 10);  // NaN if NULL

   // After:
   if (!context.current_module_id) {
     return {
       type: 'text',
       text: '⚠️ No courses are available yet. Please contact your administrator.'
     };
   }
   const moduleId = parseInt(context.current_module_id, 10);
   ```

2. **Prevent enrollment when no modules exist**
   ```javascript
   // In enrollment.service.js:108
   if (firstModuleResult.rows.length === 0) {
     return {
       success: false,
       message: 'Cannot enroll user: No courses/modules available. Please create courses first.'
     };
   }
   ```

3. **Handle deleted module gracefully**
   ```javascript
   // In course-orchestrator.service.js before using moduleId
   const moduleExists = await this.checkModuleExists(moduleId);
   if (!moduleExists) {
     // Reset user to first available module
     await this.resetUserToFirstModule(userId);
     return {
       type: 'text',
       text: '⚠️ Your module was updated. Starting from Module 1...'
     };
   }
   ```

### 🟡 HIGH (Fix Soon)

4. **Handle user deleted mid-session**
   ```javascript
   // In whatsapp-handler.service.js:225-229
   if (result.rows.length === 0) {
     await whatsappService.sendMessage(phoneNumber,
       '⚠️ Your account was deactivated. Please contact your administrator.'
     );
     return null;  // Graceful exit
   }
   ```

5. **Add session cleanup** (memory leak prevention)
   ```javascript
   // Add to whatsapp-handler.service.js
   setInterval(() => {
     const now = Date.now();
     for (const [phone, session] of this.userSessions.entries()) {
       if (now - session.lastActivity > 24 * 60 * 60 * 1000) {  // 24 hours
         this.userSessions.delete(phone);
       }
     }
   }, 60 * 60 * 1000);  // Clean every hour
   ```

6. **Fix concurrent enrollment race condition**
   ```javascript
   // In enrollment.service.js:121
   const result = await postgresService.query(
     `INSERT INTO users (...)
      VALUES (...)
      ON CONFLICT (whatsapp_id) DO UPDATE
        SET updated_at = NOW()
      RETURNING id, whatsapp_id, name, enrollment_status`,
     [...]
   );
   ```

### 🟢 MEDIUM (Nice to Have)

7. **Add progress initialization logging**
8. **Validate phone numbers (E.164 format)**
9. **Show PIN reset warnings in admin portal**
10. **Add 404 handling for deleted users**

---

## Testing Recommendations

### Unit Tests Needed
```javascript
describe('Enrollment Edge Cases', () => {
  test('Should reject enrollment when no modules exist', async () => {
    // Delete all modules
    // Try to enroll user
    // Expect: Error message
  });

  test('Should handle user deletion mid-session', async () => {
    // Create user and session
    // Delete user
    // Send message
    // Expect: Graceful error message
  });

  test('Should reset user when module deleted', async () => {
    // Enroll user in Module 5
    // Delete Module 5
    // User sends message
    // Expect: Reset to Module 1
  });
});
```

### Integration Tests Needed
```bash
# Test enrollment with no modules
./test-enrollment-no-modules.sh

# Test concurrent enrollment
./test-concurrent-enrollment.sh

# Test module deletion during progress
./test-module-deletion.sh

# Test session cleanup
./test-session-memory-leak.sh
```

---

## Monitoring Recommendations

### Metrics to Track
1. **Session cache size** → Alert if > 10,000
2. **NULL current_module_id count** → Alert if > 0
3. **Failed enrollment history writes** → Alert immediately
4. **Users with deleted modules** → Daily report
5. **Orphaned sessions** → Weekly cleanup report

### Alerts to Set Up
```sql
-- Alert: Users with NULL current_module_id
SELECT COUNT(*) FROM users
WHERE enrollment_status = 'active' AND current_module_id IS NULL;

-- Alert: Users with deleted modules
SELECT u.id, u.name, u.current_module_id
FROM users u
LEFT JOIN modules m ON u.current_module_id = m.id
WHERE u.current_module_id IS NOT NULL AND m.id IS NULL;

-- Alert: Stale PIN attempts
SELECT COUNT(*) FROM users
WHERE enrollment_status = 'pending'
AND pin_expires_at < NOW() - INTERVAL '30 days';
```

---

*Generated: 2025-10-22*
*Priority: Review and address CRITICAL issues before production deployment*
