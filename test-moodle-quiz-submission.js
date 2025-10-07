#!/usr/bin/env node
/**
 * STANDALONE Moodle Quiz Submission Test
 * Based on the working Python script: h5p-conversion/quiz_complete_working.py
 * Tests multi-page quiz submission with proper answer mapping
 */

const https = require('https');
const { JSDOM } = require('jsdom');

// Configuration
const MOODLE_URL = 'https://karthitest.moodlecloud.com';
const TOKEN = 'c0ee6baca141679fdd6793ad397e6f21';
const QUIZ_ID = 8; // Enterprise Business Quizz (NEW - cmid 77)

// WhatsApp answers from the 4-question entrepreneurship quiz
// These are the CORRECT answers (should get 100%)
const WHATSAPP_ANSWERS = [
  {
    stem: 'what is entrepreneurship',
    answer_text: 'The process of creating and managing a venture to solve problems or meet needs with value and risk'
  },
  {
    stem: 'not typically a characteristic of an entrepreneur',
    answer_text: 'Avoiding all forms of risk'
  },
  {
    stem: 'feasibility mean in business idea',
    answer_text: 'Practicality and achievability of the business idea'
  },
  {
    stem: 'entrepreneurship always requires starting a completely new company',
    answer_text: 'False'
  }
];

/**
 * Make Moodle API call
 */
