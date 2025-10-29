/**
 * Comprehensive Unit Tests for File Upload and Processing System
 *
 * Covers Tasks 1-4:
 * - Task 1: Upload endpoint stores files only (status='uploaded')
 * - Task 2: Process files endpoint with background processing
 * - Task 3: File list API with status counts and grouping
 * - Task 4: UI integration ready (tested via API responses)
 */

const request = require('supertest');
const express = require('express');
const simpleUploadRoutes = require('../../routes/simple-upload.routes');
const fileProcessingRoutes = require('../../routes/file-processing.routes');
const fileListRoutes = require('../../routes/file-list.routes');
const authMiddleware = require('../../middleware/auth.middleware');

// Mock the database service
jest.mock('../../services/database/postgres.service', () => ({
  pool: {
    query: jest.fn()
  }
}));

// Mock the document processor
jest.mock('../../services/document-processor.service', () => ({
  processDocument: jest.fn()
}));

// Mock the logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock auth middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 1, email: 'admin@test.com', role: 'admin' };
    next();
  }),
  requireRole: jest.fn(() => (req, res, next) => next())
}));

// Mock multer for file uploads
jest.mock('multer', () => {
  const multer = () => ({
    array: () => (req, res, next) => {
      req.files = req.body.mockFiles || [];
      next();
    }
  });
  multer.diskStorage = () => {};
  return multer;
});

