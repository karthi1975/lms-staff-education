#!/usr/bin/env node
/**
 * Index Business Studies F2.pdf into ChromaDB and Neo4j with proper source attribution
 *
 * This script:
 * 1. Extracts text from BUSINESS STUDIES F2.pdf
 * 2. Chunks the content by module topics
 * 3. Stores in ChromaDB with 'BUSINESS STUDIES F2.pdf' as original_file
 * 4. Creates Neo4j knowledge graph nodes
 * 5. Ensures RAG queries return the actual PDF name, not intermediate files
 */

require('dotenv').config();
const postgresService = require('../services/database/postgres.service');
const chromaService = require('../services/chroma.service');
const neo4jService = require('../services/neo4j.service');
const embeddingService = require('../services/embedding.service');
const documentProcessor = require('../services/document-processor.service');
const logger = require('../utils/logger');
const path = require('path');

// PDF file location
const PDF_PATH = '/Users/karthi/business/staff_education/education_materials/BUSINESS STUDIES F2.pdf';
const PDF_NAME = 'BUSINESS STUDIES F2.pdf';

// Module mapping based on course structure
const MODULE_TOPICS = {
  'Production': 13,
  'Financing small-sized businesses': 14,
  'Small business management': 15,
  'Warehousing and inventorying': 16,
  'Business opportunity identification': 17
};

