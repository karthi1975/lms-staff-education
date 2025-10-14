#!/bin/bash

#############################################################################
# Vertex AI Token Refresh Script
#
# Purpose: Automatically refresh Google Cloud Application Default Credentials
#          and update the Docker container with fresh tokens
#
# Usage:
#   - Run manually: ./scripts/refresh-vertex-token.sh
#   - Run via cron: See setup instructions below
#
# Cron Setup (refresh every 6 hours):
#   crontab -e
#   Add line: 0 */6 * * * /Users/karthi/business/staff_education/teachers_training/scripts/refresh-vertex-token.sh >> /Users/karthi/business/staff_education/teachers_training/logs/token-refresh.log 2>&1
#############################################################################

set -e

# Configuration
PROJECT_DIR="/Users/karthi/business/staff_education/teachers_training"
LOG_DIR="$PROJECT_DIR/logs"
CREDENTIALS_DIR="$PROJECT_DIR/credentials"
ADC_SOURCE="$HOME/.config/gcloud/application_default_credentials.json"
ADC_DEST="$CREDENTIALS_DIR/application_default_credentials.json"
DOCKER_CONTAINER="teachers_training-app-1"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "=========================================="
log "Starting Vertex AI Token Refresh"
log "=========================================="

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    log "ERROR: gcloud CLI not found. Please install Google Cloud SDK."
    exit 1
fi

# Check if source credentials exist
if [ ! -f "$ADC_SOURCE" ]; then
    log "ERROR: Application Default Credentials not found at $ADC_SOURCE"
    log "Run: gcloud auth application-default login"
    exit 1
fi

log "Found existing credentials at $ADC_SOURCE"

# Parse the credentials to get token info
CRED_TYPE=$(python3 -c "import json; print(json.load(open('$ADC_SOURCE')).get('type', 'unknown'))" 2>/dev/null)

if [ "$CRED_TYPE" != "authorized_user" ]; then
    log "WARNING: Credentials are not user credentials (type: $CRED_TYPE)"
    log "This script is designed for user credentials from 'gcloud auth application-default login'"
fi

# Check if credentials file has changed (to avoid unnecessary restarts)
if [ -f "$ADC_DEST" ]; then
    if cmp -s "$ADC_SOURCE" "$ADC_DEST"; then
        log "Credentials file unchanged. Checking token validity..."

        # Try to get a fresh token (this will use the refresh token internally)
        if gcloud auth application-default print-access-token &> /dev/null; then
            log "Token is still valid. No action needed."
            log "=========================================="
            exit 0
        else
            log "Token validation failed. Will refresh..."
        fi
    fi
fi

# Refresh the token by getting a new access token
log "Refreshing access token..."
if gcloud auth application-default print-access-token &> /dev/null; then
    log "✅ Token refreshed successfully"
else
    log "ERROR: Failed to refresh token"
    log "Try running: gcloud auth application-default login"
    exit 1
fi

# Copy fresh credentials to Docker mount point
log "Copying credentials to Docker mount point..."
cp "$ADC_SOURCE" "$ADC_DEST"
chmod 400 "$ADC_DEST"
log "✅ Credentials copied to $ADC_DEST"

# Check if Docker container is running
if docker ps --format '{{.Names}}' | grep -q "^${DOCKER_CONTAINER}$"; then
    log "Docker container is running. Restarting to pick up new credentials..."

    cd "$PROJECT_DIR"
    if docker-compose restart app &> /dev/null; then
        log "✅ Docker container restarted successfully"

        # Wait for container to be healthy
        log "Waiting for container to be healthy..."
        sleep 5

        HEALTH_CHECK=$(curl -s http://localhost:3000/health 2>/dev/null | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', 'unhealthy'))" 2>/dev/null)

        if [ "$HEALTH_CHECK" = "healthy" ]; then
            log "✅ Container is healthy"
        else
            log "WARNING: Container may not be healthy yet (status: $HEALTH_CHECK)"
        fi
    else
        log "ERROR: Failed to restart Docker container"
        exit 1
    fi
else
    log "WARNING: Docker container '$DOCKER_CONTAINER' is not running"
    log "Credentials updated, but container needs to be started manually"
fi

log "=========================================="
log "Token refresh completed successfully"
log "=========================================="
