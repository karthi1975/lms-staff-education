# Chat & Quiz Fixes Summary

## Date: 2025-10-06

## Issues Fixed

### 1. ✅ Quiz Not Starting - Method Name Conflict
**Problem**: When users typed "quiz please", the bot sent "Quiz Started!" but then crashed with:
```
Cannot destructure property 'questions' of 'session.quizState' as it is undefined
```

**Root Cause**: There were TWO methods named `sendQuizQuestion` with different signatures in `whatsapp-handler.service.js`:
- Line 109: `sendQuizQuestion(to, questionData)` - NEW (for moodle-orchestrator)
- Line 424: `sendQuizQuestion(from, session)` - OLD (for legacy quiz service)

When the quiz_intro response was sent, it called the new method (line 80), which worked fine. But legacy code at lines 413 and 458 called the old method without a valid session.quizState, causing the crash.

**Fix**: Renamed the old method to `sendQuizQuestionLegacy()` and updated all references:
```javascript
// whatsapp-handler.service.js:424
async sendQuizQuestionLegacy(from, session) {
  if (!session.quizState) {
    logger.warn('sendQuizQuestionLegacy called but session.quizState is undefined');
    return;
  }
  // ... rest of legacy logic
}
```

**Files Modified**:
- `services/whatsapp-handler.service.js` (lines 413, 424, 463)

---

### 2. ✅ RAG Responses Showing Chunk Labels Instead of Content
**Problem**: When users asked questions like "What is entrepreneurship?", the bot responded with:
```
"entrepreneurship_chunk_0", "entrepreneurship_chunk_2", "entrepreneurship_chunk_3"
without any actual content.
```

**Root Cause**: During initial data ingestion into ChromaDB, the content and metadata were swapped:
- **Content field**: Stored chunk labels (e.g., "entrepreneurship_chunk_0")
- **Metadata field**: Stored actual text character-by-character (e.g., {0: 'E', 1: 'n', 2: 't', ...})

**Fix**: Created a script (`scripts/fix-chromadb-content.js`) that:
1. Read all documents from ChromaDB
2. Reconstructed actual content from character-indexed metadata
3. Deleted old collection
4. Re-added documents with correct structure:
   - Content field: Actual text content
   - Metadata field: Module name, chunk_id, created_at

**Example Before**:
```json
{
  "content": "entrepreneurship_chunk_0",
  "metadata": {
    "0": "E", "1": "n", "2": "t", "3": "r", ...
  }
}
```

**Example After**:
```json
{
  "content": "Entrepreneurship is the process of starting and managing...",
  "metadata": {
    "module": "Entrepreneurship & Business Ideas",
    "chunk_id": "entrepreneurship_chunk_0",
    "created_at": "2025-10-06T23:48:01.000Z"
  }
}
```

**Files Created**:
- `scripts/fix-chromadb-content.js`

---

### 3. ✅ "HI" Message Not Resetting to Course Selection
**Problem**: When users sent "HI" while in learning mode (after selecting a module), the bot processed it as a RAG question instead of showing the course selection menu.

**Fix**: Added defense-in-depth greeting checks in state handlers:
```javascript
// moodle-orchestrator.service.js:290-299 (Learning State)
if (lowerMsg.match(/^(hi|hello|hey|start|teach me|begin|restart)$/)) {
  await this.updateConversationState(userId, {
    conversation_state: 'course_selection',
    current_course_id: null,
    current_module_id: null
  });
  return this.showCourseSelection();
}

// moodle-orchestrator.service.js:513-524 (Quiz State)
if (lowerMsg.match(/^(hi|hello|hey|start|teach me|begin|restart|menu)$/)) {
  await this.updateConversationState(userId, {
    conversation_state: 'course_selection',
    current_course_id: null,
    current_module_id: null,
    current_question_index: null,
    quiz_answers: null
  });
  return this.showCourseSelection();
}
```

**Files Modified**:
- `services/moodle-orchestrator.service.js` (lines 290-299, 513-524, 540)

---

## Testing Results

### Before Fixes
```
User: "What is entrepreneurship?"
Bot: "entrepreneurship_chunk_0", "entrepreneurship_chunk_2"... ❌

User: "quiz please"
Bot: "Quiz Started!"
Bot: "Sorry, something went wrong." ❌

User: "HI" (while in learning mode)
Bot: [RAG-generated response about "HI"] ❌
```

