/**
 * Diagnostic script to check RAG retrieval and module_id filtering
 */

const chromaService = require('./services/chroma.service');
const postgresService = require('./services/postgres.service');

async function checkRAGRetrieval() {
  try {
    console.log('🔍 RAG Retrieval Diagnostic');
    console.log('===========================\n');

    // Initialize services
    await chromaService.initialize();
    await postgresService.initialize();

    // 1. Check courses in database
    console.log('📚 Courses in Database:');
    const coursesResult = await postgresService.query('SELECT id, code, title FROM courses ORDER BY id');
    coursesResult.rows.forEach(c => {
      console.log(`  [ID: ${c.id}] ${c.code} - ${c.title}`);
    });
    console.log('');

    // 2. Check modules in database
    console.log('📖 Modules in Database:');
    const modulesResult = await postgresService.query('SELECT id, course_id, title FROM course_modules ORDER BY id');
    modulesResult.rows.forEach(m => {
      console.log(`  [ID: ${m.id}] Course ${m.course_id}: ${m.title}`);
    });
    console.log('');

    // 3. Check which modules have indexed content
    console.log('💾 Content indexed per module:');
    const contentResult = await postgresService.query(`
      SELECT module_id, COUNT(*) as file_count, SUM(chunk_count) as total_chunks
      FROM course_content
      WHERE status = 'completed' AND processed = true
      GROUP BY module_id
      ORDER BY module_id
    `);
    contentResult.rows.forEach(r => {
      console.log(`  Module ${r.module_id}: ${r.file_count} files, ${r.total_chunks} chunks`);
    });
    console.log('');

    // 4. Check user enrollment
    console.log('👤 User enrollment (phone: 8016809129):');
    const userResult = await postgresService.query(`
      SELECT u.id, u.name, u.phone, e.course_id, e.status, e.current_module_id
      FROM users u
      LEFT JOIN enrollments e ON u.id = e.user_id
      WHERE u.phone LIKE '%8016809129%'
    `);

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      console.log(`  User: ${user.name} (ID: ${user.id})`);
      console.log(`  Enrolled in Course ID: ${user.course_id}`);
      console.log(`  Current Module ID: ${user.current_module_id}`);
      console.log(`  Status: ${user.status}`);
    } else {
      console.log('  User not found');
    }
    console.log('');

    // 5. Test ChromaDB search with and without module filter
    const testQuery = "What is entrepreneurship?";
    console.log(`🔎 Testing search: "${testQuery}"\n`);

    // Test WITHOUT module filter
    console.log('Without module filter:');
    const resultsNoFilter = await chromaService.searchSimilar(testQuery, { nResults: 3 });
    console.log(`  Found ${resultsNoFilter.length} results`);
    if (resultsNoFilter.length > 0) {
      resultsNoFilter.forEach((doc, idx) => {
        console.log(`  [${idx + 1}] Module ${doc.metadata?.module_id}: ${doc.metadata?.filename}`);
        console.log(`      ${doc.content.substring(0, 100)}...`);
      });
    }
    console.log('');

    // Test WITH module filter (if user is enrolled)
    if (userResult.rows.length > 0 && userResult.rows[0].current_module_id) {
      const moduleId = parseInt(userResult.rows[0].current_module_id);
      console.log(`With module filter (module_id: ${moduleId}):`);
      const resultsWithFilter = await chromaService.searchSimilar(testQuery, {
        module_id: moduleId,
        nResults: 3
      });
      console.log(`  Found ${resultsWithFilter.length} results`);
      if (resultsWithFilter.length > 0) {
        resultsWithFilter.forEach((doc, idx) => {
          console.log(`  [${idx + 1}] ${doc.metadata?.filename}`);
          console.log(`      ${doc.content.substring(0, 100)}...`);
        });
      } else {
        console.log('  ❌ No results - This is why the user sees "No content found"!');
      }
    }

    console.log('\n✅ Diagnostic complete');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkRAGRetrieval();
