/**
 * Integration Tests for Dual Coaching Mode Feature
 * Tests complete flows including API, database, and service layer
 */

const request = require('supertest');
const express = require('express');
const coachingModeService = require('../../services/coaching/coaching-mode.service');
const promptTemplateService = require('../../services/coaching/prompt-template.service');
const postgresService = require('../../services/database/postgres.service');

// Mock authentication middleware for testing
const mockAuth = (req, res, next) => {
  req.user = { id: 1, email: 'admin@school.edu', role: 'admin' };
  next();
};

// Create Express app for testing
const app = express();
app.use(express.json());

// Load routes
const coachingModeRoutes = require('../../routes/coaching-mode.routes');
app.use('/api/coaching-mode', coachingModeRoutes);

describe('Coaching Mode Integration Tests', () => {
  let testUserId;
  let testCourseId;
  let testConfigId;
  let testSessionId;

  beforeAll(async () => {
    // Initialize services
    await coachingModeService.initialize();

    // Create test user
    const userResult = await postgresService.query(
      'INSERT INTO users (first_name, last_name, email, phone) VALUES ($1, $2, $3, $4) RETURNING id',
      ['Test', 'User', 'test@example.com', '+1234567890']
    );
    testUserId = userResult.rows[0].id;

    // Create test course
    const courseResult = await postgresService.query(
      'INSERT INTO courses (title, code, description) VALUES ($1, $2, $3) RETURNING id',
      ['Test Course', 'TEST-001', 'Integration test course']
    );
    testCourseId = courseResult.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testSessionId) {
      await postgresService.query('DELETE FROM coaching_sessions WHERE id = $1', [testSessionId]);
    }
    if (testConfigId) {
      await postgresService.query('DELETE FROM course_bot_configs WHERE id = $1', [testConfigId]);
    }
    if (testUserId) {
      await postgresService.query('DELETE FROM user_bot_preferences WHERE user_id = $1', [testUserId]);
      await postgresService.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
    if (testCourseId) {
      await postgresService.query('DELETE FROM courses WHERE id = $1', [testCourseId]);
    }
  });

  // ============================================
  // 1. Course Configuration Integration Tests
  // ============================================

  describe('Course Configuration Flow', () => {
    test('1.1: Should create default course configuration', async () => {
      const config = {
        regular_prompt: 'Test regular prompt',
        socratic_prompt: 'Test socratic prompt',
        default_mode: 'regular',
        allow_mode_switching: true
      };

      const result = await coachingModeService.setCourseConfig(testCourseId, config, 1);

      expect(result).toHaveProperty('id');
      expect(result.course_id).toBe(testCourseId);
      expect(result.regular_prompt).toBe(config.regular_prompt);
      expect(result.default_mode).toBe('regular');

      testConfigId = result.id;
    });

    test('1.2: Should retrieve course configuration', async () => {
      const config = await coachingModeService.getCourseConfig(testCourseId);

      expect(config).toBeTruthy();
      expect(config.course_id).toBe(testCourseId);
      expect(config.regular_prompt).toBe('Test regular prompt');
      expect(config.socratic_prompt).toBe('Test socratic prompt');
    });

    test('1.3: Should update existing course configuration', async () => {
      const updatedConfig = {
        regular_prompt: 'Updated regular prompt',
        switch_cooldown_minutes: 10
      };

      const result = await coachingModeService.setCourseConfig(testCourseId, updatedConfig, 1);

      expect(result.regular_prompt).toBe('Updated regular prompt');
      expect(result.switch_cooldown_minutes).toBe(10);
    });
  });

  // ============================================
  // 2. Mode Switching Integration Tests
  // ============================================

  describe('Mode Switching Flow', () => {
    test('2.1: Should initialize user preference with default mode', async () => {
      const preference = await coachingModeService.getUserPreference(testUserId, testCourseId);

      expect(preference).toBeTruthy();
      expect(preference.selected_mode).toBe('regular');
      expect(preference.mode_switches_count).toBe(0);
    });

    test('2.2: Should switch from regular to socratic mode', async () => {
      const result = await coachingModeService.switchMode(testUserId, testCourseId, 'socratic');

      expect(result.success).toBe(true);
      expect(result.current_mode).toBe('socratic');
      expect(result.switches_count).toBe(1);
    });

    test('2.3: Should switch from socratic to regular mode', async () => {
      const result = await coachingModeService.switchMode(testUserId, testCourseId, 'regular');

      expect(result.success).toBe(true);
      expect(result.current_mode).toBe('regular');
      expect(result.switches_count).toBe(2);
    });

    test('2.4: Should respect cooldown period', async () => {
      // Set cooldown to 60 minutes
      await coachingModeService.setCourseConfig(testCourseId, { switch_cooldown_minutes: 60 }, 1);

      // Try to switch immediately after previous switch
      const result = await coachingModeService.switchMode(testUserId, testCourseId, 'socratic');

      expect(result.success).toBe(false);
      expect(result.message).toContain('cooldown');
      expect(result.cooldown_remaining_minutes).toBeGreaterThan(0);

      // Reset cooldown for next tests
      await coachingModeService.setCourseConfig(testCourseId, { switch_cooldown_minutes: 0 }, 1);
    });

    test('2.5: Should reject invalid mode', async () => {
      const result = await coachingModeService.switchMode(testUserId, testCourseId, 'invalid_mode');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid mode');
    });

    test('2.6: Should enforce mode switching permissions', async () => {
      // Disable mode switching
      await coachingModeService.setCourseConfig(testCourseId, { allow_mode_switching: false }, 1);

      const result = await coachingModeService.switchMode(testUserId, testCourseId, 'socratic');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not allowed');

      // Re-enable for next tests
      await coachingModeService.setCourseConfig(testCourseId, { allow_mode_switching: true }, 1);
    });
  });

  // ============================================
  // 3. Session Lifecycle Integration Tests
  // ============================================

  describe('Session Lifecycle Flow', () => {
    test('3.1: Should start a new coaching session', async () => {
      const session = await coachingModeService.startSession(testUserId, testCourseId);

      expect(session).toBeTruthy();
      expect(session.user_id).toBe(testUserId);
      expect(session.course_id).toBe(testCourseId);
      expect(session.mode_used).toBe('regular'); // Current mode
      expect(session.status).toBe('active');

      testSessionId = session.id;
    });

    test('3.2: Should log session messages', async () => {
      await coachingModeService.logSessionMessage(testSessionId, false);
      await coachingModeService.logSessionMessage(testSessionId, true);

      const result = await postgresService.query(
        'SELECT messages_count, questions_asked FROM coaching_sessions WHERE id = $1',
        [testSessionId]
      );

      expect(result.rows[0].messages_count).toBe(2);
      expect(result.rows[0].questions_asked).toBe(1);
    });

    test('3.3: Should end session successfully', async () => {
      const metrics = {
        quiz_score: 85,
        satisfaction_rating: 4
      };

      const session = await coachingModeService.endSession(testSessionId, 'completed', metrics);

      expect(session.status).toBe('completed');
      expect(session.session_end).toBeTruthy();
      expect(session.duration_seconds).toBeGreaterThan(0);
      expect(session.quiz_score).toBe(85);
      expect(session.satisfaction_rating).toBe(4);
    });

    test('3.4: Should retrieve session history', async () => {
      const history = await postgresService.query(
        'SELECT * FROM coaching_sessions WHERE user_id = $1 AND course_id = $2',
        [testUserId, testCourseId]
      );

      expect(history.rows.length).toBeGreaterThan(0);
      expect(history.rows[0].user_id).toBe(testUserId);
      expect(history.rows[0].course_id).toBe(testCourseId);
    });
  });

  // ============================================
  // 4. Prompt Template Integration Tests
  // ============================================

  describe('Prompt Template Flow', () => {
    test('4.1: Should generate mode-specific prompt', async () => {
      const prompt = await coachingModeService.getModePrompt(testUserId, testCourseId);

      expect(prompt).toBeTruthy();
      expect(prompt.mode).toBe('regular');
      expect(prompt.prompt).toContain('Updated regular prompt');
      expect(prompt.greeting).toBeTruthy();
    });

    test('4.2: Should validate regular mode prompt', async () => {
      const prompt = 'You are a helpful teacher providing clear explanations.';
      const validation = promptTemplateService.validatePrompt(prompt, 'regular');

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('4.3: Should validate socratic mode prompt', async () => {
      const prompt = 'Guide learners by asking questions to help them discover answers.';
      const validation = promptTemplateService.validatePrompt(prompt, 'socratic');

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('4.4: Should warn about missing socratic guidance', async () => {
      const prompt = 'Just answer the questions directly.';
      const validation = promptTemplateService.validatePrompt(prompt, 'socratic');

      expect(validation.valid).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('question');
    });

    test('4.5: Should sanitize prompts', async () => {
      const dirtyPrompt = '<script>alert("xss")</script>Hello <b>world</b>';
      const clean = promptTemplateService.sanitizePrompt(dirtyPrompt);

      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('<b>');
      expect(clean).toContain('Hello');
      expect(clean).toContain('world');
    });
  });

  // ============================================
  // 5. Analytics Generation Integration Tests
  // ============================================

  describe('Analytics Generation Flow', () => {
    beforeAll(async () => {
      // Create sample sessions for analytics
      const regularSession = await coachingModeService.startSession(testUserId, testCourseId);
      await coachingModeService.logSessionMessage(regularSession.id, true);
      await coachingModeService.endSession(regularSession.id, 'completed', {
        quiz_score: 90,
        satisfaction_rating: 5
      });

      // Switch to socratic mode
      await coachingModeService.switchMode(testUserId, testCourseId, 'socratic');

      const socraticSession = await coachingModeService.startSession(testUserId, testCourseId);
      await coachingModeService.logSessionMessage(socraticSession.id, true);
      await coachingModeService.logSessionMessage(socraticSession.id, true);
      await coachingModeService.endSession(socraticSession.id, 'completed', {
        quiz_score: 85,
        satisfaction_rating: 4
      });
    });

    test('5.1: Should generate mode analytics', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const analytics = await coachingModeService.generateModeAnalytics(
        testCourseId,
        startDate,
        endDate
      );

      expect(analytics).toBeTruthy();
      expect(analytics.total_sessions).toBeGreaterThan(0);
      expect(analytics.regular_mode_sessions).toBeGreaterThan(0);
      expect(analytics.socratic_mode_sessions).toBeGreaterThan(0);
    });

    test('5.2: Should save analytics to database', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const analytics = await coachingModeService.saveModeAnalytics(
        testCourseId,
        startDate,
        endDate
      );

      expect(analytics).toBeTruthy();

      // Verify saved to database
      const saved = await postgresService.query(
        'SELECT * FROM mode_analytics WHERE course_id = $1 ORDER BY created_at DESC LIMIT 1',
        [testCourseId]
      );

      expect(saved.rows.length).toBeGreaterThan(0);
      expect(saved.rows[0].course_id).toBe(testCourseId);
    });

    test('5.3: Should calculate mode effectiveness', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const analytics = await coachingModeService.generateModeAnalytics(
        testCourseId,
        startDate,
        endDate
      );

      expect(analytics.regular_mode_avg_quiz_score).toBeGreaterThan(0);
      expect(analytics.socratic_mode_avg_quiz_score).toBeGreaterThan(0);
      expect(analytics.completion_rate).toBeDefined();
    });
  });

  // ============================================
  // 6. API Endpoint Integration Tests
  // ============================================

  describe('API Endpoint Integration', () => {
    test('6.1: GET /api/coaching-mode/config/:courseId returns configuration', async () => {
      const response = await request(app)
        .get(`/api/coaching-mode/config/${testCourseId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.course_id).toBe(testCourseId);
    });

    test('6.2: POST /api/coaching-mode/switch switches mode', async () => {
      // Reset cooldown
      await coachingModeService.setCourseConfig(testCourseId, { switch_cooldown_minutes: 0 }, 1);

      const response = await request(app)
        .post('/api/coaching-mode/switch')
        .send({
          userId: testUserId,
          courseId: testCourseId,
          mode: 'socratic'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.current_mode).toBe('socratic');
    });

    test('6.3: GET /api/coaching-mode/preference/:userId/:courseId returns preference', async () => {
      const response = await request(app)
        .get(`/api/coaching-mode/preference/${testUserId}/${testCourseId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.selected_mode).toBe('socratic');
    });

    test('6.4: POST /api/coaching-mode/session/start starts session', async () => {
      const response = await request(app)
        .post('/api/coaching-mode/session/start')
        .send({
          userId: testUserId,
          courseId: testCourseId
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user_id).toBe(testUserId);
      expect(response.body.data.course_id).toBe(testCourseId);
    });

    test('6.5: GET /api/coaching-mode/commands returns available commands', async () => {
      const response = await request(app)
        .get('/api/coaching-mode/commands');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // 7. End-to-End User Flow Integration Test
  // ============================================

  describe('Complete User Flow', () => {
    test('7.1: Complete coaching session flow from start to finish', async () => {
      // 1. Get course config
      const config = await coachingModeService.getCourseConfig(testCourseId);
      expect(config).toBeTruthy();

      // 2. Get user preference (or create default)
      const preference = await coachingModeService.getUserPreference(testUserId, testCourseId);
      expect(preference).toBeTruthy();

      // 3. Start session
      const session = await coachingModeService.startSession(testUserId, testCourseId);
      expect(session).toBeTruthy();

      // 4. Log some interactions
      await coachingModeService.logSessionMessage(session.id, false);
      await coachingModeService.logSessionMessage(session.id, true);

      // 5. End session with metrics
      const completedSession = await coachingModeService.endSession(session.id, 'completed', {
        quiz_score: 88,
        satisfaction_rating: 5
      });

      expect(completedSession.status).toBe('completed');
      expect(completedSession.quiz_score).toBe(88);
      expect(completedSession.satisfaction_rating).toBe(5);

      // 6. Generate analytics
      const analytics = await coachingModeService.generateModeAnalytics(
        testCourseId,
        new Date(Date.now() - 24 * 60 * 60 * 1000),
        new Date()
      );

      expect(analytics.total_sessions).toBeGreaterThan(0);
    });
  });
});

module.exports = {
  name: 'Coaching Mode Integration Tests',
  description: 'Tests complete flows for dual coaching mode feature'
};
