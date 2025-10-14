#!/bin/bash

# Clean all courses and related data from GCP database

echo "========================================="
echo "Cleaning All Course Data from Database"
echo "========================================="
echo ""

docker exec teachers-training_postgres_1 psql -U teachers_user -d teachers_training << 'SQLEND'
-- Show current state
SELECT 'BEFORE CLEANUP:' as status;
SELECT 'Courses:' as table_name, COUNT(*) as count FROM courses
UNION ALL
SELECT 'Modules:' as table_name, COUNT(*) as count FROM modules
UNION ALL
SELECT 'Moodle Courses:' as table_name, COUNT(*) as count FROM moodle_courses
UNION ALL
SELECT 'Moodle Modules:' as table_name, COUNT(*) as count FROM moodle_modules;

-- Delete all course-related data (cascade will handle relationships)
DELETE FROM learning_interactions;
DELETE FROM conversation_context;
DELETE FROM module_content_chunks;
DELETE FROM moodle_quizzes;
DELETE FROM moodle_modules;
DELETE FROM moodle_courses;
DELETE FROM user_progress;
DELETE FROM quiz_attempts;
DELETE FROM modules;
DELETE FROM courses;

-- Reset sequences for clean IDs
ALTER SEQUENCE courses_id_seq RESTART WITH 1;
ALTER SEQUENCE modules_id_seq RESTART WITH 1;
ALTER SEQUENCE moodle_courses_id_seq RESTART WITH 1;
ALTER SEQUENCE moodle_modules_id_seq RESTART WITH 1;
ALTER SEQUENCE moodle_quizzes_id_seq RESTART WITH 1;
ALTER SEQUENCE learning_interactions_id_seq RESTART WITH 1;
ALTER SEQUENCE module_content_chunks_id_seq RESTART WITH 1;

-- Verify cleanup
SELECT 'AFTER CLEANUP:' as status;
SELECT 'Courses:' as table_name, COUNT(*) as count FROM courses
UNION ALL
SELECT 'Modules:' as table_name, COUNT(*) as count FROM modules
UNION ALL
SELECT 'Moodle Courses:' as table_name, COUNT(*) as count FROM moodle_courses
UNION ALL
SELECT 'Moodle Modules:' as table_name, COUNT(*) as count FROM moodle_modules;

SELECT 'Database cleaned successfully!' as result;
SQLEND

echo ""
echo "========================================="
echo "✅ All course data deleted"
echo "========================================="
echo ""
echo "Refresh your browser - the 'Course not found' error should be gone"
echo "The courses page should now show empty (no courses)"
