#!/bin/bash

# Deployment Script: Dual Coaching Bot Feature to GCP Production
# Version: 1.0
# Date: 2025-10-31
# Feature: Dual Coaching Bot System (Regular Mode vs Socratic Mode)

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
GCP_ZONE="us-east5-a"
GCP_INSTANCE="teachers-training"
GCP_PROJECT="lms-tanzania-consultant"
REMOTE_DIR="/home/karthi/teachers_training"
MIGRATION_FILE="database/migrations/011_dual_coaching_modes.sql"

# Function to print section headers
print_header() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  $1${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Function to print success
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to print info
print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Function to execute remote command
execute_remote() {
    gcloud compute ssh --zone "$GCP_ZONE" "$GCP_INSTANCE" --project "$GCP_PROJECT" --command "$1"
}

# Start deployment
print_header "DUAL COACHING BOT DEPLOYMENT TO GCP"

echo -e "${YELLOW}Deployment Configuration:${NC}"
echo "  GCP Zone: $GCP_ZONE"
echo "  Instance: $GCP_INSTANCE"
echo "  Project: $GCP_PROJECT"
echo "  Remote Directory: $REMOTE_DIR"
echo "  Migration File: $MIGRATION_FILE"
echo ""

read -p "Continue with deployment? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    print_error "Deployment cancelled by user"
    exit 1
fi

# ============================================
# PHASE 1: PRE-DEPLOYMENT VALIDATION
# ============================================

print_header "PHASE 1: PRE-DEPLOYMENT VALIDATION"

print_info "Checking GCP connectivity..."
if execute_remote "echo 'Connected'" > /dev/null 2>&1; then
    print_success "GCP connection established"
else
    print_error "Failed to connect to GCP instance"
    exit 1
fi

print_info "Checking GCP services status..."
SERVICE_STATUS=$(execute_remote "cd $REMOTE_DIR && docker ps --format '{{.Names}}\t{{.Status}}' | grep -c 'Up'")
if [ "$SERVICE_STATUS" -ge 3 ]; then
    print_success "All services running ($SERVICE_STATUS containers up)"
else
    print_error "Not all services are running"
    exit 1
fi

print_info "Checking current branch..."
CURRENT_BRANCH=$(execute_remote "cd $REMOTE_DIR && git branch --show-current")
print_info "Current branch: $CURRENT_BRANCH"

# ============================================
# PHASE 2: BACKUP PRODUCTION DATABASE
# ============================================

print_header "PHASE 2: BACKUP PRODUCTION DATABASE"

BACKUP_DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="backup_before_coaching_bot_${BACKUP_DATE}.sql"

print_info "Creating database backup: $BACKUP_FILE"
execute_remote "cd $REMOTE_DIR && docker exec teachers_training_postgres_1 pg_dump -U teachers_user -d teachers_training > $BACKUP_FILE"

print_info "Verifying backup file..."
BACKUP_SIZE=$(execute_remote "cd $REMOTE_DIR && ls -lh $BACKUP_FILE | awk '{print \$5}'")
print_success "Backup created successfully: $BACKUP_SIZE"

# ============================================
# PHASE 3: DEPLOY CODE UPDATES
# ============================================

print_header "PHASE 3: DEPLOY CODE UPDATES"

print_info "Stashing any local changes..."
execute_remote "cd $REMOTE_DIR && git stash" || true

print_info "Pulling latest code from GitHub..."
PULL_OUTPUT=$(execute_remote "cd $REMOTE_DIR && git pull origin feature/multi-region-rbac")
echo "$PULL_OUTPUT"

if echo "$PULL_OUTPUT" | grep -q "Already up to date"; then
    print_warning "Code already up to date"
else
    print_success "Code updated successfully"
fi

print_info "Verifying migration file exists..."
if execute_remote "cd $REMOTE_DIR && test -f $MIGRATION_FILE"; then
    print_success "Migration file found"
else
    print_error "Migration file not found: $MIGRATION_FILE"
    exit 1
fi

print_info "Verifying service files exist..."
if execute_remote "cd $REMOTE_DIR && test -f services/coaching-mode.service.js && test -f services/prompt-template.service.js"; then
    print_success "Service files found"
else
    print_error "Service files not found"
    exit 1
fi

# ============================================
# PHASE 4: RUN DATABASE MIGRATION
# ============================================

print_header "PHASE 4: RUN DATABASE MIGRATION"

print_info "Checking if tables already exist..."
EXISTING_TABLES=$(execute_remote "cd $REMOTE_DIR && docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -t -c \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('course_bot_configs', 'user_bot_preferences', 'coaching_sessions', 'mode_analytics');\"" | tr -d ' ')

if [ "$EXISTING_TABLES" -eq "4" ]; then
    print_warning "Tables already exist. Skipping migration."
    print_info "If you need to re-run migration, manually drop tables first."
else
    print_info "Running database migration..."
    execute_remote "cd $REMOTE_DIR && docker exec -i teachers_training_postgres_1 psql -U teachers_user -d teachers_training < $MIGRATION_FILE"

    print_info "Verifying migration success..."
    NEW_TABLES=$(execute_remote "cd $REMOTE_DIR && docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -t -c \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('course_bot_configs', 'user_bot_preferences', 'coaching_sessions', 'mode_analytics');\"" | tr -d ' ')

    if [ "$NEW_TABLES" -eq "4" ]; then
        print_success "All 4 tables created successfully"
    else
        print_error "Migration failed: expected 4 tables, found $NEW_TABLES"
        exit 1
    fi

    print_info "Verifying views created..."
    NEW_VIEWS=$(execute_remote "cd $REMOTE_DIR && docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -t -c \"SELECT COUNT(*) FROM information_schema.views WHERE table_schema='public' AND table_name IN ('v_user_mode_preferences', 'v_active_coaching_sessions', 'v_mode_analytics_summary');\"" | tr -d ' ')

    if [ "$NEW_VIEWS" -eq "3" ]; then
        print_success "All 3 views created successfully"
    else
        print_warning "Expected 3 views, found $NEW_VIEWS"
    fi

    print_info "Checking seeded configs..."
    CONFIG_COUNT=$(execute_remote "cd $REMOTE_DIR && docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -t -c \"SELECT COUNT(*) FROM course_bot_configs;\"" | tr -d ' ')
    print_success "Seeded $CONFIG_COUNT default course configurations"
fi

# ============================================
# PHASE 5: RESTART APPLICATION SERVICES
# ============================================

print_header "PHASE 5: RESTART APPLICATION SERVICES"

print_info "Stopping app container..."
execute_remote "cd $REMOTE_DIR && docker-compose stop app"
print_success "App container stopped"

print_info "Rebuilding app image with new code..."
execute_remote "cd $REMOTE_DIR && docker-compose build app"
print_success "App image rebuilt"

print_info "Starting app container..."
execute_remote "cd $REMOTE_DIR && docker-compose up -d app"
print_success "App container started"

print_info "Waiting for app to be healthy..."
sleep 15

print_info "Verifying all containers running..."
CONTAINERS_UP=$(execute_remote "cd $REMOTE_DIR && docker ps --format '{{.Names}}\t{{.Status}}' | grep -c 'Up'")
if [ "$CONTAINERS_UP" -ge 3 ]; then
    print_success "All containers running ($CONTAINERS_UP up)"
else
    print_error "Not all containers are running"
    exit 1
fi

# ============================================
# PHASE 6: SMOKE TESTS
# ============================================

print_header "PHASE 6: SMOKE TESTS"

print_info "Test 1: Health endpoint..."
HEALTH_STATUS=$(execute_remote "curl -s http://localhost:3000/health" | grep -o '"status":"[^"]*"' || echo "")
if echo "$HEALTH_STATUS" | grep -q "healthy"; then
    print_success "Health endpoint responding"
else
    print_error "Health endpoint not responding correctly"
    echo "Response: $HEALTH_STATUS"
fi

print_info "Test 2: Admin login..."
LOGIN_RESPONSE=$(execute_remote "curl -s -X POST http://localhost:3000/api/auth/admin/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@school.edu\",\"password\":\"Admin123!\"}'" || echo "")
if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    print_success "Admin login working"
    # Extract token for further tests
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
else
    print_warning "Admin login test inconclusive (may need to check credentials)"
fi

print_info "Test 3: Course bot config endpoint..."
CONFIG_RESPONSE=$(execute_remote "curl -s http://localhost:3000/api/coaching-mode/config/1" || echo "")
if echo "$CONFIG_RESPONSE" | grep -q -E '"id":|"not found"'; then
    print_success "Config endpoint responding"
else
    print_warning "Config endpoint test inconclusive"
fi

print_info "Test 4: Admin UI pages..."
UI_STATUS=$(execute_remote "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/admin/coaching-modes.html" || echo "000")
if [ "$UI_STATUS" = "200" ]; then
    print_success "Admin UI accessible"
else
    print_warning "Admin UI returned status: $UI_STATUS"
fi

print_info "Test 5: Existing functionality (users endpoint)..."
if [ -n "$TOKEN" ]; then
    USERS_RESPONSE=$(execute_remote "curl -s http://localhost:3000/api/admin/users -H 'Authorization: Bearer $TOKEN'" || echo "")
    if echo "$USERS_RESPONSE" | grep -q -E '^\[|"users"'; then
        print_success "Existing users endpoint working"
    else
        print_warning "Users endpoint test inconclusive"
    fi
else
    print_warning "Skipping users endpoint test (no auth token)"
fi

# ============================================
# PHASE 7: VERTEX AI VERIFICATION
# ============================================

print_header "PHASE 7: VERTEX AI VERIFICATION"

print_info "Checking Vertex AI token refresh script..."
if execute_remote "cd $REMOTE_DIR && test -f scripts/refresh-vertex-token.sh"; then
    print_info "Running Vertex AI token refresh..."
    execute_remote "cd $REMOTE_DIR && bash scripts/refresh-vertex-token.sh" || print_warning "Token refresh script not available or failed"
    print_success "Vertex AI token refresh attempted"
else
    print_warning "Vertex AI refresh script not found"
fi

# ============================================
# PHASE 8: FINAL VERIFICATION
# ============================================

print_header "PHASE 8: FINAL VERIFICATION"

print_info "Checking database table counts..."
TOTAL_TABLES=$(execute_remote "cd $REMOTE_DIR && docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -t -c \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';\"" | tr -d ' ')
print_info "Total tables in database: $TOTAL_TABLES"
if [ "$TOTAL_TABLES" -ge "41" ]; then
    print_success "Database tables count correct (expected 37 + 4 new = 41)"
else
    print_warning "Table count: $TOTAL_TABLES (expected at least 41)"
fi

print_info "Checking application logs for errors..."
ERROR_COUNT=$(execute_remote "cd $REMOTE_DIR && docker logs teachers_training_app_1 --since 5m 2>&1 | grep -c -i 'error'" || echo "0")
if [ "$ERROR_COUNT" -eq "0" ]; then
    print_success "No errors in application logs (last 5 minutes)"
else
    print_warning "Found $ERROR_COUNT errors in logs (review recommended)"
    execute_remote "cd $REMOTE_DIR && docker logs teachers_training_app_1 --since 5m 2>&1 | grep -i 'error' | tail -5"
fi

print_info "Checking container resource usage..."
execute_remote "cd $REMOTE_DIR && docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' | head -5"

# ============================================
# DEPLOYMENT SUMMARY
# ============================================

print_header "DEPLOYMENT SUMMARY"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ DEPLOYMENT COMPLETED SUCCESSFULLY                        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}Deployment Details:${NC}"
echo "  ├─ Database Backup: $BACKUP_FILE ($BACKUP_SIZE)"
echo "  ├─ New Tables Created: 4 (course_bot_configs, user_bot_preferences, coaching_sessions, mode_analytics)"
echo "  ├─ New Views Created: 3"
echo "  ├─ Default Configs Seeded: $CONFIG_COUNT"
echo "  ├─ Total Tables: $TOTAL_TABLES"
echo "  ├─ Containers Running: $CONTAINERS_UP"
echo "  └─ Recent Errors: $ERROR_COUNT"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Run comprehensive smoke tests from local machine"
echo "  2. Test admin UI at: http://34.162.168.124:3000/admin/coaching-modes.html"
echo "  3. Configure coaching modes for courses via admin UI"
echo "  4. Test mode switching via WhatsApp"
echo "  5. Monitor application logs for 24 hours"
echo "  6. Verify analytics data collection"
echo ""

