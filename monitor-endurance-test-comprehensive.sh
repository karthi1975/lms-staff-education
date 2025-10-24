#!/bin/bash

# Monitor Comprehensive Endurance Test Progress
# Shows real-time status and latest activity

echo "🔍 Comprehensive Endurance Test Monitor"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check if test is running
if pgrep -f "admin-portal-endurance-comprehensive" > /dev/null; then
    echo "✅ Test Status: RUNNING (Comprehensive Mode)"
else
    echo "⏹️  Test Status: NOT RUNNING"
fi

echo ""
echo "⏱️  Test Configuration:"
echo "   Duration: 120 minutes (2 hours)"
echo "   Target: http://34.162.136.203:3000"
echo "   Mode: Comprehensive coverage of ALL features"
echo ""
echo "🎯 Features Being Tested:"
echo "   [1/10] LMS Dashboard (metrics, stats)"
echo "   [2/10] Course Management (list)"
echo "   [3/10] Course Detail (files, uploads)"
echo "   [4/10] Module Management (list)"
echo "   [5/10] Module Detail (content)"
echo "   [6/10] User Management (list)"
echo "   [7/10] User Detail (progress)"
echo "   [8/10] Quiz Functionality"
echo "   [9/10] AI Chat Assistant (RAG)"
echo "   [10/10] Moodle Settings"
echo ""

