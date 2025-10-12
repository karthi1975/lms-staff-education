/**
 * Comprehensive Vertex AI Diagnostic Test
 * Tests authentication, embeddings, and text generation
 */

require('dotenv').config();
const vertexAIService = require('./services/vertexai.service');
const embeddingService = require('./services/embedding.service');
const logger = require('./utils/logger');

async function testVertexAI() {
  console.log('=== Vertex AI Comprehensive Diagnostic Test ===\n');

  // Test 1: Check Environment Variables
  console.log('1. Environment Variables:');
  console.log('   GCP_PROJECT_ID:', process.env.GCP_PROJECT_ID || 'NOT SET');
  console.log('   GOOGLE_CLOUD_QUOTA_PROJECT:', process.env.GOOGLE_CLOUD_QUOTA_PROJECT || 'NOT SET');
  console.log('   REGION:', process.env.REGION || 'NOT SET');
  console.log('   VERTEX_AI_MODEL:', process.env.VERTEX_AI_MODEL || 'NOT SET');
  console.log('   GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS || 'NOT SET');
  console.log('');

  // Test 2: Check Access Token
  console.log('2. Testing Access Token Retrieval:');
  try {
    const token = await vertexAIService.getAccessToken();
    console.log('   ✅ Access token obtained successfully');
    console.log('   Token preview:', token.substring(0, 50) + '...');
    console.log('   Token length:', token.length);
  } catch (error) {
    console.log('   ❌ Failed to get access token');
    console.log('   Error:', error.message);
    console.log('');
    console.log('   🔧 FIX: Run one of these commands:');
    console.log('      gcloud auth application-default login');
    console.log('      gcloud auth login --update-adc');
    return;
  }
  console.log('');

  // Test 3: Test Embeddings
  console.log('3. Testing Vertex AI Embeddings:');
  const testText = 'What is entrepreneurship and business ideas?';
  try {
    console.log('   Query:', testText);
    const embedding = await embeddingService.generateEmbeddings(testText);

    if (Array.isArray(embedding) && embedding.length > 0) {
      console.log('   ✅ Embedding generated successfully');
      console.log('   Dimension:', embedding.length);
      console.log('   First 5 values:', embedding.slice(0, 5));
      console.log('   Embedding type:', typeof embedding[0]);
    } else {
      console.log('   ⚠️  Embedding generated but unexpected format');
      console.log('   Result:', embedding);
    }
  } catch (error) {
    console.log('   ❌ Embedding generation failed');
    console.log('   Error code:', error.response?.data?.error?.code);
    console.log('   Error message:', error.response?.data?.error?.message || error.message);
    console.log('   Error details:', JSON.stringify(error.response?.data?.error?.details, null, 2));

    if (error.response?.data?.error?.code === 403) {
      console.log('');
      console.log('   🔧 FIX: Grant IAM permissions:');
      console.log('      gcloud projects add-iam-policy-binding staff-education \\');
      console.log('        --member="user:$(gcloud config get-value account)" \\');
      console.log('        --role="roles/aiplatform.user"');
      console.log('');
      console.log('      OR use service account:');
      console.log('      gcloud projects add-iam-policy-binding staff-education \\');
      console.log('        --member="serviceAccount:YOUR-SA@staff-education.iam.gserviceaccount.com" \\');
      console.log('        --role="roles/aiplatform.user"');
    }
  }
  console.log('');

  // Test 4: Test Text Generation
  console.log('4. Testing Vertex AI Text Generation (Llama):');
  try {
    const messages = [
      {
        role: "user",
        content: "Explain what entrepreneurship means in one sentence."
      }
    ];

    console.log('   Query:', messages[0].content);
    console.log('   Model:', vertexAIService.model);
    console.log('   Endpoint:', vertexAIService.apiUrl.substring(0, 80) + '...');

    const response = await vertexAIService.generateCompletion(messages, {
      temperature: 0.7,
      maxTokens: 100
    });

    if (response && response.length > 0) {
      console.log('   ✅ Text generation successful');
      console.log('   Response:', response);
      console.log('   Response length:', response.length);
    } else {
      console.log('   ⚠️  Empty response received');
    }
  } catch (error) {
    console.log('   ❌ Text generation failed');
    console.log('   Error code:', error.response?.data?.error?.code);
    console.log('   Error message:', error.response?.data?.error?.message || error.message);
    console.log('   Error details:', JSON.stringify(error.response?.data?.error?.details, null, 2));

    if (error.response?.data?.error?.code === 403) {
      console.log('');
      console.log('   🔧 FIX: Grant Vertex AI permissions (same as above)');
    } else if (error.response?.data?.error?.code === 404) {
      console.log('');
      console.log('   🔧 FIX: Model not found or not available in region');
      console.log('      Check available models:');
      console.log('      gcloud ai models list --region=us-east5 --project=staff-education');
    }
  }
  console.log('');

  // Test 5: Test Educational Response (Full Pipeline)
  console.log('5. Testing Full Educational Response Pipeline:');
  try {
    const query = 'What is entrepreneurship?';
    const context = 'Entrepreneurship is the process of starting and running a business venture. It involves identifying opportunities, taking risks, and creating value through innovation.';

    console.log('   Query:', query);
    console.log('   Context length:', context.length);
    console.log('   Language: english');

    const response = await vertexAIService.generateEducationalResponse(query, context, 'english');

    console.log('   ✅ Educational response generated');
    console.log('   Response:', response);
    console.log('   Response length:', response.length);

    // Check if it's a fallback response
    if (response.includes('Effective classroom management')) {
      console.log('   ⚠️  WARNING: This is a FALLBACK response, not AI-generated!');
      console.log('   The Vertex AI call failed and returned hardcoded text.');
    } else if (response.includes('Please upload content')) {
      console.log('   ⚠️  WARNING: This is a FALLBACK response for missing content!');
    } else {
      console.log('   ✅ Response appears to be AI-generated (not fallback)');
    }
  } catch (error) {
    console.log('   ❌ Educational response failed');
    console.log('   Error:', error.message);
  }
  console.log('');

  // Test 6: Check GCP Project Configuration
  console.log('6. Testing GCP Project Configuration:');
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  try {
    const { stdout: currentProject } = await execAsync('gcloud config get-value project 2>/dev/null');
    console.log('   Current GCloud Project:', currentProject.trim());

    const { stdout: currentAccount } = await execAsync('gcloud config get-value account 2>/dev/null');
    console.log('   Current GCloud Account:', currentAccount.trim());

    // Try to list enabled APIs
    try {
      const { stdout: apis } = await execAsync('gcloud services list --enabled --filter="aiplatform" --project=staff-education 2>/dev/null');
      if (apis.includes('aiplatform.googleapis.com')) {
        console.log('   ✅ Vertex AI API is enabled');
      } else {
        console.log('   ❌ Vertex AI API is NOT enabled');
        console.log('   🔧 FIX: Enable the API:');
        console.log('      gcloud services enable aiplatform.googleapis.com --project=staff-education');
      }
    } catch (e) {
      console.log('   ⚠️  Could not check API status (may need permissions)');
    }
  } catch (error) {
    console.log('   ⚠️  gcloud CLI not available or not configured');
    console.log('   This is OK if running in Docker with service account');
  }
  console.log('');

  // Summary
  console.log('=== Summary ===');
  console.log('');
  console.log('If you see 403 errors above, the issue is:');
  console.log('  ❌ Your GCP credentials lack Vertex AI permissions');
  console.log('');
  console.log('Solutions:');
  console.log('  1. Grant permissions to your user account:');
  console.log('     gcloud projects add-iam-policy-binding staff-education \\');
  console.log('       --member="user:$(gcloud config get-value account)" \\');
  console.log('       --role="roles/aiplatform.user"');
  console.log('');
  console.log('  2. OR use a service account with permissions:');
  console.log('     - Create service account: gcloud iam service-accounts create vertex-ai-user');
  console.log('     - Grant role: gcloud projects add-iam-policy-binding staff-education \\');
  console.log('                     --member="serviceAccount:vertex-ai-user@staff-education.iam.gserviceaccount.com" \\');
  console.log('                     --role="roles/aiplatform.user"');
  console.log('     - Download key: gcloud iam service-accounts keys create key.json \\');
  console.log('                       --iam-account=vertex-ai-user@staff-education.iam.gserviceaccount.com');
  console.log('     - Set env: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json');
  console.log('');
  console.log('  3. OR switch to alternative AI service (OpenAI, Claude, local model)');
  console.log('');
  console.log('=== Test Complete ===');
}

// Run the test
testVertexAI().catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});
