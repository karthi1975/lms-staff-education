/**
 * Test Setup Script: Regional Admin Prompt Workflow E2E Tests
 *
 * This script sets up the test database with required test data:
 * - Test regions (Tanzania, Kenya)
 * - Test admin users (Super Admin, Regional Admins)
 * - Test courses assigned to regions
 * - Default bot configurations
 *
 * Run before executing E2E tests:
 * node tests/e2e/setup-regional-workflow-tests.js
 */

const { Client } = require('pg');
const bcrypt = require('bcrypt');

// Database configuration
const DB_CONFIG = {
  host: process.env.DB_HOST === 'postgres' ? 'localhost' : (process.env.DB_HOST || 'localhost'),
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'teachers_training',
  user: process.env.DB_USER || 'teachers_user',
  password: process.env.DB_PASSWORD || 'teachers_pass_2024'
};

// Test data
const TEST_DATA = {
  regions: [
    { id: 1, code: 'TZ', name: 'Tanzania', description: 'United Republic of Tanzania' },
    { id: 2, code: 'KE', name: 'Kenya', description: 'Republic of Kenya' }
  ],

  admins: [
    {
      email: 'admin@school.edu',
      password: 'Admin123!',
      name: 'Super Administrator',
      role: 'admin',
      role_id: 1, // Super Admin
      primary_region_id: 5 // ALL regions
    },
    {
      email: 'regional.tz@school.edu',
      password: 'Regional123!',
      name: 'Tanzania Regional Admin',
      role: 'admin',
      role_id: 2, // Regional Admin
      primary_region_id: 1 // Tanzania
    },
    {
      email: 'regional.ke@school.edu',
      password: 'Regional123!',
      name: 'Kenya Regional Admin',
      role: 'admin',
      role_id: 2, // Regional Admin
      primary_region_id: 2 // Kenya
    }
  ],

  courses: [
    {
      title: 'Business Studies',
      code: 'BUS101',
      description: 'Introduction to Business Studies',
      region_id: 1, // Tanzania
      is_active: true
    },
    {
      title: 'ICT Training',
      code: 'ICT101',
      description: 'Information and Communication Technology',
      region_id: 2, // Kenya
      is_active: true
    },
    {
      title: 'Mathematics for Teachers',
      code: 'MATH101',
      description: 'Advanced Mathematics Training',
      region_id: 1, // Tanzania
      is_active: true
    }
  ]
};

