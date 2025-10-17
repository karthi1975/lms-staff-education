#!/bin/bash

# Script to fix course-module structure and create proper modules
# Run this on GCP instance

echo "============================================"
echo "Fix Course-Module Structure"
echo "============================================"
echo ""

cd ~/teachers_training

# Get admin token
echo "Step 1: Getting admin authentication token..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"Admin123!"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['tokens']['accessToken'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get auth token"
  exit 1
fi

echo "✅ Got token"
echo ""

echo "Step 2: Checking existing courses and modules..."
echo ""

# Get all courses
echo "=== Current Courses ==="
sudo docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "
  SELECT id, code, title, category
  FROM courses
  ORDER BY id;
"

echo ""
echo "=== Current Modules ==="
sudo docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "
  SELECT m.id, m.course_id, m.title, m.sequence_order, c.code as course_code
  FROM modules m
  JOIN courses c ON c.id = m.course_id
  ORDER BY m.course_id, m.sequence_order;
"

echo ""
echo "Step 3: Creating Business Studies course with modules 1-5..."
echo ""

# Create Business Studies course if it doesn't exist
COURSE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/admin/courses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "BUS-STUDIES-001",
    "title": "Business Studies Form Two",
    "description": "Comprehensive business studies curriculum for Form Two students",
    "category": "Business Education",
    "difficulty_level": "intermediate",
    "duration_weeks": 20,
    "sequence_order": 1
  }')

echo "Course creation response:"
echo "$COURSE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$COURSE_RESPONSE"
echo ""

# Extract course ID
COURSE_ID=$(echo "$COURSE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['course']['id'])" 2>/dev/null)

if [ -z "$COURSE_ID" ]; then
  echo "⚠️  Could not create/find course. Checking existing courses..."
  COURSE_ID=$(sudo docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -t -c "
    SELECT id FROM courses WHERE code = 'BUS-STUDIES-001' LIMIT 1;
  " | tr -d ' ')

  if [ -z "$COURSE_ID" ]; then
    echo "❌ Failed to get course ID"
    exit 1
  fi
fi

echo "✅ Course ID: $COURSE_ID"
echo ""

# Create modules 1-5
declare -a MODULES=(
  "Production:Understanding factors of production and production processes"
  "Financing:Business financing sources and financial management"
  "Management:Principles of business management and organization"
  "Warehousing:Inventory management and warehouse operations"
  "Opportunity:Identifying and evaluating business opportunities"
)

echo "Step 4: Creating modules 1-5 for the course..."
echo ""

for i in "${!MODULES[@]}"; do
  IFS=':' read -r TITLE DESC <<< "${MODULES[$i]}"
  SEQUENCE=$((i + 1))

  echo "Creating Module $SEQUENCE: $TITLE..."

  MODULE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/admin/modules \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"course_id\": $COURSE_ID,
      \"title\": \"$TITLE\",
      \"description\": \"$DESC\",
      \"sequence_order\": $SEQUENCE
    }")

  echo "$MODULE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$MODULE_RESPONSE"
  echo ""
done

echo ""
echo "Step 5: Verifying course-module structure..."
echo ""

sudo docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "
  SELECT
    c.code as course_code,
    m.id as module_db_id,
    m.sequence_order,
    m.title,
    CASE WHEN q.id IS NOT NULL THEN '✅ Has Quiz' ELSE '❌ No Quiz' END as quiz_status
  FROM courses c
  JOIN modules m ON m.course_id = c.id
  LEFT JOIN quizzes q ON q.module_id = m.id
  WHERE c.code = 'BUS-STUDIES-001'
  ORDER BY m.sequence_order;
"

echo ""
echo "============================================"
echo "✅ Course-Module Structure Setup Complete!"
echo "============================================"
echo ""
echo "You can now upload quizzes to the modules above."
echo "Use the module_db_id values for quiz uploads."
echo ""
echo "To upload quizzes, use these commands:"
echo ""

# Get the actual module IDs
MODULE_IDS=$(sudo docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -t -c "
  SELECT m.id
  FROM modules m
  JOIN courses c ON c.id = m.course_id
  WHERE c.code = 'BUS-STUDIES-001'
  ORDER BY m.sequence_order;
" | tr -d ' ')

COUNTER=1
for MODULE_ID in $MODULE_IDS; do
  echo "# Module $COUNTER (DB ID: $MODULE_ID):"
  echo "curl -X POST http://localhost:3000/api/admin/modules/$MODULE_ID/quiz/upload \\"
  echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
  echo "  -H \"Content-Type: application/json\" \\"
  echo "  -d @quizzes/CORRECT_MODULES/module_0${COUNTER}_*.json"
  echo ""
  COUNTER=$((COUNTER + 1))
done

echo "Or use the admin portal at: http://YOUR_IP:3000/admin/lms-dashboard.html"
echo ""