async function moodleApiCall(wsfunction, params = {}) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      wstoken: TOKEN,
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
            reject(new Error(`${wsfunction} -> ${result.errorcode || result.exception}: ${result.message}`));
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(new Error(`Invalid JSON from ${wsfunction}: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Normalize text for matching
 */
function normalizeText(text) {
  return (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Parse question HTML to extract field names and options
 */
function parseQuestionHTML(questionHTML) {
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

  // Find radio options with aria-labelledby
  const choices = [];
  const radios = document.querySelectorAll('input[type="radio"]');

  for (const radio of radios) {
    const name = radio.getAttribute('name') || '';
    const value = radio.getAttribute('value') || '';
    let labelText = '';

    // Try aria-labelledby first (Moodle's structure)
    const labelledBy = radio.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelDiv = document.getElementById(labelledBy);
      if (labelDiv) {
        labelText = labelDiv.textContent.trim();
      }
    }

    // Fallback: label[for]
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
 * Choose the correct option by matching answer text
 * Uses the HTML value attribute from Moodle
 */
function chooseOption(choices, desiredText) {
  const normalized = normalizeText(desiredText);

  // Try exact match - use actual HTML value attribute
  for (const choice of choices) {
    const choiceLabel = normalizeText(choice.label);
    if (normalized && choiceLabel.includes(normalized)) {
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
function matchAnswer(questionText, whatsappAnswers, usedIndices) {
  const normalized = normalizeText(questionText);

  // Find unused answer that matches the question stem
  for (let i = 0; i < whatsappAnswers.length; i++) {
    if (usedIndices.has(i)) continue;

    const stem = normalizeText(whatsappAnswers[i].stem);
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
 * Clear in-progress attempts
 */
async function clearInProgressAttempts(quizId) {
  try {
    let attempts;
    try {
      attempts = await moodleApiCall('mod_quiz_get_user_attempts', { quizid: quizId });
    } catch {
      const result = await moodleApiCall('mod_quiz_get_user_quiz_attempts', { quizid: quizId });
      attempts = Array.isArray(result) ? result : (result.attempts || []);
    }

    if (!Array.isArray(attempts)) {
      attempts = attempts.attempts || [];
    }

    const inProgress = attempts.filter(a =>
      ['inprogress', 'inprogresspending', 'overdue'].includes(a.state)
    );

    if (inProgress.length > 0) {
      console.log(`🧹 Clearing ${inProgress.length} in-progress attempt(s)...`);

      for (const att of inProgress) {
        try {
          // Try with timeup parameter for overdue attempts
          await moodleApiCall('mod_quiz_process_attempt', {
            attemptid: att.id,
            finishattempt: 1,
            timeup: 1
          });
          console.log(`   ✅ Cleared attempt ${att.id}`);
        } catch (error) {
          // Try alternative method
          try {
            await moodleApiCall('mod_quiz_process_attempt', {
              attemptid: att.id,
              finishattempt: 1,
              'preflightdata[0][name]': 'confirmdatasaved',
              'preflightdata[0][value]': '1'
            });
            console.log(`   ✅ Cleared attempt ${att.id} (with preflight)`);
          } catch (error2) {
            console.log(`   ⚠️  Failed to clear ${att.id}: ${error2.message}`);
          }
        }
      }
      console.log();
    }
  } catch (error) {
    console.warn(`⚠️  Failed to clear attempts: ${error.message}`);
  }
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main test function
 */
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('  MOODLE QUIZ SUBMISSION TEST (Node.js)');
  console.log('  Based on working Python script');
  console.log('='.repeat(70) + '\n');

  try {
    // Step 1: View quiz
    console.log('📋 Viewing quiz...');
    await moodleApiCall('mod_quiz_view_quiz', { quizid: QUIZ_ID });
    await delay(500);

    // Step 2: Clear blocking attempts (retry up to 3 times)
    for (let i = 0; i < 3; i++) {
      await clearInProgressAttempts(QUIZ_ID);
      await delay(2000);

      // Check if any still remain
      try {
        const attempts = await moodleApiCall('mod_quiz_get_user_attempts', { quizid: QUIZ_ID });
        const stillInProgress = (Array.isArray(attempts) ? attempts : (attempts.attempts || []))
          .filter(a => ['inprogress', 'inprogresspending', 'overdue'].includes(a.state));

        if (stillInProgress.length === 0) {
          break;
        }

        if (i < 2) {
          console.log(`⚠️  ${stillInProgress.length} attempts still in progress, retrying...\n`);
        }
      } catch {}
    }

    // Step 3: Start attempt
    console.log('🚀 Starting quiz attempt...');
    const started = await moodleApiCall('mod_quiz_start_attempt', {
      quizid: QUIZ_ID
    });
    await delay(500);

    const attemptId = started.attempt.id;
    console.log(`✅ Started attempt: ${attemptId}\n`);

    // Step 4: Collect all answers across all pages
    const allPairs = [];
    const usedIndices = new Set();
    let pageNum = 0;

    while (pageNum < 10) { // Safety limit
      console.log(`📄 Page ${pageNum}...`);

      try {
        const pageData = await moodleApiCall('mod_quiz_get_attempt_data', {
          attemptid: attemptId,
          page: pageNum
        });

        const questions = pageData.questions || [];
        if (questions.length === 0) {
          console.log('   No more questions');
          break;
        }

        // Process each question on this page
        for (const q of questions) {
          const html = q.html || '';
          if (!html) continue;

          const slot = q.slot;
          process.stdout.write(`   Q${slot}... `);

          // Parse HTML
          const { seqName, seqValue, choices } = parseQuestionHTML(html);

          // Match WhatsApp answer
          const dom = new JSDOM(html);
          const questionText = dom.window.document.body.textContent;
          const matched = matchAnswer(questionText, WHATSAPP_ANSWERS, usedIndices);

          if (!matched) {
            console.log('⚠️  No match found');
            continue;
          }

          // Add sequencecheck
          if (seqName && seqValue) {
            allPairs.push({ name: seqName, value: seqValue });
          }

          // Choose correct option
          const selected = chooseOption(choices, matched.answer_text);
          if (selected) {
            allPairs.push({ name: selected.name, value: selected.value });
            const shortText = matched.answer_text.substring(0, 40);
            console.log(`✅ "${shortText}..." → value=${selected.value}`);
          } else {
            console.log('⚠️  No option selected');
          }
        }

        pageNum++;
      } catch (error) {
        if (error.message.includes('not found') ||
            error.message.includes('does not exist') ||
            error.message.includes('Invalid page number')) {
          console.log('   End of pages');
          break;
        }
        throw error;
      }
    }

    const answerCount = allPairs.filter(p => !p.name.includes('sequencecheck')).length;
    console.log(`\n📝 Total answers collected: ${answerCount} questions\n`);

    // Step 5: Save attempt
    console.log('💾 Saving answers...');
    const saveParams = { attemptid: attemptId };
    allPairs.forEach((pair, i) => {
      saveParams[`data[${i}][name]`] = pair.name;
      saveParams[`data[${i}][value]`] = pair.value;
    });

    try {
      await moodleApiCall('mod_quiz_save_attempt', saveParams);
      console.log('✅ Saved\n');
      await delay(1000);
    } catch (error) {
      console.log(`⚠️  Save failed (continuing): ${error.message}\n`);
    }

    // Step 6: Finish attempt
    console.log('🏁 Finishing attempt...');
    const finishParams = { attemptid: attemptId, finishattempt: 1 };
    allPairs.forEach((pair, i) => {
      finishParams[`data[${i}][name]`] = pair.name;
      finishParams[`data[${i}][value]`] = pair.value;
    });

    try {
      const done = await moodleApiCall('mod_quiz_process_attempt', finishParams);
      console.log(`✅ Finished: ${done.state}\n`);
    } catch (error) {
      if (error.message.toLowerCase().includes('unsaved work')) {
        console.log('⚠️  Unsaved work warning, retrying with preflight...');
        finishParams['preflightdata[0][name]'] = 'confirmdatasaved';
        finishParams['preflightdata[0][value]'] = '1';
        const done = await moodleApiCall('mod_quiz_process_attempt', finishParams);
        console.log(`✅ Finished: ${done.state}\n`);
      } else {
        throw error;
      }
    }

    await delay(1000);

    // Step 7: Get grade
    console.log('📊 Fetching grade...');
    try {
      const review = await moodleApiCall('mod_quiz_get_attempt_review', {
        attemptid: attemptId
      });

      const grade = review.grade;
      console.log('\n' + '='.repeat(70));
      console.log(`  🎯 GRADE: ${grade}`);
      console.log(`  💯 EXPECTED: 10.00 (100% - all correct answers)`);
      console.log('='.repeat(70) + '\n');
      console.log(`View in Moodle: ${MOODLE_URL}/mod/quiz/view.php?id=46\n`);

      if (parseFloat(grade) >= 7.0) {
        console.log('✅ TEST PASSED - Quiz submitted successfully!\n');
        process.exit(0);
      } else {
        console.log(`⚠️  TEST FAILED - Grade ${grade} is less than 7.0\n`);
        process.exit(1);
      }
    } catch (error) {
      console.log(`⚠️  Could not get grade: ${error.message}\n`);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
main();
