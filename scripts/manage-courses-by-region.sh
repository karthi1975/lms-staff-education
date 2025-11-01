#!/bin/bash

# Course Management by Region Script
# Helps delete existing courses and view region assignments

set -e

echo "═══════════════════════════════════════════════════════"
echo "  COURSE MANAGEMENT BY REGION"
echo "═══════════════════════════════════════════════════════"
echo ""

# Database connection
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-teachers_training}"
DB_USER="${DB_USER:-teachers_user}"
DB_PASSWORD="${DB_PASSWORD:-teachers_pass_2024}"

# Function to run SQL
run_sql() {
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$1"
}

# Menu
echo "Select an option:"
echo "1. View all courses"
echo "2. View courses by region"
echo "3. Delete all courses"
echo "4. Delete specific course"
echo "5. View regions"
echo "6. Assign course to region"
echo ""
read -p "Enter option (1-6): " option

case $option in
    1)
        echo ""
        echo "📚 ALL COURSES:"
        run_sql "
        SELECT
            c.id,
            c.title,
            c.code,
            COALESCE(
                (SELECT STRING_AGG(r.code, ', ')
                 FROM course_region_enrollments cre
                 JOIN regions r ON cre.region_id = r.id
                 WHERE cre.course_id = c.id AND cre.is_active = true),
                'No region assigned'
            ) as regions
        FROM courses c
        ORDER BY c.id;
        "
        ;;

    2)
        echo ""
        read -p "Enter region code (TZ/RW/KE/BI/ALL): " region_code
        echo ""
        echo "📚 COURSES FOR REGION: $region_code"
        run_sql "
        SELECT
            c.id,
            c.title,
            c.code,
            cre.enrolled_at
        FROM courses c
        JOIN course_region_enrollments cre ON c.id = cre.course_id
        JOIN regions r ON cre.region_id = r.id
        WHERE r.code = '$region_code' AND cre.is_active = true
        ORDER BY c.id;
        "
        ;;

    3)
        echo ""
        read -p "⚠️  Delete ALL courses? This cannot be undone! (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            echo "Deleting all courses..."
            run_sql "DELETE FROM courses;"
            echo "✅ All courses deleted"
        else
            echo "Cancelled"
        fi
        ;;

    4)
        echo ""
        read -p "Enter course ID to delete: " course_id
        read -p "⚠️  Delete course ID $course_id? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            run_sql "DELETE FROM courses WHERE id = $course_id;"
            echo "✅ Course $course_id deleted"
        else
            echo "Cancelled"
        fi
        ;;

    5)
        echo ""
        echo "🌍 ALL REGIONS:"
        run_sql "
        SELECT
            id,
            code,
            name,
            (SELECT COUNT(*)
             FROM course_region_enrollments
             WHERE region_id = regions.id AND is_active = true
            ) as course_count
        FROM regions
        WHERE is_active = true
        ORDER BY code;
        "
        ;;

    6)
        echo ""
        read -p "Enter course ID: " course_id
        read -p "Enter region ID: " region_id
        read -p "Enter admin user ID (who is enrolling): " admin_id

        run_sql "
        INSERT INTO course_region_enrollments (course_id, region_id, enrolled_by)
        VALUES ($course_id, $region_id, $admin_id)
        ON CONFLICT (course_id, region_id)
        DO UPDATE SET
            is_active = true,
            enrolled_at = NOW(),
            enrolled_by = $admin_id;
        "
        echo "✅ Course $course_id assigned to region $region_id"
        ;;

    *)
        echo "Invalid option"
        exit 1
        ;;
esac

echo ""
echo "Done!"
