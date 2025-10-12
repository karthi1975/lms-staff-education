/**
 * Populate Sample Content Script
 * Creates sample educational content for existing modules and processes them into:
 * - PostgreSQL (module_content_chunks table)
 * - ChromaDB (RAG embeddings)
 * - Neo4j (knowledge graph)
 *
 * Usage: node scripts/populate-sample-content.js
 */

const chromaService = require('../services/chroma.service');
const neo4jService = require('../services/neo4j.service');
const postgresService = require('../services/database/postgres.service');
const embeddingService = require('../services/embedding.service');
const logger = require('../utils/logger');

// Sample content for Business Studies modules
const SAMPLE_CONTENT = {
  "Entrepreneurship & Business Ideas": `
Entrepreneurship is the process of starting and running a new business venture. An entrepreneur is someone who identifies opportunities, takes calculated risks, and creates innovative solutions to meet market needs.

Key concepts in entrepreneurship:

1. Opportunity Recognition
- Identifying market gaps and unmet customer needs
- Analyzing trends and emerging technologies
- Evaluating competitive landscapes
- Understanding customer pain points

2. Business Ideas
- Sources of business ideas: personal experience, hobbies, market research, technological advances
- Validating ideas through customer interviews and surveys
- Testing assumptions with minimum viable products (MVPs)
- Iterating based on feedback

3. Entrepreneurial Mindset
- Risk-taking and resilience
- Creative problem-solving
- Adaptability and flexibility
- Continuous learning
- Perseverance in face of challenges

4. Types of Entrepreneurship
- Small business entrepreneurship (local shops, restaurants)
- Scalable startup entrepreneurship (tech companies, venture-backed)
- Large company entrepreneurship (innovation within corporations)
- Social entrepreneurship (mission-driven businesses)

5. Innovation and Creativity
- Innovation types: product, process, business model, social
- Design thinking methodology
- Brainstorming techniques
- Prototyping and testing

Examples of successful business ideas:
- Airbnb: Sharing economy for accommodation
- Uber: On-demand transportation
- Dropbox: Cloud storage solution
- Instagram: Photo sharing social network

Questions to validate a business idea:
- Does it solve a real problem?
- Is there a large enough market?
- Can it be profitable?
- Do you have the skills and resources?
- What makes it unique?`,

  "Community Needs & Resource Mapping": `
Community Needs Assessment and Resource Mapping

Understanding community needs is essential for developing successful businesses and social enterprises. Resource mapping helps identify available assets and opportunities within a community.

1. Community Needs Assessment
Definition: A systematic process of identifying gaps, challenges, and opportunities in a community.

Methods for assessing needs:
- Surveys and questionnaires
- Focus group discussions
- Interviews with community leaders
- Observation and field visits
- Secondary data analysis (census, reports)
- Community meetings and forums

Types of community needs:
- Basic needs: water, food, shelter, healthcare
- Economic needs: employment, income generation
- Educational needs: schools, training programs
- Infrastructure needs: roads, electricity, internet
- Social needs: community centers, recreation

2. Resource Mapping
Definition: Identifying and cataloging assets, resources, and capacities within a community.

Categories of community resources:
- Human resources: skills, knowledge, labor
- Physical resources: land, buildings, equipment
- Economic resources: businesses, markets, financial institutions
- Social resources: organizations, networks, relationships
- Natural resources: water, forests, minerals
- Cultural resources: traditions, festivals, heritage sites

Benefits of resource mapping:
- Identifies existing assets to build upon
- Reveals gaps and unmet needs
- Connects resources with needs
- Promotes collaboration and partnerships
- Informs business planning and development

3. Conducting a Resource Map
Steps:
1. Define geographic boundaries
2. Identify categories of resources
3. Collect data through surveys and visits
4. Create visual maps and inventories
5. Analyze findings and identify opportunities
6. Share results with stakeholders

Tools for resource mapping:
- Geographic Information Systems (GIS)
- Community asset mapping templates
- Stakeholder analysis matrices
- SWOT analysis (Strengths, Weaknesses, Opportunities, Threats)

4. Connecting Needs and Resources
Once needs and resources are mapped, entrepreneurs can:
- Identify business opportunities that address community needs
- Leverage existing resources for new ventures
- Form partnerships with community organizations
- Design products/services tailored to local context

Example: A community has surplus agricultural produce (resource) but lacks proper storage facilities (need). Business opportunity: Create a cold storage and distribution service.`,

  "Business Idea Feasibility": `
Business Idea Feasibility Analysis

Before launching a business, entrepreneurs must evaluate whether their idea is viable and likely to succeed. Feasibility analysis examines multiple dimensions of a business concept.

1. What is Feasibility Analysis?
Definition: A comprehensive assessment of a business idea's potential for success across technical, market, financial, and organizational dimensions.

Purpose:
- Reduce risk of failure
- Identify potential challenges early
- Refine and improve the business concept
- Make informed go/no-go decisions
- Attract investors and partners

2. Components of Feasibility Analysis

A. Market Feasibility
- Target market identification
- Market size and growth potential
- Customer needs and preferences
- Competition analysis
- Market trends and dynamics

Questions to answer:
- Who are your customers?
- How large is the market?
- What do customers currently use?
- Who are your main competitors?
- What is your competitive advantage?

B. Technical Feasibility
- Required technology and equipment
- Production process and methods
- Location and facilities
- Supply chain and logistics
- Regulatory compliance

Questions to answer:
- Can the product/service be produced?
- What technology is needed?
- Are materials readily available?
- What skills are required?
- Are there technical barriers?

C. Financial Feasibility
- Startup costs and capital requirements
- Revenue projections
- Operating expenses
- Break-even analysis
- Profitability timeline
- Funding sources

Questions to answer:
- How much money is needed to start?
- What are expected revenues?
- When will the business become profitable?
- What are the financing options?
- What is the return on investment (ROI)?

D. Organizational Feasibility
- Management team and expertise
- Organizational structure
- Human resource needs
- Legal structure (sole proprietorship, partnership, corporation)
- Partnerships and networks

Questions to answer:
- Do you have the right team?
- What skills are missing?
- What legal structure is best?
- Who are potential partners?

3. Feasibility Study Process
Step 1: Preliminary analysis (quick screening)
Step 2: Detailed investigation (in-depth research)
Step 3: Final feasibility report
Step 4: Go/no-go decision

4. Tools and Techniques
- SWOT Analysis (Strengths, Weaknesses, Opportunities, Threats)
- Porter's Five Forces (industry analysis)
- Business Model Canvas
- Financial modeling and projections
- Pilot testing and prototypes

5. Common Feasibility Pitfalls
- Over-optimistic projections
- Insufficient market research
- Ignoring competition
- Underestimating costs
- Lack of contingency planning

Outcome: A feasibility analysis should result in:
- Clear understanding of viability
- Refined business concept
- Identified risks and mitigation strategies
- Solid foundation for business plan`,

  "Overview & Textbooks": `
Business Studies Course Overview

Welcome to Business Studies! This course provides foundational knowledge and practical skills for aspiring entrepreneurs and business professionals.

Course Objectives:
1. Understand key business concepts and terminology
2. Develop entrepreneurial thinking and creativity
3. Learn to identify and evaluate business opportunities
4. Gain skills in business planning and feasibility analysis
5. Understand basic financial management principles
6. Explore marketing and customer development strategies

Course Structure:
The course is organized into modules covering:
- Entrepreneurship fundamentals
- Community needs assessment
- Business idea feasibility
- Business planning
- Financial management
- Marketing and sales
- Operations and supply chain
- Leadership and teamwork

Learning Approach:
- Interactive lectures and discussions
- Case studies of real businesses
- Practical exercises and projects
- Group work and peer learning
- Guest speakers from business community
- Field visits to local enterprises

Assessment Methods:
- Quizzes and examinations
- Business plan project
- Community needs assessment assignment
- Feasibility study report
- Class participation
- Final presentation

Recommended Textbooks and Resources:
1. "Entrepreneurship: Successfully Launching New Ventures" by Barringer & Ireland
2. "The Lean Startup" by Eric Ries
3. "Business Model Generation" by Osterwalder & Pigneur
4. "The Entrepreneur's Guide to Business Law" by Bagley & Dauchy
5. Online resources: Coursera, Khan Academy, MIT OpenCourseWare

Study Tips:
- Attend all classes and participate actively
- Complete assignments on time
- Form study groups with classmates
- Apply concepts to real-world examples
- Network with local entrepreneurs
- Read business news and publications
- Practice critical thinking and analysis

Prerequisites:
- Basic mathematics and accounting skills
- Good communication skills (written and oral)
- Interest in business and entrepreneurship
- Willingness to learn and take initiative

By the end of this course, you will be equipped to:
- Evaluate business opportunities critically
- Develop comprehensive business plans
- Launch and manage small business ventures
- Make informed business decisions
- Understand the business ecosystem
- Apply entrepreneurial principles in various contexts`
};

