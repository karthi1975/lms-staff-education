#!/usr/bin/env node
const https = require('https');

const MOODLE_URL = 'https://karthitest.moodlecloud.com';
const TOKEN = 'c0ee6baca141679fdd6793ad397e6f21';
const CMID = 77; // Course module ID

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
          resolve(result);
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
  console.log('\n=== Getting Quiz Info from CMID ===\n');

  // Get quiz info by course module
  try {
    const quizInfo = await moodleApiCall('mod_quiz_get_quizzes_by_courses', {});
    console.log('All quizzes:', JSON.stringify(quizInfo, null, 2));

    // Find the one with cmid 77
    const targetQuiz = quizInfo.quizzes?.find(q => q.coursemodule === CMID);
    if (targetQuiz) {
      console.log('\n✅ Found target quiz:');
      console.log(`   Quiz ID: ${targetQuiz.id}`);
      console.log(`   Name: ${targetQuiz.name}`);
      console.log(`   Course Module ID: ${targetQuiz.coursemodule}`);
    }
  } catch (e) {
    console.log('Error:', e.message);
  }

  // Also check the attempt
  console.log('\n=== Checking Attempt 57 ===\n');
  try {
    const attemptData = await moodleApiCall('mod_quiz_get_attempt_data', {
      attemptid: 57,
      page: 0
    });
    console.log('Attempt quiz ID:', attemptData.attempt?.quiz);
  } catch (e) {
    console.log('Attempt error:', e.message);
  }
}

main().catch(console.error);
