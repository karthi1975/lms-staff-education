/**
 * AI-Powered Content Classification Service
 *
 * Uses Vertex AI to automatically:
 * - Analyze document content
 * - Suggest appropriate modules/topics
 * - Extract key concepts
 * - Provide confidence scores
 */

const logger = require('../utils/logger');
const vertexAIService = require('./vertexai.service');
const documentProcessor = require('./document-processor.service');

class ContentClassificationService {
  /**
   * Classify a batch of uploaded files
   * Returns module and topic suggestions for each file
   */
  async classifyBatch(files, options = {}) {
    try {
      const { courseId, existingModules = [] } = options;

      logger.info(`Starting batch classification for ${files.length} files (course: ${courseId})`);

      const classifications = [];

      for (const file of files) {
        try {
          const classification = await this.classifyFile(file, { existingModules });
          classifications.push(classification);
        } catch (error) {
          logger.error(`Failed to classify ${file.originalname}:`, error);
          classifications.push({
            file_name: file.originalname,
            file_path: file.path,
            status: 'error',
            error: error.message,
            confidence: 0
          });
        }
      }

      logger.info(`Batch classification complete: ${classifications.length} files processed`);

      return {
        total: files.length,
        successful: classifications.filter(c => c.status !== 'error').length,
        failed: classifications.filter(c => c.status === 'error').length,
        classifications
      };
    } catch (error) {
      logger.error('Batch classification failed:', error);
      throw error;
    }
  }

  /**
   * Classify a single file
   */
  async classifyFile(file, options = {}) {
    const { existingModules = [] } = options;

    try {
      logger.info(`Classifying file: ${file.originalname}`);

      // Step 1: Extract text sample (first 3000 words or full text if smaller)
      const textSample = await this.extractTextSample(file.path, 3000);

      if (!textSample || textSample.trim().length < 100) {
        return {
          file_name: file.originalname,
          file_path: file.path,
          status: 'insufficient_content',
          confidence: 0,
          reasoning: 'Document contains insufficient text for classification'
        };
      }

      // Step 2: Build classification prompt
      const prompt = this.buildClassificationPrompt(textSample, existingModules);

      // Step 3: Call Vertex AI for classification
      const response = await vertexAIService.generateContent({
        prompt,
        temperature: 0.2,  // Low temperature for consistent classification
        maxOutputTokens: 1000
      });

      // Step 4: Parse LLM response
      const classification = this.parseClassificationResponse(response, file);

      logger.info(`Classification for ${file.originalname}: ${classification.suggested_module_title} (${classification.confidence}% confidence)`);

      return classification;
    } catch (error) {
      logger.error(`Failed to classify ${file.originalname}:`, error);
      throw error;
    }
  }

  /**
   * Extract text sample from document
   * Returns first N words or full text if smaller
   */
  async extractTextSample(filePath, maxWords = 3000) {
    try {
      // Use existing document processor
      const chunks = await documentProcessor.processDocument(filePath, {
        chunkSize: 10000,  // Get larger chunks for sampling
        maxChunks: 3       // Take first 3 chunks
      });

      if (!chunks || chunks.length === 0) {
        return '';
      }

      // Combine first few chunks
      const fullText = chunks.map(c => c.text).join('\n\n');

      // Trim to max words
      const words = fullText.split(/\s+/);
      const sample = words.slice(0, maxWords).join(' ');

      return sample;
    } catch (error) {
      logger.error('Text extraction failed:', error);
      throw error;
    }
  }

  /**
   * Build prompt for LLM classification
   */
  buildClassificationPrompt(textSample, existingModules) {
    const modulesContext = existingModules.length > 0
      ? `Existing Modules in Course:\n${existingModules.map((m, i) =>
          `${i + 1}. ${m.title}\n   Description: ${m.description || 'No description'}\n   Topics: ${m.topics || 'Not specified'}`
        ).join('\n')}\n\n`
      : 'No existing modules defined yet.\n\n';

    return `You are an expert educational content classifier. Analyze the document excerpt below and determine:

1. **Module Classification**: What learning module or topic area does this content belong to?
2. **Key Topics**: What are the 3-5 main topics/concepts covered?
3. **Learning Level**: Is this beginner, intermediate, or advanced content?
4. **Confidence**: How confident are you in this classification (0-100)?

${modulesContext}

**Instructions**:
- If content matches an existing module, reference it by number and title
- If content doesn't fit existing modules, suggest a NEW module title
- Be specific about topics (e.g., "variables, data types, syntax" not just "basics")
- Consider prerequisites and learning progression

**Document Excerpt** (first 3000 words):
${textSample}

**Required Output Format** (JSON only, no markdown):
{
  "suggested_module_title": "Module title (either existing or new)",
  "matches_existing_module": true/false,
  "existing_module_number": <number or null>,
  "topics": ["topic1", "topic2", "topic3"],
  "learning_level": "beginner|intermediate|advanced",
  "confidence": <0-100>,
  "reasoning": "Brief explanation of classification decision",
  "prerequisites": ["prerequisite1", "prerequisite2"] or [],
  "estimated_duration_hours": <number>
}

Return ONLY the JSON object, no additional text.`;
  }

