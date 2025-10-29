# 🎭 2-Hour Endurance Test - Monitoring Guide

**Test Started**: 2025-10-21 at 7:44 PM
**Expected Completion**: 2025-10-21 at 9:44 PM (2 hours later)
**Status**: ✅ **RUNNING**

---

## 📊 Quick Status

### Current Progress (Live)

Run this command anytime to see current status:
```bash
./monitor-endurance-test.sh
```

### Watch Live Output

To see the test running in real-time:
```bash
tail -f endurance-test.log
```

Press `Ctrl+C` to stop watching (test continues running)

---

## 🎯 What's Being Tested

### 7 Major Features (Tested Every ~2 Minutes)

Each iteration tests all 7 features in sequence:

1. **📊 Dashboard** (5 seconds)
   - Page load verification
   - Navigation elements

2. **📚 Course Management** (10 seconds)
   - Course list
   - Course details
   - CRUD operations

3. **👥 User Management** (10 seconds)
   - User list
   - User search
   - User details

4. **💬 Module Chat with RAG** (60 seconds)
   - 10 business questions
   - AI response validation
   - Source citation verification
   - Questions cycle through:
     - What is entrepreneurship?
     - What is production in business?
     - How do you identify business opportunities?
     - What are the factors of production?
     - What is business management?
     - How to manage quality control?
     - What is warehousing?
     - How to finance a small business?
     - What is inventory management?
     - How to write a business plan?

5. **📄 Content Upload** (15 seconds)
   - Content section access
   - Upload interface verification

6. **📚 Module Management** (10 seconds)
   - Module list
   - Module CRUD operations

7. **⚙️ Settings/Communication** (5 seconds)
   - Settings page
   - Configuration access

**Total per iteration**: ~115 seconds (~2 minutes)
**Expected iterations in 2 hours**: ~600 iterations
**Total actions tested**: ~4,200 actions

---

## 📈 Expected Timeline

| Time | Elapsed | Remaining | Iterations | Actions Tested |
|------|---------|-----------|------------|----------------|
| 7:44 PM | 0m | 120m | 0 | 0 |
| 8:14 PM | 30m | 90m | ~150 | ~1,050 |
| 8:44 PM | 60m | 60m | ~300 | ~2,100 |
| 9:14 PM | 90m | 30m | ~450 | ~3,150 |
| 9:44 PM | 120m | 0m | ~600 | ~4,200 ✅ |

---

## 🔍 Monitoring Commands

### 1. Quick Status Check
```bash
./monitor-endurance-test.sh
```

**Shows**:
- Test running status
- Current iteration
- Time elapsed/remaining
- Success/failure counts
- Latest activity

### 2. Live Log Watching
```bash
tail -f endurance-test.log
```

**Shows real-time**:
- Current iteration number
- Which feature is being tested
- Success/failure for each action
- Time remaining

### 3. Search for Failures
```bash
grep -i "error\|fail\|❌" endurance-test.log
```

**Shows**:
- Any errors encountered
- Failed actions
- Error messages

### 4. Count Success Rate
```bash
echo "Successes: $(grep -c '✅' endurance-test.log)"
echo "Failures: $(grep -c '❌' endurance-test.log)"
```

### 5. See Iteration Progress
```bash
grep "🔄 ITERATION" endurance-test.log | tail -5
```

**Shows last 5 iterations** with time remaining

---

## 🛑 Stopping the Test

### Normal Stop (if needed)
```bash
pkill -f admin-portal-endurance
```

The test will:
- Complete current action
- Save final logs
- Report total statistics

### Emergency Stop
```bash
pkill -9 -f admin-portal-endurance
```

Use only if normal stop doesn't work within 30 seconds.

---

## 📊 What to Look For

### ✅ Good Signs

1. **Steady Progress**
   ```
   🔄 ITERATION 25 | ⏱️ Elapsed: 47m | Remaining: 73m
   🔄 ITERATION 26 | ⏱️ Elapsed: 49m | Remaining: 71m
   ```

2. **Consistent Success Markers**
   ```
   ✅ Dashboard loaded successfully
   ✅ Course Management working
   ✅ RAG response received
   ```

3. **No Error Messages**
   - No "Error" or "Failed" in logs
   - No ❌ symbols
   - All actions completing

### ⚠️ Warning Signs

1. **Stuck on Same Iteration**
   ```
   # Same iteration for >5 minutes
   🔄 ITERATION 50 | ⏱️ Elapsed: 95m
   🔄 ITERATION 50 | ⏱️ Elapsed: 100m  # ⚠️ Still iteration 50!
   ```

2. **Error Messages**
   ```
   ❌ Dashboard failed to load
   Error: Timeout waiting for element
   ```

3. **Increasing Failure Count**
   ```bash
   ./monitor-endurance-test.sh
   # Shows: Failures detected: 15  # ⚠️ Failures increasing
   ```

---

## 📝 Log File Analysis

### After Test Completes

#### 1. Full Summary
```bash
cat endurance-test.log | tail -100
```

#### 2. Final Statistics
```bash
echo "Total Iterations: $(grep -c '^🔄 ITERATION' endurance-test.log)"
echo "Total Successes: $(grep -c '✅' endurance-test.log)"
echo "Total Failures: $(grep -c '❌' endurance-test.log)"
```