# Show start time if log exists
if [ -f endurance-test-comprehensive.log ]; then
    START_TIME=$(grep "Start time:" endurance-test-comprehensive.log | head -1 | cut -d: -f2-)
    if [ -n "$START_TIME" ]; then
        echo "   Start Time:$START_TIME"
    fi

    # Show latest iteration
    LATEST_ITERATION=$(grep "ITERATION" endurance-test-comprehensive.log | tail -1)
    if [ -n "$LATEST_ITERATION" ]; then
        echo ""
        echo "📊 Latest Progress:"
        echo "   $LATEST_ITERATION"
    fi

    # Show current test step
    LATEST_STEP=$(grep -E "\[[0-9]+/10\] Testing" endurance-test-comprehensive.log | tail -1)
    if [ -n "$LATEST_STEP" ]; then
        echo ""
        echo "🔄 Current Step:"
        echo "   $LATEST_STEP"
    fi

    # Show latest activity
    echo ""
    echo "🔄 Latest Activity (last 20 lines):"
    echo "───────────────────────────────────────────────────────────────"
    tail -20 endurance-test-comprehensive.log | grep -v "^$"
    echo "───────────────────────────────────────────────────────────────"

    # Count iterations
    ITERATION_COUNT=$(grep -c "^🔄 ITERATION" endurance-test-comprehensive.log)
    echo ""
    echo "📈 Statistics:"
    echo "   Iterations completed: $ITERATION_COUNT"

    # Count feature tests
    DASHBOARD_COUNT=$(grep -c "\[1/10\] Testing LMS Dashboard" endurance-test-comprehensive.log)
    COURSE_COUNT=$(grep -c "\[2/10\] Testing Course Management" endurance-test-comprehensive.log)
    COURSE_DETAIL_COUNT=$(grep -c "\[3/10\] Testing Course Detail" endurance-test-comprehensive.log)
    MODULE_COUNT=$(grep -c "\[4/10\] Testing Module Management" endurance-test-comprehensive.log)
    MODULE_DETAIL_COUNT=$(grep -c "\[5/10\] Testing Module Detail" endurance-test-comprehensive.log)
    USER_COUNT=$(grep -c "\[6/10\] Testing User Management" endurance-test-comprehensive.log)
    USER_DETAIL_COUNT=$(grep -c "\[7/10\] Testing User Detail" endurance-test-comprehensive.log)
    QUIZ_COUNT=$(grep -c "\[8/10\] Testing Quiz" endurance-test-comprehensive.log)
    CHAT_COUNT=$(grep -c "\[9/10\] Testing AI Chat" endurance-test-comprehensive.log)
    MOODLE_COUNT=$(grep -c "\[10/10\] Testing Moodle" endurance-test-comprehensive.log)

    echo ""
    echo "   Feature Test Counts:"
    echo "   ├─ Dashboard tests: $DASHBOARD_COUNT"
    echo "   ├─ Course list tests: $COURSE_COUNT"
    echo "   ├─ Course detail tests: $COURSE_DETAIL_COUNT"
    echo "   ├─ Module list tests: $MODULE_COUNT"
    echo "   ├─ Module detail tests: $MODULE_DETAIL_COUNT"
    echo "   ├─ User list tests: $USER_COUNT"
    echo "   ├─ User detail tests: $USER_DETAIL_COUNT"
    echo "   ├─ Quiz tests: $QUIZ_COUNT"
    echo "   ├─ AI Chat tests: $CHAT_COUNT"
    echo "   └─ Moodle settings tests: $MOODLE_COUNT"

    # Count interactions
    echo ""
    MOUSE_HOVERS=$(grep -c "🖱️ Hovering" endurance-test-comprehensive.log)
    MOUSE_CLICKS=$(grep -c "🖱️ Clicked" endurance-test-comprehensive.log)
    TAB_NAV=$(grep -c "⌨️ Testing Tab" endurance-test-comprehensive.log)
    TYPING=$(grep -c "⌨️ Typing naturally" endurance-test-comprehensive.log)
    SCANNING=$(grep -c "👁️ Scanning" endurance-test-comprehensive.log)

    echo "   Interaction Counts:"
    echo "   ├─ Mouse hovers: $MOUSE_HOVERS"
    echo "   ├─ Mouse clicks: $MOUSE_CLICKS"
    echo "   ├─ Keyboard navigation: $TAB_NAV"
    echo "   ├─ Natural typing: $TYPING"
    echo "   └─ Page scanning: $SCANNING"

    # Count RAG responses
    echo ""
    RAG_QUESTIONS=$(grep -c "💬 Asking:" endurance-test-comprehensive.log)
    RAG_RESPONSES=$(grep -c "✅ AI response received!" endurance-test-comprehensive.log)
    RAG_SOURCES=$(grep -c "Has sources: YES ✅" endurance-test-comprehensive.log)

    echo "   AI Chat (RAG) Statistics:"
    echo "   ├─ Questions asked: $RAG_QUESTIONS"
    echo "   ├─ Responses received: $RAG_RESPONSES"
    echo "   └─ Responses with sources: $RAG_SOURCES"

    # Count successes
    SUCCESS_COUNT=$(grep -c "✅" endurance-test-comprehensive.log)
    echo ""
    echo "   Total successful actions: $SUCCESS_COUNT"

    # Count warnings/failures
    WARNING_COUNT=$(grep -c "⚠️" endurance-test-comprehensive.log)
    FAILURE_COUNT=$(grep -c "❌\|Error\|Failed" endurance-test-comprehensive.log)
    if [ $WARNING_COUNT -gt 0 ]; then
        echo "   ⚠️  Warnings: $WARNING_COUNT"
    fi
    if [ $FAILURE_COUNT -gt 0 ]; then
        echo "   ❌ Failures: $FAILURE_COUNT"
    fi

    # Calculate estimated completion time
    if [ $ITERATION_COUNT -gt 0 ] && [ -n "$START_TIME" ]; then
        echo ""
        # Try to calculate time remaining
        CURRENT_TIME=$(date +%s)
        # Note: START_TIME parsing would require date conversion
        echo "   📅 Use 'tail -f endurance-test-comprehensive.log' for live updates"
    fi
else
    echo "   Log file not found yet..."
    echo ""
    echo "   💡 Start the test with:"
    echo "      ./run-endurance-test-comprehensive.sh"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Commands:"
echo "  ./monitor-endurance-test-comprehensive.sh  - Refresh this view"
echo "  tail -f endurance-test-comprehensive.log   - Watch live output"
echo "  pkill -f admin-portal-endurance-comprehensive - Stop the test"
echo ""
