/**
 * Unit tests for PromptTemplateService
 */

const promptTemplateService = require('../../services/coaching/prompt-template.service');

describe('PromptTemplateService', () => {
  describe('generateSystemPrompt', () => {
    it('should generate regular mode system prompt', () => {
      const prompt = promptTemplateService.generateSystemPrompt('regular');

      expect(prompt).toBeTruthy();
      expect(prompt).toContain('helpful teaching assistant');
      expect(prompt.length).toBeGreaterThan(100);
    });

    it('should generate socratic mode system prompt', () => {
      const prompt = promptTemplateService.generateSystemPrompt('socratic');

      expect(prompt).toBeTruthy();
      expect(prompt).toContain('Socratic');
      expect(prompt).toContain('questions');
      expect(prompt).toContain('NEVER give direct answers');
    });

    it('should use custom prompt if provided', () => {
      const customPrompt = 'Custom teaching assistant prompt';
      const prompt = promptTemplateService.generateSystemPrompt('regular', customPrompt);

      expect(prompt).toContain(customPrompt);
    });

    it('should inject context when provided', () => {
      const context = {
        courseName: 'Math 101',
        moduleName: 'Algebra',
        topic: 'Quadratic equations'
      };

      const prompt = promptTemplateService.generateSystemPrompt('regular', null, context);

      expect(prompt).toContain('Math 101');
      expect(prompt).toContain('Algebra');
      expect(prompt).toContain('Quadratic equations');
    });
  });

  describe('generateGreeting', () => {
    it('should generate regular mode greeting', () => {
      const greeting = promptTemplateService.generateGreeting('regular');

      expect(greeting).toBeTruthy();
      expect(greeting).toContain('Hello');
    });

    it('should generate socratic mode greeting', () => {
      const greeting = promptTemplateService.generateGreeting('socratic');

      expect(greeting).toBeTruthy();
      expect(greeting).toContain('questions');
    });

    it('should personalize greeting with user name', () => {
      const greeting = promptTemplateService.generateGreeting('regular', null, 'John');

      expect(greeting).toContain('John');
    });

    it('should use custom greeting if provided', () => {
      const customGreeting = 'Welcome to the course!';
      const greeting = promptTemplateService.generateGreeting('regular', customGreeting);

      expect(greeting).toBe(customGreeting);
    });
  });

  describe('generateHelpText', () => {
    it('should generate regular mode help text', () => {
      const helpText = promptTemplateService.generateHelpText('regular');

      expect(helpText).toBeTruthy();
      expect(helpText).toContain('direct answers');
    });

    it('should generate socratic mode help text', () => {
      const helpText = promptTemplateService.generateHelpText('socratic');

      expect(helpText).toBeTruthy();
      expect(helpText).toContain('questions');
      expect(helpText).toContain('discover');
    });

    it('should use custom help text if provided', () => {
      const customHelp = 'Custom help text for learners';
      const helpText = promptTemplateService.generateHelpText('regular', customHelp);

      expect(helpText).toBe(customHelp);
    });
  });

  describe('injectContext', () => {
    it('should replace placeholders with context values', () => {
      const template = 'Hello {name}, welcome to {course}!';
      const context = {
        name: 'Alice',
        course: 'Biology 101'
      };

      const result = promptTemplateService.injectContext(template, context);

      expect(result).toBe('Hello Alice, welcome to Biology 101!');
    });

    it('should handle missing context values', () => {
      const template = 'Hello {name}, your score is {score}';
      const context = { name: 'Bob' };

      const result = promptTemplateService.injectContext(template, context);

      expect(result).toContain('Bob');
      expect(result).toContain('N/A'); // Missing values become 'N/A'
    });

    it('should handle multiple occurrences of same placeholder', () => {
      const template = '{name} scored {score}. {name} is doing great!';
      const context = { name: 'Charlie', score: '95' };

      const result = promptTemplateService.injectContext(template, context);

      expect(result).toBe('Charlie scored 95. Charlie is doing great!');
    });
  });

  describe('validatePrompt', () => {
    it('should validate a good regular prompt', () => {
      const prompt = 'You are a helpful assistant. Provide clear answers and explanations to help learners understand concepts.';
      const validation = promptTemplateService.validatePrompt(prompt, 'regular');

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should validate a good socratic prompt', () => {
      const prompt = 'You are a Socratic assistant. Never give direct answers. Ask guiding questions to help learners discover solutions themselves.';
      const validation = promptTemplateService.validatePrompt(prompt, 'socratic');

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject empty prompt', () => {
      const validation = promptTemplateService.validatePrompt('', 'regular');

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('cannot be empty');
    });

    it('should reject prompts that are too long', () => {
      const longPrompt = 'a'.repeat(4001);
      const validation = promptTemplateService.validatePrompt(longPrompt, 'regular');

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('too long'))).toBe(true);
    });

    it('should warn about short prompts', () => {
      const shortPrompt = 'Help students';
      const validation = promptTemplateService.validatePrompt(shortPrompt, 'regular');

      expect(validation.warnings.length).toBeGreaterThan(0);
    });

    it('should warn if socratic prompt lacks question guidance', () => {
      const prompt = 'You are a teaching assistant for this course.';
      const validation = promptTemplateService.validatePrompt(prompt, 'socratic');

      expect(validation.warnings.some(w => w.includes('question'))).toBe(true);
    });
  });

  describe('checkSecurityIssues', () => {
    it('should detect script tags', () => {
      const prompt = 'Hello <script>alert("test")</script> world';
      const issues = promptTemplateService.checkSecurityIssues(prompt);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some(i => i.includes('script'))).toBe(true);
    });

    it('should detect SQL-like commands', () => {
      const prompt = 'DROP TABLE users';
      const issues = promptTemplateService.checkSecurityIssues(prompt);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some(i => i.includes('SQL'))).toBe(true);
    });

    it('should detect command injection patterns', () => {
      const prompt = 'Run $(rm -rf /)';
      const issues = promptTemplateService.checkSecurityIssues(prompt);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some(i => i.includes('injection'))).toBe(true);
    });

    it('should pass clean prompts', () => {
      const prompt = 'You are a helpful teaching assistant.';
      const issues = promptTemplateService.checkSecurityIssues(prompt);

      expect(issues).toHaveLength(0);
    });
  });

  describe('sanitizePrompt', () => {
    it('should remove script tags', () => {
      const dirty = 'Hello <script>bad</script> world';
      const clean = promptTemplateService.sanitizePrompt(dirty);

      expect(clean).not.toContain('<script>');
      expect(clean).toContain('Hello');
      expect(clean).toContain('world');
    });

    it('should remove angle brackets', () => {
      const dirty = 'Test <tag> content';
      const clean = promptTemplateService.sanitizePrompt(dirty);

      expect(clean).not.toContain('<');
      expect(clean).not.toContain('>');
    });

    it('should trim whitespace', () => {
      const dirty = '   Extra spaces   ';
      const clean = promptTemplateService.sanitizePrompt(dirty);

      expect(clean).toBe('Extra spaces');
    });

    it('should handle empty input', () => {
      const clean = promptTemplateService.sanitizePrompt('');

      expect(clean).toBe('');
    });

    it('should handle null input', () => {
      const clean = promptTemplateService.sanitizePrompt(null);

      expect(clean).toBe('');
    });
  });

  describe('generatePromptConfig', () => {
    it('should generate complete regular mode config', () => {
      const config = promptTemplateService.generatePromptConfig('regular');

      expect(config).toHaveProperty('mode', 'regular');
      expect(config).toHaveProperty('system_prompt');
      expect(config).toHaveProperty('greeting');
      expect(config).toHaveProperty('help_text');
      expect(config).toHaveProperty('allow_mode_switching');
      expect(config.system_prompt.length).toBeGreaterThan(100);
    });

    it('should generate complete socratic mode config', () => {
      const config = promptTemplateService.generatePromptConfig('socratic');

      expect(config).toHaveProperty('mode', 'socratic');
      expect(config.system_prompt).toContain('questions');
    });

    it('should include custom config if provided', () => {
      const customConfig = {
        system_prompt: 'Custom prompt',
        greeting: 'Custom greeting',
        allow_mode_switching: false
      };

      const config = promptTemplateService.generatePromptConfig('regular', customConfig);

      expect(config.system_prompt).toContain('Custom prompt');
      expect(config.greeting).toBe('Custom greeting');
      expect(config.allow_mode_switching).toBe(false);
    });
  });

  describe('getModeExamples', () => {
    it('should return regular mode example', () => {
      const example = promptTemplateService.getModeExamples('regular');

      expect(example).toHaveProperty('question');
      expect(example).toHaveProperty('expectedResponse');
      expect(example).toHaveProperty('characteristics');
      expect(example.characteristics).toContain('Direct answer provided');
    });

    it('should return socratic mode example', () => {
      const example = promptTemplateService.getModeExamples('socratic');

      expect(example).toHaveProperty('question');
      expect(example).toHaveProperty('expectedResponse');
      expect(example.characteristics).toContain('Question in response');
    });

    it('should return null for invalid mode', () => {
      const example = promptTemplateService.getModeExamples('invalid');

      expect(example).toBeNull();
    });
  });

  describe('formatModeInfo', () => {
    it('should format regular mode info', () => {
      const info = promptTemplateService.formatModeInfo('regular', {
        allow_mode_switching: true,
        switch_cooldown_minutes: 0
      });

      expect(info).toContain('Regular Mode');
      expect(info).toContain('direct answers');
      expect(info).toContain('/regular');
      expect(info).toContain('/socratic');
    });

    it('should format socratic mode info', () => {
      const info = promptTemplateService.formatModeInfo('socratic', {
        allow_mode_switching: true,
        switch_cooldown_minutes: 0
      });

      expect(info).toContain('Socratic Mode');
      expect(info).toContain('questions');
    });

    it('should show cooldown info if applicable', () => {
      const info = promptTemplateService.formatModeInfo('regular', {
        allow_mode_switching: true,
        switch_cooldown_minutes: 10
      });

      expect(info).toContain('10-minute cooldown');
    });

    it('should indicate if mode switching is not allowed', () => {
      const info = promptTemplateService.formatModeInfo('regular', {
        allow_mode_switching: false
      });

      expect(info).toContain('not available');
    });
  });

  describe('generateModeComparison', () => {
    it('should generate comparison text', () => {
      const comparison = promptTemplateService.generateModeComparison();

      expect(comparison).toContain('Regular Mode');
      expect(comparison).toContain('Socratic Mode');
      expect(comparison).toContain('direct answers');
      expect(comparison).toContain('guiding questions');
      expect(comparison).toContain('/regular');
      expect(comparison).toContain('/socratic');
    });
  });
});