async function setupTestData() {
  const client = new Client(DB_CONFIG);

  try {
    await client.connect();
    console.log('✓ Connected to database');

    // Start transaction
    await client.query('BEGIN');

    // 1. Ensure regions exist
    console.log('\n[1/6] Setting up regions...');
    for (const region of TEST_DATA.regions) {
      await client.query(
        `INSERT INTO regions (id, code, name, description, is_active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (code) DO UPDATE
         SET name = EXCLUDED.name, description = EXCLUDED.description`,
        [region.id, region.code, region.name, region.description]
      );
      console.log(`  ✓ Region: ${region.name} (${region.code})`);
    }

    // 2. Create admin users
    console.log('\n[2/6] Creating admin users...');
    for (const admin of TEST_DATA.admins) {
      const hashedPassword = await bcrypt.hash(admin.password, 10);

      const result = await client.query(
        `INSERT INTO admin_users (email, password, name, role, role_id, primary_region_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT (email) DO UPDATE
         SET password = EXCLUDED.password,
             name = EXCLUDED.name,
             role_id = EXCLUDED.role_id,
             primary_region_id = EXCLUDED.primary_region_id
         RETURNING id`,
        [admin.email, hashedPassword, admin.name, admin.role, admin.role_id, admin.primary_region_id]
      );

      const adminId = result.rows[0].id;
      console.log(`  ✓ Admin: ${admin.name} (${admin.email}) - ID: ${adminId}`);

      // 3. Assign regional admins to their regions
      if (admin.role_id === 2 && admin.primary_region_id !== 5) {
        await client.query(
          `INSERT INTO admin_regions (admin_user_id, region_id, assigned_by)
           VALUES ($1, $2, (SELECT id FROM admin_users WHERE role_id = 1 LIMIT 1))
           ON CONFLICT (admin_user_id, region_id) DO NOTHING`,
          [adminId, admin.primary_region_id]
        );
        console.log(`    → Assigned to region: ${admin.primary_region_id}`);
      }
    }

    // 4. Create test courses
    console.log('\n[3/6] Creating test courses...');
    for (const course of TEST_DATA.courses) {
      const superAdminId = await client.query(
        'SELECT id FROM admin_users WHERE role_id = 1 LIMIT 1'
      );

      const result = await client.query(
        `INSERT INTO courses (title, code, description, region_id, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO UPDATE
         SET title = EXCLUDED.title,
             description = EXCLUDED.description,
             region_id = EXCLUDED.region_id
         RETURNING id`,
        [
          course.title,
          course.code,
          course.description,
          course.region_id,
          course.is_active,
          superAdminId.rows[0].id
        ]
      );

      const courseId = result.rows[0].id;
      console.log(`  ✓ Course: ${course.title} (${course.code}) - Region: ${course.region_id} - ID: ${courseId}`);

      // 5. Initialize bot configurations for each course
      await client.query(
        `INSERT INTO course_bot_configs (
           course_id,
           regular_prompt,
           regular_greeting,
           regular_help_text,
           socratic_prompt,
           socratic_greeting,
           socratic_help_text,
           default_mode,
           allow_mode_switching,
           last_approved_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (course_id) DO NOTHING`,
        [
          courseId,
          'You are a helpful teaching assistant for this course. Provide clear, direct answers with examples and explanations.',
          'Hello! I\'m here to help you learn. Ask me anything!',
          'I provide direct answers, explanations, and examples.',
          'You are a Socratic teaching assistant. NEVER give direct answers. ONLY ask guiding questions to help students discover answers themselves.',
          'Hello! Let\'s discover the answers together through questions.',
          'I guide you through questions to help you discover answers yourself.',
          'regular',
          true
        ]
      );
      console.log(`    → Bot configs initialized`);
    }

    // 6. Verify setup
    console.log('\n[4/6] Verifying test data setup...');

    const regionCount = await client.query('SELECT COUNT(*) FROM regions WHERE is_active = true');
    console.log(`  ✓ Active regions: ${regionCount.rows[0].count}`);

    const adminCount = await client.query('SELECT COUNT(*) FROM admin_users WHERE is_active = true');
    console.log(`  ✓ Active admins: ${adminCount.rows[0].count}`);

    const courseCount = await client.query('SELECT COUNT(*) FROM courses WHERE is_active = true');
    console.log(`  ✓ Active courses: ${courseCount.rows[0].count}`);

    const configCount = await client.query('SELECT COUNT(*) FROM course_bot_configs');
    console.log(`  ✓ Bot configs: ${configCount.rows[0].count}`);

    const assignmentCount = await client.query('SELECT COUNT(*) FROM admin_regions');
    console.log(`  ✓ Admin-Region assignments: ${assignmentCount.rows[0].count}`);

    // Commit transaction
    await client.query('COMMIT');

    console.log('\n' + '='.repeat(80));
    console.log('✓ TEST DATA SETUP COMPLETE');
    console.log('='.repeat(80));
    console.log('\nTest Users Created:');
    console.log('  1. Super Admin:');
    console.log('     Email: admin@school.edu');
    console.log('     Password: Admin123!');
    console.log('     Access: All regions, all courses');
    console.log('');
    console.log('  2. Regional Admin (Tanzania):');
    console.log('     Email: regional.tz@school.edu');
    console.log('     Password: Regional123!');
    console.log('     Access: Tanzania region courses only');
    console.log('');
    console.log('  3. Regional Admin (Kenya):');
    console.log('     Email: regional.ke@school.edu');
    console.log('     Password: Regional123!');
    console.log('     Access: Kenya region courses only');
    console.log('\nYou can now run the E2E tests:');
    console.log('  npx playwright test tests/e2e/regional-admin-prompt-workflow.spec.js');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n✗ ERROR setting up test data:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run setup
if (require.main === module) {
  setupTestData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupTestData, TEST_DATA };
