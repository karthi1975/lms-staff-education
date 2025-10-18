/**
 * Reset Content for Reprocessing
 * Marks all content as unprocessed to trigger reprocessing with ChromaDB
 */

const postgresService = require('../services/database/postgres.service');

async function resetContent() {
  try {
    await postgresService.initialize();
    console.log('✅ Database connected\n');

    // Reset all content to unprocessed
    const result = await postgresService.query(`
      UPDATE module_content
      SET processed = false,
          chunk_count = 0
      WHERE processed = true
      RETURNING id, original_name, module_id
    `);

    console.log(`✅ Reset ${result.rowCount} files for reprocessing`);
    console.log('');

    if (result.rowCount > 0) {
      console.log('Files to be reprocessed:');
      result.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. ${row.original_name} (Module ${row.module_id})`);
      });
    }

    console.log('\nRun: node scripts/reprocess-all-content.js');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

resetContent();
