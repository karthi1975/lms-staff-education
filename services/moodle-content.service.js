/**
 * Moodle Content Service
 * Fetches course content, modules, and quizzes from Moodle API
 */

const https = require('https');
const { JSDOM } = require('jsdom');
const moodleSettingsService = require('./moodle-settings.service');
const logger = require('../utils/logger');

class MoodleContentService {
  constructor() {
    this.config = null;
    this.initialized = false;
  }

  /**
   * Initialize service with DB settings
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.config = await moodleSettingsService.getMoodleConfig();
      this.initialized = true;
    } catch (error) {
      // Fallback to .env if DB settings not available
      logger.warn('Failed to load Moodle settings from DB, using .env fallback');
      this.config = {
        url: process.env.MOODLE_URL || 'https://karthitest.moodlecloud.com',
        token: process.env.MOODLE_TOKEN || '',
        sync_enabled: process.env.MOODLE_SYNC_ENABLED === 'true'
      };
      this.initialized = true;
    }
  }

  /**
   * Make Moodle API call
   */
  async moodleApiCall(wsfunction, params = {}) {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const postData = new URLSearchParams({
        wstoken: this.config.token,
        wsfunction,
        moodlewsrestformat: 'json',
        ...params
      }).toString();

      const options = {
        hostname: this.config.url.replace('https://', '').replace('http://', ''),
        path: '/webservice/rest/server.php',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const result = JSON.parse(data);

            if (result.exception || result.errorcode) {
              reject(new Error(`Moodle API Error (${wsfunction}): ${result.message || result.errorcode}`));
            } else {
              resolve(result);
            }
          } catch (e) {
            reject(new Error(`Invalid JSON response from ${wsfunction}: ${e.message}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  /**
   * Get course by ID
   */
  async getCourse(courseId) {
    try {
      const courses = await this.moodleApiCall('core_course_get_courses', {
        'options[ids][0]': courseId
      });

      if (!courses || courses.length === 0) {
        throw new Error(`Course ${courseId} not found`);
      }

      return courses[0];
    } catch (error) {
      logger.error(`Failed to fetch course ${courseId}:`, error);
      throw error;
    }
  }

  /**
   * Get course contents (modules, sections, resources)
   */
  async getCourseContents(courseId) {
    try {
      const contents = await this.moodleApiCall('core_course_get_contents', {
        courseid: courseId
      });

      return contents;
    } catch (error) {
      logger.error(`Failed to fetch course contents for ${courseId}:`, error);
      throw error;
    }
  }

  /**
   * Extract module content from Moodle module object
   */
  async extractModuleContent(module) {
    try {
      let contentText = '';

      // Extract from description
      if (module.description) {
        contentText += this.stripHtml(module.description) + '\n\n';
      }

      // Extract from module contents
      if (module.contents && module.contents.length > 0) {
        for (const content of module.contents) {
          // Handle page content
          if (content.type === 'content' && content.content) {
            contentText += this.stripHtml(content.content) + '\n\n';
          }

          // Handle file content (PDFs would need download + parsing)
          if (content.type === 'file') {
            logger.info(`File found: ${content.filename} (${content.mimetype})`);
            // TODO: Download and parse PDFs, DOCX if needed
            // For now, just note the file
            contentText += `[File: ${content.filename}]\n\n`;
          }
        }
      }

      // Extract from summary
      if (module.summary) {
        contentText += this.stripHtml(module.summary) + '\n\n';
      }

      return contentText.trim();
    } catch (error) {
      logger.error(`Failed to extract module content:`, error);
      return '';
    }
  }

  /**
   * Strip HTML tags and clean text
   */
  stripHtml(html) {
    if (!html) return '';

    try {
      const dom = new JSDOM(html);
      const text = dom.window.document.body.textContent || '';

      // Clean up whitespace
      return text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
    } catch (error) {
      // Fallback: simple regex strip
      return html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  /**
   * Get quizzes for a course
   */
  async getQuizzesByCourse(courseId) {
    try {
      const quizzes = await this.moodleApiCall('mod_quiz_get_quizzes_by_courses', {
        'courseids[0]': courseId
      });

      return quizzes.quizzes || [];
    } catch (error) {
      logger.error(`Failed to fetch quizzes for course ${courseId}:`, error);
      return [];
    }
  }

  /**
   * Get quiz questions (by starting a dummy attempt)
   */
  async getQuizQuestions(quizId) {
    try {
      logger.info(`Fetching questions for quiz ${quizId}...`);

      // Start attempt
      const started = await this.moodleApiCall('mod_quiz_start_attempt', {
        quizid: quizId
      });

      const attemptId = started.attempt.id;
      logger.info(`Started dummy attempt ${attemptId}`);

      // Get attempt data (questions)
      const attemptData = await this.moodleApiCall('mod_quiz_get_attempt_data', {
        attemptid: attemptId,
        page: 0
      });

      const questions = [];

      // Parse questions from HTML
      for (const q of attemptData.questions || []) {
        const parsed = this.parseQuestionHtml(q.html);
        if (parsed) {
          questions.push({
            moodle_question_id: q.slot,
            question_text: parsed.questionText,
            question_type: parsed.questionType,
            options: parsed.options,
            correct_answer: null, // We don't know correct answer from attempt
            sequence_order: q.slot
          });
        }
      }

      // Abandon attempt
      try {
        await this.moodleApiCall('mod_quiz_process_attempt', {
          attemptid: attemptId,
          finishattempt: 1
        });
        logger.info(`Abandoned dummy attempt ${attemptId}`);
      } catch (error) {
        logger.warn(`Failed to abandon attempt: ${error.message}`);
      }

      return questions;
    } catch (error) {
      logger.error(`Failed to fetch quiz questions:`, error);
      throw error;
    }
  }

  /**
   * Parse question HTML to extract text and options
   */
  parseQuestionHtml(html) {
    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Extract question text
      const questionDiv = document.querySelector('.qtext') || document.querySelector('.formulation');
      const questionText = questionDiv ? questionDiv.textContent.trim() : '';

      if (!questionText) {
        logger.warn('Could not extract question text from HTML');
        return null;
      }

      // Detect question type and extract options
      const radios = document.querySelectorAll('input[type="radio"]');
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');

      let questionType = 'multichoice';
      let options = [];

      if (radios.length > 0) {
        // Multiple choice (single answer)
        questionType = 'multichoice';
        options = this.extractOptionsFromInputs(radios, document);
      } else if (checkboxes.length > 0) {
        // Multiple response
        questionType = 'multiresponse';
        options = this.extractOptionsFromInputs(checkboxes, document);
      } else {
        // Check for true/false
        const truefalseOptions = document.querySelectorAll('.answer input');
        if (truefalseOptions.length === 2) {
          questionType = 'truefalse';
          options = ['True', 'False'];
        }
      }

      return {
        questionText,
        questionType,
        options: options.length > 0 ? options : null
      };
    } catch (error) {
      logger.error('Failed to parse question HTML:', error);
      return null;
    }
  }

  /**
   * Extract option labels from radio/checkbox inputs
   */
  extractOptionsFromInputs(inputs, document) {
    const options = [];

    for (const input of inputs) {
      let labelText = '';

      // Try aria-labelledby
      const labelledBy = input.getAttribute('aria-labelledby');
      if (labelledBy) {
        const labelDiv = document.getElementById(labelledBy);
        if (labelDiv) {
          labelText = labelDiv.textContent.trim();
        }
      }

      // Fallback: label[for]
      if (!labelText) {
        const inputId = input.getAttribute('id');
        if (inputId) {
          const label = document.querySelector(`label[for="${inputId}"]`);
          if (label) {
            labelText = label.textContent.trim();
          }
        }
      }

      // Last resort: next sibling text
      if (!labelText && input.nextSibling) {
        labelText = input.nextSibling.textContent?.trim() || '';
      }

      if (labelText) {
        options.push(labelText);
      }
    }

    return options;
  }

  /**
   * Fetch complete course structure
   */
  async fetchCourseStructure(courseId) {
    try {
      logger.info(`Fetching complete structure for course ${courseId}...`);

      // Get course info
      const course = await this.getCourse(courseId);
      logger.info(`Course: ${course.fullname}`);

      // Get course contents
      const contents = await this.getCourseContents(courseId);
      logger.info(`Sections: ${contents.length}`);

      // Get quizzes
      const quizzes = await this.getQuizzesByCourse(courseId);
      logger.info(`Quizzes: ${quizzes.length}`);

      const modules = [];

      // Process sections as modules (each section becomes one module)
      for (const section of contents) {
        // Aggregate all content from modules within this section
        let sectionContentParts = [];
        let sectionUrls = [];

        for (const module of section.modules) {
          // Extract content from each module in the section
          const contentText = await this.extractModuleContent(module);

          if (contentText && contentText.trim()) {
            sectionContentParts.push(`### ${module.name}\n${contentText}`);
          }

          if (module.url) {
            sectionUrls.push(`${module.name}: ${module.url}`);
          }
        }

        // Combine all section content
        const aggregatedContent = sectionContentParts.join('\n\n');
        const sectionDescription = this.stripHtml(section.summary || '');

        // Create one module per section
        modules.push({
          moodle_module_id: section.id, // Use section ID
          module_name: section.name,
          module_type: 'section',
          sequence_order: section.section, // Section number
          content_text: aggregatedContent,
          content_url: sectionUrls.join('\n'),
          description: sectionDescription,
          section_name: section.name,
          section_id: section.id,
          module_count: section.modules.length // Track how many Moodle modules this section contains
        });
      }

      return {
        course,
        modules,
        quizzes
      };
    } catch (error) {
      logger.error(`Failed to fetch course structure:`, error);
      throw error;
    }
  }

  /**
   * Get all accessible courses for the authenticated token
   * For service accounts, uses core_course_get_courses to get all courses
   * For regular users, falls back to enrolled courses
   */
  async getUserCourses() {
    await this.initialize();

    try {
      // Get site info first to identify token capabilities
      const siteInfo = await this.moodleApiCall('core_webservice_get_site_info', {});
      logger.info(`Fetching courses for user ${siteInfo.username} (ID: ${siteInfo.userid}, Version: ${siteInfo.version})`);

      // Method 1: Try to get ALL courses (works for service accounts with proper permissions)
      try {
        logger.info('Attempting to fetch all courses (service account method)...');
        const allCourses = await this.moodleApiCall('core_course_get_courses', {});

        // Filter out site-level course (ID 1) if present
        const filteredCourses = allCourses.filter(c => c.id !== 1);
        logger.info(`✅ Found ${filteredCourses.length} courses using service account method`);
        return filteredCourses;
      } catch (error) {
        logger.warn(`Service account method failed: ${error.message}, trying user enrollment method...`);
      }

      // Method 2: Try enrolled courses by timeline (works for regular users)
      try {
        logger.info('Attempting to fetch enrolled courses (user method)...');
        const result = await this.moodleApiCall('core_course_get_enrolled_courses_by_timeline_classification', {
          classification: 'all'
        });
        const courses = result.courses || [];
        logger.info(`✅ Found ${courses.length} enrolled courses using user method`);
        return courses;
      } catch (error) {
        logger.warn(`User enrollment method failed: ${error.message}, trying legacy method...`);
      }

      // Method 3: Try legacy user courses API
      try {
        logger.info('Attempting to fetch courses (legacy user method)...');
        const courses = await this.moodleApiCall('core_enrol_get_users_courses', {
          userid: siteInfo.userid.toString()
        });
        logger.info(`✅ Found ${courses.length} courses using legacy method`);
        return courses;
      } catch (error) {
        logger.error(`All course fetch methods failed: ${error.message}`);
      }

      throw new Error('Unable to fetch courses. Please ensure the Moodle token has one of these permissions: ' +
                      'core_course_get_courses (service account), ' +
                      'core_course_get_enrolled_courses_by_timeline_classification (user), or ' +
                      'core_enrol_get_users_courses (legacy user)');
    } catch (error) {
      logger.error('Failed to fetch courses:', error);
      throw error;
    }
  }
}

module.exports = new MoodleContentService();
