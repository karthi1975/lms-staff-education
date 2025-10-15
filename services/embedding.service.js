const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');

const execAsync = promisify(exec);

class EmbeddingService {
  constructor() {
    this.endpoint = process.env.ENDPOINT || 'us-east5-aiplatform.googleapis.com';
    this.projectId = process.env.GCP_PROJECT_ID || 'staff-education';
    this.quotaProject = process.env.GOOGLE_CLOUD_QUOTA_PROJECT || 'lms-tanzania-consultant';
    this.region = process.env.REGION || 'us-east5';

    // Use text-embedding-004 - latest and best model
    this.embeddingModel = 'text-embedding-004';
    this.embeddingDimension = 768; // Standard dimension for text-embedding-004

    // API endpoint for embeddings
    this.embeddingUrl = `https://${this.endpoint}/v1/projects/${this.projectId}/locations/${this.region}/publishers/google/models/${this.embeddingModel}:predict`;

    logger.info(`Vertex AI Embedding Service initialized with quota project: ${this.quotaProject}`);
  }

  async getAccessToken() {
    try {
      // First try to use Application Default Credentials file directly
      const fs = require('fs');
      const os = require('os');

      // Try multiple possible paths for ADC (Docker mounts to /home/nodejs)
      const adcPaths = [
        '/home/nodejs/.gcp-creds/application_default_credentials.json',  // GCP cloud mount
        '/home/nodejs/.config/gcloud/application_default_credentials.json',
        `${os.homedir()}/.config/gcloud/application_default_credentials.json`,
        '/root/.config/gcloud/application_default_credentials.json',
        process.env.GOOGLE_APPLICATION_CREDENTIALS
      ].filter(Boolean);

      for (const adcPath of adcPaths) {
        if (!fs.existsSync(adcPath)) continue;

        try {
          const adc = JSON.parse(fs.readFileSync(adcPath, 'utf8'));

          // For user credentials, we need to use the refresh token to get an access token
          if (adc.type === 'authorized_user' && adc.refresh_token) {
            const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
              client_id: adc.client_id,
              client_secret: adc.client_secret,
              refresh_token: adc.refresh_token,
              grant_type: 'refresh_token'
            });

            if (tokenResponse.data && tokenResponse.data.access_token) {
              logger.info(`Got access token from ADC at ${adcPath}`);
              return tokenResponse.data.access_token;
            }
          }
        } catch (e) {
          logger.warn(`Failed to use ADC file at ${adcPath}:`, e.message);
          continue; // Try next path
        }
      }

      // Fallback to gcloud command if available
      const gcloudPaths = [
        'gcloud',
        '/usr/local/bin/gcloud',
        '/opt/homebrew/bin/gcloud',
        `${process.env.HOME}/google-cloud-sdk/bin/gcloud`
      ];

      for (const gcloudPath of gcloudPaths) {
        try {
          const { stdout } = await execAsync(`${gcloudPath} auth print-access-token`);
          const token = stdout.trim();
          if (token) {
            return token;
          }
        } catch (e) {
          continue;
        }
      }

