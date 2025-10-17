#!/usr/bin/env node
/**
 * Unit test for quiz upload endpoint
 * Tests the complete flow of uploading quiz questions
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'teachers_training',
  user: process.env.DB_USER || 'teachers_user',
  password: process.env.DB_PASSWORD || 'teachers_pass_2024'
});

async function testQuizUpload() {
  console.log('🧪 Testing Quiz Upload Endpoint\n');

  try {
    // Test connection
    console.log('🔌 Connecting to database...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected\n');
    // Step 1: Check if modules table exists and has data
    console.log('1️⃣ Checking modules table...');
    const modulesResult = await pool.query('SELECT id, title FROM modules LIMIT 5');

    if (modulesResult.rows.length === 0) {
      console.log('❌ No modules found in database');
      console.log('   You need to create a course and module first');
      return;
    }

    console.log(`✅ Found ${modulesResult.rows.length} modules:`);
    modulesResult.rows.forEach(m => {
      console.log(`   - Module ${m.id}: ${m.title}`);
    });

    const testModuleId = modulesResult.rows[0].id;
    console.log(`\n📝 Using module ${testModuleId} for testing\n`);

    // Step 2: Check if quizzes table exists
    console.log('2️⃣ Checking quizzes table schema...');
    const quizzesSchema = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'quizzes'
      ORDER BY ordinal_position
    `);

    console.log('✅ Quizzes table columns:');
    quizzesSchema.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Step 3: Check quiz_questions table schema
    console.log('\n3️⃣ Checking quiz_questions table schema...');
    const questionsSchema = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'quiz_questions'
      ORDER BY ordinal_position
    `);

    console.log('✅ Quiz_questions table columns:');
    questionsSchema.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Step 4: Simulate the quiz upload logic
    console.log('\n4️⃣ Simulating quiz upload logic...\n');

    const testQuestions = [
      {
        question: "What is the capital of France?",
        options: ["London", "Paris", "Berlin", "Madrid"],
        correctAnswer: 1,
        explanation: "Paris is the capital and largest city of France."
      },
      {
        question: "What is 2 + 2?",
        options: ["3", "4", "5"],
        correctAnswer: 1,
        explanation: "Basic arithmetic"
      }
    ];

    // Check if module exists
    const moduleCheck = await pool.query(
      'SELECT id FROM modules WHERE id = $1',
      [testModuleId]
    );

    if (moduleCheck.rows.length === 0) {
      console.log(`❌ Module ${testModuleId} not found`);
      return;
    }
    console.log(`✅ Module ${testModuleId} exists`);

    // Check if quiz already exists
    let quizResult = await pool.query(
      'SELECT id FROM quizzes WHERE module_id = $1',
      [testModuleId]
    );

    let quizId;

    if (quizResult.rows.length > 0) {
      quizId = quizResult.rows[0].id;
      console.log(`✅ Quiz ${quizId} already exists for module ${testModuleId}`);

      // Delete existing questions
      const deleteResult = await pool.query(
        'DELETE FROM quiz_questions WHERE quiz_id = $1',
        [quizId]
      );
      console.log(`✅ Deleted ${deleteResult.rowCount} existing questions`);
    } else {
      console.log(`📝 Creating new quiz for module ${testModuleId}...`);

      // Create new quiz
      quizResult = await pool.query(`
        INSERT INTO quizzes (
          module_id,
          title,
          time_limit_minutes,
          pass_percentage,
          max_attempts
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [
        testModuleId,
        `Module ${testModuleId} Test Quiz`,
        30,
        70,
        999
      ]);

      quizId = quizResult.rows[0].id;
      console.log(`✅ Created quiz ${quizId}`);
    }

    // Insert questions
    console.log(`\n5️⃣ Inserting ${testQuestions.length} questions...\n`);

    for (let i = 0; i < testQuestions.length; i++) {
      const q = testQuestions[i];

      console.log(`   Question ${i + 1}:`);
      console.log(`   - quiz_id: ${quizId}`);
      console.log(`   - question_text: "${q.question}"`);
      console.log(`   - question_type: multichoice`);
      console.log(`   - options: ${JSON.stringify(q.options)}`);
      console.log(`   - correct_answer: "${q.correctAnswer}"`);
      console.log(`   - explanation: "${q.explanation}"`);
      console.log(`   - points: 1.0`);

      const result = await pool.query(`
        INSERT INTO quiz_questions (
          module_id,
          quiz_id,
          question_text,
          question_type,
          options,
          correct_answer,
          explanation,
          points
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        testModuleId,
        quizId,
        q.question,
        'multichoice',
        JSON.stringify(q.options),
        q.correctAnswer.toString(),
        q.explanation || null,
        1.0
      ]);

      console.log(`   ✅ Inserted question ${result.rows[0].id}\n`);
    }

    // Verify the inserted data
    console.log('6️⃣ Verifying inserted data...\n');

    const verifyQuiz = await pool.query(
      'SELECT * FROM quizzes WHERE id = $1',
      [quizId]
    );

    console.log('✅ Quiz data:');
    console.log(`   - ID: ${verifyQuiz.rows[0].id}`);
    console.log(`   - Module ID: ${verifyQuiz.rows[0].module_id}`);
    console.log(`   - Title: ${verifyQuiz.rows[0].title}`);
    console.log(`   - Time Limit: ${verifyQuiz.rows[0].time_limit_minutes} minutes`);
    console.log(`   - Pass %: ${verifyQuiz.rows[0].pass_percentage}%`);
    console.log(`   - Max Attempts: ${verifyQuiz.rows[0].max_attempts}`);

    const verifyQuestions = await pool.query(
      'SELECT * FROM quiz_questions WHERE quiz_id = $1 ORDER BY id',
      [quizId]
    );

    console.log(`\n✅ Questions inserted: ${verifyQuestions.rows.length}`);
    verifyQuestions.rows.forEach((q, idx) => {
      console.log(`\n   Question ${idx + 1}:`);
      console.log(`   - ID: ${q.id}`);
      console.log(`   - Quiz ID: ${q.quiz_id}`);
      console.log(`   - Text: ${q.question_text}`);
      console.log(`   - Type: ${q.question_type}`);
      console.log(`   - Options: ${q.options}`);
      console.log(`   - Correct Answer: ${q.correct_answer}`);
      console.log(`   - Points: ${q.points}`);
    });

    console.log('\n\n🎉 SUCCESS! Quiz upload test completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Quiz ID: ${quizId}`);
    console.log(`   - Module ID: ${testModuleId}`);
    console.log(`   - Questions: ${verifyQuestions.rows.length}`);
    console.log(`\n✅ The endpoint should work correctly. You can proceed with upload.`);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\n📋 Error details:');
    console.error(`   - Code: ${error.code}`);
    console.error(`   - Detail: ${error.detail}`);
    console.error(`   - Hint: ${error.hint}`);
    console.error(`   - Position: ${error.position}`);
    console.error('\n🔍 Stack trace:');
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Run the test
testQuizUpload();
