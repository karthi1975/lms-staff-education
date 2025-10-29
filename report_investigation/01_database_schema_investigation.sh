#!/bin/bash
# Database Schema Investigation Script
# Generates comprehensive report of all database tables and columns

OUTPUT_FILE="/Users/karthi/business/staff_education/teachers_training/report_investigation/01_database_schema_report.md"

echo "# Database Schema Investigation Report" > "$OUTPUT_FILE"
echo "**Generated**: $(date)" >> "$OUTPUT_FILE"
echo "**Database**: PostgreSQL on GCP" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## Table of Contents" >> "$OUTPUT_FILE"
echo "1. All Tables Overview" >> "$OUTPUT_FILE"
echo "2. Detailed Schema for Each Table" >> "$OUTPUT_FILE"
echo "3. Foreign Key Relationships" >> "$OUTPUT_FILE"
echo "4. Indexes" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Get list of all tables
echo "## 1. All Tables Overview" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
  "docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c \"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;\"" >> "$OUTPUT_FILE" 2>&1
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Get detailed schema for critical tables
TABLES=(
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
  "whatsapp_messages"
)

echo "## 2. Detailed Schema for Each Table" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

for table in "${TABLES[@]}"; do
  echo "### Table: \`$table\`" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
  echo '```' >> "$OUTPUT_FILE"
  gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
    "docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c '\d $table'" >> "$OUTPUT_FILE" 2>&1 || echo "Table not found" >> "$OUTPUT_FILE"
  echo '```' >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
  
  # Get row count
  echo "**Row Count:**" >> "$OUTPUT_FILE"
  echo '```' >> "$OUTPUT_FILE"
  gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
    "docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c 'SELECT COUNT(*) as row_count FROM $table;'" >> "$OUTPUT_FILE" 2>&1 || echo "Cannot count rows" >> "$OUTPUT_FILE"
  echo '```' >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
done

echo "## 3. Foreign Key Relationships" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
  "docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c \"
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;\"" >> "$OUTPUT_FILE" 2>&1
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## 4. Indexes" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
  "docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c \"
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;\"" >> "$OUTPUT_FILE" 2>&1
echo '```' >> "$OUTPUT_FILE"

echo "✅ Database schema report generated: $OUTPUT_FILE"
