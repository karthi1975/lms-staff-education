const pool = require('./database/pool');
const chromaService = require('./chroma.service');
const embeddingService = require('./embedding.service');
const documentProcessor = require('./document-processor.service');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * Content Management Service
 * Handles module content upload, processing, and embedding generation
 */
class ContentService {
  /**
   * Get all modules
   */
  async getModules() {
    try {
      const result = await pool.query(
        'SELECT * FROM modules ORDER BY sequence_order ASC'
      );
      return result.rows;
    } catch (error) {
      logger.error('Error fetching modules:', error);
      throw error;
    }
  }

  /**
   * Get module by ID
   */
  async getModuleById(moduleId) {
    try {
      const result = await pool.query(
        'SELECT * FROM modules WHERE id = $1',
        [moduleId]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error fetching module ${moduleId}:`, error);
      throw error;
    }
  }

  /**
   * Get all content for a module
   */
  async getModuleContent(moduleId) {
    try {
      const result = await pool.query(
        `SELECT mc.*, au.name as uploaded_by_name
         FROM module_content mc
         LEFT JOIN admin_users au ON mc.uploaded_by = au.id
         WHERE mc.module_id = $1
         ORDER BY mc.uploaded_at DESC`,
        [moduleId]
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error fetching content for module ${moduleId}:`, error);
      throw error;
    }
  }

  /**
   * Upload and process content file for a module
   */
  async uploadContent(moduleId, file, uploadedById) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verify module exists
      const moduleCheck = await client.query(
        'SELECT id FROM modules WHERE id = $1',
        [moduleId]
      );

      if (moduleCheck.rows.length === 0) {
        throw new Error(`Module ${moduleId} not found`);
      }

