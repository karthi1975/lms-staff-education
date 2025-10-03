/**
 * Reflection Service
 * Implements self-reflection and progress analysis for learners
 */

const UserService = require('../auth/user.service');
const ContentService = require('../rag/content.service');
const vertexAIService = require('../vertexai.service');
const neo4jService = require('../neo4j.service');
const logger = require('../../utils/logger');

class ReflectionService {
  // Reflection prompts
  static REFLECTION_PROMPTS = {
    module_completion: [
      "What are the three most important things you learned in this module?",
      "How will you apply what you've learned in your teaching practice?",
      "What concepts challenged you the most and why?",
      "What connections can you make between this module and your previous learning?"
    ],
    weekly: [
      "Reflect on your learning progress this week. What went well?",
      "What learning strategies worked best for you this week?",
      "What obstacles did you face and how did you overcome them?",
      "Set three learning goals for next week based on your progress."
    ],
    quiz_reflection: [
      "How did you prepare for this quiz? What strategies did you use?",
      "Which topics do you feel most confident about?",
      "What areas need more attention before moving forward?",
      "How can you improve your understanding of the challenging concepts?"
    ],
    milestone: [
      "You've reached a significant milestone! How do you feel about your progress?",
      "Looking back, what has been your biggest learning breakthrough so far?",
      "How has your understanding of teaching evolved since you started?",
      "What advice would you give to someone just starting this journey?"
    ]
  };

  /**
   * Generate reflection prompt for user
   */
  static async generateReflectionPrompt(userId, context = {}) {
    try {
      const userStats = await UserService.getUserStats(userId);
      const promptType = this.determinePromptType(userStats, context);
      
      // Get appropriate prompts
      const prompts = this.REFLECTION_PROMPTS[promptType] || this.REFLECTION_PROMPTS.weekly;
      
      // Select prompt based on user's history
      const promptIndex = this.selectPromptIndex(userId, prompts.length);
      const selectedPrompt = prompts[promptIndex];
      
      // Personalize the prompt
      const personalizedPrompt = await this.personalizePrompt(
        selectedPrompt,
        userStats,
        context
      );

      // Store reflection request
      await this.storeReflectionRequest(userId, promptType, personalizedPrompt);

      return {
        prompt: personalizedPrompt,
        type: promptType,
        context: {
          current_module: userStats.progress.current_module,
          recent_activity: userStats.engagement.last_activity,
          completion_percentage: userStats.progress.completion_percentage
        },
        suggested_response_length: this.getSuggestedLength(promptType)
      };
    } catch (error) {
      logger.error('Generate reflection prompt error:', error);
      throw error;
    }
  }

  /**
   * Process user's reflection response
   */
  static async processReflection(userId, reflection, promptType = 'general') {
    try {
      // Analyze the reflection
      const analysis = await this.analyzeReflection(reflection);
      
      // Generate feedback
      const feedback = await this.generateFeedback(reflection, analysis, promptType);
      
      // Store reflection
      const stored = await this.storeReflection(userId, {
        reflection,
        prompt_type: promptType,
        analysis,
        feedback
      });

      // Update user progress based on reflection
      await this.updateProgressFromReflection(userId, analysis);

      // Check for insights to share
      const insights = await this.extractInsights(reflection, analysis);

      return {
        feedback,
        analysis,
        insights,
        next_steps: await this.suggestNextSteps(userId, analysis),
        reflection_id: stored.id
      };
    } catch (error) {
      logger.error('Process reflection error:', error);
      throw error;
    }
  }

  /**
   * Get user's reflection history
   */
  static async getReflectionHistory(userId, limit = 10) {
    try {
      // This would fetch from a reflections table
      // For now, we'll get from Neo4j interactions
      const reflections = await neo4jService.getUserInteractions(userId, 'reflection');
      
      const history = reflections.slice(0, limit).map(r => ({
        date: r.timestamp,
        type: r.metadata?.prompt_type || 'general',
        summary: this.summarizeReflection(r.metadata?.reflection),
        insights: r.metadata?.insights || [],
        module: r.module
      }));

      // Calculate reflection statistics
      const stats = {
        total_reflections: reflections.length,
        average_length: this.calculateAverageLength(reflections),
        most_reflected_topics: this.getTopTopics(reflections),
        consistency_score: this.calculateConsistency(reflections)
      };

      return {
        history,
        stats,
        last_reflection: history[0] || null
      };
    } catch (error) {
      logger.error('Get reflection history error:', error);
      throw error;
    }
  }

