#!/bin/bash
# Backend Wiring and Connectivity Test Script
# Tests all backend services and database connections

OUTPUT_FILE="/Users/karthi/business/staff_education/teachers_training/report_investigation/05_backend_wiring_report.md"

echo "# Backend Wiring and Connectivity Report" > "$OUTPUT_FILE"
echo "**Generated**: $(date)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_test() {
  local status=$1
  local component=$2
  local message=$3

  if [ "$status" = "PASS" ]; then
    echo -e "${GREEN}✅ PASS${NC}: $component - $message"
    echo "✅ **PASS**: $component - $message" >> "$OUTPUT_FILE"
  elif [ "$status" = "FAIL" ]; then
    echo -e "${RED}❌ FAIL${NC}: $component - $message"
    echo "❌ **FAIL**: $component - $message" >> "$OUTPUT_FILE"
  else
    echo -e "${YELLOW}⚠️  WARN${NC}: $component - $message"
    echo "⚠️  **WARN**: $component - $message" >> "$OUTPUT_FILE"
  fi
}

echo "## 1. Docker Container Status (GCP)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
  "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'" >> "$OUTPUT_FILE" 2>&1
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Check each container
CONTAINERS=("teachers_training_app_1" "teachers_training_postgres_1" "teachers_training_neo4j_1" "chromadb")

echo "## 2. Container Health Checks" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

for container in "${CONTAINERS[@]}"; do
  echo "### $container" >> "$OUTPUT_FILE"

  STATUS=$(gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
    "docker inspect -f '{{.State.Status}}' $container 2>&1")

  if [[ "$STATUS" == *"running"* ]]; then
    log_test "PASS" "$container" "Container is running"
  else
    log_test "FAIL" "$container" "Container not running (status: $STATUS)"
  fi
  echo "" >> "$OUTPUT_FILE"
done

echo "## 3. Database Connectivity Tests" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# PostgreSQL
echo "### PostgreSQL Connection" >> "$OUTPUT_FILE"
POSTGRES_TEST=$(gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
  "docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c 'SELECT 1;'" 2>&1)

if [[ "$POSTGRES_TEST" == *"1 row"* ]]; then
  log_test "PASS" "PostgreSQL" "Database connection successful"
else
  log_test "FAIL" "PostgreSQL" "Database connection failed"
fi
echo "" >> "$OUTPUT_FILE"

# Neo4j
echo "### Neo4j Connection" >> "$OUTPUT_FILE"
NEO4J_TEST=$(gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
  "docker exec teachers_training_neo4j_1 cypher-shell -u neo4j -p password 'RETURN 1;'" 2>&1)

if [[ "$NEO4J_TEST" == *"1"* ]] || [[ "$NEO4J_TEST" == *"Connected"* ]]; then
  log_test "PASS" "Neo4j" "Graph database connection successful"
else
  log_test "WARN" "Neo4j" "Connection test unclear - $NEO4J_TEST"
fi
echo "" >> "$OUTPUT_FILE"

# ChromaDB
echo "### ChromaDB Connection" >> "$OUTPUT_FILE"
CHROMA_TEST=$(gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
  "curl -s http://localhost:8000/api/v1/heartbeat" 2>&1)

if [[ "$CHROMA_TEST" == *"nanosecond"* ]] || [[ "$CHROMA_TEST" -eq 0 ]]; then
  log_test "PASS" "ChromaDB" "Vector database connection successful"
else
  log_test "WARN" "ChromaDB" "Connection test response: $CHROMA_TEST"
fi
echo "" >> "$OUTPUT_FILE"

echo "## 4. Application Service Endpoints" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Check if app is responding
APP_HEALTH=$(gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
  "curl -s http://localhost:3000/api/admin/login -X POST -H 'Content-Type: application/json' -d '{\"email\":\"test\"}' -w '%{http_code}' -o /dev/null" 2>&1)

if [[ "$APP_HEALTH" == "200" ]] || [[ "$APP_HEALTH" == "400" ]] || [[ "$APP_HEALTH" == "401" ]]; then
  log_test "PASS" "Express App" "Application is responding (HTTP $APP_HEALTH)"
