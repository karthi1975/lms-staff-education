/**
 * Fix ChromaDB content - metadata and content are swapped
 * The actual text is stored character-by-character in metadata
 * The content field has chunk labels instead
 */

require('dotenv').config();
const chromaService = require('../services/chroma.service');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

async function fixChromaDBContent() {
  try {
    console.log('\n=== Fixing ChromaDB Content ===\n');

    // Initialize ChromaDB
    await chromaService.initialize();
    console.log('✅ ChromaDB initialized\n');

    // Get all existing documents
    const existing = await chromaService.collection.get({ limit: 1000 });
    console.log(`Found ${existing.ids.length} documents to fix\n`);

    if (existing.ids.length === 0) {
      console.log('No documents to fix. Exiting.');
      process.exit(0);
    }

    // Extract actual content from metadata (character-by-character)
    const fixedDocuments = [];
    for (let i = 0; i < existing.ids.length; i++) {
      const metadata = existing.metadatas[i];
      const chunkLabel = existing.documents[i]; // e.g., "entrepreneurship_chunk_0"

      // Reconstruct actual text from character indices in metadata
      let actualContent = '';
      let charIndex = 0;
      while (metadata[charIndex] !== undefined) {
        actualContent += metadata[charIndex];
        charIndex++;
      }

      if (actualContent.length > 0) {
        console.log(`\nDocument ${i + 1}:`);
        console.log(`  Chunk label: ${chunkLabel}`);
        console.log(`  Actual content: ${actualContent.substring(0, 100)}...`);
        console.log(`  Content length: ${actualContent.length} characters`);

        fixedDocuments.push({
          id: chunkLabel, // Use chunk label as ID
          content: actualContent,
          metadata: {
            module: 'Entrepreneurship & Business Ideas', // Standard module name
            chunk_id: chunkLabel,
            created_at: new Date().toISOString()
          }
        });
      }
    }

    console.log(`\n\n✅ Reconstructed ${fixedDocuments.length} documents\n`);

    // Delete old collection and create new one
    console.log('Deleting old collection...');
    try {
      await chromaService.client.deleteCollection({
        name: chromaService.collection.name
      });
      console.log('✅ Old collection deleted\n');
    } catch (err) {
      console.log('⚠️  Could not delete collection:', err.message);
    }

    // Reinitialize with fresh collection
    await chromaService.initialize();
    console.log('✅ New collection created\n');

    // Add fixed documents
    console.log('Adding fixed documents to ChromaDB...\n');
    for (const doc of fixedDocuments) {
      try {
        await chromaService.addDocument(doc.content, doc.metadata);
        console.log(`  ✅ Added: ${doc.id}`);
      } catch (err) {
        console.error(`  ❌ Failed to add ${doc.id}:`, err.message);
      }
    }

    console.log(`\n\n✅ Successfully fixed ${fixedDocuments.length} documents in ChromaDB!\n`);

    // Verify fix
    console.log('Verifying fix...\n');
    const testQuery = 'What is entrepreneurship?';
    const results = await chromaService.searchSimilar(testQuery, { nResults: 2 });

    console.log(`Test query: "${testQuery}"`);
    console.log(`\nTop 2 results:`);
    results.forEach((result, i) => {
      console.log(`\n--- Result ${i + 1} ---`);
      console.log(`Content: ${result.content.substring(0, 200)}...`);
      console.log(`Module: ${result.metadata?.module}`);
      console.log(`Distance: ${result.distance}`);
    });

    console.log('\n\n=== Fix Complete ===\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error fixing ChromaDB:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

fixChromaDBContent();
