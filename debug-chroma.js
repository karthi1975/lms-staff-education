const { ChromaClient } = require('chromadb');

async function debugChroma() {
  try {
    const client = new ChromaClient({
      path: process.env.CHROMA_URL || 'http://localhost:8000'
    });

    console.log('1. Testing basic connection...');
    const heartbeat = await client.heartbeat();
    console.log('   Heartbeat:', heartbeat);

    console.log('\n2. Listing collections...');
    const collections = await client.listCollections();
    console.log('   Collections:', collections);

    console.log('\n3. Creating test collection...');
    // Delete if exists
    try {
      await client.deleteCollection({ name: 'test_debug' });
    } catch (e) {}
    
    const collection = await client.createCollection({
      name: 'test_debug'
    });
    console.log('   Collection created:', collection.name);

    console.log('\n4. Testing simple add...');
    // Create a simple embedding
    const embedding = new Array(768).fill(0).map((_, i) => i / 768);
    
    try {
      await collection.add({
        ids: ['test1'],
        embeddings: [embedding],
        documents: ['Test document'],
        metadatas: [{ test: 'value' }]
      });
      console.log('   ✅ Simple add successful');
    } catch (error) {
      console.log('   ❌ Simple add failed:', error.message);
      console.log('   Response:', error.response?.data);
    }

    console.log('\n5. Testing with complex metadata...');
    try {
      await collection.add({
        ids: ['test2'],
        embeddings: [embedding],
        documents: ['Test document 2'],
        metadatas: [{
          test: 'value',
          number: 123,
          boolean: true,
          nested: { key: 'value' }, // This might cause issues
          array: ['item1', 'item2'] // This might cause issues
        }]
      });
      console.log('   ✅ Complex metadata add successful');
    } catch (error) {
      console.log('   ❌ Complex metadata add failed:', error.message);
    }

    console.log('\n6. Testing query...');
    const results = await collection.query({
      queryEmbeddings: [embedding],
      nResults: 2
    });
    console.log('   Results found:', results.ids[0].length);

    // Cleanup
    await client.deleteCollection({ name: 'test_debug' });
    console.log('\n✅ Debug complete');
    
  } catch (error) {
    console.error('Debug failed:', error);
  }
}

// For Docker
if (process.env.CHROMA_URL) {
  debugChroma();
} else {
  process.env.CHROMA_URL = 'http://chromadb:8000';
  debugChroma();
}