/**
 * Chatbot Prompt Management Routes
 * Multi-Region RBAC System - Course Chatbot Customization
 *
 * Features:
 * - Custom system prompts per course
 * - Instruction style selection (conversational, formal, casual)
 * - Language preference (English, Swahili, Bilingual)
 * - Prompt testing and preview
 * - Prompt cloning across courses
 * - Default prompt fallback
 */

const express = require('express');
const router = express.Router();
const courseChatbotService = require('../services/course-chatbot.service');
const authMiddleware = require('../middleware/auth.middleware');
const rbacMiddleware = require('../middleware/rbac.middleware');
const logger = require('../utils/logger');

/**
 * @route GET /api/chatbot-prompts/course/:courseId
 * @desc Get chatbot prompt for a course
 * @access Admin+ (with course access validation)
 */
router.get(
  '/course/:courseId',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateCourseAccess,
  async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      const prompt = await courseChatbotService.getCoursePrompt(courseId);

      if (!prompt) {
        return res.json({
          success: true,
          hasCustomPrompt: false,
          message: 'No custom prompt set for this course. Using default prompt.',
          default: courseChatbotService.getDefaultPrompt('conversational')
        });
      }

      res.json({
        success: true,
        hasCustomPrompt: true,
        data: prompt
      });
    } catch (error) {
      logger.error(`Error fetching chatbot prompt for course ${req.params.courseId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch chatbot prompt'
      });
    }
  }
);

/**
 * @route GET /api/chatbot-prompts/course/:courseId/effective
 * @desc Get effective prompt for a course (custom or default)
 * @access Admin+ (with course access validation)
 */
router.get(
  '/course/:courseId/effective',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateCourseAccess,
  async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      const effectivePrompt = await courseChatbotService.getEffectivePrompt(courseId);

      res.json({
        success: true,
        data: effectivePrompt
      });
    } catch (error) {
      logger.error(`Error fetching effective prompt for course ${req.params.courseId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch effective prompt'
      });
    }
  }
);

/**
 * @route POST /api/chatbot-prompts/course/:courseId
 * @desc Create or update chatbot prompt for a course
 * @access Admin+ (with course access validation)
 * @body { system_prompt, instruction_style?, language_preference? }
 */
router.post(
  '/course/:courseId',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateCourseAccess,
  rbacMiddleware.validateRequiredFields(['system_prompt']),
  async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      const { system_prompt, instruction_style, language_preference } = req.body;

      // Validate prompt content
      const validation = courseChatbotService.validatePrompt(system_prompt);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      const result = await courseChatbotService.setCourseChatbotPrompt(courseId, {
        system_prompt,
        instruction_style,
        language_preference,
        updated_by: req.user.id
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      logger.info(`Chatbot prompt ${result.action} for course ${courseId} by admin ${req.user.id}`);

      res.json({
        success: true,
        message: `Chatbot prompt ${result.action} successfully`,
        data: result.data
      });
    } catch (error) {
      logger.error(`Error setting chatbot prompt for course ${req.params.courseId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to set chatbot prompt'
      });
    }
  }
);

/**
 * @route PUT /api/chatbot-prompts/course/:courseId
 * @desc Update existing chatbot prompt for a course
 * @access Admin+ (with course access validation)
 * @body { system_prompt?, instruction_style?, language_preference? }
 */
router.put(
  '/course/:courseId',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateCourseAccess,
  async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      const { system_prompt, instruction_style, language_preference } = req.body;

      // At least one field must be provided
      if (!system_prompt && !instruction_style && !language_preference) {
        return res.status(400).json({
          success: false,
          error: 'At least one field must be provided for update'
        });
      }

      // Validate prompt content if provided
      if (system_prompt) {
        const validation = courseChatbotService.validatePrompt(system_prompt);
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            error: validation.error
          });
        }
      }

      const result = await courseChatbotService.setCourseChatbotPrompt(courseId, {
        system_prompt,
        instruction_style,
        language_preference,
        updated_by: req.user.id
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      logger.info(`Chatbot prompt updated for course ${courseId} by admin ${req.user.id}`);

      res.json({
        success: true,
        message: 'Chatbot prompt updated successfully',
        data: result.data
      });
    } catch (error) {
      logger.error(`Error updating chatbot prompt for course ${req.params.courseId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to update chatbot prompt'
      });
    }
  }
);

/**
 * @route DELETE /api/chatbot-prompts/course/:courseId
 * @desc Delete custom chatbot prompt (revert to default)
 * @access Admin+ (with course access validation)
 */