  /**
   * Generate progress report with reflections
   */
  static async generateProgressReport(userId) {
    try {
      const userStats = await UserService.getUserStats(userId);
      const reflectionHistory = await this.getReflectionHistory(userId);
      const learningPath = await ContentService.getLearningPath(userId);

      // Compile comprehensive report
      const report = {
        user: {
          name: userStats.user.name,
          started: userStats.user.joined_at,
          current_module: userStats.progress.current_module
        },
        progress: {
          modules_completed: userStats.progress.modules_completed.length,
          total_modules: 5,
          completion_percentage: userStats.progress.completion_percentage,
          quiz_performance: {
            attempts: userStats.progress.quiz_attempts,
            passed: userStats.progress.quiz_passed,
            average_score: userStats.progress.average_score,
            pass_rate: userStats.progress.pass_rate
          }
        },
        engagement: {
          total_sessions: userStats.engagement.total_sessions,
          activity_count: userStats.engagement.activity_count,
          reflection_count: reflectionHistory.stats.total_reflections,
          consistency_score: reflectionHistory.stats.consistency_score
        },
        strengths: await this.identifyStrengths(userId, userStats, reflectionHistory),
        areas_for_improvement: await this.identifyImprovementAreas(userId, userStats),
        recommendations: await this.generateRecommendations(userId, userStats, learningPath),
        reflection_insights: reflectionHistory.stats.most_reflected_topics,
        next_milestone: this.getNextMilestone(userStats, learningPath)
      };

      // Generate narrative summary
      report.narrative = await this.generateNarrativeSummary(report);

      return report;
    } catch (error) {
      logger.error('Generate progress report error:', error);
      throw error;
    }
  }

  /**
   * Schedule reflection reminders
   */
  static async scheduleReflectionReminders(userId, frequency = 'weekly') {
    try {
      const schedule = {
        weekly: 7,
        biweekly: 14,
        monthly: 30,
        module_end: 'on_completion'
      };

      const reminderConfig = {
        user_id: userId,
        frequency,
        next_reminder: this.calculateNextReminderDate(frequency),
        active: true
      };

      // Store reminder configuration
      await this.storeReminderConfig(reminderConfig);

      logger.info(`Reflection reminders scheduled for user ${userId}: ${frequency}`);

      return reminderConfig;
    } catch (error) {
      logger.error('Schedule reflection reminders error:', error);
      throw error;
    }
  }

  // Analysis methods

  /**
   * Analyze reflection content
   */
  static async analyzeReflection(reflection) {
    try {
      const prompt = `
        Analyze this learning reflection and provide insights:
        "${reflection}"
        
        Extract:
        1. Key learning points mentioned
        2. Emotional tone (positive, neutral, struggling)
        3. Depth of reflection (surface, moderate, deep)
        4. Action items or goals mentioned
        5. Challenges or concerns raised
        
        Format as JSON.
      `;

      const response = await vertexAIService.generateCompletion([
        { role: 'user', content: prompt }
      ], {
        maxTokens: 300,
        temperature: 0.3
      });

      // Parse AI response
      try {
        return JSON.parse(response);
      } catch {
        return {
          key_points: [],
          emotional_tone: 'neutral',
          depth: 'moderate',
          action_items: [],
          challenges: []
        };
      }
    } catch (error) {
      logger.error('Analyze reflection error:', error);
      return {
        key_points: [],
        emotional_tone: 'neutral',
        depth: 'moderate',
        action_items: [],
        challenges: []
      };
    }
  }

