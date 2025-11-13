/**
 * Migration Routes
 * One-time data migration endpoints (admin only)
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const postgresService = require('../services/database/postgres.service');
const bilingualChroma = require('../services/bilingual-chroma.service');
const logger = require('../utils/logger');

/**
 * @route POST /api/migrations/backfill-file-ids
 * @desc Backfill file_id to existing ChromaDB chunks
 * @access Super Admin only
 */
router.post('/backfill-file-ids',
  authMiddleware.authenticateToken,
  async (req, res) => {
    try {
      // Only super admin can run migrations
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Only super admin can run migrations'
        });
      }

      logger.info(`[Migration] File ID backfill started by admin ${req.user.id}`);

      const results = {
        filesProcessed: 0,
        chunksUpdated: 0,
        filesNotFound: 0,
        errors: []
      };

      // Get all processed files from PostgreSQL
      const filesQuery = `
        SELECT
          id,
          original_name,
          file_name,
          language,
          course_id
        FROM course_content
        WHERE processing_status = 'completed'
        ORDER BY id ASC
      `;

      const filesResult = await postgresService.pool.query(filesQuery, []);
      const files = filesResult.rows;

      logger.info(`[Migration] Found ${files.length} processed files`);

      // Process each file
      for (const file of files) {
        try {
          const language = file.language || 'english';
          const collection = bilingualChroma.collections[language];

          if (!collection) {
            results.errors.push(`No collection for language: ${language} (file: ${file.original_name})`);
            continue;
          }

          // Query ChromaDB for chunks from this file
          const chromaResults = await collection.get({
            where: { filename: file.original_name }
          });

          if (!chromaResults || !chromaResults.ids || chromaResults.ids.length === 0) {
            results.filesNotFound++;
            logger.warn(`[Migration] No chunks found for: ${file.original_name}`);
            continue;
          }

          logger.info(`[Migration] Processing ${file.original_name}: ${chromaResults.ids.length} chunks`);

          // Update each chunk's metadata
          for (let i = 0; i < chromaResults.ids.length; i++) {
            try {
              const chunkId = chromaResults.ids[i];
              const existingMetadata = chromaResults.metadatas[i] || {};

              // Skip if already has file_id
              if (existingMetadata.file_id) {
                continue;
              }

              // Add file_id to metadata
              const updatedMetadata = {
                ...existingMetadata,
                file_id: file.id
              };

              const document = chromaResults.documents[i];

              // ChromaDB update: delete and re-add with new metadata
              await collection.delete({ ids: [chunkId] });
              await collection.add({
                ids: [chunkId],
                documents: [document],
                metadatas: [updatedMetadata]
              });

              results.chunksUpdated++;

            } catch (chunkError) {
              logger.error(`[Migration] Error updating chunk ${i}:`, chunkError);
              results.errors.push(`Chunk ${i} error: ${chunkError.message}`);
            }
          }

          results.filesProcessed++;

        } catch (fileError) {
          logger.error(`[Migration] Error processing ${file.original_name}:`, fileError);
          results.errors.push(`${file.original_name}: ${fileError.message}`);
        }
      }

      logger.info(`[Migration] Complete: ${results.filesProcessed} files, ${results.chunksUpdated} chunks updated`);

      res.json({
        success: true,
        message: 'File ID backfill migration completed',
        results: {
          totalFiles: files.length,
          filesProcessed: results.filesProcessed,
          chunksUpdated: results.chunksUpdated,
          filesNotFound: results.filesNotFound,
          errorCount: results.errors.length,
          errors: results.errors.slice(0, 10) // Show first 10 errors
        }
      });

    } catch (error) {
      logger.error('[Migration] Backfill error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

module.exports = router;
