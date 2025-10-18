/**
 * Check Content Processing Stats
 */

const postgresService = require('../services/database/postgres.service');
const chromaService = require('../services/chroma.service');

async function checkStats() {
  try {
    // Initialize services
    await postgresService.initialize();
    console.log('✅ Database connected\n');

    await chromaService.initialize();
    console.log('✅ ChromaDB connected\n');

    // Get PostgreSQL stats
    const pgResult = await postgresService.query(`
      SELECT
        COUNT(*) as total_files,
        COUNT(*) FILTER (WHERE chunk_count > 0) as files_with_chunks,
        COUNT(*) FILTER (WHERE processed = true) as files_processed,
        SUM(chunk_count) as total_chunks
      FROM module_content
    `);

    console.log('📊 PostgreSQL Stats:');
    console.log(JSON.stringify(pgResult.rows[0], null, 2));
    console.log('');

    // Get ChromaDB stats
    const chromaStats = await chromaService.getStats();
    console.log('📊 ChromaDB Stats:');
    console.log(JSON.stringify(chromaStats, null, 2));
    console.log('');

    // Check if we need to reset
    const pg = pgResult.rows[0];
    if (parseInt(pg.total_chunks) > 0 && chromaStats.total_documents === 0) {
      console.log('⚠️  WARNING: Database shows chunks but ChromaDB is empty!');
      console.log('Need to reset processed flags to trigger reprocessing.\n');
    } else if (chromaStats.total_documents > 0) {
      console.log('✅ ChromaDB has embeddings stored!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkStats();
