#!/bin/bash
# SQL Migrations Verification Script

OUTPUT_FILE="/Users/karthi/business/staff_education/teachers_training/report_investigation/04_migrations_verification_report.md"

echo "# SQL Migrations Verification Report" > "$OUTPUT_FILE"
echo "**Generated**: $(date)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## 1. Available Migration Files" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "### Main Database Migrations" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
ls -lh /Users/karthi/business/staff_education/teachers_training/database/*.sql >> "$OUTPUT_FILE" 2>&1
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "### Database Migrations Folder" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
ls -lh /Users/karthi/business/staff_education/teachers_training/database/migrations/*.sql >> "$OUTPUT_FILE" 2>&1
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "### Migrations Folder (Root)" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
ls -lh /Users/karthi/business/staff_education/teachers_training/migrations/*.sql >> "$OUTPUT_FILE" 2>&1
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## 2. Current Database Tables (GCP)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
  "docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c \"
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;\"" >> "$OUTPUT_FILE" 2>&1
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## 3. Critical Tables Verification" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Check critical tables exist
CRITICAL_TABLES=(
  "users"
  "admin_users"
  "courses"
  "modules"
  "quizzes"
  "quiz_questions"
  "quiz_attempts"
  "user_progress"
  "enrollment_history"
  "chat_history"
  "conversation_context"
  "course_content"
)

for table in "${CRITICAL_TABLES[@]}"; do
  echo "### Table: \`$table\`" >> "$OUTPUT_FILE"
  
  EXISTS=$(gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
    "docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -t -c \"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '$table');\"" 2>&1 | grep -o 't\|f')
  
  if [ "$EXISTS" = "t" ]; then
    echo "- **Status**: ✅ Exists" >> "$OUTPUT_FILE"
    
    # Get column count
    COL_COUNT=$(gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
      "docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -t -c \"SELECT COUNT(*) FROM information_schema.columns WHERE table_name = '$table';\"" 2>&1 | tr -d ' ')
    echo "- **Columns**: $COL_COUNT" >> "$OUTPUT_FILE"
    
    # Get row count
    ROW_COUNT=$(gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
      "docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -t -c \"SELECT COUNT(*) FROM $table;\"" 2>&1 | tr -d ' ')
    echo "- **Rows**: $ROW_COUNT" >> "$OUTPUT_FILE"
  else
    echo "- **Status**: ❌ Missing" >> "$OUTPUT_FILE"
  fi
  echo "" >> "$OUTPUT_FILE"
done

echo "## 4. Enrollment System Columns Check" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Verifying all enrollment columns exist in users table:" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
  "docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c \"
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('enrollment_pin', 'enrollment_status', 'pin_attempts',
                       'pin_expires_at', 'enrolled_by', 'enrolled_at', 'is_verified')
ORDER BY column_name;\"" >> "$OUTPUT_FILE" 2>&1
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## 5. Quiz System Columns Check" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Verifying quiz_questions columns match code expectations:" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
  "docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c '\d quiz_questions'" >> "$OUTPUT_FILE" 2>&1
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## 6. Recommendations" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Based on verification:" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Count missing tables
MISSING_COUNT=0
for table in "${CRITICAL_TABLES[@]}"; do
  EXISTS=$(gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
    "docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -t -c \"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '$table');\"" 2>&1 | grep -o 't\|f')
  
  if [ "$EXISTS" != "t" ]; then
    MISSING_COUNT=$((MISSING_COUNT + 1))
  fi
done

if [ $MISSING_COUNT -eq 0 ]; then
  echo "✅ **All critical tables exist** - Database schema is complete" >> "$OUTPUT_FILE"
else
  echo "⚠️  **$MISSING_COUNT critical tables are missing** - Run missing migrations" >> "$OUTPUT_FILE"
fi

echo ""
echo "✅ Migrations verification report generated: $OUTPUT_FILE"
