/**
 * Moodle Sync Service - WORKING VERSION
 * Uses HTML parsing with aria-labelledby support
 * Handles multi-page quizzes (one question per page)
 * Maps WhatsApp answers by text matching (handles randomized options)
 */

const https = require('https');
const { JSDOM } = require('jsdom');
const postgresService = require('./database/postgres.service');
const logger = require('../utils/logger');

const MOODLE_URL = process.env.MOODLE_URL || 'https://karthitest.moodlecloud.com';
const MOODLE_TOKEN = process.env.MOODLE_TOKEN || 'c0ee6baca141679fdd6793ad397e6f21';
const MOODLE_QUIZ_ID = 4; // Module 1 Quiz

class MoodleSyncService {
  constructor() {
    this.enabled = process.env.MOODLE_SYNC_ENABLED === 'true';
    logger.info(`Moodle sync ${this.enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Make Moodle API call (POST with form data)
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

            if (result.exception) {
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
   * Normalize text for matching (lowercase, collapse whitespace)
   */
  normalizeText(text) {
    return (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  /**
   * Parse question HTML and extract field names, options, and labels
   * Supports aria-labelledby (Moodle's structure)
   */
  parseQuestionHTML(questionHTML) {
    const dom = new JSDOM(questionHTML);
    const document = dom.window.document;

    // Find sequencecheck hidden input
    let seqName = null;
    let seqValue = null;

    const hiddenInputs = document.querySelectorAll('input[type="hidden"]');
    for (const input of hiddenInputs) {
      const name = input.getAttribute('name') || '';
      if (name.endsWith('_:sequencecheck')) {
        seqName = name;
        seqValue = input.getAttribute('value') || '1';
        break;
      }
    }

    // Find radio options and extract labels using aria-labelledby
    const choices = [];
    const radios = document.querySelectorAll('input[type="radio"]');

    for (const radio of radios) {
      const name = radio.getAttribute('name') || '';
      const value = radio.getAttribute('value') || '';
      let labelText = '';

      // Try aria-labelledby first (Moodle's method)
      const labelledBy = radio.getAttribute('aria-labelledby');
      if (labelledBy) {
        const labelDiv = document.getElementById(labelledBy);
        if (labelDiv) {
          labelText = labelDiv.textContent.trim();
        }
      }

      // Fallback: standard label[for]
      if (!labelText) {
        const radioId = radio.getAttribute('id');
        if (radioId) {
          const label = document.querySelector(`label[for="${radioId}"]`);
          if (label) {
            labelText = label.textContent.trim();
          }
        }
      }

      // Last resort: value
      if (!labelText) {
        labelText = value;
      }

      choices.push({ name, value, label: labelText });
    }

    return { seqName, seqValue, choices };
  }

  /**
   * Choose the correct radio option by matching answer text
   * Removes letter prefixes like "A) ", "B) ", etc.
   * Uses the HTML value attribute from Moodle
   */
  chooseOption(choices, answerText) {
    // Remove letter prefix (e.g., "A) Facilitator" → "Facilitator")
    let cleanText = (answerText || '').replace(/^[A-D]\)\s*/, '');
    const normalized = this.normalizeText(cleanText);

    // Try exact text match first - use actual HTML value attribute
    for (const choice of choices) {
      const choiceLabel = this.normalizeText(choice.label);
      if (normalized && choiceLabel.includes(normalized)) {
        // Use the actual value attribute from Moodle HTML
        return { name: choice.name, value: choice.value };
      }
    }

    // Fallback: first option
    if (choices.length > 0) {
      return { name: choices[0].name, value: choices[0].value };
    }

    return null;
  }

  /**
   * Match WhatsApp answer to question by stem
   */
  matchAnswer(questionText, whatsappAnswers, usedIndices) {
    const normalized = this.normalizeText(questionText);

    // Find unused answer that matches the question stem
    for (let i = 0; i < whatsappAnswers.length; i++) {
      if (usedIndices.has(i)) continue;

      const stem = this.normalizeText(whatsappAnswers[i].stem || '');
      if (stem && normalized.includes(stem)) {
        usedIndices.add(i);
        return whatsappAnswers[i];
      }
    }

    // Fallback: first unused answer
    for (let i = 0; i < whatsappAnswers.length; i++) {
      if (!usedIndices.has(i)) {
        usedIndices.add(i);
        return whatsappAnswers[i];
      }
    }

    return null;
  }

  /**
   * Clear any in-progress attempts (prevents blocking)
   */
  async clearInProgressAttempts(quizId) {
    try {
      let attempts;
      try {
        attempts = await this.moodleApiCall('mod_quiz_get_user_attempts', { quizid: quizId });
      } catch {
        const result = await this.moodleApiCall('mod_quiz_get_user_quiz_attempts', { quizid: quizId });
        attempts = Array.isArray(result) ? result : (result.attempts || []);
      }

      if (!Array.isArray(attempts)) {
        attempts = attempts.attempts || [];
      }

      const inProgress = attempts.filter(a =>
        ['inprogress', 'inprogresspending', 'overdue'].includes(a.state)
      );

      if (inProgress.length > 0) {
        logger.info(`Clearing ${inProgress.length} in-progress Moodle attempt(s)`);

        for (const att of inProgress) {
          try {
            await this.moodleApiCall('mod_quiz_process_attempt', {
              attemptid: att.id,
              finishattempt: 1
            });
            logger.info(`Cleared Moodle attempt ${att.id}`);
          } catch (error) {
            logger.warn(`Failed to clear attempt ${att.id}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      logger.warn(`Failed to clear in-progress attempts: ${error.message}`);
    }
  }

