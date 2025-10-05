/**
 * WhatsApp Message Handler Service
 * Handles conversational flow for training modules and quizzes
 */

const whatsappService = require('./whatsapp.service');
const quizService = require('./quiz.service');
const postgresService = require('./database/postgres.service');
const moodleSyncService = require('./moodle-sync.service');
const logger = require('../utils/logger');

class WhatsAppHandlerService {
  constructor() {
    // User session state: phoneNumber -> { userId, currentModule, quizState, ... }
    this.userSessions = new Map();
  }

  /**
   * Process incoming WhatsApp message
   */
  async handleMessage(messageData) {
    const { from, messageBody, messageId } = messageData;

    try {
      // Mark as read
      await whatsappService.markAsRead(messageId);

      // Get or create session
      const session = await this.getOrCreateSession(from);

      // Process message based on session state
      if (session.quizState) {
        await this.handleQuizAnswer(from, messageBody, session);
      } else {
        await this.handleCommand(from, messageBody, session);
      }

    } catch (error) {
      logger.error('Error handling WhatsApp message:', error);
      await whatsappService.sendMessage(from,
        "Sorry, something went wrong. Please try again or type 'help' for assistance."
      );
    }
  }

  /**
   * Normalize phone number (add + prefix if missing)
   */
  normalizePhoneNumber(phoneNumber) {
    // Remove any spaces, parentheses, hyphens
    let normalized = phoneNumber.replace(/[\s\(\)\-]/g, '');

    // Add + if not present
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }

