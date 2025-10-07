/**
 * Test script for WhatsApp message flow
 * Tests: HI message → Course selection → Module selection → Chat → Quiz
 */

const moodleOrchestrator = require('./services/moodle-orchestrator.service');
const postgresService = require('./services/database/postgres.service');
const logger = require('./utils/logger');

async function testWhatsAppFlow() {
  try {
    console.log('\n=== WhatsApp Flow Test ===\n');

    // Set environment variables for local testing
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_NAME = 'teachers_training';
    process.env.DB_USER = 'teachers_user';
    process.env.DB_PASSWORD = 'teachers_pass_2024';

    // Initialize services
    console.log('1️⃣  Initializing services...');
    await postgresService.initialize();
    await moodleOrchestrator.initialize();
    console.log('✅ Services initialized\n');

    // Test user
    const testUserId = 999;
    const testPhone = '+1234567890';

    // Clean up test user if exists
    await postgresService.query('DELETE FROM conversation_context WHERE user_id = $1', [testUserId]);
    await postgresService.query('DELETE FROM users WHERE id = $1', [testUserId]);

    // Create test user
    await postgresService.query(
      'INSERT INTO users (id, whatsapp_id, name) VALUES ($1, $2, $3)',
      [testUserId, testPhone, 'Test User']
    );
    console.log('✅ Test user created\n');

    // TEST 1: HI message should trigger course selection
    console.log('2️⃣  Testing HI message...');
    const hiResponse = await moodleOrchestrator.handleMessage(testUserId, testPhone, 'hi');
    console.log('Response type:', hiResponse.type);
    console.log('Response text:', hiResponse.text?.substring(0, 100) + '...');

    if (hiResponse.type === 'list' && hiResponse.sections) {
      console.log('✅ HI message correctly shows course selection');
      console.log('   Courses available:', hiResponse.sections[0].rows.length);
    } else {
      console.log('❌ HI message did not show course selection');
      console.log('   Full response:', JSON.stringify(hiResponse, null, 2));
    }
    console.log('');

    // TEST 2: Select course
    console.log('3️⃣  Testing course selection...');
    const courseResponse = await moodleOrchestrator.handleMessage(testUserId, testPhone, 'course_1');
    console.log('Response type:', courseResponse.type);
    console.log('Response text:', courseResponse.text?.substring(0, 100) + '...');

    if (courseResponse.type === 'list' && courseResponse.sections) {
      console.log('✅ Course selection correctly shows module selection');
      console.log('   Modules available:', courseResponse.sections[0].rows.length);
    } else {
      console.log('❌ Course selection did not show module selection');
      console.log('   Full response:', JSON.stringify(courseResponse, null, 2));
    }
    console.log('');

    // TEST 3: Select module
    console.log('4️⃣  Testing module selection...');
    const moduleResponse = await moodleOrchestrator.handleMessage(testUserId, testPhone, 'module_1');
    console.log('Response type:', moduleResponse.type);
    console.log('Response text:', moduleResponse.text?.substring(0, 150) + '...');

    if (moduleResponse.text && moduleResponse.text.includes('Ask me any questions')) {
      console.log('✅ Module selection correctly enters learning mode');
    } else {
      console.log('❌ Module selection did not enter learning mode');
      console.log('   Full response:', JSON.stringify(moduleResponse, null, 2));
    }
    console.log('');

    // TEST 4: Ask a question (free text chat)
    console.log('5️⃣  Testing free text chat question...');
    const chatResponse = await moodleOrchestrator.handleMessage(
      testUserId,
      testPhone,
      'What is entrepreneurship?'
    );
    console.log('Response type:', chatResponse.type);
    console.log('Response text length:', chatResponse.text?.length);
    console.log('Response preview:', chatResponse.text?.substring(0, 200) + '...');

    if (chatResponse.text && chatResponse.text.length > 50) {
      console.log('✅ Chat question received a response');
    } else {
      console.log('❌ Chat question did not receive proper response');
      console.log('   Full response:', JSON.stringify(chatResponse, null, 2));
    }
    console.log('');

    // TEST 5: Start quiz
    console.log('6️⃣  Testing quiz start...');
    const quizStartResponse = await moodleOrchestrator.handleMessage(
      testUserId,
      testPhone,
      'quiz please'
    );
    console.log('Response type:', quizStartResponse.type);
    console.log('Response text:', quizStartResponse.text?.substring(0, 100) + '...');

    if (quizStartResponse.type === 'quiz_intro' && quizStartResponse.question) {
      console.log('✅ Quiz started successfully');
      console.log('   Question 1:', quizStartResponse.question.questionText?.substring(0, 100) + '...');
      console.log('   Question type:', quizStartResponse.question.questionType);
      console.log('   Number of options:', quizStartResponse.question.options?.length);
    } else {
      console.log('❌ Quiz did not start correctly');
      console.log('   Full response:', JSON.stringify(quizStartResponse, null, 2));
    }
    console.log('');

    // TEST 6: Answer quiz question (button press simulation)
    console.log('7️⃣  Testing quiz answer (button press: A)...');
    const quizAnswerResponse = await moodleOrchestrator.handleMessage(
      testUserId,
      testPhone,
      'answer_A'  // Simulating button click
    );
    console.log('Response type:', quizAnswerResponse.type);
    console.log('Response text:', quizAnswerResponse.text?.substring(0, 100) + '...');

    if (quizAnswerResponse.question || quizAnswerResponse.text?.includes('Complete')) {
      console.log('✅ Quiz answer processed correctly');
      if (quizAnswerResponse.question) {
        console.log('   Next question received');
      } else {
        console.log('   Quiz completed (only 1 question in DB)');
      }
    } else {
      console.log('❌ Quiz answer not processed correctly');
      console.log('   Full response:', JSON.stringify(quizAnswerResponse, null, 2));
    }
    console.log('');

    // TEST 7: Test restart with HI in middle of quiz
    console.log('8️⃣  Testing HI restart during quiz...');
    // First start a quiz
    await moodleOrchestrator.handleMessage(testUserId, testPhone, 'quiz please');
    // Then send HI
    const restartResponse = await moodleOrchestrator.handleMessage(testUserId, testPhone, 'hi');
    console.log('Response type:', restartResponse.type);

    if (restartResponse.type === 'list' && restartResponse.text?.includes('Select a Course')) {
      console.log('✅ HI correctly resets to course selection even during quiz');
    } else {
      console.log('❌ HI did not reset properly during quiz');
      console.log('   Full response:', JSON.stringify(restartResponse, null, 2));
    }
    console.log('');

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await postgresService.query('DELETE FROM conversation_context WHERE user_id = $1', [testUserId]);
    await postgresService.query('DELETE FROM users WHERE id = $1', [testUserId]);
    console.log('✅ Test data cleaned up\n');

    console.log('=== Test Complete ===\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run test
testWhatsAppFlow();