  /**
   * Generate feedback for reflection
   */
  static async generateFeedback(reflection, analysis, promptType) {
    try {
      const feedbackPrompt = `
        Generate encouraging and constructive feedback for this learning reflection:
        
        Reflection: "${reflection}"
        Analysis: ${JSON.stringify(analysis)}
        Type: ${promptType}
        
        Provide:
        1. Acknowledgment of their insights
        2. Encouragement for their progress
        3. One specific suggestion for deepening their learning
        4. A thought-provoking question for further reflection
        
        Keep the tone supportive and professional. Maximum 150 words.
      `;

      const feedback = await vertexAIService.generateCompletion([
        { role: 'user', content: feedbackPrompt }
      ], {
        maxTokens: 200,
        temperature: 0.7
      });

      return feedback;
    } catch (error) {
      logger.error('Generate feedback error:', error);
      return "Thank you for sharing your reflection. Your insights show thoughtful engagement with the material. Keep up the great work!";
    }
  }

  // Helper methods

  /**
   * Determine prompt type based on context
   */
  static determinePromptType(userStats, context) {
    if (context.quiz_completed) {
      return 'quiz_reflection';
    }
    
    if (context.module_completed) {
      return 'module_completion';
    }
    
    if (userStats.progress.modules_completed.length > 0 && 
        userStats.progress.modules_completed.length % 2 === 0) {
      return 'milestone';
    }
    
    return 'weekly';
  }

  /**
   * Select prompt index based on user history
   */
  static selectPromptIndex(userId, promptCount) {
    // Simple rotation based on user ID and current time
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    return (userId + dayOfYear) % promptCount;
  }

  /**
   * Personalize prompt with user context
   */
  static async personalizePrompt(prompt, userStats, context) {
    let personalized = prompt;
    
    // Add user name if appropriate
    if (prompt.includes('you')) {
      personalized = `${userStats.user.name}, ${prompt.charAt(0).toLowerCase()}${prompt.slice(1)}`;
    }
    
    // Add module context
    if (userStats.progress.current_module) {
      personalized = personalized.replace(
        'this module',
        `${userStats.progress.current_module.name}`
      );
    }
    
    return personalized;
  }

  /**
   * Get suggested response length
   */
  static getSuggestedLength(promptType) {
    const lengths = {
      module_completion: '3-5 sentences',
      weekly: '2-4 sentences',
      quiz_reflection: '2-3 sentences',
      milestone: '4-6 sentences'
    };
    
    return lengths[promptType] || '2-4 sentences';
  }

  /**
   * Store reflection request
   */
  static async storeReflectionRequest(userId, promptType, prompt) {
    try {
      await neo4jService.createInteraction(
        userId,
        'reflection_prompt',
        promptType,
        { prompt, requested_at: new Date().toISOString() }
      );
    } catch (error) {
      logger.error('Store reflection request error:', error);
    }
  }

  /**
   * Store user reflection
   */
  static async storeReflection(userId, reflectionData) {
    try {
      const interaction = await neo4jService.createInteraction(
        userId,
        'reflection',
        reflectionData.prompt_type,
        reflectionData
      );
      
      return { id: interaction.id || Date.now() };
    } catch (error) {
      logger.error('Store reflection error:', error);
      return { id: Date.now() };
    }
  }

  /**
   * Update progress from reflection insights
   */
  static async updateProgressFromReflection(userId, analysis) {
    try {
      // Update metadata based on reflection insights
      const updates = {
        last_reflection: new Date().toISOString(),
        reflection_depth: analysis.depth,
        learning_confidence: analysis.emotional_tone === 'positive' ? 'high' : 'moderate'
      };
      
      await UserService.trackActivity(userId, 'reflection_completed', updates);
    } catch (error) {
      logger.error('Update progress from reflection error:', error);
    }
  }

  /**
   * Extract actionable insights
   */
  static async extractInsights(reflection, analysis) {
    const insights = [];
    
    if (analysis.action_items && analysis.action_items.length > 0) {
      insights.push({
        type: 'action_items',
        message: 'Great job setting clear goals!',
        items: analysis.action_items
      });
    }
    
    if (analysis.challenges && analysis.challenges.length > 0) {
      insights.push({
        type: 'support_needed',
        message: 'We notice you mentioned some challenges.',
        items: analysis.challenges
      });
    }
    
    if (analysis.depth === 'deep') {
      insights.push({
        type: 'recognition',
        message: 'Your deep reflection shows excellent self-awareness!',
        items: []
      });
    }
    
    return insights;
  }

