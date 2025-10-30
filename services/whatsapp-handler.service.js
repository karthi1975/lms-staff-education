/**
 * WhatsApp Message Handler Service
 * Handles conversational flow for training modules and quizzes
 */

// Use the adapter service to support both Meta and Twilio
const whatsappService = require('./whatsapp-adapter.service');
const quizService = require('./quiz.service');
const postgresService = require('./database/postgres.service');
const moodleSyncService = require('./moodle-sync.service');
const verificationService = require('./verification.service');
const promptInjectionProtection = require('./prompt-injection-protection.service');
const logger = require('../utils/logger');

class WhatsAppHandlerService {
  constructor() {
    // User session state: phoneNumber -> { userId, currentModule, quizState, ... }
    this.userSessions = new Map();

    // CORNER CASE FIX: Start session cleanup to prevent memory leak
    this.startSessionCleanup();

    // Message deduplication (prevent duplicate processing)
    this.processedMessages = new Map(); // messageId -> timestamp
  }

  /**
   * Clean up inactive sessions to prevent memory leak
   * CORNER CASE FIX: TTL-based session cleanup
   */
  startSessionCleanup() {
    const CLEANUP_INTERVAL = 60 * 60 * 1000;  // 1 hour
    const SESSION_TTL = 24 * 60 * 60 * 1000;  // 24 hours
    const MESSAGE_TTL = 60 * 60 * 1000;       // 1 hour for message dedup

    setInterval(() => {
      const now = Date.now();
      let sessionsCleaned = 0;
      let messagesCleaned = 0;

      // Clean up old sessions
      for (const [phone, session] of this.userSessions.entries()) {
        const inactiveDuration = now - session.lastActivity.getTime();

        if (inactiveDuration > SESSION_TTL) {
          this.userSessions.delete(phone);
          sessionsCleaned++;
        }
      }

      // Clean up old processed messages
      for (const [msgId, timestamp] of this.processedMessages.entries()) {
        if (now - timestamp > MESSAGE_TTL) {
          this.processedMessages.delete(msgId);
          messagesCleaned++;
        }
      }

      if (sessionsCleaned > 0 || messagesCleaned > 0) {
        logger.info(`🧹 Cleanup: ${sessionsCleaned} sessions, ${messagesCleaned} message IDs removed`);
        logger.info(`   Active sessions: ${this.userSessions.size}, Message cache: ${this.processedMessages.size}`);
      }

      // Alert if cache sizes are too large
      if (this.userSessions.size > 10000) {
        logger.warn(`⚠️  Session cache unusually large: ${this.userSessions.size} sessions`);
      }
      if (this.processedMessages.size > 5000) {
        logger.warn(`⚠️  Message cache unusually large: ${this.processedMessages.size} messages`);
      }

    }, CLEANUP_INTERVAL);

    logger.info('✅ Session cleanup started (24h TTL, 1h interval)');
  }

