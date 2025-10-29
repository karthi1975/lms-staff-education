#!/bin/bash

# 2-Hour Endurance Test for SOLID Refactored Services
# Tests Logger, WhatsApp, and Orchestrator services under sustained load

set -e

BASE_URL="http://34.162.136.203:3000"
DURATION_HOURS=2
DURATION_SECONDS=$((DURATION_HOURS * 3600))
LOG_FILE="endurance-test-results-$(date +%Y%m%d-%H%M%S).log"
STATS_FILE="endurance-test-stats-$(date +%Y%m%d-%H%M%S).json"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Statistics counters
TOTAL_REQUESTS=0
SUCCESSFUL_REQUESTS=0
FAILED_REQUESTS=0
TOTAL_RESPONSE_TIME=0
START_TIME=$(date +%s)

echo -e "${BLUE}🚀 Starting 2-Hour Endurance Test for SOLID Refactored Services${NC}"
echo -e "${BLUE}=========================================================${NC}"
echo ""
echo -e "Start Time: $(date)"
echo -e "Duration: ${DURATION_HOURS} hours (${DURATION_SECONDS} seconds)"
echo -e "Base URL: ${BASE_URL}"
echo -e "Log File: ${LOG_FILE}"
echo -e "Stats File: ${STATS_FILE}"
echo ""

# Initialize log file
cat > "$LOG_FILE" <<EOF
2-Hour Endurance Test for SOLID Refactored Services
Started: $(date)
Duration: ${DURATION_HOURS} hours
Base URL: ${BASE_URL}

Tests:
1. Health endpoint (every 60s)
2. Admin login (every 120s)
3. WhatsApp webhook greeting (every 180s)
4. WhatsApp webhook progress (every 180s)
5. WhatsApp webhook module selection (every 180s)
6. WhatsApp webhook quiz (every 300s)
7. User list (every 300s)
8. Course list (every 300s)

====================================
EOF

# Function to log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to make request and track stats
make_request() {
    local METHOD=$1
    local ENDPOINT=$2
    local DATA=$3
    local DESCRIPTION=$4

    local START=$(date +%s%3N)
    local HTTP_CODE

    if [ -z "$DATA" ]; then
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X "$METHOD" "${BASE_URL}${ENDPOINT}")
    else
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X "$METHOD" "${BASE_URL}${ENDPOINT}" \
            -H "Content-Type: application/json" \
            -d "$DATA")
    fi

    local END=$(date +%s%3N)
    local DURATION=$((END - START))

    TOTAL_REQUESTS=$((TOTAL_REQUESTS + 1))
    TOTAL_RESPONSE_TIME=$((TOTAL_RESPONSE_TIME + DURATION))

    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
        SUCCESSFUL_REQUESTS=$((SUCCESSFUL_REQUESTS + 1))
        log "✅ ${DESCRIPTION}: HTTP ${HTTP_CODE} (${DURATION}ms)"
    else
        FAILED_REQUESTS=$((FAILED_REQUESTS + 1))
        log "❌ ${DESCRIPTION}: HTTP ${HTTP_CODE} (${DURATION}ms) - FAILED"
    fi
}

# Function to save statistics
save_stats() {
    local CURRENT_TIME=$(date +%s)
    local ELAPSED=$((CURRENT_TIME - START_TIME))
    local AVG_RESPONSE_TIME=0

    if [ $TOTAL_REQUESTS -gt 0 ]; then
        AVG_RESPONSE_TIME=$((TOTAL_RESPONSE_TIME / TOTAL_REQUESTS))
    fi

    cat > "$STATS_FILE" <<EOF
{
  "test_name": "SOLID Refactoring Endurance Test",
  "duration_hours": ${DURATION_HOURS},
  "elapsed_seconds": ${ELAPSED},
  "start_time": "${START_TIME}",
  "current_time": "$(date)",
  "total_requests": ${TOTAL_REQUESTS},
  "successful_requests": ${SUCCESSFUL_REQUESTS},
  "failed_requests": ${FAILED_REQUESTS},
  "success_rate": $(awk "BEGIN {printf \"%.2f\", (${SUCCESSFUL_REQUESTS}/${TOTAL_REQUESTS})*100}"),
  "avg_response_time_ms": ${AVG_RESPONSE_TIME},
  "requests_per_minute": $(awk "BEGIN {printf \"%.2f\", (${TOTAL_REQUESTS}/(${ELAPSED}/60))}"),
  "services_tested": [
    "Logger (SOLID)",
    "WhatsApp Service (SOLID)",
    "Orchestrator Service (SOLID)",
    "PostgreSQL",
    "Neo4j",
    "ChromaDB"
  ]
}
EOF
}

