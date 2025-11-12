/**
 * Change Admin User Password
 *
 * Usage:
 *   ADMIN_EMAIL="email@example.com" \
 *   NEW_PASSWORD="NewSecurePassword123!" \
 *   node scripts/change-admin-password.js
 *
 * Environment Variables Required:
 *   ADMIN_EMAIL - Email address of the admin user
 *   NEW_PASSWORD - New password (will be bcrypted)
 */

const bcrypt = require('bcrypt');
const postgresService = require('../services/database/postgres.service');

async function changeAdminPassword() {
  try {
    // Validate environment variables
    const email = process.env.ADMIN_EMAIL;
    const newPassword = process.env.NEW_PASSWORD;

    if (!email || !newPassword) {
      console.error('❌ Error: Missing required environment variables');
      console.error('   Required: ADMIN_EMAIL, NEW_PASSWORD');
      console.error('');
      console.error('Usage:');
      console.error('  ADMIN_EMAIL="email@example.com" \\');
      console.error('  NEW_PASSWORD="NewSecurePassword123!" \\');
      console.error('  node scripts/change-admin-password.js');
      process.exit(1);
    }

    // Initialize database connection
    await postgresService.initialize();

    console.log('================================================');
    console.log('Changing Admin Password');
    console.log('================================================\n');

    // Step 1: Check if user exists
    console.log('Step 1: Verifying user exists...');
    const existingUser = await postgresService.query(
      'SELECT id, email, name, role FROM admin_users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length === 0) {
      console.error(`❌ Error: User with email ${email} not found`);
      await postgresService.close();
      process.exit(1);
    }

    const user = existingUser.rows[0];
    console.log(`✓ User found: ${user.name} (${user.role})\n`);

    // Step 2: Hash new password
    console.log('Step 2: Hashing new password...');
    const password_hash = await bcrypt.hash(newPassword, 10);
    console.log('✓ Password hashed\n');

    // Step 3: Update password
    console.log('Step 3: Updating password in database...');
    await postgresService.query(
      `UPDATE admin_users
       SET password_hash = $1,
           updated_at = NOW()
       WHERE email = $2`,
      [password_hash, email]
    );

    console.log('✅ Password updated successfully!\n');

    console.log('================================================');
    console.log('✅ PASSWORD CHANGE COMPLETE');
    console.log('================================================\n');

    console.log('Updated Credentials:');
    console.log(`  Email: ${email}`);
    console.log(`  Password: [REDACTED]\n`);

    console.log('⚠️  IMPORTANT: Inform the user of their new password securely!\n');

    // Close database connection
    await postgresService.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error changing password:', error);
    await postgresService.close();
    process.exit(1);
  }
}

// Run the script
changeAdminPassword();