class ContentPopulator {
  constructor() {
    this.chunkSize = 512; // chars per chunk
  }

  /**
   * Initialize services
   */
  async initialize() {
    logger.info('Initializing services...');
    await postgresService.initialize();
    await chromaService.initialize();
    await neo4jService.initialize();
    logger.info('✅ Services initialized\n');
  }

  /**
   * Split text into chunks
   */
  chunkText(text, chunkSize = 512) {
    const chunks = [];
    const sentences = text.split(/[.!?]+\s+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Main populate function
   */
  async populate() {
    try {
      logger.info('\n' + '='.repeat(60));
      logger.info('📚 Populating Sample Content');
      logger.info('='.repeat(60) + '\n');

      await this.initialize();

      // Get modules from database
      const modulesResult = await postgresService.query(`
        SELECT id, module_name, sequence_order
        FROM moodle_modules
        WHERE moodle_course_id = 12
        ORDER BY sequence_order
      `);

      const modules = modulesResult.rows;
      logger.info(`Found ${modules.length} modules\n`);

      let totalChunks = 0;
      let totalNodes = 0;

      for (const module of modules) {
        const moduleName = module.module_name.replace(/&amp;/g, '&');
        logger.info(`\n📖 Processing: ${moduleName}`);

        // Get sample content for this module
        const content = SAMPLE_CONTENT[moduleName] || SAMPLE_CONTENT["Overview & Textbooks"];

        // Split into chunks
        const chunks = this.chunkText(content, this.chunkSize);
        logger.info(`   Created ${chunks.length} chunks`);

        // Process each chunk
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];

          // Save to PostgreSQL
          await postgresService.query(`
            INSERT INTO module_content_chunks (moodle_module_id, chunk_text, chunk_order, chunk_size, metadata)
            VALUES ($1, $2, $3, $4, $5)
          `, [module.id, chunk, i, chunk.length, { source: 'sample', module_name: moduleName }]);

          // Add to ChromaDB
          await chromaService.addDocument(chunk, {
            module: `module_${module.id}`,
            module_name: moduleName,
            filename: `${moduleName} - Sample Content`,
            chunk_index: i,
            moodle_module_id: module.id
          });

          totalChunks++;
        }

        // Create Neo4j node for this module
        const session = neo4jService.driver.session();
        try {
          await session.run(`
            MERGE (m:Module {id: $id})
            SET m.name = $name,
                m.sequence_order = $sequence,
                m.content_chunks = $chunks,
                m.module_id = $moduleId
          `, {
            id: `module_${module.id}`,
            name: moduleName,
            sequence: module.sequence_order,
            chunks: chunks.length,
            moduleId: module.id
          });

          totalNodes++;
        } finally {
          await session.close();
        }

        logger.info(`   ✅ Saved ${chunks.length} chunks to PostgreSQL`);
        logger.info(`   ✅ Added ${chunks.length} documents to ChromaDB`);
        logger.info(`   ✅ Created Neo4j node`);
      }

      // Create sequential relationships in Neo4j
      logger.info('\n🔗 Creating Neo4j relationships...');
      const session = neo4jService.driver.session();
      try {
        for (let i = 0; i < modules.length - 1; i++) {
          await session.run(`
            MATCH (m1:Module {id: $id1})
            MATCH (m2:Module {id: $id2})
            MERGE (m1)-[:NEXT]->(m2)
          `, {
            id1: `module_${modules[i].id}`,
            id2: `module_${modules[i + 1].id}`
          });
        }
      } finally {
        await session.close();
      }

      logger.info('\n' + '='.repeat(60));
      logger.info('✅ Content Population Complete!');
      logger.info('='.repeat(60));
      logger.info(`📊 Summary:`);
      logger.info(`   - Modules processed: ${modules.length}`);
      logger.info(`   - Total chunks: ${totalChunks}`);
      logger.info(`   - Neo4j nodes: ${totalNodes}`);
      logger.info(`   - Neo4j relationships: ${modules.length - 1}`);
      logger.info('='.repeat(60) + '\n');

      return {
        success: true,
        totalChunks,
        totalNodes
      };
    } catch (error) {
      logger.error('❌ Population failed:', error);
      throw error;
    } finally {
      await neo4jService.driver.close();
      process.exit(0);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const populator = new ContentPopulator();
  populator.populate().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = ContentPopulator;
