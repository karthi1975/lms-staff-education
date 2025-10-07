/**
 * Moodle Content Service
 * Fetches course content, modules, and quizzes from Moodle API
 */

const https = require('https');
const { JSDOM } = require('jsdom');
const logger = require('../utils/logger');

const MOODLE_URL = process.env.MOODLE_URL || 'https://karthitest.moodlecloud.com';
const MOODLE_TOKEN = process.env.MOODLE_TOKEN || 'c0ee6baca141679fdd6793ad397e6f21';

class MoodleContentService {
  /**
   * Make Moodle API call
   */
  async moodleApiCall(wsfunction, params = {}) {
    return new Promise((resolve, reject) => {
      const postData = new URLSearchParams({
        wstoken: MOODLE_TOKEN,
        wsfunction,
        moodlewsrestformat: 'json',
        ...params
      }).toString();

      const options = {
        hostname: MOODLE_URL.replace('https://', '').replace('http://', ''),
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

      // Process sections and modules
      for (const section of contents) {
        for (const module of section.modules) {
          // Extract content
          const contentText = await this.extractModuleContent(module);

          modules.push({
            moodle_module_id: module.id,
            module_name: module.name,
            module_type: module.modname,
            sequence_order: module.id,
            content_text: contentText,
            content_url: module.url,
            description: this.stripHtml(module.description || ''),
            section_name: section.name,
            section_id: section.id
          });
        }
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
}

module.exports = new MoodleContentService();
