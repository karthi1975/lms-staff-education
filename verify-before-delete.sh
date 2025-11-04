#!/bin/bash

# Verification Script - Run BEFORE deleting courses
# This shows you exactly what will be deleted

echo "=========================================="
echo "PRE-DELETE VERIFICATION"
echo "=========================================="
echo ""

echo "📊 Checking current database state..."
echo ""

gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant" --command "
docker exec -i teachers_training_postgres_1 psql -U teachers_user -d teachers_training << 'EOSQL'

-- Count all records that will be affected
SELECT
  'COURSES' as category,
  COUNT(*) as count
FROM courses
UNION ALL
SELECT 'MODULES' as category, COUNT(*) FROM modules
UNION ALL
SELECT 'QUIZZES' as category, COUNT(*) FROM quizzes
UNION ALL
SELECT 'QUIZ QUESTIONS' as category, COUNT(*) FROM quiz_questions
UNION ALL
SELECT 'MODULE CONTENT' as category, COUNT(*) FROM module_content
UNION ALL
SELECT 'USER PROGRESS' as category, COUNT(*) FROM user_progress
UNION ALL
SELECT 'COURSE ENROLLMENTS' as category, COUNT(*) FROM course_enrollments
UNION ALL
SELECT 'QUIZ ATTEMPTS' as category, COUNT(*) FROM quiz_attempts
ORDER BY category;

-- Show course details
SELECT '' as spacer;
SELECT '==================' as header;
SELECT 'COURSE DETAILS' as header;
SELECT '==================' as header;

SELECT
  id,
  code,
  title,
  (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) as module_count,
  created_at
FROM courses
ORDER BY id;

EOSQL
"

echo ""
echo "=========================================="
echo "WHAT WILL BE DELETED:"
echo "=========================================="
echo ""
echo "✅ All courses and their data"
echo "✅ All modules"
echo "✅ All quizzes and quiz questions"
echo "✅ All module content (files and metadata)"
echo "✅ All user progress on these courses"
echo "✅ All course enrollments"
echo "✅ Physical files from uploads/ directory"
echo "✅ Neo4j knowledge graph nodes"
echo "✅ ChromaDB vector embeddings"
echo ""
echo "❌ WILL NOT DELETE:"
echo "  - Users (WhatsApp users preserved)"
echo "  - Admin users (preserved)"
echo "  - Regions (preserved)"
echo "  - Quiz attempts (orphaned if any exist)"
echo ""
echo "=========================================="
echo "RECOMMENDATION:"
echo "=========================================="
echo ""
echo "Use the Admin UI to delete courses:"
echo "  1. Login: http://34.162.168.124:3000/admin/login.html"
echo "  2. Go to Courses page"
echo "  3. Click Delete button for each course"
echo ""
echo "This ensures complete cleanup including:"
echo "  - Physical files"
echo "  - Neo4j graph"
echo "  - ChromaDB vectors"
echo ""
