#!/usr/bin/env node
/**
 * Reindex all module content into ChromaDB
 * Reads content from module_content table, generates embeddings, and stores in ChromaDB
 */

require('dotenv').config();
const contentService = require('../services/content.service');
const chromaService = require('../services/chroma.service');
const postgresService = require('../services/database/postgres.service');
const logger = require('../utils/logger');

async function reindexChromaDB() {
  try {
    console.log('🔄 Starting ChromaDB reindexing...\n');

    // Initialize services
    await postgresService.initialize();
    await chromaService.initialize();

    // Get ChromaDB stats before
    const statsBefore = await chromaService.getStats();
    console.log(`📊 ChromaDB before: ${statsBefore.total_documents} documents\n`);

    // Get all processed content from database
    const result = await postgresService.pool.query(
      `SELECT mc.*, m.title as module_title, m.id as module_id
       FROM module_content mc
       JOIN modules m ON mc.module_id = m.id
       WHERE mc.processed = true AND mc.content_text IS NOT NULL
       ORDER BY mc.module_id, mc.id`
    );

    const contents = result.rows;
    console.log(`✅ Found ${contents.length} processed content items in database\n`);

    if (contents.length === 0) {
      console.log('⚠️  No content to reindex. Upload some content first.');
      process.exit(0);
    }

    let successCount = 0;
    let errorCount = 0;

    // Process each content item
    for (const content of contents) {
      try {
        console.log(`\n📄 Processing: ${content.original_name} (Module: ${content.module_title})`);
        console.log(`   Content ID: ${content.id}, Module ID: ${content.module_id}`);
        console.log(`   File path: ${content.file_path}`);

        // Check if file exists
        const fs = require('fs').promises;
        try {
          await fs.access(content.file_path);
        } catch (err) {
          console.log(`   ⚠️  Warning: File not found at ${content.file_path}, using stored text`);
        }

        // Delete existing embeddings for this content
        console.log(`   🗑️  Cleaning old embeddings...`);
        await chromaService.deleteByMetadata({ content_id: content.id });

        // Reprocess the content (will chunk, embed, and store in ChromaDB)
        console.log(`   ⚙️  Reprocessing and generating embeddings...`);
        await contentService.processContent(content.id, content.file_path);

        successCount++;
        console.log(`   ✅ Success! Reindexed content ${content.id}`);
      } catch (error) {
        errorCount++;
        console.error(`   ❌ Error processing content ${content.id}:`, error.message);
      }
    }

    // Get ChromaDB stats after
    const statsAfter = await chromaService.getStats();
    console.log(`\n\n📊 ChromaDB after: ${statsAfter.total_documents} documents`);
    console.log(`📈 Added: ${statsAfter.total_documents - statsBefore.total_documents} document chunks\n`);

    console.log('📋 Summary:');
    console.log(`   ✅ Success: ${successCount} content items`);
    console.log(`   ❌ Errors: ${errorCount} content items`);

    if (errorCount === 0) {
      console.log('\n🎉 All content successfully reindexed into ChromaDB!');
    } else {
      console.log('\n⚠️  Some content failed to reindex. Check errors above.');
    }

    process.exit(errorCount === 0 ? 0 : 1);

  } catch (error) {
    console.error('❌ Fatal error during reindexing:', error);
    process.exit(1);
  }
}

// Run the reindexing
reindexChromaDB();
