# Edge Case Fixes - Implementation Guide

## Summary of Edge Cases Found

### Test Results (from `./test-edge-cases.sh`)

1. ✅ **PASS**: Concurrent enrollment handled correctly
2. ✅ **PASS**: Phone number normalization works correctly
3. 🐛 **BUG**: User with deleted module will crash (1 user affected)
4. ⚠️ **WARNING**: Deleted user returns empty progress (should be 404)
5. ℹ️ **SKIP**: Cannot test NULL module enrollment (modules exist)

## Critical Fixes Required

### Fix 1: Prevent NULL Module Crash (CRITICAL)

**Location**: `services/course-orchestrator.service.js:416`

**Problem**: `parseInt(context.current_module_id, 10)` returns `NaN` when `current_module_id` is NULL

**Fix**:
```javascript
// Line ~410 in course-orchestrator.service.js
// BEFORE:
const contextData = this.parseContextData(context);
const moduleName = contextData.module_name || 'Entrepreneurship & Business Ideas';
const moduleId = parseInt(context.current_module_id, 10);

// AFTER:
const contextData = this.parseContextData(context);

// Check if user has a module assigned
if (!context.current_module_id) {
  logger.warn(`User ${userId} has no module assigned`);
  return {
    type: 'text',
    text: '⚠️ No courses are currently available.\n\n' +
          'Please contact your administrator to be assigned to a course.\n\n' +
          'Type "help" for more information.'
  };
}

const moduleName = contextData.module_name || 'Entrepreneurship & Business Ideas';
const moduleId = parseInt(context.current_module_id, 10);

// Additional safety check
if (isNaN(moduleId)) {
  logger.error(`Invalid module ID for user ${userId}: ${context.current_module_id}`);
  return {
    type: 'text',
    text: '⚠️ System error: Invalid module assignment.\n\n' +
          'Please contact your administrator.'
  };
}
```

**Also fix at**: Lines 569, 636, 854 (all use `context.current_module_id`)

---

### Fix 2: Prevent Enrollment When No Modules Exist (CRITICAL)

**Location**: `services/enrollment.service.js:108-118`

**Problem**: User enrolled with `current_module_id = NULL` when no modules exist

**Fix**:
```javascript
// BEFORE:
const firstModuleId = firstModuleResult.rows.length > 0
  ? firstModuleResult.rows[0].id
  : null;

// AFTER:
if (firstModuleResult.rows.length === 0) {
  // No modules exist - cannot enroll user
  logger.error('Enrollment attempted with no modules available');
  return {
    success: false,
    message: 'Cannot enroll user: No courses or modules are currently available.\n\n' +
             'Please create at least one course with modules before enrolling users.'
  };
}

const firstModuleId = firstModuleResult.rows[0].id;
```

---

### Fix 3: Validate Module Exists Before Using (CRITICAL)

**Location**: `services/course-orchestrator.service.js` (add new method)

**Problem**: User assigned to deleted module causes crashes

**Fix**: Add validation method
```javascript
/**
 * Check if module exists and is active
 * @param {number} moduleId - Module ID to check
 * @returns {Promise<boolean>}
 */
async checkModuleExists(moduleId) {
  try {
    const result = await postgresService.query(
      'SELECT id FROM modules WHERE id = $1 AND is_active = true',
      [moduleId]
    );
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error checking module existence:', error);
    return false;
  }
}

/**
 * Reset user to first available module
 * @param {number} userId - User ID
 * @returns {Promise<number|null>} New module ID or null
 */
async resetUserToFirstModule(userId) {
  try {
    // Get first available module
    const moduleResult = await postgresService.query(`
      SELECT m.id FROM modules m
      JOIN courses c ON m.course_id = c.id
      WHERE m.is_active = true AND c.is_active = true
      ORDER BY c.sequence_order, m.sequence_order
      LIMIT 1
    `);

    if (moduleResult.rows.length === 0) {
      logger.error('No modules available to assign');
      return null;
    }

    const newModuleId = moduleResult.rows[0].id;

    // Update user
    await postgresService.query(
      'UPDATE users SET current_module_id = $1, updated_at = NOW() WHERE id = $2',
      [newModuleId, userId]
    );

    // Initialize progress
    await postgresService.query(
      `INSERT INTO user_progress (user_id, module_id, status, progress_percentage, started_at, last_activity_at)
       VALUES ($1, $2, 'not_started', 0, NOW(), NOW())
       ON CONFLICT (user_id, module_id) DO UPDATE
       SET last_activity_at = NOW()`,
      [userId, newModuleId]
    );

    logger.info(`Reset user ${userId} to module ${newModuleId}`);
    return newModuleId;

  } catch (error) {
    logger.error('Error resetting user module:', error);
    return null;
  }
}
```

