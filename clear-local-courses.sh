#!/bin/bash

# Clear course data from local database

echo "========================================="
echo "Clear Local Course Data"
echo "========================================="
echo ""

# Check if Docker is running
if ! docker ps &> /dev/null; then
    echo "❌ Docker is not running"
    echo "Please start Docker first"
    exit 1
fi

# Check if database container exists
DB_CONTAINER=$(docker ps --format "{{.Names}}" | grep -E "postgres|db" | head -1)

if [ -z "$DB_CONTAINER" ]; then
    echo "❌ No database container found"
    echo "Available containers:"
    docker ps --format "{{.Names}}"
    exit 1
fi

echo "Found database: $DB_CONTAINER"
echo ""
echo "This will delete all course data but keep users"
echo ""
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Clearing course data..."

docker exec "$DB_CONTAINER" psql -U teachers_user -d teachers_training << 'SQLEND'
-- Show before
SELECT 'BEFORE:' as status;
SELECT 'Courses: ' || COUNT(*) FROM courses;
SELECT 'Users: ' || COUNT(*) FROM users;
SELECT 'Admin Users: ' || COUNT(*) FROM admin_users;

-- Delete course data only
DELETE FROM learning_interactions;
DELETE FROM conversation_context;
DELETE FROM module_content_chunks;
DELETE FROM moodle_quizzes;
DELETE FROM moodle_modules;
DELETE FROM moodle_courses;
DELETE FROM user_progress;
DELETE FROM quiz_attempts;
DELETE FROM module_content;
DELETE FROM modules;
DELETE FROM courses;

-- Reset sequences
ALTER SEQUENCE courses_id_seq RESTART WITH 1;
ALTER SEQUENCE modules_id_seq RESTART WITH 1;
ALTER SEQUENCE moodle_courses_id_seq RESTART WITH 1;
ALTER SEQUENCE moodle_modules_id_seq RESTART WITH 1;

-- Show after
SELECT 'AFTER:' as status;
SELECT 'Courses: ' || COUNT(*) FROM courses;
SELECT 'Users: ' || COUNT(*) FROM users;
SELECT 'Admin Users: ' || COUNT(*) FROM admin_users;

SELECT '✅ Course data cleared, users preserved!' as result;
SQLEND

echo ""
echo "========================================="
echo "✅ Done!"
echo "========================================="
