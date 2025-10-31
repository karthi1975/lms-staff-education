/**
 * Test script for Coaching Mode Services
 * Tests CoachingModeService and PromptTemplateService
 */

const coachingModeService = require('../services/coaching/coaching-mode.service');
const promptTemplateService = require('../services/coaching/prompt-template.service');

async function testServices() {
  console.log('🧪 Testing Coaching Mode Services\n');
  console.log('=' .repeat(60));

  try {
    // Initialize the service
    console.log('\n1️⃣  Initializing CoachingModeService...');
    await coachingModeService.initialize();
    console.log('✅ Service initialized successfully');

    // Test getting course config
    console.log('\n2️⃣  Testing getCourseConfig...');
    const courseId = 7; // Use existing course
    const config = await coachingModeService.getCourseConfig(courseId);
    if (config) {
      console.log('✅ Course config retrieved:');
      console.log(`   - Default mode: ${config.default_mode}`);
      console.log(`   - Allow switching: ${config.allow_mode_switching}`);
      console.log(`   - Cooldown: ${config.switch_cooldown_minutes} minutes`);
    } else {
      console.log('⚠️  No config found for course', courseId);
    }

    // Test user preference (non-existent user)
    console.log('\n3️⃣  Testing getUserPreference...');
    const testUserId = 999999;
    const pref = await coachingModeService.getUserPreference(testUserId, courseId);
    if (pref) {
      console.log('✅ User preference retrieved:');
      console.log(`   - Mode: ${pref.selected_mode}`);
      console.log(`   - Is new: ${pref.is_new || false}`);
    }

    // Test mode switching
    console.log('\n4️⃣  Testing switchMode...');
    const switchResult = await coachingModeService.switchMode(testUserId, courseId, 'socratic');
    console.log('✅ Mode switch result:', switchResult.message);
    if (switchResult.success) {
      console.log(`   - New mode: ${switchResult.current_mode}`);
      console.log(`   - Switches: ${switchResult.switches_count}`);
    }

    // Test getting mode prompt
    console.log('\n5️⃣  Testing getModePrompt...');
    const modePrompt = await coachingModeService.getModePrompt(testUserId, courseId);
    if (modePrompt) {
      console.log('✅ Mode prompt retrieved:');
      console.log(`   - Mode: ${modePrompt.mode}`);
      console.log(`   - Greeting: ${modePrompt.greeting.substring(0, 50)}...`);
      console.log(`   - Allow switching: ${modePrompt.allow_switching}`);
    }

    // Test starting a session
    console.log('\n6️⃣  Testing startSession...');
    const session = await coachingModeService.startSession(testUserId, courseId);
    console.log('✅ Session started:');
    console.log(`   - Session ID: ${session.id}`);
    console.log(`   - Mode: ${session.mode_used}`);

    // Test logging messages
    console.log('\n7️⃣  Testing logSessionMessage...');
    await coachingModeService.logSessionMessage(session.id, false);
    await coachingModeService.logSessionMessage(session.id, true);
    console.log('✅ Messages logged');

    // Test ending session
    console.log('\n8️⃣  Testing endSession...');
    const endedSession = await coachingModeService.endSession(session.id, 'completed', {
      quiz_score: 85,
      satisfaction_rating: 5
    });
    console.log('✅ Session ended:');
    console.log(`   - Duration: ${endedSession.duration_minutes} minutes`);
    console.log(`   - Quiz score: ${endedSession.quiz_score}`);

    // Test available commands
    console.log('\n9️⃣  Testing getAvailableCommands...');
    const commands = coachingModeService.getAvailableCommands();
    console.log('✅ Available commands:');
    commands.forEach(cmd => {
      console.log(`   - ${cmd.command}${cmd.alias ? ` (${cmd.alias})` : ''}: ${cmd.description}`);
    });

    // Test command parsing
    console.log('\n🔟 Testing parseModeCommand...');
    const testMessages = ['/regular', '/socratic', '/mode', 'hello'];
    testMessages.forEach(msg => {
      const parsed = coachingModeService.parseModeCommand(msg);
      if (parsed) {
        console.log(`   ✅ "${msg}" → ${parsed.command} (${parsed.mode || parsed.action})`);
      } else {
        console.log(`   ⚠️  "${msg}" → not a mode command`);
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('🧪 Testing PromptTemplateService\n');
    console.log('=' .repeat(60));

    // Test generating system prompt
    console.log('\n1️⃣  Testing generateSystemPrompt...');
    const regularPrompt = promptTemplateService.generateSystemPrompt('regular', null, {
      courseName: 'Teacher Training 101',
      moduleName: 'Classroom Management',
      topic: 'Discipline strategies'
    });
    console.log('✅ Regular mode prompt generated:');
    console.log(`   Length: ${regularPrompt.length} characters`);
    console.log(`   Preview: ${regularPrompt.substring(0, 100)}...`);

    const socraticPrompt = promptTemplateService.generateSystemPrompt('socratic');
    console.log('✅ Socratic mode prompt generated:');
    console.log(`   Length: ${socraticPrompt.length} characters`);

    // Test generating greeting
    console.log('\n2️⃣  Testing generateGreeting...');
    const greeting = promptTemplateService.generateGreeting('regular', null, 'John');
    console.log('✅ Greeting generated:', greeting.substring(0, 80));

    // Test validating prompts
    console.log('\n3️⃣  Testing validatePrompt...');
    const validPrompt = 'You are a helpful teaching assistant. Ask guiding questions and help students discover answers.';
    const validation = promptTemplateService.validatePrompt(validPrompt, 'socratic');
    console.log('✅ Validation result:');
    console.log(`   - Valid: ${validation.valid}`);
    console.log(`   - Errors: ${validation.errors.length}`);
    console.log(`   - Warnings: ${validation.warnings.length}`);
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(w => console.log(`     ⚠️  ${w}`));
    }

    // Test sanitizing prompts
    console.log('\n4️⃣  Testing sanitizePrompt...');
    const unsafePrompt = 'Hello <script>alert("test")</script> world';
    const sanitized = promptTemplateService.sanitizePrompt(unsafePrompt);
    console.log('✅ Prompt sanitized:');
    console.log(`   - Original: ${unsafePrompt}`);
    console.log(`   - Sanitized: ${sanitized}`);

    // Test mode info formatting
    console.log('\n5️⃣  Testing formatModeInfo...');
    const modeInfo = promptTemplateService.formatModeInfo('regular', {
      allow_mode_switching: true,
      switch_cooldown_minutes: 5
    });
    console.log('✅ Mode info formatted:');
    console.log(modeInfo);

    // Test mode comparison
    console.log('\n6️⃣  Testing generateModeComparison...');
    const comparison = promptTemplateService.generateModeComparison();
    console.log('✅ Mode comparison generated:');
    console.log(comparison);

    // Test mode examples
    console.log('\n7️⃣  Testing getModeExamples...');
    const regularExample = promptTemplateService.getModeExamples('regular');
    const socraticExample = promptTemplateService.getModeExamples('socratic');
    console.log('✅ Regular mode example:');
    console.log(`   Q: ${regularExample.question}`);
    console.log(`   A: ${regularExample.expectedResponse.substring(0, 60)}...`);
    console.log('✅ Socratic mode example:');
    console.log(`   Q: ${socraticExample.question}`);
    console.log(`   A: ${socraticExample.expectedResponse.substring(0, 60)}...`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed successfully!');
    console.log('=' .repeat(60));

    // Cleanup
    await cleanupTestData(testUserId, courseId);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

async function cleanupTestData(userId, courseId) {
  console.log('\n🧹 Cleaning up test data...');
  const postgresService = require('../services/database/postgres.service');

  try {
    // Delete test user preferences
    await postgresService.query(
      'DELETE FROM user_bot_preferences WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );

    // Delete test sessions
    await postgresService.query(
      'DELETE FROM coaching_sessions WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );

    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.warn('⚠️  Cleanup error (may be safe to ignore):', error.message);
  }
}

// Run tests
testServices();