**Use it in processQuery**:
```javascript
// Before using moduleId (around line 416)
if (!context.current_module_id) {
  // Handle null module (Fix 1)
}

const moduleId = parseInt(context.current_module_id, 10);

// NEW: Check if module exists
const moduleExists = await this.checkModuleExists(moduleId);
if (!moduleExists) {
  logger.warn(`User ${userId} assigned to deleted module ${moduleId}`);

  // Try to reset to first available module
  const newModuleId = await this.resetUserToFirstModule(userId);

  if (newModuleId) {
    return {
      type: 'text',
      text: '⚠️ Your assigned module was updated.\n\n' +
            'Starting from the first available module...\n\n' +
            'Type "help" to see available commands.'
    };
  } else {
    return {
      type: 'text',
      text: '⚠️ No courses are currently available.\n\n' +
            'Please contact your administrator.'
    };
  }
}
```

---

### Fix 4: Session Cache Cleanup (HIGH PRIORITY)

**Location**: `services/whatsapp-handler.service.js:16-18`

**Problem**: Memory leak from never-cleaned sessions

**Fix**:
```javascript
constructor() {
  // User session state: phoneNumber -> { userId, currentModule, quizState, ... }
  this.userSessions = new Map();

  // NEW: Start session cleanup timer
  this.startSessionCleanup();
}

/**
 * Clean up inactive sessions (prevent memory leak)
 */
startSessionCleanup() {
  const CLEANUP_INTERVAL = 60 * 60 * 1000;  // 1 hour
  const SESSION_TTL = 24 * 60 * 60 * 1000;  // 24 hours

  setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [phone, session] of this.userSessions.entries()) {
      const inactiveDuration = now - session.lastActivity.getTime();

      if (inactiveDuration > SESSION_TTL) {
        this.userSessions.delete(phone);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} inactive session(s). Active: ${this.userSessions.size}`);
    }
  }, CLEANUP_INTERVAL);
}
```

---

### Fix 5: Graceful User Deletion Handling (MEDIUM)

**Location**: `services/whatsapp-handler.service.js:225-229`

**Problem**: User deleted mid-session throws confusing error

**Fix**:
```javascript
// BEFORE:
if (result.rows.length === 0) {
  logger.error(`Session requested for unenrolled user: ${normalizedPhone}`);
  throw new Error('User not enrolled. This should have been caught by enrollment check.');
}