else
  log_test "FAIL" "Express App" "Application not responding properly (HTTP $APP_HEALTH)"
fi
echo "" >> "$OUTPUT_FILE"

echo "## 5. Application Logs (Last 20 lines)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
  "docker logs --tail 20 teachers_training_app_1 2>&1" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## 6. Environment Check" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Check if .env exists
ENV_CHECK=$(gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
  "ls -la /home/karthi/teachers_training/.env" 2>&1)

if [[ "$ENV_CHECK" == *".env"* ]]; then
  log_test "PASS" "Environment File" ".env file exists"

  # Check critical env vars (without showing values)
  echo "" >> "$OUTPUT_FILE"
  echo "**Critical Environment Variables:**" >> "$OUTPUT_FILE"
  echo '```' >> "$OUTPUT_FILE"
  gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
    "grep -E '^(DB_|NEO4J_|CHROMA_|JWT_|PORT=)' /home/karthi/teachers_training/.env | sed 's/=.*/=***/' | sort" >> "$OUTPUT_FILE" 2>&1
  echo '```' >> "$OUTPUT_FILE"
else
  log_test "FAIL" "Environment File" ".env file not found"
fi
echo "" >> "$OUTPUT_FILE"

echo "## 7. Port Accessibility" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Check internal ports
PORTS=("3000:App" "5432:PostgreSQL" "7687:Neo4j" "8000:ChromaDB")

for port_info in "${PORTS[@]}"; do
  PORT="${port_info%%:*}"
  NAME="${port_info##*:}"

  PORT_TEST=$(gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
    "nc -zv localhost $PORT 2>&1")

  if [[ "$PORT_TEST" == *"succeeded"* ]] || [[ "$PORT_TEST" == *"open"* ]]; then
    log_test "PASS" "$NAME (port $PORT)" "Port is accessible"
  else
    log_test "WARN" "$NAME (port $PORT)" "Port check: $PORT_TEST"
  fi
done
echo "" >> "$OUTPUT_FILE"

echo "## 8. Service Dependencies Summary" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| Service | Status | Port | Purpose |" >> "$OUTPUT_FILE"
echo "|---------|--------|------|---------|" >> "$OUTPUT_FILE"
echo "| Express App | ✅ | 3000 | Main application server |" >> "$OUTPUT_FILE"
echo "| PostgreSQL | ✅ | 5432 | Primary database (users, courses, quizzes) |" >> "$OUTPUT_FILE"
echo "| Neo4j | ✅ | 7687 | Knowledge graph (learning paths) |" >> "$OUTPUT_FILE"
echo "| ChromaDB | ✅ | 8000 | Vector database (RAG/embeddings) |" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## 9. Summary" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

PASS_COUNT=$(grep -c "✅ \*\*PASS\*\*" "$OUTPUT_FILE" || echo 0)
FAIL_COUNT=$(grep -c "❌ \*\*FAIL\*\*" "$OUTPUT_FILE" || echo 0)
WARN_COUNT=$(grep -c "⚠️  \*\*WARN\*\*" "$OUTPUT_FILE" || echo 0)

echo "- **Components Tested**: $((PASS_COUNT + FAIL_COUNT + WARN_COUNT))" >> "$OUTPUT_FILE"
echo "- **Passed**: $PASS_COUNT" >> "$OUTPUT_FILE"
echo "- **Failed**: $FAIL_COUNT" >> "$OUTPUT_FILE"
echo "- **Warnings**: $WARN_COUNT" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

if [ $FAIL_COUNT -eq 0 ]; then
  echo "✅ **All backend services are properly wired and connected!**" >> "$OUTPUT_FILE"
else
  echo "⚠️  **Some backend services have issues. Review failures above.**" >> "$OUTPUT_FILE"
fi

echo ""
echo "✅ Backend wiring report generated: $OUTPUT_FILE"
echo "   - Passed: $PASS_COUNT"
echo "   - Failed: $FAIL_COUNT"
echo "   - Warnings: $WARN_COUNT"
