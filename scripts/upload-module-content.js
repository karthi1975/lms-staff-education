/**
 * Automated Content Upload Script
 *
 * Uploads all PDF files to their respective modules
 * Creates embeddings and populates ChromaDB for RAG
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000/api';
const MATERIALS_DIR = '/Users/karthi/business/staff_education/education_materials';
const MODULE_MAP_FILE = path.join(__dirname, '../module-map.json');

async function getAuthToken() {
  const response = await axios.post(`${API_BASE}/admin/login`, {
    email: 'admin@school.edu',
    password: 'Admin123!'
  });
  return response.data.token;
}

async function uploadFile(token, moduleId, filePath, fileName) {
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), fileName);
    form.append('module_id', moduleId);

    const response = await axios.post(
      `${API_BASE}/admin/upload-content`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${token}`
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 300000 // 5 minutes
      }
    );

    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Upload Module Content - Business Studies Training');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Load module map
    if (!fs.existsSync(MODULE_MAP_FILE)) {
      console.log('❌ Module map not found!');
      console.log('   Run: node scripts/create-course-and-modules.js first\n');
      process.exit(1);
    }

    const moduleMap = JSON.parse(fs.readFileSync(MODULE_MAP_FILE, 'utf8'));
    console.log(`📚 Course: ${moduleMap.course.title}`);
    console.log(`📋 Modules to process: ${moduleMap.modules.length}\n`);

    // Authenticate
    console.log('🔐 Authenticating...');
    const token = await getAuthToken();
    console.log('✅ Authenticated\n');

    // Upload content for each module
    let totalFiles = 0;
    let successCount = 0;
    let failCount = 0;

    for (const module of moduleMap.modules) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📝 Module ${module.code}: ${module.title}`);
      console.log(`   Files to upload: ${module.files.length}`);
      console.log('─'.repeat(60));

      for (const fileName of module.files) {
        totalFiles++;
        const filePath = path.join(MATERIALS_DIR, fileName);

        if (!fs.existsSync(filePath)) {
          console.log(`   ❌ File not found: ${fileName}`);
          failCount++;
          continue;
        }

        const fileSize = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);
        process.stdout.write(`   📤 Uploading: ${fileName} (${fileSize} MB)...`);

        const result = await uploadFile(token, module.id, filePath, fileName);

        if (result.success) {
          console.log(` ✅`);
          successCount++;

          // Show processing info if available
          if (result.data.chunks_created) {
            console.log(`      └─ Chunks created: ${result.data.chunks_created}`);
          }
          if (result.data.embeddings_generated) {
            console.log(`      └─ Embeddings: ${result.data.embeddings_generated}`);
          }
        } else {
          console.log(` ❌`);
          console.log(`      └─ Error: ${result.error}`);
          failCount++;
        }

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Final summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Upload Summary');
    console.log('═'.repeat(60));
    console.log(`Total files: ${totalFiles}`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`Success rate: ${((successCount/totalFiles)*100).toFixed(1)}%\n`);

    if (successCount > 0) {
      console.log('✅ Content uploaded successfully!');
      console.log('\n🎯 Next steps:');
      console.log('   1. Verify content in ChromaDB');
      console.log('   2. Test chat at: http://localhost:3000/admin/chat-v2.html');
      console.log('   3. Try asking questions about any module\n');

      console.log('📝 Verify commands:');
      console.log('   # Check database');
      console.log('   node check-modules.js');
      console.log('\n   # Check ChromaDB');
      console.log('   node check-chroma-contents.js\n');
    }

    if (failCount > 0) {
      console.log('⚠️  Some uploads failed. Check the errors above.');
      console.log('   You can re-run this script to retry failed uploads.\n');
    }

  } catch (error) {
    console.error('\n❌ Upload failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    process.exit(1);
  }
}

main();
