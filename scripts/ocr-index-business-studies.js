#!/usr/bin/env node
/**
 * OCR-Enabled Business Studies PDF Indexing
 *
 * This script:
 * 1. Converts PDF pages to images
 * 2. Runs OCR (Tesseract) to extract text
 * 3. Chunks content intelligently
 * 4. Indexes in ChromaDB for RAG (vector similarity search)
 * 5. Creates knowledge graph in Neo4j (GraphDB for relationships)
 * 6. Ensures proper source attribution: "BUSINESS STUDIES F2.pdf"
 */

require('dotenv').config();
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const postgresService = require('../services/database/postgres.service');
const chromaService = require('../services/chroma.service');
const neo4jService = require('../services/neo4j.service');
const embeddingService = require('../services/embedding.service');
const logger = require('../utils/logger');

const execAsync = promisify(exec);

// Configuration
const PDF_PATH = 'uploads/BUSINESS_STUDIES_F2.pdf';  // Changed to relative path
const PDF_NAME = 'BUSINESS STUDIES F2.pdf';
const TEMP_DIR = '/tmp/business_studies_ocr';
const CHUNK_SIZE = 1000; // Characters per chunk

// Module mapping (from previous script)
const MODULES = {
  'Production': 13,
  'Financing small-sized businesses': 14,
  'Small business management': 15,
  'Warehousing and inventorying': 16,
  'Business opportunity identification': 17
};

class OCRIndexer {
  constructor() {
    this.totalPages = 0;
    this.extractedText = '';
    this.chunks = [];
  }

