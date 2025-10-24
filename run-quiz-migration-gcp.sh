#!/bin/bash
# Run quiz schema migration on GCP

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Running quiz schema migration on GCP...${NC}"

# Copy migration file to GCP
gcloud compute scp database/migration_007_fix_quiz_schema.sql \
  teachers-training:/home/karthi/teachers_training/database/migration_007_fix_quiz_schema.sql \
  --zone="us-east5-a"

# Execute migration
gcloud compute ssh teachers-training --zone="us-east5-a" --command="
  cd /home/karthi/teachers_training &&
  docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -f /docker-entrypoint-initdb.d/migration_007_fix_quiz_schema.sql
"

echo -e "${GREEN}✅ Migration complete!${NC}"
