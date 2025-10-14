#!/bin/bash

# Complete local database reset - keep only admin@school.edu

echo "========================================="
echo "Complete Local Database Reset"
echo "========================================="
echo ""
echo "This will:"
echo "  ❌ Delete ALL courses, modules, quizzes"
echo "  ❌ Delete ALL WhatsApp users"
echo "  ❌ Delete ALL admin users EXCEPT admin@school.edu"
echo "  ❌ Delete ALL learning data"
echo "  ✅ Keep ONLY: admin@school.edu"
echo ""
read -p "Type 'yes' to continue: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

# Find database container
DB_CONTAINER=$(docker ps --format "{{.Names}}" | grep -E "postgres|db" | head -1)

if [ -z "$DB_CONTAINER" ]; then
    echo "❌ No database container found"
    echo "Please start Docker containers first"
    exit 1
fi

echo ""
echo "Found database: $DB_CONTAINER"
echo "Resetting database..."
echo ""

docker exec "$DB_CONTAINER" psql -U teachers_user -d teachers_training << 'SQLEND'
-- Show current state
SELECT 'BEFORE RESET:' as status;
SELECT 'Courses: ' || COUNT(*) as info FROM courses;
SELECT 'Modules: ' || COUNT(*) as info FROM modules;
SELECT 'WhatsApp Users: ' || COUNT(*) as info FROM users;
SELECT 'Admin Users: ' || COUNT(*) as info FROM admin_users;

-- Delete ALL data
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
DELETE FROM sessions;
DELETE FROM coaching_events;

-- Delete ALL WhatsApp users
DELETE FROM users;

-- Delete ALL admin users EXCEPT admin@school.edu
DELETE FROM admin_users WHERE email != 'admin@school.edu';

-- Reset ALL sequences
ALTER SEQUENCE courses_id_seq RESTART WITH 1;
ALTER SEQUENCE modules_id_seq RESTART WITH 1;
ALTER SEQUENCE moodle_courses_id_seq RESTART WITH 1;
ALTER SEQUENCE moodle_modules_id_seq RESTART WITH 1;
ALTER SEQUENCE moodle_quizzes_id_seq RESTART WITH 1;
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE admin_users_id_seq RESTART WITH 1;
ALTER SEQUENCE sessions_id_seq RESTART WITH 1;
ALTER SEQUENCE quiz_attempts_id_seq RESTART WITH 1;
ALTER SEQUENCE coaching_events_id_seq RESTART WITH 1;
ALTER SEQUENCE learning_interactions_id_seq RESTART WITH 1;
ALTER SEQUENCE module_content_chunks_id_seq RESTART WITH 1;
ALTER SEQUENCE module_content_id_seq RESTART WITH 1;

-- Show final state
SELECT 'AFTER RESET:' as status;
SELECT 'Courses: ' || COUNT(*) as info FROM courses;
SELECT 'Modules: ' || COUNT(*) as info FROM modules;
SELECT 'WhatsApp Users: ' || COUNT(*) as info FROM users;
SELECT 'Admin Users: ' || COUNT(*) as info FROM admin_users;
SELECT 'Remaining admin: ' || email as info FROM admin_users;

SELECT '✅ Database completely reset!' as result;
SQLEND

echo ""
echo "Restarting application container..."

APP_CONTAINER=$(docker ps --format "{{.Names}}" | grep -E "app|teachers" | grep -v "db\|neo4j\|chroma\|postgres" | head -1)

if [ -n "$APP_CONTAINER" ]; then
    docker restart "$APP_CONTAINER"
    echo "✅ Application restarted"

    echo ""
    echo "Waiting for restart..."
    sleep 5

    echo ""
    echo "Testing health..."
    curl -s http://localhost:3000/health | python3 -m json.tool 2>/dev/null
fi

echo ""
echo "========================================="
echo "✅ COMPLETE - Database Reset!"
echo "========================================="
echo ""
echo "Your local database is now clean:"
echo "  • Zero courses"
echo "  • Zero modules"
echo "  • Zero users"
echo "  • Only admin: admin@school.edu"
echo ""
echo "Refresh browser: http://localhost:3000/admin/courses.html"
echo "Press Cmd+Shift+R to hard refresh"
echo ""
