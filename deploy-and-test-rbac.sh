#!/bin/bash

# Complete RBAC Deployment and Testing Script
# This script deploys the RBAC changes and sets up test data

set -e  # Exit on error

echo "=========================================="
echo "RBAC Deployment & Setup Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}📝 Step 1: Pull latest code on GCP...${NC}"
gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant" --command "
  cd /home/karthi/teachers_training && \
  echo '✅ Current directory:' && pwd && \
  echo '' && \
  echo '📥 Pulling latest code...' && \
  git pull origin feature/multi-region-rbac && \
  echo '' && \
  echo '✅ Code updated!'
"

echo ""
echo -e "${BLUE}📝 Step 2: Restart Node.js app...${NC}"
gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant" --command "
  docker exec teachers_training_app_1 sh -c 'pkill -f node' && \
  echo '✅ Node.js restarted!' && \
  sleep 3 && \
  echo '' && \
  echo '📋 Last 10 log lines:' && \
  docker logs teachers_training_app_1 --tail 10
"

echo ""
echo -e "${BLUE}📝 Step 3: Set up database (assign regions)...${NC}"
gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant" --command "
  docker exec -i teachers_training_postgres_1 psql -U teachers_user -d teachers_training << 'EOSQL'
-- Fix Regional Admin role_id and primary_region_id
UPDATE admin_users
SET role_id = 2, primary_region_id = 1
WHERE email = 'test.regional@school.edu';

-- Assign Tanzania region to existing WhatsApp users
UPDATE users
SET primary_region_id = 1
WHERE id <= 5;

-- Verify assignments
SELECT 'ADMIN USERS:' as info;
SELECT id, email, role_id, primary_region_id FROM admin_users WHERE email = 'test.regional@school.edu';

SELECT '' as spacer;
SELECT 'WHATSAPP USERS:' as info;
SELECT id, name, whatsapp_id, primary_region_id FROM users WHERE primary_region_id = 1 LIMIT 10;
EOSQL
"

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${BLUE}📝 Step 4: Running verification tests...${NC}"
echo ""

# Run local tests
./check-users-regions.sh

echo ""
echo "=========================================="
echo -e "${GREEN}✅ DEPLOYMENT SUCCESSFUL!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Test manually in browser:"
echo "     - Super Admin: Lynda@admin.com / Admin123!"
echo "     - Regional Admin: test.regional@school.edu / Test123!"
echo ""
echo "  2. Run automated test:"
echo "     node test-user-management-rbac.js"
echo ""