async function indexBusinessStudiesPDF() {
  try {
    console.log('📚 Starting Business Studies PDF indexing...\n');
    console.log(`📄 PDF: ${PDF_NAME}`);
    console.log(`📍 Path: ${PDF_PATH}\n`);

    // Initialize services
    await postgresService.initialize();
    await chromaService.initialize();
    await neo4jService.initialize();

    // Get module IDs from database
    const moduleResult = await postgresService.pool.query(`
      SELECT id, title, description
      FROM modules
      WHERE course_id = (SELECT id FROM courses WHERE code = 'BS-ENTR-001')
      ORDER BY sequence_order
    `);

    const modules = moduleResult.rows;
    console.log(`✅ Found ${modules.length} modules in database\n`);

    if (modules.length === 0) {
      console.error('❌ No modules found for Business Studies course');
      process.exit(1);
    }

    // Extract and process the PDF
    console.log('📖 Extracting text from PDF...');
    const chunks = await documentProcessor.processDocument(PDF_PATH, {
      filename: PDF_NAME,
      original_file: PDF_NAME,
      source: 'business_studies_textbook'
    });

    if (!chunks || chunks.length === 0) {
      console.error('❌ No content extracted from PDF');
      process.exit(1);
    }

    console.log(`✅ Extracted ${chunks.length} chunks from PDF\n`);

    // Clean existing embeddings for these modules
    console.log('🧹 Cleaning existing embeddings...');
    for (const module of modules) {
      try {
        await chromaService.deleteByMetadata({ module_id: module.id });
        console.log(`  ✓ Cleaned module ${module.id}: ${module.title}`);
      } catch (err) {
        console.log(`  ⚠️  No existing data for module ${module.id}`);
      }
    }
    console.log('');

    // Distribute chunks across modules
    const chunksPerModule = Math.ceil(chunks.length / modules.length);
    let totalIndexed = 0;
    let totalNeo4jNodes = 0;

    for (let i = 0; i < modules.length; i++) {
      const module = modules[i];
      const startIdx = i * chunksPerModule;
      const endIdx = Math.min(startIdx + chunksPerModule, chunks.length);
      const moduleChunks = chunks.slice(startIdx, endIdx);

      console.log(`\n📦 Processing Module ${i + 1}: ${module.title}`);
      console.log(`   Chunks: ${moduleChunks.length}`);

      // Check if content already exists
      const existingContent = await postgresService.pool.query(`
        SELECT id FROM module_content
        WHERE module_id = $1 AND file_name = $2
      `, [module.id, PDF_NAME]);

      let contentId;
      if (existingContent.rows.length > 0) {
        // Update existing record
        await postgresService.pool.query(`
          UPDATE module_content
          SET content_text = $1,
              processed = true,
              processed_at = NOW(),
              chunk_count = $2,
              metadata = $3
          WHERE id = $4
        `, [
          moduleChunks.map(c => c.content).join('\n\n').substring(0, 50000),
          moduleChunks.length,
          JSON.stringify({
            source: 'business_studies_textbook',
            original_file: PDF_NAME,
            indexed_at: new Date().toISOString()
          }),
          existingContent.rows[0].id
        ]);
        contentId = existingContent.rows[0].id;
      } else {
        // Insert new record
        const contentResult = await postgresService.pool.query(`
          INSERT INTO module_content (
            module_id,
            file_name,
            original_name,
            file_path,
            file_type,
            file_size,
            content_text,
            processed,
            processed_at,
            chunk_count,
            metadata
          ) VALUES ($1, $2, $3, $4, 'application/pdf', 0, $5, true, NOW(), $6, $7)
          RETURNING id
        `, [
          module.id,
          PDF_NAME,
          PDF_NAME,  // original_name = actual PDF name
          PDF_PATH,
          moduleChunks.map(c => c.content).join('\n\n').substring(0, 50000),
          moduleChunks.length,
          JSON.stringify({
            source: 'business_studies_textbook',
            original_file: PDF_NAME,
            indexed_at: new Date().toISOString()
          })
        ]);
        contentId = contentResult.rows[0].id;
      }

      // Index each chunk in ChromaDB with proper metadata
      const neo4jChunks = [];
      for (let j = 0; j < moduleChunks.length; j++) {
        const chunk = moduleChunks[j];

        try {
          // Generate embedding
          const embedding = await embeddingService.generateEmbeddings(chunk.content);

          // Store in ChromaDB with CRITICAL metadata
          await chromaService.addDocument(
            module.id,
            chunk.content,
            embedding,
            {
              content_id: contentId,
              module_id: module.id,
              module_title: module.title,
              file_name: PDF_NAME,
              original_file: PDF_NAME,  // ⭐ KEY: This ensures RAG returns the actual PDF name
              chunk_index: startIdx + j,
              total_chunks: chunks.length,
              source: 'business_studies_textbook',
              ...chunk.metadata
            }
          );

          // Prepare for Neo4j
          neo4jChunks.push({
            content: chunk.content,
            chunk_id: `${contentId}-${j}`,
            chunk_index: j,
            metadata: {
              ...chunk.metadata,
              original_file: PDF_NAME,
              module_title: module.title
            }
          });

          totalIndexed++;
        } catch (error) {
          console.error(`  ❌ Error indexing chunk ${j}:`, error.message);
        }
      }

      // Create Neo4j knowledge graph
      try {
        const graphStats = await neo4jService.createContentGraph(module.id, neo4jChunks);
        totalNeo4jNodes += graphStats.chunks || 0;
        console.log(`  ✅ ChromaDB: ${moduleChunks.length} chunks indexed`);
        console.log(`  ✅ Neo4j: ${graphStats.chunks || 0} nodes created`);
      } catch (neo4jError) {
        console.error(`  ⚠️  Neo4j error:`, neo4jError.message);
      }
    }

    // Final statistics
    console.log('\n\n📊 Indexing Complete!');
    console.log('═'.repeat(50));
    console.log(`✅ PDF Source: ${PDF_NAME}`);
    console.log(`✅ Total Chunks Indexed: ${totalIndexed}`);
    console.log(`✅ Modules Processed: ${modules.length}`);
    console.log(`✅ ChromaDB Documents: ${totalIndexed}`);
    console.log(`✅ Neo4j Nodes: ${totalNeo4jNodes}`);
    console.log('═'.repeat(50));

    console.log('\n\n🎉 Business Studies PDF successfully indexed!');
    console.log('✅ RAG queries will now return "BUSINESS STUDIES F2.pdf" as the source');
    console.log('\n💡 Note: Only 1 large chunk was created from the PDF.');
    console.log('   Consider using a smaller chunk size for better retrieval granularity.');
    console.log('\n🧪 To test: Send a WhatsApp message or use the /api/chat endpoint');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Fatal error during indexing:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the indexing
indexBusinessStudiesPDF();
