#!/bin/bash

#############################################################################
# Setup Cron Job for Automatic Token Refresh
#
# This script helps you set up a cron job to automatically refresh
# Vertex AI credentials every 6 hours
#############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
REFRESH_SCRIPT="$SCRIPT_DIR/refresh-vertex-token.sh"
LOG_FILE="$PROJECT_DIR/logs/token-refresh.log"

echo "=========================================="
echo "Vertex AI Token Refresh - Cron Setup"
echo "=========================================="
echo ""

# Make refresh script executable
chmod +x "$REFRESH_SCRIPT"
echo "✅ Made refresh script executable"

# Create logs directory
mkdir -p "$PROJECT_DIR/logs"
echo "✅ Created logs directory"

# Create initial log file
touch "$LOG_FILE"
echo "✅ Created log file: $LOG_FILE"

# Generate cron entry
CRON_ENTRY="0 */6 * * * $REFRESH_SCRIPT >> $LOG_FILE 2>&1"

echo ""
echo "=========================================="
echo "Cron Job Configuration"
echo "=========================================="
echo ""
echo "The following cron job will refresh tokens every 6 hours:"
echo ""
echo "  $CRON_ENTRY"
echo ""
echo "Schedule: Every 6 hours at minute 0 (12am, 6am, 12pm, 6pm)"
echo "Logs: $LOG_FILE"
echo ""

# Check if cron entry already exists
if crontab -l 2>/dev/null | grep -F "$REFRESH_SCRIPT" > /dev/null; then
    echo "⚠️  Cron job already exists!"
    echo ""
    echo "Current cron jobs:"
    crontab -l | grep -F "$REFRESH_SCRIPT" || true
    echo ""
    read -p "Do you want to update it? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
    # Remove old entries
    crontab -l | grep -v "$REFRESH_SCRIPT" | crontab -
    echo "✅ Removed old cron job"
fi

# Ask user to confirm
echo "=========================================="
read -p "Do you want to install this cron job? (y/n) " -n 1 -r
echo ""
echo "=========================================="

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Cron job NOT installed."
    echo ""
    echo "To install manually, run:"
    echo "  crontab -e"
    echo ""
    echo "Then add this line:"
    echo "  $CRON_ENTRY"
    exit 0
fi

# Install cron job
(crontab -l 2>/dev/null || true; echo "$CRON_ENTRY") | crontab -

echo ""
echo "✅ Cron job installed successfully!"
echo ""

# Verify installation
echo "Current cron jobs:"
crontab -l | grep -F "$REFRESH_SCRIPT" || echo "ERROR: Cron job not found!"
echo ""

# Test the refresh script now
echo "=========================================="
read -p "Do you want to test the refresh script now? (y/n) " -n 1 -r
echo ""
echo "=========================================="

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Running refresh script..."
    "$REFRESH_SCRIPT"
    echo ""
    echo "✅ Test completed. Check logs at: $LOG_FILE"
fi

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "✅ Token refresh will run automatically every 6 hours"
echo "📝 View logs: tail -f $LOG_FILE"
echo "📋 List cron jobs: crontab -l"
echo "🔧 Edit cron jobs: crontab -e"
echo "❌ Remove cron job: crontab -l | grep -v '$REFRESH_SCRIPT' | crontab -"
echo ""
echo "Next automatic refresh: $(date -v +6H '+%Y-%m-%d %H:00:00')"
echo ""
