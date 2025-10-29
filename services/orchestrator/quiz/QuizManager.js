/**
 * QuizManager
 *
 * SOLID Principle: Single Responsibility Principle (SRP)
 * Responsibility: Coordinate quiz operations ONLY
 *
 * Orchestrates quiz lifecycle using QuizStateManager and QuizScorer.
 */
class QuizManager {
  constructor(
    config,
    quizStateManager,
    quizScorer,
    moduleManager,
    chromaService,
    vertexAIService,
    neo4jService,
    logger
  ) {
    this.config = config;
    this.quizStateManager = quizStateManager;
    this.quizScorer = quizScorer;
    this.moduleManager = moduleManager;
    this.chromaService = chromaService;
    this.vertexAIService = vertexAIService;
    this.neo4jService = neo4jService;
    this.logger = logger;
  }

  /**
   * Start quiz for module
   * @param {string} userId - User ID
   * @param {string} moduleId - Module ID
   * @param {Object} session - User session
   * @returns {Promise<Object>} - First question response
   */
  async startQuiz(userId, moduleId, session) {
    try {
      // Check module access
      const canAccess = await this.moduleManager.canUserAccessModule(userId, moduleId);
      if (!canAccess) {
        return {
          type: 'text',
          content: '🔒 You need to complete previous modules first!'
        };
      }

      // Get module content
      const moduleContent = await this.chromaService.getDocumentsByModule(moduleId, 5);

      if (moduleContent.length === 0) {
        return {
          type: 'text',
          content: '📚 No content available for this module yet. Please upload training materials first.'
        };
      }

      // Generate quiz questions
      const quiz = await this.vertexAIService.generateQuizQuestions(
        moduleContent.map(d => d.content).join('\n'),
        moduleId
      );

      // Initialize quiz state
      this.quizStateManager.initialize(session, moduleId, quiz.questions);

      // Return first question
      return this.getQuestionResponse(session);
    } catch (error) {
      this.logger.error('Error starting quiz:', error);
      return {
        type: 'text',
        content: 'Failed to start quiz. Please try again later.'
      };
    }
  }

  /**
   * Handle quiz answer
   * @param {string} userId - User ID
   * @param {string} answer - User's answer
   * @param {Object} session - User session
   * @returns {Promise<Object>} - Next question or completion response
   */
  async handleAnswer(userId, answer, session) {
    const quizState = this.quizStateManager.getState(session);
    if (!quizState) {
      return {
        type: 'text',
        content: 'No active quiz. Type "quiz <number>" to start a quiz.'
      };
    }

    const currentQ = this.quizStateManager.getCurrentQuestion(session);
    const selectedOption = this.quizScorer.parseAnswer(answer);

    // Validate answer
    if (selectedOption === -1) {
      return {
        type: 'text',
        content: '❓ Please answer with A, B, C, D or 1, 2, 3, 4'
      };
    }

    // Record answer
    const isCorrect = selectedOption === currentQ.correct;
    this.quizStateManager.recordAnswer(
      session,
      selectedOption,
      isCorrect,
      currentQ.explanation
    );

    // Check if quiz is complete
    if (this.quizStateManager.isComplete(session)) {
      return await this.completeQuiz(userId, session);
    }

    // Move to next question
    this.quizStateManager.moveToNextQuestion(session);

    // Return next question with feedback
    return this.getQuestionResponseWithFeedback(
      session,
      isCorrect,
      currentQ.explanation
    );
  }

  /**
   * Complete quiz and calculate results
   * @param {string} userId - User ID
   * @param {Object} session - User session
   * @returns {Promise<Object>} - Quiz completion response
   */
  async completeQuiz(userId, session) {
    const results = this.quizStateManager.getResults(session);
    const quizResult = this.quizScorer.createResult(results);

    // Record quiz attempt in Neo4j
    await this.neo4jService.recordQuizAttempt(userId, results.moduleId, quizResult);

    // Update progress if passed
    if (quizResult.passed) {
      await this.moduleManager.completeModule(
        userId,
        results.moduleId,
        quizResult.score,
        results.duration
      );

      // Unlock next module
      const nextModule = await this.moduleManager.unlockNextModule(
        userId,
        results.moduleId
      );
    }

    // Clear quiz state
    this.quizStateManager.clear(session);

    // Return completion message
    return this.getCompletionResponse(quizResult, results);
  }

