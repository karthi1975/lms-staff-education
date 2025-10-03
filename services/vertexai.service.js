const { exec } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');
const logger = require('../utils/logger');
const promptService = require('./prompt.service');

const execAsync = promisify(exec);

class VertexAIService {
  constructor() {
    this.endpoint = process.env.ENDPOINT || 'us-east5-aiplatform.googleapis.com';
    this.projectId = process.env.GCP_PROJECT_ID || 'staff-education';
    this.region = process.env.REGION || 'us-east5';
    this.model = process.env.VERTEX_AI_MODEL || 'meta/llama-4-maverick-17b-128e-instruct-maas';
    
    // Use the OpenAI-compatible endpoint for Llama
    this.apiUrl = `https://${this.endpoint}/v1/projects/${this.projectId}/locations/${this.region}/endpoints/openapi/chat/completions`;
  }

  async getAccessToken() {
    try {
      // First try to use Application Default Credentials file directly
      const fs = require('fs');
      const os = require('os');

      // Try multiple possible paths for ADC
      const adcPaths = [
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
              logger.info(`Successfully obtained access token from ADC at ${adcPath}`);
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
            logger.info('Successfully obtained access token');
            return token;
          }
        } catch (e) {
          // Try next path
          continue;
        }
      }
      
      throw new Error('Unable to obtain access token. Please run: gcloud auth application-default login');
    } catch (error) {
      logger.error('Failed to get access token:', error.message);
      throw error;
    }
  }

  async generateCompletion(messages, options = {}) {
    try {
      const accessToken = await this.getAccessToken();

      // Use OpenAI format for Llama model
      const requestData = {
        model: this.model,
        messages: messages,
        stream: options.stream || false,
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.95
      };

      const response = await axios.post(this.apiUrl, requestData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        responseType: options.stream ? 'stream' : 'json'
      });

      if (options.stream) {
        return this.handleStreamingResponse(response.data);
      } else {
        // Extract response from OpenAI format
        if (response.data && response.data.choices && response.data.choices[0]) {
          return response.data.choices[0].message.content;
        }
        throw new Error('Invalid response from Llama model');
      }
    } catch (error) {
      logger.error('Vertex AI request failed:', error.response?.data || error.message);

      // Return fallback response for development or auth errors
      return this.getFallbackResponse(messages, options.language || 'swahili');
    }
  }

  async handleStreamingResponse(stream) {
    return new Promise((resolve, reject) => {
      let fullContent = '';
      
      stream.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            
            if (data === '[DONE]') {
              resolve(fullContent);
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0].delta.content) {
                fullContent += parsed.choices[0].delta.content;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      });

      stream.on('error', reject);
      stream.on('end', () => resolve(fullContent));
    });
  }

  getFallbackResponse(messages, language = 'swahili') {
    // Development fallback response with language support
    const lastMessage = messages[messages.length - 1];
    const query = lastMessage.content.toLowerCase();

    if (language === 'swahili') {
      // Swahili fallback responses
      if (query.includes('siku ya kwanza') || query.includes('siku 1')) {
        return 'Siku ya kwanza ya mafunzo inazungumzia utangulizi wa somo la Mafunzo ya Biashara (Business Studies) na malengo yake. Walimu wanajifunza kuhusu jukumu lao katika kufikia maono ya CBC ya kuwakuza wanafunzi kuwa waajiri wa siku zijazo.';
      }

      if (query.includes('siku ya pili') || query.includes('siku 2')) {
        return 'Siku ya pili inalenga usimamizi wa darasa na mbinu za kufundisha. Walimu wanajifunza jinsi ya kugawa miradi, kuweka matarajio ya CBC na kufanya miunganisho ya ulimwengu halisi.';
      }

      if (query.includes('siku ya tatu') || query.includes('siku 3') || query.includes('siku tatu')) {
        return 'Siku ya tatu inajikita kwenye mazoezi ya vitendo na maoni kuhusu mbinu za msingi za usimamizi wa darasa na shughuli zinazomlenga mwanafunzi. Pia kuna mapitio ya mafunzo yote ya siku tatu.';
      }

      if (query.includes('mafunzo')) {
        return 'Mafunzo haya yanajumuisha mada muhimu za ufundishaji ikiwemo usimamizi wa darasa, mipango ya masomo, mikakati ya tathmini, na teknolojia ya kielimu. Kila moduli imeundwa kujenga ujuzi wako wa kitaaluma kwa uendelezaji.';
      }

      if (query.includes('darasa') || query.includes('usimamizi')) {
        return 'Usimamizi mzuri wa darasa unahusisha kuweka matarajio wazi, kujenga uhusiano mzuri na wanafunzi, kutumia utaratibu thabiti, na kutekeleza matokeo ya haki. Lenga kuzuia kuliko kujibu.';
      }

      if (query.includes('mpango') || query.includes('somo')) {
        return 'Mipango mizuri ya masomo inajumuisha malengo wazi ya kujifunza, shughuli za kuvutia, tathmini zinazofaa, na tofauti kwa wanafunzi mbalimbali. Oanisha masomo yako na viwango vya mtaala na mahitaji ya wanafunzi.';
      }

      if (query.includes('tathmini') || query.includes('ukaguzi')) {
        return 'Tathmini inapaswa kuwa ya mara kwa mara na tofauti. Tumia tathmini za kuunda kuongoza mafundisho na tathmini za muhtasari kupima kujifunza. Jumuisha kujitathmini na maoni ya wenzao kukuza umiliki wa wanafunzi wa kujifunza.';
      }

      return 'Naweza kukusaidia na mada za mafunzo ya walimu ikiwemo usimamizi wa darasa, mipango ya masomo, mikakati ya tathmini, na zaidi. Je, ungependa kuchunguza eneo gani maalum?';
    } else {
      // English fallback responses
      if (query.includes('topic') || query.includes('cover')) {
        return 'The training covers essential teaching topics including classroom management, lesson planning, assessment strategies, and educational technology. Each module is designed to build your professional teaching skills progressively.';
      }

      if (query.includes('classroom') || query.includes('manage')) {
        return 'Effective classroom management involves establishing clear expectations, building positive relationships with students, using consistent routines, and implementing fair consequences. Focus on prevention rather than reaction.';
      }

      if (query.includes('lesson') || query.includes('plan')) {
        return 'Good lesson planning includes clear learning objectives, engaging activities, appropriate assessments, and differentiation for diverse learners. Always align your lessons with curriculum standards and student needs.';
      }

      if (query.includes('assess') || query.includes('evaluation')) {
        return 'Assessment should be ongoing and varied. Use formative assessments to guide instruction and summative assessments to measure learning. Include self-assessment and peer feedback to promote student ownership of learning.';
      }

      return 'I can help you with teacher training topics including classroom management, lesson planning, assessment strategies, and more. What specific area would you like to explore?';
    }
  }

  async generateEducationalResponse(query, context, language = 'swahili') {
    // Use prompt service to format the prompt in the specified language
    const formattedPrompt = promptService.formatPrompt(query, context, language);

    // Get system prompt for teacher trainer role
    const systemPrompt = promptService.getSystemPrompt('teacher_trainer');

    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: formattedPrompt
      }
    ];

    return await this.generateCompletion(messages, {
      temperature: 0.7,
      maxTokens: 800,  // Increased for Swahili responses
      language: language  // Pass language for fallback
    });
  }

  async generateQuizQuestions(content, moduleId) {
    const messages = [
      {
        role: "system",
        content: "You are an educational assistant that creates quiz questions. Generate exactly 5 multiple-choice questions based on the provided content. Return the response as valid JSON."
      },
      {
        role: "user",
        content: `Based on the following educational content from ${moduleId}, create 5 multiple-choice questions.

Content: ${content.substring(0, 3000)}

Return the response in this exact JSON format:
{
  "questions": [
    {
      "question": "Question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Brief explanation"
    }
  ]
}`
      }
    ];

    try {
      const response = await this.generateCompletion(messages, { 
        temperature: 0.5,
        maxTokens: 1000
      });
      
      // Try to parse the response as JSON
      try {
        // Extract JSON from the response if it contains other text
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(response);
      } catch (e) {
        logger.warn('Failed to parse quiz JSON, using default');
        return this.getDefaultQuiz(moduleId);
      }
    } catch (error) {
      logger.error('Failed to generate quiz:', error);
      return this.getDefaultQuiz(moduleId);
    }
  }

  getDefaultQuiz(moduleId) {
    const quizzes = {
      module_1: {
        questions: [
          {
            question: "What is the primary role of a teacher?",
            options: ["To lecture", "To facilitate learning", "To grade papers", "To maintain discipline"],
            correct: 1,
            explanation: "A teacher's primary role is to facilitate learning and guide students."
          }
        ]
      },
      module_2: {
        questions: [
          {
            question: "Which strategy best promotes student engagement?",
            options: ["Lectures only", "Interactive activities", "Silent reading", "Note taking"],
            correct: 1,
            explanation: "Interactive activities promote active learning and engagement."
          }
        ]
      }
    };
    
    return quizzes[moduleId] || quizzes.module_1;
  }

  async testConnection() {
    try {
      const messages = [
        {
          role: "user",
          content: "Hello, test connection. Respond with 'Connection successful'."
        }
      ];
      
      const response = await this.generateCompletion(messages, { maxTokens: 20 });
      logger.info('Vertex AI connection test response:', response);
      return response.includes('successful') || response.includes('Connection');
    } catch (error) {
      logger.error('Vertex AI connection test failed:', error.message);
      return false;
    }
  }
}

module.exports = new VertexAIService();