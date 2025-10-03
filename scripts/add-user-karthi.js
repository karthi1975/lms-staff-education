#!/usr/bin/env node

/**
 * Add Karthi as a user for WhatsApp testing
 */

require('dotenv').config();
const postgresService = require('../services/database/postgres.service');
const logger = require('../utils/logger');

const WHATSAPP_ID = '+18016809129';
const USER_NAME = 'Karthi';

async function main() {
  // Initialize postgres service
  await postgresService.initialize();
  const pool = postgresService.getPool();
  const client = await pool.connect();

  try {
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
    logger.info('User created/updated:', user);

    // Get all modules
    const modulesResult = await client.query('SELECT id FROM modules ORDER BY sequence_order');
    const modules = modulesResult.rows;

    // Initialize progress for all modules
    for (const module of modules) {
      await client.query(
        `INSERT INTO user_progress (user_id, module_id, status, progress_percentage)
         VALUES ($1, $2, 'not_started', 0)
         ON CONFLICT (user_id, module_id) DO NOTHING`,
        [user.id, module.id]
      );
    }

    logger.info(`Initialized progress for ${modules.length} modules`);

    await client.query('COMMIT');

    logger.info('\n✅ User added successfully!');
    logger.info(`   WhatsApp: ${user.whatsapp_id}`);
    logger.info(`   Name: ${user.name}`);
    logger.info(`   User ID: ${user.id}`);
    logger.info(`   Created: ${user.created_at}`);
    logger.info('\nYou can now:');
    logger.info(`1. Login at: http://localhost:3000/user-login.html`);
    logger.info(`   Enter: ${WHATSAPP_ID}`);
    logger.info('2. Test WhatsApp interactions');

    process.exit(0);

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error adding user:', error);
    process.exit(1);
  } finally {
    client.release();
    await postgresService.close();
  }
}

main();
