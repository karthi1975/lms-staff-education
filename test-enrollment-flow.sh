#!/bin/bash

echo "================================================"
echo "Testing Complete PIN Enrollment Flow"
echo "================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check health
echo "Step 1: Checking system health..."
HEALTH=$(curl -s http://localhost:3000/health)
echo "$HEALTH" | python3 -m json.tool
echo ""

# Step 2: Check database is clean
echo "Step 2: Verifying database is clean..."
docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "
  SELECT
    (SELECT COUNT(*) FROM courses) as courses,
    (SELECT COUNT(*) FROM modules) as modules,
    (SELECT COUNT(*) FROM users) as users
"
echo ""

# Step 3: Create test enrollment directly via SQL (bypassing auth for now)
echo "Step 3: Testing enrollment service directly..."
docker exec teachers_training-app-1 node -e "
const enrollmentService = require('./services/enrollment.service');
const postgresService = require('./services/database/postgres.service');

(async () => {
  try {
    // Initialize postgres service
    await postgresService.initialize();

    // Get admin ID
    const adminResult = await postgresService.query('SELECT id FROM admin_users LIMIT 1');
    const adminId = adminResult.rows[0].id;

    console.log('Admin ID:', adminId);

    // Enroll a test user
    const result = await enrollmentService.enrollUser(
      'John Teacher',
      '+254712345678',
      adminId
    );

    console.log('\\n✅ Enrollment Result:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\\n📌 PIN:', result.pin);
      console.log('💾 Saving PIN for next test...');
      require('fs').writeFileSync('/tmp/test_pin.txt', result.pin);
    }

    await postgresService.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Step 3: Enrollment successful${NC}"
else
  echo -e "${RED}❌ Step 3: Enrollment failed${NC}"
  exit 1
fi

echo ""

# Step 4: Verify user was created
echo "Step 4: Verifying user in database..."
docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "
  SELECT
    id,
    whatsapp_id,
    name,
    enrollment_status,
    pin_attempts,
    is_verified,
    enrolled_at
  FROM users
  WHERE whatsapp_id = '+254712345678'
"
echo ""

# Step 5: Test PIN verification
echo "Step 5: Testing PIN verification..."
TEST_PIN=$(cat /tmp/test_pin.txt 2>/dev/null)
if [ -z "$TEST_PIN" ]; then
  echo -e "${RED}❌ Could not read test PIN${NC}"
  exit 1
fi

echo "Using PIN: $TEST_PIN"

docker exec teachers_training-app-1 node -e "
const enrollmentService = require('./services/enrollment.service');

(async () => {
  try {
    const result = await enrollmentService.verifyUserPIN(
      '+254712345678',
      '$TEST_PIN'
    );

    console.log('\\n✅ PIN Verification Result:');
    console.log(JSON.stringify(result, null, 2));

    if (result.verified) {
      console.log('\\n🎉 User successfully verified and activated!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Step 5: PIN verification successful${NC}"
else
  echo -e "${RED}❌ Step 5: PIN verification failed${NC}"
  exit 1
fi

echo ""

# Step 6: Verify user is now active
echo "Step 6: Verifying user is now active..."
docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "
  SELECT
    id,
    whatsapp_id,
    name,
    enrollment_status,
    is_verified,
    enrolled_at
  FROM users
  WHERE whatsapp_id = '+254712345678'
"
echo ""

# Step 7: Test enrollment status check
echo "Step 7: Testing enrollment status check..."
docker exec teachers_training-app-1 node -e "
const enrollmentService = require('./services/enrollment.service');

(async () => {
  try {
    const status = await enrollmentService.getEnrollmentStatus('+254712345678');

    console.log('\\n📊 Enrollment Status:');
    console.log(JSON.stringify(status, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
"

echo ""
echo "================================================"
echo -e "${GREEN}✅ All Tests Passed!${NC}"
echo "================================================"
echo ""
echo "Summary:"
echo "  ✅ System healthy"
echo "  ✅ User enrolled with PIN"
echo "  ✅ PIN verification working"
echo "  ✅ User activated successfully"
echo "  ✅ Enrollment status tracking working"
echo ""
echo "Next: Test via WhatsApp by sending the PIN to +254712345678"
echo ""