      // Insert content record
      const contentResult = await client.query(
        `INSERT INTO module_content
         (module_id, file_name, original_name, file_path, file_type, file_size, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          moduleId,
          file.filename,
          file.originalname,
          file.path,
          file.mimetype,
          file.size,
          uploadedById
        ]
      );

      const content = contentResult.rows[0];

      // Process file asynchronously
      this.processContent(content.id, file.path)
        .catch(error => {
          logger.error(`Error processing content ${content.id}:`, error);
        });

      await client.query('COMMIT');
      return content;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error uploading content:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process uploaded content: extract text, chunk, and generate embeddings
   */
  async processContent(contentId, filePath) {
    try {
      logger.info(`Processing content ${contentId} from ${filePath}`);

      // Extract text from file
      const text = await documentProcessor.processDocument(filePath);

      if (!text || text.trim().length === 0) {
        throw new Error('No text extracted from document');
      }

      // Update content_text
      await pool.query(
        'UPDATE module_content SET content_text = $1 WHERE id = $2',
        [text, contentId]
      );

      // Chunk the text
      const chunkSize = parseInt(process.env.CONTENT_CHUNK_SIZE || '1000');
      const chunks = this.chunkText(text, chunkSize);

      logger.info(`Created ${chunks.length} chunks from content ${contentId}`);

      // Get module info for metadata
      const contentInfo = await pool.query(
        `SELECT mc.*, m.title as module_title
         FROM module_content mc
         JOIN modules m ON mc.module_id = m.id
         WHERE mc.id = $1`,
        [contentId]
      );

      const content = contentInfo.rows[0];

      // Generate embeddings and store in ChromaDB
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Generate embedding
        const embedding = await embeddingService.generateEmbedding(chunk);

        // Store in ChromaDB
        await chromaService.addDocument(
          content.module_id,
          chunk,
          embedding,
          {
            content_id: contentId,
            module_id: content.module_id,
            module_title: content.module_title,
            file_name: content.file_name,
            chunk_index: i,
            total_chunks: chunks.length,
            uploaded_at: content.uploaded_at
          }
        );
      }

      // Mark as processed
      await pool.query(
        `UPDATE module_content
         SET processed = true,
             processed_at = NOW(),
             chunk_count = $1
         WHERE id = $2`,
        [chunks.length, contentId]
      );

      logger.info(`Successfully processed content ${contentId} with ${chunks.length} chunks`);

    } catch (error) {
      logger.error(`Error processing content ${contentId}:`, error);

      // Update processing error in metadata
      await pool.query(
        `UPDATE module_content
         SET metadata = jsonb_set(
           COALESCE(metadata, '{}'::jsonb),
           '{processing_error}',
           to_jsonb($1::text)
         )
         WHERE id = $2`,
        [error.message, contentId]
      );

      throw error;
    }
  }

  /**
   * Chunk text into smaller segments
   */
  chunkText(text, chunkSize = 1000) {
    const chunks = [];
    const paragraphs = text.split('\n\n');
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if ((currentChunk + paragraph).length <= chunkSize) {
        currentChunk += paragraph + '\n\n';
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }

        // If single paragraph is larger than chunk size, split by sentences
        if (paragraph.length > chunkSize) {
          const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
          let sentenceChunk = '';

          for (const sentence of sentences) {
            if ((sentenceChunk + sentence).length <= chunkSize) {
              sentenceChunk += sentence;
            } else {
              if (sentenceChunk) {
                chunks.push(sentenceChunk.trim());
              }
              sentenceChunk = sentence;
            }
          }

          if (sentenceChunk) {
            currentChunk = sentenceChunk + '\n\n';
          }
        } else {
          currentChunk = paragraph + '\n\n';
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Delete content and its embeddings
   */
  async deleteContent(contentId) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get content info
      const result = await client.query(
        'SELECT * FROM module_content WHERE id = $1',
        [contentId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Content ${contentId} not found`);
      }

      const content = result.rows[0];

      // Delete file from disk
      try {
        await fs.unlink(content.file_path);
      } catch (error) {
        logger.warn(`Could not delete file ${content.file_path}:`, error.message);
      }

      // Delete from ChromaDB
      try {
        await chromaService.deleteByMetadata({ content_id: contentId });
      } catch (error) {
        logger.warn(`Could not delete embeddings for content ${contentId}:`, error.message);
      }

      // Delete from database
      await client.query('DELETE FROM module_content WHERE id = $1', [contentId]);

      await client.query('COMMIT');

      logger.info(`Deleted content ${contentId}`);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error deleting content ${contentId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user progress across all modules
   */
  async getUserProgress(userId) {
    try {
      const result = await pool.query(
        `SELECT
          m.id as module_id,
          m.title,
          m.description,
          m.sequence_order,
          COALESCE(up.status, 'not_started') as status,
          COALESCE(up.progress_percentage, 0) as progress_percentage,
          up.started_at,
          up.completed_at,
          up.time_spent_minutes,
          up.last_activity_at,
          (
            SELECT json_agg(json_build_object(
              'attempt_number', qa.attempt_number,
              'score', qa.score,
              'total_questions', qa.total_questions,
              'passed', qa.passed,
              'attempted_at', qa.attempted_at
            ) ORDER BY qa.attempted_at DESC)
            FROM quiz_attempts qa
            WHERE qa.user_id = $1 AND qa.module_id = m.id
          ) as quiz_attempts
         FROM modules m
         LEFT JOIN user_progress up ON m.id = up.module_id AND up.user_id = $1
         ORDER BY m.sequence_order ASC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      logger.error(`Error fetching user progress for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get all users with their overall progress summary
   */
  async getAllUsersProgress() {
    try {
      const result = await pool.query(
        `SELECT
          u.id,
          u.whatsapp_id,
          u.name,
          u.created_at,
          u.last_active_at,
          u.current_module_id,
          COUNT(DISTINCT up.module_id) FILTER (WHERE up.status = 'completed') as modules_completed,
          COUNT(DISTINCT up.module_id) FILTER (WHERE up.status = 'in_progress') as modules_in_progress,
          SUM(up.time_spent_minutes) as total_time_spent_minutes,
          (
            SELECT COUNT(*)
            FROM quiz_attempts qa
            WHERE qa.user_id = u.id AND qa.passed = true
          ) as quizzes_passed
         FROM users u
         LEFT JOIN user_progress up ON u.id = up.user_id
         WHERE u.is_active = true
         GROUP BY u.id, u.whatsapp_id, u.name, u.created_at, u.last_active_at, u.current_module_id
         ORDER BY u.last_active_at DESC NULLS LAST`
      );

      return result.rows;
    } catch (error) {
      logger.error('Error fetching all users progress:', error);
      throw error;
    }
  }

  /**
   * Update user progress
   */
  async updateUserProgress(userId, moduleId, progressData) {
    try {
      const result = await pool.query(
        `INSERT INTO user_progress
         (user_id, module_id, status, progress_percentage, started_at, last_activity_at, time_spent_minutes)
         VALUES ($1, $2, $3, $4,
           CASE WHEN $5::varchar = 'in_progress' AND $6 IS NULL THEN NOW() ELSE $6 END,
           NOW(), $7)
         ON CONFLICT (user_id, module_id)
         DO UPDATE SET
           status = EXCLUDED.status,
           progress_percentage = EXCLUDED.progress_percentage,
           completed_at = CASE WHEN EXCLUDED.status = 'completed' THEN NOW() ELSE user_progress.completed_at END,
           last_activity_at = NOW(),
           time_spent_minutes = user_progress.time_spent_minutes + EXCLUDED.time_spent_minutes
         RETURNING *`,
        [
          userId,
          moduleId,
          progressData.status || 'in_progress',
          progressData.progress_percentage || 0,
          progressData.status,
          progressData.started_at || null,
          progressData.time_spent_minutes || 0
        ]
      );

      return result.rows[0];
    } catch (error) {
      logger.error(`Error updating user progress for user ${userId}, module ${moduleId}:`, error);
      throw error;
    }
  }

  /**
   * Bulk upload content from directory
   */
  async bulkUploadFromDirectory(directoryPath, uploadedById) {
    try {
      const files = await fs.readdir(directoryPath);
      const results = [];

      for (const fileName of files) {
        if (fileName.endsWith('.txt') || fileName.endsWith('.pdf') || fileName.endsWith('.docx')) {
          // Extract module number from filename (e.g., module1_introduction.txt -> 1)
          const match = fileName.match(/module(\d+)/i);

          if (match) {
            const moduleId = parseInt(match[1]);
            const filePath = path.join(directoryPath, fileName);

            const stats = await fs.stat(filePath);

            const mockFile = {
              filename: fileName,
              originalname: fileName,
              path: filePath,
              mimetype: 'text/plain',
              size: stats.size
            };

            try {
              const content = await this.uploadContent(moduleId, mockFile, uploadedById);
              results.push({ success: true, fileName, contentId: content.id });
              logger.info(`Uploaded ${fileName} to module ${moduleId}`);
            } catch (error) {
              results.push({ success: false, fileName, error: error.message });
              logger.error(`Failed to upload ${fileName}:`, error);
            }
          }
        }
      }

      return results;
    } catch (error) {
      logger.error('Error in bulk upload:', error);
      throw error;
    }
  }
}

module.exports = new ContentService();
