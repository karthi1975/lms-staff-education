/**
 * QuizStateManager
 *
 * SOLID Principle: Single Responsibility Principle (SRP)
 * Responsibility: Manage quiz state in sessions ONLY
 *
 * Handles quiz state creation, updates, and retrieval.
 */
class QuizStateManager {
  /**
   * Initialize quiz state in session
   * @param {Object} session - User session
   * @param {string} moduleId - Module ID
   * @param {Array} questions - Quiz questions
   */
  initialize(session, moduleId, questions) {
    session.quizState = {
      moduleId,
      questions,
      currentQuestion: 0,
      answers: [],
      startTime: new Date()
    };
  }

  /**
   * Get current quiz state
   * @param {Object} session - User session
   * @returns {Object|null} - Quiz state or null
   */
  getState(session) {
    return session.quizState || null;
  }

  /**
   * Check if user is in quiz mode
   * @param {Object} session - User session
   * @returns {boolean} - True if in quiz mode
   */
  isInQuizMode(session) {
    return !!session.quizState;
  }

  /**
   * Record answer
   * @param {Object} session - User session
   * @param {number} selectedOption - Selected option index
   * @param {boolean} isCorrect - Whether answer is correct
   * @param {string} explanation - Explanation
   */
  recordAnswer(session, selectedOption, isCorrect, explanation) {
    const { quizState } = session;
    const currentQ = quizState.questions[quizState.currentQuestion];

    quizState.answers.push({
      question: currentQ.question,
      selectedOption,
      correct: isCorrect,
      explanation
    });
  }

  /**
   * Move to next question
   * @param {Object} session - User session
   * @returns {boolean} - True if moved, false if no more questions
   */
  moveToNextQuestion(session) {
    const { quizState } = session;

    if (quizState.currentQuestion >= quizState.questions.length - 1) {
      return false; // Quiz is complete
    }

    quizState.currentQuestion++;
    return true;
  }

  /**
   * Get current question
   * @param {Object} session - User session
   * @returns {Object|null} - Current question or null
   */
  getCurrentQuestion(session) {
    const { quizState } = session;
    if (!quizState) return null;

    return quizState.questions[quizState.currentQuestion];
  }

  /**
   * Check if quiz is complete
   * @param {Object} session - User session
   * @returns {boolean} - True if complete
   */
  isComplete(session) {
    const { quizState } = session;
    if (!quizState) return true;

    return quizState.currentQuestion >= quizState.questions.length - 1;
  }

  /**
   * Get quiz results
   * @param {Object} session - User session
   * @returns {Object} - Quiz results
   */
  getResults(session) {
    const { quizState } = session;

    return {
      moduleId: quizState.moduleId,
      answers: quizState.answers,
      totalQuestions: quizState.questions.length,
      correctAnswers: quizState.answers.filter(a => a.correct).length,
      startTime: quizState.startTime,
      endTime: new Date(),
      duration: Math.floor((new Date() - quizState.startTime) / 1000)
    };
  }

  /**
   * Clear quiz state
   * @param {Object} session - User session
   */
  clear(session) {
    session.quizState = null;
  }

  /**
   * Get quiz progress
   * @param {Object} session - User session
   * @returns {Object} - Progress info
   */
  getProgress(session) {
    const { quizState } = session;
    if (!quizState) return null;

    return {
      current: quizState.currentQuestion + 1,
      total: quizState.questions.length,
      answered: quizState.answers.length
    };
  }
}

module.exports = QuizStateManager;
