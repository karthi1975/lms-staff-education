/**
 * Course Orchestrator Service
 * Handles: Course selection → Module selection → Chat → Quiz
 */

// Use the adapter service to support both Meta and Twilio
const whatsappService = require('./whatsapp-adapter.service');
const chromaService = require('./chroma.service');
const vertexAIService = require('./vertexai.service');
const giftParserService = require('./gift-parser.service');
const postgresService = require('./database/postgres.service');
const contentModerationService = require('./content-moderation.service');
const promptInjectionGuard = require('./prompt-injection-guard.service');
const responseValidator = require('./response-validator.service');
const m3Formatter = require('./whatsapp-m3-formatter.service');
const logger = require('../utils/logger');
const path = require('path');

class CourseOrchestratorService {
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
          SELECT id, title, description, sequence_order
          FROM modules
          WHERE course_id = $1
          ORDER BY sequence_order
        `, [course.id]).catch(err => {
          logger.warn(`Modules table not ready for course ${course.id}`);
          return { rows: [] };
        });

        // Load quizzes for each module
        const modules = [];
        for (const module of modulesResult.rows) {
          const quizResult = await postgresService.query(`
            SELECT id, title as quiz_name
            FROM quizzes
            WHERE module_id = $1 AND is_active = true
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

      // LAYER 1: Check message for harmful content BEFORE processing
      const moderationCheck = await contentModerationService.checkMessage(message, {
        user_id: userId,
        phone: whatsappPhone
      });

      if (!moderationCheck.allowed) {
        logger.warn(`WhatsApp message blocked: ${moderationCheck.reason} (severity: ${moderationCheck.severity})`);
        return { text: moderationCheck.blockedMessage };
      }

      // LAYER 2: Prompt Injection Detection (Security Enhancement)
      const injectionCheck = promptInjectionGuard.detectInjection(message);

      if (injectionCheck.detected) {
        logger.warn(`🚨 WhatsApp injection attempt from user ${userId}: ${injectionCheck.pattern}`);

        // Log to database
        await promptInjectionGuard.logInjectionAttempt(
          userId,
          whatsappPhone,
          message,
          injectionCheck
        );

        return { text: injectionCheck.message };
      }

      // LAYER 3: Sanitize input (defense in depth)
      const sanitizedMessage = promptInjectionGuard.sanitizeInput(message);

      // Get conversation context
      const context = await this.getConversationContext(userId, whatsappPhone);

      const lowerMsg = sanitizedMessage.toLowerCase().trim();

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

      // Route based on conversation state (use sanitized message)
      let response;
      switch (context.conversation_state) {
        case 'idle':
          response = await this.handleIdleState(userId, sanitizedMessage, context);
          break;

        case 'course_selection':
          response = await this.handleCourseSelection(userId, sanitizedMessage, context);
          break;

        case 'module_selection':
          response = await this.handleModuleSelection(userId, sanitizedMessage, context);
          break;

        case 'learning':
          response = await this.handleLearningState(userId, sanitizedMessage, context);
          break;

        case 'quiz_active':
          response = await this.handleQuizState(userId, sanitizedMessage, context);
          break;

        default:
          response = { text: "Something went wrong. Type 'start' to begin again." };
      }

      // COACHING INTEGRATION: Check if user needs coaching/nudging
      // Run this asynchronously to not block response
      setImmediate(async () => {
        try {
          await this.checkCoachingOpportunities(userId, context, sanitizedMessage);
        } catch (coachingError) {
          logger.warn('Error in coaching check:', coachingError);
        }
      });

