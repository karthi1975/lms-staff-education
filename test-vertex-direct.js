require('dotenv').config();
const { exec } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');

const execAsync = promisify(exec);

async function testVertexAI() {
  console.log('=== Testing Vertex AI Connection ===\n');
  
  const endpoint = process.env.ENDPOINT || 'us-east5-aiplatform.googleapis.com';
  const projectId = process.env.GCP_PROJECT_ID || 'staff-education';
  const region = process.env.REGION || 'us-east5';
  const model = process.env.VERTEX_AI_MODEL || 'meta/llama-4-maverick-17b-128e-instruct-maas';
  
  console.log('Configuration:');
  console.log(`  Project: ${projectId}`);
  console.log(`  Region: ${region}`);
  console.log(`  Model: ${model}`);
  console.log(`  Endpoint: ${endpoint}\n`);
  
  // Test 1: Check for gcloud
  console.log('1. Checking for gcloud CLI...');
  try {
    const { stdout: version } = await execAsync('gcloud --version 2>&1 | head -1');
    console.log(`   ✅ gcloud found: ${version.trim()}`);
  } catch (e) {
    console.log('   ❌ gcloud not found - using fallback responses');
    console.log('   To fix: Install gcloud SDK or mount credentials in Docker\n');
    return false;
  }
  
  // Test 2: Check authentication
  console.log('\n2. Checking authentication...');
  try {
    const { stdout: account } = await execAsync('gcloud auth list --filter=status:ACTIVE --format="value(account)"');
    if (account.trim()) {
      console.log(`   ✅ Authenticated as: ${account.trim()}`);
    } else {
      console.log('   ❌ Not authenticated');
      console.log('   To fix: Run "gcloud auth application-default login"');
      return false;
    }
  } catch (e) {
    console.log('   ❌ Authentication check failed');
    return false;
  }
  
  // Test 3: Get access token
  console.log('\n3. Getting access token...');
  let accessToken;
  try {
    const { stdout } = await execAsync('gcloud auth print-access-token');
    accessToken = stdout.trim();
    console.log(`   ✅ Got access token (${accessToken.length} chars)`);
  } catch (e) {
    console.log('   ❌ Failed to get access token:', e.message);
    return false;
  }
  
  // Test 4: Test Vertex AI API
  console.log('\n4. Testing Vertex AI API...');
  const apiUrl = `https://${endpoint}/v1/projects/${projectId}/locations/${region}/endpoints/openapi/chat/completions`;
  
  try {
    const response = await axios.post(apiUrl, {
      model: model,
      messages: [
        {
          role: "user",
          content: "Say 'Hello, Vertex AI is working!' in exactly 5 words."
        }
      ],
      max_tokens: 50,
      temperature: 0.1
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data && response.data.choices && response.data.choices[0]) {
      console.log(`   ✅ Vertex AI responded: "${response.data.choices[0].message.content}"`);
      return true;
    }
  } catch (error) {
    console.log('   ❌ Vertex AI API failed:', error.response?.data?.error || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n   Fix: Run "gcloud auth application-default login"');
    } else if (error.response?.status === 403) {
      console.log('\n   Fix: Enable Vertex AI API in your project');
      console.log('   Run: gcloud services enable aiplatform.googleapis.com');
    } else if (error.response?.status === 404) {
      console.log('\n   Fix: Check if the model is available in your region');
      console.log('   The model might not be deployed or accessible');
    }
    return false;
  }
  
  console.log('\n=== Vertex AI Test Complete ===\n');
  return true;
}

// Run test
testVertexAI().then(success => {
  if (success) {
    console.log('✅ Vertex AI is working! Your chat responses will use actual document content.\n');
  } else {
    console.log('⚠️  Vertex AI is not configured. The system will use fallback responses.');
    console.log('\nTo enable Vertex AI responses:');
    console.log('1. Run: gcloud auth application-default login');
    console.log('2. Run: gcloud config set project staff-education');
    console.log('3. Restart Docker containers\n');
  }
  process.exit(success ? 0 : 1);
});