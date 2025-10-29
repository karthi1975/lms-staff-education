#!/bin/bash

# Run Complete Database Migration Script
# This script runs the comprehensive database setup on the PostgreSQL database

echo "🔧 Running Complete Database Setup..."
echo "============================================================"

# Database connection details
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-teachers_training}"
DB_USER="${DB_USER:-teachers_user}"
DB_PASSWORD="${DB_PASSWORD:-teachers_pass_2024}"

# Run the migration
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -f migrations/complete_database_setup.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "============================================================"
    echo "✅ Database setup completed successfully!"
    echo "============================================================"
    echo ""
    echo "📊 Verifying tables..."

    # List all tables
    PGPASSWORD="$DB_PASSWORD" psql \
      -h "$DB_HOST" \
      -p "$DB_PORT" \
      -U "$DB_USER" \
      -d "$DB_NAME" \
      -c "\dt" \
      -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"

    echo ""
    echo "✅ Migration complete! All tables are ready."
else
    echo ""
    echo "❌ Migration failed. Please check the error messages above."
    exit 1
fi
