const express = require('express');
const router = express.Router();
const postgresService = require('../services/database/postgres.service');
const logger = require('../utils/logger');

/**
 * @route POST /api/user/verify
 * @desc Verify user by WhatsApp ID
 * @access Public
 */
router.post('/user/verify', async (req, res) => {
  try {
    const { whatsapp_id } = req.body;

    if (!whatsapp_id) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp ID is required'
      });
    }

    // Find user by WhatsApp ID
    const result = await postgresService.pool.query(
      'SELECT id, whatsapp_id, name, created_at FROM users WHERE whatsapp_id = $1 AND is_active = true',
      [whatsapp_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found. Please contact your administrator or start training via WhatsApp.'
      });
    }

    const user = result.rows[0];

    // Update last active
    await postgresService.pool.query(
      'UPDATE users SET last_active_at = NOW() WHERE id = $1',
      [user.id]
    );

    res.json({
      success: true,
      data: {
        user_id: user.id,
        name: user.name,
        whatsapp_id: user.whatsapp_id,
        created_at: user.created_at
      }
    });

  } catch (error) {
    logger.error('Error verifying user:', error);
    res.status(500).json({
      success: false,
      error: 'Server error. Please try again later.'
    });
  }
});

/**
 * @route GET /api/user/quiz/:moduleId
 * @desc Get quiz questions for a module
 * @access Public (identified by phone)
 */
router.get('/user/quiz/:moduleId', async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { phone } = req.query; // WhatsApp phone number

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    // Get user by phone
    const userResult = await postgresService.pool.query(
      'SELECT id, full_name FROM users WHERE phone_number = $1',
      [phone]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const userId = userResult.rows[0].id;

    // Get quiz for module
    const quizResult = await postgresService.pool.query(
      'SELECT * FROM quizzes WHERE module_id = $1 AND is_active = true',
      [moduleId]
    );

    if (quizResult.rows.length === 0) {
      return res.json({
        success: true,
        quiz: null,
        message: 'No quiz available for this module'
      });
    }

    const quiz = quizResult.rows[0];

    // Get quiz questions (without revealing correct answers)
    const questionsResult = await postgresService.pool.query(
      'SELECT id, question_number, question_text, options FROM quiz_questions WHERE quiz_id = $1 ORDER BY question_number',
      [quiz.id]
    );

    // Format questions for display
    const questions = questionsResult.rows.map(q => {
      const optionsArray = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
      return {
        id: q.id,
        question_number: q.question_number,
        question: q.question_text,
        options: {
          A: optionsArray[0],
          B: optionsArray[1],
          C: optionsArray[2],
          D: optionsArray[3]
        }
      };
    });

    // Get user's previous attempts
    const attemptsResult = await postgresService.pool.query(
      'SELECT attempt_number, score, total_questions, passed, attempted_at FROM quiz_attempts WHERE user_id = $1 AND module_id = $2 ORDER BY attempt_number DESC',
      [userId, moduleId]
    );

    const attempts = attemptsResult.rows;
    const remainingAttempts = Math.max(0, quiz.max_attempts - attempts.length);

    res.json({
      success: true,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        pass_threshold: quiz.pass_threshold,
        max_attempts: quiz.max_attempts,
        remaining_attempts: remainingAttempts,
        time_limit_minutes: quiz.time_limit_minutes,
        total_questions: questions.length
      },
      questions,
      previousAttempts: attempts
    });

  } catch (error) {
    logger.error('Error getting quiz:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve quiz'
    });
  }
});

/**
 * @route POST /api/user/quiz/:moduleId/submit
 * @desc Submit quiz answers and calculate score
 * @access Public (identified by phone)
 */
