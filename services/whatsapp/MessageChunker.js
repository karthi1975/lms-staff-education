/**
 * MessageChunker
 *
 * SOLID Principle: Single Responsibility Principle (SRP)
 * Responsibility: Split long messages into chunks ONLY
 *
 * Handles WhatsApp's 4096 character limit intelligently.
 * Respects line breaks and word boundaries.
 *
 * CORNER CASE FIX: Prevents message truncation
 */
class MessageChunker {
  constructor(maxLength) {
    this.maxLength = maxLength;
  }

  /**
   * Split long message into parts that respect line breaks
   * @param {string} text - Original message text
   * @returns {Array<string>} - Array of message chunks
   */
  split(text) {
    // If message fits, return as-is
    if (text.length <= this.maxLength) {
      return [text];
    }

    const parts = [];
    let current = '';
    const lines = text.split('\n');

    for (const line of lines) {
      // If adding this line would exceed max length
      if ((current + line + '\n').length > this.maxLength) {
        // Save accumulated text as a part
        if (current.trim()) {
          parts.push(current.trim());
          current = '';
        }

        // If single line is too long, split by words
        if (line.length > this.maxLength) {
          const wordChunks = this.splitByWords(line);
          parts.push(...wordChunks.slice(0, -1));
          current = wordChunks[wordChunks.length - 1] + '\n';
        } else {
          current = line + '\n';
        }
      } else {
        current += line + '\n';
      }
    }

    // Add remaining text as final part
    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts.length > 0 ? parts : [text];
  }

  /**
   * Split line by words if it's too long
   * @param {string} line - Line to split
   * @returns {Array<string>} - Array of word chunks
   */
  splitByWords(line) {
    const chunks = [];
    let current = '';
    const words = line.split(' ');

    for (const word of words) {
      if ((current + word + ' ').length > this.maxLength) {
        if (current.trim()) {
          chunks.push(current.trim());
          current = '';
        }
        current = word + ' ';
      } else {
        current += word + ' ';
      }
    }

    if (current.trim()) {
      chunks.push(current.trim());
    }

    return chunks.length > 0 ? chunks : [line];
  }

  /**
   * Add part numbers to chunks
   * @param {Array<string>} chunks - Message chunks
   * @returns {Array<string>} - Chunks with part numbers
   */
  addPartNumbers(chunks) {
    if (chunks.length === 1) {
      return chunks;
    }

    return chunks.map((chunk, index) => {
      return `(${index + 1}/${chunks.length})\n\n${chunk}`;
    });
  }

  /**
   * Check if message needs chunking
   * @param {string} text - Message text
   * @returns {boolean} - True if chunking needed
   */
  needsChunking(text) {
    return text.length > this.maxLength;
  }
}

module.exports = MessageChunker;
