/**
 * Unit tests for CoachingModeService
 */

const coachingModeService = require('../../services/coaching/coaching-mode.service');
const postgresService = require('../../services/database/postgres.service');

// Mock dependencies
jest.mock('../../services/database/postgres.service');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('CoachingModeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCourseConfig', () => {
    it('should retrieve course configuration', async () => {
      const mockConfig = {
        id: 1,
        course_id: 7,
        default_mode: 'regular',
        allow_mode_switching: true,
        switch_cooldown_minutes: 0
      };

      postgresService.query = jest.fn().mockResolvedValue({
        rows: [mockConfig]
      });

      const result = await coachingModeService.getCourseConfig(7);

      expect(result).toEqual(mockConfig);
      expect(postgresService.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM course_bot_configs'),
        [7]
      );
    });

    it('should return null if no config found', async () => {
      postgresService.query = jest.fn().mockResolvedValue({
        rows: []
      });

      const result = await coachingModeService.getCourseConfig(999);

      expect(result).toBeNull();
    });
  });

  describe('getUserPreference', () => {
    it('should retrieve user preference', async () => {
      const mockPref = {
        user_id: 1,
        course_id: 7,
        selected_mode: 'socratic',
        mode_switches_count: 3
      };

      postgresService.query = jest.fn().mockResolvedValueOnce({
        rows: [mockPref]
      });

      const result = await coachingModeService.getUserPreference(1, 7);

      expect(result).toEqual(mockPref);
    });

    it('should return default from course config if no preference exists', async () => {
      postgresService.query = jest.fn()
        .mockResolvedValueOnce({ rows: [] }) // No preference
        .mockResolvedValueOnce({
          rows: [{ default_mode: 'regular' }]
        }); // Course config

      // Mock getCourseConfig
      jest.spyOn(coachingModeService, 'getCourseConfig').mockResolvedValue({
        default_mode: 'regular'
      });

      const result = await coachingModeService.getUserPreference(1, 7);

      expect(result.selected_mode).toBe('regular');
      expect(result.is_new).toBe(true);
    });
  });

  describe('switchMode', () => {
    it('should switch mode successfully', async () => {
      const mockConfig = {
        allow_mode_switching: true,
        switch_cooldown_minutes: 0
      };

      const mockNewPref = {
        user_id: 1,
        course_id: 7,
        selected_mode: 'socratic',
        mode_switches_count: 1
      };

      jest.spyOn(coachingModeService, 'getCourseConfig').mockResolvedValue(mockConfig);
      jest.spyOn(coachingModeService, 'getUserPreference').mockResolvedValue({
        selected_mode: 'regular'
      });

      postgresService.query = jest.fn().mockResolvedValue({
        rows: [mockNewPref]
      });

      const result = await coachingModeService.switchMode(1, 7, 'socratic');

      expect(result.success).toBe(true);
      expect(result.current_mode).toBe('socratic');
      expect(result.message).toContain('Successfully switched');
    });

    it('should reject invalid mode', async () => {
      const result = await coachingModeService.switchMode(1, 7, 'invalid_mode');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid mode');
    });

    it('should respect cooldown period', async () => {
      const mockConfig = {
        allow_mode_switching: true,
        switch_cooldown_minutes: 60
      };

      const recentSwitchTime = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago

      jest.spyOn(coachingModeService, 'getCourseConfig').mockResolvedValue(mockConfig);
      jest.spyOn(coachingModeService, 'getUserPreference').mockResolvedValue({
        selected_mode: 'regular',
        last_mode_switch: recentSwitchTime
      });

      const result = await coachingModeService.switchMode(1, 7, 'socratic');

      expect(result.success).toBe(false);
      expect(result.message).toContain('wait');
      expect(result.cooldown_remaining_minutes).toBeGreaterThan(0);
    });

    it('should not switch if already in that mode', async () => {
      const mockConfig = {
        allow_mode_switching: true
      };

      jest.spyOn(coachingModeService, 'getCourseConfig').mockResolvedValue(mockConfig);
      jest.spyOn(coachingModeService, 'getUserPreference').mockResolvedValue({
        selected_mode: 'regular'
      });

      const result = await coachingModeService.switchMode(1, 7, 'regular');

      expect(result.success).toBe(true);
      expect(result.already_active).toBe(true);
      expect(result.message).toContain('Already in');
    });

    it('should reject if mode switching not allowed', async () => {
      const mockConfig = {
        allow_mode_switching: false
      };

      jest.spyOn(coachingModeService, 'getCourseConfig').mockResolvedValue(mockConfig);

      const result = await coachingModeService.switchMode(1, 7, 'socratic');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not allowed');
    });
  });

  describe('getModePrompt', () => {
    it('should retrieve mode-specific prompt', async () => {
      const mockConfig = {
        regular_prompt: 'You are helpful',
        regular_greeting: 'Hello!',
        regular_help_text: 'I help',
        socratic_prompt: 'Ask questions',
        socratic_greeting: 'Let\'s discover',
        socratic_help_text: 'I guide'
      };

      jest.spyOn(coachingModeService, 'getCourseConfig').mockResolvedValue(mockConfig);
      jest.spyOn(coachingModeService, 'getUserPreference').mockResolvedValue({
        selected_mode: 'socratic'
      });

      const result = await coachingModeService.getModePrompt(1, 7);

      expect(result.mode).toBe('socratic');
      expect(result.prompt).toBe(mockConfig.socratic_prompt);
      expect(result.greeting).toBe(mockConfig.socratic_greeting);
      expect(result.help_text).toBe(mockConfig.socratic_help_text);
    });
  });

  describe('startSession', () => {
    it('should start a coaching session', async () => {
      const mockSession = {
        id: 1,
        user_id: 1,
        course_id: 7,
        mode_used: 'regular',
        session_start: new Date()
      };

      jest.spyOn(coachingModeService, 'getUserPreference').mockResolvedValue({
        selected_mode: 'regular'
      });
      jest.spyOn(coachingModeService, 'getCourseConfig').mockResolvedValue({
        default_mode: 'regular'
      });

      postgresService.query = jest.fn().mockResolvedValue({
        rows: [mockSession]
      });

      const result = await coachingModeService.startSession(1, 7);

      expect(result).toEqual(mockSession);
      expect(postgresService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO coaching_sessions'),
        [1, 7, 'regular']
      );
    });
  });

  describe('endSession', () => {
    it('should end a coaching session with metrics', async () => {
      const mockEndedSession = {
        id: 1,
        duration_minutes: 15,
        completion_status: 'completed',
        quiz_score: 85
      };

      postgresService.query = jest.fn().mockResolvedValue({
        rows: [mockEndedSession]
      });

      jest.spyOn(coachingModeService, 'trackModeTime').mockResolvedValue();

      const result = await coachingModeService.endSession(1, 'completed', {
        quiz_score: 85,
        satisfaction_rating: 5
      });

      expect(result.completion_status).toBe('completed');
      expect(postgresService.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE coaching_sessions'),
        ['completed', 85, 5, 1]
      );
    });
  });

  describe('getAvailableCommands', () => {
    it('should return list of available commands', () => {
      const commands = coachingModeService.getAvailableCommands();

      expect(commands).toBeInstanceOf(Array);
      expect(commands.length).toBeGreaterThan(0);
      expect(commands[0]).toHaveProperty('command');
      expect(commands[0]).toHaveProperty('description');
    });
  });

  describe('parseModeCommand', () => {
    it('should parse /regular command', () => {
      const result = coachingModeService.parseModeCommand('/regular');

      expect(result).not.toBeNull();
      expect(result.mode).toBe('regular');
    });

    it('should parse /socratic command', () => {
      const result = coachingModeService.parseModeCommand('/socratic');

      expect(result).not.toBeNull();
      expect(result.mode).toBe('socratic');
    });

    it('should parse /mode command', () => {
      const result = coachingModeService.parseModeCommand('/mode');

      expect(result).not.toBeNull();
      expect(result.action).toBe('show_current');
    });

    it('should parse /modes command', () => {
      const result = coachingModeService.parseModeCommand('/modes');

      expect(result).not.toBeNull();
      expect(result.action).toBe('list_all');
    });

    it('should return null for non-mode commands', () => {
      const result = coachingModeService.parseModeCommand('hello');

      expect(result).toBeNull();
    });
  });

  describe('logSessionMessage', () => {
    it('should log a message in session', async () => {
      postgresService.query = jest.fn().mockResolvedValue({});

      await coachingModeService.logSessionMessage(1, false);

      expect(postgresService.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE coaching_sessions'),
        [1]
      );
    });

    it('should increment questions_asked if message is a question', async () => {
      postgresService.query = jest.fn().mockResolvedValue({});

      await coachingModeService.logSessionMessage(1, true);

      expect(postgresService.query).toHaveBeenCalledWith(
        expect.stringContaining('questions_asked = questions_asked + 1'),
        [1]
      );
    });
  });

  describe('trackModeTime', () => {
    it('should track regular mode time', async () => {
      postgresService.query = jest.fn().mockResolvedValue({});

      await coachingModeService.trackModeTime(1, 7, 'regular', 15.5);

      expect(postgresService.query).toHaveBeenCalledWith(
        expect.stringContaining('regular_mode_time_minutes'),
        [16, 1, 7] // Rounded to 16
      );
    });

    it('should track socratic mode time', async () => {
      postgresService.query = jest.fn().mockResolvedValue({});

      await coachingModeService.trackModeTime(1, 7, 'socratic', 20.2);

      expect(postgresService.query).toHaveBeenCalledWith(
        expect.stringContaining('socratic_mode_time_minutes'),
        [20, 1, 7]
      );
    });
  });
});
