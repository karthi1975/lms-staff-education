/**
 * Certificate Routes
 * Handles certificate generation and download endpoints
 */

const express = require('express');
const router = express.Router();
const certificateService = require('../services/certificate.service');
const path = require('path');
const logger = require('../utils/logger');

/**
 * GET /api/certificates/:filename
 * Download a generated certificate
 */
router.get('/certificates/:filename', async (req, res) => {
  try {
    const { filename } = req.params;

    // Security: Prevent directory traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const filepath = path.join(certificateService.certificatesDir, filename);

    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    // Send file
    res.download(filepath, filename, (err) => {
      if (err) {
        logger.error('Error downloading certificate:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to download certificate' });
        }
      }
    });

  } catch (error) {
    logger.error('Error in certificate download:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/certificates/generate-quiz-certificate
 * Generate a quiz completion certificate
 */
router.post('/generate-quiz-certificate', async (req, res) => {
  try {
    const { userId, moduleId, quizAttemptId } = req.body;

    if (!userId || !moduleId || !quizAttemptId) {
      return res.status(400).json({
        error: 'Missing required fields: userId, moduleId, quizAttemptId'
      });
    }

    const result = await certificateService.generateQuizCertificate(
      userId,
      moduleId,
      quizAttemptId
    );

    res.json(result);

  } catch (error) {
    logger.error('Error generating quiz certificate:', error);
    res.status(500).json({
      error: 'Failed to generate certificate',
      message: error.message
    });
  }
});

/**
 * POST /api/certificates/generate-progress-report
 * Generate a user progress report
 */
router.post('/generate-progress-report', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const result = await certificateService.generateProgressReport(userId);

    res.json(result);

  } catch (error) {
    logger.error('Error generating progress report:', error);
    res.status(500).json({
      error: 'Failed to generate progress report',
      message: error.message
    });
  }
});

/**
 * GET /api/certificates/quiz-summary/:userId/:quizAttemptId
 * Get quiz results summary (text format)
 */
router.get('/quiz-summary/:userId/:quizAttemptId', async (req, res) => {
  try {
    const { userId, quizAttemptId } = req.params;

    const summary = await certificateService.generateQuizResultsSummary(
      parseInt(userId),
      null, // moduleId not needed for summary
      parseInt(quizAttemptId)
    );

    res.json({ summary });

  } catch (error) {
    logger.error('Error generating quiz summary:', error);
    res.status(500).json({
      error: 'Failed to generate quiz summary',
      message: error.message
    });
  }
});

/**
 * DELETE /api/certificates/cleanup
 * Clean up old certificates (admin only)
 */
router.delete('/cleanup', async (req, res) => {
  try {
    const deleted = await certificateService.cleanupOldCertificates();

    res.json({
      success: true,
      message: `Cleaned up ${deleted} old certificates`
    });

  } catch (error) {
    logger.error('Error cleaning up certificates:', error);
    res.status(500).json({
      error: 'Failed to cleanup certificates',
      message: error.message
    });
  }
});

module.exports = router;
