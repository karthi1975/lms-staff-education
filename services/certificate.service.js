/**
 * Certificate Generation Service
 * Generates certificates and quiz reports for WhatsApp delivery
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const postgresService = require('./database/postgres.service');

class CertificateService {
  constructor() {
    this.certificatesDir = path.join(__dirname, '..', 'certificates');
    this.ensureDirectoryExists();
  }

  ensureDirectoryExists() {
    if (!fs.existsSync(this.certificatesDir)) {
      fs.mkdirSync(this.certificatesDir, { recursive: true });
      logger.info('Created certificates directory');
    }
  }

  /**
   * Generate quiz completion certificate
   */
  async generateQuizCertificate(userId, moduleId, quizAttemptId) {
    try {
      // Get quiz attempt details
      const attemptResult = await postgresService.query(`
        SELECT
          qa.id, qa.score, qa.total_questions, qa.passed, qa.created_at,
          qa.moodle_attempt_id, qa.metadata,
          u.name as user_name, u.whatsapp_id,
          mm.module_name,
          mc.course_name
        FROM quiz_attempts qa
        JOIN users u ON qa.user_id = u.id
        JOIN moodle_modules mm ON qa.module_id = mm.id
        JOIN moodle_courses mc ON mm.moodle_course_id = mc.moodle_course_id
        WHERE qa.id = $1 AND qa.user_id = $2
      `, [quizAttemptId, userId]);

      if (attemptResult.rows.length === 0) {
        throw new Error('Quiz attempt not found');
      }

      const attempt = attemptResult.rows[0];
      const percentage = (attempt.score / attempt.total_questions) * 100;
      const moodleGrade = attempt.metadata?.moodle_grade || null;

      // Generate PDF
      const filename = `certificate_${userId}_${moduleId}_${Date.now()}.pdf`;
      const filepath = path.join(this.certificatesDir, filename);

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Certificate Design
      // Header
      doc.fontSize(32)
         .fillColor('#2C3E50')
         .text('Certificate of Completion', { align: 'center' })
         .moveDown(0.5);

      doc.fontSize(12)
         .fillColor('#7F8C8D')
         .text('This is to certify that', { align: 'center' })
         .moveDown(0.5);

      // Student Name
      doc.fontSize(28)
         .fillColor('#34495E')
         .text(attempt.user_name, { align: 'center' })
         .moveDown(0.5);

      doc.fontSize(12)
         .fillColor('#7F8C8D')
         .text('has successfully completed', { align: 'center' })
         .moveDown(0.5);

      // Course & Module
      doc.fontSize(20)
         .fillColor('#3498DB')
         .text(attempt.course_name, { align: 'center' })
         .moveDown(0.3);

      doc.fontSize(16)
         .fillColor('#2980B9')
         .text(attempt.module_name, { align: 'center' })
         .moveDown(1);

      // Quiz Results
      doc.fontSize(14)
         .fillColor('#27AE60')
         .text('Quiz Results', { align: 'center', underline: true })
         .moveDown(0.5);

      doc.fontSize(12)
         .fillColor('#2C3E50');

      if (moodleGrade) {
        doc.text(`Moodle Grade: ${moodleGrade}/10`, { align: 'center' })
           .moveDown(0.3);
      }

      doc.text(`Score: ${attempt.score}/${attempt.total_questions} (${percentage.toFixed(1)}%)`, { align: 'center' })
         .text(`Status: ${attempt.passed ? 'PASSED ✓' : 'FAILED ✗'}`, { align: 'center' })
         .moveDown(1);

      // Date
      const completionDate = new Date(attempt.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      doc.fontSize(10)
         .fillColor('#7F8C8D')
         .text(`Completed on: ${completionDate}`, { align: 'center' })
         .moveDown(0.5);

      if (attempt.moodle_attempt_id) {
        doc.text(`Moodle Attempt ID: ${attempt.moodle_attempt_id}`, { align: 'center' })
           .moveDown(0.5);
      }

      doc.text(`Certificate ID: ${quizAttemptId}`, { align: 'center' });

      // Footer
      doc.moveDown(2);
      doc.fontSize(8)
         .fillColor('#95A5A6')
         .text('Teachers Training System', { align: 'center' })
         .text('Powered by WhatsApp Learning Platform', { align: 'center' });

      // Finalize PDF
      doc.end();

      // Wait for PDF to be written
      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });

      logger.info(`Certificate generated: ${filename}`);

      return {
        success: true,
        filename,
        filepath,
        url: `/certificates/${filename}`,
        attempt: {
          score: attempt.score,
          total: attempt.total_questions,
          percentage: percentage.toFixed(1),
          passed: attempt.passed,
          moodleGrade,
          date: completionDate
        }
      };

    } catch (error) {
      logger.error('Error generating certificate:', error);
      throw error;
    }
  }

  /**
   * Generate quiz results summary (text format for WhatsApp)
   */
  async generateQuizResultsSummary(userId, moduleId, quizAttemptId) {
    try {
      const attemptResult = await postgresService.query(`
        SELECT
          qa.id, qa.score, qa.total_questions, qa.passed, qa.created_at,
          qa.answers, qa.metadata,
          u.name as user_name,
          mm.module_name,
          mc.course_name
        FROM quiz_attempts qa
        JOIN users u ON qa.user_id = u.id
        JOIN moodle_modules mm ON qa.module_id = mm.id
        JOIN moodle_courses mc ON mm.moodle_course_id = mc.moodle_course_id
        WHERE qa.id = $1 AND qa.user_id = $2
      `, [quizAttemptId, userId]);

      if (attemptResult.rows.length === 0) {
        throw new Error('Quiz attempt not found');
      }

      const attempt = attemptResult.rows[0];
      const percentage = (attempt.score / attempt.total_questions) * 100;
      const moodleGrade = attempt.metadata?.moodle_grade || null;

      let summary = `📊 *Quiz Results Summary*\n\n`;
      summary += `👤 Student: ${attempt.user_name}\n`;
      summary += `📚 Course: ${attempt.course_name}\n`;
      summary += `📖 Module: ${attempt.module_name}\n\n`;

      summary += `*Results:*\n`;
      if (moodleGrade) {
        summary += `🎯 Moodle Grade: ${moodleGrade}/10\n`;
      }
      summary += `✅ Correct: ${attempt.score}/${attempt.total_questions}\n`;
      summary += `📈 Percentage: ${percentage.toFixed(1)}%\n`;
      summary += `${attempt.passed ? '🎉 Status: *PASSED*' : '❌ Status: *FAILED*'}\n\n`;

      const completionDate = new Date(attempt.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      summary += `📅 Completed: ${completionDate}\n`;

      if (attempt.moodle_attempt_id) {
        summary += `🔗 Moodle Attempt: ${attempt.moodle_attempt_id}\n`;
      }

      summary += `📜 Certificate ID: ${quizAttemptId}`;

      return summary;

    } catch (error) {
      logger.error('Error generating quiz summary:', error);
      throw error;
    }
  }

  /**
   * Generate user progress report
   */
  async generateProgressReport(userId) {
    try {
      // Get user info
      const userResult = await postgresService.query(
        'SELECT name, whatsapp_id FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      // Get module progress
      const progressResult = await postgresService.query(`
        SELECT
          mm.module_name,
          up.status,
          up.progress_percentage,
          COUNT(qa.id) FILTER (WHERE qa.passed = true) as quizzes_passed,
          MAX(qa.created_at) as last_quiz_date
        FROM moodle_modules mm
        LEFT JOIN user_progress up ON mm.id = up.module_id AND up.user_id = $1
        LEFT JOIN quiz_attempts qa ON mm.id = qa.module_id AND qa.user_id = $1
        GROUP BY mm.id, mm.module_name, mm.sequence_order, up.status, up.progress_percentage
        ORDER BY mm.sequence_order
      `, [userId]);

      const filename = `progress_${userId}_${Date.now()}.pdf`;
      const filepath = path.join(this.certificatesDir, filename);

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Header
      doc.fontSize(28)
         .fillColor('#2C3E50')
         .text('Learning Progress Report', { align: 'center' })
         .moveDown(1);

      doc.fontSize(14)
         .fillColor('#34495E')
         .text(`Student: ${user.name}`, { align: 'left' })
         .text(`WhatsApp: ${user.whatsapp_id}`, { align: 'left' })
         .text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'left' })
         .moveDown(1);

      // Module Progress
      doc.fontSize(16)
         .fillColor('#3498DB')
         .text('Module Progress', { underline: true })
         .moveDown(0.5);

      progressResult.rows.forEach((module, index) => {
        const status = module.status || 'not_started';
        const statusEmoji = status === 'completed' ? '✅' : status === 'in_progress' ? '🔄' : '⚪';
        const statusText = status === 'completed' ? 'Completed' : status === 'in_progress' ? 'In Progress' : 'Not Started';

        doc.fontSize(12)
           .fillColor('#2C3E50')
           .text(`${statusEmoji} Module ${index + 1}: ${module.module_name}`, { continued: false })
           .fontSize(10)
           .fillColor('#7F8C8D')
           .text(`   Status: ${statusText}`, { indent: 20 });

        if (module.progress_percentage) {
          doc.text(`   Progress: ${module.progress_percentage}%`, { indent: 20 });
        }

        if (module.quizzes_passed > 0) {
          doc.text(`   Quizzes Passed: ${module.quizzes_passed}`, { indent: 20 });
        }

        if (module.last_quiz_date) {
          const quizDate = new Date(module.last_quiz_date).toLocaleDateString();
          doc.text(`   Last Quiz: ${quizDate}`, { indent: 20 });
        }

        doc.moveDown(0.5);
      });

      // Summary
      const completed = progressResult.rows.filter(m => m.status === 'completed').length;
      const inProgress = progressResult.rows.filter(m => m.status === 'in_progress').length;
      const totalQuizzesPassed = progressResult.rows.reduce((sum, m) => sum + (m.quizzes_passed || 0), 0);

      doc.moveDown(1);
      doc.fontSize(14)
         .fillColor('#27AE60')
         .text('Summary', { underline: true })
         .moveDown(0.5);

      doc.fontSize(11)
         .fillColor('#2C3E50')
         .text(`Total Modules: ${progressResult.rows.length}`)
         .text(`Completed: ${completed}`)
         .text(`In Progress: ${inProgress}`)
         .text(`Total Quizzes Passed: ${totalQuizzesPassed}`)
         .text(`Overall Completion: ${((completed / progressResult.rows.length) * 100).toFixed(0)}%`);

      // Footer
      doc.moveDown(2);
      doc.fontSize(8)
         .fillColor('#95A5A6')
         .text('Teachers Training System', { align: 'center' })
         .text('Keep up the great work!', { align: 'center' });

      doc.end();

      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });

      logger.info(`Progress report generated: ${filename}`);

      return {
        success: true,
        filename,
        filepath,
        url: `/certificates/${filename}`
      };

    } catch (error) {
      logger.error('Error generating progress report:', error);
      throw error;
    }
  }

  /**
   * Clean up old certificates (older than 7 days)
   */
  async cleanupOldCertificates() {
    try {
      const files = fs.readdirSync(this.certificatesDir);
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      let deleted = 0;

      files.forEach(file => {
        const filepath = path.join(this.certificatesDir, file);
        const stats = fs.statSync(filepath);

        if (stats.mtimeMs < sevenDaysAgo) {
          fs.unlinkSync(filepath);
          deleted++;
        }
      });

      logger.info(`Cleaned up ${deleted} old certificates`);
      return deleted;

    } catch (error) {
      logger.error('Error cleaning up certificates:', error);
      throw error;
    }
  }
}

module.exports = new CertificateService();
