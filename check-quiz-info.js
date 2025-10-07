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
          resolve(result);  // Don't reject on errors, we want to see them
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
  console.log('\n=== Quiz Access Information ===\n');

  try {
    const info = await moodleApiCall('mod_quiz_get_quiz_access_information', { quizid: QUIZ_ID });
    console.log('Access Info:', JSON.stringify(info, null, 2));
  } catch (e) {
    console.log('Access Info Error:', e.message);
  }

  console.log('\n=== Quiz Attempts ===\n');
  const attempts = await moodleApiCall('mod_quiz_get_user_attempts', { quizid: QUIZ_ID });
  console.log('Total attempts:', (attempts.attempts || []).length);
  console.log('Latest 3:', JSON.stringify((attempts.attempts || []).slice(-3), null, 2));

  console.log('\n=== Trying to Start New Attempt ===\n');
  try {
    const start = await moodleApiCall('mod_quiz_start_attempt', { quizid: QUIZ_ID });
    console.log('Started:', JSON.stringify(start, null, 2));
  } catch (e) {
    console.log('Start Error:', e.message);
  }
}

main().catch(console.error);
