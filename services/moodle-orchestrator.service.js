/**
 * Moodle Orchestrator Service - Simplified
 * Handles: Course selection → Module selection → Chat → Quiz
 */

// Use the adapter service to support both Meta and Twilio
const whatsappService = require('./whatsapp-adapter.service');
const chromaService = require('./chroma.service');
const vertexAIService = require('./vertexai.service');
const giftParserService = require('./gift-parser.service');
const postgresService = require('./database/postgres.service');
const moodleSyncService = require('./moodle-sync.service');
const logger = require('../utils/logger');
const path = require('path');

class MoodleOrchestratorService {
  constructor() {
    // Courses and modules will be loaded from database
    this.courses = [];
    this.initialized = false;
  }

  /**
   * Initialize service - load courses and modules from database
   */
  async initialize() {
    try {
      // Load courses from database (use 'courses' table, not 'moodle_courses')
      const coursesResult = await postgresService.query(`
        SELECT id, code, title, description
        FROM courses
        WHERE is_active = true
        ORDER BY sequence_order
      `).catch(err => {
        logger.warn('Courses table not ready, skipping moodle orchestrator initialization');
        return { rows: [] };
      });

      this.courses = [];

      for (const course of coursesResult.rows) {
        // Load modules for this course (use 'modules' table, not 'moodle_modules')
        const modulesResult = await postgresService.query(`
          SELECT id, code, title, description, sequence_order
          FROM modules
          WHERE course_id = $1
          ORDER BY sequence_order
        `, [course.id]).catch(err => {
          logger.warn(`Modules table not ready for course ${course.id}`);
          return { rows: [] };
        });

        // Load quizzes for each module (check moodle_quizzes for compatibility)
        const modules = [];
        for (const module of modulesResult.rows) {
          const quizResult = await postgresService.query(`
            SELECT id, moodle_quiz_id, quiz_name
            FROM moodle_quizzes
            WHERE moodle_module_id = $1
            LIMIT 1
          `, [module.id]).catch(err => {
            logger.warn(`Quizzes table not ready for module ${module.id}`);
            return { rows: [] };
          });

          modules.push({
            id: module.id,
            name: module.title,
            description: module.description,
            has_quiz: quizResult.rows.length > 0,
            quiz_id: quizResult.rows.length > 0 ? quizResult.rows[0].id : null
          });
        }

        this.courses.push({
          id: course.id,
          name: course.title,
          code: course.code,
          description: course.description,
          modules
        });
      }

      this.initialized = true;
      logger.info(`✅ Loaded ${this.courses.length} courses from database`);
      this.courses.forEach(c => {
        logger.info(`   - ${c.name}: ${c.modules.length} modules`);
      });
    } catch (error) {
      logger.error('Failed to initialize MoodleOrchestrator:', error);
      throw error;
    }
  }

  /**
   * Handle incoming WhatsApp message
   */
  async handleMessage(userId, whatsappPhone, message) {
    try {
      // Ensure initialized
      if (!this.initialized) {
        await this.initialize();
      }

      // Get conversation context
      const context = await this.getConversationContext(userId, whatsappPhone);

      const lowerMsg = message.toLowerCase().trim();

      // **STRICT FLOW ENFORCEMENT**: Check for fresh start/greeting in ANY state
      // This allows users to restart flow from anywhere
      if (lowerMsg.match(/^(hi|hello|hey|start|teach me|begin|restart)$/)) {
        logger.info(`Detected greeting/restart command from user ${userId}, resetting to course selection`);

        // Reset to course selection state
        await this.updateConversationState(userId, {
          conversation_state: 'course_selection',
          current_course_id: null,
          current_module_id: null,
          current_question_index: null,
          quiz_answers: null,
          context_data: JSON.stringify({})
        });

        return this.showCourseSelection();
      }

      // Route based on conversation state
      switch (context.conversation_state) {
        case 'idle':
          return await this.handleIdleState(userId, message, context);

        case 'course_selection':
          return await this.handleCourseSelection(userId, message, context);

        case 'module_selection':
          return await this.handleModuleSelection(userId, message, context);

        case 'learning':
          return await this.handleLearningState(userId, message, context);

        case 'quiz_active':
          return await this.handleQuizState(userId, message, context);

        default:
          return { text: "Something went wrong. Type 'start' to begin again." };
      }
    } catch (error) {
      logger.error('Error in MoodleOrchestrator:', error);
      return { text: "Sorry, an error occurred. Type 'help' for assistance." };
    }
  }

