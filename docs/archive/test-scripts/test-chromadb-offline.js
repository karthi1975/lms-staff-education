/**
 * Offline test for ChromaDB RAG integration
 * Tests ChromaDB content search for "Introduction to Teaching" module
 */

require('dotenv').config();
const chromaService = require('./services/chroma.service');

async function testChromaDB() {
  try {
    console.log('=== ChromaDB Offline Test ===\n');

    // Initialize ChromaDB
    console.log('1. Initializing ChromaDB...');
    await chromaService.initialize();
    console.log('✅ ChromaDB initialized\n');

    // Get stats
    console.log('2. Getting ChromaDB stats...');
    const stats = await chromaService.getStats();
    console.log('Stats:', JSON.stringify(stats, null, 2));
    console.log('');

    // Get documents for module_1 (Introduction to Teaching)
    console.log('3. Getting all documents for module_1 (Introduction to Teaching)...');
    const module1Docs = await chromaService.getDocumentsByModule('module_1', 10);
    console.log(`Found ${module1Docs.length} documents for module_1`);

    if (module1Docs.length > 0) {
      console.log('\nFirst 3 documents:');
      module1Docs.slice(0, 3).forEach((doc, idx) => {
        console.log(`\n[Document ${idx + 1}]`);
        console.log('Metadata:', JSON.stringify(doc.metadata, null, 2));
        console.log('Content preview:', doc.content.substring(0, 200) + '...');
      });
    } else {
      console.log('⚠️  No documents found for module_1');
    }
    console.log('');

    // Test search with sample queries
    const testQueries = [
      'What is entrepreneurship & business ideas?',
      'Tell me about effective teaching',
      'How to manage a classroom'
    ];

    console.log('4. Testing search queries...\n');
    for (const query of testQueries) {
      console.log(`Query: "${query}"`);

      // Search with module filter
      const resultsWithModule = await chromaService.searchSimilar(query, {
        module: 'module_1',
        nResults: 3
      });

      console.log(`  Results WITH module filter: ${resultsWithModule.length}`);
      if (resultsWithModule.length > 0) {
        console.log('  Top result:');
        console.log('    Module:', resultsWithModule[0].metadata?.module);
        console.log('    Title:', resultsWithModule[0].metadata?.title || 'Untitled');
        console.log('    Preview:', resultsWithModule[0].content.substring(0, 150) + '...');
      }

      // Search without module filter
      const resultsWithoutModule = await chromaService.searchSimilar(query, {
        nResults: 3
      });

      console.log(`  Results WITHOUT module filter: ${resultsWithoutModule.length}`);
      if (resultsWithoutModule.length > 0) {
        console.log('  Top result:');
        console.log('    Module:', resultsWithoutModule[0].metadata?.module);
        console.log('    Title:', resultsWithoutModule[0].metadata?.title || 'Untitled');
        console.log('    Preview:', resultsWithoutModule[0].content.substring(0, 150) + '...');
      }

      console.log('');
    }

    console.log('=== Test Complete ===');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
  }
}

testChromaDB();
