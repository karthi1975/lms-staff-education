const { v4: uuidv4 } = require('uuid');

/**
 * QuizScorer
 *
 * SOLID Principle: Single Responsibility Principle (SRP)
 * Responsibility: Calculate quiz scores and determine pass/fail ONLY
 *
 * Handles score calculation and result evaluation.
 */
class QuizScorer {
  constructor(config) {
    this.config = config;
  }

  /**
   * Calculate quiz score
   * @param {number} correctAnswers - Number of correct answers
   * @param {number} totalQuestions - Total number of questions
   * @returns {number} - Score percentage (0-100)
   */
  calculateScore(correctAnswers, totalQuestions) {
    if (totalQuestions === 0) return 0;
    return (correctAnswers / totalQuestions) * 100;
  }

  /**
   * Determine if quiz passed
   * @param {number} score - Score percentage
   * @returns {boolean} - True if passed
   */
  hasPassed(score) {
    return score >= this.config.getQuizPassThreshold();
  }

  /**
   * Parse user answer input
   * @param {string} answer - User's answer (letter or number)
   * @returns {number} - Option index (-1 if invalid)
   */
  parseAnswer(answer) {
    // Letter answer (A, B, C, D)
    if (answer.match(/^[a-d]$/i)) {
      return answer.toUpperCase().charCodeAt(0) - 65;
    }

    // Number answer (1, 2, 3, 4)
    if (answer.match(/^[1-4]$/)) {
      return parseInt(answer) - 1;
    }

    return -1; // Invalid answer
  }

  /**
   * Create quiz result object
   * @param {Object} quizResults - Quiz results from QuizStateManager
   * @returns {Object} - Quiz result object with score and pass status
   */
  createResult(quizResults) {
    const { correctAnswers, totalQuestions, duration, moduleId } = quizResults;

    const score = this.calculateScore(correctAnswers, totalQuestions);
    const passed = this.hasPassed(score);

    return {
      quizId: uuidv4(),
      moduleId,
      score,
      totalQuestions,
      correctAnswers,
      passed,
      duration,
      attemptNumber: 1 // TODO: Track attempt number
    };
  }

  /**
   * Get pass/fail message
   * @param {boolean} passed - Whether quiz was passed
   * @param {number} score - Score percentage
   * @returns {string} - Pass/fail message
   */
  getResultMessage(passed, score) {
    if (passed) {
      return `🎉 Congratulations! You passed with ${score.toFixed(1)}%!`;
    }

    const threshold = this.config.getQuizPassThreshold();
    return `📚 You scored ${score.toFixed(1)}%. You need ${threshold}% to pass. Keep studying and try again!`;
  }
}

module.exports = QuizScorer;
