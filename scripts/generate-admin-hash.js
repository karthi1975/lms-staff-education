/**
 * Generate bcrypt hash for admin password
 * Usage: node scripts/generate-admin-hash.js
 */

const bcrypt = require('bcrypt');

const password = 'Admin123!';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    process.exit(1);
  }

  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('');
  console.log('SQL INSERT command:');
  console.log(`INSERT INTO admin_users (email, password_hash, name, role, is_active, created_at, updated_at)`);
  console.log(`VALUES ('admin@school.edu', '${hash}', 'System Admin', 'admin', true, NOW(), NOW())`);
  console.log(`ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;`);
});
