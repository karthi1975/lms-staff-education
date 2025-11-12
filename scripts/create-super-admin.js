/**
 * Create Super Admin User
 *
 * Usage:
 *   ADMIN_EMAIL="email@example.com" \
 *   ADMIN_NAME="Full Name" \
 *   ADMIN_PASSWORD="SecurePassword123!" \
 *   node scripts/create-super-admin.js
 *
 * Environment Variables Required:
 *   ADMIN_EMAIL - Email address for the super admin
 *   ADMIN_NAME - Full name of the super admin
 *   ADMIN_PASSWORD - Password (will be bcrypted)
 */

const bcrypt = require('bcrypt');
const postgresService = require('../services/database/postgres.service');

async function createSuperAdmin() {
  try {
    // Validate environment variables
    const email = process.env.ADMIN_EMAIL;
    const name = process.env.ADMIN_NAME;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !name || !password) {
      console.error('❌ Error: Missing required environment variables');
      console.error('   Required: ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD');
      console.error('');
      console.error('Usage:');
      console.error('  ADMIN_EMAIL="email@example.com" \\');
      console.error('  ADMIN_NAME="Full Name" \\');
      console.error('  ADMIN_PASSWORD="SecurePassword123!" \\');
      console.error('  node scripts/create-super-admin.js');
      process.exit(1);
    }

    // Initialize database connection
    await postgresService.initialize();

    console.log('================================================');
    console.log('Creating Super Admin');
    console.log('================================================\n');

    const role = 'admin';  // String role (enum: admin, editor, viewer)
    const roleId = 1;  // Integer role_id for RBAC (1 = Super Admin)

    // Step 1: Check if user exists
    console.log('Step 1: Checking if user exists...');
    const existingUser = await postgresService.query(
      'SELECT id, email, role, role_id FROM admin_users WHERE email = $1',
      [email]
    );

    let userId;

    if (existingUser.rows.length > 0) {
      console.log('✓ User exists. Updating to Super Admin...');
      userId = existingUser.rows[0].id;

      // Hash password
      const password_hash = await bcrypt.hash(password, 10);

      // Update existing user to Super Admin
      await postgresService.query(
        `UPDATE admin_users
         SET role = $1,
             role_id = $2,
             name = $3,
             password_hash = $4,
             is_active = true,
             updated_at = NOW()
         WHERE email = $5`,
        [role, roleId, name, password_hash, email]
      );

      console.log('✅ User updated to Super Admin successfully!\n');
    } else {
      console.log('✓ User does not exist. Creating new Super Admin...');

      // Hash password
      const password_hash = await bcrypt.hash(password, 10);

      // Create new user
      const result = await postgresService.query(
        `INSERT INTO admin_users (email, password_hash, name, role, role_id, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
         RETURNING id`,
        [email, password_hash, name, role, roleId]
      );

      userId = result.rows[0].id;
      console.log('✅ Super Admin created successfully!\n');
    }

    // Step 2: Assign to All Regions
    console.log('Step 2: Assigning "All Regions" access...');

    // Get All Regions ID
    const regionResult = await postgresService.query(
      "SELECT id FROM regions WHERE code = 'ALL'"
    );

    if (regionResult.rows.length > 0) {
      const allRegionsId = regionResult.rows[0].id;

      // Assign to All Regions
      await postgresService.query(
        `INSERT INTO admin_regions (admin_user_id, region_id, assigned_at, assigned_by)
         VALUES ($1, $2, NOW(), $1)
         ON CONFLICT (admin_user_id, region_id) DO NOTHING`,
        [userId, allRegionsId]
      );

      console.log('✅ Assigned to "All Regions"\n');
    } else {
      console.log('⚠️  Warning: "All Regions" not found in regions table\n');
    }

    // Step 3: Verify user details
    console.log('Step 3: Verifying user details...');

    const userDetails = await postgresService.query(
      `SELECT
         au.id,
         au.email,
         au.name,
         au.role,
         r.display_name AS rbac_role,
         au.is_active,
         STRING_AGG(reg.name, ', ') AS regions
       FROM admin_users au
       LEFT JOIN roles r ON au.role_id = r.id
       LEFT JOIN admin_regions ar ON au.id = ar.admin_user_id
       LEFT JOIN regions reg ON ar.region_id = reg.id
       WHERE au.email = $1
       GROUP BY au.id, au.email, au.name, au.role, r.display_name, au.is_active`,
      [email]
    );

    console.log('\n✅ User Details:');
    console.table(userDetails.rows);

    console.log('\n================================================');
    console.log('✅ SUPER ADMIN SETUP COMPLETE');
    console.log('================================================\n');

    console.log('Login Credentials:');
    console.log(`  Email: ${email}`);
    console.log(`  Password: [REDACTED]\n`);

    console.log('Access via:');
    console.log('  Local: http://localhost:3000/admin/login.html');
    console.log('  GCP: http://34.162.168.124:3000/admin/login.html\n');

    // Close database connection
    await postgresService.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating super admin:', error);
    await postgresService.close();
    process.exit(1);
  }
}

// Run the script
createSuperAdmin();