  /**
   * Process incoming WhatsApp message
   */
  async handleMessage(messageData) {
    const { from, messageBody, messageId, interactive } = messageData;

    try {
      // CORNER CASE FIX: Check for duplicate messages
      if (this.processedMessages.has(messageId)) {
        logger.warn(`Duplicate message ignored: ${messageId} from ${from}`);
        return; // Silently ignore duplicate
      }

      // Mark message as processed (with timestamp for TTL cleanup)
      this.processedMessages.set(messageId, Date.now());

      // Mark as read
      await whatsappService.markAsRead(messageId);

      // Normalize phone number
      const normalizedPhone = this.normalizePhoneNumber(from);

      // SECURITY: Validate input for injection attempts BEFORE any processing
      // This protects against attacks from both enrolled and unenrolled users
      const validation = promptInjectionProtection.validateInput(messageBody, normalizedPhone);

      if (!validation.safe) {
        logger.warn(`🚨 SECURITY: Rejected unsafe input from ${normalizedPhone}: ${validation.reason}`);

        // Send generic rejection message
        await whatsappService.sendMessage(from, validation.message);
        return;
      }

      // Check enrollment status via enrollment service (NEW PIN SYSTEM)
      const enrollmentService = require('./enrollment.service');
      const enrollmentStatus = await enrollmentService.getEnrollmentStatus(normalizedPhone);

      // Case 1: User not enrolled at all
      if (!enrollmentStatus.enrolled) {
        await whatsappService.sendMessage(from,
          '❌ This number is not enrolled.\n\n' +
          'Please contact your administrator to register for the Teachers Training program.'
        );
        logger.info(`Unenrolled user attempted access: ${normalizedPhone}`);
        return;
      }

      // Case 2: User is blocked
      if (enrollmentStatus.status === 'blocked') {
        await whatsappService.sendMessage(from,
          '🔒 Your account is blocked.\n\n' +
          'Please contact your administrator for assistance.'
        );
        logger.warn(`Blocked user attempted access: ${normalizedPhone}`);
        return;
      }

      // Case 3: User is pending (needs to verify PIN)
      if (enrollmentStatus.status === 'pending' && !enrollmentStatus.isVerified) {
        // Check if message is a 4-digit PIN
        if (/^\d{4}$/.test(messageBody.trim())) {
          // Verify PIN
          const verificationResult = await enrollmentService.verifyUserPIN(normalizedPhone, messageBody.trim());

          if (verificationResult.verified) {
            // PIN verified successfully - send welcome message
            const welcomeMessage =
              `🎉 *Account Activated!*\n\n` +
              `Welcome ${verificationResult.name}! You now have access to the Teachers Training program!\n\n` +
              `📚 *Available Courses:*\n` +
              `1️⃣ Business Studies & Entrepreneurship (5 modules)\n\n` +
              `🚀 *Getting Started:*\n` +
              `• Ask me questions about the course content\n` +
              `• Type *'courses'* to see available courses\n` +
              `• Type *'progress'* to track your learning\n` +
              `• Type *'help'* for all available commands\n\n` +
              `I'm here to help you learn! 📖`;

            await whatsappService.sendMessage(from, welcomeMessage);
            logger.info(`✅ User ${verificationResult.name} (${normalizedPhone}) verified via PIN and welcomed`);
            return;
          } else {
            // PIN verification failed - send error message
            await whatsappService.sendMessage(from, verificationResult.message);
            return;
          }
        } else {
          // Not a PIN - prompt for PIN
          await whatsappService.sendMessage(from,
            `Welcome ${enrollmentStatus.name}! 👋\n\n` +
            `Please verify your identity by sending your *4-digit PIN*.\n\n` +
            `Your administrator should have provided this PIN to you.\n\n` +
            `❓ Lost your PIN? Contact your administrator.`
          );
          return;
        }
      }

      // Case 4: User is verified and active - proceed to normal chat
      // Get or create session
      const session = await this.getOrCreateSession(from);

      // CORNER CASE FIX: Handle deleted user during session creation (race condition)
      if (!session) {
        logger.warn(`Session creation returned null for ${from} - user deleted mid-request`);
        return; // Message already sent to user in getOrCreateSession
      }

      // Use Course Orchestrator for new flow
      const courseOrchestrator = require('./course-orchestrator.service');

      // Handle interactive list and button responses
      let processedMessage = messageBody;
      if (interactive && interactive.list_reply) {
        processedMessage = interactive.list_reply.id; // e.g., "course_1", "module_1"
      } else if (interactive && interactive.button_reply) {
        processedMessage = interactive.button_reply.id; // e.g., "answer_A", "answer_B"
      }

      const response = await courseOrchestrator.handleMessage(
        session.userId,
        from,
        processedMessage
      );

      // Send response
      await this.sendResponse(from, response);

    } catch (error) {
      logger.error('Error handling WhatsApp message:', error);
      await whatsappService.sendMessage(from,
        "Sorry, something went wrong. Please try again or type 'help' for assistance."
      );
    }
  }

