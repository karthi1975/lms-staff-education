const whatsappService = require('./whatsapp.service');
const chromaService = require('./chroma.service');
const neo4jService = require('./neo4j.service');
const vertexAIService = require('./vertexai.service');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class OrchestratorService {
  constructor() {
    this.sessions = new Map();
    this.modules = [
      { id: 'module_1', name: 'Introduction to Teaching', order: 1 },
      { id: 'module_2', name: 'Classroom Management', order: 2 },
      { id: 'module_3', name: 'Lesson Planning', order: 3 },
      { id: 'module_4', name: 'Assessment Strategies', order: 4 },
      { id: 'module_5', name: 'Technology in Education', order: 5 }
    ];
    this.quizThreshold = 0.7;
  }

  async initialize() {
    try {
      await chromaService.initialize();
      await neo4jService.initialize();
      await this.setupModules();
      logger.info('Orchestrator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize orchestrator:', error);
      throw error;
    }
  }

  async setupModules() {
    for (const module of this.modules) {
      try {
        await neo4jService.createModule({
          id: module.id,
          name: module.name,
          order_index: module.order,
          description: `Training module ${module.order}: ${module.name}`,
          difficulty: module.order <= 2 ? 'beginner' : module.order <= 4 ? 'intermediate' : 'advanced',
          estimated_time: module.order * 30
        });
        
        if (module.order > 1) {
          const prevModule = this.modules[module.order - 2];
          await neo4jService.linkModuleSequence(prevModule.id, module.id);
        }
      } catch (error) {
        logger.debug(`Module ${module.id} setup: ${error.message}`);
      }
    }
  }

  async processWhatsAppMessage(messageData) {
    const { from, messageBody, messageId } = messageData;
    
    try {
      logger.info(`Processing WhatsApp message from ${from}: "${messageBody}"`);
      
      // Mark message as read
      logger.debug('Marking message as read...');
      await whatsappService.markAsRead(messageId);
      
      // Get or create session
      logger.debug('Getting or creating session...');
      const session = await this.getOrCreateSession(from);
      logger.info(`Session created/retrieved for user ${session.userId}`);
      
      // Get user progress
      logger.debug('Getting user learning path...');
      const userProgress = await neo4jService.getUserLearningPath(session.userId);
      logger.info(`User progress retrieved: ${userProgress ? 'Found' : 'Not found'}`);
      
      // Process the message with context
      logger.debug('Processing user input...');
      const response = await this.handleUserInput(
        session.userId,
        messageBody,
        userProgress,
        session
      );
      logger.info(`Generated response type: ${response.type}`);
      
      // Send response via WhatsApp
      logger.debug('Sending WhatsApp response...');
      await this.sendWhatsAppResponse(from, response);
      logger.info('Response sent successfully');
      
      // Update session
      this.updateSession(from, session);
      
    } catch (error) {
      logger.error('Error processing WhatsApp message:', error);
      logger.error('Error stack:', error.stack);
      logger.error('Error details:', {
        from,
        messageBody,
        messageId,
        errorMessage: error.message,
        errorName: error.name
      });
      await whatsappService.sendMessage(from, 
        "Sorry, I encountered an error. Please try again or type 'help' for assistance."
      );
    }
  }

  async getOrCreateSession(phoneNumber) {
    if (!this.sessions.has(phoneNumber)) {
      logger.info(`Creating new session for phone: ${phoneNumber}`);
      
      try {
        // Create new user in Neo4j
        const userId = uuidv4();
        logger.debug(`Creating user with ID: ${userId}`);
        
        const user = await neo4jService.createUser({
          id: userId,
          phone: phoneNumber,
          name: phoneNumber,
          email: `${phoneNumber}@whatsapp.user`,
          role: 'student'
        });
        logger.info(`User created successfully: ${userId}`);
        
        // Initialize first module
        logger.debug('Initializing first module progress...');
        await neo4jService.trackUserProgress(userId, 'module_1', {
          status: 'unlocked',
          completion_percentage: 0,
          time_spent: 0
        });
        logger.info('Module 1 initialized for user');
        
        const session = {
          userId,
          phoneNumber,
          context: [],
          currentModule: 'module_1',
          lastActivity: new Date(),
          quizState: null
        };
        
        this.sessions.set(phoneNumber, session);
        logger.info(`Session created for ${phoneNumber}`);
      } catch (error) {
        logger.error('Error creating session:', error);
        throw error;
      }
    } else {
      logger.debug(`Existing session found for ${phoneNumber}`);
    }
    
    return this.sessions.get(phoneNumber);
  }

  async handleUserInput(userId, input, userProgress, session) {
    const lowerInput = input.toLowerCase().trim();
    
    // Handle special commands
    if (lowerInput === 'menu' || lowerInput === 'help') {
      return this.getMainMenu(userProgress);
    }
    
    if (lowerInput === 'progress') {
      return this.getProgressReport(userProgress);
    }
    
    if (lowerInput.startsWith('module')) {
      const moduleMatch = lowerInput.match(/module\s*(\d)/);
      if (moduleMatch) {
        return this.handleModuleSelection(userId, `module_${moduleMatch[1]}`, userProgress);
      }
    }
    
    if (lowerInput.startsWith('quiz')) {
      const moduleMatch = lowerInput.match(/quiz\s*(\d)/);
      if (moduleMatch) {
        return this.startQuiz(userId, `module_${moduleMatch[1]}`, session);
      }
    }
    
    // Check if user is in quiz mode
    if (session.quizState) {
      return this.handleQuizAnswer(userId, input, session);
    }
    
    // Process as content query with RAG
    return this.processContentQuery(userId, input, session.currentModule);
  }

  async processContentQuery(userId, query, currentModule) {
    try {
      logger.info(`Processing content query: "${query}" for module: ${currentModule}`);
      
      // Search relevant content
      logger.debug('Searching ChromaDB for similar content...');
      const searchResults = await chromaService.searchSimilar(query, {
        module: currentModule,
        nResults: 3
      });
      logger.info(`Found ${searchResults.length} relevant documents`);
      
      // Build context from search results
      const context = searchResults.map(r => r.content).join('\n\n---\n\n');
      logger.debug(`Context length: ${context.length} characters`);
      
      // Generate response using Vertex AI with Swahili language
      logger.debug('Generating response with Vertex AI in Swahili...');
      const response = await vertexAIService.generateEducationalResponse(query, context, 'swahili');
      logger.info(`Generated response length: ${response.length} characters`);
      
      // Track interaction
      logger.debug('Tracking content interaction...');
      await neo4jService.trackContentInteraction(userId, 'content_query', 'query');
      
      return {
        type: 'text',
        content: response
      };
    } catch (error) {
      logger.error('Error processing content query:', error);
      logger.error('Query that failed:', query);
      logger.error('Module:', currentModule);
      return {
        type: 'text',
        content: "I couldn't find relevant information. Try asking differently or type 'help' for options."
      };
    }
  }

  async startQuiz(userId, moduleId, session) {
    try {
      // Check if user can access this module
      const canAccess = await neo4jService.canUserAccessModule(userId, moduleId);
      if (!canAccess) {
        return {
          type: 'text',
          content: '🔒 You need to complete previous modules first!'
        };
      }
      
      // Get module content for quiz generation
      const moduleContent = await chromaService.getDocumentsByModule(moduleId, 5);
      
      if (moduleContent.length === 0) {
        return {
          type: 'text',
          content: '📚 No content available for this module yet. Please upload training materials first.'
        };
      }
      
      // Generate quiz questions
      const quiz = await vertexAIService.generateQuizQuestions(
        moduleContent.map(d => d.content).join('\n'),
        moduleId
      );
      
      // Store quiz state in session
      session.quizState = {
        moduleId,
        questions: quiz.questions,
        currentQuestion: 0,
        answers: [],
        startTime: new Date()
      };
      
      // Send first question
      const firstQuestion = quiz.questions[0];
      return {
        type: 'quiz',
        content: `📝 **Quiz for ${this.modules.find(m => m.id === moduleId).name}**\n\nQuestion 1/${quiz.questions.length}:\n${firstQuestion.question}`,
        options: firstQuestion.options.map((opt, idx) => ({
          id: `opt_${idx}`,
          title: opt
        }))
      };
    } catch (error) {
      logger.error('Error starting quiz:', error);
      return {
        type: 'text',
        content: 'Failed to start quiz. Please try again later.'
      };
    }
  }

  async handleQuizAnswer(userId, answer, session) {
    const { quizState } = session;
    const currentQ = quizState.questions[quizState.currentQuestion];
    
    // Parse answer (could be option letter or number)
    let selectedOption = -1;
    if (answer.match(/^[a-d]$/i)) {
      selectedOption = answer.toUpperCase().charCodeAt(0) - 65;
    } else if (answer.match(/^[1-4]$/)) {
      selectedOption = parseInt(answer) - 1;
    }
    
    // Record answer
    quizState.answers.push({
      question: currentQ.question,
      selectedOption,
      correct: selectedOption === currentQ.correct,
      explanation: currentQ.explanation
    });
    
    // Check if quiz is complete
    if (quizState.currentQuestion >= quizState.questions.length - 1) {
      return this.completeQuiz(userId, session);
    }
    
    // Move to next question
    quizState.currentQuestion++;
    const nextQ = quizState.questions[quizState.currentQuestion];
    
    return {
      type: 'quiz',
      content: `${selectedOption === currentQ.correct ? '✅ Correct!' : '❌ Incorrect.'} ${currentQ.explanation}\n\nQuestion ${quizState.currentQuestion + 1}/${quizState.questions.length}:\n${nextQ.question}`,
      options: nextQ.options.map((opt, idx) => ({
        id: `opt_${idx}`,
        title: opt
      }))
    };
  }

  async completeQuiz(userId, session) {
    const { quizState } = session;
    const correctAnswers = quizState.answers.filter(a => a.correct).length;
    const totalQuestions = quizState.questions.length;
    const score = (correctAnswers / totalQuestions) * 100;
    const passed = score >= (this.quizThreshold * 100);
    
    // Record quiz attempt
    await neo4jService.recordQuizAttempt(userId, quizState.moduleId, {
      quizId: uuidv4(),
      score,
      total_questions: totalQuestions,
      correct_answers: correctAnswers,
      attempt_number: 1
    });
    
    // Update progress if passed
    if (passed) {
      await neo4jService.trackUserProgress(userId, quizState.moduleId, {
        status: 'completed',
        completion_percentage: 100,
        quiz_score: score,
        time_spent: Math.floor((new Date() - quizState.startTime) / 1000)
      });
      
      // Unlock next module
      const moduleIndex = this.modules.findIndex(m => m.id === quizState.moduleId);
      if (moduleIndex < this.modules.length - 1) {
        const nextModule = this.modules[moduleIndex + 1];
        await neo4jService.trackUserProgress(userId, nextModule.id, {
          status: 'unlocked',
          completion_percentage: 0,
          time_spent: 0
        });
      }
    }
    
    // Clear quiz state
    session.quizState = null;
    
    return {
      type: 'text',
      content: `🎯 **Quiz Complete!**\n\nScore: ${score.toFixed(1)}%\nCorrect: ${correctAnswers}/${totalQuestions}\n\n${passed ? 
        '🎉 Congratulations! You passed!' + (moduleIndex < this.modules.length - 1 ? ' Next module unlocked!' : ' Course completed!') : 
        `📚 You need ${this.quizThreshold * 100}% to pass. Keep studying and try again!`}`
    };
  }

  async getMainMenu(userProgress) {
    const modules = userProgress?.modules || [];
    const menuSections = [{
      title: '📚 Learning Modules',
      rows: this.modules.map(m => {
        const progress = modules.find(p => p.id === m.id);
        const status = progress?.progress?.status || 'locked';
        const icon = status === 'completed' ? '✅' : status === 'in_progress' ? '📖' : status === 'unlocked' ? '🔓' : '🔒';
        return {
          id: `module_${m.order}`,
          title: `${icon} ${m.name}`,
          description: `Module ${m.order} - ${status}`
        };
      })
    }];
    
    return {
      type: 'menu',
      headerText: '📚 Teachers Training',
      bodyText: 'Welcome to the Teachers Training Program! Select a module to begin or continue learning.',
      buttonText: 'Choose Module',
      sections: menuSections,
      additionalOptions: [
        { id: 'progress', title: '📊 My Progress' },
        { id: 'help', title: '❓ Help' }
      ]
    };
  }

  async getProgressReport(userProgress) {
    if (!userProgress || !userProgress.modules) {
      return {
        type: 'text',
        content: '📊 No progress recorded yet. Start with Module 1!'
      };
    }
    
    const completedModules = userProgress.modules.filter(m => m.progress?.status === 'completed').length;
    const totalModules = this.modules.length;
    const overallProgress = (completedModules / totalModules) * 100;
    
    let progressText = `📊 **Your Learning Progress**\n\n`;
    progressText += `Overall: ${overallProgress.toFixed(0)}% Complete\n`;
    progressText += `Modules: ${completedModules}/${totalModules} Completed\n\n`;
    
    for (const module of this.modules) {
      const moduleProgress = userProgress.modules.find(m => m.id === module.id);
      const status = moduleProgress?.progress?.status || 'locked';
      const score = moduleProgress?.progress?.quiz_score;
      
      progressText += `${module.order}. ${module.name}\n`;
      progressText += `   Status: ${status}`;
      if (score) progressText += ` | Quiz: ${score}%`;
      progressText += '\n';
    }
    
    return {
      type: 'text',
      content: progressText
    };
  }

  async handleModuleSelection(userId, moduleId, userProgress) {
    const canAccess = await neo4jService.canUserAccessModule(userId, moduleId);
    
    if (!canAccess) {
      return {
        type: 'text',
        content: '🔒 Complete previous modules first to unlock this one!'
      };
    }
    
    // Get module content
    const moduleContent = await chromaService.getDocumentsByModule(moduleId, 1);
    const module = this.modules.find(m => m.id === moduleId);
    
    // Update progress
    await neo4jService.trackUserProgress(userId, moduleId, {
      status: 'in_progress',
      completion_percentage: 10,
      time_spent: 0
    });
    
    return {
      type: 'text',
      content: `📖 **${module.name}**\n\n${moduleContent[0]?.content || 'Welcome to ' + module.name + '!\n\nAsk questions about the topic or type "quiz" when ready to test your knowledge.'}\n\nOptions:\n• Ask questions\n• Type "quiz" to take assessment\n• Type "menu" for main menu`
    };
  }

  async sendWhatsAppResponse(to, response) {
    switch (response.type) {
      case 'text':
        await whatsappService.sendMessage(to, response.content);
        if (response.suggestions) {
          // Simplify buttons - just send as text for now
          const suggestionsText = '\n\nOptions:\n' + response.suggestions.join('\n');
          await whatsappService.sendMessage(to, suggestionsText);
        }
        break;
        
      case 'menu':
        // Convert menu to text format to avoid API issues
        let menuText = `${response.headerText}\n\n${response.bodyText}\n\n`;
        response.sections.forEach(section => {
          menuText += `${section.title}\n`;
          section.rows.forEach(row => {
            menuText += `${row.title}\n`;
          });
        });
        menuText += '\n\nType the module number (1-5) to select';
        await whatsappService.sendMessage(to, menuText);
        break;
        
      case 'quiz':
        // Send quiz as text with options
        let quizText = response.content + '\n\nOptions:\n';
        response.options.forEach((opt, idx) => {
          quizText += `${String.fromCharCode(65 + idx)}. ${opt.title}\n`;
        });
        await whatsappService.sendMessage(to, quizText);
        break;
        
      default:
        await whatsappService.sendMessage(to, response.content);
    }
  }

  updateSession(phoneNumber, session) {
    session.lastActivity = new Date();
    session.context = session.context.slice(-5); // Keep last 5 interactions
    this.sessions.set(phoneNumber, session);
    
    // Clean up old sessions (older than 24 hours)
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (const [phone, sess] of this.sessions.entries()) {
      if (sess.lastActivity < dayAgo) {
        this.sessions.delete(phone);
      }
    }
  }
}

module.exports = new OrchestratorService();