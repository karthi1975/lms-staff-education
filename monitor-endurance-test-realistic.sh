#!/bin/bash

# Monitor Realistic Endurance Test Progress
# Shows real-time status and latest activity

echo "🔍 Realistic Endurance Test Monitor"
echo "═══════════════════════════════════════════════════"
echo ""

# Check if test is running
if pgrep -f "admin-portal-endurance-realistic" > /dev/null; then
    echo "✅ Test Status: RUNNING (Realistic Mode)"
else
    echo "⏹️  Test Status: NOT RUNNING"
fi

echo ""
echo "⏱️  Test Details:"
echo "   Duration: 120 minutes (2 hours)"
echo "   Target: http://34.162.136.203:3000"
echo "   Mode: Realistic user simulation"
echo "   Features:"
echo "     - Mouse movements & hovers"
echo "     - Natural typing patterns"
echo "     - Tab/Shift+Tab navigation"
echo "     - Scroll behaviors"
echo "     - Human-like delays"
echo ""

# Show start time if log exists
if [ -f endurance-test-realistic.log ]; then
    START_TIME=$(grep "Start time:" endurance-test-realistic.log | head -1 | cut -d: -f2-)
    echo "   Start Time: $START_TIME"

    # Show latest iteration
    LATEST_ITERATION=$(grep "ITERATION" endurance-test-realistic.log | tail -1)
    if [ -n "$LATEST_ITERATION" ]; then
        echo ""
        echo "📊 Latest Progress:"
        echo "   $LATEST_ITERATION"
    fi

    # Show latest activity
    echo ""
    echo "🔄 Latest Activity (last 15 lines):"
    echo "───────────────────────────────────────────────────"
    tail -15 endurance-test-realistic.log | grep -v "^$"
    echo "───────────────────────────────────────────────────"

    # Count iterations
    ITERATION_COUNT=$(grep -c "^🔄 ITERATION" endurance-test-realistic.log)
    echo ""
    echo "📈 Statistics:"
    echo "   Iterations completed: $ITERATION_COUNT"

    # Count interactions
    MOUSE_HOVERS=$(grep -c "🖱️ Hovering" endurance-test-realistic.log)
    MOUSE_CLICKS=$(grep -c "🖱️ Clicked" endurance-test-realistic.log)
    TAB_NAV=$(grep -c "⌨️ Testing Tab" endurance-test-realistic.log)
    TYPING=$(grep -c "⌨️ Typing naturally" endurance-test-realistic.log)
    SCANNING=$(grep -c "👁️ Scanning" endurance-test-realistic.log)

    echo "   Mouse hovers: $MOUSE_HOVERS"
    echo "   Mouse clicks: $MOUSE_CLICKS"
    echo "   Keyboard navigation: $TAB_NAV"
    echo "   Natural typing: $TYPING"
    echo "   Page scanning: $SCANNING"

    # Count successes
    SUCCESS_COUNT=$(grep -c "✅" endurance-test-realistic.log)
    echo "   Successful actions: $SUCCESS_COUNT"

    # Count failures (if any)
    FAILURE_COUNT=$(grep -c "❌\|Error\|Failed" endurance-test-realistic.log)
    if [ $FAILURE_COUNT -gt 0 ]; then
        echo "   ⚠️  Failures detected: $FAILURE_COUNT"
    fi
else
    echo "   Log file not found yet..."
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo ""
echo "Commands:"
echo "  ./monitor-endurance-test-realistic.sh    - Refresh this view"
echo "  tail -f endurance-test-realistic.log     - Watch live output"
echo "  pkill -f admin-portal-endurance-realistic - Stop the test"
echo ""
