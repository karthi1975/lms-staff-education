const sessionManager = require('./session/session-manager.service');
const coachingEngine = require('./coaching/coaching-engine.service');
const neo4jService = require('./neo4j.service');
const ragService = require('./rag.service');
const logger = require('../utils/logger');

/**
 * Event Processor Service
 * Implements the Event Loop pattern from architecture diagram
 * Processes user queries and manages execution logic
 */
class EventProcessorService {
  constructor() {
    this.eventQueue = [];
    this.processing = false;
  }

  /**
   * Process incoming user message (main event loop)
   */
  async processUserMessage(userId, whatsappId, message) {
    try {
      // 1. Get or create session (State + Memory)
      const session = await sessionManager.getOrCreateSession(userId, whatsappId);

      // 2. Record event
      await sessionManager.recordEvent(userId, 'message_received', {
        message: message,
        timestamp: new Date().toISOString()
      });

      // 3. Add to conversation history
      await sessionManager.addToConversationHistory(userId, {
        role: 'user',
        content: message
      });

      // 4. Determine intent and route to appropriate handler
      const intent = await this.detectIntent(message, session);

      let response;
      switch (intent.type) {
        case 'greeting':
          response = await this.handleGreeting(userId, session);
          break;

        case 'help':
          response = await this.handleHelp(userId, session);
          break;

        case 'module_query':
          response = await this.handleModuleQuery(userId, message, intent.moduleId);
          break;

        case 'quiz_request':
          response = await this.handleQuizRequest(userId, intent.moduleId);
          break;

        case 'progress_check':
          response = await this.handleProgressCheck(userId);
          break;

        case 'general_query':
        default:
          response = await this.handleGeneralQuery(userId, message, session);
          break;
      }

      // 5. Update session state
      await sessionManager.updateSessionState(userId, {
        currentState: intent.type,
        context: {
          ...session.context,
          lastIntent: intent.type,
          lastResponse: response
        }
      });

      // 6. Add response to conversation history
      await sessionManager.addToConversationHistory(userId, {
        role: 'assistant',
        content: response.text
      });

      // 7. Track learning behavior
      await neo4jService.trackLearningBehavior(userId, {
        type: intent.type,
        metadata: { moduleId: intent.moduleId }
      });

      // 8. Check if coaching/nudging needed
      const coaching = await coachingEngine.provideAdaptiveCoaching(userId, session);

      return {
        message: response.text,
        coaching: coaching,
        intent: intent.type
      };

    } catch (error) {
      logger.error('Error processing user message:', error);
      return {
        message: 'Sorry, I encountered an error. Please try again.',
        error: error.message
      };
    }
  }

  /**
   * Detect user intent from message
   */
  async detectIntent(message, session) {
    const lowerMessage = message.toLowerCase();

    // Greeting detection
    if (/^(hi|hello|hey|greetings|good morning|good afternoon)/i.test(message)) {
      return { type: 'greeting' };
    }

    // Help request
    if (/help|menu|options|commands|what can you do/i.test(lowerMessage)) {
      return { type: 'help' };
    }

    // Module-specific query
    const moduleMatch = lowerMessage.match(/module\s*(\d+)/);
    if (moduleMatch) {
      return {
        type: 'module_query',
        moduleId: parseInt(moduleMatch[1])
      };
    }

    // Quiz request
    if (/quiz|test|assessment|exam/i.test(lowerMessage)) {
      return {
        type: 'quiz_request',
        moduleId: session.current_module_id || 1
      };
    }

    // Progress check
    if (/progress|status|how am i doing|my performance/i.test(lowerMessage)) {
      return { type: 'progress_check' };
    }

    // Default: general query
    return {
      type: 'general_query',
      moduleId: session.current_module_id
    };
  }

  /**
   * Handle greeting
   */
  async handleGreeting(userId, session) {
    const userName = session.context.name || 'there';
    const recommendations = await coachingEngine.getRecommendations(userId);

    let text = `Hello ${userName}! 👋 Welcome to Teachers Training!\n\n`;

    if (recommendations.length > 0) {
      text += `Ready to continue your learning journey? Here's what's next:\n\n`;
      recommendations.forEach((rec, idx) => {
        text += `📚 Module ${rec.order_index}: ${rec.name}\n`;
      });
      text += `\nType "menu" to see all available options.`;
    } else {
      text += `I'm here to help you with your teacher training. Type "help" to see what I can do!`;
    }

    return { text };
  }

