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
    this.MAX_ATTEMPTS = 2;
  }

  /**
   * Start a quiz for a user
   */
  async startQuiz(userId, moduleId) {
    try {
      // Get existing attempts
      const attempts = await this.getQuizAttempts(userId, moduleId);

      if (attempts.length >= this.MAX_ATTEMPTS) {
        return {
          success: false,
          message: `You have already used all ${this.MAX_ATTEMPTS} attempts for this quiz.`,
          attemptsRemaining: 0
        };
      }

      // Return quiz questions (for module 2)
      if (moduleId === 2) {
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
        message: 'Quiz not available for this module yet.'
      };
    } catch (error) {
      logger.error('Error starting quiz:', error);
      throw error;
    }
  }

  /**
   * Grade quiz answers
   */
  gradeQuiz(moduleId, answers) {
    if (moduleId !== 2) {
      return null;
    }

    const results = [];
    let correctCount = 0;

    this.module2Questions.forEach((question, index) => {
      const userAnswer = answers[index];
      const isCorrect = userAnswer === question.correctAnswer;

      if (isCorrect) {
        correctCount++;
      }

      results.push({
        questionId: question.id,
        question: question.question,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        explanation: question.explanation
      });
    });

    const score = correctCount;
    const totalQuestions = this.module2Questions.length;
    const percentage = correctCount / totalQuestions;
    const passed = percentage >= this.QUIZ_PASS_THRESHOLD;

    return {
      score,
      totalQuestions,
      percentage,
      passed,
      results
    };
  }

  /**
   * Submit quiz and save results
   */
  async submitQuiz(userId, moduleId, answers) {
    try {
      // Grade the quiz
      const gradeResult = this.gradeQuiz(moduleId, answers);

      if (!gradeResult) {
        throw new Error('Unable to grade quiz for this module');
      }

      // Get attempt number
      const attempts = await this.getQuizAttempts(userId, moduleId);
      const attemptNumber = attempts.length + 1;

      // Save to database
      await postgresService.query(`
        INSERT INTO quiz_attempts (
          user_id, module_id, attempt_number, score, total_questions, passed, answers, attempted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        userId,
        moduleId,
        attemptNumber,
        gradeResult.score,
        gradeResult.totalQuestions,
        gradeResult.passed,
        JSON.stringify({ answers, results: gradeResult.results })
      ]);

      // If passed, update user progress to completed
      if (gradeResult.passed) {
        await postgresService.query(`
          UPDATE user_progress
          SET
            status = 'completed',
            progress_percentage = 100,
            completed_at = NOW(),
            last_activity_at = NOW()
          WHERE user_id = $1 AND module_id = $2
        `, [userId, moduleId]);
      }

      return {
        ...gradeResult,
        attemptNumber,
        attemptsRemaining: this.MAX_ATTEMPTS - attemptNumber
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
