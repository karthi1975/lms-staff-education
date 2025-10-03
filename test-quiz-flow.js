/**
 * Test Quiz Flow for Karthi
 * Simulates WhatsApp conversation for Module 2 quiz
 */

const whatsappHandler = require('./services/whatsapp-handler.service');

const KARTHI_PHONE = '+18016809129';

async function testQuizFlow() {
  console.log('=== Testing Module 2 Quiz Flow for Karthi ===\n');

  try {
    // Step 1: Request Module 2
    console.log('1. Karthi: "module 2"');
    await whatsappHandler.handleMessage({
      from: KARTHI_PHONE,
      messageBody: 'module 2',
      messageId: 'test_msg_1',
      messageType: 'text',
      timestamp: Date.now()
    });
    await sleep(2000);

    // Step 2: Start Quiz
    console.log('\n2. Karthi: "start quiz"');
    await whatsappHandler.handleMessage({
      from: KARTHI_PHONE,
      messageBody: 'start quiz',
      messageId: 'test_msg_2',
      messageType: 'text',
      timestamp: Date.now()
    });
    await sleep(2000);

    // Step 3-7: Answer all 5 questions
    const answers = ['B', 'A', 'B', 'C', 'C']; // All correct answers

    for (let i = 0; i < answers.length; i++) {
      console.log(`\n${3 + i}. Karthi: "${answers[i]}"`);
      await whatsappHandler.handleMessage({
        from: KARTHI_PHONE,
        messageBody: answers[i],
        messageId: `test_msg_${3 + i}`,
        messageType: 'text',
        timestamp: Date.now()
      });
      await sleep(2000);
    }

    console.log('\n=== Quiz Flow Test Complete ===');
    console.log('\nExpected Results:');
    console.log('- Score: 5/5 (100%)');
    console.log('- Status: PASSED');
    console.log('- Module 2 marked as COMPLETED');
    console.log('\nCheck the database to verify module completion.');

  } catch (error) {
    console.error('Error in test flow:', error);
  }

  process.exit(0);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the test
testQuizFlow();
