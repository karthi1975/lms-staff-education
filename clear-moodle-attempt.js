#!/usr/bin/env node
const https = require('https');

const MOODLE_URL = 'https://karthitest.moodlecloud.com';
const TOKEN = 'c0ee6baca141679fdd6793ad397e6f21';
const QUIZ_ID = 4;

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
          reject(new Error(`Invalid JSON from ${wsfunction}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  // Get attempts
  const attempts = await moodleApiCall('mod_quiz_get_user_attempts', { quizid: QUIZ_ID });
  console.log('All attempts:', JSON.stringify(attempts, null, 2));

  const inProgress = (Array.isArray(attempts) ? attempts : (attempts.attempts || []))
    .filter(a => ['inprogress', 'inprogresspending', 'overdue'].includes(a.state));

  console.log(`\nFound ${inProgress.length} in-progress attempts`);

  for (const att of inProgress) {
    console.log(`\nAttempt ${att.id} (state: ${att.state})`);

    // Try finishing with all data empty
    try {
      const result = await moodleApiCall('mod_quiz_process_attempt', {
        attemptid: att.id,
        finishattempt: 1,
        timeup: 0,
        'preflightdata[0][name]': 'confirmdatasaved',
        'preflightdata[0][value]': '1'
      });
      console.log(`✅ Cleared: ${result.state}`);
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }
}

main().catch(console.error);
