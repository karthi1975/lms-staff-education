/**
 * Check Neo4j Graph Stats
 */

const neo4jService = require('../services/neo4j.service');

async function checkGraph() {
  try {
    await neo4jService.initialize();
    console.log('✅ Neo4j connected\n');

    // Count nodes by type
    const result = await neo4jService.runQuery(`
      MATCH (n)
      RETURN labels(n)[0] as nodeType, count(n) as count
      ORDER BY count DESC
    `);

    console.log('📊 Neo4j Graph Statistics:\n');
    console.log('Node Type                Count');
    console.log('─────────────────────────────────');

    let totalNodes = 0;
    result.records.forEach(record => {
      const nodeType = record.get('nodeType') || 'Unknown';
      const count = record.get('count').toNumber();
      totalNodes += count;
      console.log(`${nodeType.padEnd(25)} ${count}`);
    });

    console.log('─────────────────────────────────');
    console.log(`Total Nodes:              ${totalNodes}\n`);

    // Count relationships
    const relResult = await neo4jService.runQuery(`
      MATCH ()-[r]->()
      RETURN type(r) as relType, count(r) as count
      ORDER BY count DESC
    `);

    console.log('Relationship Type        Count');
    console.log('─────────────────────────────────');

    let totalRels = 0;
    relResult.records.forEach(record => {
      const relType = record.get('relType');
      const count = record.get('count').toNumber();
      totalRels += count;
      console.log(`${relType.padEnd(25)} ${count}`);
    });

    console.log('─────────────────────────────────');
    console.log(`Total Relationships:      ${totalRels}\n`);

    // Sample some content chunks
    const sampleResult = await neo4jService.runQuery(`
      MATCH (m:Module)-[:HAS_CONTENT]->(chunk:ContentChunk)
      RETURN m.id as module_id, count(chunk) as chunk_count
      ORDER BY chunk_count DESC
      LIMIT 5
    `);

    if (sampleResult.records.length > 0) {
      console.log('📚 Modules with Content Chunks:\n');
      console.log('Module ID    Chunk Count');
      console.log('─────────────────────────');
      sampleResult.records.forEach(record => {
        const moduleId = record.get('module_id');
        const chunkCount = record.get('chunk_count').toNumber();
        console.log(`${String(moduleId).padEnd(13)} ${chunkCount}`);
      });
      console.log('');
    }

    await neo4jService.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkGraph();