  /**
   * Idle state - user greeting or start
   */
  async handleIdleState(userId, message, context) {
    const lowerMsg = message.toLowerCase().trim();

    // Handle greetings and start triggers
    if (lowerMsg.match(/^(hi|hello|hey|start|teach me|learn|help)/)) {
      // Show course selection
      await this.updateConversationState(userId, {
        conversation_state: 'course_selection'
      });

      return this.showCourseSelection();
    }

    return {
      text: "👋 Welcome! Type 'teach me' to start learning, or 'help' for options."
    };
  }

  /**
   * Show course selection with WhatsApp list
   */
  showCourseSelection() {
    // Format for numbered text list (Twilio-friendly)
    let message = `📚 *Welcome to Teachers Training!*\n\n`;
    message += `🎓 *Select a Course*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `*Available Courses:*\n\n`;

    this.courses.forEach((course, idx) => {
      message += `${idx + 1}. 📖 *${course.name}*\n`;
      message += `   Learn ${course.name}\n\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💬 Reply with the number to select\n`;
    message += `Example: Type *1* for ${this.courses[0]?.name || 'first course'}`;

    return {
      type: 'text',
      text: message
    };
  }

  /**
   * Handle course selection
   */
  async handleCourseSelection(userId, message, context) {
    // Parse course selection (could be list response or text)
    const courseIndex = this.parseCourseFromMessage(message);

    if (courseIndex === null || courseIndex < 1 || courseIndex > this.courses.length) {
      return {
        text: "Please select a course by number:\n" +
              this.courses.map((c, i) => `${i + 1}. ${c.name}`).join('\n')
      };
    }

    // Get course by index (1-based)
    const course = this.courses[courseIndex - 1];
    if (!course) {
      return { text: "Invalid course selection. Please try again." };
    }

    // Update context
    await this.updateConversationState(userId, {
        current_course_id: course.id,
      conversation_state: 'module_selection',
      context_data: JSON.stringify({ course_name: course.name })
    });

    return this.showModuleSelection(course);
  }

  /**
   * Show module selection
   */
  showModuleSelection(course) {
    let message = `📘 *${course.name}*\n\n`;
    message += `📚 *Select a Module*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `*${course.name} Modules:*\n\n`;

    course.modules.forEach((module, idx) => {
      message += `${idx + 1}. 📑 *${module.name}*\n`;
      // Truncate long names for readability
      const shortName = module.name.length > 50
        ? module.name.substring(0, 47) + '...'
        : module.name;
      message += `   ${shortName}\n\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💬 Reply with the number to select\n`;
    message += `Example: Type *1* for ${course.modules[0]?.name || 'first module'}`;

    return {
      type: 'text',
      text: message
    };
  }

  /**
   * Handle module selection
   */
  async handleModuleSelection(userId, message, context) {
    const moduleSelection = this.parseModuleFromMessage(message);

    if (!moduleSelection) {
      const course = this.courses.find(c => c.id === context.current_course_id);
      return {
        text: "Please select a module by number:\n" +
              course.modules.map((m, i) => `${i + 1}. ${m.name}`).join('\n')
      };
    }

    // Find module by index (1-based) or by ID
    const course = this.courses.find(c => c.id === context.current_course_id);
    let module;

    // If it's a number 1-9, treat it as index (1-based)
    if (typeof moduleSelection === 'number' && moduleSelection >= 1 && moduleSelection <= course.modules.length) {
      module = course.modules[moduleSelection - 1]; // Convert to 0-based index
    } else {
      // Otherwise, try to find by module ID
      module = course.modules.find(m => m.id === moduleSelection);
    }

    if (!module) {
      return { text: `Invalid module selection. Please choose a number between 1 and ${course.modules.length}.` };
    }

    // Update context
    await this.updateConversationState(userId, {
      current_module_id: module.id,
      conversation_state: 'learning',
      context_data: JSON.stringify({
        course_name: course.name,
        module_name: module.name
      })
    });

    // Create/update user progress
    await this.initializeModuleProgress(userId, module.id);

    let responseText = `🎓 *${module.name}*\n`;
    responseText += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    responseText += `✅ Great! You've started learning!\n\n`;
    responseText += `📚 *What You'll Learn:*\n`;
    responseText += `   Learn key concepts and practical skills\n`;
    responseText += `   in ${module.name}\n\n`;
    responseText += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    responseText += `💬 *Ask Me Anything!*\n`;
    responseText += `   Examples:\n`;
    responseText += `   • "What is entrepreneurship?"\n`;
    responseText += `   • "How to identify opportunities?"\n`;
    responseText += `   • "Tell me about market research"\n\n`;
    responseText += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    responseText += `📊 *Ready to Test Your Knowledge?*\n`;
    responseText += `   Type: *"quiz"* or *"start quiz"*\n\n`;
    responseText += `🔄 *Need Help?*\n`;
    responseText += `   Type: *"menu"* to see options`;

    return {
      text: responseText
    };
  }

  /**
   * Learning state - RAG-powered Q&A
   */
  async handleLearningState(userId, message, context) {
    const lowerMsg = message.toLowerCase().trim();

    // Check for greeting/restart (should be caught earlier, but double-check)
    if (lowerMsg.match(/^(hi|hello|hey|start|teach me|begin|restart)$/)) {
      logger.info(`Greeting detected in learning state from user ${userId}, resetting to course selection`);
      await this.updateConversationState(userId, {
        conversation_state: 'course_selection',
        current_course_id: null,
        current_module_id: null
      });
      return this.showCourseSelection();
    }

    // Check for quiz trigger
    if (lowerMsg.includes('quiz')) {
      return await this.startQuiz(userId, context);
    }

    // Check for menu/back
    if (lowerMsg === 'menu' || lowerMsg === 'back') {
      await this.updateConversationState(userId, {
        conversation_state: 'course_selection',
        current_module_id: null
      });
      return this.showCourseSelection();
    }

    // Process question with RAG
    return await this.processContentQuery(userId, message, context);
  }

  /**
   * Helper: Parse context data (handles both string and JSONB)
   */
  parseContextData(context) {
    if (!context || !context.context_data) return {};
    return typeof context.context_data === 'string'
      ? JSON.parse(context.context_data)
      : context.context_data;
  }

  /**
   * Process content query with RAG
   */
  async processContentQuery(userId, query, context) {
    try {
      const contextData = this.parseContextData(context);
      const moduleName = contextData.module_name || 'Entrepreneurship & Business Ideas';

      logger.info(`RAG query: "${query}" for module: ${moduleName}`);

      // Search ChromaDB
      const searchResults = await chromaService.searchSimilar(query, {
        filter: { module: moduleName },
        nResults: 3
      });

      if (searchResults.length === 0) {
        return {
          text: "I don't have specific information about that yet. " +
                "Try asking about entrepreneurship, community needs, or business ideas!\n\n" +
                "Type *'quiz please'* when you're ready to test your knowledge."
        };
      }

      // Build RAG context
      const ragContext = searchResults.map(r => r.content).join('\n\n---\n\n');

      // Generate response with Vertex AI
      const response = await vertexAIService.generateEducationalResponse(
        query,
        ragContext,
        'english'
      );

      // Track interaction
      await this.trackLearningInteraction(userId, context.current_module_id, query, response);

      return {
        text: response + `\n\n💡 _Ask another question or type *"quiz please"* to take the quiz!_`
      };
    } catch (error) {
      logger.error('Error processing content query:', error);
      return {
        text: "Sorry, I couldn't process your question. Please try again or type 'menu' to go back."
      };
    }
  }

  /**
   * Start quiz
   */
  async startQuiz(userId, context) {
    const contextData = this.parseContextData(context);
    const moduleId = context.current_module_id;

    // Get quiz from database
    const quizResult = await postgresService.query(`
      SELECT mq.id as quiz_id, mq.moodle_quiz_id, mq.quiz_name
      FROM moodle_quizzes mq
      WHERE mq.moodle_module_id = $1
      LIMIT 1
    `, [moduleId]);

    if (quizResult.rows.length === 0) {
      return {
        text: "Quiz not available for this module yet. Continue learning and check back later!"
      };
    }

    const quiz = quizResult.rows[0];

    // Get quiz questions from database
    const questionsResult = await postgresService.query(`
      SELECT id, question_text, question_type, options, moodle_question_id, sequence_order
      FROM quiz_questions
      WHERE moodle_quiz_id = $1
      ORDER BY sequence_order
    `, [quiz.quiz_id]);

    let questions = questionsResult.rows.map(q => ({
      id: q.id,
      questionText: q.question_text,
      questionType: q.question_type,
      options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
      moodleQuestionId: q.moodle_question_id,
      sequenceOrder: q.sequence_order
    }));

    if (questions.length === 0) {
      return {
        text: "No questions found for this quiz yet. Please contact admin."
      };
    }

    // Shuffle and select 5 questions (or all if less than 5)
    const numQuestions = Math.min(5, questions.length);
    const selectedQuestions = this.shuffleArray([...questions]).slice(0, numQuestions);

    // Update context
    await this.updateConversationState(userId, {
      conversation_state: 'quiz_active',
      current_question_index: 0,
      current_quiz_id: quiz.quiz_id,
      quiz_answers: JSON.stringify([]),
      quiz_started_at: new Date(),
      context_data: JSON.stringify({
        ...contextData,
        quiz_id: quiz.quiz_id,
        moodle_quiz_id: quiz.moodle_quiz_id,
        quiz_questions: selectedQuestions.map(q => q.id)
      })
    });

    // Send first question
    const firstQ = selectedQuestions[0];

    return {
      type: 'quiz_intro',
      text: `📝 *Quiz Started!*\n\nYou'll answer ${numQuestions} questions. Pass threshold: 70%`,
      question: firstQ,
      questionNum: 1,
      totalQuestions: numQuestions
    };
  }

  /**
   * Format question for WhatsApp (returns button config)
   */
  formatQuestionForWhatsApp(question, currentNum, total) {
    const bodyText = `*Question ${currentNum}/${total}*\n\n${question.questionText}`;

    if (question.options && Array.isArray(question.options)) {
      // WhatsApp buttons max is 3, so we'll use A/B/C for first 3 options
      // If 4 options, we'll split into two messages or use list instead
      const buttons = question.options.slice(0, 3).map((option, idx) => {
        const letter = String.fromCharCode(65 + idx); // A, B, C
        return {
          id: `answer_${letter}`,
          title: `${letter}) ${option.substring(0, 20)}` // Max 20 chars for button title
        };
      });

      // If there's a 4th option, we'll handle it differently
      if (question.options.length > 3) {
        // For 4 options, use text-based with reply
        let optionsText = '\n';
        question.options.forEach((option, idx) => {
          const letter = String.fromCharCode(65 + idx);
          optionsText += `${letter}) ${option}\n`;
        });
        return {
          type: 'text',
          text: bodyText + optionsText + '\n_Reply with A, B, C, or D_'
        };
      }

      return {
        type: 'buttons',
        bodyText,
        buttons
      };
    } else if (question.questionType === 'truefalse') {
      return {
        type: 'buttons',
        bodyText,
        buttons: [
          { id: 'answer_A', title: 'A) True' },
          { id: 'answer_B', title: 'B) False' }
        ]
      };
    }

    return {
      type: 'text',
      text: bodyText
    };
  }

  /**
   * Handle quiz answer
   */
  async handleQuizState(userId, message, context) {
    const lowerMsg = message.toLowerCase().trim();

    // Check for greeting/restart - allow user to exit quiz
    if (lowerMsg.match(/^(hi|hello|hey|start|teach me|begin|restart|menu)$/)) {
      logger.info(`Greeting/menu detected during quiz from user ${userId}, resetting to course selection`);
      await this.updateConversationState(userId, {
        conversation_state: 'course_selection',
        current_course_id: null,
        current_module_id: null,
        current_question_index: null,
        quiz_answers: null
      });
      return this.showCourseSelection();
    }

    // Extract answer from button reply or text
    let answer = message.trim().toUpperCase();

    // If it's from a button, extract the letter
    if (message.startsWith('answer_')) {
      answer = message.replace('answer_', '').toUpperCase();
    } else if (message.includes(')')) {
      // Extract letter from "A) Option text"
      answer = message.split(')')[0].trim().toUpperCase();
    }

    // Validate answer format
    if (!answer.match(/^[A-D]$/)) {
      return {
        text: "Please reply with A, B, C, or D only, or type 'menu' to exit the quiz."
      };
    }

    const contextData = this.parseContextData(context);
    const quizQuestionIds = contextData.quiz_questions || [];
    const currentIndex = context.current_question_index || 0;

    // Get all questions from database
    const questionsResult = await postgresService.query(`
      SELECT id, question_text, question_type, options, correct_answer, moodle_question_id
      FROM quiz_questions
      WHERE id = ANY($1::int[])
      ORDER BY ARRAY_POSITION($1::int[], id)
    `, [quizQuestionIds]);

    const quizQuestions = questionsResult.rows.map(q => ({
      id: q.id,
      questionText: q.question_text,
      questionType: q.question_type,
      options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
      correctAnswer: q.correct_answer,
      moodleQuestionId: q.moodle_question_id
    }));

    const currentQuestion = quizQuestions[currentIndex];

    // Check answer (letter A=0, B=1, C=2, D=3)
    const answerIndex = answer.charCodeAt(0) - 65;
    let isCorrect = null; // Default: unknown

    // Check if user's answer is correct
    if (currentQuestion.correctAnswer && currentQuestion.options && currentQuestion.options[answerIndex]) {
      const userAnswerText = currentQuestion.options[answerIndex];
      // Compare the option text with correct answer text
      isCorrect = userAnswerText.trim() === currentQuestion.correctAnswer.trim();
    }

    // Record answer
    let answers = [];
    try {
      const quizAnswersData = context.quiz_answers;
      logger.info(`[DEBUG] quiz_answers from DB (type: ${typeof quizAnswersData}):`, JSON.stringify(quizAnswersData));

      // PostgreSQL jsonb is already parsed as object/array by the driver
      if (Array.isArray(quizAnswersData)) {
        answers = quizAnswersData;
      } else if (typeof quizAnswersData === 'string') {
        answers = JSON.parse(quizAnswersData);
      } else {
        answers = [];
      }

      logger.info(`Retrieved ${answers.length} previous answers from context`);
    } catch (parseError) {
      logger.warn('Failed to parse quiz_answers, starting fresh:', parseError.message);
      answers = [];
    }

    answers.push({
      questionId: currentQuestion.id,
      userAnswer: answer,
      correct: isCorrect,
      questionText: currentQuestion.questionText,
      options: currentQuestion.options
    });

    logger.info(`Now have ${answers.length} total answers (just added Q${currentIndex + 1})`);

    // Check if quiz complete
    if (currentIndex >= quizQuestions.length - 1) {
      return await this.completeQuiz(userId, context, answers, quizQuestions);
    }

    // Next question
    const nextIndex = currentIndex + 1;
    const nextQuestion = quizQuestions[nextIndex];

    logger.info(`[DEBUG] Saving ${answers.length} answers to DB`);

    await this.updateConversationState(userId, {
      current_question_index: nextIndex,
      quiz_answers: JSON.stringify(answers)  // Still need to stringify for the SQL UPDATE
    });

    // Don't show correct/incorrect yet (will be validated in Moodle)
    const nextQFormatted = this.formatQuestionForWhatsApp(
      nextQuestion,
      nextIndex + 1,
      quizQuestions.length
    );

    // Return formatted question with button config
    return {
      type: nextQFormatted.type,
      text: `✓ Answer recorded: ${answer}\n\n`,
      question: nextQFormatted
    };
  }

  /**
   * Complete quiz and calculate results
   */
  async completeQuiz(userId, context, answers, questions) {
    // Calculate local score (may not be accurate if we don't have correct answers)
    const knownAnswers = answers.filter(a => a.correct !== null);
    const score = answers.filter(a => a.correct === true).length;
    const total = questions.length;
    const percentage = (score / total) * 100;
    const passed = percentage >= 70;

    // Get quiz and module info
    const contextData = this.parseContextData(context);
    const moduleId = context.current_module_id;
    const moodleQuizId = contextData.moodle_quiz_id;

    // Save to local database first (before Moodle sync)
    const attemptResult = await postgresService.query(`
      INSERT INTO quiz_attempts (
        user_id, module_id, moodle_quiz_id, attempt_number,
        score, total_questions, passed, answers
      )
      VALUES ($1, $2, $3,
        (SELECT COALESCE(MAX(attempt_number), 0) + 1 FROM quiz_attempts WHERE user_id = $1 AND module_id = $2),
        $4, $5, $6, $7
      )
      RETURNING id
    `, [userId, moduleId, contextData.quiz_id || null, score, total, passed, JSON.stringify(answers)]);

    const attemptId = attemptResult.rows[0].id;

    // Sync to Moodle (always, regardless of pass/fail)
    let moodleResult = null;
    if (moodleQuizId) {
      try {
        logger.info(`Syncing quiz attempt to Moodle (quiz_id: ${moodleQuizId})...`);

        // Prepare answers array with just the letters
        const answerLetters = answers.map(a => a.userAnswer);

        // Prepare questions with answer text for Moodle matching
        const questionsWithText = answers.map(a => ({
          questionText: a.questionText,
          options: a.options
        }));

        moodleResult = await moodleSyncService.syncQuizResultToMoodle(
          userId,
          moduleId,
          answerLetters,
          questionsWithText,
          score,
          total,
          moodleQuizId  // Pass the actual Moodle quiz ID
        );

        if (moodleResult.success) {
          // Update local attempt with Moodle grade
          await postgresService.query(`
            UPDATE quiz_attempts
            SET moodle_attempt_id = $1,
                metadata = jsonb_set(
                  COALESCE(metadata, '{}'::jsonb),
                  '{moodle_grade}',
                  $2::text::jsonb
                )
            WHERE id = $3
          `, [moodleResult.moodleAttemptId, moodleResult.moodleGrade || 'null', attemptId]);

          logger.info(`✅ Moodle sync successful: Attempt ${moodleResult.moodleAttemptId}, Grade: ${moodleResult.moodleGrade}`);
        }
      } catch (error) {
        logger.error('Failed to sync to Moodle:', error);
      }
    }

    // Generate certificate for passed quizzes
    let certificateUrl = null;
    const actualPassed = (moodleResult && moodleResult.success && moodleResult.moodleGrade !== null)
      ? (parseFloat(moodleResult.moodleGrade) >= 7.0)
      : passed;

    if (actualPassed) {
      try {
        const certificateService = require('./certificate.service');
        const certResult = await certificateService.generateQuizCertificate(
          userId,
          moduleId,
          attemptId
        );

        if (certResult.success) {
          // Get server URL from environment or construct from request
          const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
          certificateUrl = `${serverUrl}${certResult.url}`;
          logger.info(`Certificate generated for user ${userId}: ${certificateUrl}`);
        }
      } catch (certError) {
        logger.error('Failed to generate certificate:', certError);
        // Continue without certificate - don't fail the quiz completion
      }
    }

    // Reset conversation state
    await this.updateConversationState(userId, {
      conversation_state: 'learning',
      current_question_index: 0,
      current_quiz_id: null,
      quiz_answers: JSON.stringify([])
    });

    // Build response message
    let message = `🎯 *Quiz Complete!*\n\n`;

    if (moodleResult && moodleResult.success && moodleResult.moodleGrade !== null) {
      // Use Moodle's grade as the source of truth
      const moodleScore = parseFloat(moodleResult.moodleGrade) || 0;
      const moodlePassed = moodleScore >= 7.0; // Assuming 7/10 is passing (70%)

      message += `📊 *Moodle Grade*: ${moodleScore.toFixed(1)}/10\n`;
      message += `Status: ${moodlePassed ? '✅ *PASSED*' : '❌ *FAILED*'}\n\n`;

      if (moodlePassed) {
        message += `🎉 *Congratulations!* You've passed the quiz!\n\n`;
        message += `✅ Results recorded in Moodle (Attempt ID: ${moodleResult.moodleAttemptId})\n\n`;

        // Add certificate download link if generated
        if (certificateUrl) {
          message += `📜 *Download your certificate:*\n${certificateUrl}\n\n`;
        }

        message += `Continue learning or type 'menu' to select another module.`;
      } else {
        message += `📚 You need 70% to pass. Review the material and try again!\n\n`;
        message += `Type *'quiz please'* to retake, or ask more questions to learn.`;
      }
    } else {
      // Fallback to local scoring
      message += `Score: *${score}/${total}* (${percentage.toFixed(0)}%)\n`;
      message += `Status: ${passed ? '✅ *PASSED*' : '❌ *FAILED*'}\n\n`;

      if (passed) {
        message += `🎉 *Congratulations!* You've passed the quiz!\n\n`;

        // Add certificate download link if generated
        if (certificateUrl) {
          message += `📜 *Download your certificate:*\n${certificateUrl}\n\n`;
        }

        message += `Continue learning or type 'menu' to select another module.`;
      } else {
        message += `📚 You need 70% to pass. Review the material and try again!\n\n`;
        message += `Type *'quiz please'* to retake, or ask more questions to learn.`;
      }

      if (!moodleResult || !moodleResult.success) {
        message += `\n\n_Note: Could not sync to Moodle. Contact admin if needed._`;
      }
    }

    return { text: message };
  }

  /**
   * Parse course from message (returns 1-based index, not course ID)
   */
  parseCourseFromMessage(message) {
    const lowerMsg = message.toLowerCase().trim();

    // Check for number (1-9)
    if (lowerMsg.match(/^\d+$/)) {
      return parseInt(lowerMsg);
    }

    // Check for course name
    if (lowerMsg.includes('business')) return 1;
    if (lowerMsg.includes('teacher')) return 1;

    return null;
  }

  /**
   * Parse module from message
   */
  parseModuleFromMessage(message) {
    const lowerMsg = message.toLowerCase().trim();

    // Check for module ID from list response
    if (message.startsWith('module_')) {
      const id = parseInt(message.replace('module_', ''));
      return id;
    }

    // Check for number (accept any digit 1-9)
    if (lowerMsg.match(/^\d+$/)) {
      return parseInt(lowerMsg);
    }

    // Check for module name
    if (lowerMsg.includes('entrepreneurship')) return 1;
    if (lowerMsg.includes('classroom')) return 2;
    if (lowerMsg.includes('lesson')) return 3;
    if (lowerMsg.includes('assessment')) return 4;
    if (lowerMsg.includes('technology')) return 5;

    return null;
  }

  /**
   * Get or create conversation context
   */
  async getConversationContext(userId, whatsappPhone) {
    let result = await postgresService.query(
      'SELECT * FROM conversation_context WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      result = await postgresService.query(`
        INSERT INTO conversation_context (user_id, whatsapp_phone, conversation_state)
        VALUES ($1, $2, 'idle')
        RETURNING *
      `, [userId, whatsappPhone]);
    }

    return result.rows[0];
  }

  /**
   * Update conversation state
   */
  async updateConversationState(userId, updates) {
    const setClause = Object.keys(updates)
      .map((key, i) => `${key} = $${i + 2}`)
      .join(', ');

    logger.info(`[DEBUG] updateConversationState for user ${userId}:`, JSON.stringify(updates).substring(0, 300));

    await postgresService.query(
      `UPDATE conversation_context
       SET ${setClause}, last_message_at = NOW(), updated_at = NOW()
       WHERE user_id = $1`,
      [userId, ...Object.values(updates)]
    );

    // Verify update
    const verify = await postgresService.query(
      'SELECT quiz_answers::text FROM conversation_context WHERE user_id = $1',
      [userId]
    );
    logger.info(`[DEBUG] After update, quiz_answers in DB: ${verify.rows[0]?.quiz_answers || 'NULL'}`);
  }

  /**
   * Initialize module progress
   */
  async initializeModuleProgress(userId, moduleId) {
    await postgresService.query(`
      INSERT INTO user_progress (user_id, module_id, status, started_at, last_activity_at)
      VALUES ($1, $2, 'in_progress', NOW(), NOW())
      ON CONFLICT (user_id, module_id) DO UPDATE
      SET status = 'in_progress', last_activity_at = NOW()
    `, [userId, moduleId]);
  }

  /**
   * Track learning interaction
   */
  async trackLearningInteraction(userId, moduleId, question, response) {
    try {
      await postgresService.query(`
        INSERT INTO learning_interactions (
          user_id, moodle_module_id, interaction_type,
          user_message, bot_response
        )
        VALUES ($1, $2, 'question', $3, $4)
      `, [userId, moduleId, question, response]);
    } catch (error) {
      logger.error('Failed to track interaction:', error);
    }
  }

  /**
   * Shuffle array
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

module.exports = new MoodleOrchestratorService();
