/**
 * Migration Script: Move content from old chromaService to new BilingualChroma
 *
 * This script migrates all existing documents from the old 'teachers_training'
 * collection to the new bilingual collections (english/swahili/mixed).
 */

const chromaService = require('../services/chroma.service');
const bilingualChroma = require('../services/bilingual-chroma.service');
const logger = require('../utils/logger');

async function migrateToMultilingualCollections() {
  console.log('\n🔄 Starting migration from old chromaService to BilingualChroma...\n');

  try {
    // Step 1: Initialize both services
    console.log('1️⃣ Initializing ChromaDB services...');
    await chromaService.initialize();
    await bilingualChroma.initialize();

    // Step 2: Get all documents from old collection
    console.log('\n2️⃣ Fetching all documents from old collection...');
    const oldStats = await chromaService.getStats();
    console.log(`   Found ${oldStats.total_documents} documents in old collection`);

    if (oldStats.total_documents === 0) {
      console.log('✅ No documents to migrate. Exiting.');
      return;
    }

    // Step 3: Fetch all documents (ChromaDB doesn't have a "get all" with pagination,
    // so we'll use get() with a large limit)
    const allDocs = await chromaService.collection.get({
      limit: oldStats.total_documents
    });

    console.log(`\n3️⃣ Retrieved ${allDocs.ids.length} documents`);

    // Step 4: Group documents by language and migrate
    let migratedCount = { english: 0, swahili: 0, mixed: 0, failed: 0 };
    const BATCH_SIZE = 50; // Process in batches

    console.log(`\n4️⃣ Migrating documents in batches of ${BATCH_SIZE}...\n`);

    for (let i = 0; i < allDocs.ids.length; i += BATCH_SIZE) {
      const batchEnd = Math.min(i + BATCH_SIZE, allDocs.ids.length);
      console.log(`   Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (docs ${i + 1}-${batchEnd})...`);

      for (let j = i; j < batchEnd; j++) {
        try {
          const id = allDocs.ids[j];
          const content = allDocs.documents[j];
          const metadata = allDocs.metadatas[j];
          const embedding = allDocs.embeddings ? allDocs.embeddings[j] : null;

          // Detect language from metadata or content
          let language = 'english'; // default
          if (metadata && metadata.language) {
            language = metadata.language;
          }

          // Extract course_id and module_id from metadata
          const courseId = metadata?.course_id || metadata?.courseId;
          const moduleId = metadata?.module_id || metadata?.moduleId;

          // Add to appropriate bilingual collection (using object parameter)
          await bilingualChroma.addDocument({
            content: content,
            language: language,
            metadata: {
              ...metadata,
              original_id: id, // Keep reference to old ID
              migrated_at: new Date().toISOString()
            },
            embedding: embedding, // Reuse existing embedding if available
            courseId: courseId,
            moduleId: moduleId
          });

          migratedCount[language]++;

        } catch (docError) {
          logger.error(`Failed to migrate document ${j}:`, docError.message);
          migratedCount.failed++;
        }
      }
    }

    // Step 5: Verify migration
    console.log('\n5️⃣ Verifying migration...');
    const newStats = await bilingualChroma.getStats();

    console.log('\n📊 Migration Results:');
    console.log(`   ✅ English:  ${migratedCount.english} documents`);
    console.log(`   ✅ Swahili:  ${migratedCount.swahili} documents`);
    console.log(`   ✅ Mixed:    ${migratedCount.mixed} documents`);
    console.log(`   ❌ Failed:   ${migratedCount.failed} documents`);
    console.log(`   📈 Total:    ${migratedCount.english + migratedCount.swahili + migratedCount.mixed} / ${oldStats.total_documents}`);

    console.log('\n🔍 BilingualChroma Collection Counts:');
    const engCount = await bilingualChroma.collections.english.count();
    const swaCount = await bilingualChroma.collections.swahili.count();
    const mixCount = await bilingualChroma.collections.mixed.count();
    console.log(`   English:  ${engCount}`);
    console.log(`   Swahili:  ${swaCount}`);
    console.log(`   Mixed:    ${mixCount}`);

    const totalMigrated = migratedCount.english + migratedCount.swahili + migratedCount.mixed;
    if (totalMigrated === oldStats.total_documents) {
      console.log('\n✅ Migration completed successfully! All documents migrated.\n');
    } else {
      console.log(`\n⚠️  Migration completed with warnings. ${oldStats.total_documents - totalMigrated} documents missing.\n`);
    }

    console.log('ℹ️  Note: Old collection is preserved. To delete it, run:');
    console.log('   docker exec teachers_training_app_1 node -e "const { ChromaClient } = require(\'chromadb\'); (async () => { const client = new ChromaClient({ path: \'http://172.17.0.1:8000\' }); await client.deleteCollection({ name: \'teachers_training\' }); console.log(\'✅ Deleted old collection\'); })();"');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  migrateToMultilingualCollections()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { migrateToMultilingualCollections };