  /**
   * Get quiz help message
   * @param {string} userId - User ID
   * @param {Object} userProgress - User progress
   * @returns {Promise<Object>} - Help response
   */
  async getQuizHelp(userId, userProgress) {
    try {
      const availableModules = await this.moduleManager.getAvailableModules(
        userId,
        userProgress
      );

      if (availableModules.length === 0) {
        return {
          type: 'text',
          content: '🎉 You have completed all available quizzes!\n\nType "progress" to see your achievements.'
        };
      }

      const currentModule = availableModules[0];

      let helpText = `📝 *Quiz Help*\n\n`;
      helpText += `To take a quiz, type the module number. For example:\n\n`;

      availableModules.forEach(m => {
        helpText += `• *quiz ${m.order}* - ${m.name}\n`;
      });

      helpText += `\nRecommended: *quiz ${currentModule.order}* (${currentModule.name})`;

      return {
        type: 'text',
        content: helpText
      };
    } catch (error) {
      this.logger.error('Error getting quiz help:', error);
      return {
        type: 'text',
        content: 'To take a quiz, type "quiz" followed by the module number (e.g., "quiz 1", "quiz 2").'
      };
    }
  }

  /**
   * Get question response
   * @param {Object} session - User session
   * @returns {Object} - Question response
   */
  getQuestionResponse(session) {
    const currentQ = this.quizStateManager.getCurrentQuestion(session);
    const progress = this.quizStateManager.getProgress(session);
    const module = this.config.getModuleById(session.quizState.moduleId);

    return {
      type: 'quiz',
      content: `📝 **Quiz for ${module.name}**\n\nQuestion ${progress.current}/${progress.total}:\n${currentQ.question}`,
      options: currentQ.options.map((opt, idx) => ({
        id: `opt_${idx}`,
        title: opt
      }))
    };
  }

  /**
   * Get question response with feedback
   * @param {Object} session - User session
   * @param {boolean} isCorrect - Whether answer was correct
   * @param {string} explanation - Explanation
   * @returns {Object} - Question response with feedback
   */
  getQuestionResponseWithFeedback(session, isCorrect, explanation) {
    const currentQ = this.quizStateManager.getCurrentQuestion(session);
    const progress = this.quizStateManager.getProgress(session);

    const feedback = isCorrect ? '✅ Correct!' : '❌ Incorrect.';

    return {
      type: 'quiz',
      content: `${feedback} ${explanation}\n\nQuestion ${progress.current}/${progress.total}:\n${currentQ.question}`,
      options: currentQ.options.map((opt, idx) => ({
        id: `opt_${idx}`,
        title: opt
      }))
    };
  }

  /**
   * Get quiz completion response
   * @param {Object} quizResult - Quiz result from scorer
   * @param {Object} results - Full results from state manager
   * @returns {Object} - Completion response
   */
  getCompletionResponse(quizResult, results) {
    const resultMessage = this.quizScorer.getResultMessage(
      quizResult.passed,
      quizResult.score
    );

    const nextModuleInfo = quizResult.passed && this.config.getNextModule(results.moduleId)
      ? ' Next module unlocked!'
      : '';

    return {
      type: 'text',
      content: `🎯 **Quiz Complete!**\n\nScore: ${quizResult.score.toFixed(1)}%\nCorrect: ${quizResult.correctAnswers}/${quizResult.totalQuestions}\n\n${resultMessage}${nextModuleInfo}`
    };
  }
}

module.exports = QuizManager;
