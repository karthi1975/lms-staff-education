/**
 * WhatsApp Message Handler Service
 * Handles conversational flow for training modules and quizzes
 */

const whatsappService = require('./whatsapp.service');
const quizService = require('./quiz.service');
const postgresService = require('./database/postgres.service');
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

    // Module selection
    if (command.includes('module 2') || command.includes('module2')) {
      await this.handleModuleRequest(from, 2, session);
      return;
    }

    // Start quiz command
    if (command.includes('quiz') || command.includes('test') || command.includes('start quiz')) {
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

    // Default: show menu
    await this.sendMainMenu(from, session);
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

      // Send module info and quiz option
      let message = `*📚 Module 2: Classroom Management*\n\n`;
      message += `Welcome to Module 2! This module covers effective classroom management strategies.\n\n`;
      message += `Topics covered:\n`;
      message += `• Setting clear expectations\n`;
      message += `• Prevention strategies\n`;
      message += `• Non-verbal interventions\n`;
      message += `• Positive reinforcement\n`;
      message += `• Handling disruptions\n\n`;
      message += `When you're ready to test your knowledge, type *"start quiz"* to begin the assessment.`;

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
      const { moduleId, answers } = session.quizState;

      // Submit quiz
      const results = await quizService.submitQuiz(session.userId, moduleId, answers);

      // Clear quiz state
      session.quizState = null;
      this.userSessions.set(from, session);

      // Send results
      const resultMessage = quizService.formatResultsForWhatsApp(results);
      await whatsappService.sendMessage(from, resultMessage);

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
    await whatsappService.sendButtons(from,
      `Welcome! What would you like to do?`,
      [
        { id: 'continue', title: 'Continue Training' },
        { id: 'progress', title: 'View Progress' },
        { id: 'help', title: 'Help' }
      ]
    );
  }
}

module.exports = new WhatsAppHandlerService();