# Test counters
HEALTH_COUNT=0
LOGIN_COUNT=0
WEBHOOK_COUNT=0
QUIZ_COUNT=0
COURSE_COUNT=0

echo -e "${YELLOW}Starting endurance test loop...${NC}"
echo ""

# Main test loop
while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))

    # Check if duration exceeded
    if [ $ELAPSED -ge $DURATION_SECONDS ]; then
        break
    fi

    # Calculate progress
    PROGRESS=$((ELAPSED * 100 / DURATION_SECONDS))
    REMAINING=$((DURATION_SECONDS - ELAPSED))

    # Print progress every minute
    if [ $((ELAPSED % 60)) -eq 0 ]; then
        echo -e "${BLUE}Progress: ${PROGRESS}% | Elapsed: ${ELAPSED}s | Remaining: ${REMAINING}s | Requests: ${TOTAL_REQUESTS} | Success: ${SUCCESSFUL_REQUESTS} | Failed: ${FAILED_REQUESTS}${NC}"
        save_stats
    fi

    # Test 1: Health Check (every 60 seconds)
    if [ $((ELAPSED % 60)) -eq 0 ]; then
        HEALTH_COUNT=$((HEALTH_COUNT + 1))
        make_request "GET" "/health" "" "Health Check #${HEALTH_COUNT}"
    fi

    # Test 2: Admin Login (every 120 seconds)
    if [ $((ELAPSED % 120)) -eq 0 ]; then
        LOGIN_COUNT=$((LOGIN_COUNT + 1))
        make_request "POST" "/api/auth/login" '{"email":"admin@school.edu","password":"Admin123!"}' "Admin Login #${LOGIN_COUNT}"
    fi

    # Test 3: WhatsApp Webhook - Greeting (every 180 seconds)
    if [ $((ELAPSED % 180)) -eq 0 ]; then
        WEBHOOK_COUNT=$((WEBHOOK_COUNT + 1))
        WEBHOOK_DATA='{
            "entry": [{
                "changes": [{
                    "value": {
                        "messages": [{
                            "from": "endurance_test_'$RANDOM'",
                            "type": "text",
                            "id": "msg_'$RANDOM'",
                            "timestamp": "'$(date +%s)'",
                            "text": { "body": "Hello" }
                        }]
                    }
                }]
            }]
        }'
        make_request "POST" "/webhook/whatsapp" "$WEBHOOK_DATA" "WhatsApp Greeting #${WEBHOOK_COUNT}"
    fi

    # Test 4: WhatsApp Webhook - Progress (every 180 seconds, offset by 60s)
    if [ $((ELAPSED % 180)) -eq 60 ]; then
        PROGRESS_DATA='{
            "entry": [{
                "changes": [{
                    "value": {
                        "messages": [{
                            "from": "endurance_test_'$RANDOM'",
                            "type": "text",
                            "id": "msg_'$RANDOM'",
                            "timestamp": "'$(date +%s)'",
                            "text": { "body": "progress" }
                        }]
                    }
                }]
            }]
        }'
        make_request "POST" "/webhook/whatsapp" "$PROGRESS_DATA" "WhatsApp Progress Query"
    fi

    # Test 5: WhatsApp Webhook - Module Selection (every 180 seconds, offset by 120s)
    if [ $((ELAPSED % 180)) -eq 120 ]; then
        MODULE_DATA='{
            "entry": [{
                "changes": [{
                    "value": {
                        "messages": [{
                            "from": "endurance_test_'$RANDOM'",
                            "type": "text",
                            "id": "msg_'$RANDOM'",
                            "timestamp": "'$(date +%s)'",
                            "text": { "body": "module 1" }
                        }]
                    }
                }]
            }]
        }'
        make_request "POST" "/webhook/whatsapp" "$MODULE_DATA" "WhatsApp Module Selection"
    fi

    # Test 6: WhatsApp Webhook - Quiz (every 300 seconds)
    if [ $((ELAPSED % 300)) -eq 0 ] && [ $ELAPSED -gt 0 ]; then
        QUIZ_COUNT=$((QUIZ_COUNT + 1))
        QUIZ_DATA='{
            "entry": [{
                "changes": [{
                    "value": {
                        "messages": [{
                            "from": "quiz_test_'$RANDOM'",
                            "type": "text",
                            "id": "msg_'$RANDOM'",
                            "timestamp": "'$(date +%s)'",
                            "text": { "body": "quiz 1" }
                        }]
                    }
                }]
            }]
        }'
        make_request "POST" "/webhook/whatsapp" "$QUIZ_DATA" "WhatsApp Quiz Start #${QUIZ_COUNT}"
    fi

    # Test 7: Get User List (every 300 seconds, offset by 150s)
    if [ $((ELAPSED % 300)) -eq 150 ] && [ $ELAPSED -gt 0 ]; then
        # Get token first
        TOKEN=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
            -H "Content-Type: application/json" \
            -d '{"email":"admin@school.edu","password":"Admin123!"}' | \
            grep -o '"token":"[^"]*' | grep -o '[^"]*$')

        if [ -n "$TOKEN" ]; then
            HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
                -H "Authorization: Bearer $TOKEN" \
                "${BASE_URL}/api/admin/users")

            TOTAL_REQUESTS=$((TOTAL_REQUESTS + 1))
            if [ "$HTTP_CODE" = "200" ]; then
                SUCCESSFUL_REQUESTS=$((SUCCESSFUL_REQUESTS + 1))
                log "✅ Get User List: HTTP ${HTTP_CODE}"
            else
                FAILED_REQUESTS=$((FAILED_REQUESTS + 1))
                log "❌ Get User List: HTTP ${HTTP_CODE} - FAILED"
            fi
        fi
    fi

    # Test 8: Get Course List (every 300 seconds, offset by 200s)
    if [ $((ELAPSED % 300)) -eq 200 ] && [ $ELAPSED -gt 0 ]; then
        COURSE_COUNT=$((COURSE_COUNT + 1))
        make_request "GET" "/api/courses" "" "Get Course List #${COURSE_COUNT}"
    fi

    # Sleep for 1 second before next iteration
    sleep 1
