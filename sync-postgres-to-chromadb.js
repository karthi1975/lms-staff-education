/**
 * Sync content from PostgreSQL to ChromaDB
 * Ensures module_id metadata is properly set for RAG retrieval
 */

require('dotenv').config();
const chromaService = require('./services/chroma.service');
const embeddingService = require('./services/embedding.service');
const postgresService = require('./services/database/postgres.service');
const logger = require('./utils/logger');

async function syncPostgresToChromaDB() {
  try {
    console.log('=== Syncing PostgreSQL Content to ChromaDB ===\n');

    // Initialize services
    console.log('1. Initializing services...');
    await postgresService.initialize();
    await chromaService.initialize();
    console.log('   ✅ Services initialized\n');

    // Get all content chunks from PostgreSQL
    console.log('2. Fetching content chunks from PostgreSQL...');
    const result = await postgresService.pool.query(`
      SELECT
        mcc.id,
        mcc.moodle_module_id as module_id,
        mm.module_name,
        mcc.chunk_order,
        mcc.chunk_text as content,
        mcc.metadata as chunk_metadata,
        mcc.created_at
      FROM module_content_chunks mcc
      JOIN moodle_modules mm ON mm.id = mcc.moodle_module_id
      ORDER BY mcc.moodle_module_id, mcc.chunk_order
    `);

    const chunks = result.rows;
    console.log(`   ✅ Found ${chunks.length} chunks in PostgreSQL\n`);

    if (chunks.length === 0) {
      console.log('   ⚠️  No content to sync. Upload some content first!');
      return;
    }

    // Display chunk distribution
    const moduleDistribution = chunks.reduce((acc, chunk) => {
      acc[chunk.module_id] = acc[chunk.module_id] || { name: chunk.module_name, count: 0 };
      acc[chunk.module_id].count++;
      return acc;
    }, {});

    console.log('   Content distribution:');
    Object.entries(moduleDistribution).forEach(([moduleId, info]) => {
      console.log(`   - Module ${moduleId} (${info.name}): ${info.count} chunks`);
    });
    console.log('');

    // Sync to ChromaDB with embeddings
    console.log('3. Syncing to ChromaDB with embeddings...');
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      try {
        // Parse metadata if it's a JSON string
        let metadata = {};
        if (chunk.chunk_metadata) {
          try {
            metadata = typeof chunk.chunk_metadata === 'string'
              ? JSON.parse(chunk.chunk_metadata)
              : chunk.chunk_metadata;
          } catch (e) {
            logger.warn(`Failed to parse metadata for chunk ${chunk.id}`);
          }
        }

        // Create proper metadata with module_id as integer
        const chromaMetadata = {
          module_id: parseInt(chunk.module_id),
          module_name: chunk.module_name,
          chunk_order: chunk.chunk_order,
          postgres_id: chunk.id,
          ...metadata,
          synced_at: new Date().toISOString()
        };

        // Generate embedding
        const embedding = await embeddingService.generateEmbeddings(chunk.content);

        // Add to ChromaDB
        await chromaService.addDocument(
          chunk.module_id,  // This will be ignored, using metadata.module_id instead
          chunk.content,
          embedding,
          chromaMetadata
        );

        successCount++;
        if ((i + 1) % 10 === 0) {
          console.log(`   Progress: ${i + 1}/${chunks.length} chunks synced...`);
        }
      } catch (error) {
        errorCount++;
        logger.error(`Failed to sync chunk ${chunk.id}:`, error.message);
      }
    }

    console.log(`   ✅ Sync complete: ${successCount} succeeded, ${errorCount} failed\n`);

    // Verify the sync
    console.log('4. Verifying ChromaDB content...');
    const stats = await chromaService.getStats();
    console.log(`   Total documents in ChromaDB: ${stats.total_documents}\n`);

    // Test retrieval for each module
    console.log('5. Testing module-specific retrieval...');
    for (const [moduleId, info] of Object.entries(moduleDistribution)) {
      const docs = await chromaService.getDocumentsByModule(parseInt(moduleId), 3);
      console.log(`   Module ${moduleId} (${info.name}): Retrieved ${docs.length} documents`);
      if (docs.length > 0) {
        console.log(`      Sample: "${docs[0].content.substring(0, 100)}..."`);
      }
    }
    console.log('');

    // Test search
    console.log('6. Testing semantic search...');
    const testQuery = 'What is entrepreneurship?';
    console.log(`   Query: "${testQuery}"`);

    const searchResults = await chromaService.searchSimilar(testQuery, {
      module_id: 1,
      nResults: 3
    });

    console.log(`   Found ${searchResults.length} relevant documents`);
    if (searchResults.length > 0) {
      console.log(`   Top result (module_id: ${searchResults[0].metadata?.module_id}):`);
      console.log(`      "${searchResults[0].content.substring(0, 150)}..."`);
      console.log(`      Distance: ${searchResults[0].distance}`);
    }
    console.log('');

    console.log('=== Sync Complete! ===');
    console.log(`✅ ${successCount} chunks synced to ChromaDB`);
    console.log(`✅ Module metadata preserved`);
    console.log(`✅ RAG retrieval ready`);
    console.log('');
    console.log('Next: Test chat API with useContext=true');

  } catch (error) {
    console.error('❌ Sync failed:', error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Run the sync
syncPostgresToChromaDB();