// AFTER:
if (result.rows.length === 0) {
  logger.warn(`Session requested for deleted/unenrolled user: ${normalizedPhone}`);

  // Send friendly message instead of throwing error
  await whatsappService.sendMessage(normalizedPhone,
    '⚠️ Your account is not active.\n\n' +
    'Possible reasons:\n' +
    '• Account was deactivated by administrator\n' +
    '• You are not enrolled in the system\n\n' +
    'Please contact your administrator for assistance.'
  );

  return null;  // Return null instead of throwing
}
```

---

### Fix 6: Return 404 for Deleted Users (MEDIUM)

**Location**: `routes/admin.routes.js:247-277`

**Problem**: Deleted user returns empty progress, not 404

**Fix**:
```javascript
router.get('/user-progress/:userId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const postgresService = require('../services/database/postgres.service');

    // NEW: Check if user exists first
    const userExists = await postgresService.pool.query(
      'SELECT id FROM users WHERE id = $1',
      [parseInt(userId)]
    );

    if (userExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found. User may have been deleted.'
      });
    }

    // Continue with original query...
    const result = await postgresService.pool.query(`...`);

    res.json({
      success: true,
      modules: result.rows
    });
  } catch (error) {
    logger.error(`Error fetching user progress for ${req.params.userId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

### Fix 7: Prevent Module Deletion with Active Users (MEDIUM)

**Location**: `routes/admin.routes.js:1219-1334` (DELETE /courses/:courseId)

**Problem**: No validation before deleting modules with active users

**Fix**: Add to DELETE endpoint
```javascript
router.delete('/courses/:courseId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;

    // NEW: Check if any users are assigned to modules in this course
    const activeUsersCheck = await postgresService.pool.query(`
      SELECT COUNT(DISTINCT u.id) as user_count
      FROM users u
      JOIN modules m ON u.current_module_id = m.id
      WHERE m.course_id = $1
    `, [courseId]);

    const activeUserCount = parseInt(activeUsersCheck.rows[0].user_count);

    if (activeUserCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete course: ${activeUserCount} user(s) are currently assigned to modules in this course.\n\n` +
               `Please reassign these users to different modules before deleting the course.`,
        active_users: activeUserCount
      });
    }

    // Continue with deletion...
  } catch (error) {
    logger.error('Error deleting course:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

## Implementation Priority

### Phase 1: Critical Fixes (Deploy Immediately)
1. ✅ Fix 1: Prevent NULL module crash
2. ✅ Fix 2: Prevent enrollment with no modules
3. ✅ Fix 3: Validate module existence

### Phase 2: High Priority (Deploy This Week)
4. ✅ Fix 4: Session cache cleanup
5. ✅ Fix 5: Graceful user deletion

### Phase 3: Medium Priority (Deploy Next Week)
6. ✅ Fix 6: Return 404 for deleted users
7. ✅ Fix 7: Prevent module deletion with active users

---

## Testing After Fixes

### Test 1: NULL Module Crash
```bash
# Manually set user's module to NULL
psql -d teachers_training -c "UPDATE users SET current_module_id = NULL WHERE id = 1"

# Message WhatsApp bot
# Expected: Friendly error message (not crash)
```

### Test 2: Deleted Module
```bash
# Assign user to module 5
# Delete module 5
# User messages bot
# Expected: Auto-reset to Module 1 with friendly message
```

### Test 3: No Modules Enrollment
```bash
# Delete all courses/modules
./test-enrollment-flow.sh
# Expected: Enrollment rejected with clear error message
```

### Test 4: Session Cleanup
```bash
# Wait 25 hours
# Check logs for cleanup message
# Expected: "Cleaned up X inactive session(s)"
```

### Test 5: User Deleted Mid-Session
```bash
# User messaging bot
# Admin deletes user
# User sends next message
# Expected: Friendly "account deactivated" message (not crash)
```

---

## Monitoring Recommendations

### Add These Metrics

```javascript
// In course-orchestrator.service.js
metrics: {
  null_module_attempts: 0,
  deleted_module_attempts: 0,
  module_resets: 0
}

// Log and track
if (!context.current_module_id) {
  this.metrics.null_module_attempts++;
  logger.warn(`NULL module attempt - Total: ${this.metrics.null_module_attempts}`);
}

if (!moduleExists) {
  this.metrics.deleted_module_attempts++;
  logger.warn(`Deleted module attempt - Total: ${this.metrics.deleted_module_attempts}`);
}

if (newModuleId) {
  this.metrics.module_resets++;
  logger.info(`Module reset - Total: ${this.metrics.module_resets}`);
}
```

### Alert Thresholds
- NULL module attempts > 0: Alert admin
- Deleted module attempts > 5/day: Investigate
- Module resets > 10/day: Check module management practices
- Session cache size > 10,000: Possible memory issue

---

## Files Modified

1. `services/course-orchestrator.service.js`
   - Add NULL module check
   - Add deleted module validation
   - Add checkModuleExists() method
   - Add resetUserToFirstModule() method

2. `services/enrollment.service.js`
   - Prevent enrollment when no modules exist

3. `services/whatsapp-handler.service.js`
   - Add session cleanup
   - Graceful user deletion handling

4. `routes/admin.routes.js`
   - Return 404 for deleted users
   - Prevent module deletion with active users

---

## Rollback Plan

If issues occur after deployment:

1. **Git revert** to previous version
2. **Database**: No schema changes, safe to rollback
3. **Session cache**: Restart will clear (no persistence)

**Command**:
```bash
git log --oneline | head -5  # Find commit before edge case fixes
git revert <commit-hash>
docker-compose restart app
```

---

*Generated: 2025-10-22*
*Priority: Phase 1 fixes MUST be deployed before production use*