// Mock fs for file operations
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('File Upload and Processing Tests', () => {
  let app;
  let mockPool;
  let mockDocumentProcessor;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin', simpleUploadRoutes);
    app.use('/api/admin', fileProcessingRoutes);
    app.use('/api/admin', fileListRoutes);

    mockPool = require('../../services/database/postgres.service').pool;
    mockDocumentProcessor = require('../../services/document-processor.service');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/admin/courses/:courseId/simple-upload', () => {

    test('should upload files with status="uploaded" (not process them)', async () => {
      const courseId = 1;
      const mockFiles = [
        {
          filename: 'doc1.pdf',
          originalname: 'Document 1.pdf',
          path: '/uploads/doc1.pdf',
          mimetype: 'application/pdf',
          size: 1024000
        },
        {
          filename: 'doc2.pdf',
          originalname: 'Document 2.pdf',
          path: '/uploads/doc2.pdf',
          mimetype: 'application/pdf',
          size: 2048000
        }
      ];

      // Mock database insertions
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, file_name: 'doc1.pdf', file_path: '/uploads/doc1.pdf' }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 2, file_name: 'doc2.pdf', file_path: '/uploads/doc2.pdf' }]
        });

      const response = await request(app)
        .post(`/api/admin/courses/${courseId}/simple-upload`)
        .send({ mockFiles })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.total_files).toBe(2);
      expect(response.body.message).toContain('Click "Process Files"');
      expect(response.body.files).toHaveLength(2);

      // Verify files were inserted with status='uploaded'
      expect(mockPool.query).toHaveBeenCalledTimes(2);

      const firstInsertCall = mockPool.query.mock.calls[0];
      expect(firstInsertCall[0]).toContain('INSERT INTO course_content');
      expect(firstInsertCall[0]).toContain("'uploaded'");
      expect(firstInsertCall[1]).toEqual([
        courseId.toString(), // Route params are strings
        'doc1.pdf',
        'Document 1.pdf',
        '/uploads/doc1.pdf',
        'application/pdf',
        1024000
      ]);

      // Verify document processor was NOT called
      expect(mockDocumentProcessor.processDocument).not.toHaveBeenCalled();
    });

    test('should return 400 when no files provided', async () => {
      const response = await request(app)
        .post('/api/admin/courses/1/simple-upload')
        .send({ mockFiles: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No files provided');
    });

    test('should handle database errors during upload', async () => {
      const mockFiles = [
        {
          filename: 'doc1.pdf',
          originalname: 'Document 1.pdf',
          path: '/uploads/doc1.pdf',
          mimetype: 'application/pdf',
          size: 1024000
        }
      ];

      mockPool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/admin/courses/1/simple-upload')
        .send({ mockFiles })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('POST /api/admin/courses/:courseId/process-files', () => {

    test('should query database for uploaded files and start processing', async () => {
      const courseId = 1;
      const uploadedFiles = [
        {
          id: 1,
          course_id: courseId,
          file_name: 'doc1.pdf',
          original_name: 'Document 1.pdf',
          file_path: '/uploads/doc1.pdf',
          file_type: 'application/pdf',
          file_size: 1024000
        },
        {
          id: 2,
          course_id: courseId,
          file_name: 'doc2.pdf',
          original_name: 'Document 2.pdf',
          file_path: '/uploads/doc2.pdf',
          file_type: 'application/pdf',
          file_size: 2048000
        }
      ];

      // Mock database query for uploaded files
      mockPool.query.mockResolvedValueOnce({
        rows: uploadedFiles
      });

      const response = await request(app)
        .post(`/api/admin/courses/${courseId}/process-files`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.total_files).toBe(2);
      expect(response.body.message).toBe('Processing started in background');
      expect(response.body.job_id).toBeDefined();
      expect(response.body.estimated_minutes).toBe(10); // 2 files * 5 min

      // Verify database was queried for uploaded files
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE course_id = $1 AND processing_status = 'uploaded'"),
        [courseId.toString()]
      );
    });

    test('should return 400 when no uploaded files found', async () => {
      const courseId = 1;

      // Mock empty result
      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .post(`/api/admin/courses/${courseId}/process-files`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No uploaded files found for processing');
    });

    test('should handle database errors when querying files', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/admin/courses/1/process-files')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database connection failed');
    });
  });

  describe('GET /api/admin/courses/:courseId/processing-status/:jobId', () => {

    test('should return job status for valid job ID', async () => {
      // First, start a processing job to create the job status
      const courseId = 1;
      const uploadedFiles = [
        {
          id: 1,
          course_id: courseId,
          file_name: 'doc1.pdf',
          original_name: 'Document 1.pdf',
          file_path: '/uploads/doc1.pdf',
          file_type: 'application/pdf',
          file_size: 1024000
        }
      ];

      // Mock query for uploaded files
      mockPool.query.mockResolvedValueOnce({
        rows: uploadedFiles
      });

      const processResponse = await request(app)
        .post(`/api/admin/courses/${courseId}/process-files`)
        .expect(200);

      const jobId = processResponse.body.job_id;

      // Check the status immediately (before background processing completes)
      const statusResponse = await request(app)
        .get(`/api/admin/courses/${courseId}/processing-status/${jobId}`)
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.job_id).toBe(jobId);
      // Status could be 'processing', 'completed', or 'completed_with_errors' depending on timing
      expect(['processing', 'completed', 'completed_with_errors']).toContain(statusResponse.body.status);
      expect(statusResponse.body.total_files).toBe(1);
      expect(statusResponse.body.processed_files).toBeGreaterThanOrEqual(0);
      expect(statusResponse.body.progress).toBeGreaterThanOrEqual(0);
    });

    test('should return 404 for invalid job ID', async () => {
      const response = await request(app)
        .get('/api/admin/courses/1/processing-status/invalid-job-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Processing job not found');
    });
  });

  describe('Background Processing Function', () => {

    test('should update file status to "processing" before starting', async () => {
      const courseId = 1;
      const uploadedFiles = [
        {
          id: 1,
          course_id: courseId,
          file_name: 'doc1.pdf',
          original_name: 'Document 1.pdf',
          file_path: '/uploads/doc1.pdf',
          file_type: 'application/pdf',
          file_size: 1024000
        }
      ];

      // Mock query for uploaded files
      mockPool.query.mockResolvedValueOnce({
        rows: uploadedFiles
      });

      // Mock status update to 'processing'
      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      // Mock document processor
      mockDocumentProcessor.processDocument.mockResolvedValueOnce({
        chunks: [{ text: 'chunk1' }, { text: 'chunk2' }]
      });

      // Mock status update to 'completed'
      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      await request(app)
        .post(`/api/admin/courses/${courseId}/process-files`)
        .expect(200);

      // Wait for background processing to start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify status was updated to 'processing'
      const processingUpdateCalls = mockPool.query.mock.calls.filter(call =>
        call[0].includes("processing_status = 'processing'")
      );

      expect(processingUpdateCalls.length).toBeGreaterThan(0);
    });

    test('should update file status to "completed" after successful processing', async () => {
      const courseId = 1;
      const uploadedFiles = [
        {
          id: 1,
          course_id: courseId,
          file_name: 'doc1.pdf',
          original_name: 'Document 1.pdf',
          file_path: '/uploads/doc1.pdf',
          file_type: 'application/pdf',
          file_size: 1024000
        }
      ];

      // Mock query for uploaded files
      mockPool.query.mockResolvedValueOnce({
        rows: uploadedFiles
      });

      // Mock status update to 'processing'
      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      // Mock successful document processing
      mockDocumentProcessor.processDocument.mockResolvedValueOnce({
        chunks: [{ text: 'chunk1' }, { text: 'chunk2' }, { text: 'chunk3' }]
      });

      // Mock status update to 'completed'
      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      await request(app)
        .post(`/api/admin/courses/${courseId}/process-files`)
        .expect(200);

      // Wait for background processing to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify status was updated to 'completed' with chunk count
      const completedUpdateCalls = mockPool.query.mock.calls.filter(call =>
        call[0].includes("processing_status = 'completed'")
      );

      expect(completedUpdateCalls.length).toBeGreaterThan(0);

      if (completedUpdateCalls.length > 0) {
        const completedCall = completedUpdateCalls[0];
        expect(completedCall[1]).toEqual([3, 1]); // 3 chunks, file id 1
      }
    });

    test('should update file status to "failed" on processing error', async () => {
      const courseId = 1;
      const uploadedFiles = [
        {
          id: 1,
          course_id: courseId,
          file_name: 'doc1.pdf',
          original_name: 'Document 1.pdf',
          file_path: '/uploads/doc1.pdf',
          file_type: 'application/pdf',
          file_size: 1024000
        }
      ];

      // Mock query for uploaded files
      mockPool.query.mockResolvedValueOnce({
        rows: uploadedFiles
      });

      // Mock status update to 'processing'
      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      // Mock document processor failure
      mockDocumentProcessor.processDocument.mockRejectedValueOnce(
        new Error('OCR processing failed')
      );

      // Mock status update to 'failed'
      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      await request(app)
        .post(`/api/admin/courses/${courseId}/process-files`)
        .expect(200);

      // Wait for background processing to handle error
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify status was updated to 'failed' with error message
      const failedUpdateCalls = mockPool.query.mock.calls.filter(call =>
        call[0].includes("processing_status = 'failed'")
      );

      expect(failedUpdateCalls.length).toBeGreaterThan(0);

      if (failedUpdateCalls.length > 0) {
        const failedCall = failedUpdateCalls[0];
        expect(failedCall[1][0]).toBe('OCR processing failed');
        expect(failedCall[1][1]).toBe(1); // file id
      }
    });

    test('should continue processing remaining files after one fails', async () => {
      const courseId = 1;
      const uploadedFiles = [
        {
          id: 1,
          course_id: courseId,
          file_name: 'doc1.pdf',
          original_name: 'Document 1.pdf',
          file_path: '/uploads/doc1.pdf',
          file_type: 'application/pdf',
          file_size: 1024000
        },
        {
          id: 2,
          course_id: courseId,
          file_name: 'doc2.pdf',
          original_name: 'Document 2.pdf',
          file_path: '/uploads/doc2.pdf',
          file_type: 'application/pdf',
          file_size: 2048000
        }
      ];

      // Mock query for uploaded files
      mockPool.query.mockResolvedValueOnce({
        rows: uploadedFiles
      });

      // File 1: processing status update
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // File 1: fails
      mockDocumentProcessor.processDocument
        .mockRejectedValueOnce(new Error('File 1 failed'));

      // File 1: failed status update
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // File 2: processing status update
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // File 2: succeeds
      mockDocumentProcessor.processDocument.mockResolvedValueOnce({
        chunks: [{ text: 'chunk1' }]
      });

      // File 2: completed status update
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post(`/api/admin/courses/${courseId}/process-files`)
        .expect(200);

      // Wait for background processing
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify both files were attempted
      expect(mockDocumentProcessor.processDocument).toHaveBeenCalledTimes(2);
    });
  });

  describe('Task 3: GET /api/admin/courses/:courseId/files (File List with Status Counts)', () => {

    test('should return files with status counts and grouping', async () => {
      const courseId = 1;
      const mockFiles = [
        {
          id: 1,
          file_name: 'doc1.pdf',
          original_name: 'Document 1.pdf',
          file_type: 'application/pdf',
          file_size: 1024000,
          uploaded_at: new Date(),
          processed: false,
          processing_status: 'uploaded',
          processed_at: null,
          chunk_count: 0,
          error_message: null
        },
        {
          id: 2,
          file_name: 'doc2.pdf',
          original_name: 'Document 2.pdf',
          file_type: 'application/pdf',
          file_size: 2048000,
          uploaded_at: new Date(),
          processed: false,
          processing_status: 'processing',
          processed_at: null,
          chunk_count: 0,
          error_message: null
        },
        {
          id: 3,
          file_name: 'doc3.pdf',
          original_name: 'Document 3.pdf',
          file_type: 'application/pdf',
          file_size: 3072000,
          uploaded_at: new Date(),
          processed: true,
          processing_status: 'completed',
          processed_at: new Date(),
          chunk_count: 15,
          error_message: null
        },
        {
          id: 4,
          file_name: 'doc4.pdf',
          original_name: 'Document 4.pdf',
          file_type: 'application/pdf',
          file_size: 1536000,
          uploaded_at: new Date(),
          processed: false,
          processing_status: 'failed',
          processed_at: null,
          chunk_count: 0,
          error_message: 'OCR processing failed'
        }
      ];

      const mockStatusCounts = [
        { processing_status: 'uploaded', count: '1' },
        { processing_status: 'processing', count: '1' },
        { processing_status: 'completed', count: '1' },
        { processing_status: 'failed', count: '1' }
      ];

      // Mock file query
      mockPool.query.mockResolvedValueOnce({
        rows: mockFiles
      });

      // Mock status counts query
      mockPool.query.mockResolvedValueOnce({
        rows: mockStatusCounts
      });

      const response = await request(app)
        .get(`/api/admin/courses/${courseId}/files`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.files).toHaveLength(4);
      expect(response.body.total).toBe(4);

      // Verify status counts
      expect(response.body.statusCounts).toBeDefined();
      expect(response.body.statusCounts.uploaded).toBe(1);
      expect(response.body.statusCounts.processing).toBe(1);
      expect(response.body.statusCounts.completed).toBe(1);
      expect(response.body.statusCounts.failed).toBe(1);

      // Verify files by status grouping
      expect(response.body.filesByStatus).toBeDefined();
      expect(response.body.filesByStatus.uploaded).toHaveLength(1);
      expect(response.body.filesByStatus.processing).toHaveLength(1);
      expect(response.body.filesByStatus.completed).toHaveLength(1);
      expect(response.body.filesByStatus.failed).toHaveLength(1);

      // Verify uploaded file details
      expect(response.body.files[0].fileName).toBe('Document 1.pdf');
      expect(response.body.files[0].status).toBe('uploaded');
    });

    test('should return empty file list for course with no files', async () => {
      const courseId = 999;

      // Mock empty file query
      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      // Mock empty status counts
      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .get(`/api/admin/courses/${courseId}/files`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.files).toHaveLength(0);
      expect(response.body.total).toBe(0);
      expect(response.body.statusCounts.uploaded).toBe(0);
      expect(response.body.statusCounts.processing).toBe(0);
      expect(response.body.statusCounts.completed).toBe(0);
      expect(response.body.statusCounts.failed).toBe(0);
    });

    test('should include chunk count for completed files', async () => {
      const courseId = 1;
      const mockFiles = [
        {
          id: 1,
          file_name: 'doc1.pdf',
          original_name: 'Document 1.pdf',
          file_type: 'application/pdf',
          file_size: 1024000,
          uploaded_at: new Date(),
          processed: true,
          processing_status: 'completed',
          processed_at: new Date(),
          chunk_count: 25,
          error_message: null
        }
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockFiles });
      mockPool.query.mockResolvedValueOnce({ rows: [{ processing_status: 'completed', count: '1' }] });

      const response = await request(app)
        .get(`/api/admin/courses/${courseId}/files`)
        .expect(200);

      expect(response.body.files[0].chunkCount).toBe(25);
      expect(response.body.files[0].processed).toBe(true);
    });

    test('should include error message for failed files', async () => {
      const courseId = 1;
      const mockFiles = [
        {
          id: 1,
          file_name: 'doc1.pdf',
          original_name: 'Document 1.pdf',
          file_type: 'application/pdf',
          file_size: 1024000,
          uploaded_at: new Date(),
          processed: false,
          processing_status: 'failed',
          processed_at: null,
          chunk_count: 0,
          error_message: 'File corrupted during OCR'
        }
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockFiles });
      mockPool.query.mockResolvedValueOnce({ rows: [{ processing_status: 'failed', count: '1' }] });

      const response = await request(app)
        .get(`/api/admin/courses/${courseId}/files`)
        .expect(200);

      expect(response.body.files[0].error).toBe('File corrupted during OCR');
      expect(response.body.files[0].status).toBe('failed');
    });

    test('should handle database errors gracefully', async () => {
      const courseId = 1;

      mockPool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get(`/api/admin/courses/${courseId}/files`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch files');
    });
  });

  describe('Task 4: UI Integration Tests (API Responses)', () => {

    test('API should provide all data needed for Process Files button', async () => {
      const courseId = 1;
      const mockFiles = [
        {
          id: 1,
          file_name: 'doc1.pdf',
          original_name: 'Document 1.pdf',
          file_type: 'application/pdf',
          file_size: 1024000,
          uploaded_at: new Date(),
          processed: false,
          processing_status: 'uploaded',
          processed_at: null,
          chunk_count: 0,
          error_message: null
        },
        {
          id: 2,
          file_name: 'doc2.pdf',
          original_name: 'Document 2.pdf',
          file_type: 'application/pdf',
          file_size: 2048000,
          uploaded_at: new Date(),
          processed: false,
          processing_status: 'uploaded',
          processed_at: null,
          chunk_count: 0,
          error_message: null
        }
      ];

      const mockStatusCounts = [
        { processing_status: 'uploaded', count: '2' }
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockFiles });
      mockPool.query.mockResolvedValueOnce({ rows: mockStatusCounts });

      const response = await request(app)
        .get(`/api/admin/courses/${courseId}/files`)
        .expect(200);

      // UI can determine to show "Process 2 Uploaded Files" button
      expect(response.body.statusCounts.uploaded).toBe(2);
      expect(response.body.filesByStatus.uploaded).toHaveLength(2);

      // UI has all data for displaying file list
      expect(response.body.files[0]).toHaveProperty('fileName');
      expect(response.body.files[0]).toHaveProperty('status');
      expect(response.body.files[0]).toHaveProperty('fileSize');
    });

    test('API should provide progress data during processing', async () => {
      const courseId = 1;
      const uploadedFiles = [
        {
          id: 1,
          course_id: courseId,
          file_name: 'doc1.pdf',
          original_name: 'Document 1.pdf',
          file_path: '/uploads/doc1.pdf',
          file_type: 'application/pdf',
          file_size: 1024000
        }
      ];

      mockPool.query.mockResolvedValueOnce({ rows: uploadedFiles });

      const response = await request(app)
        .post(`/api/admin/courses/${courseId}/process-files`)
        .expect(200);

      // UI can display job_id, total_files, and estimated time
      expect(response.body.job_id).toBeDefined();
      expect(response.body.total_files).toBe(1);
      expect(response.body.estimated_minutes).toBe(5);

      // UI can use job_id to poll for status
      expect(response.body.job_id).toMatch(/^job-\d+-\d+$/);
    });

    test('Status endpoint provides all data for progress display', async () => {
      const courseId = 1;
      const uploadedFiles = [
        {
          id: 1,
          course_id: courseId,
          file_name: 'doc1.pdf',
          original_name: 'Document 1.pdf',
          file_path: '/uploads/doc1.pdf',
          file_type: 'application/pdf',
          file_size: 1024000
        }
      ];

      mockPool.query.mockResolvedValueOnce({ rows: uploadedFiles });

      const processResponse = await request(app)
        .post(`/api/admin/courses/${courseId}/process-files`)
        .expect(200);

      const jobId = processResponse.body.job_id;

      const statusResponse = await request(app)
        .get(`/api/admin/courses/${courseId}/processing-status/${jobId}`)
        .expect(200);

      // UI can display progress bar
      expect(statusResponse.body.progress).toBeDefined();
      expect(statusResponse.body.total_files).toBe(1);
      expect(statusResponse.body.processed_files).toBeDefined();

      // UI can show current file name
      expect(statusResponse.body).toHaveProperty('current_file');

      // UI can display estimated remaining time
      expect(statusResponse.body).toHaveProperty('estimated_remaining');
    });
  });
});
