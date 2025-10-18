/**
 * Reprocess All Content Files
 * Triggers reprocessing of all uploaded content that failed to generate chunks
 */

const postgresService = require('../services/database/postgres.service');
const documentProcessor = require('../services/document-processor.service');
const chromaService = require('../services/chroma.service');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

async function reprocessAllContent() {
  try {
    console.log('🔄 Starting content reprocessing...\n');

    // Initialize services
    await postgresService.initialize();
    console.log('✅ Database connected\n');

    // IMPORTANT: Initialize ChromaDB collection
    console.log('🔄 Initializing ChromaDB collection...');
    await chromaService.initialize();
    console.log('✅ ChromaDB initialized\n');

    // Get all content files with 0 chunks
    const result = await postgresService.query(`
      SELECT id, file_path, module_id, original_name, file_name
      FROM module_content
      WHERE chunk_count = 0 OR processed = false
      ORDER BY module_id, id
    `);

    const files = result.rows;
    console.log(`📁 Found ${files.length} files to reprocess\n`);

    if (files.length === 0) {
      console.log('✅ All files already processed!');
      process.exit(0);
    }

    let processed = 0;
    let failed = 0;

    for (const file of files) {
      console.log(`\n📄 Processing: ${file.original_name} (Module ${file.module_id})`);
      console.log(`   File Path: ${file.file_path}`);

      try {
        // Check if file exists
        const filePath = file.file_path;
        let fileExists = false;

        try {
          await fs.access(filePath);
          fileExists = true;
        } catch (err) {
          console.log(`   ⚠️  File not found at: ${filePath}`);
          // Try without timestamp prefix
          const filenameWithoutTimestamp = file.original_name;
          const altPath = path.join(path.dirname(filePath), filenameWithoutTimestamp);
          try {
            await fs.access(altPath);
            fileExists = true;
            console.log(`   ✅ Found at: ${altPath}`);
          } catch (err2) {
            console.log(`   ❌ Cannot find file, skipping...`);
            failed++;
            continue;
          }
        }

        // Update status to processing
        await postgresService.query(
          `UPDATE module_content
           SET processed = false, uploaded_at = NOW()
           WHERE id = $1`,
          [file.id]
        );

        // Process document
        const metadata = {
          module_id: file.module_id,
          content_id: file.id,
          original_file: file.original_name,
          source: file.original_name
        };

        console.log('   🔄 Extracting text and creating chunks...');
        const chunks = await documentProcessor.processDocument(filePath, metadata);

        if (chunks.length === 0) {
          console.log('   ❌ No chunks generated');
          await postgresService.query(
            `UPDATE module_content
             SET processed = false,
                 chunk_count = 0,
                 uploaded_at = NOW()
             WHERE id = $1`,
            [file.id]
          );
          failed++;
          continue;
        }

        console.log(`   ✅ Generated ${chunks.length} chunks`);
        console.log('   🔄 Creating embeddings and storing in ChromaDB...');

        // Add chunks to ChromaDB
        let embeddingCount = 0;
        for (const chunk of chunks) {
          try {
            await chromaService.addDocument(chunk.content, chunk.metadata);
            embeddingCount++;
          } catch (err) {
            console.log(`   ⚠️  Failed to add chunk: ${err.message}`);
          }
        }

        console.log(`   ✅ Stored ${embeddingCount} embeddings in ChromaDB`);

        // Update database
        await postgresService.query(
          `UPDATE module_content
           SET chunk_count = $1,
               processed = true,
               processed_at = NOW(),
               uploaded_at = NOW()
           WHERE id = $2`,
          [chunks.length, file.id]
        );

        console.log(`   ✅ Database updated`);
        processed++;

      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        await postgresService.query(
          `UPDATE module_content
           SET processed = false,
               uploaded_at = NOW()
           WHERE id = $1`,
          [file.id]
        );
        failed++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 REPROCESSING SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully processed: ${processed} files`);
    console.log(`❌ Failed: ${failed} files`);
    console.log(`📦 Total: ${files.length} files`);
    console.log('='.repeat(60) + '\n');

    // Show final stats
    const statsResult = await postgresService.query(`
      SELECT
        COUNT(*) as total_files,
        COUNT(*) FILTER (WHERE chunk_count > 0) as files_with_chunks,
        SUM(chunk_count) as total_chunks
      FROM module_content
    `);

    const stats = statsResult.rows[0];
    console.log('📈 FINAL CONTENT STATISTICS');
    console.log('='.repeat(60));
    console.log(`Total Files: ${stats.total_files}`);
    console.log(`Files with Chunks: ${stats.files_with_chunks}`);
    console.log(`Total Chunks: ${stats.total_chunks}`);
    console.log('='.repeat(60) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  reprocessAllContent();
}

module.exports = { reprocessAllContent };
