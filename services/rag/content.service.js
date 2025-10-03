/**
 * Content Service
 * Enhanced RAG service with session and user tracking
 */

const chromaService = require('../chroma.service');
const vertexAIService = require('../vertexai.service');
const SessionService = require('../session/session.service');
const UserService = require('../auth/user.service');
const promptService = require('../prompt.service');
const logger = require('../../utils/logger');

class ContentService {
  /**
   * Get personalized content for a user
   */
  static async getPersonalizedContent(userId, query, options = {}) {
    try {
      // Get user context
      const userStats = await UserService.getUserStats(userId);
      const currentModule = userStats.progress.current_module;
      
      // Search for relevant content
      const searchOptions = {
        module: currentModule?.id || options.module,
        nResults: options.limit || 5,
        threshold: options.threshold || 0.7
      };

      const relevantContent = await chromaService.searchSimilar(query, searchOptions);
      
      if (!relevantContent || relevantContent.length === 0) {
        return {
          content: [],
          message: 'No relevant content found for your query.',
          suggestions: await this.getSuggestions(userId, currentModule?.id)
        };
      }

      // Filter based on user's progress
      const filteredContent = this.filterByProgress(relevantContent, userStats.progress);
      
      // Enhance with metadata
      const enhancedContent = filteredContent.map(item => ({
        ...item,
        relevance_score: item.similarity || item.score,
        module_name: this.getModuleName(item.metadata?.module),
        is_current_module: item.metadata?.module === currentModule?.id
      }));

      // Track content access
      await UserService.trackActivity(userId, 'content_accessed', {
        query,
        results_count: enhancedContent.length,
        module_id: currentModule?.id
      });

      return {
        content: enhancedContent,
        current_module: currentModule,
        total_found: relevantContent.length,
        filtered_count: enhancedContent.length
      };
    } catch (error) {
      logger.error('Get personalized content error:', error);
      throw error;
    }
  }

  /**
   * Generate response with RAG context
   */
  static async generateRAGResponse(userId, sessionId, query, options = {}) {
    try {
      // Get session context
      const session = await SessionService.getSession(sessionId);
      
      if (!session) {
        throw new Error('Invalid session');
      }

      // Get personalized content
      const contentResult = await this.getPersonalizedContent(userId, query, options);
      
      // Prepare context from content
      const context = contentResult.content
        .slice(0, 3) // Use top 3 most relevant
        .map(item => item.content)
        .join('\n\n');

      // Get conversation history from session
      const conversationHistory = session.context?.conversation_history || [];
      const recentHistory = conversationHistory.slice(-5); // Last 5 exchanges

      // Format prompt with context
      const formattedPrompt = promptService.formatPrompt(query, context);
      
      // Prepare messages for AI
      const messages = [
        {
          role: 'system',
          content: this.getSystemPromptForUser(contentResult.current_module)
        }
      ];

      // Add recent history
      recentHistory.forEach(exchange => {
        messages.push(
          { role: 'user', content: exchange.user_message },
          { role: 'assistant', content: exchange.assistant_response }
        );
      });

      // Add current query
      messages.push({ role: 'user', content: formattedPrompt });

      // Generate response
      const response = await vertexAIService.generateCompletion(messages, {
        maxTokens: options.maxTokens || 500,
        temperature: options.temperature || 0.7
      });

      // Save to conversation history
      await SessionService.addToConversation(sessionId, query, response);

      // Track interaction
      await UserService.trackActivity(userId, 'rag_query', {
        query_length: query.length,
        context_items: contentResult.content.length,
        response_length: response.length
      });

      return {
        response,
        context_used: contentResult.content.map(item => ({
          title: item.metadata?.title || 'Untitled',
          module: item.module_name,
          relevance: item.relevance_score
        })),
        module: contentResult.current_module,
        session_id: sessionId
      };
    } catch (error) {
      logger.error('Generate RAG response error:', error);
      throw error;
    }
  }

