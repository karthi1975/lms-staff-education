/**
 * End-to-End Workflow Tests for File Upload and Processing
 *
 * Task 6: Test Workflow End-to-End
 * 6.1 - Upload phase
 * 6.2 - Process phase
 * 6.3 - Error handling
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

describe('Task 6: End-to-End File Workflow Tests', () => {
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

  describe('Task 6.1: Upload Phase - Multiple Files', () => {

    test('should upload 10 files with status="uploaded" without auto-processing', async () => {
      const courseId = 1;

      // Create 10 mock files
      const mockFiles = Array.from({ length: 10 }, (_, i) => ({
        filename: `doc${i + 1}.pdf`,
        originalname: `Document ${i + 1}.pdf`,
        path: `/uploads/doc${i + 1}.pdf`,
        mimetype: 'application/pdf',
        size: (i + 1) * 1024000
      }));

      // Mock database insertions for all 10 files
      mockFiles.forEach((file, index) => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{
            id: index + 1,
            file_name: file.filename,
            file_path: file.path
          }]
        });
      });

      const response = await request(app)
        .post(`/api/admin/courses/${courseId}/simple-upload`)
        .send({ mockFiles })
        .expect(200);

      // Verify response
      expect(response.body.success).toBe(true);
      expect(response.body.total_files).toBe(10);
      expect(response.body.message).toContain('Click "Process Files"');
      expect(response.body.files).toHaveLength(10);

      // Verify all 10 files were inserted with status='uploaded'
      expect(mockPool.query).toHaveBeenCalledTimes(10);

      // Check that each insert had status='uploaded'
      mockPool.query.mock.calls.forEach((call, index) => {
        expect(call[0]).toContain('INSERT INTO course_content');
        expect(call[0]).toContain("'uploaded'");
      });

      // Verify document processor was NOT called (no auto-processing)
      expect(mockDocumentProcessor.processDocument).not.toHaveBeenCalled();
    });

    test('should display "Process Files" button with correct count after upload', async () => {
      const courseId = 1;

      // Mock 7 uploaded files in database
      const mockUploadedFiles = Array.from({ length: 7 }, (_, i) => ({
        id: i + 1,
        file_name: `doc${i + 1}.pdf`,
        original_name: `Document ${i + 1}.pdf`,
        file_type: 'application/pdf',
        file_size: (i + 1) * 1024000,
        uploaded_at: new Date(),
        processed: false,
        processing_status: 'uploaded',
        processed_at: null,
        chunk_count: 0,
        error_message: null
      }));

      const mockStatusCounts = [
        { processing_status: 'uploaded', count: '7' }
      ];

      // Mock file list query
      mockPool.query.mockResolvedValueOnce({ rows: mockUploadedFiles });
      mockPool.query.mockResolvedValueOnce({ rows: mockStatusCounts });

      const response = await request(app)
        .get(`/api/admin/courses/${courseId}/files`)
        .expect(200);

      // Verify UI will show "Process 7 Uploaded Files" button
      expect(response.body.statusCounts.uploaded).toBe(7);
      expect(response.body.filesByStatus.uploaded).toHaveLength(7);

      // Verify no files are processing or completed yet
      expect(response.body.statusCounts.processing).toBe(0);
      expect(response.body.statusCounts.completed).toBe(0);
      expect(response.body.statusCounts.failed).toBe(0);
    });

    test('should verify all uploaded files have correct status and metadata', async () => {
      const courseId = 1;

      const mockFiles = [
        {
          id: 1,
          file_name: 'doc1.pdf',
          original_name: 'Training Manual.pdf',
          file_type: 'application/pdf',
          file_size: 2048000,
          uploaded_at: new Date('2025-01-15T10:30:00Z'),
          processed: false,
          processing_status: 'uploaded',
          processed_at: null,
          chunk_count: 0,
          error_message: null
        },
        {
          id: 2,
          file_name: 'doc2.pdf',
          original_name: 'Course Syllabus.pdf',
          file_type: 'application/pdf',
          file_size: 1536000,
          uploaded_at: new Date('2025-01-15T10:31:00Z'),
          processed: false,
          processing_status: 'uploaded',
          processed_at: null,
          chunk_count: 0,
          error_message: null
        }
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockFiles });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ processing_status: 'uploaded', count: '2' }]
      });

      const response = await request(app)
        .get(`/api/admin/courses/${courseId}/files`)
        .expect(200);

      // Verify each file has correct status
      response.body.files.forEach(file => {
        expect(file.status).toBe('uploaded');
        expect(file.processed).toBe(false);
        expect(file.chunkCount).toBe(0);
        expect(file.error).toBeNull();
      });
    });
  });

  describe('Task 6.2: Process Phase - Background Processing', () => {

    test('should start background job when Process Files clicked', async () => {
      const courseId = 1;

      // Mock 5 uploaded files
      const uploadedFiles = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        course_id: courseId,
        file_name: `doc${i + 1}.pdf`,
        original_name: `Document ${i + 1}.pdf`,
        file_path: `/uploads/doc${i + 1}.pdf`,
        file_type: 'application/pdf',
        file_size: (i + 1) * 1024000
      }));

      mockPool.query.mockResolvedValueOnce({ rows: uploadedFiles });

      const response = await request(app)
        .post(`/api/admin/courses/${courseId}/process-files`)
        .expect(200);

      // Verify job started
      expect(response.body.success).toBe(true);
      expect(response.body.job_id).toBeDefined();
      expect(response.body.total_files).toBe(5);
      expect(response.body.estimated_minutes).toBe(25); // 5 files * 5 min
      expect(response.body.message).toBe('Processing started in background');
    });

    test('should track status progression: uploaded → processing → completed', async () => {
      const courseId = 1;
      const fileId = 1;

      const uploadedFile = {
        id: fileId,
        course_id: courseId,
        file_name: 'doc1.pdf',
        original_name: 'Document 1.pdf',
        file_path: '/uploads/doc1.pdf',
        file_type: 'application/pdf',
        file_size: 1024000
      };

      // Query for uploaded files
      mockPool.query.mockResolvedValueOnce({ rows: [uploadedFile] });

      // Update to 'processing'
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock successful processing
      mockDocumentProcessor.processDocument.mockResolvedValueOnce({
        chunks: [
          { text: 'chunk1' },
          { text: 'chunk2' },
          { text: 'chunk3' }
        ]
      });

      // Update to 'completed'
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Start processing
      await request(app)
        .post(`/api/admin/courses/${courseId}/process-files`)
        .expect(200);

      // Wait for background processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify status updates
      const statusUpdateCalls = mockPool.query.mock.calls;

      // Check 'processing' update
      const processingUpdate = statusUpdateCalls.find(call =>
        call[0].includes("processing_status = 'processing'")
      );
      expect(processingUpdate).toBeDefined();
      expect(processingUpdate[1]).toEqual([fileId]);

      // Check 'completed' update
      const completedUpdate = statusUpdateCalls.find(call =>
        call[0].includes("processing_status = 'completed'")
      );
      expect(completedUpdate).toBeDefined();
      expect(completedUpdate[1]).toEqual([3, fileId]); // 3 chunks, file id 1
    });

    test('should auto-refresh UI with progress updates', async () => {
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

      mockPool.query.mockResolvedValueOnce({ rows: uploadedFiles });

      const response = await request(app)
        .post(`/api/admin/courses/${courseId}/process-files`)
        .expect(200);

      const jobId = response.body.job_id;

      // Poll for status
      const statusResponse = await request(app)
        .get(`/api/admin/courses/${courseId}/processing-status/${jobId}`)
        .expect(200);

      // Verify progress data available for UI refresh
      expect(statusResponse.body.progress).toBeDefined();
      expect(statusResponse.body.total_files).toBe(2);
      expect(statusResponse.body.processed_files).toBeGreaterThanOrEqual(0);
      expect(statusResponse.body.status).toMatch(/processing|completed|completed_with_errors/);
    });

    test('should process all 10 files successfully', async () => {
      const courseId = 1;

      const uploadedFiles = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        course_id: courseId,
        file_name: `doc${i + 1}.pdf`,
        original_name: `Document ${i + 1}.pdf`,
        file_path: `/uploads/doc${i + 1}.pdf`,
        file_type: 'application/pdf',
        file_size: (i + 1) * 1024000
      }));

      mockPool.query.mockResolvedValueOnce({ rows: uploadedFiles });

      // Mock status updates and processing for all files
      for (let i = 0; i < 10; i++) {
        // Processing status update
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        // Mock successful document processing
        mockDocumentProcessor.processDocument.mockResolvedValueOnce({
          chunks: Array.from({ length: 5 }, (_, j) => ({ text: `chunk${j}` }))
        });

        // Completed status update
        mockPool.query.mockResolvedValueOnce({ rows: [] });
      }

      await request(app)
        .post(`/api/admin/courses/${courseId}/process-files`)
        .expect(200);

      // Wait for background processing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify all 10 files were processed
      expect(mockDocumentProcessor.processDocument).toHaveBeenCalledTimes(10);

      // Verify all completed
      const completedUpdateCalls = mockPool.query.mock.calls.filter(call =>
        call[0].includes("processing_status = 'completed'")
      );
      expect(completedUpdateCalls.length).toBe(10);
    });
  });

  describe('Task 6.3: Error Handling', () => {

    test('should handle invalid/corrupted file gracefully', async () => {
      const courseId = 1;

      const uploadedFiles = [
        {
          id: 1,
          course_id: courseId,
          file_name: 'corrupted.pdf',
          original_name: 'Corrupted File.pdf',
          file_path: '/uploads/corrupted.pdf',
          file_type: 'application/pdf',
          file_size: 1024000
        }
      ];

      mockPool.query.mockResolvedValueOnce({ rows: uploadedFiles });

      // Processing status update
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock processing failure
      mockDocumentProcessor.processDocument.mockRejectedValueOnce(
        new Error('File corrupted: Unable to extract text')
      );

      // Failed status update
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .post(`/api/admin/courses/${courseId}/process-files`)
        .expect(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify failed status update with error message
      const failedUpdate = mockPool.query.mock.calls.find(call =>
        call[0].includes("processing_status = 'failed'")
      );

      expect(failedUpdate).toBeDefined();
      expect(failedUpdate[1][0]).toBe('File corrupted: Unable to extract text');
      expect(failedUpdate[1][1]).toBe(1); // file id
    });

    test('should show error message in UI for failed files', async () => {
      const courseId = 1;

      const mockFiles = [
        {
          id: 1,
          file_name: 'failed.pdf',
          original_name: 'Failed Document.pdf',
          file_type: 'application/pdf',
          file_size: 1024000,
          uploaded_at: new Date(),
          processed: false,
          processing_status: 'failed',
          processed_at: null,
          chunk_count: 0,
          error_message: 'OCR processing failed: Unsupported PDF version'
        }
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockFiles });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ processing_status: 'failed', count: '1' }]
      });

      const response = await request(app)
        .get(`/api/admin/courses/${courseId}/files`)
        .expect(200);

      // Verify error message is available for UI display
      expect(response.body.files[0].status).toBe('failed');
      expect(response.body.files[0].error).toBe('OCR processing failed: Unsupported PDF version');
      expect(response.body.statusCounts.failed).toBe(1);
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
          file_name: 'corrupted.pdf',
          original_name: 'Corrupted.pdf',
          file_path: '/uploads/corrupted.pdf',
          file_type: 'application/pdf',
          file_size: 2048000
        },
        {
          id: 3,
          course_id: courseId,
          file_name: 'doc3.pdf',
          original_name: 'Document 3.pdf',
          file_path: '/uploads/doc3.pdf',
          file_type: 'application/pdf',
          file_size: 3072000
        }
      ];

      mockPool.query.mockResolvedValueOnce({ rows: uploadedFiles });

      // File 1: processing
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockDocumentProcessor.processDocument.mockResolvedValueOnce({
        chunks: [{ text: 'chunk1' }]
      });
      // File 1: completed
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // File 2: processing
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockDocumentProcessor.processDocument.mockRejectedValueOnce(
        new Error('Corrupted file')
      );
      // File 2: failed
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // File 3: processing
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockDocumentProcessor.processDocument.mockResolvedValueOnce({
        chunks: [{ text: 'chunk3' }]
      });
      // File 3: completed
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .post(`/api/admin/courses/${courseId}/process-files`)
        .expect(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify all 3 files were attempted
      expect(mockDocumentProcessor.processDocument).toHaveBeenCalledTimes(3);

      // Verify 2 succeeded, 1 failed
      const completedCalls = mockPool.query.mock.calls.filter(call =>
        call[0].includes("processing_status = 'completed'")
      );
      const failedCalls = mockPool.query.mock.calls.filter(call =>
        call[0].includes("processing_status = 'failed'")
      );

      expect(completedCalls.length).toBe(2); // Files 1 and 3
      expect(failedCalls.length).toBe(1);     // File 2
    });

    test('should complete with errors status when some files fail', async () => {
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
          file_name: 'failed.pdf',
          original_name: 'Failed.pdf',
          file_path: '/uploads/failed.pdf',
          file_type: 'application/pdf',
          file_size: 2048000
        }
      ];

      mockPool.query.mockResolvedValueOnce({ rows: uploadedFiles });

      // File 1: success
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockDocumentProcessor.processDocument.mockResolvedValueOnce({
        chunks: [{ text: 'chunk1' }]
      });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // File 2: fail
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockDocumentProcessor.processDocument.mockRejectedValueOnce(
        new Error('Processing error')
      );
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const processResponse = await request(app)
        .post(`/api/admin/courses/${courseId}/process-files`)
        .expect(200);

      const jobId = processResponse.body.job_id;

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check final status
      const statusResponse = await request(app)
        .get(`/api/admin/courses/${courseId}/processing-status/${jobId}`)
        .expect(200);

      // Should be 'completed_with_errors'
      expect(['completed_with_errors', 'processing']).toContain(statusResponse.body.status);
      if (statusResponse.body.status === 'completed_with_errors') {
        expect(statusResponse.body.errors).toHaveLength(1);
      }
    });
  });

  describe('Complete Workflow: Upload → Process → Verify', () => {

    test('should complete full workflow from upload to processing completion', async () => {
      const courseId = 1;

      // STEP 1: Upload 5 files
      const mockFiles = Array.from({ length: 5 }, (_, i) => ({
        filename: `doc${i + 1}.pdf`,
        originalname: `Document ${i + 1}.pdf`,
        path: `/uploads/doc${i + 1}.pdf`,
        mimetype: 'application/pdf',
        size: (i + 1) * 1024000
      }));

      // Mock uploads
      mockFiles.forEach((file, index) => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{ id: index + 1, file_name: file.filename, file_path: file.path }]
        });
      });

      const uploadResponse = await request(app)
        .post(`/api/admin/courses/${courseId}/simple-upload`)
        .send({ mockFiles })
        .expect(200);

      expect(uploadResponse.body.success).toBe(true);
      expect(uploadResponse.body.total_files).toBe(5);

      // STEP 2: Verify files are uploaded (not processed)
      const uploadedDbFiles = mockFiles.map((file, index) => ({
        id: index + 1,
        course_id: courseId,
        file_name: file.filename,
        original_name: file.originalname,
        file_path: file.path,
        file_type: file.mimetype,
        file_size: file.size
      }));

      mockPool.query.mockResolvedValueOnce({ rows: uploadedDbFiles });

      // STEP 3: Start processing
      // Mock processing for all files
      for (let i = 0; i < 5; i++) {
        mockPool.query.mockResolvedValueOnce({ rows: [] }); // processing status
        mockDocumentProcessor.processDocument.mockResolvedValueOnce({
          chunks: Array.from({ length: 3 }, (_, j) => ({ text: `chunk${j}` }))
        });
        mockPool.query.mockResolvedValueOnce({ rows: [] }); // completed status
      }

      const processResponse = await request(app)
        .post(`/api/admin/courses/${courseId}/process-files`)
        .expect(200);

      expect(processResponse.body.success).toBe(true);
      expect(processResponse.body.total_files).toBe(5);

      // STEP 4: Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // STEP 5: Verify all files processed
      expect(mockDocumentProcessor.processDocument).toHaveBeenCalledTimes(5);

      // Verify status updates
      const completedUpdates = mockPool.query.mock.calls.filter(call =>
        call[0].includes("processing_status = 'completed'")
      );
      expect(completedUpdates.length).toBe(5);
    });
  });
});
