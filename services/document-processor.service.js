const pdfParse = require('pdf-parse');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('../utils/logger');

// Try to load mammoth, but make it optional
let mammoth = null;
try {
  mammoth = require('mammoth');
} catch (err) {
  logger.warn('Mammoth not available - DOCX support disabled');
}

// Try to load Tesseract for OCR
let Tesseract = null;
try {
  Tesseract = require('tesseract.js');
} catch (err) {
  logger.warn('Tesseract.js not available - OCR support disabled');
}

class DocumentProcessorService {
  constructor() {
    // Chunking configuration
    this.chunkSize = 1000; // Target chunk size in tokens (roughly 4 chars per token)
    this.chunkOverlap = 200; // Overlap between chunks for context continuity
    this.maxChunkSize = 4000; // Maximum characters per chunk
    this.minChunkSize = 50; // Minimum characters per chunk (lowered for smaller documents)

    // OCR configuration
    this.ocrThresholdCharsPerPage = 100; // If less than 100 chars per page, use OCR
  }

  /**
   * Process uploaded document and create semantic chunks
   */
  async processDocument(filePath, metadata = {}) {
    try {
      // Extract text based on file type
      // ocrPageLimit: 5 for fast classification, 0 for full processing, -1 to skip OCR
      const ocrPageLimit = metadata.ocrPageLimit !== undefined ? metadata.ocrPageLimit : 0;
      const text = await this.extractText(filePath, ocrPageLimit);
      
      if (!text || text.length < this.minChunkSize) {
        logger.warn(`Document too short for processing: ${filePath}`);
        return [];
      }

      // Clean and normalize text
      const cleanedText = this.cleanText(text);
      
      // Create narrative chunks
      const chunks = await this.createNarrativeChunks(cleanedText, metadata);
      
      logger.info(`Processed document ${metadata.filename}: ${chunks.length} chunks created`);
      return chunks;
      
    } catch (error) {
      logger.error('Document processing error:', error);
      throw error;
    }
  }