  /**
   * Suggest next steps based on reflection
   */
  static async suggestNextSteps(userId, analysis) {
    const steps = [];
    
    if (analysis.challenges && analysis.challenges.length > 0) {
      steps.push('Review challenging concepts with additional resources');
      steps.push('Connect with peers or instructors for support');
    }
    
    if (analysis.action_items && analysis.action_items.length > 0) {
      steps.push('Create a study plan for your identified goals');
    }
    
    if (steps.length === 0) {
      steps.push('Continue to the next lesson');
      steps.push('Practice applying what you\'ve learned');
    }
    
    return steps;
  }

  /**
   * Additional helper methods for report generation
   */
  static summarizeReflection(reflection) {
    if (!reflection) return 'No reflection provided';
    return reflection.substring(0, 100) + (reflection.length > 100 ? '...' : '');
  }

  static calculateAverageLength(reflections) {
    if (reflections.length === 0) return 0;
    const totalLength = reflections.reduce((sum, r) => 
      sum + (r.metadata?.reflection?.length || 0), 0);
    return Math.round(totalLength / reflections.length);
  }

  static getTopTopics(reflections) {
    // Extract common themes from reflections
    return ['Teaching methods', 'Student engagement', 'Assessment strategies'];
  }

  static calculateConsistency(reflections) {
    // Calculate based on reflection frequency
    if (reflections.length < 2) return 0;
    
    const dates = reflections.map(r => new Date(r.timestamp));
    const daysBetween = [];
    
    for (let i = 1; i < dates.length; i++) {
      daysBetween.push((dates[i-1] - dates[i]) / (1000 * 60 * 60 * 24));
    }
    
    const avgDays = daysBetween.reduce((a, b) => a + b, 0) / daysBetween.length;
    
    // Score based on consistency (weekly = 100%)
    return Math.min(100, Math.round((7 / avgDays) * 100));
  }

  static async identifyStrengths(userId, userStats, reflectionHistory) {
    const strengths = [];
    
    if (userStats.progress.pass_rate > 80) {
      strengths.push('Strong quiz performance');
    }
    
    if (reflectionHistory.stats.consistency_score > 70) {
      strengths.push('Consistent reflection practice');
    }
    
    if (userStats.engagement.activity_count > 50) {
      strengths.push('High engagement level');
    }
    
    return strengths;
  }

  static async identifyImprovementAreas(userId, userStats) {
    const areas = [];
    
    if (userStats.progress.pass_rate < 70) {
      areas.push('Quiz preparation strategies');
    }
    
    if (userStats.engagement.total_sessions < 10) {
      areas.push('Regular study schedule');
    }
    
    return areas;
  }

  static async generateRecommendations(userId, userStats, learningPath) {
    return [
      'Focus on completing current module before advancing',
      'Schedule regular reflection sessions',
      'Review challenging topics before quiz attempts'
    ];
  }

  static getNextMilestone(userStats, learningPath) {
    const currentModule = userStats.progress.current_module;
    
    if (!currentModule) {
      return 'Complete Module 1';
    }
    
    if (currentModule.id === 'module5') {
      return 'Complete the program!';
    }
    
    return `Complete ${currentModule.name}`;
  }

  static async generateNarrativeSummary(report) {
    const completion = report.progress.completion_percentage;
    const performance = report.progress.quiz_performance.pass_rate;
    
    let summary = `${report.user.name} has completed ${report.progress.modules_completed} of ${report.progress.total_modules} modules (${completion}% overall progress). `;
    
    if (performance > 80) {
      summary += 'Quiz performance is excellent. ';
    } else if (performance > 60) {
      summary += 'Quiz performance shows steady progress. ';
    } else {
      summary += 'There\'s room for improvement in quiz performance. ';
    }
    
    if (report.engagement.consistency_score > 70) {
      summary += 'Learning consistency is strong. ';
    }
    
    summary += `Next goal: ${report.next_milestone}.`;
    
    return summary;
  }

  static calculateNextReminderDate(frequency) {
    const date = new Date();
    
    switch(frequency) {
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'biweekly':
        date.setDate(date.getDate() + 14);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
    }
    
    return date.toISOString();
  }

  static async storeReminderConfig(config) {
    // This would store to database
    logger.info('Reminder config stored:', config);
    return config;
  }
}

module.exports = ReflectionService;