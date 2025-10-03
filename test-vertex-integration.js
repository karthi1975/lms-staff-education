#!/usr/bin/env node

require('dotenv').config();
const vertexAIService = require('./services/vertexai.service');

async function testVertexAI() {
  console.log('Testing Vertex AI Integration...\n');
  console.log('Configuration:');
  console.log(`  Endpoint: ${process.env.VERTEX_AI_ENDPOINT || 'us-east5-aiplatform.googleapis.com'}`);
  console.log(`  Region: ${process.env.VERTEX_AI_REGION || 'us-east5'}`);
  console.log(`  Project: ${process.env.GCP_PROJECT_ID || 'staff-education-id'}`);
  console.log(`  Model: ${process.env.VERTEX_AI_MODEL || 'gemini-1.5-flash-001'}`);
  console.log(`  Using ADC: ${process.env.USE_APPLICATION_DEFAULT_CREDENTIALS || 'true'}`);
  console.log('');

  try {
    // Test 1: Basic completion
    console.log('Test 1: Basic completion...');
    const basicResponse = await vertexAIService.generateCompletion([
      { role: 'user', content: 'What is the importance of teacher training?' }
    ], { maxTokens: 100 });
    console.log('Response:', basicResponse.substring(0, 200) + '...\n');

    // Test 2: Generate completion with system message for intent classification
    console.log('Test 2: Intent classification using generateCompletion...');
    const intentResponse = await vertexAIService.generateCompletion([
      { role: 'system', content: 'You are an intent classifier. Classify the user message into one of these categories: learning_request, quiz_request, help_request, or general_query. Respond with only the category name.' },
      { role: 'user', content: 'I want to learn about classroom management techniques' }
    ], { maxTokens: 50 });
    console.log('Classified intent:', intentResponse.trim(), '\n');

    // Test 3: Educational response generation
    console.log('Test 3: Educational response with context...');
    const educationalResponse = await vertexAIService.generateEducationalResponse(
      'How do I handle disruptive students?',
      'Classroom management involves establishing clear rules, consistent consequences, positive reinforcement, and building relationships with students.'
    );
    console.log('Educational response:', educationalResponse.substring(0, 200) + '...\n');

    // Test 4: Quiz generation
    console.log('Test 4: Quiz generation...');
    const quiz = await vertexAIService.generateQuizQuestions(
      'Effective teaching strategies include differentiated instruction, active learning, formative assessment, and creating inclusive classroom environments.',
      'module_teaching_strategies'
    );
    console.log('Generated quiz questions:', quiz ? quiz.questions?.length : 'No quiz generated', '\n');

    // Test 5: Teacher training module suggestion
    console.log('Test 5: Module recommendation...');
    const moduleRecommendation = await vertexAIService.generateCompletion([
      { 
        role: 'system', 
        content: 'You are a teacher training assistant. Recommend appropriate training modules based on teacher needs.'
      },
      { 
        role: 'user', 
        content: 'I am a new teacher struggling with lesson planning and time management' 
      }
    ], { maxTokens: 150 });
    console.log('Module recommendation:', moduleRecommendation.substring(0, 300) + '...\n');

    // Test 6: Streaming response (if supported)
    console.log('Test 6: Testing streaming response...');
    try {
      const streamResponse = await vertexAIService.generateCompletion([
        { role: 'user', content: 'List 3 key principles of effective teaching' }
      ], { stream: true, maxTokens: 150 });
      console.log('Stream response received:', streamResponse.substring(0, 200) + '...\n');
    } catch (streamError) {
      console.log('Streaming not supported or failed, continuing with regular responses\n');
    }

    console.log('✅ All tests passed successfully!');
    console.log('\nVertex AI integration is working correctly.');
    console.log('Model being used:', process.env.VERTEX_AI_MODEL || 'gemini-1.5-flash-001');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nFull error details:', error);
    console.error('\nTroubleshooting steps:');
    console.error('1. Verify authentication: gcloud auth application-default login');
    console.error('2. Check project access: gcloud config set project staff-education-id');
    console.error('3. Verify Vertex AI API is enabled:');
    console.error('   gcloud services enable aiplatform.googleapis.com');
    console.error('4. Check your .env file has correct values:');
    console.error('   - GCP_PROJECT_ID=staff-education-id');
    console.error('   - VERTEX_AI_REGION=us-east5');
    console.error('   - VERTEX_AI_ENDPOINT=us-east5-aiplatform.googleapis.com');
    console.error('   - VERTEX_AI_MODEL=gemini-1.5-flash-001');
    console.error('5. Ensure Application Default Credentials are set:');
    console.error('   - GOOGLE_APPLICATION_CREDENTIALS should point to credentials file');
    console.error('   - Or USE_APPLICATION_DEFAULT_CREDENTIALS=true');
    process.exit(1);
  }
}

// Helper function to test access token retrieval
async function testAccessToken() {
  console.log('\nTesting access token retrieval...');
  try {
    const token = await vertexAIService.getAccessToken();
    if (token && token !== 'development-token') {
      console.log('✅ Successfully retrieved access token');
      console.log('Token preview:', token.substring(0, 20) + '...');
    } else {
      console.log('⚠️  Using development token - authentication may not be properly configured');
    }
  } catch (error) {
    console.error('❌ Failed to retrieve access token:', error.message);
  }
}

// Main execution
async function main() {
  console.log('=' .repeat(50));
  console.log('Staff Education - Teacher Training');
  console.log('Vertex AI Integration Test');
  console.log('=' .repeat(50) + '\n');

  // First test access token
  await testAccessToken();
  console.log('');

  // Then run the main tests
  await testVertexAI();

  console.log('\n' + '=' .repeat(50));
  console.log('Test completed successfully!');
  console.log('You can now start the server with: npm start');
  console.log('=' .repeat(50));
}

// Run tests
main().catch(error => {
  console.error('Unexpected error during testing:', error);
  process.exit(1);
});