  /**
   * Send response (handles text, list, button, buttons, quiz questions, etc.)
   */
  async sendResponse(to, response) {
    if (!response) return;

    // Handle different response types
    if (response.type === 'button') {
      // NEW: Interactive button message (from course orchestrator)
      await whatsappService.sendButtons(
        to,
        response.body,
        response.buttons,
        response.header
      );
    } else if (response.type === 'list') {
      // Interactive list message (from course orchestrator or legacy)
      await whatsappService.sendInteractiveList(
        to,
        response.header || 'Select an Option',
        response.body || response.text,
        response.buttonText || 'Select',
        response.sections
      );
    } else if (response.type === 'quiz_intro') {
      // Send intro message first
      await whatsappService.sendMessage(to, response.text);

      // Then send first question
      const questionFormatted = this.formatQuizQuestion(response.question, response.questionNum, response.totalQuestions);
      await this.sendQuizQuestion(to, questionFormatted);
    } else if (response.type === 'buttons' || response.question?.type === 'buttons') {
      // LEGACY: Old button format (for backward compatibility)
      // Send answer confirmation if provided
      if (response.text) {
        await whatsappService.sendMessage(to, response.text);
      }

      // Send button question
      const question = response.question || response;
      await whatsappService.sendButtons(to, question.bodyText, question.buttons);
    } else if (response.type === 'text' || response.question?.type === 'text') {
      // Text-based question (for 4+ options or fallback)
      if (response.text && response.question?.text) {
        // Separate messages for answer confirmation and next question
        await whatsappService.sendMessage(to, response.text);
        await whatsappService.sendMessage(to, response.question.text);
      } else {
        const fullText = response.text || response.question?.text || response.text;
        await whatsappService.sendMessage(to, fullText);
      }
    } else {
      // Default: plain text
      await whatsappService.sendMessage(to, response.text || response.content || 'No response');
    }
  }

  /**
   * Helper to format and send quiz question
   */
  async sendQuizQuestion(to, questionData) {
    if (questionData.type === 'buttons') {
      await whatsappService.sendButtons(to, questionData.bodyText, questionData.buttons);
    } else {
      await whatsappService.sendMessage(to, questionData.text);
    }
  }

  /**
   * Format quiz question
   */
  formatQuizQuestion(question, currentNum, total) {
    const courseOrchestrator = require('./course-orchestrator.service');
    return courseOrchestrator.formatQuestionForWhatsApp(question, currentNum, total);
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
   * Get user session (NO AUTO-CREATE - users must be enrolled first)
   */
  async getOrCreateSession(phoneNumber) {
    // Normalize phone number
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    // Always fetch from database to ensure we have the latest user_id
    // This prevents issues when a user is deleted and re-registered with the same phone
    const result = await postgresService.query(
      'SELECT id, name, current_module_id FROM users WHERE whatsapp_id = $1 OR whatsapp_id = $2',
      [normalizedPhone, phoneNumber]
    );

    // CORNER CASE FIX: User deleted mid-session (race condition)
    if (result.rows.length === 0) {
      logger.warn(`Session requested for deleted user: ${normalizedPhone} (possible race condition)`);

      // Send friendly message to user
      await whatsappService.sendMessage(phoneNumber,
        '⚠️ Your account is not active.\n\n' +
        'This may have happened if your account was recently modified.\n\n' +
        'Please contact your administrator for assistance.'
      );

      return null;  // Graceful exit - caller must handle null
    }

    const user = result.rows[0];

    // 🔔 UPDATE: Update last_active_at in database for nudging logic
    const UserModel = require('../models/user.model');
    await UserModel.updateLastActive(user.id);

    // Check if cached session exists and has the same user_id
    if (this.userSessions.has(normalizedPhone)) {
      const cachedSession = this.userSessions.get(normalizedPhone);
      if (cachedSession.userId === user.id) {
        // Update activity timestamp and return cached session
        cachedSession.lastActivity = new Date();
        return cachedSession;
      } else {
        // User was deleted and re-registered - invalidate old session
        logger.info(`User ${normalizedPhone} re-registered with new ID (old: ${cachedSession.userId}, new: ${user.id})`);
        this.userSessions.delete(normalizedPhone);
      }
    }

    // Create new session
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
      await this.sendQuizQuestionLegacy(from, session);

    } catch (error) {
      logger.error('Error starting quiz:', error);
      throw error;
    }
  }

  /**
   * Send quiz question (OLD - for legacy quiz service, not used with course-orchestrator)
   */
  async sendQuizQuestionLegacy(from, session) {
    if (!session.quizState) {
      logger.warn('sendQuizQuestionLegacy called but session.quizState is undefined');
      return;
    }

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
      await this.sendQuizQuestionLegacy(from, session);
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
      const orchestratorService = require('./orchestrator'); // SOLID-refactored orchestrator

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
