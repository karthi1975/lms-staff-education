// Re-index content from PostgreSQL to ChromaDB + Neo4j with Vertex AI

const chromaService = require('../services/chroma.service');
const neo4jService = require('../services/neo4j.service');
const postgresService = require('../services/database/postgres.service');

(async () => {
  try {
    console.log('🔄 Re-indexing content from PostgreSQL to ChromaDB + Neo4j');
    console.log('');

    // Initialize services
    await chromaService.initialize();
    await neo4jService.initialize();
    await postgresService.initialize();

    // Get all content records for modules 13-17 with chunks
    const result = await postgresService.query(`
      SELECT id, module_id, original_name, content_text, chunk_count, metadata
      FROM module_content
      WHERE module_id IN (13, 14, 15, 16, 17)
        AND processed = true
        AND chunk_count > 0
      ORDER BY module_id, id
    `);

    console.log(`Found ${result.rows.length} content records to index`);
    console.log('');

    let totalChunks = 0;

    for (const content of result.rows) {
      console.log(`📦 Processing: ${content.original_name} (Module ${content.module_id})`);
      console.log(`   Chunks: ${content.chunk_count}`);

      if (!content.content_text) {
        console.log('   ⚠️  No content_text, skipping');
        continue;
      }

      // Split content into chunks (1000 chars each)
      const chunkSize = 1000;
      const text = content.content_text;
      const chunks = [];

      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.substring(i, i + chunkSize));
      }

      console.log(`   Created ${chunks.length} chunks from text`);

      // Index each chunk to ChromaDB with Vertex AI
      for (let i = 0; i < chunks.length; i++) {
        await chromaService.addDocument(
          content.module_id,
          chunks[i],
          null, // let it generate embedding
          {
            module_id: content.module_id,
            content_id: content.id,
            source: content.original_name,
            chunk_index: i,
            total_chunks: chunks.length
          }
        );
      }

      // Create Neo4j graph nodes
      const session = neo4jService.driver.session();
      try {
        const query = `
          MATCH (m:Module {id: $moduleId})
          UNWIND range(0, $chunkCount - 1) AS idx
          CREATE (c:ContentChunk {
            id: randomUUID(),
            content_id: $contentId,
            module_id: $moduleId,
            chunk_index: idx,
            source: $source,
            created_at: datetime()
          })
          CREATE (m)-[:HAS_CONTENT]->(c)
          RETURN count(c) as created
        `;

        const graphResult = await session.run(query, {
          moduleId: content.module_id,
          contentId: content.id,
          chunkCount: chunks.length,
          source: content.original_name
        });

        const created = graphResult.records[0].get('created').toNumber();
        console.log(`   ✅ ChromaDB: ${chunks.length} chunks`);
        console.log(`   ✅ Neo4j: ${created} nodes`);
        totalChunks += chunks.length;
      } finally {
        await session.close();
      }

      console.log('');
    }

    console.log('='.repeat(60));
    console.log('🎉 RE-INDEXING COMPLETE!');
    console.log('');
    console.log(`   Total Chunks: ${totalChunks}`);
    console.log(`   Content Records: ${result.rows.length}`);
    console.log(`   ✅ ChromaDB (RAG): ${totalChunks} vectors with Vertex AI embeddings`);
    console.log(`   ✅ Neo4j (GraphDB): ${totalChunks} graph nodes`);
    console.log('');

    await neo4jService.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