router.post('/user/quiz/:moduleId/submit', async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { phone, answers } = req.body; // answers: { question_id: "A" | "B" | "C" | "D" }

    if (!phone || !answers) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and answers are required'
      });
    }

    // Get user
    const userResult = await postgresService.pool.query(
      'SELECT id, full_name, phone_number FROM users WHERE phone_number = $1',
      [phone]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Get quiz
    const quizResult = await postgresService.pool.query(
      'SELECT * FROM quizzes WHERE module_id = $1 AND is_active = true',
      [moduleId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No quiz found for this module'
      });
    }

    const quiz = quizResult.rows[0];

    // Check attempt limit
    const attemptsResult = await postgresService.pool.query(
      'SELECT COUNT(*) as count FROM quiz_attempts WHERE user_id = $1 AND module_id = $2',
      [user.id, moduleId]
    );

    const attemptCount = parseInt(attemptsResult.rows[0].count);

    if (attemptCount >= quiz.max_attempts) {
      return res.status(400).json({
        success: false,
        error: `Maximum attempts (${quiz.max_attempts}) reached for this quiz`
      });
    }

    // Get all questions with correct answers
    const questionsResult = await postgresService.pool.query(
      'SELECT id, question_text, options, correct_answer FROM quiz_questions WHERE quiz_id = $1',
      [quiz.id]
    );

    const questions = questionsResult.rows;

    // Calculate score
    let correctCount = 0;
    const detailedResults = [];

    questions.forEach(q => {
      const userAnswer = answers[q.id]; // "A", "B", "C", or "D"
      const userAnswerIndex = ['A', 'B', 'C', 'D'].indexOf(userAnswer);
      const correctAnswerIndex = q.correct_answer;
      const isCorrect = userAnswerIndex === correctAnswerIndex;

      if (isCorrect) {
        correctCount++;
      }

      detailedResults.push({
        question_id: q.id,
        user_answer: userAnswer,
        correct_answer: ['A', 'B', 'C', 'D'][correctAnswerIndex],
        is_correct: isCorrect
      });
    });

    const totalQuestions = questions.length;
    const percentage = (correctCount / totalQuestions) * 100;
    const passed = percentage >= quiz.pass_threshold;
    const newAttemptNumber = attemptCount + 1;

    // Insert quiz attempt
    await postgresService.pool.query(`
      INSERT INTO quiz_attempts (
        user_id,
        module_id,
        quiz_id,
        attempt_number,
        score,
        total_questions,
        percentage,
        passed,
        answers,
        attempted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    `, [
      user.id,
      moduleId,
      quiz.id,
      newAttemptNumber,
      correctCount,
      totalQuestions,
      percentage,
      passed,
      JSON.stringify(answers)
    ]);

    // Initialize user_progress if doesn't exist
    await postgresService.pool.query(`
      INSERT INTO user_progress (
        user_id,
        module_id,
        status,
        started_at,
        last_activity_at
      ) VALUES ($1, $2, 'in_progress', NOW(), NOW())
      ON CONFLICT (user_id, module_id) DO UPDATE
      SET last_activity_at = NOW()
    `, [user.id, moduleId]);

    // The trigger will automatically mark module as complete if passed
    // But let's also update user_progress here for immediate feedback
    if (passed) {
      await postgresService.pool.query(`
        UPDATE user_progress
        SET
          status = 'completed',
          completed_at = NOW(),
          quiz_taken = TRUE,
          quiz_passed = TRUE,
          quiz_score = $1,
          quiz_attempts_count = $2,
          progress_percentage = 100,
          last_activity_at = NOW()
        WHERE user_id = $3 AND module_id = $4
      `, [correctCount, newAttemptNumber, user.id, moduleId]);

      logger.info(`User ${user.phone_number} completed module ${moduleId} with quiz score ${correctCount}/${totalQuestions}`);
    }

    res.json({
      success: true,
      result: {
        passed,
        score: correctCount,
        total_questions: totalQuestions,
        percentage: parseFloat(percentage.toFixed(2)),
        pass_threshold: quiz.pass_threshold,
        attempt_number: newAttemptNumber,
        remaining_attempts: quiz.max_attempts - newAttemptNumber,
        module_completed: passed
      },
      details: detailedResults
    });

  } catch (error) {
    logger.error('Error submitting quiz:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit quiz'
    });
  }
});

/**
 * @route GET /api/user/quiz/:moduleId/attempts
 * @desc Get user's quiz attempt history
 * @access Public (identified by phone)
 */
router.get('/user/quiz/:moduleId/attempts', async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    // Get user
    const userResult = await postgresService.pool.query(
      'SELECT id FROM users WHERE phone_number = $1',
      [phone]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const userId = userResult.rows[0].id;

    // Get attempts
    const attemptsResult = await postgresService.pool.query(`
      SELECT
        attempt_number,
        score,
        total_questions,
        percentage,
        passed,
        attempted_at
      FROM quiz_attempts
      WHERE user_id = $1 AND module_id = $2
      ORDER BY attempt_number DESC
    `, [userId, moduleId]);

    res.json({
      success: true,
      attempts: attemptsResult.rows
    });

  } catch (error) {
    logger.error('Error getting quiz attempts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve attempts'
    });
  }
});

module.exports = router;