router.delete(
  '/course/:courseId',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateCourseAccess,
  async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);

      const result = await courseChatbotService.deleteCoursePrompt(courseId, req.user.id);

      if (!result.success) {
        return res.status(400).json(result);
      }

      logger.info(`Chatbot prompt deleted for course ${courseId} by admin ${req.user.id}`);

      res.json({
        success: true,
        message: 'Custom chatbot prompt deleted. Course will use default prompt.',
        data: result.data
      });
    } catch (error) {
      logger.error(`Error deleting chatbot prompt for course ${req.params.courseId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete chatbot prompt'
      });
    }
  }
);

/**
 * @route POST /api/chatbot-prompts/test
 * @desc Test a chatbot prompt with sample message
 * @access Admin+
 * @body { system_prompt, instruction_style, language_preference, sample_message }
 */
router.post(
  '/test',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateRequiredFields(['system_prompt', 'sample_message']),
  async (req, res) => {
    try {
      const { system_prompt, instruction_style, language_preference, sample_message } = req.body;

      // Validate prompt content
      const validation = courseChatbotService.validatePrompt(system_prompt);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      const result = await courseChatbotService.testPrompt(
        {
          system_prompt,
          instruction_style: instruction_style || 'conversational',
          language_preference: language_preference || 'english'
        },
        sample_message
      );

      res.json(result);
    } catch (error) {
      logger.error('Error testing chatbot prompt:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test chatbot prompt'
      });
    }
  }
);

/**
 * @route POST /api/chatbot-prompts/clone
 * @desc Clone prompt from one course to another
 * @access Admin+ (with access to both courses)
 * @body { sourceCourseId, targetCourseId }
 */
router.post(
  '/clone',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateRequiredFields(['sourceCourseId', 'targetCourseId']),
  async (req, res) => {
    try {
      const { sourceCourseId, targetCourseId } = req.body;

      const result = await courseChatbotService.clonePrompt(
        parseInt(sourceCourseId),
        parseInt(targetCourseId),
        req.user.id
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      logger.info(`Chatbot prompt cloned from course ${sourceCourseId} to ${targetCourseId} by admin ${req.user.id}`);

      res.json({
        success: true,
        message: 'Chatbot prompt cloned successfully',
        data: result.data
      });
    } catch (error) {
      logger.error('Error cloning chatbot prompt:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clone chatbot prompt'
      });
    }
  }
);

/**
 * @route GET /api/chatbot-prompts/all-custom
 * @desc Get all courses with custom prompts (filtered by access)
 * @access Admin+
 */
router.get(
  '/all-custom',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.attachRoleInfo,
  async (req, res) => {
    try {
      let prompts = await courseChatbotService.getCoursesWithCustomPrompts();

      // Filter by accessible regions for Regional Admins
      if (req.userRole && !req.userRole.isSuperAdmin && req.assignedRegions) {
        prompts = prompts.filter(prompt =>
          req.assignedRegions.includes(prompt.region_id)
        );
      }

      res.json({
        success: true,
        data: prompts,
        totalCustomPrompts: prompts.length
      });
    } catch (error) {
      logger.error('Error fetching all custom prompts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch custom prompts'
      });
    }
  }
);

/**
 * @route GET /api/chatbot-prompts/accessible-courses
 * @desc Get accessible courses with chatbot prompt status
 * @access Admin+
 */
router.get(
  '/accessible-courses',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  async (req, res) => {
    try {
      const courses = await courseChatbotService.getAccessibleCoursesWithPromptStatus(req.user.id);

      res.json({
        success: true,
        data: courses,
        totalCourses: courses.length,
        withCustomPrompt: courses.filter(c => c.hasCustomPrompt).length
      });
    } catch (error) {
      logger.error('Error fetching accessible courses with prompt status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch accessible courses'
      });
    }
  }
);

/**
 * @route GET /api/chatbot-prompts/defaults
 * @desc Get available default prompts and styles
 * @access Admin+
 */
router.get(
  '/defaults',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          instructionStyles: [
            {
              value: 'conversational',
              label: 'Conversational',
              description: 'Friendly and supportive teaching assistant',
              defaultPrompt: courseChatbotService.getDefaultPrompt('conversational')
            },
            {
              value: 'formal',
              label: 'Formal',
              description: 'Professional instructor with structured guidance',
              defaultPrompt: courseChatbotService.getDefaultPrompt('formal')
            },
            {
              value: 'casual',
              label: 'Casual',
              description: 'Helpful teaching buddy with simple explanations',
              defaultPrompt: courseChatbotService.getDefaultPrompt('casual')
            }
          ],
          languagePreferences: [
            {
              value: 'english',
              label: 'English Only',
              description: 'AI responds only in English'
            },
            {
              value: 'swahili',
              label: 'Swahili Only (Kiswahili)',
              description: 'AI responds only in Swahili'
            },
            {
              value: 'bilingual',
              label: 'Bilingual (English & Swahili)',
              description: 'AI provides responses in both languages'
            }
          ]
        }
      });
    } catch (error) {
      logger.error('Error fetching default prompt options:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch default options'
      });
    }
  }
);

/**
 * @route GET /api/chatbot-prompts/preview-language/:courseId
 * @desc Preview how prompt will look with different language settings
 * @access Admin+ (with course access validation)
 */
router.get(
  '/preview-language/:courseId',
  authMiddleware.authenticateToken,
  rbacMiddleware.requireRegionalAdmin,
  rbacMiddleware.validateCourseAccess,
  async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      const { language = 'english' } = req.query;

      const coursePrompt = await courseChatbotService.getCoursePrompt(courseId);

      if (!coursePrompt) {
        return res.status(404).json({
          success: false,
          error: 'No custom prompt found for this course'
        });
      }

      const preview = courseChatbotService.generatePromptWithLanguage(
        coursePrompt.system_prompt,
        language
      );

      res.json({
        success: true,
        data: {
          courseId,
          language,
          basePrompt: coursePrompt.system_prompt,
          enhancedPrompt: preview,
          expectedBehavior: courseChatbotService.describeExpectedBehavior(language)
        }
      });
    } catch (error) {
      logger.error(`Error previewing language for course ${req.params.courseId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to preview language settings'
      });
    }
  }
);

module.exports = router;
