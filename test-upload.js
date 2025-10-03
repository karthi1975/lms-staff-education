require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const documentProcessor = require('./services/document-processor.service');
const chromaService = require('./services/chroma.service');
const embeddingService = require('./services/embedding.service');
const logger = require('./utils/logger');

async function testUpload() {
  try {
    console.log('=== Testing Document Upload Process ===\n');
    
    // Step 1: Initialize services
    console.log('1. Initializing ChromaDB...');
    await chromaService.initialize();
    console.log('   ✅ ChromaDB initialized\n');
    
    // Step 2: Create test document
    const testContent = `
# Classroom Management Strategies

## Introduction
Effective classroom management is essential for creating a positive learning environment. 
This document outlines key strategies for new teachers.

## Key Strategies

### 1. Establish Clear Rules
- Create simple, positive rules
- Display them prominently
- Review regularly with students
- Be consistent in enforcement

### 2. Build Relationships
Building positive relationships with students is crucial for classroom management.
- Learn student names quickly
- Show interest in their lives
- Be fair and respectful
- Create a welcoming environment

### 3. Use Positive Reinforcement
- Recognize good behavior immediately
- Use specific praise
- Implement reward systems
- Celebrate class achievements

## Conclusion
Effective classroom management requires consistency, patience, and positive relationships.
With these strategies, new teachers can create engaging and productive learning environments.
    `.trim();
    
    const testFilePath = path.join(__dirname, 'test-document.txt');
    await fs.writeFile(testFilePath, testContent);
    console.log('2. Created test document with', testContent.length, 'characters\n');
    
    // Step 3: Process document
    console.log('3. Processing document into chunks...');
    const chunks = await documentProcessor.processDocument(testFilePath, {
      module: 'test_module',
      title: 'Classroom Management Guide',
      filename: 'test-document.txt'
    });
    
    console.log(`   ✅ Created ${chunks.length} chunks:`);
    chunks.forEach((chunk, index) => {
      console.log(`   - Chunk ${index + 1}: ${chunk.content.substring(0, 50)}...`);
      console.log(`     Words: ${chunk.metadata.word_count}, Concepts: ${chunk.metadata.concepts.join(', ')}`);
    });
    console.log();
    
    // Step 4: Test embedding generation
    console.log('4. Testing embedding generation...');
    const testText = chunks[0]?.content || testContent.substring(0, 200);
    const embedding = await embeddingService.generateEmbeddings(testText);
    console.log(`   ✅ Generated embedding with dimension: ${embedding.length}`);
    console.log(`   Sample values: [${embedding.slice(0, 3).map(v => v.toFixed(4)).join(', ')}...]\n`);
    
    // Step 5: Add chunks to ChromaDB
    console.log('5. Adding chunks to ChromaDB...');
    const docIds = [];
    for (const chunk of chunks) {
      try {
        const docId = await chromaService.addDocument(chunk.content, chunk.metadata);
        docIds.push(docId);
        console.log(`   ✅ Added chunk with ID: ${docId}`);
      } catch (err) {
        console.error(`   ❌ Failed to add chunk:`, err.message);
      }
    }
    console.log();
    
    // Step 6: Test search
    console.log('6. Testing search functionality...');
    const query = 'How to manage student behavior?';
    const searchResults = await chromaService.searchSimilar(query, { nResults: 3 });
    console.log(`   Query: "${query}"`);
    console.log(`   Found ${searchResults.length} results:`);
    searchResults.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.content.substring(0, 100)}...`);
      console.log(`      Distance: ${result.distance}`);
    });
    
    // Clean up
    await fs.unlink(testFilePath);
    console.log('\n=== Test Completed Successfully ===');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testUpload().catch(console.error);