/**
 * Course Chatbot Service
 * Manages custom chatbot prompts per course
 *
 * Features:
 * - Custom system prompts per course
 * - Instruction style selection (conversational, formal, casual)
 * - Language preference (English, Swahili, Bilingual)
 * - Prompt testing and preview
 * - Admin UI integration
 */

const postgresService = require('./database/postgres.service');
const rbacService = require('./rbac.service');

class CourseChatbotService {
  constructor() {
    this.INSTRUCTION_STYLES = {
      CONVERSATIONAL: 'conversational',
      FORMAL: 'formal',
      CASUAL: 'casual'
    };

    this.LANGUAGE_PREFERENCES = {
      ENGLISH: 'english',
      SWAHILI: 'swahili',
      BILINGUAL: 'bilingual'
    };

    // Default prompts
    this.DEFAULT_PROMPTS = {
      conversational: 'You are a friendly and supportive teacher training assistant. Help teachers learn and grow with encouragement and practical examples.',
      formal: 'You are a professional teacher training instructor. Provide clear, structured guidance following educational best practices.',
      casual: 'You are a helpful teaching buddy. Keep things simple, fun, and easy to understand for new teachers.'
    };
  }

  /**
   * Get chatbot prompt for course
   * @param {number} courseId - Course ID
   * @returns {Promise<Object|null>} Chatbot prompt configuration
   */
  async getCoursePrompt(courseId) {
    try {
      const query = `
        SELECT
          cp.*,
          c.title AS course_title,
          c.code AS course_code,
          u.name AS updated_by_name
        FROM course_chatbot_prompts cp
        JOIN courses c ON cp.course_id = c.id
        LEFT JOIN admin_users u ON cp.updated_by = u.id
        WHERE cp.course_id = $1
      `;
      const result = await postgresService.query(query, [courseId]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting course prompt:', error);
      throw error;
    }
  }

  /**
   * Create or update chatbot prompt for course
   * @param {number} courseId - Course ID
   * @param {Object} promptData - { system_prompt, instruction_style, language_preference, updated_by }
   * @returns {Promise<Object>} Creation/update result
   */
  async setCourseChatbotPrompt(courseId, promptData) {
    try {
      const { system_prompt, instruction_style, language_preference, updated_by } = promptData;

      // Validate admin can manage this course
      if (updated_by) {
        const canManage = await rbacService.canManageCourse(updated_by, courseId);
        if (!canManage.canManage) {
          return { success: false, error: canManage.reason };
        }
      }

      // Validate required fields
      if (!system_prompt) {
        return { success: false, error: 'system_prompt is required' };
      }

      // Validate instruction style
      if (instruction_style && !Object.values(this.INSTRUCTION_STYLES).includes(instruction_style)) {
        return { success: false, error: `Invalid instruction_style. Must be one of: ${Object.values(this.INSTRUCTION_STYLES).join(', ')}` };
      }

      // Validate language preference
      if (language_preference && !Object.values(this.LANGUAGE_PREFERENCES).includes(language_preference)) {
        return { success: false, error: `Invalid language_preference. Must be one of: ${Object.values(this.LANGUAGE_PREFERENCES).join(', ')}` };
      }

      // Check if prompt already exists
      const existing = await this.getCoursePrompt(courseId);

      if (existing) {
        // Update existing prompt
        const updateQuery = `
          UPDATE course_chatbot_prompts
          SET
            system_prompt = $1,
            instruction_style = $2,
            language_preference = $3,
            updated_at = NOW(),
            updated_by = $4
          WHERE course_id = $5
          RETURNING *
        `;
        const result = await postgresService.query(updateQuery, [
          system_prompt,
          instruction_style || existing.instruction_style,
          language_preference || existing.language_preference,
          updated_by || existing.updated_by,
          courseId
        ]);

        // Mark course as using custom prompt
        await this.markCourseUsingCustomPrompt(courseId, true);

        return { success: true, data: result.rows[0], action: 'updated' };
      } else {
        // Create new prompt
        const insertQuery = `
          INSERT INTO course_chatbot_prompts
          (course_id, system_prompt, instruction_style, language_preference, updated_by, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          RETURNING *
        `;
        const result = await postgresService.query(insertQuery, [
          courseId,
          system_prompt,
          instruction_style || this.INSTRUCTION_STYLES.CONVERSATIONAL,
          language_preference || this.LANGUAGE_PREFERENCES.ENGLISH,
          updated_by || null
        ]);

        // Mark course as using custom prompt
        await this.markCourseUsingCustomPrompt(courseId, true);

        return { success: true, data: result.rows[0], action: 'created' };
      }
    } catch (error) {
      console.error('Error setting course chatbot prompt:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete chatbot prompt for course
   * @param {number} courseId - Course ID
   * @param {number} adminUserId - Admin user ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteCoursePrompt(courseId, adminUserId) {
    try {
      // Validate admin can manage this course
      const canManage = await rbacService.canManageCourse(adminUserId, courseId);
      if (!canManage.canManage) {
        return { success: false, error: canManage.reason };
      }

      // Delete prompt
      const deleteQuery = 'DELETE FROM course_chatbot_prompts WHERE course_id = $1 RETURNING *';
      const result = await postgresService.query(deleteQuery, [courseId]);

      if (result.rows.length === 0) {
        return { success: false, error: 'Chatbot prompt not found for this course' };
      }

      // Mark course as NOT using custom prompt
      await this.markCourseUsingCustomPrompt(courseId, false);

      return { success: true, data: result.rows[0] };
    } catch (error) {
      console.error('Error deleting course prompt:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark course as using/not using custom prompt
   * @param {number} courseId - Course ID
   * @param {boolean} useCustom - Whether to use custom prompt
   * @returns {Promise<void>}
   */
  async markCourseUsingCustomPrompt(courseId, useCustom) {
    try {
      const query = 'UPDATE courses SET use_custom_prompt = $1 WHERE id = $2';
      await postgresService.query(query, [useCustom, courseId]);
    } catch (error) {
      console.error('Error marking course custom prompt:', error);
      // Don't throw - this is a secondary operation
    }
  }

  /**
   * Get default prompt for instruction style
   * @param {string} style - Instruction style
   * @returns {string} Default prompt
   */
  getDefaultPrompt(style) {
    return this.DEFAULT_PROMPTS[style] || this.DEFAULT_PROMPTS.conversational;
  }

  /**
   * Generate prompt with language preference
   * @param {string} basePrompt - Base system prompt
   * @param {string} languagePreference - Language preference
   * @returns {string} Enhanced prompt with language instructions
   */
  generatePromptWithLanguage(basePrompt, languagePreference) {
    const languageInstructions = {
      english: '\n\nIMPORTANT: Respond only in English.',
      swahili: '\n\nIMPORTANT: Jibu kwa Kiswahili tu. (Respond only in Swahili.)',
      bilingual: '\n\nIMPORTANT: Provide responses in both English and Swahili. Format:\n\nEnglish:\n[English response]\n\nKiswahili:\n[Swahili response]'
    };

    return basePrompt + (languageInstructions[languagePreference] || languageInstructions.english);
  }

  /**
   * Get effective prompt for course (with fallback to default)
   * @param {number} courseId - Course ID
   * @returns {Promise<Object>} Effective prompt configuration
   */
  async getEffectivePrompt(courseId) {
    try {
      const customPrompt = await this.getCoursePrompt(courseId);

      if (customPrompt) {
        return {
          isCustom: true,
          courseId,
          systemPrompt: this.generatePromptWithLanguage(
            customPrompt.system_prompt,
            customPrompt.language_preference
          ),
          instructionStyle: customPrompt.instruction_style,
          languagePreference: customPrompt.language_preference,
          updatedAt: customPrompt.updated_at,
          updatedBy: customPrompt.updated_by_name
        };
      }

      // Return default prompt
      return {
        isCustom: false,
        courseId,
        systemPrompt: this.generatePromptWithLanguage(
          this.DEFAULT_PROMPTS.conversational,
          this.LANGUAGE_PREFERENCES.ENGLISH
        ),
        instructionStyle: this.INSTRUCTION_STYLES.CONVERSATIONAL,
        languagePreference: this.LANGUAGE_PREFERENCES.ENGLISH,
        updatedAt: null,
        updatedBy: null
      };
    } catch (error) {
      console.error('Error getting effective prompt:', error);
      // Return default on error
      return {
        isCustom: false,
        courseId,
        systemPrompt: this.generatePromptWithLanguage(
          this.DEFAULT_PROMPTS.conversational,
          this.LANGUAGE_PREFERENCES.ENGLISH
        ),
        instructionStyle: this.INSTRUCTION_STYLES.CONVERSATIONAL,
        languagePreference: this.LANGUAGE_PREFERENCES.ENGLISH,
        updatedAt: null,
        updatedBy: null
      };
    }
  }

  /**
   * Test prompt with sample message (for admin preview)
   * @param {Object} promptConfig - { system_prompt, instruction_style, language_preference }
   * @param {string} sampleMessage - Sample user message
   * @returns {Promise<Object>} Test result
   */
  async testPrompt(promptConfig, sampleMessage) {
    try {
      // This is a mock implementation for testing purposes
      // In production, this would call the actual AI service (Vertex AI)

      const { system_prompt, language_preference } = promptConfig;
      const effectivePrompt = this.generatePromptWithLanguage(system_prompt, language_preference);

      return {
        success: true,
        preview: {
          systemPrompt: effectivePrompt,
          sampleUserMessage: sampleMessage,
          expectedBehavior: this.describeExpectedBehavior(language_preference),
          note: 'This is a preview. Actual AI responses will vary.'
        }
      };
    } catch (error) {
      console.error('Error testing prompt:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Describe expected behavior for language preference
   * @param {string} languagePreference - Language preference
   * @returns {string} Description
   */
  describeExpectedBehavior(languagePreference) {
    const descriptions = {
      english: 'AI will respond only in English.',
      swahili: 'AI will respond only in Swahili (Kiswahili).',
      bilingual: 'AI will provide responses in both English and Swahili, clearly separated.'
    };

    return descriptions[languagePreference] || descriptions.english;
  }

  /**
   * Get all courses with custom prompts
   * @returns {Promise<Array>} Courses with custom prompts
   */
  async getCoursesWithCustomPrompts() {
    try {
      const query = `
        SELECT
          cp.*,
          c.title AS course_title,
          c.code AS course_code,
          c.region_id,
          r.name AS region_name,
          u.name AS updated_by_name
        FROM course_chatbot_prompts cp
        JOIN courses c ON cp.course_id = c.id
        LEFT JOIN regions r ON c.region_id = r.id
        LEFT JOIN admin_users u ON cp.updated_by = u.id
        ORDER BY cp.updated_at DESC
      `;
      const result = await postgresService.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error getting courses with custom prompts:', error);
      throw error;
    }
  }

  /**
   * Clone prompt from one course to another
   * @param {number} sourceCourseId - Source course ID
   * @param {number} targetCourseId - Target course ID
   * @param {number} adminUserId - Admin user ID
   * @returns {Promise<Object>} Clone result
   */
  async clonePrompt(sourceCourseId, targetCourseId, adminUserId) {
    try {
      // Validate admin can manage both courses
      const canManageSource = await rbacService.canManageCourse(adminUserId, sourceCourseId);
      const canManageTarget = await rbacService.canManageCourse(adminUserId, targetCourseId);

      if (!canManageSource.canManage) {
        return { success: false, error: `Cannot access source course: ${canManageSource.reason}` };
      }

      if (!canManageTarget.canManage) {
        return { success: false, error: `Cannot access target course: ${canManageTarget.reason}` };
      }

      // Get source prompt
      const sourcePrompt = await this.getCoursePrompt(sourceCourseId);
      if (!sourcePrompt) {
        return { success: false, error: 'Source course does not have a custom prompt' };
      }

      // Clone to target course
      const result = await this.setCourseChatbotPrompt(targetCourseId, {
        system_prompt: sourcePrompt.system_prompt,
        instruction_style: sourcePrompt.instruction_style,
        language_preference: sourcePrompt.language_preference,
        updated_by: adminUserId
      });

      return result;
    } catch (error) {
      console.error('Error cloning prompt:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get courses accessible by admin with prompt status
   * @param {number} adminUserId - Admin user ID
   * @returns {Promise<Array>} Courses with prompt status
   */
  async getAccessibleCoursesWithPromptStatus(adminUserId) {
    try {
      const courses = await rbacService.getAccessibleCourses(adminUserId);

      const coursesWithStatus = await Promise.all(
        courses.map(async (course) => {
          const hasCustomPrompt = await this.getCoursePrompt(course.course_id);
          return {
            ...course,
            hasCustomPrompt: !!hasCustomPrompt,
            promptLanguage: hasCustomPrompt ? hasCustomPrompt.language_preference : null
          };
        })
      );

      return coursesWithStatus;
    } catch (error) {
      console.error('Error getting accessible courses with prompt status:', error);
      throw error;
    }
  }

  /**
   * Validate prompt content
   * @param {string} prompt - Prompt to validate
   * @returns {Object} Validation result
   */
  validatePrompt(prompt) {
    if (!prompt || typeof prompt !== 'string') {
      return { valid: false, error: 'Prompt must be a non-empty string' };
    }

    if (prompt.trim().length < 20) {
      return { valid: false, error: 'Prompt must be at least 20 characters long' };
    }

    if (prompt.length > 5000) {
      return { valid: false, error: 'Prompt must not exceed 5000 characters' };
    }

    return { valid: true };
  }
}

// Create singleton instance
const courseChatbotService = new CourseChatbotService();

module.exports = courseChatbotService;