  /**
   * Search content across modules
   */
  static async searchContent(query, filters = {}) {
    try {
      const searchOptions = {
        module: filters.module,
        nResults: filters.limit || 10,
        threshold: filters.threshold || 0.6
      };

      const results = await chromaService.searchSimilar(query, searchOptions);
      
      // Group by module
      const groupedResults = {};
      
      results.forEach(item => {
        const moduleId = item.metadata?.module || 'general';
        
        if (!groupedResults[moduleId]) {
          groupedResults[moduleId] = {
            module_id: moduleId,
            module_name: this.getModuleName(moduleId),
            items: []
          };
        }
        
        groupedResults[moduleId].items.push({
          id: item.id,
          content: item.content.substring(0, 200) + '...',
          full_content: item.content,
          metadata: item.metadata,
          relevance: item.similarity || item.score
        });
      });

      return {
        query,
        total_results: results.length,
        modules: Object.values(groupedResults),
        filters_applied: filters
      };
    } catch (error) {
      logger.error('Search content error:', error);
      throw error;
    }
  }

  /**
   * Get content recommendations for a user
   */
  static async getRecommendations(userId, limit = 5) {
    try {
      const userStats = await UserService.getUserStats(userId);
      const currentModule = userStats.progress.current_module;
      
      if (!currentModule) {
        // New user - recommend Module 1 content
        return await this.getModuleHighlights('module1', limit);
      }

      // Get recent activity
      const lastActivity = userStats.engagement.last_activity;
      
      // Base recommendations on progress
      const recommendations = [];
      
      // If stuck on a module, recommend key concepts
      if (userStats.progress.quiz_attempts > userStats.progress.quiz_passed) {
        const keyContent = await chromaService.getDocumentsByModule(
          currentModule.id,
          Math.ceil(limit / 2)
        );
        
        recommendations.push({
          type: 'review',
          reason: 'Review these key concepts before retaking the quiz',
          items: keyContent
        });
      }

      // Recommend next module preview if current is almost complete
      if (currentModule.completion_status >= 70) {
        const nextModuleId = this.getNextModule(currentModule.id);
        
        if (nextModuleId) {
          const previewContent = await chromaService.getDocumentsByModule(
            nextModuleId,
            Math.floor(limit / 2)
          );
          
          recommendations.push({
            type: 'preview',
            reason: 'Preview of upcoming module',
            items: previewContent
          });
        }
      }

      // Fill remaining slots with current module content
      const remainingSlots = limit - recommendations.reduce((acc, r) => acc + r.items.length, 0);
      
      if (remainingSlots > 0) {
        const currentContent = await chromaService.getDocumentsByModule(
          currentModule.id,
          remainingSlots
        );
        
        recommendations.push({
          type: 'current',
          reason: 'Continue learning from your current module',
          items: currentContent
        });
      }

      return {
        user_id: userId,
        current_module: currentModule,
        recommendations
      };
    } catch (error) {
      logger.error('Get recommendations error:', error);
      throw error;
    }
  }

  /**
   * Get module highlights
   */
  static async getModuleHighlights(moduleId, limit = 5) {
    try {
      const highlights = await chromaService.getDocumentsByModule(moduleId, limit);
      
      return {
        module_id: moduleId,
        module_name: this.getModuleName(moduleId),
        highlights: highlights.map(item => ({
          id: item.id,
          title: item.metadata?.title || 'Content',
          summary: item.content.substring(0, 150) + '...',
          type: item.metadata?.type || 'lesson'
        }))
      };
    } catch (error) {
      logger.error('Get module highlights error:', error);
      throw error;
    }
  }

  /**
   * Get learning path content
   */
  static async getLearningPath(userId) {
    try {
      const userStats = await UserService.getUserStats(userId);
      const modules = this.getAllModules();
      
      const learningPath = [];
      
      for (const module of modules) {
        const moduleData = {
          id: module.id,
          name: module.name,
          description: module.description,
          status: 'locked',
          completion_percentage: 0,
          content_count: 0,
          quiz_status: null
        };

        // Check if module is completed
        if (userStats.progress.modules_completed.includes(module.id)) {
          moduleData.status = 'completed';
          moduleData.completion_percentage = 100;
          moduleData.quiz_status = 'passed';
        } else if (module.id === userStats.progress.current_module?.id) {
          moduleData.status = 'in_progress';
          moduleData.completion_percentage = userStats.progress.current_module.completion_status || 0;
          
          // Check quiz status
          if (userStats.progress.current_module.quiz_passed) {
            moduleData.quiz_status = 'passed';
          } else if (userStats.progress.current_module.quiz_attempts > 0) {
            moduleData.quiz_status = 'attempted';
          }
        } else if (this.canAccessModule(module.id, userStats.progress.modules_completed)) {
          moduleData.status = 'available';
        }

        // Get content count
        const moduleContent = await chromaService.getDocumentsByModule(module.id, 1);
        moduleData.content_count = moduleContent.length > 0 ? 'Available' : 'Coming Soon';

        learningPath.push(moduleData);
      }

      return {
        user_id: userId,
        total_modules: modules.length,
        completed_modules: userStats.progress.modules_completed.length,
        current_module: userStats.progress.current_module,
        learning_path: learningPath
      };
    } catch (error) {
      logger.error('Get learning path error:', error);
      throw error;
    }
  }