  /**
   * Parse LLM classification response
   */
  parseClassificationResponse(response, file) {
    try {
      // Extract JSON from response (handle both direct JSON and markdown-wrapped JSON)
      let jsonStr = response.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonStr);

      // Validate required fields
      if (!parsed.suggested_module_title || !parsed.confidence) {
        throw new Error('Missing required fields in classification response');
      }

      // Normalize confidence to 0-1 range if provided as 0-100
      const confidence = parsed.confidence > 1
        ? parsed.confidence / 100
        : parsed.confidence;

      return {
        file_name: file.originalname,
        file_path: file.path,
        file_size: file.size,
        status: 'classified',

        // Classification results
        suggested_module_title: parsed.suggested_module_title,
        matches_existing_module: parsed.matches_existing_module || false,
        existing_module_number: parsed.existing_module_number || null,
        topics: parsed.topics || [],
        learning_level: parsed.learning_level || 'intermediate',
        confidence: confidence,
        reasoning: parsed.reasoning || '',

        // Additional metadata
        prerequisites: parsed.prerequisites || [],
        estimated_duration_hours: parsed.estimated_duration_hours || null,

        // Classification timestamp
        classified_at: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to parse classification response:', error);
      logger.debug('Raw response:', response);

      // Return fallback classification
      return {
        file_name: file.originalname,
        file_path: file.path,
        status: 'parse_error',
        confidence: 0,
        error: error.message,
        raw_response: response.substring(0, 500)
      };
    }
  }

  /**
   * Cluster similar classifications to suggest module groups
   * Used when processing many files to auto-create modules
   */
  async clusterClassifications(classifications) {
    try {
      logger.info(`Clustering ${classifications.length} classifications`);

      // Group by suggested module title (case-insensitive)
      const groups = {};

      for (const classification of classifications) {
        if (classification.status !== 'classified') continue;

        const moduleKey = classification.suggested_module_title.toLowerCase().trim();

        if (!groups[moduleKey]) {
          groups[moduleKey] = {
            module_title: classification.suggested_module_title,
            files: [],
            topics: new Set(),
            avg_confidence: 0,
            learning_level: classification.learning_level,
            total_duration: 0
          };
        }

        groups[moduleKey].files.push(classification);
        classification.topics.forEach(t => groups[moduleKey].topics.add(t));
        groups[moduleKey].total_duration += classification.estimated_duration_hours || 0;
      }

      // Convert to array and calculate averages
      const clusters = Object.values(groups).map(group => ({
        module_title: group.module_title,
        file_count: group.files.length,
        files: group.files,
        topics: Array.from(group.topics),
        avg_confidence: group.files.reduce((sum, f) => sum + f.confidence, 0) / group.files.length,
        learning_level: group.learning_level,
        estimated_duration_hours: Math.ceil(group.total_duration)
      }));

      // Sort by file count (largest clusters first)
      clusters.sort((a, b) => b.file_count - a.file_count);

      logger.info(`Created ${clusters.length} module clusters`);

      return clusters;
    } catch (error) {
      logger.error('Clustering failed:', error);
      throw error;
    }
  }

  /**
   * Generate module suggestions from clusters
   * Returns proposed module structure
   */
  async suggestModuleStructure(classifications) {
    const clusters = await this.clusterClassifications(classifications);

    // Create suggested modules
    const suggestedModules = clusters.map((cluster, index) => ({
      sequence_order: index + 1,
      title: cluster.module_title,
      description: `Auto-generated module covering: ${cluster.topics.slice(0, 5).join(', ')}`,
      topics: cluster.topics,
      learning_level: cluster.learning_level,
      estimated_duration_hours: cluster.estimated_duration_hours,
      file_count: cluster.file_count,
      avg_confidence: cluster.avg_confidence,
      files: cluster.files.map(f => ({
        file_name: f.file_name,
        topics: f.topics,
        confidence: f.confidence
      }))
    }));

    return {
      total_files: classifications.length,
      suggested_module_count: suggestedModules.length,
      modules: suggestedModules,
      high_confidence_files: classifications.filter(c => c.confidence >= 0.8).length,
      needs_review_files: classifications.filter(c => c.confidence < 0.8 && c.confidence > 0).length,
      failed_files: classifications.filter(c => c.status === 'error').length
    };
  }
}

module.exports = new ContentClassificationService();
