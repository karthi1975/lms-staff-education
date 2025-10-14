#!/bin/bash

# Create admin user directly in database

echo "========================================="
echo "Creating Admin User"
echo "========================================="
echo ""

# Find the postgres container
DB_CONTAINER=$(docker ps --format "{{.Names}}" | grep -E "postgres|db" | head -1)

if [ -z "$DB_CONTAINER" ]; then
    echo "❌ No database container found"
    echo "Available containers:"
    docker ps --format "{{.Names}}"
    exit 1
fi

echo "Found database container: $DB_CONTAINER"
echo ""

docker exec "$DB_CONTAINER" psql -U teachers_user -d teachers_training << 'SQL'
-- Create admin user with password: Admin123!
INSERT INTO admin_users (email, password_hash, name, role, is_active, created_at, updated_at)
VALUES (
  'admin@school.edu',
  '$2b$10$mDRhU21qYaVckm.qkvrN..Hpb150MAUMtWlfr1wdw64fndnjdoKEa',
  'System Admin',
  'admin',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Show created user
SELECT '✅ Admin user created!' as status;
SELECT id, email, name, role, is_active FROM admin_users;
SQL

echo ""
echo "========================================="
echo "✅ Admin User Created!"
echo "========================================="
echo ""
echo "Login credentials:"
echo "  URL: http://localhost:3000/admin/login.html"
echo "  Email: admin@school.edu"
echo "  Password: Admin123!"
echo ""
