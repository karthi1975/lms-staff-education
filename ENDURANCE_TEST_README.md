# 120-Minute Admin Portal Endurance Test

Comprehensive automated test that runs for **120 minutes**, continuously testing all admin portal features with **5-second delays** for easy observation.

## 🎯 What It Tests

The test runs in a continuous loop, testing:

| Feature | Tests Performed |
|---------|----------------|
| **📊 Dashboard** | Page load, title verification, navigation |
| **📚 Course Management** | Course listing, detail pages, file uploads |
| **👥 User Management** | User table, user counts, data display |
| **💬 Module Chat** | Module selection, AI responses, RAG pipeline, source citations |
| **📁 Content** | Content menu, section availability |
| **📋 Modules** | Module page loading, listings |
| **⚙️ Settings** | Settings section, navigation |

## ⏱️ Test Configuration

- **Duration**: 120 minutes (2 hours)
- **Action Delay**: 5 seconds between each action
- **Page Load Delay**: 5 seconds for page loads
- **Slow Motion**: 500ms per action (headed mode)
- **Iterations**: Runs continuously until time expires

## 🚀 How to Run

### Option 1: Visual Mode (Recommended)
Watch the test run in a visible browser window:
```bash
./run-endurance-test.sh
```

Features:
- ✅ Visible browser window
- ✅ Slow motion (500ms per action)
- ✅ Real-time observation
- ✅ Easy to see what's happening

### Option 2: Headless Mode
Run in the background without browser window:
```bash
./run-endurance-test-headless.sh
```

Features:
- ✅ No visible browser
- ✅ Runs in background
- ✅ Output logged to `endurance-test.log`
- ✅ Good for CI/CD or overnight runs

### Option 3: Manual Run
Custom configuration:
```bash
TEST_BASE_URL=http://34.162.136.203:3000 \
  npx playwright test tests/e2e/admin-portal-endurance.spec.js \
  --project=chromium \
  --headed \
  --slow-mo=500 \
  --workers=1
```

## 📊 What You'll See

### Console Output
Each iteration shows:
```
═══════════════════════════════════════════════════════
🔄 ITERATION 5 | ⏱️ Elapsed: 15m | Remaining: 105m
═══════════════════════════════════════════════════════

📊 [1/7] Testing Dashboard...
   ✅ Dashboard loaded: Teachers Training LMS

📚 [2/7] Testing Course Management...
   ✅ Found 2 courses
   📖 Opening course: Business Studies for Entrepreneurs
   ✅ Course detail page loaded
   📁 Found 9 uploaded files

👥 [3/7] Testing User Management...
   ✅ Found 15 users

💬 [4/7] Testing Module Chat Assistant...
   ✅ Found 5 training modules
   📝 Selecting module: Production
   ✅ Welcome message displayed
   💬 Asking: "What is entrepreneurship?"
   📤 Message sent, waiting for response...
   ✅ User message displayed
   ⏳ AI is typing...
   ✅ AI response received!
   📊 Response length: 1171 characters
   📚 Has sources: YES ✅

📁 [5/7] Testing Content Section...
   ✅ Content menu found

📋 [6/7] Testing Module Management...
   ✅ Modules page loaded: Modules

⚙️ [7/7] Testing Settings/Communication...
   ✅ Settings section available

✅ Iteration 5 complete (920s elapsed)
```

### Final Summary
After 120 minutes:
```
═══════════════════════════════════════════════════════
🏁 ENDURANCE TEST COMPLETE
═══════════════════════════════════════════════════════

⏱️ Total time: 120 minutes
🔄 Total iterations: 15
📊 Average time per iteration: 480s
⏰ End time: 2025-10-21 18:30:00

✅ All admin portal features tested successfully!
```

## 💬 Business Questions Tested

The chat module rotates through these questions:
1. What is entrepreneurship?
2. What is production in business?
3. How do you identify business opportunities?
4. What are the factors of production?
5. What is business management?
6. How to manage quality control?
7. What is warehousing?
8. How to finance a small business?
9. What is inventory management?
10. How to write a business plan?

## 🔍 What Gets Validated

### For Each Chat Interaction:
- ✅ Module selection works
- ✅ Welcome message appears
- ✅ User can send messages
- ✅ Typing indicator shows
- ✅ AI response received
- ✅ Response has content
- ✅ RAG sources included
- ✅ Cross-module fallback works

### For Each Page:
- ✅ Page loads successfully
- ✅ Expected elements present
- ✅ Data displays correctly
- ✅ Navigation works
- ✅ No errors in console

## 🛑 Stopping the Test

Press `Ctrl+C` at any time to stop the test gracefully.

## 📝 Logs

### Headless Mode
All output saved to: `endurance-test.log`

### Visual Mode
Output shown in terminal and Playwright UI

## 🎯 Use Cases

1. **Overnight Testing**: Run headless mode overnight to test system stability
2. **Demo**: Run visual mode to demonstrate all features
3. **Load Testing**: Verify system handles continuous usage
4. **Regression Testing**: Ensure no features break over extended use
5. **Performance Monitoring**: Watch response times over 120 minutes
6. **RAG Pipeline Validation**: Verify AI responses remain consistent

## 🔧 Configuration

To change test duration, edit `tests/e2e/admin-portal-endurance.spec.js`:

```javascript
const TEST_DURATION_MS = 120 * 60 * 1000; // 120 minutes

// Change to 30 minutes:
const TEST_DURATION_MS = 30 * 60 * 1000;

// Change to 4 hours:
const TEST_DURATION_MS = 240 * 60 * 1000;
```

To change delays:
```javascript
const ACTION_DELAY = 5000; // 5 seconds
const PAGE_LOAD_DELAY = 5000; // 5 seconds
```

## ✅ Success Criteria

The test is considered successful if:
- All iterations complete without errors
- Chat responses include RAG sources
- All pages load within timeout
- Navigation works across all sections
- No browser crashes
- Test runs for full 120 minutes

## 🐛 Troubleshooting

**Test fails immediately:**
- Check GCP instance is running
- Verify URL is accessible: http://34.162.136.203:3000
- Ensure admin credentials are correct

**Chat responses have no sources:**
- Verify ChromaDB has content indexed
- Check Business Studies content is uploaded
- Review server.js RAG fallback logic

**Browser crashes:**
- Reduce slow-mo speed
- Run in headless mode
- Check system memory

## 📦 Files

- `tests/e2e/admin-portal-endurance.spec.js` - Main test file
- `run-endurance-test.sh` - Visual mode runner
- `run-endurance-test-headless.sh` - Headless mode runner
- `ENDURANCE_TEST_README.md` - This file

## 🎉 Example Output

A successful 2-hour run will show:
- ~15 iterations (8 minutes per iteration with delays)
- ~150 chat interactions (10 questions × 15 iterations)
- ~105 page loads (7 pages × 15 iterations)
- 100% success rate on all features

---

*Generated for Teachers Training System - Module Chat Assistant Endurance Testing*
