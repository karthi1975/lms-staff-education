const BaseCommandHandler = require('./BaseCommandHandler');

/**
 * QuizCommandHandler
 *
 * SOLID Principles:
 * - SRP: Handles quiz commands ONLY
 * - OCP: Extends BaseCommandHandler without modification
 * - LSP: Can be substituted for BaseCommandHandler
 *
 * Handles both quiz start and quiz answers.
 */
class QuizCommandHandler extends BaseCommandHandler {
  canHandle(input, session) {
    const lowerInput = input.toLowerCase().trim();

    // Handle quiz start command
    if (lowerInput.startsWith('quiz')) {
      return true;
    }

    // Handle quiz answers (when in quiz mode)
    if (session.quizState) {
      return true;
    }

    return false;
  }

  async handle(userId, input, userProgress, session) {
    const lowerInput = input.toLowerCase().trim();

    // If in quiz mode, handle answer
    if (session.quizState) {
      return await this.quizManager.handleAnswer(userId, input, session);
    }

    // Handle quiz start command
    if (lowerInput.startsWith('quiz')) {
      const moduleMatch = lowerInput.match(/quiz\s*(\d)/);

      if (!moduleMatch) {
        // Just "quiz" without module number - show help
        return await this.quizManager.getQuizHelp(userId, userProgress);
      }

      const moduleId = `module_${moduleMatch[1]}`;
      return await this.quizManager.startQuiz(userId, moduleId, session);
    }

    return {
      type: 'text',
      content: 'Type "quiz <number>" to start a quiz (e.g., "quiz 1")'
    };
  }
}

module.exports = QuizCommandHandler;