      throw new Error('Unable to obtain access token');
    } catch (error) {
      logger.error('Failed to get access token:', error.message);
      throw error;
    }
  }

  /**
   * Generate embeddings using Vertex AI
   * @param {string|string[]} texts - Single text or array of texts to embed
   * @returns {Promise<number[]|number[][]>} - Embedding vector(s)
   */
  async generateEmbeddings(texts) {
    const isArray = Array.isArray(texts);
    const inputTexts = isArray ? texts : [texts];

    try {
      const accessToken = await this.getAccessToken();

      // Prepare request for Vertex AI embedding
      const instances = inputTexts.map(text => {
        // Ensure text is a string
        const textStr = typeof text === 'string' ? text : String(text || '');
        return {
          content: textStr.substring(0, 3072) // Limit to 3072 tokens (roughly 2048 chars)
        };
      });
      
      const requestBody = {
        instances: instances
      };
      
      const response = await axios.post(this.embeddingUrl, requestBody, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-goog-user-project': this.quotaProject
        }
      });
      
      if (response.data && response.data.predictions) {
        const embeddings = response.data.predictions.map(pred => {
          // Handle different response formats
          if (pred.embeddings) {
            return pred.embeddings.values || pred.embeddings;
          } else if (pred.values) {
            return pred.values;
          } else if (Array.isArray(pred)) {
            return pred;
          }
          throw new Error('Unexpected embedding format');
        });
        
        logger.info(`Generated ${embeddings.length} embeddings using Vertex AI`);
        return isArray ? embeddings : embeddings[0];
      }
      
      throw new Error('Invalid response from Vertex AI embeddings');
    } catch (error) {
      logger.error('Vertex AI embedding failed:', error.response?.data || error.message);
      
      // Fallback to local embedding for development
      logger.warn('Using fallback embedding method');
      return this.generateFallbackEmbeddings(inputTexts, isArray);
    }
  }

  /**
   * Fallback embedding using TF-IDF style approach
   * Better than the simple character-based one but still not production quality
   */
  generateFallbackEmbeddings(texts, returnArray) {
    const embeddings = texts.map(text => {
      // Ensure text is a string
      const textStr = typeof text === 'string' ? text : String(text || '');

      // Create a more sophisticated embedding
      const words = textStr.toLowerCase().split(/\s+/);
      const embedding = new Array(this.embeddingDimension).fill(0);
      
      // Use word hashing for better distribution
      words.forEach(word => {
        let hash = 0;
        for (let i = 0; i < word.length; i++) {
          hash = ((hash << 5) - hash) + word.charCodeAt(i);
          hash = hash & hash; // Convert to 32-bit integer
        }
        
        // Distribute word across multiple dimensions
        const baseIndex = Math.abs(hash) % this.embeddingDimension;
        embedding[baseIndex] += 1;
        
        // Add to neighboring dimensions for smoothness
        if (baseIndex > 0) embedding[baseIndex - 1] += 0.5;
        if (baseIndex < this.embeddingDimension - 1) embedding[baseIndex + 1] += 0.5;
      });
      
      // Add position encoding
      for (let i = 0; i < Math.min(words.length, this.embeddingDimension); i++) {
        embedding[i] += 0.1 * Math.sin(i / 10);
      }
      
      // Normalize
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
    });
    
    return returnArray ? embeddings : embeddings[0];
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have same dimension');
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);
    
    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }
    
    return dotProduct / (norm1 * norm2);
  }

  /**
   * Find most similar documents using embeddings
   */
  async findSimilar(queryEmbedding, documentEmbeddings, topK = 5) {
    const similarities = documentEmbeddings.map((docEmbed, index) => ({
      index: index,
      similarity: this.cosineSimilarity(queryEmbedding, docEmbed)
    }));
    
    // Sort by similarity descending
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    // Return top K results
    return similarities.slice(0, topK);
  }

  /**
   * Test embedding quality
   */
  async testEmbeddingQuality() {
    try {
      const testTexts = [
        "Teaching strategies for classroom management",
        "How to manage student behavior in class",
        "Python programming tutorial",
        "Effective lesson planning techniques"
      ];
      
      logger.info('Testing embedding quality...');
      const embeddings = await this.generateEmbeddings(testTexts);
      
      // Calculate similarities
      const queryEmbed = embeddings[0];
      for (let i = 1; i < embeddings.length; i++) {
        const similarity = this.cosineSimilarity(queryEmbed, embeddings[i]);
        logger.info(`Similarity between "${testTexts[0]}" and "${testTexts[i]}": ${similarity.toFixed(3)}`);
      }
      
      // Should have high similarity with semantically related text (index 1)
      // and lower similarity with unrelated text (index 2)
      const related = this.cosineSimilarity(embeddings[0], embeddings[1]);
      const unrelated = this.cosineSimilarity(embeddings[0], embeddings[2]);
      
      if (related > unrelated) {
        logger.info('✅ Embedding quality check passed');
        return true;
      } else {
        logger.warn('⚠️ Embedding quality might be suboptimal');
        return false;
      }
    } catch (error) {
      logger.error('Embedding quality test failed:', error);
      return false;
    }
  }
}

module.exports = new EmbeddingService();