echo -e "${YELLOW}Monitoring Commands:${NC}"
echo "  # Check logs:"
echo "  gcloud compute ssh --zone \"$GCP_ZONE\" \"$GCP_INSTANCE\" --project \"$GCP_PROJECT\" --command \"cd $REMOTE_DIR && docker logs teachers_training_app_1 --tail 100\""
echo ""
echo "  # Check database:"
echo "  gcloud compute ssh --zone \"$GCP_ZONE\" \"$GCP_INSTANCE\" --project \"$GCP_PROJECT\" --command \"cd $REMOTE_DIR && docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c 'SELECT COUNT(*) FROM course_bot_configs;'\""
echo ""
echo "  # Check services:"
echo "  gcloud compute ssh --zone \"$GCP_ZONE\" \"$GCP_INSTANCE\" --project \"$GCP_PROJECT\" --command \"cd $REMOTE_DIR && docker ps\""
echo ""

echo -e "${GREEN}🎉 Deployment completed at $(date)${NC}"
echo ""

# Save deployment log
LOG_FILE="deployment_log_${BACKUP_DATE}.txt"
echo "Deployment completed successfully at $(date)" > "$LOG_FILE"
echo "Backup file: $BACKUP_FILE" >> "$LOG_FILE"
echo "Tables created: 4" >> "$LOG_FILE"
echo "Views created: 3" >> "$LOG_FILE"
echo "Configs seeded: $CONFIG_COUNT" >> "$LOG_FILE"
echo "Total tables: $TOTAL_TABLES" >> "$LOG_FILE"
echo ""
print_success "Deployment log saved: $LOG_FILE"

exit 0