      return response;

    } catch (error) {
      logger.error('Error in MoodleOrchestrator:', error);
      return { text: "Sorry, an error occurred. Type 'help' for assistance." };
    }
  }

  /**
   * Check for coaching opportunities (nudging, reflection, etc.)
   */
  async checkCoachingOpportunities(userId, context, message) {
    try {
      const coachingEngine = require('./coaching/coaching-engine.service');
      const neo4jService = require('./neo4j.service');

      // Track learning behavior
      await neo4jService.trackLearningBehavior(userId, {
        type: 'message_interaction',
        state: context.conversation_state,
        module_id: context.current_module_id,
        metadata: { timestamp: new Date().toISOString() }
      });

      // Check if user might need encouragement based on state
      const needsCoaching = await coachingEngine.checkAndSendNudges(userId);

      if (needsCoaching) {
        logger.info(`Coaching opportunity detected for user ${userId}`);
      }

    } catch (error) {
      logger.warn('Error checking coaching opportunities:', error);
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
   * Show course selection with interactive buttons/list (if supported)
   */
  showCourseSelection() {
    // If WhatsApp adapter supports interactive UI, use buttons or list
    if (whatsappService.supportsInteractive()) {
      // Use buttons for 1-3 courses, list for 4+ courses
      if (this.courses.length <= 3) {
        return {
          type: 'button',
          header: '📚 Teachers Training Platform',
          body: 'Welcome! Choose your course to get started:',
          buttons: this.courses.map((course, index) => ({
            id: `course_${course.id}`,
            title: `${index + 1}. ${course.name.substring(0, 15)}` // Max 20 chars
          }))
        };
      } else {
        // Use interactive list for 4+ courses
        return {
          type: 'list',
          header: '📚 Available Courses',
          body: 'Select a course to begin your learning journey:',
          buttonText: 'View Courses',
          sections: [{
            title: 'All Courses',
            rows: this.courses.map((course, index) => ({
              id: `course_${course.id}`,
              title: `${index + 1}. ${course.name.substring(0, 20)}`, // Max 24 chars
              description: course.description ? course.description.substring(0, 70) : '' // Max 72 chars
            }))
          }]
        };
      }
    }

    // Fallback: Use M3 text formatter for Twilio or non-interactive mode
    const formattedMessage = m3Formatter.formatCourseSelection(this.courses);
    return {
      type: 'text',
      text: formattedMessage
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
   * Show module selection with interactive list (if supported)
   */
  showModuleSelection(course) {
    // If WhatsApp adapter supports interactive UI, use list
    if (whatsappService.supportsInteractive() && course.modules && course.modules.length > 0) {
      // Use interactive list for modules (max 10)
      const modulesToShow = course.modules.slice(0, 10); // Limit to 10 for Meta API

      return {
        type: 'list',
        header: `📚 ${course.name}`,
        body: `Course Modules (${course.modules.length} available):`,
        buttonText: 'View Modules',
        sections: [{
          title: 'Available Modules',
          rows: modulesToShow.map((module, index) => ({
            id: `module_${module.id}`,
            title: `${index + 1}. ${module.name.substring(0, 20)}`, // Max 24 chars
            description: module.has_quiz ? '📝 Quiz available' : '📖 Learning module' // Max 72 chars
          }))
        }]
      };
    }

    // Fallback: Use M3 text formatter for Twilio or non-interactive mode
    const formattedMessage = m3Formatter.formatModuleSelection(course);
    return {
      type: 'text',
      text: formattedMessage
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

    // Only show quiz option if quiz is available
    if (module.has_quiz) {
      responseText += `📊 *Ready to Test Your Knowledge?*\n`;
      responseText += `   Type: *"quiz"* or *"start quiz"*\n\n`;
    }

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
   * Process content query with RAG + GraphDB
   */
  async processContentQuery(userId, query, context) {
    try {
      const contextData = this.parseContextData(context);

      // CRITICAL FIX: Check if user has a module assigned
      if (!context.current_module_id) {
        logger.warn(`User ${userId} has no module assigned (current_module_id is NULL)`);
        return {
          type: 'text',
          text: '⚠️ No courses are currently available for you.\n\n' +
                'This might mean:\n' +
                '• Courses are still being set up\n' +
                '• You haven\'t been assigned to a course yet\n\n' +
                'Please contact your administrator to be assigned to a course.\n\n' +
                'Type "help" for more information.'
        };
      }

      const moduleName = contextData.module_name || 'Entrepreneurship & Business Ideas';
      // Ensure moduleId is an integer (PostgreSQL may return numeric types)
      const moduleId = parseInt(context.current_module_id, 10);

      // Additional safety check for NaN
      if (isNaN(moduleId)) {
        logger.error(`Invalid module ID for user ${userId}: ${context.current_module_id}`);
        return {
          type: 'text',
          text: '⚠️ System error: Invalid module assignment.\n\n' +
                'Please contact your administrator.\n\n' +
                'Error code: INVALID_MODULE_ID'
        };
      }

      // CRITICAL FIX: Validate module exists in database
      const moduleExists = await this.checkModuleExists(moduleId);
      if (!moduleExists) {
        logger.warn(`User ${userId} assigned to deleted/non-existent module ${moduleId}`);

        // Try to reset to first available module
        const newModuleId = await this.resetUserToFirstModule(userId);

        if (newModuleId) {
          return {
            type: 'text',
            text: '⚠️ Your assigned module was updated.\n\n' +
                  'Starting from the first available module...\n\n' +
                  'Please send your question again or type "help" for available commands.'
          };
        } else {
          return {
            type: 'text',
            text: '⚠️ No courses are currently available.\n\n' +
                  'Please contact your administrator.'
          };
        }
      }

      logger.info(`RAG+GraphDB query: "${query}" for module ID: ${moduleId}, name: ${moduleName}`);

      // Step 1: Search ChromaDB - first try with module filter, then without
      let searchResults = await chromaService.searchSimilar(query, {
        module_id: moduleId,  // Use module_id instead of module name
        nResults: 3
      });

      // Step 1.5: If no results in current module, search across ALL content
      let crossModuleSearch = false;
      if (searchResults.length === 0) {
        logger.info(`No results in module ${moduleId}, searching across all content...`);
        searchResults = await chromaService.searchSimilar(query, {
          nResults: 3  // No module filter - search everything
        });
        crossModuleSearch = true;
      }

      if (searchResults.length === 0) {
        // Try to get related content from Neo4j GraphDB as final fallback
        const neo4jService = require('./neo4j.service');
        try {
          const relatedModules = await neo4jService.getRelatedContent(moduleId, 3);
          if (relatedModules.length > 0) {
            let fallbackText = `📚 *${moduleName}*\n\n`;
            fallbackText += `I couldn't find content about "${query}" in this module, but here are related topics you might find helpful:\n\n`;
            relatedModules.forEach(rm => {
              fallbackText += `📖 ${rm.module_name} (${rm.shared_topics} related topics)\n`;
            });
            fallbackText += `\n💡 Try asking questions about these related modules, or type *'menu'* to explore.`;
            return { text: fallbackText };
          }
        } catch (neo4jError) {
          logger.warn('Neo4j fallback failed (non-critical):', neo4jError.message);
        }

        return {
          text: `📚 *${moduleName}*\n\n` +
                `I couldn't find relevant content about "${query}" in this module.\n\n` +
                `💡 Try asking different questions related to ${moduleName}, or type *'menu'* to explore other modules.`
        };
      }

      // Step 2: Build RAG context from ChromaDB results
      const ragContext = searchResults.map(r => r.content).join('\n\n---\n\n');

      // Step 3: Enrich with Neo4j GraphDB context (topics, relationships)
      let graphContext = '';
      const neo4jService = require('./neo4j.service');
      try {
        // Get related modules from Neo4j based on shared topics
        const relatedModules = await neo4jService.getRelatedContent(moduleId, 3);
        if (relatedModules.length > 0) {
          graphContext = `\n\n[Related Topics: ${relatedModules.map(rm => rm.module_name).join(', ')}]`;
          logger.info(`Neo4j enrichment: Found ${relatedModules.length} related modules`);
        }

        // Get content graph for additional context
        const contentGraph = await neo4jService.getModuleContentGraph(moduleId);
        if (contentGraph && contentGraph.topics && contentGraph.topics.length > 0) {
          const topicNames = contentGraph.topics.slice(0, 5).map(t => t.name).join(', ');
          graphContext += `\n[Key Topics: ${topicNames}]`;
          logger.info(`Neo4j enrichment: Found ${contentGraph.topics.length} topics for module`);
        }
      } catch (neo4jError) {
        logger.warn('Neo4j enrichment failed (continuing with RAG only):', neo4jError.message);
        // Continue without graph enrichment - not critical
      }

      // Step 4: Generate response with Vertex AI (RAG + Graph context)
      const enrichedContext = ragContext + graphContext;
      const response = await vertexAIService.generateEducationalResponse(
        query,
        enrichedContext,
        'english'
      );

      // Step 5: Track interaction in PostgreSQL and Neo4j (non-blocking)
      this.trackLearningInteraction(userId, context.current_module_id, query, response).catch(err => {
        logger.warn('Failed to track PostgreSQL interaction (non-critical):', err.message);
      });

      // Track in Neo4j graph for behavioral analysis
      neo4jService.trackContentInteraction(userId, `module_${moduleId}`, 'query').catch(err => {
        logger.warn('Failed to track Neo4j interaction (non-critical):', err.message);
      });

      // Step 6: Build source citations from ChromaDB search results
      const sources = [];
      const seenSources = new Set(); // Deduplicate sources

      for (const result of searchResults) {
        if (result.metadata) {
          // Use original_file (UI uploads) or filename (script uploads)
          const sourceName = result.metadata.original_file || result.metadata.filename;
          if (!sourceName) continue;

          // Add chunk title if available for more specific citation
          const chunkTitle = result.metadata.chunk_title;

          const sourceKey = chunkTitle ? `${sourceName}:${chunkTitle}` : sourceName;

          if (!seenSources.has(sourceKey)) {
            seenSources.add(sourceKey);
            if (chunkTitle && chunkTitle.trim() !== '') {
              sources.push(`📄 ${sourceName} - ${chunkTitle}`);
            } else {
              sources.push(`📄 ${sourceName}`);
            }
          }
        }
      }

      // Step 7: Format response with M3 styling and sources
      const formattedResponse = m3Formatter.formatChatResponse({
        content: response,
        sources: sources.map(s => s.replace('📄 ', '')), // Remove emoji prefix for formatter
        moduleName: moduleName
      });

      // Add note if content came from other modules
      let finalResponse = formattedResponse;
      if (crossModuleSearch) {
        finalResponse = `📚 _(Content from all available courses)_\n\n${finalResponse}`;
      }

      // Add quiz prompt
      finalResponse += `\n\n💡 _Ask another question or type *"quiz"* to take the quiz!_`;

      return {
        text: finalResponse
      };
    } catch (error) {
      logger.error('Error processing content query:', error);
      const contextData = this.parseContextData(context);
      const moduleName = contextData.module_name || 'this module';

      return {
        text: `📚 *${moduleName}*\n\n` +
              `I encountered an error while searching for content about your question.\n\n` +
              `Please try:\n` +
              `• Rephrasing your question\n` +
              `• Asking about specific topics in ${moduleName}\n` +
              `• Type *'menu'* to explore other modules`
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
      SELECT id as quiz_id, title as quiz_name
      FROM quizzes
      WHERE module_id = $1 AND is_active = true
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
      SELECT id, question_text, question_type, options, question_number
      FROM quiz_questions
      WHERE quiz_id = $1
      ORDER BY question_number
    `, [quiz.quiz_id]);

    let questions = questionsResult.rows.map(q => ({
      id: q.id,
      questionText: q.question_text,
      questionType: q.question_type,
      options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
      questionNumber: q.question_number
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
        quiz_questions: selectedQuestions.map(q => q.id)
      })
    });

    // ✅ Update progress when quiz starts (90% - ready for final assessment)
    try {
      await postgresService.query(`
        UPDATE user_progress
        SET progress_percentage = 90,
            last_activity_at = NOW()
        WHERE user_id = $1 AND module_id = $2
      `, [userId, context.current_module_id]);

      logger.info(`📝 Quiz started for user ${userId}, module ${context.current_module_id}: Progress set to 90%`);
    } catch (progressError) {
      logger.error(`Failed to update progress on quiz start:`, progressError);
    }

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
   * Format question for WhatsApp with interactive buttons/list (if supported)
   */
  formatQuestionForWhatsApp(question, currentNum, total) {
    // Prepare question data
    const questionData = {
      question_text: question.questionText,
      option_a: question.options && question.options[0] ? question.options[0] : null,
      option_b: question.options && question.options[1] ? question.options[1] : null,
      option_c: question.options && question.options[2] ? question.options[2] : null,
      option_d: question.options && question.options[3] ? question.options[3] : null
    };

    // True/false questions
    if (question.questionType === 'truefalse') {
      questionData.option_a = 'True';
      questionData.option_b = 'False';
      questionData.option_c = null;
      questionData.option_d = null;
    }

    // If WhatsApp adapter supports interactive UI, use buttons/list
    if (whatsappService.supportsInteractive()) {
      // Count options
      const optionCount = [questionData.option_a, questionData.option_b, questionData.option_c, questionData.option_d]
        .filter(opt => opt !== null).length;

      if (optionCount <= 3) {
        // Use interactive buttons for 2-3 options (max 3 buttons allowed)
        const buttons = [];
        ['A', 'B', 'C', 'D'].forEach((letter) => {
          const optionKey = `option_${letter.toLowerCase()}`;
          if (questionData[optionKey]) {
            buttons.push({
              id: `answer_${letter}`,
              title: `${letter}) ${questionData[optionKey].substring(0, 15)}` // Max 20 chars
            });
          }
        });

        return {
          type: 'button',
          header: `📝 Question ${currentNum}/${total}`,
          body: questionData.question_text,
          buttons: buttons
        };
      } else {
        // Use interactive list for 4-option questions
        const rows = [];
        ['A', 'B', 'C', 'D'].forEach((letter) => {
          const optionKey = `option_${letter.toLowerCase()}`;
          if (questionData[optionKey]) {
            rows.push({
              id: `answer_${letter}`,
              title: `${letter}) ${questionData[optionKey].substring(0, 20)}`, // Max 24 chars
              description: questionData[optionKey].substring(0, 70) // Max 72 chars
            });
          }
        });

        return {
          type: 'list',
          header: `📝 Question ${currentNum}/${total}`,
          body: questionData.question_text,
          buttonText: 'Select Answer',
          sections: [{
            title: 'Answer Options',
            rows: rows
          }]
        };
      }
    }

    // Fallback: Use M3 text formatter for Twilio or non-interactive mode
    const formattedText = m3Formatter.formatQuizQuestion(questionData, currentNum, total);

    // Return as text (WhatsApp will display it beautifully)
    return {
      type: 'text',
      text: formattedText
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
      SELECT id, question_text, question_type, options, correct_answer, explanation
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
      explanation: q.explanation
    }));

    const currentQuestion = quizQuestions[currentIndex];

    // Check answer (letter A=0, B=1, C=2, D=3)
    const answerIndex = answer.charCodeAt(0) - 65;
    let isCorrect = null; // Default: unknown

    // Check if user's answer is correct
    // correct_answer is stored as index (0, 1, 2, 3) in database
    if (currentQuestion.correctAnswer !== null && currentQuestion.correctAnswer !== undefined) {
      const correctIndex = parseInt(currentQuestion.correctAnswer);
      isCorrect = answerIndex === correctIndex;
      logger.info(`Answer validation: User answered ${answer} (index ${answerIndex}), correct is index ${correctIndex}, result: ${isCorrect}`);
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
    const quizId = contextData.quiz_id;

    // Save to local database first (before Moodle sync)
    const attemptResult = await postgresService.query(`
      INSERT INTO quiz_attempts (
        user_id, module_id, quiz_id, attempt_number,
        score, total_questions, passed, answers
      )
      VALUES ($1, $2, $3,
        (SELECT COALESCE(MAX(attempt_number), 0) + 1 FROM quiz_attempts WHERE user_id = $1 AND module_id = $2),
        $4, $5, $6, $7
      )
      RETURNING id
    `, [userId, moduleId, quizId || null, score, total, passed, JSON.stringify(answers)]);

    const attemptId = attemptResult.rows[0].id;

    // Generate certificate for passed quizzes
    let certificateUrl = null;

    if (passed) {
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

      // ✅ Mark module as completed when quiz is passed
      try {
        await postgresService.query(`
          UPDATE user_progress
          SET status = 'completed',
              completed_at = NOW(),
              progress_percentage = 100,
              last_activity_at = NOW()
          WHERE user_id = $1 AND module_id = $2
        `, [userId, moduleId]);

        logger.info(`✅ Module ${moduleId} marked as completed for user ${userId} (WhatsApp: ${whatsappPhone})`);
      } catch (progressError) {
        logger.error(`Failed to update module completion for user ${userId}, module ${moduleId}:`, progressError);
        // Continue - don't fail quiz completion due to progress tracking error
      }
    }

    // Reset conversation state
    await this.updateConversationState(userId, {
      conversation_state: 'learning',
      current_question_index: 0,
      current_quiz_id: null,
      quiz_answers: JSON.stringify([])
    });

    // Build response message with M3 formatting
    let feedback = '';
    if (passed) {
      feedback = 'Congratulations! You\'ve mastered this module!';
      if (certificateUrl) {
        feedback += `\n\n📜 Download your certificate:\n${certificateUrl}`;
      }
    } else {
      feedback = 'You need 70% to pass. Review the material and try again! Type *"quiz"* to retake.';
    }

    const formattedMessage = m3Formatter.formatQuizResults({
      score: percentage,
      totalQuestions: total,
      correctAnswers: score,
      passed,
      feedback
    });

    return { text: formattedMessage };
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
      // Track the interaction
      await postgresService.query(`
        INSERT INTO learning_interactions (
          user_id, moodle_module_id, interaction_type,
          user_message, bot_response
        )
        VALUES ($1, $2, 'question', $3, $4)
      `, [userId, moduleId, question, response]);

      // ✅ Update progressive learning progress
      // Each question increases progress by 8% (up to max 80% before quiz)
      const progressResult = await postgresService.query(`
        SELECT COUNT(*) as interaction_count
        FROM learning_interactions
        WHERE user_id = $1 AND moodle_module_id = $2
      `, [userId, moduleId]);

      const interactionCount = parseInt(progressResult.rows[0].interaction_count) || 0;
      const progressPercentage = Math.min(interactionCount * 8, 80); // Max 80% before quiz

      await postgresService.query(`
        UPDATE user_progress
        SET progress_percentage = $3,
            last_activity_at = NOW()
        WHERE user_id = $1 AND module_id = $2
      `, [userId, moduleId, progressPercentage]);

      logger.info(`📈 Progress updated for user ${userId}, module ${moduleId}: ${progressPercentage}% (${interactionCount} interactions)`);
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

  /**
   * Check if module exists and is active
   * CORNER CASE FIX: Validate module before using
   */
  async checkModuleExists(moduleId) {
    try {
      const result = await postgresService.query(
        'SELECT id FROM modules WHERE id = $1',
        [moduleId]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking module existence:', error);
      return false;
    }
  }

  /**
   * Reset user to first available module
   * CORNER CASE FIX: Recover from deleted module assignment
   */
  async resetUserToFirstModule(userId) {
    try {
      // Get first available module
      const moduleResult = await postgresService.query(`
        SELECT m.id, m.title FROM modules m
        JOIN courses c ON m.course_id = c.id
        WHERE m.is_active = true AND c.is_active = true
        ORDER BY c.sequence_order, m.sequence_order
        LIMIT 1
      `);

      if (moduleResult.rows.length === 0) {
        logger.error('No active modules available to assign');
        return null;
      }

      const newModule = moduleResult.rows[0];
      const newModuleId = newModule.id;

      logger.info(`Resetting user ${userId} to module ${newModuleId} (${newModule.title})`);

      // Update user's current module
      await postgresService.query(
        'UPDATE users SET current_module_id = $1, updated_at = NOW() WHERE id = $2',
        [newModuleId, userId]
      );

      // Initialize progress for new module
      await postgresService.query(
        `INSERT INTO user_progress (user_id, module_id, status, progress_percentage, started_at, last_activity_at)
         VALUES ($1, $2, 'not_started', 0, NOW(), NOW())
         ON CONFLICT (user_id, module_id) DO UPDATE
         SET last_activity_at = NOW()`,
        [userId, newModuleId]
      );

      // Update conversation state
      await this.updateConversationState(userId, {
        current_module_id: newModuleId,
        conversation_state: 'learning'
      });

      logger.info(`✅ Successfully reset user ${userId} to module ${newModuleId}`);
      return newModuleId;

    } catch (error) {
      logger.error('Error resetting user module:', error);
      return null;
    }
  }
}

module.exports = new CourseOrchestratorService();
