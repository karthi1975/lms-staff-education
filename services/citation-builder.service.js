/**
 * Citation Builder Service
 * Builds formatted citations with download links for AI responses
 *
 * Supports:
 * - Web format (AI Assistant Dashboard)
 * - WhatsApp format (with full download URLs)
 * - Deduplication by file_id
 * - RBAC-aware download URLs
 * - Auto-fetches missing filenames from database
 */

const logger = require('../utils/logger');
const postgresService = require('./database/postgres.service');

class CitationBuilderService {
  constructor() {
    this.baseUrl = process.env.BASE_URL || 'http://34.162.168.124:3000';
  }

  /**
   * Build citations from retrieved document chunks
   * @param {Array} documents - Array of retrieved document chunks with metadata
   * @param {Object} options - { format: 'web'|'whatsapp', whatsappId, userId }
   * @returns {Promise<Object>} { citations: Array, citationText: string }
   */
  async buildCitations(documents, options = {}) {
    try {
      const { format = 'web', whatsappId, userId } = options;

      if (!documents || documents.length === 0) {
        return { citations: [], citationText: '' };
      }

      // Deduplicate by file_id
      const uniqueFiles = this.deduplicateByFileId(documents);

      // Collect file_ids that need filename lookup
      const fileIdsNeedingLookup = uniqueFiles
        .filter(doc => doc.metadata?.file_id && !doc.metadata?.filename)
        .map(doc => doc.metadata.file_id);

      // Fetch missing filenames from database
      const filenameMap = await this.fetchFilenames(fileIdsNeedingLookup);

      // Build citation objects
      const citations = uniqueFiles.map((doc, index) => {
        const metadata = doc.metadata || {};
        const fileId = metadata.file_id;

        // Get filename: from metadata, or from database lookup, or default
        let filename = metadata.filename;
        if (!filename && fileId && filenameMap[fileId]) {
          filename = filenameMap[fileId];
        }
        if (!filename) {
          filename = 'Document';
        }

        let downloadUrl = '';
        if (fileId) {
          downloadUrl = `${this.baseUrl}/api/files/download/${fileId}`;
          if (whatsappId && !userId) {
            downloadUrl += `?whatsapp_id=${encodeURIComponent(whatsappId)}`;
          }
        }

        return {
          index: index + 1,
          filename,
          fileId,
          downloadUrl,
          language: metadata.language || 'unknown',
          fileSize: metadata.file_size
        };
      });

      // Format citations based on channel
      const citationText = format === 'whatsapp'
        ? this.formatWhatsAppCitations(citations)
        : this.formatWebCitations(citations);

      return {
        citations,
        citationText
      };

    } catch (error) {
      logger.error('[CitationBuilder] Error building citations:', error);
      return { citations: [], citationText: '' };
    }
  }

  /**
   * Fetch filenames from database for file_ids
   * @param {Array} fileIds - Array of file_ids
   * @returns {Promise<Object>} Map of file_id -> filename
   */
  async fetchFilenames(fileIds) {
    if (!fileIds || fileIds.length === 0) {
      return {};
    }

    try {
      const query = `
        SELECT id, original_name
        FROM course_content
        WHERE id = ANY($1::int[])
      `;

      const result = await postgresService.query(query, [fileIds]);

      const filenameMap = {};
      result.rows.forEach(row => {
        filenameMap[row.id] = row.original_name;
      });

      if (Object.keys(filenameMap).length > 0) {
        logger.info(`[CitationBuilder] Fetched ${Object.keys(filenameMap).length} filenames from database`);
      }

      return filenameMap;

    } catch (error) {
      logger.error('[CitationBuilder] Error fetching filenames:', error);
      return {};
    }
  }

  /**
   * Deduplicate documents by file_id
   * @param {Array} documents
   * @returns {Array} Unique documents
   */
  deduplicateByFileId(documents) {
    const seen = new Set();
    const unique = [];

    for (const doc of documents) {
      const fileId = doc.metadata?.file_id;

      // If no file_id, include based on filename
      const key = fileId || doc.metadata?.filename;

      if (key && !seen.has(key)) {
        seen.add(key);
        unique.push(doc);
      }
    }

    return unique;
  }

  /**
   * Format citations for web (AI Assistant Dashboard)
   * @param {Array} citations
   * @returns {string}
   */
  formatWebCitations(citations) {
    if (citations.length === 0) return '';

    let text = '\n\n📚 **Sources:**\n';

    citations.forEach((citation) => {
      const icon = this.getFileIcon(citation.filename);

      if (citation.downloadUrl) {
        text += `${icon} [${citation.filename}](${citation.downloadUrl})\n`;
      } else {
        text += `${icon} ${citation.filename}\n`;
      }
    });

    return text;
  }

  /**
   * Format citations for WhatsApp
   * @param {Array} citations
   * @returns {string}
   */
  formatWhatsAppCitations(citations) {
    if (citations.length === 0) return '';

    let text = '\n\n📚 *Sources:*\n';

    citations.forEach((citation) => {
      const icon = this.getFileIcon(citation.filename);

      text += `\n${icon} *${citation.filename}*`;

      if (citation.downloadUrl) {
        text += `\n   📥 Download: ${citation.downloadUrl}`;
      }

      text += '\n';
    });

    return text;
  }

  /**
   * Get appropriate icon for file type
   * @param {string} filename
   * @returns {string} Emoji icon
   */
  getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();

    const icons = {
      'pdf': '📄',
      'doc': '📝',
      'docx': '📝',
      'txt': '📃',
      'md': '📃',
      'ppt': '📊',
      'pptx': '📊',
      'xls': '📈',
      'xlsx': '📈',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'png': '🖼️',
      'gif': '🖼️'
    };

    return icons[ext] || '📄';
  }

  /**
   * Build inline citation markers for answer text
   * @param {string} answerText - AI generated answer
   * @param {Array} citations - Citation objects
   * @returns {string} Answer with citation markers
   */
  addInlineCitations(answerText, citations) {
    if (!citations || citations.length === 0) return answerText;

    // Add citation markers at the end of key sentences/paragraphs
    // For now, just add all citations at the end
    const citationMarkers = citations
      .map((c, i) => `[${i + 1}]`)
      .join('');

    return answerText + ' ' + citationMarkers;
  }

  /**
   * Format file size for display
   * @param {number} bytes
   * @returns {string}
   */
  formatFileSize(bytes) {
    if (!bytes) return '';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

module.exports = new CitationBuilderService();
