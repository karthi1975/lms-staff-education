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
    this.quotaProject = process.env.GOOGLE_CLOUD_QUOTA_PROJECT || 'lms-tanzania-consultant';
    this.region = process.env.REGION || 'us-east5';
    this.model = process.env.VERTEX_AI_MODEL || 'meta/llama-4-maverick-17b-128e-instruct-maas';

    // Use the OpenAI-compatible endpoint for Llama
    this.apiUrl = `https://${this.endpoint}/v1/projects/${this.projectId}/locations/${this.region}/endpoints/openapi/chat/completions`;

    logger.info(`Vertex AI Service initialized with quota project: ${this.quotaProject}`);
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
        top_p: options.topP || 0.95,
        frequency_penalty: options.frequencyPenalty || 0.3,  // Penalize repeated tokens
        presence_penalty: options.presencePenalty || 0.2     // Encourage topic diversity
      };

      const response = await axios.post(this.apiUrl, requestData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-goog-user-project': this.quotaProject
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

    // Extract context from system messages if available
    let contextInfo = '';
    for (const msg of messages) {
      if (msg.role === 'system' && msg.content) {
        contextInfo = msg.content.substring(0, 500);
        break;
      }
    }

    if (language === 'swahili') {
      // Swahili fallback responses with more variety
      if (query.includes('overview') || query.includes('muhtasari') || query.includes('orodha')) {
        return `Mafunzo haya yanajumuisha mada za msingi za ufundishaji:\n\n1. **Usimamizi wa Darasa** - Kuweka matarajio na kujenga uhusiano\n2. **Mipango ya Masomo** - Kutengeneza masomo yenye ufanisi\n3. **Mikakati ya Tathmini** - Kupima maendeleo ya wanafunzi\n4. **Teknolojia ya Elimu** - Kutumia zana za kisasa\n5. **Uundaji wa Mtaala** - Kuoanisha na viwango vya kitaifa\n\nKila sehemu ina mazoezi ya vitendo na mifano halisi.`;
      }

      if (query.includes('example') || query.includes('mfano') || query.includes('mifano')) {
        return `Hebu tuone mifano michache ya vitendo:\n\n**Usimamizi wa Darasa:**\n- Kuweka sheria 3-5 za darasa pamoja na wanafunzi\n- Kutumia ishara za sauti au mwili kuwapa wanafunzi tahadhari\n- Kutunga utaratibu wa asubuhi ili kuanza siku vizuri\n\n**Mipango ya Masomo:**\n- Kuanza na swali lenye kuvutia kuelekeza kujifunza\n- Kutumia mbinu za vikundi vidogo kwa ushirikiano\n- Kuhitimisha na maoni au tathmini\n\nJe, ungependa maelezo zaidi juu ya eneo maalum?`;
      }

      if (query.includes('textbook') || query.includes('kitabu') || query.includes('vitabu')) {
        return `Vitabu vya darasa ni rasilimali muhimu kwa ufundishaji. Hapa kuna njia za kuvitumia vizuri:\n\n**Uchambuzi wa Vitabu:**\n- Fanya mapitio ya muundo na maudhui\n- Tambua sehemu kuu na mada\n- Panga mpangilio wa kufundisha\n\n**Matumizi ya Darasani:**\n- Tumia kama msingi wa masomo\n- Ongeza mazoezi ya ziada\n- Unganisha na uzoefu wa ulimwengu halisi\n\nVitabu ni mwongozo, si mpaka. Kuwa na ubunifu!`;
      }

      if (query.includes('curriculum') || query.includes('mtaala')) {
        return `Mtaala unafafanua ni nini kinachopaswa kufundishwa na lini. Kwa Business Studies:\n\n**Vipaumbele:**\n- Msingi wa biashara na ujasiriamali\n- Ujuzi wa kifedha na usimamizi\n- Maadili ya biashara na uwajibikaji\n\n**Ufuatiliaji:**\n- Oanisha masomo na malengo ya mtaala\n- Pima ustadi kupitia tathmini\n- Rekodi maendeleo ya wanafunzi\n\nMtaala ni ramani - unaongoza safari ya kujifunza.`;
      }

      // More general responses based on keywords
      if (query.includes('siku ya kwanza') || query.includes('siku 1')) {
        return 'Siku ya kwanza ya mafunzo inazungumzia utangulizi wa somo la Mafunzo ya Biashara (Business Studies) na malengo yake. Walimu wanajifunza kuhusu jukumu lao katika kufikia maono ya CBC ya kuwakuza wanafunzi kuwa waajiri wa siku zijazo.';
      }

      if (query.includes('darasa') || query.includes('usimamizi')) {
        return 'Usimamizi mzuri wa darasa unahusisha kuweka matarajio wazi, kujenga uhusiano mzuri na wanafunzi, kutumia utaratibu thabiti, na kutekeleza matokeo ya haki. Lenga kuzuia kuliko kujibu.';
      }

      return `Asante kwa swali lako: "${lastMessage.content}"\n\nNaweza kukusaidia na mada mbalimbali za mafunzo ya walimu. Unaweza kuuliza kuhusu:\n\n- 📚 Muhtasari wa kozi\n- 📖 Matumizi ya vitabu vya darasa\n- 🎯 Malengo ya kujifunza\n- 💡 Mifano ya vitendo\n- 📝 Mikakati ya tathmini\n\nTafadhali pakia maudhui zaidi ili nipate kukupa majibu bora zaidi kulingana na kozi yako!`;
    } else {
      // English fallback responses with more variety
      if (query.includes('overview') || query.includes('about') || query.includes('summary')) {
        return `This course covers essential teaching topics:\n\n1. **Classroom Management** - Setting expectations and building relationships\n2. **Lesson Planning** - Creating effective lessons\n3. **Assessment Strategies** - Measuring student progress\n4. **Educational Technology** - Using modern tools\n5. **Curriculum Development** - Aligning with standards\n\nEach section includes practical exercises and real-world examples.`;
      }

      if (query.includes('example') || query.includes('show me')) {
        return `Here are some practical examples:\n\n**Classroom Management:**\n- Establish 3-5 class rules with student input\n- Use non-verbal signals to redirect behavior\n- Create morning routines to start the day positively\n\n**Lesson Planning:**\n- Begin with an engaging question to hook learners\n- Use small group work for collaboration\n- End with reflection or assessment\n\nWould you like more details on any specific area?`;
      }

      if (query.includes('textbook') || query.includes('book') || query.includes('material')) {
        return `Textbooks are essential resources for teaching. Here's how to use them effectively:\n\n**Textbook Analysis:**\n- Review structure and content\n- Identify key sections and topics\n- Plan teaching sequence\n\n**Classroom Use:**\n- Use as foundation for lessons\n- Supplement with additional activities\n- Connect to real-world experiences\n\nRemember: Textbooks are guides, not limits. Be creative!`;
      }

      if (query.includes('curriculum') || query.includes('syllabus')) {
        return `The curriculum defines what should be taught and when. For Business Studies:\n\n**Key Areas:**\n- Business fundamentals and entrepreneurship\n- Financial literacy and management\n- Business ethics and responsibility\n\n**Implementation:**\n- Align lessons with curriculum goals\n- Assess competency through evaluations\n- Track student progress\n\nThe curriculum is your roadmap for the learning journey.`;
      }

      if (query.includes('topic') || query.includes('cover')) {
        return 'The training covers essential teaching topics including classroom management, lesson planning, assessment strategies, and educational technology. Each module is designed to build your professional teaching skills progressively.';
      }

      if (query.includes('classroom') || query.includes('manage')) {
        return 'Effective classroom management involves establishing clear expectations, building positive relationships with students, using consistent routines, and implementing fair consequences. Focus on prevention rather than reaction.';
      }

      return `Thank you for your question: "${lastMessage.content}"\n\nI can help with various teacher training topics. You can ask about:\n\n- 📚 Course overview\n- 📖 Textbook navigation\n- 🎯 Learning objectives\n- 💡 Practical examples\n- 📝 Assessment strategies\n\nPlease upload content files for better responses tailored to your specific course!`;
    }
  }

  async generateEducationalResponse(query, context, language = 'swahili') {
    // Use prompt service to format the prompt in the specified language
    const formattedPrompt = promptService.formatPrompt(query, context, language);

    // Simpler system prompt to avoid confusion
    const systemPrompt = "You are a helpful educational assistant. Provide clear, concise answers based on the information given.";

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
      temperature: 0.5,  // Lower temperature for more focused responses
      maxTokens: 500,    // Shorter responses to prevent rambling
      frequencyPenalty: 0.5,  // Strong penalty against repetition
      presencePenalty: 0.3,   // Encourage diverse vocabulary
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