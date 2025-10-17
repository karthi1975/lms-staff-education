/**
 * Unit tests for quiz upload endpoint
 * Tests the POST /api/admin/modules/:moduleId/quiz/upload endpoint
 */

const request = require('supertest');
const express = require('express');
const adminRoutes = require('../../routes/admin.routes');
const authMiddleware = require('../../middleware/auth.middleware');

// Mock the database service
jest.mock('../../services/database/postgres.service', () => ({
  pool: {
    query: jest.fn()
  }
}));

// Mock the logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock auth middleware to bypass authentication
jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 1, email: 'admin@test.com', role: 'admin' };
    next();
  }),
  requireRole: jest.fn(() => (req, res, next) => next())
}));

describe('Quiz Upload Endpoint Tests', () => {
  let app;
  let mockPool;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);

    mockPool = require('../../services/database/postgres.service').pool;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/admin/modules/:moduleId/quiz/upload', () => {

    test('should successfully upload quiz questions for a module', async () => {
      const moduleId = 1;
      const mockQuestions = [
        {
          question: 'What is 2+2?',
          options: ['3', '4', '5', '6'],
          correctAnswer: 1,
          explanation: 'Basic math'
        },
        {
          question: 'What is the capital of France?',
          options: ['London', 'Paris', 'Berlin'],
          correctAnswer: 1
        }
      ];

      // Mock module exists check
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: moduleId }]
      });

      // Mock quiz check (no existing quiz)
      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      // Mock quiz creation
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 10 }]
      });

      // Mock question insertions
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 2 }] });

      const response = await request(app)
        .post(`/api/admin/modules/${moduleId}/quiz/upload`)
        .send({ questions: mockQuestions })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Quiz uploaded successfully with 2 questions');
      expect(response.body.data.quizId).toBe(10);
      expect(response.body.data.moduleId).toBe(moduleId);
      expect(response.body.data.questionCount).toBe(2);
      expect(response.body.data.questions).toHaveLength(2);

      // Verify quiz creation was called with correct parameters
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO quizzes'),
        expect.arrayContaining([
          String(moduleId),  // moduleId from params is string
          `Module ${moduleId} Quiz`,
          30,  // time_limit_minutes
          70,  // pass_percentage
          999  // max_attempts
        ])
      );

      // Verify question insertions included module_id
      const questionInsertCalls = mockPool.query.mock.calls.filter(call =>
        call[0].includes('INSERT INTO quiz_questions')
      );

      expect(questionInsertCalls).toHaveLength(2);

      // Check first question insert
      expect(questionInsertCalls[0][1]).toEqual([
        String(moduleId),   // module_id from params is string
        10,                 // quiz_id
        'What is 2+2?',
        'multichoice',
        JSON.stringify(['3', '4', '5', '6']),
        '1',
        'Basic math',
        1.0
      ]);

      // Check second question insert
      expect(questionInsertCalls[1][1]).toEqual([
        String(moduleId),   // module_id from params is string
        10,                 // quiz_id
        'What is the capital of France?',
        'multichoice',
        JSON.stringify(['London', 'Paris', 'Berlin']),
        '1',
        null,               // no explanation
        1.0
      ]);
    });

    test('should update existing quiz and delete old questions', async () => {
      const moduleId = 2;
      const existingQuizId = 20;
      const mockQuestions = [
        {
          question: 'New question?',
          options: ['A', 'B'],
          correctAnswer: 0
        }
      ];

      // Mock module exists
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: moduleId }]
      });

      // Mock existing quiz found
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: existingQuizId }]
      });

      // Mock delete old questions
      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      // Mock question insertion
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 100 }] });

      const response = await request(app)
        .post(`/api/admin/modules/${moduleId}/quiz/upload`)
        .send({ questions: mockQuestions })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.quizId).toBe(existingQuizId);

      // Verify old questions were deleted
      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM quiz_questions WHERE quiz_id = $1',
        [existingQuizId]
      );
    });

    test('should return 400 when questions array is missing', async () => {
      const response = await request(app)
        .post('/api/admin/modules/1/quiz/upload')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Questions array is required and must not be empty');
    });

    test('should return 400 when questions array is empty', async () => {
      const response = await request(app)
        .post('/api/admin/modules/1/quiz/upload')
        .send({ questions: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Questions array is required and must not be empty');
    });

    test('should return 400 when question is missing required fields', async () => {
      const invalidQuestions = [
        {
          // Missing question text
          options: ['A', 'B'],
          correctAnswer: 0
        }
      ];

      const response = await request(app)
        .post('/api/admin/modules/1/quiz/upload')
        .send({ questions: invalidQuestions })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid format');
    });

    test('should return 400 when options array is missing', async () => {
      const invalidQuestions = [
        {
          question: 'Test?',
          // Missing options
          correctAnswer: 0
        }
      ];

      const response = await request(app)
        .post('/api/admin/modules/1/quiz/upload')
        .send({ questions: invalidQuestions })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid format');
    });

    test('should return 400 when question has too few options', async () => {
      const invalidQuestions = [
        {
          question: 'Test?',
          options: ['Only one'],  // Need at least 2
          correctAnswer: 0
        }
      ];

      const response = await request(app)
        .post('/api/admin/modules/1/quiz/upload')
        .send({ questions: invalidQuestions })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Must have 2-4 options');
    });

    test('should return 400 when question has too many options', async () => {
      const invalidQuestions = [
        {
          question: 'Test?',
          options: ['A', 'B', 'C', 'D', 'E'],  // Max is 4
          correctAnswer: 0
        }
      ];

      const response = await request(app)
        .post('/api/admin/modules/1/quiz/upload')
        .send({ questions: invalidQuestions })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Must have 2-4 options');
    });

    test('should return 400 when correctAnswer is invalid', async () => {
      const invalidQuestions = [
        {
          question: 'Test?',
          options: ['A', 'B', 'C'],
          correctAnswer: 5  // Out of range
        }
      ];

      const response = await request(app)
        .post('/api/admin/modules/1/quiz/upload')
        .send({ questions: invalidQuestions })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid correctAnswer index');
    });

    test('should return 400 when correctAnswer is negative', async () => {
      const invalidQuestions = [
        {
          question: 'Test?',
          options: ['A', 'B'],
          correctAnswer: -1
        }
      ];

      const response = await request(app)
        .post('/api/admin/modules/1/quiz/upload')
        .send({ questions: invalidQuestions })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid correctAnswer index');
    });

    test('should return 404 when module does not exist', async () => {
      const moduleId = 999;

      // Mock module not found
      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      const mockQuestions = [
        {
          question: 'Test?',
          options: ['A', 'B'],
          correctAnswer: 0
        }
      ];

      const response = await request(app)
        .post(`/api/admin/modules/${moduleId}/quiz/upload`)
        .send({ questions: mockQuestions })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Module not found');
    });

    test('should handle database errors gracefully', async () => {
      const moduleId = 1;

      // Mock database error
      mockPool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const mockQuestions = [
        {
          question: 'Test?',
          options: ['A', 'B'],
          correctAnswer: 0
        }
      ];

      const response = await request(app)
        .post(`/api/admin/modules/${moduleId}/quiz/upload`)
        .send({ questions: mockQuestions })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database connection failed');
    });

    test('should handle multiple questions with varying option counts', async () => {
      const moduleId = 3;
      const mockQuestions = [
        {
          question: 'True or False?',
          options: ['True', 'False'],
          correctAnswer: 0
        },
        {
          question: 'Multiple choice?',
          options: ['A', 'B', 'C'],
          correctAnswer: 1
        },
        {
          question: 'Four options?',
          options: ['W', 'X', 'Y', 'Z'],
          correctAnswer: 3
        }
      ];

      // Mock module exists
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: moduleId }]
      });

      // Mock no existing quiz
      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      // Mock quiz creation
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 30 }]
      });

      // Mock question insertions
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 2 }] });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 3 }] });

      const response = await request(app)
        .post(`/api/admin/modules/${moduleId}/quiz/upload`)
        .send({ questions: mockQuestions })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.questionCount).toBe(3);
      expect(response.body.data.questions[0].optionCount).toBe(2);
      expect(response.body.data.questions[1].optionCount).toBe(3);
      expect(response.body.data.questions[2].optionCount).toBe(4);
    });

    test('should correctly stringify options as JSON', async () => {
      const moduleId = 1;
      const mockQuestions = [
        {
          question: 'Test with special chars?',
          options: ['Option "A"', 'Option \'B\'', 'Option & C'],
          correctAnswer: 0
        }
      ];

      // Mock successful flow
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: moduleId }] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 10 }] });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await request(app)
        .post(`/api/admin/modules/${moduleId}/quiz/upload`)
        .send({ questions: mockQuestions })
        .expect(200);

      // Verify options were properly stringified
      const questionInsertCall = mockPool.query.mock.calls.find(call =>
        call[0].includes('INSERT INTO quiz_questions')
      );

      expect(questionInsertCall[1][4]).toBe(
        JSON.stringify(['Option "A"', 'Option \'B\'', 'Option & C'])
      );
    });

    test('should convert correctAnswer to string', async () => {
      const moduleId = 1;
      const mockQuestions = [
        {
          question: 'Test?',
          options: ['A', 'B', 'C'],
          correctAnswer: 2  // Number
        }
      ];

      // Mock successful flow
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: moduleId }] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 10 }] });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await request(app)
        .post(`/api/admin/modules/${moduleId}/quiz/upload`)
        .send({ questions: mockQuestions })
        .expect(200);

      // Verify correctAnswer was converted to string
      const questionInsertCall = mockPool.query.mock.calls.find(call =>
        call[0].includes('INSERT INTO quiz_questions')
      );

      expect(questionInsertCall[1][5]).toBe('2');
      expect(typeof questionInsertCall[1][5]).toBe('string');
    });
  });
});
