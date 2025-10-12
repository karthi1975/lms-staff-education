/**
 * Database Migration Runner
 * Runs SQL migration files safely
 */

const fs = require('fs').promises;
const path = require('path');
const postgresService = require('../services/database/postgres.service');

async function runMigration(migrationFile) {
  console.log(`\n🔄 Running migration: ${migrationFile}`);

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations', migrationFile);
    const sql = await fs.readFile(migrationPath, 'utf8');

    // Run migration
    await postgresService.query(sql);

    console.log(`✅ Migration completed: ${migrationFile}`);
    return true;
  } catch (error) {
    console.error(`❌ Migration failed: ${migrationFile}`);
    console.error(error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting database migrations...\n');

  try {
    // Initialize PostgreSQL connection
    await postgresService.initialize();
    console.log('✅ Database connected\n');

    // Run migrations
    const migration1 = await runMigration('002_add_source_columns.sql');
    const migration2 = await runMigration('003_add_moodle_settings.sql');
    const success = migration1 && migration2;

    if (success) {
      console.log('\n🎉 All migrations completed successfully!');
    } else {
      console.log('\n⚠️  Some migrations failed. Please check errors above.');
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { runMigration };
