/**
 * Quiz Service
 * Handles quiz generation, validation, and scoring for training modules
 */

const postgresService = require('./database/postgres.service');
const logger = require('../utils/logger');

class QuizService {
  constructor() {
    // Module 2: Classroom Management Quiz Questions
    this.module2Questions = [
      {
        id: 1,
        question: "What is the PRIMARY goal of effective classroom management?",
        options: [
          "A) To maintain strict discipline",
          "B) To create a positive learning environment",
          "C) To reduce teacher workload",
          "D) To increase test scores"
        ],
        correctAnswer: "B",
        explanation: "The primary goal is to create a positive learning environment where students feel safe, engaged, and motivated to learn."
      },
      {
        id: 2,
        question: "Which strategy is MOST effective for preventing classroom disruptions?",
        options: [
          "A) Setting clear expectations from day one",
          "B) Using harsh punishments",
          "C) Ignoring minor misbehaviors",
          "D) Letting students create their own rules"
        ],
        correctAnswer: "A",
        explanation: "Setting clear expectations and consistently enforcing them prevents confusion and reduces disruptions."
      },
      {
        id: 3,
        question: "What does 'proximity control' mean in classroom management?",
        options: [
          "A) Keeping students close to the teacher's desk",
          "B) Moving near students to redirect behavior without verbal intervention",
          "C) Controlling classroom temperature",
          "D) Managing classroom seating arrangements"
        ],
        correctAnswer: "B",
        explanation: "Proximity control involves the teacher physically moving closer to students to prevent or redirect off-task behavior non-verbally."
      },
      {
        id: 4,
        question: "How should teachers respond to minor disruptions during instruction?",
        options: [
          "A) Stop teaching and address it immediately with consequences",
          "B) Send the student to the principal",
          "C) Use non-verbal cues or proximity to redirect",
          "D) Ignore all disruptions completely"
        ],
        correctAnswer: "C",
        explanation: "Non-verbal cues and proximity allow teachers to address minor issues without interrupting the flow of instruction."
      },
      {
        id: 5,
        question: "What is the '80/20 rule' in classroom management?",
        options: [
          "A) Spend 80% of time teaching, 20% managing behavior",
          "B) 80% of problems come from 20% of students",
          "C) Give 80% attention to positive behaviors, 20% to negative",
          "D) 80% prevention, 20% intervention"
        ],
        correctAnswer: "C",
        explanation: "The 80/20 rule suggests teachers should focus most of their attention on recognizing and reinforcing positive behaviors rather than only addressing negative ones."
      }
    ];

    this.QUIZ_PASS_THRESHOLD = 0.7; // 70% = 4 out of 5 correct
    this.MAX_ATTEMPTS = 999; // Unlimited attempts for WhatsApp users
  }

  /**
   * Start a quiz for a user
   */
  async startQuiz(userId, moduleId) {
    try {
      // Get quiz for this module
      const quizResult = await postgresService.pool.query(`
        SELECT id, title, pass_threshold, max_attempts
        FROM quizzes
        WHERE module_id = $1 AND is_active = true
      `, [moduleId]);

      if (quizResult.rows.length === 0) {
        // Fallback to hardcoded Module 2 questions for backward compatibility
        if (moduleId === 2) {
          const attempts = await this.getQuizAttempts(userId, moduleId);
          return {
            success: true,
            questions: this.module2Questions.map(q => ({
              id: q.id,
              question: q.question,
              options: q.options
            })),
            totalQuestions: this.module2Questions.length,
            passThreshold: this.QUIZ_PASS_THRESHOLD,
            attemptsUsed: attempts.length,
            attemptsRemaining: this.MAX_ATTEMPTS - attempts.length
          };
        }

        return {
          success: false,
          message: '📝 No quiz available for this module yet. Please check back later or contact your instructor.'
        };
      }

      const quiz = quizResult.rows[0];

      // Get existing attempts
      const attempts = await this.getQuizAttempts(userId, moduleId);

      if (attempts.length >= quiz.max_attempts) {
        return {
          success: false,
          message: `⚠️ You have already used all ${quiz.max_attempts} attempts for this quiz. Please contact your instructor.`,
          attemptsRemaining: 0
        };
      }

      // Fetch quiz questions using quiz_id
      const questionsResult = await postgresService.pool.query(`
        SELECT
          qq.id,
          qq.question_number,
          qq.question_text,
          qq.question_type,
          qq.options,
          qq.correct_answer,
          qq.explanation
        FROM quiz_questions qq
        WHERE qq.quiz_id = $1
        ORDER BY qq.question_number
      `, [quiz.id]);

      if (questionsResult.rows.length === 0) {
        return {
          success: false,
          message: '❌ This quiz has no questions yet. Please contact your instructor.'
        };
      }

      // Format questions from database
      const questions = questionsResult.rows.map(q => {
        // Handle JSONB options (might be object or string)
        let optionsArray;
        if (typeof q.options === 'string') {
          optionsArray = JSON.parse(q.options);
        } else {
          optionsArray = q.options;
        }

        // Ensure we have an array
        if (!Array.isArray(optionsArray) || optionsArray.length < 4) {
          logger.warn(`Question ${q.id} has invalid options format`);
          optionsArray = ['Option A', 'Option B', 'Option C', 'Option D'];
        }

        // Format options with A, B, C, D letters
        const options = optionsArray.map((opt, idx) => `${String.fromCharCode(65 + idx)}) ${opt}`);

        return {
          id: q.id,
          question: q.question_text,
          options: options,
          questionType: q.question_type,
          correctAnswer: q.correct_answer, // This is an index (0, 1, 2, 3)
          explanation: q.explanation
        };
      });

      return {
        success: true,
        quizId: quiz.id,
        questions: questions,
        totalQuestions: questions.length,
        passThreshold: quiz.pass_threshold / 100, // Convert from percentage to decimal
        attemptsUsed: attempts.length,
        attemptsRemaining: quiz.max_attempts - attempts.length
      };
    } catch (error) {
      logger.error('Error starting quiz:', error);
      throw error;
    }
  }