  /**
   * Handle help request
   */
  async handleHelp(userId, session) {
    const text = `📚 *Teachers Training Menu*\n\n` +
      `Here's what I can help you with:\n\n` +
      `*Learning*\n` +
      `• Ask questions about any module\n` +
      `• Type "quiz" to take a quiz\n` +
      `• Type "progress" to check your status\n\n` +
      `*Modules Available*\n` +
      `1️⃣ Introduction to Teaching\n` +
      `2️⃣ Classroom Management\n` +
      `3️⃣ Lesson Planning\n` +
      `4️⃣ Assessment Strategies\n` +
      `5️⃣ Technology in Education\n\n` +
      `Just ask your question or type "module 1" to start!`;

    return { text };
  }

  /**
   * Handle module-specific query using RAG
   */
  async handleModuleQuery(userId, message, moduleId) {
    try {
      // Query RAG system for module content
      const ragResponse = await ragService.queryContent(message, {
        moduleId: moduleId,
        userId: userId
      });

      let text = ragResponse.answer;

      if (ragResponse.sources && ragResponse.sources.length > 0) {
        text += `\n\n📚 Sources: ${ragResponse.sources.join(', ')}`;
      }

      // Update progress
      await neo4jService.trackUserProgress(userId, moduleId, {
        status: 'in_progress',
        time_spent: 5 // 5 minutes per interaction
      });

      return { text, sources: ragResponse.sources };

    } catch (error) {
      logger.error('Error handling module query:', error);
      return {
        text: `I can help you with Module ${moduleId}. Could you please rephrase your question?`
      };
    }
  }

  /**
   * Handle quiz request
   */
  async handleQuizRequest(userId, moduleId) {
    const text = `📝 Ready to take the quiz for Module ${moduleId}?\n\n` +
      `The quiz has 5 questions and you need 70% to pass.\n` +
      `You have 2 attempts.\n\n` +
      `Please use the web interface to take the quiz:\n` +
      `👉 [Quiz Link Here]\n\n` +
      `Good luck! 🍀`;

    await sessionManager.updateSessionState(userId, {
      currentState: 'quiz_pending',
      currentModuleId: moduleId
    });

    return { text };
  }

  /**
   * Handle progress check
   */
  async handleProgressCheck(userId) {
    try {
      const learningPath = await neo4jService.getUserLearningPath(userId);

      if (!learningPath || !learningPath.modules) {
        return {
          text: `Start your learning journey! Type "help" to see available modules.`
        };
      }

      const completed = learningPath.modules.filter(m =>
        m.progress?.properties?.status === 'completed'
      ).length;

      const inProgress = learningPath.modules.filter(m =>
        m.progress?.properties?.status === 'in_progress'
      ).length;

      const total = learningPath.modules.length;
      const percentage = Math.round((completed / total) * 100);

      let text = `📊 *Your Learning Progress*\n\n`;
      text += `✅ Completed: ${completed}/${total} modules (${percentage}%)\n`;
      text += `📚 In Progress: ${inProgress} modules\n\n`;

      if (completed > 0) {
        text += `Great work! Keep going! 🌟`;
      } else {
        text += `Let's get started on your first module! 🚀`;
      }

      return { text };

    } catch (error) {
      logger.error('Error checking progress:', error);
      return {
        text: `I'm having trouble accessing your progress. Please try again later.`
      };
    }
  }

  /**
   * Handle general query using RAG (all modules)
   */
  async handleGeneralQuery(userId, message, session) {
    try {
      const ragResponse = await ragService.queryContent(message, {
        userId: userId
      });

      let text = ragResponse.answer || `I can help you with that! Try asking about specific teaching topics or type "help" for more options.`;

      if (ragResponse.sources && ragResponse.sources.length > 0) {
        text += `\n\n📚 Related content from: ${ragResponse.sources.slice(0, 2).join(', ')}`;
      }

      return { text, sources: ragResponse.sources };

    } catch (error) {
      logger.error('Error handling general query:', error);
      return {
        text: `I'm here to help! Ask me about teaching methods, classroom management, or type "help" for options.`
      };
    }
  }

  /**
   * Send scheduled nudge to user
   */
  async sendScheduledNudge(userId) {
    try {
      const nudge = await coachingEngine.checkAndSendNudges(userId);

      if (nudge) {
        logger.info(`Nudge scheduled for user ${userId}: ${nudge.type}`);
        return {
          should_send: true,
          message: nudge.message,
          type: nudge.type
        };
      }

      return { should_send: false };

    } catch (error) {
      logger.error('Error sending scheduled nudge:', error);
      return { should_send: false };
    }
  }
}

module.exports = new EventProcessorService();
