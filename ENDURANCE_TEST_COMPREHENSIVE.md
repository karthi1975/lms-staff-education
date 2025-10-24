# Comprehensive Admin Portal Endurance Test

## Overview

This is a **2-hour comprehensive endurance test** that validates ALL features of the Teachers Training System admin portal under realistic user simulation conditions.

## What It Tests

### ✅ Complete Feature Coverage (10 Test Categories)

1. **LMS Dashboard** (`lms-dashboard.html`)
   - Dashboard metrics and stat cards
   - Navigation functionality
   - Layout and theme
   - Page responsiveness

2. **Course Management - List View** (`courses.html`)
   - Course card display
   - Course list rendering
   - Hover interactions
   - Navigation to course details

3. **Course Detail Page** (`course-detail.html`)
   - Course information display
   - Uploaded files section
   - File upload functionality
   - Breadcrumb navigation

4. **Module Management - List View** (`modules.html`)
   - Module card display
   - Create module button
   - Module list rendering
   - Navigation to module details

5. **Module Detail Page** (`module-detail.html`)
   - Module information display
   - Module content sections
   - Scroll behavior
   - Content layout

6. **User Management - List View** (`users.html`)
   - User table/list display
   - Search and filter functionality
   - Keyboard navigation (Tab/Shift+Tab)
   - User row interactions

7. **User Detail Page** (`user-detail.html`)
   - User information display
   - Progress indicators and bars
   - Module completion status
   - Learning path visualization

8. **Quiz Functionality** (`quiz.html`)
   - Quiz question display
   - Answer option selection
   - Quiz interaction patterns
   - Question navigation

9. **AI Chat Assistant** (`chat.html` & `chat-v2.html`)
   - Module selection
   - Welcome message display
   - Natural question typing
   - RAG-powered AI responses
   - Source citation verification
   - Typing indicator
   - Message display

10. **Moodle Settings** (`moodle-settings.html`)
    - Configuration fields
    - Input validation
    - Settings layout
    - Form interactions

### 🎭 Realistic User Simulation

The test simulates **real human behavior** with:

- **Mouse Movements**: Smooth cursor movement to elements
- **Mouse Hovers**: Hovering over buttons, cards, and links before clicking
- **Natural Typing**: Character-by-character typing with random delays (50-150ms)
- **Keyboard Navigation**: Tab and Shift+Tab through form elements
- **Realistic Delays**: 1.5-4 second delays between actions
- **Page Scanning**: Simulated reading behavior with mouse movements
- **Scroll Behavior**: Natural scrolling in small increments
- **Random Variations**: Randomized element selection and interaction patterns

### 📊 Test Metrics Tracked

- Total iterations completed
- Time per iteration
- Feature test counts (each of 10 categories)
- Mouse hover count
- Mouse click count
- Keyboard navigation count
- Natural typing count
- Page scanning count
- RAG questions asked
- RAG responses received
- RAG responses with sources
- Success count
- Warning count
- Failure count

## Files Created

```
tests/e2e/admin-portal-endurance-comprehensive.spec.js  # Main test file
run-endurance-test-comprehensive.sh                      # Run script
monitor-endurance-test-comprehensive.sh                  # Monitor script
endurance-test-comprehensive.log                         # Log file (created on run)
```

## How to Use

### 1. Run the Test

```bash
./run-endurance-test-comprehensive.sh
```

This will:
- Start the test in headless mode (no visible browser)
- Run for 2 hours continuously
- Log all activity to `endurance-test-comprehensive.log`
- Display summary on completion

### 2. Monitor Progress (While Running)

In a **separate terminal**, run:

```bash
./monitor-endurance-test-comprehensive.sh
```

This shows:
- Current test status (running/stopped)
- Latest iteration number
- Current test step (e.g., [5/10] Testing Module Detail)
- Last 20 lines of activity
- Comprehensive statistics:
  - Iterations completed
  - Feature test counts
  - Interaction counts
  - RAG statistics
  - Success/warning/failure counts

Refresh the monitor anytime by running the command again.

### 3. Watch Live Output

For **real-time streaming** of the log:

```bash
tail -f endurance-test-comprehensive.log
```

Press `Ctrl+C` to stop watching.

### 4. Stop the Test Early

If you need to stop the test before 2 hours:

```bash
pkill -f admin-portal-endurance-comprehensive
```

## Test Duration

- **Total Duration**: 120 minutes (2 hours)
- **Iterations**: Continuous until time limit
- **Average Iteration**: ~3-5 minutes per full cycle
- **Expected Iterations**: ~24-40 complete iterations

## Test Configuration

```javascript
BASE_URL: http://34.162.136.203:3000 (or TEST_BASE_URL env var)
ADMIN_EMAIL: admin@school.edu
ADMIN_PASSWORD: Admin123!
TEST_DURATION: 120 minutes
MIN_DELAY: 1.5 seconds
MAX_DELAY: 4 seconds
```

