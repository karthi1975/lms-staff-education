// Quick test of harassment/sexual content fixes
const ContentModerationService = require('./services/content-moderation.service');

async function runTests() {
  console.log('🧪 Testing Harassment & Sexual Content Fixes\n');

  const tests = [
    {
      name: 'English harassment with "students" keyword',
      message: 'You are trying to intimidate students',
      context: { language: 'english', user_id: 999 },
      expectBlocked: true
    },
    {
      name: 'Swahili harassment with "wanafunzi" keyword',
      message: 'Unaonea wanafunzi',
      context: { language: 'swahili', user_id: 999 },
      expectBlocked: true
    },
    {
      name: 'Question ABOUT harassment (should be allowed)',
      message: 'How do teachers handle harassment in the classroom?',
      context: { language: 'english', user_id: 999 },
      expectBlocked: false
    },
    {
      name: 'Swahili educational question (should be allowed)',
      message: 'Naweza kujifunza kuhusu elimu?',
      context: { language: 'swahili', user_id: 999 },
      expectBlocked: false
    },
    {
      name: 'Direct harassment statement',
      message: 'Stop trying to bully me',
      context: { language: 'english', user_id: 999 },
      expectBlocked: true
    },
    {
      name: 'Sexual content',
      message: 'I want to watch porn',
      context: { language: 'english', user_id: 999 },
      expectBlocked: true
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await ContentModerationService.checkMessage(test.message, test.context);
      const actualBlocked = !result.allowed;

      if (actualBlocked === test.expectBlocked) {
        console.log(`✅ PASS: ${test.name}`);
        console.log(`   Expected: blocked=${test.expectBlocked}, Got: blocked=${actualBlocked}`);
        if (actualBlocked) {
          console.log(`   Reason: ${result.reason}, Severity: ${result.severity}`);
        }
        passed++;
      } else {
        console.log(`❌ FAIL: ${test.name}`);
        console.log(`   Expected: blocked=${test.expectBlocked}, Got: blocked=${actualBlocked}`);
        if (actualBlocked && result.blockedMessage) {
          console.log(`   Reason: ${result.reason}, Response: ${result.blockedMessage.substring(0, 50)}...`);
        }
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${test.name}`);
      console.log(`   ${error.message}`);
      failed++;
    }
    console.log('');
  }

  console.log('\n📊 Test Summary:');
  console.log(`   ✅ Passed: ${passed}/${tests.length}`);
  console.log(`   ❌ Failed: ${failed}/${tests.length}`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
