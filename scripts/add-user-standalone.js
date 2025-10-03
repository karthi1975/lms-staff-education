#!/usr/bin/env node

/**
 * Standalone script to add Karthi as a user
 * Connects directly to PostgreSQL container
 */

const { Pool } = require('pg');

const WHATSAPP_ID = '+18016809129';
const USER_NAME = 'Karthi';

// Connect to Docker PostgreSQL container
const pool = new Pool({
  host: 'localhost',  // Docker exposes on localhost
  port: 5432,
  database: 'teachers_training',
  user: 'teachers_user',
  password: 'teachers_pass_2024'
});

async function main() {
  const client = await pool.connect();

  try {
    console.log('✓ Connected to database');
    await client.query('BEGIN');

    // Insert or update user
    const userResult = await client.query(
      `INSERT INTO users (whatsapp_id, name, current_module_id, is_active, metadata)
       VALUES ($1, $2, 1, true, $3::jsonb)
       ON CONFLICT (whatsapp_id) DO UPDATE
       SET name = EXCLUDED.name,
           is_active = true,
           updated_at = NOW()
       RETURNING id, whatsapp_id, name, created_at`,
      [WHATSAPP_ID, USER_NAME, JSON.stringify({ role: 'developer', added_date: new Date().toISOString().split('T')[0] })]
    );

    const user = userResult.rows[0];
    console.log('✓ User created/updated');

    // Get all modules
    const modulesResult = await client.query('SELECT id FROM modules ORDER BY sequence_order');
    const modules = modulesResult.rows;

    // Initialize progress for all modules
    let progressCount = 0;
    for (const module of modules) {
      const result = await client.query(
        `INSERT INTO user_progress (user_id, module_id, status, progress_percentage)
         VALUES ($1, $2, 'not_started', 0)
         ON CONFLICT (user_id, module_id) DO NOTHING
         RETURNING id`,
        [user.id, module.id]
      );
      if (result.rows.length > 0) progressCount++;
    }

    console.log(`✓ Initialized progress for ${progressCount} modules`);

    await client.query('COMMIT');

    console.log('\n✅ SUCCESS! User added:\n');
    console.log(`   Name: ${user.name}`);
    console.log(`   WhatsApp: ${user.whatsapp_id}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
    console.log('\n📱 You can now:');
    console.log('   1. Login at: http://localhost:3000/user-login.html');
    console.log(`      Enter: ${WHATSAPP_ID}`);
    console.log('   2. Test WhatsApp with your number\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