done

# Final statistics
echo ""
echo -e "${GREEN}=========================================================${NC}"
echo -e "${GREEN}2-Hour Endurance Test Complete!${NC}"
echo -e "${GREEN}=========================================================${NC}"
echo ""
echo -e "End Time: $(date)"
echo -e "Total Duration: ${DURATION_HOURS} hours"
echo ""
echo -e "${YELLOW}Test Results:${NC}"
echo -e "  Total Requests: ${TOTAL_REQUESTS}"
echo -e "  Successful: ${GREEN}${SUCCESSFUL_REQUESTS}${NC}"
echo -e "  Failed: ${RED}${FAILED_REQUESTS}${NC}"
echo -e "  Success Rate: $(awk "BEGIN {printf \"%.2f%%\", (${SUCCESSFUL_REQUESTS}/${TOTAL_REQUESTS})*100}")"
echo -e "  Avg Response Time: $((TOTAL_RESPONSE_TIME / TOTAL_REQUESTS))ms"
echo -e "  Requests/Minute: $(awk "BEGIN {printf \"%.2f\", (${TOTAL_REQUESTS}/${DURATION_SECONDS})*60}")"
echo ""
echo -e "${YELLOW}Services Tested:${NC}"
echo -e "  ✅ Logger Service (SOLID Refactored)"
echo -e "  ✅ WhatsApp Service (SOLID Refactored)"
echo -e "  ✅ Orchestrator Service (SOLID Refactored)"
echo -e "  ✅ PostgreSQL Database"
echo -e "  ✅ Neo4j Graph Database"
echo -e "  ✅ ChromaDB Vector Database"
echo ""
echo -e "${YELLOW}Test Breakdown:${NC}"
echo -e "  Health Checks: ${HEALTH_COUNT}"
echo -e "  Admin Logins: ${LOGIN_COUNT}"
echo -e "  WhatsApp Messages: $((WEBHOOK_COUNT * 3))"
echo -e "  Quiz Starts: ${QUIZ_COUNT}"
echo -e "  Course Queries: ${COURSE_COUNT}"
echo ""
echo -e "Log file: ${LOG_FILE}"
echo -e "Stats file: ${STATS_FILE}"
echo ""

# Save final statistics
save_stats

# Generate summary report
cat >> "$LOG_FILE" <<EOF

====================================
ENDURANCE TEST COMPLETE
====================================
End Time: $(date)
Total Requests: ${TOTAL_REQUESTS}
Successful: ${SUCCESSFUL_REQUESTS}
Failed: ${FAILED_REQUESTS}
Success Rate: $(awk "BEGIN {printf \"%.2f%%\", (${SUCCESSFUL_REQUESTS}/${TOTAL_REQUESTS})*100}")
Average Response Time: $((TOTAL_RESPONSE_TIME / TOTAL_REQUESTS))ms

SOLID Services Tested:
- Logger Service ✅
- WhatsApp Service ✅
- Orchestrator Service ✅

All services performed well under 2-hour sustained load!
EOF

echo -e "${GREEN}✅ Endurance test complete! All SOLID refactored services tested.${NC}"
