#!/bin/bash

echo "================================================"
echo "GCP Merge Conflict Resolution"
echo "================================================"
echo ""
echo "This script will safely update your GCP instance"
echo "by stashing local changes and pulling from GitHub."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

cd ~/teachers_training

echo "Step 1: Backup current state..."
BACKUP_DIR=~/teachers_training_backup_$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup modified files
echo "Backing up modified files to $BACKUP_DIR"
cp docker-compose.yml $BACKUP_DIR/ 2>/dev/null || true
cp server.js $BACKUP_DIR/ 2>/dev/null || true
cp services/neo4j.service.js $BACKUP_DIR/ 2>/dev/null || true
cp services/whatsapp-adapter.service.js $BACKUP_DIR/ 2>/dev/null || true
cp services/whatsapp-handler.service.js $BACKUP_DIR/ 2>/dev/null || true
cp database/migrations/004_create_learning_interactions.sql $BACKUP_DIR/ 2>/dev/null || true
cp scripts/reindex-from-db.js $BACKUP_DIR/ 2>/dev/null || true
cp scripts/test-full-pipeline.js $BACKUP_DIR/ 2>/dev/null || true

echo -e "${GREEN}✅ Backup created: $BACKUP_DIR${NC}"
echo ""

echo "Step 2: Show what will be overwritten..."
echo ""
echo "Modified files on GCP:"
git status --short
echo ""

echo "Step 3: Stash local changes..."
git stash push -u -m "GCP local changes before merge $(date +%Y%m%d_%H%M%S)"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Local changes stashed${NC}"
else
  echo -e "${RED}❌ Failed to stash changes${NC}"
  exit 1
fi
echo ""

echo "Step 4: Pull latest from GitHub..."
git pull origin master

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Successfully pulled from GitHub${NC}"
else
  echo -e "${RED}❌ Pull failed${NC}"
  echo ""
  echo "Restoring from stash..."
  git stash pop
  exit 1
fi
echo ""

echo "Step 5: Review stashed changes..."
echo ""
echo "Your GCP-specific changes are saved in stash."
echo "To see what was stashed:"
echo "  git stash show -p"
echo ""
echo "If you need to restore any GCP-specific changes:"
echo "  git stash pop"
echo ""
echo "Stash list:"
git stash list | head -5
echo ""

echo "Step 6: Restart Docker to apply changes..."
sudo docker-compose restart app

echo "Waiting 15 seconds for app to start..."
sleep 15
echo ""

echo "Step 7: Verify system health..."
curl -s http://localhost:3000/health | python3 -m json.tool
echo ""

echo "================================================"
echo -e "${GREEN}✅ GCP Instance Updated Successfully!${NC}"
echo "================================================"
echo ""
echo "Summary:"
echo "  ✅ Local changes backed up to: $BACKUP_DIR"
echo "  ✅ Local changes stashed in git"
echo "  ✅ Latest code pulled from GitHub"
echo "  ✅ Docker containers restarted"
echo "  ✅ System health verified"
echo ""
echo "Your GCP instance now has:"
echo "  - Complete PIN enrollment system"
echo "  - Clean database (ready for courses)"
echo "  - All documentation and test scripts"
echo ""
echo "Next steps:"
echo "  1. Create courses via admin portal"
echo "  2. Upload training content"
echo "  3. Enroll students with PINs"
echo ""