#### 3. Feature-Specific Performance
```bash
# Dashboard tests
grep "Testing Dashboard" endurance-test.log | wc -l

# RAG Chat tests
grep "Testing Module Chat" endurance-test.log | wc -l

# Course Management tests
grep "Testing Course Management" endurance-test.log | wc -l
```

#### 4. Find Any Issues
```bash
grep -B 5 -A 5 "Error\|Failed\|❌" endurance-test.log
```

Shows 5 lines before/after each failure for context.

---

## 🎯 Success Criteria

### Test Passes If:

1. **Runs Full 120 Minutes** ✅
   - Completes without crashing
   - Reaches final iteration

2. **Low Failure Rate** ✅
   - <1% failures (< 42 failures out of 4,200 actions)
   - Most features working consistently

3. **No Critical Errors** ✅
   - No authentication failures
   - No database connection errors
   - No service crashes

4. **Consistent Performance** ✅
   - Similar iteration times throughout
   - No significant slowdown over time

### Expected Results

Based on previous runs:
- **Success Rate**: >99%
- **Total Iterations**: ~600
- **Actions Tested**: ~4,200
- **Failures**: <10 (usually 0-3)

---

## 🔧 Troubleshooting

### Issue: Test Stops Early

**Check**:
```bash
tail -100 endurance-test.log | grep -i "error"
```

**Common Causes**:
- Authentication token expired
- Network connectivity issue
- Service restart on GCP

**Solution**:
```bash
# Restart test
./run-endurance-test-headless.sh
```

### Issue: High Failure Rate

**Check Which Feature**:
```bash
grep -B 1 "❌" endurance-test.log | head -20
```

**Common Causes**:
- Specific feature broken (RAG, upload, etc.)
- Timeout too short for slow responses
- GCP service issue

**Solution**:
- Check GCP service health: `curl http://34.162.136.203:3000/health`
- Review specific feature logs
- May need to fix underlying issue

### Issue: Browser Crashes

**Check**:
```bash
grep -i "browser\|chrome\|playwright" endurance-test.log | tail -20
```

**Solution**:
- Test should auto-restart browser
- If persists, check system resources

---

## 📧 What to Report

### After Test Completion

Share these metrics:

```bash
# Run this after test completes
echo "=== ENDURANCE TEST REPORT ==="
echo ""
echo "Duration: 120 minutes"
echo "Start: $(grep 'Start time:' endurance-test.log | head -1)"
echo "End: $(grep 'complete' endurance-test.log | tail -1)"
echo ""
echo "Iterations: $(grep -c '^🔄 ITERATION' endurance-test.log)"
echo "Successes: $(grep -c '✅' endurance-test.log)"
echo "Failures: $(grep -c '❌\|Error' endurance-test.log)"
echo ""
echo "Success Rate: $(awk "BEGIN {printf \"%.2f%%\", ($(grep -c '✅' endurance-test.log) / ($(grep -c '✅' endurance-test.log) + $(grep -c '❌' endurance-test.log))) * 100}")"
echo ""
echo "=== END REPORT ==="
```

---

## 🎯 Real-Time Monitoring Dashboard

### Option 1: Terminal Watch (Auto-Refresh)
```bash
watch -n 10 './monitor-endurance-test.sh'
```

Updates every 10 seconds automatically.

### Option 2: Manual Refresh
```bash
# Run whenever you want to check
./monitor-endurance-test.sh
```

### Option 3: Continuous Log Stream
```bash
tail -f endurance-test.log | grep --line-buffered "ITERATION\|✅\|❌"
```

Shows only iterations and results (filters noise).

---

## 📅 Test Schedule

### Current Run
- **Started**: 2025-10-21 at 7:44 PM
- **Will Complete**: 2025-10-21 at 9:44 PM
- **Duration**: 120 minutes (2 hours)

### Checkpoints

| Time | Action |
|------|--------|
| 8:14 PM (30m) | Check first checkpoint |
| 8:44 PM (60m) | Check midpoint progress |
| 9:14 PM (90m) | Check final stretch |
| 9:44 PM (120m) | Test complete - review results |

---

## ✅ What Success Looks Like

### Live Output Example
```
═══════════════════════════════════════════════════════
🔄 ITERATION 580 | ⏱️ Elapsed: 116m | Remaining: 4m
═══════════════════════════════════════════════════════

📊 [1/7] Testing Dashboard...
   ✅ Dashboard loaded successfully
📚 [2/7] Testing Course Management...
   ✅ Course list loaded
   ✅ Course details working
👥 [3/7] Testing User Management...
   ✅ User list working
   ✅ User search functional
💬 [4/7] Testing Module Chat with RAG...
   ✅ Question: How to write a business plan?
   ✅ RAG response received with sources
📄 [5/7] Testing Content Upload...
   ✅ Content section accessible
📚 [6/7] Testing Module Management...
   ✅ Module list loaded
⚙️ [7/7] Testing Settings...
   ✅ Settings page loaded

⏸️ Waiting 5 seconds before next iteration...
```

### Final Report Example
```
  1 passed (2.0h)

✅ Endurance test complete! Check endurance-test.log for details.

=== SUMMARY ===
Total Iterations: 600
Total Successes: 4,197
Total Failures: 3
Success Rate: 99.93%
```

---

**Test Running**: Use `./monitor-endurance-test.sh` to check status anytime!
**Live Watch**: Use `tail -f endurance-test.log` to watch in real-time!
**Stop Test**: Use `pkill -f admin-portal-endurance` if needed!

🎯 **The test will automatically stop after 120 minutes and generate a final report.**