### After Fixes
```
User: "What is entrepreneurship?"
Bot: "Entrepreneurship is the process of starting and managing
     a new business venture. Entrepreneurs identify opportunities,
     take calculated risks..." ✅

User: "quiz please"
Bot: "📝 Quiz Started! You'll answer 5 questions. Pass threshold: 70%"
Bot: [Shows first question with buttons] ✅

User: "HI" (while in learning mode)
Bot: [Shows course selection list] ✅
```

---

## Technical Details

### ChromaDB Document Structure (Fixed)
```javascript
{
  id: "84950981-0404-4f8e-be7c-20958a598360",
  content: "Entrepreneurship is the process of starting and managing a new business venture. Entrepreneurs identify opportunities, take calculated risks, and create value by introducing innovative products or services to the market. They are problem-solvers who turn ideas into reality through innovation and hard work.",
  metadata: {
    module: "Entrepreneurship & Business Ideas",
    chunk_id: "entrepreneurship_chunk_0",
    created_at: "2025-10-06T23:48:01.000Z"
  }
}
```

### Quiz Flow (Fixed)
```
1. User: "quiz please"
2. moodle-orchestrator.service.js:369 → startQuiz()
3. Returns: { type: 'quiz_intro', question: {...}, questionNum: 1, totalQuestions: 5 }
4. whatsapp-handler.service.js:74 → Detects quiz_intro type
5. whatsapp-handler.service.js:76 → Sends intro message
6. whatsapp-handler.service.js:79 → Formats question
7. whatsapp-handler.service.js:80 → Calls sendQuizQuestion(to, questionFormatted)
8. whatsapp-handler.service.js:109 → Correct method called ✅
9. Sends question with buttons to WhatsApp ✅
```

---

## Files Modified/Created

### Modified
1. **services/whatsapp-handler.service.js**
   - Renamed duplicate `sendQuizQuestion` to `sendQuizQuestionLegacy` (line 424)
   - Updated legacy quiz calls (lines 413, 463)
   - Added null check in legacy method (line 425-427)

2. **services/moodle-orchestrator.service.js**
   - Added greeting check in `handleLearningState` (lines 290-299)
   - Added greeting check in `handleQuizState` (lines 513-524)
   - Improved error message for invalid quiz answers (line 540)

### Created
1. **scripts/fix-chromadb-content.js**
   - Fixes swapped content/metadata in ChromaDB
   - Reconstructs actual text from character indices
   - Rebuilds collection with correct structure

2. **CHAT_AND_QUIZ_FIXES.md** (this document)
   - Complete documentation of all fixes

---

## Deployment Steps

1. ✅ Fixed quiz method naming conflict
2. ✅ Fixed "HI" message handling in all states
3. ✅ Restarted app container (`docker restart teachers_training-app-1`)
4. ✅ Fixed ChromaDB content structure (`node scripts/fix-chromadb-content.js`)
5. ✅ Verified fixes with test queries

---

## Next Steps / Recommendations

### Immediate
- ✅ All critical issues resolved
- ✅ RAG responses now show actual content
- ✅ Quizzes start and display questions correctly
- ✅ "HI" command resets to course selection from any state

### Future Improvements
1. **Prevent ChromaDB Content Swap**
   - Review document ingestion scripts
   - Add validation: content must be string, not object
   - Add tests to verify content structure before adding to ChromaDB

2. **Remove Legacy Quiz Code**
   - Since we're using moodle-orchestrator for all quiz logic
   - Remove `startModuleQuiz`, `handleQuizAnswer`, `completeQuiz` from whatsapp-handler.service.js
   - Clean up to prevent future conflicts

3. **Add Better Logging**
   - Log quiz state transitions
   - Log RAG query/response lengths
   - Add debug mode for troubleshooting

4. **Improve Vertex AI Error Handling**
   - Currently seeing "Unable to obtain access token" errors
   - Fallback embedding works, but slows down responses
   - Fix Google Cloud credentials for faster embeddings

---

## Summary

All three issues have been resolved:

✅ **Chat (RAG)**: Now returns actual content instead of chunk labels
✅ **Quiz**: Successfully starts and displays questions with buttons
✅ **HI Message**: Resets to course selection from any state

The system is now fully functional for the complete user journey:
1. HI → Course selection
2. Select course → Module selection
3. Select module → Learning mode
4. Ask questions → RAG-powered responses with real content
5. Quiz please → Quiz with interactive buttons
6. Answer questions → Next question or completion
7. HI (anytime) → Back to course selection

🎉 **All flows working correctly!**
