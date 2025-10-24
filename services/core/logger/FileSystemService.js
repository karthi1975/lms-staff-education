const fs = require('fs');
const path = require('path');

/**
 * FileSystemService
 *
 * SOLID Principle: Single Responsibility Principle (SRP)
 * Responsibility: Handle file system operations only
 *
 * This service is responsible ONLY for file system operations.
 * It doesn't know anything about logging.
 */
class FileSystemService {
  /**
   * Ensure a directory exists, create it if it doesn't
   * @param {string} dirPath - Directory path to ensure
   * @returns {boolean} - True if directory exists or was created
   */
  ensureDirectoryExists(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        return true;
      }
      return true;
    } catch (error) {
      console.error(`Failed to create directory ${dirPath}:`, error);
      return false;
    }
  }

  /**
   * Get absolute path from relative path
   * @param {...string} paths - Path segments
   * @returns {string} - Absolute path
   */
  getAbsolutePath(...paths) {
    return path.join(...paths);
  }

  /**
   * Check if path exists
   * @param {string} filePath - Path to check
   * @returns {boolean} - True if exists
   */
  exists(filePath) {
    return fs.existsSync(filePath);
  }
}

module.exports = new FileSystemService();