  /**
   * Submit WhatsApp quiz result to Moodle
   * Uses HTML parsing with multi-page support
   */
  async syncQuizResultToMoodle(userId, moduleId, answers, questions, score, totalQuestions, quizId = null) {
    if (!this.enabled) {
      logger.info('Moodle sync disabled');
      return { success: false, message: 'Moodle sync disabled' };
    }

    // Use provided quizId or fall back to default
    const targetQuizId = quizId || MOODLE_QUIZ_ID;

    try {
      // Get WhatsApp user info
      const userResult = await postgresService.query(
        'SELECT whatsapp_id, name, moodle_user_id, moodle_username FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      // Log sync attempt
      logger.info(`🔄 Syncing quiz to Moodle for ${user.name} (${user.whatsapp_id})`);
      logger.info(`   Quiz ID: ${targetQuizId}`);
      logger.info(`   Score: ${score}/${totalQuestions} (${Math.round(score/totalQuestions*100)}%)`);

      // Build WhatsApp answers with text for matching
      const whatsappAnswers = answers.map((answer, idx) => {
        const question = questions[idx];
        const answerLetter = answer;

        // Get answer text from question options
        let answerText = '';
        if (question && question.options) {
          const optionIndex = answerLetter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
          if (question.options[optionIndex]) {
            answerText = question.options[optionIndex];
          }
        }

        // Extract stem from question text
        const stem = (question.questionText || '')
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(' ')
          .slice(0, 8)
          .join(' ');

        return {
          stem,
          answerText,
          letter: answerLetter
        };
      });

      logger.info(`   Prepared ${whatsappAnswers.length} answers for Moodle`);

      // Helper: Add delay between API calls to prevent race conditions
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      // Step 1: View quiz
      await this.moodleApiCall('mod_quiz_view_quiz', { quizid: targetQuizId });
      await delay(500);

      // Step 2: Clear any blocking attempts
      await this.clearInProgressAttempts(targetQuizId);
      await delay(1000); // Wait longer after clearing attempts

      // Step 3: Start attempt
      const started = await this.moodleApiCall('mod_quiz_start_attempt', {
        quizid: targetQuizId
      });
      await delay(500);

      const attemptId = started.attempt.id;
      logger.info(`   Started Moodle attempt: ${attemptId}`);

      // Step 4: Fetch all pages and build answer payload
      const allPairs = [];
      const usedIndices = new Set();
      let pageNum = 0;

      while (pageNum < 10) { // Max 10 pages safety limit
        try {
          const pageData = await this.moodleApiCall('mod_quiz_get_attempt_data', {
            attemptid: attemptId,
            page: pageNum
          });

          const pageQuestions = pageData.questions || [];
          if (pageQuestions.length === 0) break;

          for (const q of pageQuestions) {
            const html = q.html || '';
            if (!html) continue;

            // Parse HTML to get field names and options
            const { seqName, seqValue, choices } = this.parseQuestionHTML(html);

            // Match WhatsApp answer by question text
            const dom = new JSDOM(html);
            const questionText = dom.window.document.body.textContent;
            const matched = this.matchAnswer(questionText, whatsappAnswers, usedIndices);

            if (!matched) continue;

            // Add sequencecheck
            if (seqName && seqValue) {
              allPairs.push({ name: seqName, value: seqValue });
            }

            // Debug: log all choices
            logger.info(`   Q${q.slot} choices:`, choices.map(c => `${c.label.substring(0,30)}=${c.value}`).join(', '));

            // Choose correct option
            const selected = this.chooseOption(choices, matched.answerText);
            if (selected) {
              allPairs.push({ name: selected.name, value: selected.value });
              // Clean text for logging
              const cleanText = (matched.answerText || '').replace(/^[A-D]\)\s*/, '');
              logger.info(`   Q${q.slot}: ${matched.letter} → "${cleanText.substring(0, 40)}..." → value=${selected.value}`);
            }
          }

          pageNum++;
        } catch (error) {
          // No more pages
          break;
        }
      }

      logger.info(`   Collected ${allPairs.filter(p => !p.name.includes('sequencecheck')).length} answers`);

      // Step 5: Save attempt (optional, helps with debugging)
      const saveParams = { attemptid: attemptId };
      allPairs.forEach((pair, i) => {
        saveParams[`data[${i}][name]`] = pair.name;
        saveParams[`data[${i}][value]`] = pair.value;
      });

      try {
        await this.moodleApiCall('mod_quiz_save_attempt', saveParams);
        logger.info(`   Saved answers to Moodle`);
        await delay(1000); // Wait after saving
      } catch (error) {
        logger.warn(`   Save failed (continuing): ${error.message}`);
      }

      // Step 6: Finish attempt (with retry logic)
      const finishParams = { attemptid: attemptId, finishattempt: 1 };
      allPairs.forEach((pair, i) => {
        finishParams[`data[${i}][name]`] = pair.name;
        finishParams[`data[${i}][value]`] = pair.value;
      });

      let finishSuccess = false;
      let retryCount = 0;
      const maxRetries = 3;

      while (!finishSuccess && retryCount < maxRetries) {
        try {
          retryCount++;
          if (retryCount > 1) {
            logger.info(`   Retry ${retryCount}/${maxRetries}: Finishing attempt...`);
            await delay(2000); // Wait longer between retries
          }
          const done = await this.moodleApiCall('mod_quiz_process_attempt', finishParams);
          logger.info(`   Finished attempt: ${done.state}`);
          finishSuccess = true;
        } catch (error) {
          // Try with unsaved work preflight if needed
          if (error.message.toLowerCase().includes('unsaved work')) {
            finishParams['preflightdata[0][name]'] = 'confirmdatasaved';
            finishParams['preflightdata[0][value]'] = '1';
            try {
              const done = await this.moodleApiCall('mod_quiz_process_attempt', finishParams);
              logger.info(`   Finished attempt (with preflight): ${done.state}`);
              finishSuccess = true;
            } catch (preflightError) {
              logger.warn(`   Finish retry ${retryCount} failed: ${preflightError.message}`);
            }
          } else {
            logger.warn(`   Finish retry ${retryCount} failed: ${error.message}`);
            if (retryCount >= maxRetries) {
              throw error;
            }
          }
        }
      }

      if (!finishSuccess) {
        throw new Error('Failed to finish attempt after ' + maxRetries + ' retries');
      }

      await delay(1000); // Wait for Moodle to process the finish

      // Step 7: Get grade (with retry)
      let moodleGrade = null;
      for (let i = 0; i < 3; i++) {
        try {
          const review = await this.moodleApiCall('mod_quiz_get_attempt_review', {
            attemptid: attemptId
          });
          moodleGrade = review.grade;
          logger.info(`   Moodle grade: ${moodleGrade}`);
          break;
        } catch (error) {
          if (i < 2) {
            logger.info(`   Grade not ready, retrying... (${i + 1}/3)`);
            await delay(2000);
          } else {
            logger.warn(`   Could not get grade: ${error.message}`);
          }
        }
      }

      // Step 8: Store Moodle attempt ID in local database
      await postgresService.query(
        `UPDATE quiz_attempts
         SET metadata = jsonb_set(
           COALESCE(metadata, '{}'::jsonb),
           '{moodle_attempt_id}',
           $1::text::jsonb
         )
         WHERE id = (
           SELECT id FROM quiz_attempts
           WHERE user_id = $2 AND module_id = $3
           ORDER BY attempted_at DESC
           LIMIT 1
         )`,
        [attemptId, userId, moduleId]
      );

      logger.info(`✅ Successfully synced quiz to Moodle (Attempt: ${attemptId}, Grade: ${moodleGrade})`);

      return {
        success: true,
        moodleAttemptId: attemptId,
        moodleGrade,
        whatsappScore: score,
        whatsappTotal: totalQuestions,
        message: `Quiz synced to Moodle! Attempt ID: ${attemptId}`
      };

    } catch (error) {
      logger.error(`❌ Failed to sync quiz to Moodle: ${error.message}`);
      logger.error(error.stack);

      return {
        success: false,
        error: error.message,
        message: 'Failed to sync to Moodle'
      };
    }
  }
}

module.exports = new MoodleSyncService();
