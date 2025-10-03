require('dotenv').config();
const documentProcessor = require('./services/document-processor.service');
const fs = require('fs').promises;

async function testMetadata() {
  const content = `
# Classroom Management

This is a test document about classroom management strategies.
It includes important concepts and practical applications.
  `.trim();
  
  const filePath = '/tmp/test-doc.txt';
  await fs.writeFile(filePath, content);
  
  const chunks = await documentProcessor.processDocument(filePath, {
    module: 'test_module',
    title: 'Test Title',
    filename: 'test.txt'
  });
  
  console.log('Chunks created:', chunks.length);
  console.log('\nMetadata structure:');
  console.log(JSON.stringify(chunks[0]?.metadata, null, 2));
  
  // Check for problematic values
  const metadata = chunks[0]?.metadata || {};
  for (const [key, value] of Object.entries(metadata)) {
    const type = typeof value;
    if (type === 'object' && value !== null) {
      console.log(`WARNING: ${key} is an object:`, value);
    } else if (Array.isArray(value)) {
      console.log(`WARNING: ${key} is an array:`, value);
    } else if (type === 'number' && !isFinite(value)) {
      console.log(`WARNING: ${key} has invalid number:`, value);
    }
  }
}

testMetadata().catch(console.error);