  /**
   * Grade quiz answers
   * CORNER CASE FIX: Validate answer format to prevent crashes
   */
  async gradeQuiz(moduleId, answers, questions) {
    // CORNER CASE FIX: Validate inputs
    if (!Array.isArray(answers)) {
      throw new Error('Invalid answers format: answers must be an array');
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Invalid questions format: questions must be a non-empty array');
    }

    // CORNER CASE FIX: Validate answer count matches question count
    if (answers.length !== questions.length) {
      throw new Error(
        `Answer count mismatch: expected ${questions.length} answers, got ${answers.length}. ` +
        `Please answer all questions.`
      );
    }

    const results = [];
    let correctCount = 0;
    const invalidAnswers = [];

    questions.forEach((question, index) => {
      const rawAnswer = answers[index];

      // CORNER CASE FIX: Validate each answer is provided and valid
      if (rawAnswer === null || rawAnswer === undefined || rawAnswer === '') {
        invalidAnswers.push(`Question ${index + 1}: No answer provided`);
        results.push({
          questionId: question.id,
          question: question.question,
          userAnswer: 'NO ANSWER',
          correctAnswer: question.correctAnswer,
          isCorrect: false,
          explanation: question.explanation || ''
        });
        return;
      }

      // CORNER CASE FIX: Normalize answer (trim, uppercase)
      const userAnswer = String(rawAnswer).trim().toUpperCase();

      // CORNER CASE FIX: Validate answer is A, B, C, or D
      if (!['A', 'B', 'C', 'D'].includes(userAnswer)) {
        invalidAnswers.push(
          `Question ${index + 1}: Invalid answer "${rawAnswer}". Must be A, B, C, or D.`
        );
        results.push({
          questionId: question.id,
          question: question.question,
          userAnswer: rawAnswer,
          correctAnswer: question.correctAnswer,
          isCorrect: false,
          explanation: question.explanation || ''
        });
        return;
      }

      let isCorrect = false;

      // Check answer based on question type
      if (question.questionType === 'true_false') {
        // For true/false, correct_answer is 'True' or 'False', user answers 'A' or 'B'
        const correctLetter = question.correctAnswer.toLowerCase() === 'true' ? 'A' : 'B';
        isCorrect = userAnswer === correctLetter;
      } else {
        // For multiple choice, correct_answer is the index (0, 1, 2, 3)
        const correctLetter = String.fromCharCode(65 + parseInt(question.correctAnswer));
        isCorrect = userAnswer === correctLetter;
      }

      if (isCorrect) {
        correctCount++;
      }

      results.push({
        questionId: question.id,
        question: question.question,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        explanation: question.explanation || ''
      });
    });

    // CORNER CASE FIX: Log validation warnings
    if (invalidAnswers.length > 0) {
      logger.warn(`Quiz validation warnings:\n${invalidAnswers.join('\n')}`);
    }

    const score = correctCount;
    const totalQuestions = questions.length;
    const percentage = totalQuestions > 0 ? correctCount / totalQuestions : 0;
    const passed = percentage >= this.QUIZ_PASS_THRESHOLD;

    return {
      score,
      totalQuestions,
      percentage,
      passed,
      results,
      validationWarnings: invalidAnswers.length > 0 ? invalidAnswers : undefined
    };
  }

