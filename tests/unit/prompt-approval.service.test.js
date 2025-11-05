/**
 * Unit Tests for Prompt Approval Service (Regional Access)
 * Tests regional admin prompt approval workflow with defense-in-depth security
 */

const PromptApprovalService = require('../../services/prompt-approval.service');

// Mock PostgreSQL service
const mockPostgresService = {
  query: jest.fn()
};

describe('PromptApprovalService - Regional Access', () => {
  let service;

  beforeEach(() => {
    service = new PromptApprovalService(mockPostgresService);
    jest.clearAllMocks();
  });

  describe('getAdminRegions()', () => {
    it('should return array of region IDs for regional admin', async () => {
      const adminId = 2;
      mockPostgresService.query.mockResolvedValue({
        rows: [
          { region_id: 1 },
          { region_id: 2 }
        ]
      });

      const result = await service.getAdminRegions(adminId);

      expect(result).toEqual([1, 2]);
      expect(mockPostgresService.query).toHaveBeenCalledWith(
        'SELECT region_id FROM admin_regions WHERE admin_user_id = $1',
        [adminId]
      );
    });

    it('should return empty array if admin has no regions', async () => {
      const adminId = 3;
      mockPostgresService.query.mockResolvedValue({ rows: [] });

      const result = await service.getAdminRegions(adminId);

      expect(result).toEqual([]);
    });

    it('should return empty array on database error', async () => {
      const adminId = 4;
      mockPostgresService.query.mockRejectedValue(new Error('DB connection failed'));

      const result = await service.getAdminRegions(adminId);

      expect(result).toEqual([]);
    });
  });

  describe('canAdminAccessCourse()', () => {
    it('should return true for Super Admin', async () => {
      const superAdminId = 1;
      const courseId = 10;

      // Mock verifySuperAdmin
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ role_id: 1 }]
      });

      const result = await service.canAdminAccessCourse(superAdminId, courseId);

      expect(result).toBe(true);
    });

    it('should return true if course is in admin\'s assigned regions', async () => {
      const adminId = 2;
      const courseId = 10;

      // Mock verifySuperAdmin (not super admin)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ role_id: 2 }]
      });

      // Mock course region query
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ region_id: 1 }]
      });

      // Mock admin regions query
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ region_id: 1 }, { region_id: 2 }]
      });

      const result = await service.canAdminAccessCourse(adminId, courseId);

      expect(result).toBe(true);
    });

    it('should return false if course is NOT in admin\'s assigned regions', async () => {
      const adminId = 2;
      const courseId = 10;

      // Mock verifySuperAdmin (not super admin)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ role_id: 2 }]
      });

      // Mock course region query (course in region 3)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ region_id: 3 }]
      });

      // Mock admin regions query (admin has regions 1, 2)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ region_id: 1 }, { region_id: 2 }]
      });

      const result = await service.canAdminAccessCourse(adminId, courseId);

      expect(result).toBe(false);
    });

    it('should return false if course does not exist', async () => {
      const adminId = 2;
      const courseId = 999;

      // Mock verifySuperAdmin (not super admin)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ role_id: 2 }]
      });

      // Mock course query (not found)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: []
      });

      const result = await service.canAdminAccessCourse(adminId, courseId);

      expect(result).toBe(false);
    });

    it('should return false if course has no region assigned', async () => {
      const adminId = 2;
      const courseId = 10;

      // Mock verifySuperAdmin (not super admin)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ role_id: 2 }]
      });

      // Mock course query (no region_id)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ region_id: null }]
      });

      const result = await service.canAdminAccessCourse(adminId, courseId);

      expect(result).toBe(false);
    });
  });

  describe('getAccessibleCourses()', () => {
    it('should return all courses for Super Admin', async () => {
      const superAdminId = 1;

      // Mock verifySuperAdmin
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ role_id: 1 }]
      });

      // Mock all courses query
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [
          { id: 1, title: 'Course 1', code: 'C1', region_id: 1 },
          { id: 2, title: 'Course 2', code: 'C2', region_id: 2 },
          { id: 3, title: 'Course 3', code: 'C3', region_id: 3 }
        ]
      });

      const result = await service.getAccessibleCourses(superAdminId);

      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('Course 1');
    });

    it('should return only region-specific courses for Regional Admin', async () => {
      const adminId = 2;

      // Mock verifySuperAdmin (not super admin)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ role_id: 2 }]
      });

      // Mock admin regions
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ region_id: 1 }, { region_id: 2 }]
      });

      // Mock courses in admin's regions
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [
          { id: 1, title: 'Course 1', code: 'C1', region_id: 1 },
          { id: 2, title: 'Course 2', code: 'C2', region_id: 2 }
        ]
      });

      const result = await service.getAccessibleCourses(adminId);

      expect(result).toHaveLength(2);
      expect(result[0].region_id).toBe(1);
      expect(result[1].region_id).toBe(2);
    });

    it('should return empty array if Regional Admin has no regions', async () => {
      const adminId = 3;

      // Mock verifySuperAdmin (not super admin)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ role_id: 2 }]
      });

      // Mock admin regions (none)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: []
      });

      const result = await service.getAccessibleCourses(adminId);

      expect(result).toEqual([]);
    });
  });

  describe('getDefaultPrompt()', () => {
    it('should return current regular prompt for course', async () => {
      const courseId = 1;
      const mode = 'regular';

      mockPostgresService.query.mockResolvedValue({
        rows: [{
          course_id: 1,
          prompt: 'You are a helpful teaching assistant.',
          greeting: 'Hello!',
          help_text: 'I provide direct answers.',
          version: 3,
          last_approved_at: '2025-11-01T10:00:00Z',
          last_approved_by: 1
        }]
      });

      const result = await service.getDefaultPrompt(courseId, mode);

      expect(result.success).toBe(true);
      expect(result.courseId).toBe(1);
      expect(result.mode).toBe('regular');
      expect(result.prompt).toBe('You are a helpful teaching assistant.');
      expect(result.version).toBe(3);
    });

    it('should return current socratic prompt for course', async () => {
      const courseId = 1;
      const mode = 'socratic';

      mockPostgresService.query.mockResolvedValue({
        rows: [{
          course_id: 1,
          prompt: 'You are a Socratic teaching assistant.',
          greeting: 'Let\'s discover together!',
          help_text: 'I guide through questions.',
          version: 2,
          last_approved_at: '2025-11-01T10:00:00Z',
          last_approved_by: 1
        }]
      });

      const result = await service.getDefaultPrompt(courseId, mode);

      expect(result.success).toBe(true);
      expect(result.mode).toBe('socratic');
      expect(result.prompt).toBe('You are a Socratic teaching assistant.');
    });

    it('should throw error if invalid mode provided', async () => {
      const courseId = 1;
      const mode = 'invalid';

      await expect(service.getDefaultPrompt(courseId, mode))
        .rejects
        .toThrow('Invalid mode: invalid');
    });

    it('should throw error if course has no bot config', async () => {
      const courseId = 999;
      const mode = 'regular';

      mockPostgresService.query.mockResolvedValue({
        rows: []
      });

      await expect(service.getDefaultPrompt(courseId, mode))
        .rejects
        .toThrow('No bot configuration found for course 999');
    });
  });

  describe('createDraftRequest() - Regional Access', () => {
    it('should block Regional Admin from creating request for unauthorized course', async () => {
      const adminId = 2;
      const courseId = 10;

      // Mock verifySuperAdmin (not super admin)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ role_id: 2 }]
      });

      // Mock course region query (course in region 3)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ region_id: 3 }]
      });

      // Mock admin regions query (admin has regions 1, 2 only)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ region_id: 1 }, { region_id: 2 }]
      });

      await expect(service.createDraftRequest({
        courseId: courseId,
        mode: 'regular',
        newPrompt: 'This is a new prompt that meets the minimum length requirement for validation.',
        changeReason: 'This change is needed to improve clarity.',
        changeDescription: 'Updated for better student engagement',
        requestedBy: adminId
      })).rejects.toThrow('Access denied. You do not have permission to modify this course.');
    });

    it('should allow Regional Admin to create request for authorized course', async () => {
      const adminId = 2;
      const courseId = 10;

      // Mock verifySuperAdmin (not super admin)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ role_id: 2 }]
      });

      // Mock course region query (course in region 1)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ region_id: 1 }]
      });

      // Mock admin regions query (admin has region 1)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ region_id: 1 }]
      });

      // Mock course exists check
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ id: 10, title: 'Test Course' }]
      });

      // Mock current version check
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ current_version: 2 }]
      });

      // Mock insert request
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          course_id: courseId,
          mode: 'regular',
          new_prompt: 'This is a new prompt that meets the minimum length requirement for validation.',
          change_reason: 'This change is needed to improve clarity.',
          change_description: 'Updated for better student engagement',
          requested_by: adminId,
          status: 'draft',
          version_number: 3,
          replaces_version: 2,
          created_at: new Date()
        }]
      });

      const result = await service.createDraftRequest({
        courseId: courseId,
        mode: 'regular',
        newPrompt: 'This is a new prompt that meets the minimum length requirement for validation.',
        changeReason: 'This change is needed to improve clarity.',
        changeDescription: 'Updated for better student engagement',
        requestedBy: adminId
      });

      expect(result.success).toBe(true);
      expect(result.request.courseId).toBe(courseId);
      expect(result.request.status).toBe('draft');
    });
  });

  describe('getPendingApprovals() - Regional Filtering', () => {
    it('should return all pending requests for Super Admin', async () => {
      const superAdminId = 1;

      // Mock verifySuperAdmin
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ role_id: 1 }]
      });

      // Mock pending requests query
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1, course_id: 10, course_title: 'Course 1', course_code: 'C1',
            course_region_id: 1, status: 'pending_approval', mode: 'regular',
            requester_name: 'Admin 2', requester_email: 'admin2@test.com',
            hours_pending: 5.5, requested_at: new Date()
          },
          {
            id: 2, course_id: 20, course_title: 'Course 2', course_code: 'C2',
            course_region_id: 3, status: 'pending_approval', mode: 'socratic',
            requester_name: 'Admin 3', requester_email: 'admin3@test.com',
            hours_pending: 2.3, requested_at: new Date()
          }
        ]
      });

      const result = await service.getPendingApprovals(superAdminId);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(result.requests).toHaveLength(2);
    });

    it('should filter pending requests by region for Regional Admin', async () => {
      const adminId = 2;

      // Mock verifySuperAdmin (not super admin)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ role_id: 2 }]
      });

      // Mock admin regions
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ region_id: 1 }]
      });

      // Mock pending requests query (filtered by region)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1, course_id: 10, course_title: 'Course 1', course_code: 'C1',
            course_region_id: 1, status: 'pending_approval', mode: 'regular',
            requester_name: 'Admin 2', requester_email: 'admin2@test.com',
            hours_pending: 5.5, requested_at: new Date()
          }
        ]
      });

      const result = await service.getPendingApprovals(adminId);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(result.requests[0].courseRegionId).toBe(1);
    });

    it('should return empty array if Regional Admin has no regions', async () => {
      const adminId = 3;

      // Mock verifySuperAdmin (not super admin)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ role_id: 2 }]
      });

      // Mock admin regions (none)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: []
      });

      const result = await service.getPendingApprovals(adminId);

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
      expect(result.requests).toEqual([]);
    });
  });

  describe('getMyRequests() - Regional Filtering', () => {
    it('should return all requests for Super Admin', async () => {
      const superAdminId = 1;

      // Mock verifySuperAdmin
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ role_id: 1 }]
      });

      // Mock my requests query
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1, course_id: 10, course_title: 'Course 1', course_code: 'C1',
            course_region_id: 1, status: 'approved', mode: 'regular',
            reviewer_name: 'Super Admin', reviewer_email: 'super@test.com',
            created_at: new Date()
          }
        ]
      });

      const result = await service.getMyRequests(superAdminId);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });

    it('should filter requests by accessible courses for Regional Admin', async () => {
      const adminId = 2;

      // Mock verifySuperAdmin (not super admin)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ role_id: 2 }]
      });

      // Mock admin regions
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [{ region_id: 1 }, { region_id: 2 }]
      });

      // Mock my requests query (filtered by region)
      mockPostgresService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1, course_id: 10, course_title: 'Course 1', course_code: 'C1',
            course_region_id: 1, status: 'draft', mode: 'regular',
            reviewer_name: null, reviewer_email: null,
            created_at: new Date()
          },
          {
            id: 2, course_id: 20, course_title: 'Course 2', course_code: 'C2',
            course_region_id: 2, status: 'pending_approval', mode: 'socratic',
            reviewer_name: null, reviewer_email: null,
            created_at: new Date()
          }
        ]
      });

      const result = await service.getMyRequests(adminId);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(result.requests[0].courseRegionId).toBe(1);
      expect(result.requests[1].courseRegionId).toBe(2);
    });
  });
});
