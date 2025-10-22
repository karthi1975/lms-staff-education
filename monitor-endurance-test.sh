#!/bin/bash

# Monitor Endurance Test Progress
# Shows real-time status and latest activity

echo "🔍 Endurance Test Monitor"
echo "═══════════════════════════════════════════════════"
echo ""

# Check if test is running
if pgrep -f "admin-portal-endurance" > /dev/null; then
    echo "✅ Test Status: RUNNING"
else
    echo "⏹️  Test Status: NOT RUNNING"
fi

echo ""
echo "⏱️  Test Details:"
echo "   Duration: 120 minutes (2 hours)"
echo "   Target: http://34.162.136.203:3000"
echo "   Mode: Headless (background)"
echo ""

# Show start time if log exists
if [ -f endurance-test.log ]; then
    START_TIME=$(grep "Start time:" endurance-test.log | head -1 | cut -d: -f2-)
    echo "   Start Time: $START_TIME"

    # Show latest iteration
    LATEST_ITERATION=$(grep "ITERATION" endurance-test.log | tail -1)
    if [ -n "$LATEST_ITERATION" ]; then
        echo ""
        echo "📊 Latest Progress:"
        echo "   $LATEST_ITERATION"
    fi

    # Show latest activity
    echo ""
    echo "🔄 Latest Activity (last 10 lines):"
    echo "───────────────────────────────────────────────────"
    tail -10 endurance-test.log | grep -v "^$"
    echo "───────────────────────────────────────────────────"

    # Count iterations
    ITERATION_COUNT=$(grep -c "^🔄 ITERATION" endurance-test.log)
    echo ""
    echo "📈 Statistics:"
    echo "   Iterations completed: $ITERATION_COUNT"

    # Count successes
    SUCCESS_COUNT=$(grep -c "✅" endurance-test.log)
    echo "   Successful actions: $SUCCESS_COUNT"

    # Count failures (if any)
    FAILURE_COUNT=$(grep -c "❌\|Error\|Failed" endurance-test.log)
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
echo "  ./monitor-endurance-test.sh    - Refresh this view"
echo "  tail -f endurance-test.log     - Watch live output"
echo "  pkill -f admin-portal-endurance - Stop the test"
echo ""
