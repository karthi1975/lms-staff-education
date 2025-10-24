const BaseCommandHandler = require('./BaseCommandHandler');

/**
 * GreetingCommandHandler
 *
 * SOLID Principles:
 * - SRP: Handles greetings ONLY
 * - OCP: Extends BaseCommandHandler without modification
 * - LSP: Can be substituted for BaseCommandHandler
 *
 * Handles welcome messages and greetings.
 */
class GreetingCommandHandler extends BaseCommandHandler {
  canHandle(input, session) {
    const lowerInput = input.toLowerCase().trim();
    return lowerInput.match(/^(hello|hi|hey|start|hola|habari)/);
  }

  async handle(userId, input, userProgress, session) {
    return {
      type: 'text',
      content: `👋 Welcome to Teachers Training!\n\nI'm your AI learning assistant. I can help you with:\n\n📚 Module 1: Introduction to Teaching\n📚 Module 2: Classroom Management\n📚 Module 3: Lesson Planning\n📚 Module 4: Assessment Strategies\n📚 Module 5: Technology in Education\n\nCommands:\n• Type "module 1" to start\n• Type "progress" to see your progress\n• Type "quiz 1" to take a quiz\n• Ask me any teaching questions!\n\nLet's get started! 🚀`
    };
  }
}

module.exports = GreetingCommandHandler;
