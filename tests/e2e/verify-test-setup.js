/**
 * Test Setup Verification Script
 * Verifies that test data is properly configured before running E2E tests
 */

const { Client } = require('pg');

const DB_CONFIG = {
  host: process.env.DB_HOST === 'postgres' ? 'localhost' : (process.env.DB_HOST || 'localhost'),
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'teachers_training',
  user: process.env.DB_USER || 'teachers_user',
  password: process.env.DB_PASSWORD || 'teachers_pass_2024'
};

async function verifySetup() {
  const client = new Client(DB_CONFIG);

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    const checks = [];

    // Check 1: Regions exist
    const regions = await client.query(
      "SELECT id, code, name FROM regions WHERE code IN ('TZ', 'KE') ORDER BY code"
    );
    checks.push({
      name: 'Regions (Tanzania, Kenya)',
      expected: 2,
      actual: regions.rows.length,
      pass: regions.rows.length >= 2,
      details: regions.rows.map(r => `${r.name} (${r.code})`).join(', ')
    });

    // Check 2: Test admin users exist
    const admins = await client.query(
      `SELECT id, email, name, role_id, primary_region_id
       FROM admin_users
       WHERE email IN ('admin@school.edu', 'regional.tz@school.edu', 'regional.ke@school.edu')
       ORDER BY email`
    );
    checks.push({
      name: 'Test Admin Users',
      expected: 3,
      actual: admins.rows.length,
      pass: admins.rows.length === 3,
      details: admins.rows.map(a => `${a.name} (${a.email})`).join(', ')
    });

    // Check 3: Admin-Region assignments
    const assignments = await client.query(
      `SELECT ar.admin_user_id, ar.region_id, a.email, r.name as region_name
       FROM admin_regions ar
       JOIN admin_users a ON ar.admin_user_id = a.id
       JOIN regions r ON ar.region_id = r.id
       WHERE a.email IN ('regional.tz@school.edu', 'regional.ke@school.edu')
       ORDER BY a.email`
    );
    checks.push({
      name: 'Admin-Region Assignments',
      expected: 2,
      actual: assignments.rows.length,
      pass: assignments.rows.length >= 2,
      details: assignments.rows.map(a => `${a.email} → ${a.region_name}`).join(', ')
    });

    // Check 4: Test courses exist
    const courses = await client.query(
      `SELECT id, title, code, region_id
       FROM courses
       WHERE code IN ('BUS101', 'ICT101', 'MATH101')
       ORDER BY code`
    );
    checks.push({
      name: 'Test Courses',
      expected: 3,
      actual: courses.rows.length,
      pass: courses.rows.length >= 3,
      details: courses.rows.map(c => `${c.title} (${c.code})`).join(', ')
    });

    // Check 5: Bot configurations exist
    const configs = await client.query(
      `SELECT cbc.course_id, c.title
       FROM course_bot_configs cbc
       JOIN courses c ON cbc.course_id = c.id
       WHERE c.code IN ('BUS101', 'ICT101', 'MATH101')
       ORDER BY c.code`
    );
    checks.push({
      name: 'Bot Configurations',
      expected: 3,
      actual: configs.rows.length,
      pass: configs.rows.length >= 3,
      details: configs.rows.map(c => c.title).join(', ')
    });

    // Check 6: Required tables exist
    const tables = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN (
           'regions',
           'admin_regions',
           'course_bot_configs',
           'prompt_change_requests',
           'prompt_approval_history'
         )
       ORDER BY table_name`
    );
    checks.push({
      name: 'Required Tables',
      expected: 5,
      actual: tables.rows.length,
      pass: tables.rows.length === 5,
      details: tables.rows.map(t => t.table_name).join(', ')
    });

    // Print results
    console.log('='.repeat(80));
    console.log('TEST SETUP VERIFICATION RESULTS');
    console.log('='.repeat(80));
    console.log('');

    let allPassed = true;

    checks.forEach((check, index) => {
      const status = check.pass ? '✓ PASS' : '✗ FAIL';
      const icon = check.pass ? '✓' : '✗';

      console.log(`${index + 1}. ${check.name}`);
      console.log(`   ${icon} Expected: ${check.expected}, Found: ${check.actual}`);
      if (check.details) {
        console.log(`   Details: ${check.details}`);
      }
      console.log('');

      if (!check.pass) {
        allPassed = false;
      }
    });

    console.log('='.repeat(80));

    if (allPassed) {
      console.log('✓ ALL CHECKS PASSED - Ready to run E2E tests!');
      console.log('');
      console.log('Run tests with:');
      console.log('  npm run test:e2e:regional');
      console.log('');
      console.log('Or with browser visible:');
      console.log('  npm run test:e2e:regional:headed');
    } else {
      console.log('✗ SOME CHECKS FAILED - Please run setup script:');
      console.log('  npm run test:setup:regional');
      console.log('');
      console.log('Or manually:');
      console.log('  node tests/e2e/setup-regional-workflow-tests.js');
    }

    console.log('='.repeat(80));
    console.log('');

    await client.end();

    return allPassed ? 0 : 1;

  } catch (error) {
    console.error('\n✗ ERROR verifying setup:', error.message);
    console.error('\nPlease check:');
    console.error('  1. PostgreSQL is running');
    console.error('  2. Database credentials in .env are correct');
    console.error('  3. Migrations have been run');
    console.error('');
    console.error('Run migrations:');
    console.error('  psql -U teachers_user -d teachers_training -f database/migrations/010_create_rbac_tables_postgres.sql');
    console.error('  psql -U teachers_user -d teachers_training -f database/migrations/006_dual_coaching_with_approval.sql');
    console.error('');

    await client.end().catch(() => {});
    return 1;
  }
}

// Run verification
if (require.main === module) {
  verifySetup()
    .then(exitCode => process.exit(exitCode))
    .catch(error => {
      console.error('Verification failed:', error);
      process.exit(1);
    });
}

module.exports = { verifySetup };