    return normalized;
  }

  /**
   * Get or create user session
   */
  async getOrCreateSession(phoneNumber) {
    // Normalize phone number
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    if (this.userSessions.has(normalizedPhone)) {
      return this.userSessions.get(normalizedPhone);
    }

    // Try both with and without + prefix
    const result = await postgresService.query(
      'SELECT id, name, current_module_id FROM users WHERE whatsapp_id = $1 OR whatsapp_id = $2',
      [normalizedPhone, phoneNumber]
    );

    if (result.rows.length === 0) {
      // Create new user with normalized phone
      const newUserResult = await postgresService.query(
        `INSERT INTO users (whatsapp_id, name, current_module_id)
         VALUES ($1, $2, 1)
         RETURNING id, name, current_module_id`,
        [normalizedPhone, `User ${normalizedPhone.slice(-4)}`]
      );

      const user = newUserResult.rows[0];

      // Initialize module 1 progress
      await postgresService.query(
        `INSERT INTO user_progress (user_id, module_id, status, progress_percentage)
         VALUES ($1, 1, 'in_progress', 0)
         ON CONFLICT (user_id, module_id) DO NOTHING`,
        [user.id]
      );

      const session = {
        userId: user.id,
        phoneNumber: normalizedPhone,
        name: user.name,
        currentModule: user.current_module_id,
        quizState: null,
        lastActivity: new Date()
      };

      this.userSessions.set(normalizedPhone, session);
      return session;
    }

    const user = result.rows[0];
    const session = {
      userId: user.id,
      phoneNumber: normalizedPhone,
      name: user.name,
      currentModule: user.current_module_id,
      quizState: null,
      lastActivity: new Date()
    };

    this.userSessions.set(normalizedPhone, session);
    return session;
  }

  /**
   * Handle user commands (non-quiz messages)
   */
  async handleCommand(from, messageBody, session) {
    const command = messageBody.toLowerCase().trim();

    // Greetings - show welcome message
    if (command.match(/^(hello|hi|hey|start|hola|habari|test)$/)) {
      await this.sendMainMenu(from, session);
      return;
    }

    // Handle old button clicks (from cached messages)
    if (command === 'continue training') {
      await this.handleModuleRequest(from, session.currentModule, session);
      return;
    }

    if (command === 'view progress') {
      await this.sendProgressUpdate(from, session.userId);
      return;
    }

    // Module selection
    if (command.includes('module 2') || command.includes('module2')) {
      await this.handleModuleRequest(from, 2, session);
      return;
    }

    if (command.includes('module 1') || command.includes('module1')) {
      await this.handleModuleRequest(from, 1, session);
      return;
    }

    // Structured learning command
    if (command.includes('teach me') || command.includes('teach') || command === 'learn') {
      await this.startStructuredLearning(from, session);
      return;
    }

    // Examples request
    if (command.includes('example') || command.includes('scenario')) {
      await this.sendPracticalExamples(from, session.currentModule);
      return;
    }

    // Start quiz command - only when user asks
    if (command.includes('quiz') || command.includes('test') || command === 'start quiz') {
      await this.startModuleQuiz(from, session.currentModule, session);
      return;
    }

    // Progress check
    if (command.includes('progress') || command.includes('status')) {
      await this.sendProgressUpdate(from, session.userId);
      return;
    }

    // Help command
    if (command.includes('help')) {
      await this.sendHelpMessage(from);
      return;
    }

    // Default: Conversational learning using RAG
    // User is asking questions about module content
    await this.handleLearningQuestion(from, messageBody, session);
  }

  /**
   * Handle module request
   */
  async handleModuleRequest(from, moduleId, session) {
    try {
      // Check if user has completed previous modules (for module 2, must complete module 1)
      if (moduleId > 1) {
        const prevModuleResult = await postgresService.query(
          `SELECT status FROM user_progress WHERE user_id = $1 AND module_id = $2`,
          [session.userId, moduleId - 1]
        );

        if (prevModuleResult.rows.length === 0 || prevModuleResult.rows[0].status !== 'completed') {
          await whatsappService.sendMessage(from,
            `⚠️ You must complete Module ${moduleId - 1} before accessing Module ${moduleId}.`
          );
          return;
        }
      }

      // Get or create progress for this module
      await postgresService.query(
        `INSERT INTO user_progress (user_id, module_id, status, progress_percentage, started_at, last_activity_at)
         VALUES ($1, $2, 'in_progress', 0, NOW(), NOW())
         ON CONFLICT (user_id, module_id) DO UPDATE
         SET last_activity_at = NOW()`,
        [session.userId, moduleId]
      );

      // Update current module
      await postgresService.query(
        'UPDATE users SET current_module_id = $1 WHERE id = $2',
        [moduleId, session.userId]
      );

      session.currentModule = moduleId;

      // Module content mapping
      const moduleContent = {
        1: {
          title: 'Introduction to Teaching',
          description: 'This module introduces fundamental teaching principles and methodologies.',
          topics: [
            'Understanding learning theories',
            'Building rapport with students',
            'Creating inclusive classrooms',
            'Effective communication techniques',
            'Professional ethics and responsibilities'
          ]
        },
        2: {
          title: 'Classroom Management',
          description: 'This module covers effective classroom management strategies.',
          topics: [
            'Setting clear expectations',
            'Prevention strategies',
            'Non-verbal interventions',
            'Positive reinforcement',
            'Handling disruptions'
          ]
        },
        3: {
          title: 'Lesson Planning',
          description: 'Learn to design effective and engaging lesson plans.',
          topics: [
            'Learning objectives and outcomes',
            'Instructional strategies',
            'Time management',
            'Assessment integration',
            'Differentiation techniques'
          ]
        },
        4: {
          title: 'Assessment Strategies',
          description: 'Master various assessment techniques and evaluation methods.',
          topics: [
            'Formative vs summative assessment',
            'Rubric design',
            'Feedback strategies',
            'Student self-assessment',
            'Data-driven instruction'
          ]
        },
        5: {
          title: 'Technology in Education',
          description: 'Integrate technology effectively into your teaching practice.',
          topics: [
            'Digital learning tools',
            'Online collaboration',
            'Educational apps and platforms',
            'Digital citizenship',
            'Blended learning approaches'
          ]
        }
      };

      const content = moduleContent[moduleId];
      let message = `*📚 Module ${moduleId}: ${content.title}*\n\n`;
      message += `${content.description}\n\n`;
      message += `*Topics we'll cover:*\n`;
      content.topics.forEach(topic => {
        message += `• ${topic}\n`;
      });
      message += `\n💬 *Let's start learning!*\n`;
      message += `Ask me questions about any topic, or type:\n`;
      message += `• *"teach me"* to begin structured lessons\n`;
      message += `• *"quiz"* when ready to test yourself\n`;
      message += `• *"examples"* for practical scenarios`;

      await whatsappService.sendMessage(from, message);

    } catch (error) {
      logger.error('Error handling module request:', error);
      throw error;
    }
  }

  /**
   * Start quiz for current module
   */
  async startModuleQuiz(from, moduleId, session) {
    try {
      const quizData = await quizService.startQuiz(session.userId, moduleId);

      if (!quizData.success) {
        await whatsappService.sendMessage(from, quizData.message);
        return;
      }

      // Initialize quiz state
      session.quizState = {
        moduleId,
        questions: quizData.questions,
        currentQuestionIndex: 0,
        answers: [],
        startTime: new Date()
      };

      this.userSessions.set(from, session);

      // Send first question
      await this.sendQuizQuestion(from, session);

    } catch (error) {
      logger.error('Error starting quiz:', error);
      throw error;
    }
  }

  /**
   * Send quiz question
   */
  async sendQuizQuestion(from, session) {
    const { questions, currentQuestionIndex } = session.quizState;
    const question = questions[currentQuestionIndex];

    const message = quizService.formatQuestionForWhatsApp(
      currentQuestionIndex + 1,
      questions.length,
      question
    );

    await whatsappService.sendMessage(from, message);
  }

  /**
   * Handle quiz answer
   */
  async handleQuizAnswer(from, answer, session) {
    const normalizedAnswer = answer.toUpperCase().trim();

    // Validate answer
    if (!['A', 'B', 'C', 'D'].includes(normalizedAnswer)) {
      await whatsappService.sendMessage(from,
        "⚠️ Please respond with A, B, C, or D"
      );
      return;
    }

    // Save answer
    session.quizState.answers.push(normalizedAnswer);
    session.quizState.currentQuestionIndex++;

    // Check if more questions remain
    if (session.quizState.currentQuestionIndex < session.quizState.questions.length) {
      // Send next question
      await this.sendQuizQuestion(from, session);
    } else {
      // Quiz complete - grade and send results
      await this.completeQuiz(from, session);
    }
  }

  /**
   * Complete quiz and show results
   */
  async completeQuiz(from, session) {
    try {
      const { moduleId, answers, questions } = session.quizState;

      // Submit quiz
      const results = await quizService.submitQuiz(session.userId, moduleId, answers, questions);

      // Clear quiz state
      session.quizState = null;
      this.userSessions.set(from, session);

      // Send results
      const resultMessage = quizService.formatResultsForWhatsApp(results);
      await whatsappService.sendMessage(from, resultMessage);

      // Sync to Moodle (async, don't wait)
      moodleSyncService.syncQuizResultToMoodle(
        session.userId,
        moduleId,
        answers,
        questions,
        results.score,
        results.totalQuestions
      ).then(syncResult => {
        if (syncResult.success) {
          logger.info(`✅ Quiz synced to Moodle: Attempt ${syncResult.moodleAttemptId} for ${syncResult.whatsappUser}`);
        } else {
          logger.warn(`⚠️ Failed to sync quiz to Moodle: ${syncResult.message}`);
        }
      }).catch(err => {
        logger.error('Error syncing to Moodle:', err);
      });

      // If passed, offer next module
      if (results.passed) {
        setTimeout(async () => {
          await whatsappService.sendMessage(from,
            "Type *'module 3'* to continue with Lesson Planning, or *'help'* to see all options."
          );
        }, 2000);
      }

    } catch (error) {
      logger.error('Error completing quiz:', error);
      throw error;
    }
  }

  /**
   * Send progress update
   */
  async sendProgressUpdate(from, userId) {
    const result = await postgresService.query(`
      SELECT
        m.id,
        m.title,
        up.status,
        up.progress_percentage,
        COUNT(qa.id) FILTER (WHERE qa.passed = true) as quizzes_passed
      FROM modules m
      LEFT JOIN user_progress up ON m.id = up.module_id AND up.user_id = $1
      LEFT JOIN quiz_attempts qa ON m.id = qa.module_id AND qa.user_id = $1
      WHERE m.sequence_order <= 5
      GROUP BY m.id, m.title, m.sequence_order, up.status, up.progress_percentage
      ORDER BY m.sequence_order
    `, [userId]);

    let message = `*📊 Your Progress*\n\n`;

    result.rows.forEach(module => {
      const status = module.status || 'not_started';
      const emoji = status === 'completed' ? '✅' : status === 'in_progress' ? '🔄' : '⚪';
      const statusText = status === 'completed' ? 'Completed' : status === 'in_progress' ? 'In Progress' : 'Not Started';

      message += `${emoji} *Module ${module.id}*: ${module.title}\n`;
      message += `   Status: ${statusText}\n`;
      if (module.progress_percentage) {
        message += `   Progress: ${module.progress_percentage}%\n`;
      }
      if (module.quizzes_passed > 0) {
        message += `   Quizzes Passed: ${module.quizzes_passed}\n`;
      }
      message += `\n`;
    });

    await whatsappService.sendMessage(from, message);
  }

  /**
   * Send help message
   */
  async sendHelpMessage(from) {
    const message = `*🤖 Teachers Training Bot Help*\n\n` +
      `*Commands:*\n` +
      `• Type *"module 2"* - Access Module 2: Classroom Management\n` +
      `• Type *"start quiz"* - Begin quiz for current module\n` +
      `• Type *"progress"* - View your training progress\n` +
      `• Type *"help"* - Show this help message\n\n` +
      `*Modules:*\n` +
      `1. Introduction to Teaching\n` +
      `2. Classroom Management\n` +
      `3. Lesson Planning\n` +
      `4. Assessment Strategies\n` +
      `5. Technology in Education\n\n` +
      `Complete modules in order to unlock the next one!`;

    await whatsappService.sendMessage(from, message);
  }

  /**
   * Send main menu
   */
  async sendMainMenu(from, session) {
    let message = `👋 *Welcome to Teachers Training!*\n\n`;
    message += `I'm your AI learning assistant. Here's what you can do:\n\n`;
    message += `*📚 Training Modules:*\n`;
    message += `1️⃣ Introduction to Teaching\n`;
    message += `2️⃣ Classroom Management\n`;
    message += `3️⃣ Lesson Planning\n`;
    message += `4️⃣ Assessment Strategies\n`;
    message += `5️⃣ Technology in Education\n\n`;
    message += `*Commands:*\n`;
    message += `• Type *"module 1"* to start learning\n`;
    message += `• Ask me any teaching questions\n`;
    message += `• Type *"progress"* to see your progress\n`;
    message += `• Type *"help"* for more options\n\n`;
    message += `Let's get started! 🚀`;

    await whatsappService.sendMessage(from, message);
  }

  /**
   * Handle conversational learning questions
   */
  async handleLearningQuestion(from, question, session) {
    try {
      // Use orchestrator service for RAG-powered responses
      const orchestratorService = require('./orchestrator.service');

      // Process question with RAG pipeline
      const response = await orchestratorService.processContentQuery(
        session.userId,
        question,
        `module_${session.currentModule}`
      );

      await whatsappService.sendMessage(from, response.content);

      // Track learning interaction in progress
      await postgresService.query(
        `UPDATE user_progress
         SET progress_percentage = LEAST(progress_percentage + 5, 90),
             last_activity_at = NOW()
         WHERE user_id = $1 AND module_id = $2`,
        [session.userId, session.currentModule]
      );

    } catch (error) {
      logger.error('Error handling learning question:', error);
      await whatsappService.sendMessage(from,
        "I'm having trouble accessing the learning materials right now. Please try:\n" +
        "• Asking a different question\n" +
        "• Typing *'teach me'* for structured lessons\n" +
        "• Typing *'help'* for options"
      );
    }
  }

  /**
   * Start structured learning (step-by-step lessons)
   */
  async startStructuredLearning(from, session) {
    const moduleId = session.currentModule;

    const lessons = {
      1: [
        {
          title: 'Understanding Learning Theories',
          content: 'Learning theories help us understand how students acquire knowledge.\n\n' +
                   '🧠 *Behaviorism*: Learning through reinforcement (rewards and consequences)\n' +
                   '🤔 *Cognitivism*: Learning as mental processing (thinking and problem-solving)\n' +
                   '🔨 *Constructivism*: Learning through experience (hands-on discovery)\n\n' +
                   'As a teacher, you\'ll use all three! For example:\n' +
                   '• Praise for good behavior (Behaviorism)\n' +
                   '• Teaching problem-solving steps (Cognitivism)\n' +
                   '• Science experiments (Constructivism)\n\n' +
                   '💬 Ask me: "How do I use behaviorism in class?"'
        },
        {
          title: 'Building Rapport with Students',
          content: '🤝 Building strong relationships is the foundation of effective teaching.\n\n' +
                   '*Key Strategies:*\n' +
                   '• Learn and use students\' names\n' +
                   '• Show genuine interest in their lives\n' +
                   '• Be consistent and reliable\n' +
                   '• Create a safe space for questions\n' +
                   '• Celebrate small wins\n\n' +
                   'Students learn best when they feel valued and understood.\n\n' +
                   '💬 Ask me: "Give me examples of building rapport"'
        }
      ],
      2: [
        {
          title: 'Setting Clear Expectations',
          content: '📋 Clear expectations prevent 90% of classroom issues.\n\n' +
                   '*How to set expectations:*\n' +
                   '1. Create simple, specific rules (3-5 max)\n' +
                   '2. Explain WHY each rule matters\n' +
                   '3. Practice the rules together\n' +
                   '4. Post them visibly in classroom\n' +
                   '5. Review regularly\n\n' +
                   '*Example Rules:*\n' +
                   '✅ "Raise your hand before speaking"\n' +
                   '✅ "Respect others\' learning time"\n' +
                   '✅ "Come prepared with materials"\n\n' +
                   '💬 Ask me: "How do I enforce rules fairly?"'
        }
      ]
    };

    const moduleTopics = lessons[moduleId] || [];

    if (moduleTopics.length === 0) {
      await whatsappService.sendMessage(from,
        `📚 Module ${moduleId} content coming soon!\n\n` +
        `For now, ask me any questions about teaching and I'll help you learn.`
      );
      return;
    }

    // Send first lesson
    const firstLesson = moduleTopics[0];
    let message = `📖 *Lesson: ${firstLesson.title}*\n\n`;
    message += firstLesson.content;

    await whatsappService.sendMessage(from, message);

    // Update progress
    await postgresService.query(
      `UPDATE user_progress
       SET progress_percentage = LEAST(progress_percentage + 15, 90),
           last_activity_at = NOW()
       WHERE user_id = $1 AND module_id = $2`,
      [session.userId, session.currentModule]
    );
  }

  /**
   * Send practical examples
   */
  async sendPracticalExamples(from, moduleId) {
    const examples = {
      1: `📝 *Practical Example: First Day of Class*\n\n` +
         `*Scenario:* You're meeting 30 new students for the first time.\n\n` +
         `*What to do:*\n` +
         `1. Greet students at the door (Rapport)\n` +
         `2. Name game activity (Learn names)\n` +
         `3. Share your teaching style (Expectations)\n` +
         `4. Ask about their learning preferences (Inclusive)\n` +
         `5. Do a fun icebreaker (Engagement)\n\n` +
         `*Result:* Students feel welcome and excited to learn!\n\n` +
         `💬 Want more examples? Ask: "Give me a classroom management example"`,

      2: `📝 *Practical Example: Handling Disruption*\n\n` +
         `*Scenario:* Two students are talking during your lesson.\n\n` +
         `*Wrong Approach:* ❌ "Stop talking NOW!"\n\n` +
         `*Better Approach:* ✅\n` +
         `1. Use proximity (walk near them)\n` +
         `2. Make eye contact (non-verbal)\n` +
         `3. Pause briefly (wait for attention)\n` +
         `4. If continues: "Sam and Alex, I need your attention"\n` +
         `5. After class: Private conversation about expectations\n\n` +
         `*Result:* Issue resolved without disrupting whole class!\n\n` +
         `💬 Ask me: "What if the disruption continues?"`
    };

    const example = examples[moduleId] ||
      `💡 Examples for Module ${moduleId} coming soon!\n\nAsk me specific questions and I'll provide practical scenarios.`;

    await whatsappService.sendMessage(from, example);
  }
}

module.exports = new WhatsAppHandlerService();
