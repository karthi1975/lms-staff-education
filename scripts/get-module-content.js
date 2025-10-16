const chromaService = require('../services/chroma.service');
const postgresService = require('../services/database/postgres.service');

async function getContentByModule() {
  await postgresService.initialize();
  await chromaService.initialize();

  // Get all modules
  const modulesResult = await postgresService.query(`
    SELECT m.id, m.title, m.description
    FROM modules m
    JOIN courses c ON m.course_id = c.id
    WHERE c.title LIKE '%Business%'
    ORDER BY m.sequence_order
  `);

  console.log('=== MODULES ===');
  modulesResult.rows.forEach(m => {
    console.log(`Module ${m.id}: ${m.title}`);
  });

  // Get all content from module_content
  const contentResult = await postgresService.query(`
    SELECT mc.id, mc.module_id, mc.filename,
           SUBSTRING(mc.processed_content, 1, 1000) as content_sample
    FROM module_content mc
    JOIN modules m ON mc.module_id = m.id
    JOIN courses c ON m.course_id = c.id
    WHERE c.title LIKE '%Business%' AND mc.processed = true
    ORDER BY mc.module_id, mc.filename
  `);

  console.log('\n=== CONTENT BY MODULE ===');
  const byModule = {};
  contentResult.rows.forEach(row => {
    if (!byModule[row.module_id]) {
      byModule[row.module_id] = [];
    }
    byModule[row.module_id].push({
      filename: row.filename,
      sample: row.content_sample
    });
  });

  Object.keys(byModule).forEach(modId => {
    console.log(`\nModule ${modId}:`);
    byModule[modId].forEach(c => {
      console.log(`  - ${c.filename}`);
      console.log(`    ${c.sample.substring(0, 200).replace(/\n/g, ' ')}...`);
    });
  });

  process.exit(0);
}

getContentByModule().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
