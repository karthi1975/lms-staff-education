#!/bin/bash

# Diagnostic script for quiz upload issues
# Run this on GCP to check what's wrong

echo "============================================"
echo "Quiz Upload Diagnostics"
echo "============================================"
echo ""

echo "1. Checking available modules in database..."
sudo docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "
  SELECT id, title, course_id, sequence_order, is_active
  FROM modules
  ORDER BY course_id, sequence_order
  LIMIT 20;
"

echo ""
echo "2. Checking courses in database..."
sudo docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "
  SELECT id, code, title, is_active
  FROM courses
  ORDER BY sequence_order;
"

echo ""
echo "3. Checking if module 13 exists..."
sudo docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "
  SELECT id, title, course_id
  FROM modules
  WHERE id = 13;
"

echo ""
echo "4. Checking quiz upload route in code..."
if grep -q "POST.*modules/:moduleId/quiz/upload" routes/admin.routes.js; then
    echo "✅ Quiz upload route found"
else
    echo "❌ Quiz upload route NOT found"
fi

echo ""
echo "5. Checking app logs for errors..."
sudo docker logs teachers_training_app_1 --tail 50 | grep -i error

echo ""
echo "6. Testing health endpoint..."
curl -s http://localhost:3000/health | python3 -m json.tool 2>/dev/null || echo "Health endpoint failed"

echo ""
echo "============================================"
echo "Diagnostics complete!"
echo "============================================"
echo ""
echo "If module 13 doesn't exist, you need to:"
echo "  1. Create the module first"
echo "  2. Then upload quiz for that module"
echo ""