## Output Log Format

The log includes:

```
═══════════════════════════════════════════════════════════════
🔄 ITERATION 1 | ⏱️ Elapsed: 5m | Remaining: 115m
═══════════════════════════════════════════════════════════════

📊 [1/10] Testing LMS Dashboard...
   ⏱️ Waiting 3245ms for page load...
   ✅ Dashboard loaded successfully
   👁️ Scanning page content...
   📈 Found 8 dashboard stat cards
   ✅ Iteration 1 complete (312s elapsed)

📚 [2/10] Testing Course Management (List)...
   ✅ Found 12 courses
   🖱️ Hovering over course #3...
   ...

💬 [9/10] Testing AI Chat Assistant...
   🎯 Using chat-v2.html...
   ✅ Found 5 training modules
   📝 Selecting module: Business Studies: Entrepreneurship...
   🖱️ Hovering over module...
   🖱️ Clicked module
   ✅ Welcome message displayed
   👁️ Scanning page content...
   💬 Asking: "What is entrepreneurship?"
   ⌨️ Typing naturally...
   ✅ Question typed
   ⌨️ Pressing Enter to send...
   📤 Message sent, waiting for AI response...
   ✅ User message displayed
   ⏳ AI is typing...
   ✅ AI response received!
   📊 Response length: 1247 characters
   📚 Has sources: YES ✅
   👁️ Reading AI response...
```

## Final Summary Example

```
═══════════════════════════════════════════════════════════════
🏁 COMPREHENSIVE ENDURANCE TEST COMPLETE
═══════════════════════════════════════════════════════════════

⏱️ Total time: 120 minutes
🔄 Total iterations: 32
📊 Average time per iteration: 225s
⏰ End time: 2025-10-23 14:30:00

✅ All admin portal features tested comprehensively!

🎯 Features Tested:
   ✓ LMS Dashboard
   ✓ Course Management (List & Detail)
   ✓ Module Management (List & Detail)
   ✓ User Management (List & Detail)
   ✓ Quiz Functionality
   ✓ AI Chat Assistant (v1 & v2 with RAG)
   ✓ Moodle Settings
   ✓ Navigation & Theme

🎭 Interaction Summary:
   - Mouse movements and hovers: ✅
   - Natural typing patterns: ✅
   - Tab/Shift+Tab navigation: ✅
   - Realistic scrolling: ✅
   - Human-like delays: ✅
```

## Success Criteria

The test is considered successful if:

- ✅ Runs for full 120 minutes without crashing
- ✅ All 10 feature categories tested in each iteration
- ✅ RAG responses include source citations
- ✅ No critical errors (page load failures, auth failures)
- ✅ Natural user interactions simulate real usage patterns

## Troubleshooting

### Test Won't Start

```bash
# Check if Playwright is installed
npx playwright --version

# Install if needed
npx playwright install chromium
```

### Test Stops Early

- Check `endurance-test-comprehensive.log` for errors
- Verify server is running at `http://34.162.136.203:3000`
- Check admin credentials are correct
- Ensure sufficient disk space for logs

### High Failure Count

- Review log for specific failures
- Check network connectivity
- Verify all admin pages are accessible
- Test individual features manually

### Monitor Shows "NOT RUNNING"

- Verify test is actually running: `ps aux | grep playwright`
- Check log file exists: `ls -lh endurance-test-comprehensive.log`
- Restart test if needed

## Comparison with Other Endurance Tests

| Test File | Duration | Features | Focus |
|-----------|----------|----------|-------|
| `admin-portal-endurance.spec.js` | 120 min | 7 features | Basic coverage |
| `admin-portal-endurance-realistic.spec.js` | 120 min | 7 features | Realistic interactions |
| **`admin-portal-endurance-comprehensive.spec.js`** | **120 min** | **10 features** | **Complete coverage + realistic** |

This test combines:
- ✅ Complete feature coverage (all 10 categories)
- ✅ Realistic user simulation
- ✅ Quiz functionality testing
- ✅ Both chat versions (v1 & v2)
- ✅ User detail page testing
- ✅ Module detail page testing
- ✅ Moodle settings testing

## Next Steps

After running the comprehensive test:

1. **Review Results**: Check `endurance-test-comprehensive.log` for issues
2. **Analyze Metrics**: Compare iteration times and success rates
3. **Fix Issues**: Address any warnings or failures found
4. **Performance Tuning**: Optimize slow-loading pages
5. **Run Again**: Verify fixes with another 2-hour run

## Notes

- **Headless Mode**: Test runs without visible browser for efficiency
- **No User Interaction Required**: Fully automated for 2 hours
- **Safe to Run**: Read-only operations, no data modification
- **Continuous Logging**: All actions logged for debugging
- **Realistic Load**: Simulates actual user behavior patterns

---

**Created**: 2025-10-23
**Test Version**: 1.0
**Platform**: Playwright + Chromium
**Target**: Teachers Training System Admin Portal
