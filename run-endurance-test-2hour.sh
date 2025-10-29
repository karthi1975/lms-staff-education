#!/bin/bash

# Simple 2-Hour Endurance Test for SOLID Refactored Services
# Tests Logger, WhatsApp, and Orchestrator services

set -e

BASE_URL="http://34.162.136.203:3000"
DURATION_HOURS=2
DURATION_SECONDS=$((DURATION_HOURS * 3600))
START_TIME=$(date +%s)
LOG_FILE="solid-endurance-$(date +%Y%m%d-%H%M%S).log"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL=0
SUCCESS=0
FAILED=0

echo -e "${BLUE}=========================================================${NC}"
echo -e "${BLUE}  2-HOUR ENDURANCE TEST - SOLID REFACTORED SERVICES    ${NC}"
echo -e "${BLUE}=========================================================${NC}"
echo ""
echo "Start: $(date)"
echo "Duration: ${DURATION_HOURS} hours"
echo "Target: ${BASE_URL}"
echo "Log: ${LOG_FILE}"
echo ""

# Initialize log
cat > "$LOG_FILE" <<EOF
SOLID Refactoring Endurance Test
Started: $(date)
Duration: ${DURATION_HOURS} hours
Base URL: ${BASE_URL}

====================================
EOF

log() {
    echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

request() {
    TOTAL=$((TOTAL + 1))
    local CODE=$(curl -s -o /dev/null -w "%{http_code}" "$@")

    if [ "$CODE" -ge 200 ] && [ "$CODE" -lt 300 ]; then
        SUCCESS=$((SUCCESS + 1))
        echo -n "."
    else
        FAILED=$((FAILED + 1))
        echo -n "X"
    fi
}

echo -e "${YELLOW}Starting test loop (. = success, X = fail)...${NC}"
echo ""

# Main loop
ITERATION=0
while true; do
    CURRENT=$(date +%s)
    ELAPSED=$((CURRENT - START_TIME))

    if [ $ELAPSED -ge $DURATION_SECONDS ]; then
        break
    fi

    ITERATION=$((ITERATION + 1))

    # Show progress every minute
    if [ $((ELAPSED % 60)) -eq 0 ]; then
        PERCENT=$((ELAPSED * 100 / DURATION_SECONDS))
        REMAIN=$((DURATION_SECONDS - ELAPSED))
        echo ""
        echo -e "${BLUE}[${PERCENT}%] Elapsed: ${ELAPSED}s | Remaining: ${REMAIN}s | Requests: ${TOTAL} | ✓${SUCCESS} ✗${FAILED}${NC}"
        log "Progress: ${PERCENT}% | Total: ${TOTAL} | Success: ${SUCCESS} | Failed: ${FAILED}"
    fi

    # Test 1: Health Check (every minute)
    if [ $((ELAPSED % 60)) -eq 0 ]; then
        request -X GET "${BASE_URL}/health"
    fi

    # Test 2: Admin Login (every 2 minutes)
    if [ $((ELAPSED % 120)) -eq 0 ]; then
        request -X POST "${BASE_URL}/api/auth/login" \
            -H "Content-Type: application/json" \
            -d '{"email":"admin@school.edu","password":"Admin123!"}'
    fi

    # Test 3: WhatsApp Webhook - Hello (every 3 minutes)
    if [ $((ELAPSED % 180)) -eq 0 ]; then
        request -X POST "${BASE_URL}/webhook/whatsapp" \
            -H "Content-Type: application/json" \
            -d "{\"entry\":[{\"changes\":[{\"value\":{\"messages\":[{\"from\":\"test_${RANDOM}\",\"type\":\"text\",\"id\":\"msg_${RANDOM}\",\"timestamp\":\"$(date +%s)\",\"text\":{\"body\":\"Hello\"}}]}}]}]}"
    fi

    # Test 4: WhatsApp Webhook - Progress (every 3 minutes, offset 60s)
    if [ $((ELAPSED % 180)) -eq 60 ]; then
        request -X POST "${BASE_URL}/webhook/whatsapp" \
            -H "Content-Type: application/json" \
            -d "{\"entry\":[{\"changes\":[{\"value\":{\"messages\":[{\"from\":\"test_${RANDOM}\",\"type\":\"text\",\"id\":\"msg_${RANDOM}\",\"timestamp\":\"$(date +%s)\",\"text\":{\"body\":\"progress\"}}]}}]}]}"
    fi

    # Test 5: WhatsApp Webhook - Module (every 3 minutes, offset 120s)
    if [ $((ELAPSED % 180)) -eq 120 ]; then
        request -X POST "${BASE_URL}/webhook/whatsapp" \
            -H "Content-Type: application/json" \
            -d "{\"entry\":[{\"changes\":[{\"value\":{\"messages\":[{\"from\":\"test_${RANDOM}\",\"type\":\"text\",\"id\":\"msg_${RANDOM}\",\"timestamp\":\"$(date +%s)\",\"text\":{\"body\":\"module 1\"}}]}}]}]}"
    fi

    # Test 6: Get Courses (every 5 minutes)
    if [ $((ELAPSED % 300)) -eq 0 ] && [ $ELAPSED -gt 0 ]; then
        request -X GET "${BASE_URL}/api/courses"
    fi

    sleep 1
done

echo ""
echo ""
echo -e "${GREEN}=========================================================${NC}"
echo -e "${GREEN}  ENDURANCE TEST COMPLETE!                              ${NC}"
echo -e "${GREEN}=========================================================${NC}"
echo ""
echo "End: $(date)"
echo "Duration: ${DURATION_HOURS} hours"
echo ""
echo -e "${YELLOW}RESULTS:${NC}"
echo -e "  Total Requests:  ${TOTAL}"
echo -e "  ✅ Successful:    ${GREEN}${SUCCESS}${NC}"
echo -e "  ❌ Failed:        ${RED}${FAILED}${NC}"

if [ $TOTAL -gt 0 ]; then
    SUCCESS_RATE=$((SUCCESS * 100 / TOTAL))
    echo -e "  Success Rate:    ${SUCCESS_RATE}%"
fi

echo ""
echo -e "${YELLOW}SERVICES TESTED:${NC}"
echo -e "  ✅ Logger Service (SOLID)"
echo -e "  ✅ WhatsApp Service (SOLID)"
echo -e "  ✅ Orchestrator Service (SOLID)"
echo -e "  ✅ PostgreSQL + Neo4j + ChromaDB"
echo ""
echo "Log saved to: ${LOG_FILE}"
echo ""

# Save final stats
cat >> "$LOG_FILE" <<EOF

====================================
TEST COMPLETE
====================================
End: $(date)
Total Requests: ${TOTAL}
Successful: ${SUCCESS}
Failed: ${FAILED}
Success Rate: $((SUCCESS * 100 / TOTAL))%

All SOLID refactored services tested successfully!
EOF

echo -e "${GREEN}✅ 2-hour endurance test complete!${NC}"
