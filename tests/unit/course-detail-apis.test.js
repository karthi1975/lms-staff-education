/**
 * Unit Tests for Course Detail APIs
 * Tests: GET /api/admin/courses/:id, GET /api/admin/courses/:id/modules, GET /api/admin/courses/:id/files
 */

const request = require('supertest');
const app = require('../../server');
const postgresService = require('../../services/database/postgres.service');

describe('Course Detail APIs', () => {
  let adminToken;
  let testCourseId;

  beforeAll(async () => {
    // Wait for services to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Login as admin to get token
    const loginResponse = await request(app)
      .post('/api/admin/login')
      .send({
        email: 'admin@school.edu',
        password: 'Admin123!'
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.success).toBe(true);
    expect(loginResponse.body.token).toBeDefined();
    adminToken = loginResponse.body.token;

    // Create a test course
    const courseResponse = await request(app)
      .post('/api/admin/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Test Course for Detail APIs',
        code: 'TEST-DETAIL-001',
        description: 'Test course for API testing',
        category: 'Testing',
        difficulty_level: 'beginner',
        duration_weeks: 4
      });

    expect(courseResponse.status).toBe(201);
    testCourseId = courseResponse.body.course_id;

    // Create test modules for the course
    await request(app)
      .post('/api/admin/modules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        course_id: testCourseId,
        title: 'Module 1: Introduction',
        description: 'First module',
        sequence_order: 1
      });

    await request(app)
      .post('/api/admin/modules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        course_id: testCourseId,
        title: 'Module 2: Advanced Topics',
        description: 'Second module',
        sequence_order: 2
      });
  });

  afterAll(async () => {
    // Clean up test data
    if (testCourseId) {
      await postgresService.pool.query('DELETE FROM modules WHERE course_id = $1', [testCourseId]);
      await postgresService.pool.query('DELETE FROM courses WHERE id = $1', [testCourseId]);
    }
  });

  describe('GET /api/admin/courses/:courseId', () => {
    it('should return course details', async () => {
      const response = await request(app)
        .get(`/api/admin/courses/${testCourseId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.course).toBeDefined();
      expect(response.body.course.id).toBe(testCourseId);
      expect(response.body.course.title).toBe('Test Course for Detail APIs');
      expect(response.body.course.code).toBe('TEST-DETAIL-001');
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .get(`/api/admin/courses/${testCourseId}`);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent course', async () => {
      const response = await request(app)
        .get('/api/admin/courses/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/admin/courses/:courseId/modules', () => {
    it('should return modules for a course', async () => {
      const response = await request(app)
        .get(`/api/admin/courses/${testCourseId}/modules`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.modules).toBeDefined();
      expect(Array.isArray(response.body.modules)).toBe(true);
      expect(response.body.modules.length).toBeGreaterThanOrEqual(2);

      // Verify module structure
      const module = response.body.modules[0];
      expect(module.id).toBeDefined();
      expect(module.title).toBeDefined();
      expect(module.module_name).toBeDefined();
      expect(module.module_number).toBeDefined();
      expect(module.sequence_order).toBeDefined();
      expect(module.content_count).toBeDefined();
      expect(module.description).toBeDefined();

      // Verify modules are ordered by sequence_order
      expect(response.body.modules[0].sequence_order).toBe(1);
      expect(response.body.modules[1].sequence_order).toBe(2);
    });

    it('should return empty array for course with no modules', async () => {
      // Create a course without modules
      const courseResponse = await request(app)
        .post('/api/admin/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Empty Course',
          code: 'EMPTY-001',
          description: 'Course without modules'
        });

      const emptyCourseId = courseResponse.body.course_id;

      const response = await request(app)
        .get(`/api/admin/courses/${emptyCourseId}/modules`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.modules).toEqual([]);

      // Clean up
      await postgresService.pool.query('DELETE FROM courses WHERE id = $1', [emptyCourseId]);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .get(`/api/admin/courses/${testCourseId}/modules`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/admin/courses/:courseId/files', () => {
    it('should return files for a course', async () => {
      const response = await request(app)
        .get(`/api/admin/courses/${testCourseId}/files`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.files).toBeDefined();
      expect(Array.isArray(response.body.files)).toBe(true);
      expect(response.body.statusCounts).toBeDefined();
      expect(response.body.total).toBeDefined();

      // Verify statusCounts structure
      expect(response.body.statusCounts).toHaveProperty('uploaded');
      expect(response.body.statusCounts).toHaveProperty('processing');
      expect(response.body.statusCounts).toHaveProperty('completed');
      expect(response.body.statusCounts).toHaveProperty('failed');
      expect(response.body.statusCounts).toHaveProperty('pending');
    });

    it('should return empty files array for new course', async () => {
      const response = await request(app)
        .get(`/api/admin/courses/${testCourseId}/files`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.files).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .get(`/api/admin/courses/${testCourseId}/files`);

      expect(response.status).toBe(401);
    });
  });
});