  /**
   * Main execution flow
   */
  async run() {
    try {
      console.log('🔍 OCR-Enabled Business Studies Indexing');
      console.log('==========================================\n');
      console.log(`📄 PDF: ${PDF_NAME}`);
      console.log(`📍 Path: ${PDF_PATH}`);
      console.log(`🎯 Output: ChromaDB (RAG) + Neo4j (GraphDB)\n`);

      // Initialize services
      await this.initializeServices();

      // Check dependencies
      await this.checkDependencies();

      // Prepare temp directory
      await this.prepareTempDir();

      // Convert PDF to images
      await this.convertPDFToImages();

      // Run OCR on all pages
      await this.runOCR();

      // Chunk the extracted text
      await this.chunkText();

      // Get modules from database
      const modules = await this.getModules();

      // Clean existing data
      await this.cleanExistingData(modules);

      // Index in ChromaDB + Neo4j with proper attribution
      await this.indexContent(modules);

      // Cleanup
      await this.cleanup();

      // Print summary
      this.printSummary();

      process.exit(0);

    } catch (error) {
      console.error('\n❌ Fatal error:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }

  /**
   * Initialize database and service connections
   */
  async initializeServices() {
    console.log('🔧 Initializing services...');

    await postgresService.initialize();
    console.log('  ✓ PostgreSQL connected');

    await chromaService.initialize();
    console.log('  ✓ ChromaDB connected (RAG)');

    await neo4jService.initialize();
    console.log('  ✓ Neo4j connected (GraphDB)');

    console.log('');
  }

  /**
   * Check if required OCR dependencies are installed
   */
  async checkDependencies() {
    console.log('🔍 Checking OCR dependencies...');

    try {
      const { stdout: tesseractVersion } = await execAsync('tesseract --version');
      console.log('  ✓ Tesseract OCR installed');
      console.log(`    Version: ${tesseractVersion.split('\n')[0]}`);
    } catch (error) {
      console.error('\n❌ Tesseract OCR not installed!');
      console.error('\nInstallation instructions:');
      console.error('  sudo apt-get update');
      console.error('  sudo apt-get install -y tesseract-ocr tesseract-ocr-eng poppler-utils');
      console.error('\nOr use the install script: ./scripts/install-ocr-dependencies.sh');
      throw new Error('Tesseract OCR not found');
    }

    try {
      const { stdout: pdfVersion } = await execAsync('pdftoppm -v');
      console.log('  ✓ pdftoppm installed (poppler-utils)');
    } catch (error) {
      throw new Error('pdftoppm not found. Install poppler-utils');
    }

    console.log('');
  }

  /**
   * Prepare temporary directory for image processing
   */
  async prepareTempDir() {
    console.log('📁 Preparing temporary directory...');

    try {
      await fs.rm(TEMP_DIR, { recursive: true, force: true });
    } catch (e) {
      // Directory doesn't exist, that's fine
    }

    await fs.mkdir(TEMP_DIR, { recursive: true });
    console.log(`  ✓ Created: ${TEMP_DIR}\n`);
  }

  /**
   * Convert PDF pages to images using pdftoppm
   */
  async convertPDFToImages() {
    console.log('🖼️  Converting PDF to images...');

    try {
      // Convert PDF to PNG images (one per page)
      const command = `pdftoppm -png "${PDF_PATH}" "${TEMP_DIR}/page"`;
      await execAsync(command);

      // Count generated images
      const files = await fs.readdir(TEMP_DIR);
      this.totalPages = files.filter(f => f.endsWith('.png')).length;

      console.log(`  ✓ Converted ${this.totalPages} pages to images\n`);
    } catch (error) {
      throw new Error(`PDF conversion failed: ${error.message}`);
    }
  }

  /**
   * Run OCR on all page images
   */
  async runOCR() {
    console.log('📖 Running OCR on all pages...');
    console.log('   This may take 1-2 minutes...\n');

    const pageTexts = [];

    for (let i = 1; i <= this.totalPages; i++) {
      const pageNum = String(i).padStart(String(this.totalPages).length, '0');
      const imagePath = path.join(TEMP_DIR, `page-${pageNum}.png`);
      const outputPath = path.join(TEMP_DIR, `page-${pageNum}`);

      try {
        // Run Tesseract OCR
        await execAsync(`tesseract "${imagePath}" "${outputPath}" -l eng quiet`);

        // Read extracted text
        const textPath = `${outputPath}.txt`;
        const text = await fs.readFile(textPath, 'utf8');
        pageTexts.push(text.trim());

        // Progress indicator
        if (i % 10 === 0 || i === this.totalPages) {
          console.log(`  ✓ Processed ${i}/${this.totalPages} pages`);
        }
      } catch (error) {
        console.warn(`  ⚠️  Error on page ${i}: ${error.message}`);
        pageTexts.push(''); // Add empty text for failed pages
      }
    }

    this.extractedText = pageTexts.join('\n\n').trim();
    console.log(`\n  ✓ Extracted ${this.extractedText.length} characters\n`);

    if (this.extractedText.length < 1000) {
      throw new Error('OCR extracted too little text. PDF may be encrypted or corrupted.');
    }
  }

  /**
   * Chunk text into smaller segments for better RAG retrieval
   */
  async chunkText() {
    console.log(`📦 Chunking text (${CHUNK_SIZE} chars per chunk)...`);

    // Split by paragraphs first
    const paragraphs = this.extractedText.split(/\n\n+/);

    let currentChunk = '';
    this.chunks = [];

    for (const paragraph of paragraphs) {
      if ((currentChunk + paragraph).length <= CHUNK_SIZE) {
        currentChunk += paragraph + '\n\n';
      } else {
        if (currentChunk) {
          this.chunks.push({
            content: currentChunk.trim(),
            metadata: {}
          });
        }

        // If single paragraph is too large, split by sentences
        if (paragraph.length > CHUNK_SIZE) {
          const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
          let sentenceChunk = '';

          for (const sentence of sentences) {
            if ((sentenceChunk + sentence).length <= CHUNK_SIZE) {
              sentenceChunk += sentence;
            } else {
              if (sentenceChunk) {
                this.chunks.push({
                  content: sentenceChunk.trim(),
                  metadata: {}
                });
              }
              sentenceChunk = sentence;
            }
          }

          currentChunk = sentenceChunk + '\n\n';
        } else {
          currentChunk = paragraph + '\n\n';
        }
      }
    }

    if (currentChunk) {
      this.chunks.push({
        content: currentChunk.trim(),
        metadata: {}
      });
    }

    console.log(`  ✓ Created ${this.chunks.length} chunks\n`);
  }

  /**
   * Get modules from database
   */
  async getModules() {
    const result = await postgresService.pool.query(`
      SELECT id, title, description, sequence_order
      FROM modules
      WHERE course_id = (SELECT id FROM courses WHERE code = 'BS-ENTR-001')
      ORDER BY sequence_order
    `);

    console.log(`✅ Found ${result.rows.length} modules in database\n`);
    return result.rows;
  }

  /**
   * Clean existing embeddings and graph data
   */
  async cleanExistingData(modules) {
    console.log('🧹 Cleaning existing data...');

    for (const module of modules) {
      // Clean ChromaDB
      await chromaService.deleteByMetadata({ module_id: module.id });
      console.log(`  ✓ Cleaned ChromaDB for module ${module.id}: ${module.title}`);
    }

    console.log('');
  }

  /**
   * Index content in ChromaDB (RAG) and Neo4j (GraphDB)
   */
  async indexContent(modules) {
    console.log('🚀 Indexing content in ChromaDB + Neo4j...\n');

    const chunksPerModule = Math.ceil(this.chunks.length / modules.length);
    let totalIndexed = 0;
    let totalNeo4jNodes = 0;

    for (let i = 0; i < modules.length; i++) {
      const module = modules[i];
      const startIdx = i * chunksPerModule;
      const endIdx = Math.min(startIdx + chunksPerModule, this.chunks.length);
      const moduleChunks = this.chunks.slice(startIdx, endIdx);

      console.log(`📦 Module ${i + 1}: ${module.title}`);
      console.log(`   Chunks: ${moduleChunks.length}`);

      // Update module_content record
      const contentResult = await this.upsertModuleContent(module, moduleChunks);
      const contentId = contentResult;

      // Index in ChromaDB (RAG - Vector Similarity)
      const neo4jChunks = [];
      for (let j = 0; j < moduleChunks.length; j++) {
        const chunk = moduleChunks[j];

        // Generate embedding
        const embedding = await embeddingService.generateEmbeddings(chunk.content);

        // Store in ChromaDB with source attribution
        await chromaService.addDocument(
          module.id,
          chunk.content,
          embedding,
          {
            content_id: contentId,
            module_id: module.id,
            module_title: module.title,
            file_name: PDF_NAME,
            original_file: PDF_NAME,  // ⭐ KEY: Proper source attribution
            chunk_index: startIdx + j,
            total_chunks: this.chunks.length,
            source: 'business_studies_textbook_ocr',
            extraction_method: 'tesseract_ocr'
          }
        );

        // Prepare for Neo4j GraphDB
        neo4jChunks.push({
          content: chunk.content,
          chunk_id: `${contentId}-${j}`,
          chunk_index: j,
          metadata: {
            original_file: PDF_NAME,
            module_title: module.title,
            extraction_method: 'ocr'
          }
        });

        totalIndexed++;
      }

      // Create Neo4j knowledge graph (GraphDB - Relationship mapping)
      try {
        const graphStats = await neo4jService.createContentGraph(module.id, neo4jChunks);
        totalNeo4jNodes += graphStats.chunks || 0;
        console.log(`  ✅ ChromaDB (RAG): ${moduleChunks.length} chunks`);
        console.log(`  ✅ Neo4j (GraphDB): ${graphStats.chunks || 0} nodes`);
      } catch (neo4jError) {
        console.error(`  ⚠️  Neo4j error: ${neo4jError.message}`);
      }

      console.log('');
    }

    this.indexStats = {
      totalChunks: totalIndexed,
      totalNeo4jNodes: totalNeo4jNodes,
      modules: modules.length
    };
  }

  /**
   * Update or insert module_content record
   */
  async upsertModuleContent(module, chunks) {
    const existing = await postgresService.pool.query(`
      SELECT id FROM module_content
      WHERE module_id = $1 AND file_name = $2
    `, [module.id, PDF_NAME]);

    const fullText = chunks.map(c => c.content).join('\n\n');

    if (existing.rows.length > 0) {
      // Update existing
      await postgresService.pool.query(`
        UPDATE module_content
        SET content_text = $1,
            processed = true,
            processed_at = NOW(),
            chunk_count = $2,
            metadata = $3
        WHERE id = $4
      `, [
        fullText.substring(0, 100000),
        chunks.length,
        JSON.stringify({
          source: 'business_studies_textbook',
          original_file: PDF_NAME,
          extraction_method: 'tesseract_ocr',
          indexed_at: new Date().toISOString()
        }),
        existing.rows[0].id
      ]);
      return existing.rows[0].id;
    } else {
      // Insert new
      const result = await postgresService.pool.query(`
        INSERT INTO module_content (
          module_id, file_name, original_name, file_path,
          file_type, content_text, processed, processed_at,
          chunk_count, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), $7, $8)
        RETURNING id
      `, [
        module.id,
        PDF_NAME,
        PDF_NAME,
        PDF_PATH,
        'application/pdf',
        fullText.substring(0, 100000),
        chunks.length,
        JSON.stringify({
          source: 'business_studies_textbook',
          original_file: PDF_NAME,
          extraction_method: 'tesseract_ocr',
          indexed_at: new Date().toISOString()
        })
      ]);
      return result.rows[0].id;
    }
  }

  /**
   * Cleanup temporary files
   */
  async cleanup() {
    console.log('🧹 Cleaning up temporary files...');
    try {
      await fs.rm(TEMP_DIR, { recursive: true, force: true });
      console.log('  ✓ Temporary files removed\n');
    } catch (error) {
      console.warn('  ⚠️  Cleanup failed:', error.message);
    }
  }

  /**
   * Print final summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('🎉 OCR INDEXING COMPLETE!');
    console.log('='.repeat(60));
    console.log(`\n📊 Statistics:`);
    console.log(`   PDF Source: ${PDF_NAME}`);
    console.log(`   Pages Processed: ${this.totalPages}`);
    console.log(`   Text Extracted: ${this.extractedText.length.toLocaleString()} characters`);
    console.log(`   Total Chunks: ${this.chunks.length}`);
    console.log(`   Modules: ${this.indexStats.modules}`);
    console.log(`\n🎯 RAG + GraphDB Indexing:`);
    console.log(`   ✅ ChromaDB (RAG): ${this.indexStats.totalChunks} vectors indexed`);
    console.log(`   ✅ Neo4j (GraphDB): ${this.indexStats.totalNeo4jNodes} graph nodes created`);
    console.log(`   ✅ Source Attribution: "${PDF_NAME}"`);
    console.log(`\n🧪 Test the system:`);
    console.log(`   curl -X POST http://localhost:3000/api/chat \\`);
    console.log(`     -H 'Content-Type: application/json' \\`);
    console.log(`     -d '{"phone": "test", "message": "What is production?", "language": "english"}'`);
    console.log('\n' + '='.repeat(60) + '\n');
  }
}

// Run the indexer
const indexer = new OCRIndexer();
indexer.run();