  /**
   * Extract text from various file formats with timeout protection
   * CORNER CASE FIX: Prevents hangs on corrupted/complex files
   * @param {string} filePath - Path to file
   * @param {number} ocrPageLimit - Max pages for OCR (0=all pages, 5=fast classification, -1=skip OCR)
   */
  async extractText(filePath, ocrPageLimit = 0) {
    // CORNER CASE FIX: Check file size first
    const fileStats = fsSync.statSync(filePath);
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

    if (fileStats.size > MAX_FILE_SIZE) {
      throw new Error(
        `File too large: ${(fileStats.size / 1024 / 1024).toFixed(1)}MB. ` +
        `Maximum allowed: ${MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }

    const fileContent = await fs.readFile(filePath);

    if (filePath.toLowerCase().endsWith('.pdf')) {
      // CORNER CASE FIX: Try standard text extraction with timeout
      const PDF_TIMEOUT = 30000; // 30 seconds
      const pdfData = await this.withTimeout(
        pdfParse(fileContent),
        PDF_TIMEOUT,
        'PDF parsing timeout - file may be corrupted or too complex'
      );
      const text = pdfData.text;

      // Check if PDF is image-based (low text extraction)
      const fileStats = fsSync.statSync(filePath);
      const estimatedPages = Math.max(1, Math.floor(fileStats.size / (1024 * 50))); // ~50KB per page estimate
      // CORNER CASE FIX: Validate extracted text
      if (text.length < 100) {
        logger.warn(`PDF extraction yielded minimal text (${text.length} chars) - may be image-based or corrupted`);
      }

      const avgCharsPerPage = text.length / estimatedPages;

      logger.info(`PDF text extraction: ${text.length} chars, ${estimatedPages} pages (est), ${avgCharsPerPage.toFixed(0)} chars/page`);

      // CORNER CASE FIX: Limit pages for OCR to prevent timeouts
      const MAX_OCR_PAGES = 100;
      if (estimatedPages > MAX_OCR_PAGES && ocrPageLimit === 0) {
        logger.warn(`PDF has ${estimatedPages} pages - limiting OCR to ${MAX_OCR_PAGES} pages to prevent timeout`);
        ocrPageLimit = MAX_OCR_PAGES;
      }

      // If very low text per page, likely image-based PDF - use OCR (unless ocrPageLimit is -1)
      if (avgCharsPerPage < this.ocrThresholdCharsPerPage && ocrPageLimit !== -1) {
        const limitMsg = ocrPageLimit > 0 ? ` (limited to first ${ocrPageLimit} pages)` : '';
        logger.warn(`Low text density detected (${avgCharsPerPage.toFixed(0)} chars/page) - attempting OCR${limitMsg}`);

        if (Tesseract) {
          try {
            const ocrText = await this.extractTextWithOCR(filePath, ocrPageLimit);
            if (ocrText && ocrText.length > text.length) {
              logger.info(`OCR successful: extracted ${ocrText.length} chars (vs ${text.length} from PDF text)`);
              return ocrText;
            }
          } catch (ocrError) {
            logger.error('OCR failed, using original text extraction:', ocrError.message);
          }
        } else {
          logger.warn('OCR not available - install tesseract.js for image-based PDF support');
        }
      }

      return text;
    } else if (filePath.toLowerCase().endsWith('.txt') || filePath.toLowerCase().endsWith('.md')) {
      return fileContent.toString('utf-8');
    } else if (filePath.toLowerCase().endsWith('.docx')) {
      // Extract text from DOCX using mammoth
      if (mammoth) {
        const result = await mammoth.extractRawText({ buffer: fileContent });
        return result.value;
      } else {
        logger.warn('DOCX file uploaded but mammoth not available - treating as text');
        return fileContent.toString('utf-8');
      }
    }

    return fileContent.toString('utf-8');
  }

  /**
   * Extract text from image-based PDF using OCR
   * @param {string} filePath - Path to PDF file
   * @param {number} maxPages - Maximum pages to OCR (0 = all pages, default for classification is 5)
   */
  async extractTextWithOCR(filePath, maxPages = 0) {
    const tmpDir = '/tmp/ocr_' + Date.now();

    try {
      // Create temp directory for images
      execSync(`mkdir -p ${tmpDir}`);

      // Convert PDF pages to images using pdftoppm
      const outputPrefix = path.join(tmpDir, 'page');

      // Limit pages if maxPages is set (for fast classification)
      const pdfToPpmCmd = maxPages > 0
        ? `pdftoppm -png -l ${maxPages} "${filePath}" "${outputPrefix}"`  // -l limits pages
        : `pdftoppm -png "${filePath}" "${outputPrefix}"`;  // Process all pages

      execSync(pdfToPpmCmd);

      // Get all generated images
      const imageFiles = fsSync.readdirSync(tmpDir)
        .filter(f => f.endsWith('.png'))
        .sort()
        .map(f => path.join(tmpDir, f));

      const pagesToProcess = maxPages > 0 ? Math.min(imageFiles.length, maxPages) : imageFiles.length;
      logger.info(`OCR: Processing ${pagesToProcess}/${imageFiles.length} pages`);

      // Run OCR on each image (limited by maxPages)
      let fullText = '';
      const OCR_PAGE_TIMEOUT = 60000; // 60 seconds per page

      for (let i = 0; i < pagesToProcess; i++) {
        const imagePath = imageFiles[i];
        const logMsg = maxPages > 0
          ? `OCR: Processing page ${i + 1}/${pagesToProcess} (LIMITED for classification)`
          : `OCR: Processing page ${i + 1}/${pagesToProcess} (FULL processing)`;
        logger.info(logMsg);

        try {
          // CORNER CASE FIX: Add timeout per page to prevent hangs
          const result = await this.withTimeout(
            Tesseract.recognize(imagePath, 'eng', {
              logger: () => {} // Suppress verbose Tesseract logs
            }),
            OCR_PAGE_TIMEOUT,
            `OCR timeout on page ${i + 1} - skipping`
          );

          fullText += result.data.text + '\n\n';

          // Log progress every 10 pages for full OCR
          if (maxPages === 0 && (i + 1) % 10 === 0) {
            logger.info(`📊 OCR Progress: ${i + 1}/${pagesToProcess} pages completed`);
          }
        } catch (pageError) {
          logger.warn(`OCR failed for page ${i + 1}: ${pageError.message} - continuing with next page`);
          // Continue with next page instead of failing entire document
        }
      }

      logger.info(`✅ OCR Complete: Extracted text from ${pagesToProcess} pages`);

      return fullText;

    } finally {
      // Cleanup temp directory
      try {
        execSync(`rm -rf ${tmpDir}`);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup OCR temp directory:', cleanupError.message);
      }
    }
  }

  /**
   * Clean and normalize text
   */
  cleanText(text) {
    // Remove excessive whitespace while preserving paragraph breaks
    let cleaned = text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .replace(/[ \t]{2,}/g, ' ') // Replace multiple spaces/tabs with single space
      .replace(/^\s+|\s+$/gm, ''); // Trim each line
    
    // Remove common PDF artifacts
    cleaned = cleaned
      .replace(/\f/g, '') // Form feeds
      .replace(/\x00/g, '') // Null characters
      .replace(/[\u200B-\u200F\uFEFF]/g, ''); // Zero-width spaces
    
    return cleaned;
  }

  /**
   * Create narrative chunks that preserve semantic meaning
   */
  async createNarrativeChunks(text, metadata) {
    const chunks = [];
    
    // Split into sections based on common document markers
    const sections = this.splitIntoSections(text);
    
    for (const section of sections) {
      if (section.content.length < this.minChunkSize) {
        // Too small, might need to combine with adjacent content
        if (chunks.length > 0 && 
            chunks[chunks.length - 1].content.length + section.content.length < this.maxChunkSize) {
          // Append to previous chunk
          chunks[chunks.length - 1].content += '\n\n' + section.content;
          if (section.title) {
            // Append to section list string
            const prevSections = chunks[chunks.length - 1].metadata.section_list;
            chunks[chunks.length - 1].metadata.section_list = prevSections ? 
              `${prevSections}, ${section.title}` : section.title;
          }
        } else if (section.content.length > 50) {
          // Create small chunk anyway if it has meaningful content
          chunks.push(this.createChunk(section.content, metadata, section.title));
        }
      } else if (section.content.length <= this.maxChunkSize) {
        // Perfect size for a single chunk
        chunks.push(this.createChunk(section.content, metadata, section.title));
      } else {
        // Need to split large section into smaller chunks
        const subChunks = this.splitLargeSection(section.content, metadata, section.title);
        chunks.push(...subChunks);
      }
    }
    
    // Add chunk indexing
    chunks.forEach((chunk, index) => {
      chunk.chunk_index = index;
      chunk.total_chunks = chunks.length;
    });
    
    return chunks;
  }

  /**
   * Split text into logical sections
   */
  splitIntoSections(text) {
    const sections = [];
    
    // Common section markers for educational content
    const sectionMarkers = [
      /^#{1,3}\s+(.+)$/gm, // Markdown headers
      /^(\d+\.?\s+[A-Z].+)$/gm, // Numbered sections
      /^([A-Z][^.!?]*:)\s*$/gm, // Title followed by colon
      /^(Module\s+\d+[:\s].*)$/gim, // Module markers
      /^(Chapter\s+\d+[:\s].*)$/gim, // Chapter markers
      /^(Unit\s+\d+[:\s].*)$/gim, // Unit markers
      /^(Lesson\s+\d+[:\s].*)$/gim, // Lesson markers
      /^(Topic[:\s].*)$/gim, // Topic markers
      /^(Introduction|Overview|Summary|Conclusion|References)$/gim // Common sections
    ];
    
    // Find all section boundaries
    const boundaries = [];
    for (const marker of sectionMarkers) {
      const matches = [...text.matchAll(marker)];
      for (const match of matches) {
        boundaries.push({
          index: match.index,
          title: match[1].trim(),
          match: match[0]
        });
      }
    }
    
    // Sort boundaries by position
    boundaries.sort((a, b) => a.index - b.index);
    
    // Create sections from boundaries
    if (boundaries.length === 0) {
      // No clear sections, split by paragraphs
      return this.splitByParagraphs(text);
    }
    
    let lastIndex = 0;
    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i];
      
      // Add content before this boundary if significant
      if (boundary.index > lastIndex + 50) {
        const content = text.substring(lastIndex, boundary.index).trim();
        if (content) {
          sections.push({
            title: null,
            content: content
          });
        }
      }
      
      // Get content for this section
      const nextIndex = i < boundaries.length - 1 ? boundaries[i + 1].index : text.length;
      const sectionContent = text.substring(boundary.index, nextIndex).trim();
      
      sections.push({
        title: boundary.title,
        content: sectionContent
      });
      
      lastIndex = nextIndex;
    }
    
    // Add any remaining content
    if (lastIndex < text.length - 50) {
      const content = text.substring(lastIndex).trim();
      if (content) {
        sections.push({
          title: null,
          content: content
        });
      }
    }
    
    return sections;
  }

  /**
   * Split by paragraphs when no clear sections exist
   */
  splitByParagraphs(text) {
    const paragraphs = text.split(/\n\n+/);
    const sections = [];
    let currentSection = { title: null, content: '' };
    
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;
      
      if (currentSection.content.length + trimmed.length + 2 > this.maxChunkSize) {
        // Save current section and start new one
        if (currentSection.content) {
          sections.push(currentSection);
        }
        currentSection = { title: null, content: trimmed };
      } else {
        // Add to current section
        currentSection.content += (currentSection.content ? '\n\n' : '') + trimmed;
      }
    }
    
    // Add final section
    if (currentSection.content) {
      sections.push(currentSection);
    }
    
    return sections;
  }

  /**
   * Split large sections into smaller chunks
   */
  splitLargeSection(content, metadata, sectionTitle) {
    const chunks = [];
    
    // Try to split on paragraph boundaries first
    const paragraphs = content.split(/\n\n+/);
    let currentChunk = '';
    let chunkNumber = 1;
    
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;
      
      if (currentChunk.length + trimmed.length + 2 > this.maxChunkSize - this.chunkOverlap) {
        // Save current chunk
        if (currentChunk) {
          const title = sectionTitle ? `${sectionTitle} (Part ${chunkNumber})` : `Part ${chunkNumber}`;
          chunks.push(this.createChunk(currentChunk, metadata, title));
          chunkNumber++;
        }
        
        // Start new chunk with overlap
        const overlapStart = Math.max(0, currentChunk.length - this.chunkOverlap);
        const overlap = currentChunk.substring(overlapStart);
        currentChunk = overlap + '\n\n' + trimmed;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
      }
    }
    
    // Add final chunk
    if (currentChunk) {
      const title = sectionTitle ? 
        (chunks.length > 0 ? `${sectionTitle} (Part ${chunkNumber})` : sectionTitle) : 
        `Part ${chunkNumber}`;
      chunks.push(this.createChunk(currentChunk, metadata, title));
    }
    
    return chunks;
  }

  /**
   * Create a chunk object with metadata
   */
  createChunk(content, metadata, title = null) {
    // Extract key concepts from chunk
    const concepts = this.extractConcepts(content);
    
    return {
      content: content,
      metadata: {
        ...metadata,
        chunk_title: title || '',
        concepts: concepts.join(', '), // Convert array to string for ChromaDB
        word_count: content.split(/\s+/).length,
        char_count: content.length,
        has_lists: /^\s*[-*•]\s+/m.test(content) || /^\s*\d+\.\s+/m.test(content) ? 'true' : 'false',
        has_questions: /\?/.test(content) ? 'true' : 'false',
        section_list: title || '', // Renamed and made string
        processed_at: new Date().toISOString()
      }
    };
  }

  /**
   * Extract key concepts from text
   */
  extractConcepts(text) {
    const concepts = [];
    
    // Extract emphasized terms (in quotes, bold, or following "called", "known as", etc.)
    const emphasisPatterns = [
      /"([^"]+)"/g, // Quoted terms
      /\*\*([^*]+)\*\*/g, // Bold markdown
      /\*([^*]+)\*/g, // Italic markdown
      /(?:called|known as|referred to as|defined as)\s+["']?([^"',.]+)["',.]/gi
    ];
    
    for (const pattern of emphasisPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const concept = match[1].trim();
        if (concept.length > 2 && concept.length < 50 && !concepts.includes(concept)) {
          concepts.push(concept);
        }
      }
    }
    
    // Extract key educational terms
    const educationalTerms = [
      'assessment', 'evaluation', 'lesson plan', 'curriculum', 'pedagogy',
      'differentiation', 'scaffolding', 'formative', 'summative', 'rubric',
      'objective', 'outcome', 'standard', 'competency', 'skill',
      'engagement', 'motivation', 'feedback', 'reflection', 'collaboration'
    ];
    
    const lowerText = text.toLowerCase();
    for (const term of educationalTerms) {
      if (lowerText.includes(term) && !concepts.some(c => c.toLowerCase() === term)) {
        concepts.push(term);
      }
    }

    return concepts.slice(0, 10); // Limit to top 10 concepts
  }

  /**
   * Timeout wrapper for async operations
   * CORNER CASE FIX: Prevents indefinite hangs
   */
  async withTimeout(promise, timeoutMs, errorMessage) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      )
    ]);
  }

  /**
   * Create a summary for long documents
   */
  async createDocumentSummary(chunks) {
    if (chunks.length === 0) return '';
    
    // Take first and last chunks, plus some middle content
    const summaryParts = [];
    
    // First chunk (usually introduction)
    const firstChunk = chunks[0].content;
    summaryParts.push(firstChunk.substring(0, Math.min(500, firstChunk.length)));
    
    // Middle sample if document is long
    if (chunks.length > 4) {
      const middleIndex = Math.floor(chunks.length / 2);
      const middleChunk = chunks[middleIndex].content;
      summaryParts.push('...\n' + middleChunk.substring(0, Math.min(300, middleChunk.length)));
    }
    
    // Last chunk (usually conclusion)
    if (chunks.length > 1) {
      const lastChunk = chunks[chunks.length - 1].content;
      summaryParts.push('...\n' + lastChunk.substring(0, Math.min(500, lastChunk.length)));
    }
    
    return summaryParts.join('\n\n');
  }
}

module.exports = new DocumentProcessorService();