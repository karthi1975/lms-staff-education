#!/usr/bin/env node
const https = require('https');
const { JSDOM } = require('jsdom');

const MOODLE_URL = 'https://karthitest.moodlecloud.com';
const TOKEN = 'c0ee6baca141679fdd6793ad397e6f21';
const QUIZ_ID = 8;

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
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON'));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('\n=== Inspecting Quiz Questions ===\n');

  await moodleApiCall('mod_quiz_view_quiz', { quizid: QUIZ_ID });
  const started = await moodleApiCall('mod_quiz_start_attempt', { quizid: QUIZ_ID });
  const attemptId = started.attempt.id;
  console.log(`Started attempt: ${attemptId}\n`);

  for (let page = 0; page < 4; page++) {
    const pageData = await moodleApiCall('mod_quiz_get_attempt_data', {
      attemptid: attemptId,
      page
    });

    for (const q of pageData.questions || []) {
      const dom = new JSDOM(q.html);
      const doc = dom.window.document;

      console.log(`\n📄 Question ${q.slot}:`);
      console.log(`Slot: ${q.slot}, Type: ${q.type}`);

      // Get question text
      const questionDiv = doc.querySelector('.qtext');
      if (questionDiv) {
        console.log(`Question: ${questionDiv.textContent.trim()}`);
      }

      // Get all radio options
      const radios = doc.querySelectorAll('input[type="radio"]');
      console.log(`\nOptions (${radios.length}):`);

      radios.forEach((radio, idx) => {
        const labelledBy = radio.getAttribute('aria-labelledby');
        let label = radio.value;

        if (labelledBy) {
          const labelDiv = doc.getElementById(labelledBy);
          if (labelDiv) {
            label = labelDiv.textContent.trim();
          }
        }

        console.log(`  [${idx}] value="${radio.value}" name="${radio.name}" → ${label.substring(0, 60)}`);
      });
    }
  }

  // Clean up
  await moodleApiCall('mod_quiz_process_attempt', {
    attemptid: attemptId,
    finishattempt: 1,
    timeup: 1
  });
}

main().catch(console.error);
