#!/bin/bash
set -e

echo "🔍 Step 1: Check current users table schema on GCP..."
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
  "docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c '\d users'" || true

echo ""
echo "📋 Step 2: Check if enrollment columns exist..."
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
  "docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c \"SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('enrollment_pin', 'enrollment_status', 'pin_attempts', 'pin_expires_at', 'enrolled_by', 'enrolled_at', 'is_verified') ORDER BY column_name;\""

echo ""
echo "🔧 Step 3: Apply migration 007 (PIN enrollment system)..."
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
  "docker exec -i teachers_training_postgres_1 psql -U teachers_user -d teachers_training" < /Users/karthi/business/staff_education/teachers_training/database/migrations/007_pin_enrollment_system.sql

echo ""
echo "✅ Step 4: Add is_verified column if missing..."
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
  "docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c 'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;'"

echo ""
echo "🔍 Step 5: Verify all columns now exist..."
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command \
  "docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c \"SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('enrollment_pin', 'enrollment_status', 'pin_attempts', 'pin_expires_at', 'enrolled_by', 'enrolled_at', 'is_verified') ORDER BY column_name;\""

echo ""
echo "✅ Enrollment schema fix complete!"
