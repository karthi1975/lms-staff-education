#!/usr/bin/env node
/**
 * Cleanup Orphaned Upload Files
 *
 * This script:
 * 1. Scans uploads/ directory for all files
 * 2. Checks which files are tracked in module_content table
 * 3. Identifies orphaned files (not in database)
 * 4. Optionally deletes orphaned files
 *
 * Usage:
 *   node scripts/cleanup-orphaned-files.js --dry-run    # Preview only
 *   node scripts/cleanup-orphaned-files.js --delete     # Actually delete
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const postgresService = require('../services/database/postgres.service');
const logger = require('../utils/logger');

const UPLOADS_DIR = path.join(__dirname, '../uploads');

class OrphanedFilesCleanup {
  constructor(options = {}) {
    this.dryRun = options.dryRun !== false;  // Default to dry-run
    this.deletedCount = 0;
    this.skippedCount = 0;
    this.totalSize = 0;
  }

  async run() {
    try {
      console.log('🗑️  Orphaned Files Cleanup Tool');
      console.log('================================\n');
      console.log(`Mode: ${this.dryRun ? '🔍 DRY RUN (preview only)' : '⚠️  DELETE MODE'}`);
      console.log(`Directory: ${UPLOADS_DIR}\n`);

      // Initialize PostgreSQL
      await postgresService.initialize();

      // Get all files in uploads directory
      const uploadedFiles = await this.scanUploadsDirectory();
      console.log(`📁 Found ${uploadedFiles.length} file(s) in uploads/ directory\n`);

      if (uploadedFiles.length === 0) {
        console.log('✅ No files to process');
        return;
      }

      // Get all tracked file paths from database
      const trackedFiles = await this.getTrackedFiles();
      console.log(`📊 Found ${trackedFiles.size} file(s) tracked in database\n`);

      // Find orphaned files
      const orphanedFiles = this.findOrphanedFiles(uploadedFiles, trackedFiles);
      console.log(`🔍 Found ${orphanedFiles.length} orphaned file(s)\n`);

      if (orphanedFiles.length === 0) {
        console.log('✅ No orphaned files to clean up!');
        return;
      }

      // Display orphaned files
      this.displayOrphanedFiles(orphanedFiles);

      // Delete if not dry-run
      if (!this.dryRun) {
        console.log('\n⚠️  Starting deletion...\n');
        await this.deleteOrphanedFiles(orphanedFiles);
      }

      // Summary
      this.displaySummary();

    } catch (error) {
      logger.error('Cleanup failed:', error);
      throw error;
    } finally {
      await postgresService.close();
    }
  }

  /**
   * Scan uploads directory and return all file paths
   */
  async scanUploadsDirectory() {
    try {
      const files = await fs.readdir(UPLOADS_DIR);
      const fileDetails = [];

      for (const filename of files) {
        const fullPath = path.join(UPLOADS_DIR, filename);
        const stats = await fs.stat(fullPath);

        if (stats.isFile()) {
          fileDetails.push({
            filename,
            fullPath,
            relativePath: `uploads/${filename}`,
            size: stats.size,
            modified: stats.mtime
          });
        }
      }

      return fileDetails;
    } catch (error) {
      logger.error('Error scanning uploads directory:', error);
      return [];
    }
  }

  /**
   * Get all file paths tracked in module_content table
   */
  async getTrackedFiles() {
    const result = await postgresService.pool.query(
      'SELECT DISTINCT file_path FROM module_content'
    );

    // Create Set of normalized paths (handle both absolute and relative)
    const trackedPaths = new Set();

    for (const row of result.rows) {
      const filePath = row.file_path;

      // Add original path
      trackedPaths.add(filePath);

      // Add normalized variations
      if (path.isAbsolute(filePath)) {
        // Extract filename and add relative path
        const filename = path.basename(filePath);
        trackedPaths.add(`uploads/${filename}`);
      } else {
        // Add just the filename
        const filename = path.basename(filePath);
        trackedPaths.add(filename);
      }
    }

    return trackedPaths;
  }

  /**
   * Find files that exist on disk but not in database
   */
  findOrphanedFiles(uploadedFiles, trackedFiles) {
    return uploadedFiles.filter(file => {
      // Check if file is tracked using any path variation
      const isTracked = trackedFiles.has(file.relativePath) ||
                       trackedFiles.has(file.fullPath) ||
                       trackedFiles.has(file.filename);

      return !isTracked;
    });
  }

  /**
   * Display list of orphaned files
   */
  displayOrphanedFiles(files) {
    console.log('📋 Orphaned Files:');
    console.log('─'.repeat(80));

    for (const file of files) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      const modifiedDate = file.modified.toISOString().split('T')[0];
      console.log(`  📄 ${file.filename}`);
      console.log(`     Size: ${sizeMB} MB | Modified: ${modifiedDate}`);
    }

    const totalMB = files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024;
    console.log('─'.repeat(80));
    console.log(`  Total: ${files.length} file(s), ${totalMB.toFixed(2)} MB`);
  }

  /**
   * Delete orphaned files
   */
  async deleteOrphanedFiles(files) {
    for (const file of files) {
      try {
        await fs.unlink(file.fullPath);
        this.deletedCount++;
        this.totalSize += file.size;
        console.log(`✅ Deleted: ${file.filename}`);
      } catch (error) {
        this.skippedCount++;
        console.log(`❌ Failed to delete: ${file.filename} - ${error.message}`);
      }
    }
  }

  /**
   * Display summary
   */
  displaySummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 Summary');
    console.log('='.repeat(80));

    if (this.dryRun) {
      console.log('  Mode: 🔍 DRY RUN (no files were deleted)');
      console.log(`  Would delete: ${this.deletedCount} file(s)`);
    } else {
      console.log('  Mode: ⚠️  DELETE');
      console.log(`  ✅ Deleted: ${this.deletedCount} file(s)`);
      console.log(`  ❌ Failed: ${this.skippedCount} file(s)`);
      const sizeMB = (this.totalSize / 1024 / 1024).toFixed(2);
      console.log(`  💾 Freed: ${sizeMB} MB`);
    }

    console.log('='.repeat(80));

    if (this.dryRun) {
      console.log('\n💡 To actually delete files, run:');
      console.log('   node scripts/cleanup-orphaned-files.js --delete');
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = !args.includes('--delete');

// Run cleanup
const cleanup = new OrphanedFilesCleanup({ dryRun });
cleanup.run()
  .then(() => {
    console.log('\n✅ Cleanup completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  });
