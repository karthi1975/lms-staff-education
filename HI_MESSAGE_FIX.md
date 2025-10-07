# Fix: "HI" Message Not Triggering Course Selection

## Issue
When a user sends "HI" while in the learning state (after selecting a module), the bot was responding with a RAG-generated answer instead of showing the course selection menu.

## Root Cause
The greeting check in `moodle-orchestrator.service.js` line 102 was supposed to catch "HI" messages in ANY state, but the message was still falling through to the state handlers (`handleLearningState`, `handleQuizState`) which didn't have their own greeting checks.

## Solution
Added **defense-in-depth** greeting checks in each state handler to ensure "HI" always triggers course selection, regardless of current state.

### Changes Made

#### 1. Added Greeting Check in Learning State
**File**: `services/moodle-orchestrator.service.js`
**Lines**: 290-299

```javascript
async handleLearningState(userId, message, context) {
  const lowerMsg = message.toLowerCase().trim();

  // Check for greeting/restart (should be caught earlier, but double-check)
  if (lowerMsg.match(/^(hi|hello|hey|start|teach me|begin|restart)$/)) {
    logger.info(`Greeting detected in learning state from user ${userId}, resetting to course selection`);
    await this.updateConversationState(userId, {
      conversation_state: 'course_selection',
      current_course_id: null,
      current_module_id: null
    });
    return this.showCourseSelection();
  }

  // ... rest of learning state logic
}
```

#### 2. Added Greeting Check in Quiz State
**File**: `services/moodle-orchestrator.service.js`
**Lines**: 513-524

```javascript
async handleQuizState(userId, message, context) {
  const lowerMsg = message.toLowerCase().trim();

  // Check for greeting/restart - allow user to exit quiz
  if (lowerMsg.match(/^(hi|hello|hey|start|teach me|begin|restart|menu)$/)) {
    logger.info(`Greeting/menu detected during quiz from user ${userId}, resetting to course selection`);
    await this.updateConversationState(userId, {
      conversation_state: 'course_selection',
      current_course_id: null,
      current_module_id: null,
      current_question_index: null,
      quiz_answers: null
    });
    return this.showCourseSelection();
  }

  // ... rest of quiz state logic
}
```

#### 3. Improved Error Message for Invalid Quiz Answers
**File**: `services/moodle-orchestrator.service.js`
**Line**: 540

```javascript
if (!answer.match(/^[A-D]$/)) {
  return {
    text: "Please reply with A, B, C, or D only, or type 'menu' to exit the quiz."
  };
}
```

## Testing

### Before Fix
```
User: [Selects module "Entrepreneurship & Business Ideas"]
Bot: "Ask me any questions about the topic!"
User: "HI"
Bot: "It seems like you started to ask a question, but it got cut off..." ❌
```

### After Fix
```
User: [Selects module "Entrepreneurship & Business Ideas"]
Bot: "Ask me any questions about the topic!"
User: "HI"
Bot: [Shows course selection list] ✅
```

### Test Cases Verified

1. ✅ **HI in Idle State** → Course selection
2. ✅ **HI in Course Selection** → Course selection (already there)
3. ✅ **HI in Module Selection** → Course selection
4. ✅ **HI in Learning State** → Course selection (FIXED)
5. ✅ **HI in Quiz State** → Course selection (FIXED)
6. ✅ **"hello" / "hey" / "start"** → All work the same way
7. ✅ **"menu" during quiz** → Exit quiz, show course selection

## Additional Keywords Supported

The following keywords will now trigger the course selection menu from ANY state:

- `hi`
- `hello`
- `hey`
- `start`
- `teach me`
- `begin`
- `restart`
- `menu` (quiz state only)

All keywords are **case-insensitive** (HI, Hi, hi all work).

## Deployment

1. Changes deployed to Docker container
2. Server restarted successfully
3. Verified course loading: "✅ Loaded 1 courses from database"
4. No breaking changes - all existing flows preserved

## Files Modified

1. `services/moodle-orchestrator.service.js`
   - Added greeting check in `handleLearningState()` (lines 290-299)
   - Added greeting check in `handleQuizState()` (lines 513-524)
   - Improved error message for invalid quiz answers (line 540)

## Result

**"HI" message now correctly triggers course selection in ALL states!** 🎉

Users can now easily restart the flow or return to the main menu at any time by typing "HI", "hello", or "menu".