  /**
   * Submit quiz and save results
   * UPDATED: Uses new schema with quiz_id and percentage fields
   */
  async submitQuiz(userId, moduleId, answers, questions) {
    try {
      // Grade the quiz
      const gradeResult = await this.gradeQuiz(moduleId, answers, questions);

      if (!gradeResult) {
        throw new Error('Unable to grade quiz for this module');
      }

      // Get quiz_id for this module
      const quizResult = await postgresService.pool.query(`
        SELECT id, max_attempts FROM quizzes
        WHERE module_id = $1 AND is_active = true
      `, [moduleId]);

      if (quizResult.rows.length === 0) {
        throw new Error('No active quiz found for this module');
      }

      const quiz = quizResult.rows[0];
      const quizId = quiz.id;

      // Get attempt number
      const attempts = await this.getQuizAttempts(userId, moduleId);
      const attemptNumber = attempts.length + 1;

      // Calculate percentage
      const percentage = gradeResult.percentage * 100; // Convert to percentage

      // Save to database with new schema
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
        userId,
        moduleId,
        quizId,
        attemptNumber,
        gradeResult.score,
        gradeResult.totalQuestions,
        percentage,
        gradeResult.passed,
        JSON.stringify({ answers, results: gradeResult.results })
      ]);

      // The database trigger will automatically mark module as completed if passed
      // But we also update here for immediate feedback
      if (gradeResult.passed) {
        await postgresService.pool.query(`
          UPDATE user_progress
          SET
            status = 'completed',
            progress_percentage = 100,
            completed_at = NOW(),
            quiz_taken = TRUE,
            quiz_passed = TRUE,
            quiz_score = $1,
            quiz_attempts_count = $2,
            last_activity_at = NOW()
          WHERE user_id = $3 AND module_id = $4
        `, [gradeResult.score, attemptNumber, userId, moduleId]);

        logger.info(`User ${userId} completed module ${moduleId} with quiz score ${gradeResult.score}/${gradeResult.totalQuestions}`);
      }

      return {
        ...gradeResult,
        attemptNumber,
        attemptsRemaining: quiz.max_attempts - attemptNumber
      };
    } catch (error) {
      logger.error('Error submitting quiz:', error);
      throw error;
    }
  }

  /**
   * Get quiz attempts for a user and module
   */
  async getQuizAttempts(userId, moduleId) {
    try {
      const result = await postgresService.query(`
        SELECT * FROM quiz_attempts
        WHERE user_id = $1 AND module_id = $2
        ORDER BY attempted_at DESC
      `, [userId, moduleId]);

      return result.rows;
    } catch (error) {
      logger.error('Error getting quiz attempts:', error);
      throw error;
    }
  }

  /**
   * Format quiz question for WhatsApp
   */
  formatQuestionForWhatsApp(questionNumber, totalQuestions, question) {
    return `*Question ${questionNumber}/${totalQuestions}*\n\n${question.question}\n\n${question.options.join('\n')}\n\n_Reply with A, B, C, or D_`;
  }

  /**
   * Format quiz results for WhatsApp
   */
  formatResultsForWhatsApp(results) {
    const { score, totalQuestions, percentage, passed, attemptNumber, attemptsRemaining } = results;

    let message = `*📊 Quiz Results - Attempt ${attemptNumber}*\n\n`;
    message += `Score: ${score}/${totalQuestions} (${Math.round(percentage * 100)}%)\n`;
    message += `Status: ${passed ? '✅ PASSED' : '❌ FAILED'}\n\n`;

    if (passed) {
      message += `*🎉 Congratulations!*\nYou have successfully completed Module 2: Classroom Management!\n\n`;
      message += `Your progress has been updated. You can now proceed to the next module.`;
    } else {
      message += `You need ${Math.ceil(this.QUIZ_PASS_THRESHOLD * totalQuestions)} or more correct answers to pass.\n\n`;
      if (attemptsRemaining > 0) {
        message += `You have ${attemptsRemaining} attempt(s) remaining. Review the material and try again!`;
      } else {
        message += `You have used all attempts. Please contact your instructor for assistance.`;
      }
    }

    return message;
  }
}

module.exports = new QuizService();