  // Helper methods

  /**
   * Filter content based on user progress
   */
  static filterByProgress(content, userProgress) {
    // Don't show content from locked modules
    const accessibleModules = ['module1', ...userProgress.modules_completed];
    
    if (userProgress.current_module) {
      accessibleModules.push(userProgress.current_module.id);
    }

    return content.filter(item => {
      const itemModule = item.metadata?.module;
      return !itemModule || accessibleModules.includes(itemModule);
    });
  }

  /**
   * Get suggestions for user
   */
  static async getSuggestions(userId, moduleId) {
    const suggestions = [];
    
    if (moduleId) {
      suggestions.push(
        `Try searching for key concepts from ${this.getModuleName(moduleId)}`,
        'Ask about specific topics you find challenging',
        'Request a summary of recent lessons'
      );
    } else {
      suggestions.push(
        'Start with "What is teaching methodology?"',
        'Ask "How do I begin my teacher training?"',
        'Try "Show me the basics of classroom management"'
      );
    }

    return suggestions;
  }

  /**
   * Get system prompt for user context
   */
  static getSystemPromptForUser(currentModule) {
    let context = 'You are a helpful teacher training assistant. ';
    
    if (currentModule) {
      context += `The user is currently studying ${currentModule.name}. `;
      context += 'Provide responses appropriate to their current learning level. ';
    } else {
      context += 'The user is new to the training program. ';
      context += 'Provide beginner-friendly explanations. ';
    }

    context += 'Use the provided context to give accurate, relevant answers. ';
    context += 'If the context doesn\'t contain relevant information, acknowledge this and provide general guidance.';

    return context;
  }

  /**
   * Get module name by ID
   */
  static getModuleName(moduleId) {
    const moduleNames = {
      'module1': 'Module 1: Introduction to Teaching',
      'module2': 'Module 2: Classroom Management',
      'module3': 'Module 3: Lesson Planning',
      'module4': 'Module 4: Assessment Strategies',
      'module5': 'Module 5: Technology in Education'
    };

    return moduleNames[moduleId] || 'General Content';
  }

  /**
   * Get all modules
   */
  static getAllModules() {
    return [
      { id: 'module1', name: 'Introduction to Teaching', description: 'Fundamentals of education and teaching philosophy' },
      { id: 'module2', name: 'Classroom Management', description: 'Creating positive learning environments' },
      { id: 'module3', name: 'Lesson Planning', description: 'Designing effective lessons and curricula' },
      { id: 'module4', name: 'Assessment Strategies', description: 'Evaluating student progress and learning' },
      { id: 'module5', name: 'Technology in Education', description: 'Integrating technology into teaching' }
    ];
  }

  /**
   * Get next module ID
   */
  static getNextModule(currentModuleId) {
    const modules = ['module1', 'module2', 'module3', 'module4', 'module5'];
    const currentIndex = modules.indexOf(currentModuleId);
    
    if (currentIndex >= 0 && currentIndex < modules.length - 1) {
      return modules[currentIndex + 1];
    }

    return null;
  }

  /**
   * Check if user can access a module
   */
  static canAccessModule(moduleId, completedModules) {
    if (moduleId === 'module1') return true;
    
    const modules = ['module1', 'module2', 'module3', 'module4', 'module5'];
    const moduleIndex = modules.indexOf(moduleId);
    
    if (moduleIndex <= 0) return false;
    
    // Check if previous module is completed
    const previousModule = modules[moduleIndex - 1];
    return completedModules.includes(previousModule);
  }
}

module.exports = ContentService;