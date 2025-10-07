#!/usr/bin/env node
/**
 * Add sample content for Entrepreneurship module
 */

const chromaService = require('../services/chroma.service');
const vertexAIService = require('../services/vertexai.service');
const postgresService = require('../services/database/postgres.service');
const logger = require('../utils/logger');

const sampleContent = [
  {
    text: "Entrepreneurship is the process of starting and managing a new business venture. Entrepreneurs identify opportunities, take calculated risks, and create value by introducing innovative products or services to the market. They are problem-solvers who turn ideas into reality through innovation and hard work.",
    module: "Entrepreneurship & Business Ideas"
  },
  {
    text: "Successful entrepreneurs share common characteristics: innovation, risk-taking ability, persistence, adaptability, and strong leadership skills. They are passionate about their ideas and resilient in the face of challenges. Vision and determination drive their success in building sustainable businesses.",
    module: "Entrepreneurship & Business Ideas"
  },
  {
    text: "The first step in entrepreneurship is identifying a business opportunity. This involves recognizing gaps in the market, understanding customer needs, and finding problems that need solutions. Market research helps validate business ideas before making significant investments.",
    module: "Entrepreneurship & Business Ideas"
  },
  {
    text: "A comprehensive business plan is essential for success. It includes an executive summary, company description, market analysis, organizational structure, product/service details, marketing strategy, and financial projections. The business plan serves as a roadmap and helps attract investors.",
    module: "Entrepreneurship & Business Ideas"
  },
  {
    text: "Funding sources for startups include personal savings (bootstrapping), bank loans, angel investors, venture capital, crowdfunding, and government grants. Each source has different requirements, benefits, and implications for business ownership and control. Choose funding that aligns with your business goals.",
    module: "Entrepreneurship & Business Ideas"
  }
];

async function addContent() {
  try {
    logger.info('Initializing services...');
    await chromaService.initialize();
    await postgresService.initialize();

    // Get module ID
    const moduleResult = await postgresService.query(
      "SELECT id FROM moodle_modules WHERE module_name LIKE '%Entrepreneurship%' LIMIT 1"
    );

    if (moduleResult.rows.length === 0) {
      throw new Error('Entrepreneurship module not found');
    }

    const moduleId = moduleResult.rows[0].id;
    logger.info(`Found module ID: ${moduleId}`);

    for (let i = 0; i < sampleContent.length; i++) {
      const content = sampleContent[i];
      logger.info(`Processing chunk ${i + 1}/${sampleContent.length}...`);

      // Add to ChromaDB (ChromaDB will auto-generate embeddings)
      const embeddingId = `entrepreneurship_chunk_${i}`;
      await chromaService.addDocument(
        embeddingId,
        content.text,
        {
          module: content.module,
          module_id: moduleId,
          chunk_order: i,
          source: 'manual'
        }
      );

      // Add to PostgreSQL (skip if already exists)
      try {
        await postgresService.query(`
          INSERT INTO module_content_chunks (
            moodle_module_id, chunk_text, chunk_order, chunk_size, embedding_id, metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          moduleId,
          content.text,
          i,
          content.text.length,
          embeddingId,
          JSON.stringify({ module: content.module, source: 'manual' })
        ]);
      } catch (e) {
        if (e.code === '23505') { // Duplicate key
          logger.info(`Chunk ${i} already exists, skipping...`);
        } else {
          throw e;
        }
      }

      logger.info(`✓ Added chunk ${i + 1}`);
    }

    logger.info(`\n✅ Successfully added ${sampleContent.length} content chunks!`);
    logger.info('Try asking: "What is entrepreneurship?" in WhatsApp');

    process.exit(0);
  } catch (error) {
    logger.error('Error adding content:', error);
    process.exit(1);
  }
}

addContent();
