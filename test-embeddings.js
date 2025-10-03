require('dotenv').config();
const embeddingService = require('./services/embedding.service');
const chromaService = require('./services/chroma.service');
const logger = require('./utils/logger');

async function testEmbeddings() {
  logger.info('=== Testing Embedding Service ===\n');

  try {
    // Test 1: Single embedding generation
    logger.info('Test 1: Single Embedding Generation');
    const singleText = 'Effective classroom management strategies for new teachers';
    const singleEmbedding = await embeddingService.generateEmbeddings(singleText);
    logger.info(`✅ Generated embedding with dimension: ${singleEmbedding.length}`);
    logger.info(`   Sample values: [${singleEmbedding.slice(0, 3).map(v => v.toFixed(4)).join(', ')}...]`);

    // Test 2: Batch embedding generation
    logger.info('\nTest 2: Batch Embedding Generation');
    const batchTexts = [
      'Classroom management techniques',
      'Student behavior management',
      'Python programming basics',
      'Lesson planning strategies'
    ];
    const batchEmbeddings = await embeddingService.generateEmbeddings(batchTexts);
    logger.info(`✅ Generated ${batchEmbeddings.length} embeddings`);

    // Test 3: Semantic similarity
    logger.info('\nTest 3: Semantic Similarity Test');
    for (let i = 1; i < batchTexts.length; i++) {
      const similarity = embeddingService.cosineSimilarity(
        batchEmbeddings[0], 
        batchEmbeddings[i]
      );
      logger.info(`   "${batchTexts[0]}" vs "${batchTexts[i]}": ${(similarity * 100).toFixed(1)}%`);
    }

    // Test 4: ChromaDB integration
    logger.info('\nTest 4: ChromaDB Integration');
    await chromaService.initialize();
    
    // Add test documents
    const testDocs = [
      {
        content: 'Effective classroom management involves establishing clear rules and expectations from day one.',
        metadata: { module: 'classroom_management', title: 'Rules and Expectations' }
      },
      {
        content: 'Positive reinforcement is key to encouraging good student behavior.',
        metadata: { module: 'classroom_management', title: 'Positive Reinforcement' }
      },
      {
        content: 'JavaScript is a programming language used for web development.',
        metadata: { module: 'technology', title: 'JavaScript Basics' }
      }
    ];

    logger.info('Adding test documents to ChromaDB...');
    const docIds = await chromaService.addBulkDocuments(testDocs);
    logger.info(`✅ Added ${docIds.length} documents to ChromaDB`);

    // Test 5: Semantic search
    logger.info('\nTest 5: Semantic Search Test');
    const query = 'How to manage student behavior in class?';
    const searchResults = await chromaService.searchSimilar(query, { nResults: 3 });
    
    logger.info(`Query: "${query}"`);
    logger.info('Search Results:');
    searchResults.forEach((result, index) => {
      logger.info(`  ${index + 1}. ${result.metadata.title} (Distance: ${result.distance.toFixed(3)})`);
      logger.info(`     Module: ${result.metadata.module}`);
      logger.info(`     Preview: ${result.content.substring(0, 100)}...`);
    });

    // Test 6: Module-specific search
    logger.info('\nTest 6: Module-specific Search');
    const moduleResults = await chromaService.searchSimilar(
      'behavior management',
      { module: 'classroom_management', nResults: 2 }
    );
    logger.info(`Found ${moduleResults.length} results in classroom_management module`);

    // Test embedding quality
    logger.info('\nTest 7: Embedding Quality Check');
    const qualityCheck = await embeddingService.testEmbeddingQuality();
    if (qualityCheck) {
      logger.info('✅ Embedding quality check passed');
    } else {
      logger.warn('⚠️ Embedding quality may need improvement');
    }

    logger.info('\n=== All Tests Completed Successfully ===');

  } catch (error) {
    logger.error('Test failed:', error);
    
    if (error.message?.includes('auth')) {
      logger.info('\n💡 Authentication Error - Try running:');
      logger.info('   gcloud auth application-default login');
      logger.info('   gcloud config set project staff-education');
    }
    
    process.exit(1);
  }
}

// Run tests
testEmbeddings().catch(console.error);