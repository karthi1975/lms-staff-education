/**
 * Analyze metadata distribution in BilingualChroma collection
 */

const bilingualChroma = require('../services/bilingual-chroma.service');
const postgresService = require('../services/database/postgres.service');

async function analyzeMetadata() {
  try {
    await bilingualChroma.initialize();

    // Check what course_id 'Business Studies Orientation' has
    const courseResult = await postgresService.pool.query(
      `SELECT id, title FROM courses WHERE title LIKE '%Business%' LIMIT 5`
    );
    console.log('\n📚 Courses with "Business" in title:');
    courseResult.rows.forEach(r => console.log(`  ID: ${r.id}, Title: ${r.title}`));

    // Check modules for Business Studies
    const moduleResult = await postgresService.pool.query(
      `SELECT id, course_id, title FROM modules WHERE title LIKE '%Pedagogical%' AND title LIKE '%Business%' LIMIT 3`
    );
    console.log('\n📖 Modules with "Pedagogical" and "Business":');
    moduleResult.rows.forEach(r => console.log(`  Module ID: ${r.id}, Course ID: ${r.course_id}, Title: ${r.title}`));

    // Get all documents to analyze metadata
    const collection = bilingualChroma.collections.english;
    const totalCount = await collection.count();
    console.log(`\n📊 Total documents in English collection: ${totalCount}`);

    const docs = await collection.get({ limit: totalCount });

    console.log('\n🔍 Analyzing metadata of all documents...');
    const courseIds = {};
    const moduleIds = {};

    docs.metadatas.forEach(meta => {
      const cid = meta.course_id || 'undefined';
      const mid = meta.module_id || 'undefined';
      courseIds[cid] = (courseIds[cid] || 0) + 1;
      moduleIds[mid] = (moduleIds[mid] || 0) + 1;
    });

    console.log('\n📈 Course ID distribution:');
    Object.entries(courseIds)
      .sort((a,b) => b[1] - a[1])
      .forEach(([id, count]) => {
        console.log(`  course_id=${id}: ${count} docs`);
      });

    console.log('\n📈 Module ID distribution (top 10):');
    Object.entries(moduleIds)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([id, count]) => {
        console.log(`  module_id=${id}: ${count} docs`);
      });

    // Sample a few documents with their content
    console.log('\n📄 Sample documents:');
    for (let i = 0; i < Math.min(3, docs.documents.length); i++) {
      const doc = docs.documents[i];
      const meta = docs.metadatas[i];
      console.log(`\nDoc ${i+1}:`);
      console.log(`  Content preview: ${doc.substring(0, 100)}...`);
      console.log(`  course_id: ${meta.course_id}, module_id: ${meta.module_id}`);
    }

    await postgresService.pool.end();

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

analyzeMetadata()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
