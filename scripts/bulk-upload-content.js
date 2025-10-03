#!/usr/bin/env node

/**
 * Bulk Upload Content Script
 * Uploads all training content files to the database and ChromaDB
 * Usage: node scripts/bulk-upload-content.js
 */

require('dotenv').config();
const contentService = require('../services/content.service');
const logger = require('../utils/logger');
const path = require('path');

const TRAINING_CONTENT_DIR = path.join(__dirname, '../training-content');
const ADMIN_USER_ID = 1; // Default admin user

async function main() {
  try {
    logger.info('Starting bulk content upload...');
    logger.info(`Directory: ${TRAINING_CONTENT_DIR}`);

    const results = await contentService.bulkUploadFromDirectory(
      TRAINING_CONTENT_DIR,
      ADMIN_USER_ID
    );

    logger.info('\n=== Upload Results ===');

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    logger.info(`Total files: ${results.length}`);
    logger.info(`Successful: ${successCount}`);
    logger.info(`Failed: ${failureCount}`);

    logger.info('\n=== Details ===');
    results.forEach(result => {
      if (result.success) {
        logger.info(`✅ ${result.fileName} -> Content ID: ${result.contentId}`);
      } else {
        logger.error(`❌ ${result.fileName} -> Error: ${result.error}`);
      }
    });

    logger.info('\n=== Processing Status ===');
    logger.info('Files are being processed in the background.');
    logger.info('Text extraction and embedding generation may take a few minutes.');
    logger.info('Check the logs for processing progress.');

    process.exit(0);

  } catch (error) {
    logger.error('Bulk upload failed:', error);
    process.exit(1);
  }
}

main();
