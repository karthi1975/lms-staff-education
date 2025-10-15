const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');

// Load environment variables first
require('dotenv').config();

// Existing Services
const orchestratorService = require('./services/orchestrator.service');
const whatsappService = require('./services/whatsapp-adapter.service'); // Use adapter for both Meta and Twilio
const whatsappHandler = require('./services/whatsapp-handler.service');
const chromaService = require('./services/chroma.service');
const neo4jService = require('./services/neo4j.service');
const vertexAIService = require('./services/vertexai.service');
const documentProcessor = require('./services/document-processor.service');
const promptService = require('./services/prompt.service');
const logger = require('./utils/logger');

// New Services - PostgreSQL and Auth (non-breaking additions)
const postgresService = require('./services/database/postgres.service');
const chatHistoryService = require('./services/chat-history.service');

// New Routes (will be added below)
const authRoutes = require('./routes/auth.routes');
const enhancedRAGRoutes = require('./routes/enhanced-rag.routes');
const adminRoutes = require('./routes/admin.routes');
const userRoutes = require('./routes/user.routes');
const certificateRoutes = require('./routes/certificate.routes');
const twilioWebhookRoutes = require('./routes/twilio-webhook.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Add new authentication routes (non-breaking addition)
app.use('/api', authRoutes);

// Add enhanced RAG routes
app.use('/api', enhancedRAGRoutes);

// Add admin routes
app.use('/api/admin', adminRoutes);

// Add user routes
app.use('/api', userRoutes);

// Add certificate routes
app.use('/api', certificateRoutes);

// Add Twilio webhook routes
app.use('/', twilioWebhookRoutes);

// Health check - now includes PostgreSQL status
app.get('/health', async (req, res) => {
  // Check PostgreSQL connection
  let postgresStatus = 'not_initialized';
  try {
    if (postgresService.isConnected) {
      const isHealthy = await postgresService.checkConnection();
      postgresStatus = isHealthy ? 'healthy' : 'disconnected';
    }
  } catch (error) {
    postgresStatus = 'error';
  }

  res.json({ 
    status: 'healthy',
    services: {
      postgres: postgresStatus,
      neo4j: 'healthy', // Add actual check if needed
      chroma: 'healthy' // Add actual check if needed
    }
  });
});

// Original health check route for backward compatibility
app.get('/health-simple', (req, res) => {
  res.json({ 
    status: 'healthy',
    services: {
      chromadb: chromaService.client ? 'connected' : 'disconnected',
      neo4j: neo4jService.driver ? 'connected' : 'disconnected'
    },
    timestamp: new Date().toISOString()
  });
});

// WhatsApp Webhook Verification
app.get('/webhook', (req, res) => {
  try {
    const challenge = whatsappService.verifyWebhook(req);
    res.send(challenge);
  } catch (error) {
    logger.error('Webhook verification failed:', error);
    res.sendStatus(403);
  }
});

// WhatsApp Webhook Messages
app.post('/webhook', async (req, res) => {
  try {
    console.log('Webhook received:', JSON.stringify(req.body, null, 2));
    logger.info('Webhook received');

    // Acknowledge receipt immediately
    res.sendStatus(200);

    // Process message asynchronously
    const messageData = whatsappService.extractMessage(req.body);
    console.log('Extracted message:', messageData);
    logger.info('Extracted message:', messageData);

    if (messageData) {
      console.log('Processing WhatsApp message...');
      // Use new WhatsApp handler for quiz and module flow
      await whatsappHandler.handleMessage(messageData);
      console.log('Message processed successfully');
    } else {
      console.log('No message data extracted from webhook');
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    logger.error('Error processing webhook:', error);
    logger.error('Error stack:', error.stack);
  }
});

// WhatsApp Message Status Callback (for Twilio)
app.post('/webhook/status', async (req, res) => {
  try {
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage, To, From } = req.body;

    logger.info('Message status update:', {
      sid: MessageSid,
      status: MessageStatus,
      to: To,
      from: From,
      errorCode: ErrorCode,
      errorMessage: ErrorMessage
    });

    // Log delivery status
    if (MessageStatus === 'delivered') {
      logger.info(`✅ Message ${MessageSid} delivered to ${To}`);
    } else if (MessageStatus === 'failed') {
      logger.error(`❌ Message ${MessageSid} failed: ${ErrorMessage} (Code: ${ErrorCode})`);
    } else if (MessageStatus === 'sent') {
      logger.info(`📤 Message ${MessageSid} sent to ${To}`);
    } else if (MessageStatus === 'read') {
      logger.info(`👁️ Message ${MessageSid} read by ${To}`);
    }

    // Acknowledge receipt
    res.sendStatus(200);
  } catch (error) {
    logger.error('Error processing status callback:', error);
    res.sendStatus(200); // Still acknowledge to prevent retries
  }
});

// Admin API Routes
// Get all modules
app.get('/api/modules', async (req, res) => {
  try {
    const modules = orchestratorService.modules;
    res.json(modules);
  } catch (error) {
    logger.error('Error fetching modules:', error);
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

// Upload content for a module
app.post('/api/modules/:moduleId/content', upload.single('file'), async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { title, description } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Process document with narrative chunking
    const filePath = req.file.path;
    const baseMetadata = {
      module: moduleId,
      title: title || req.file.originalname,
      description: description || '',
      filename: req.file.originalname,
      uploadedAt: new Date().toISOString()
    };
    
    // Process document into chunks
    const chunks = await documentProcessor.processDocument(filePath, baseMetadata);
    
    if (chunks.length === 0) {
      await fs.unlink(filePath);
      return res.status(400).json({ error: 'Document could not be processed' });
    }
    
    // Add each chunk to ChromaDB
    const docIds = [];
    for (const chunk of chunks) {
      const docId = await chromaService.addDocument(chunk.content, chunk.metadata);
      docIds.push(docId);
    }
    
    logger.info(`Added ${chunks.length} chunks from ${req.file.originalname}`);
    
    // Clean up uploaded file
    await fs.unlink(filePath);
    
    res.json({ 
      success: true, 
      documentIds: docIds,
      chunks: chunks.length,
      message: `Content uploaded successfully (${chunks.length} chunks created)` 
    });
  } catch (error) {
    logger.error('Error uploading content:', error);
    res.status(500).json({ error: 'Failed to upload content' });
  }
});

// Bulk upload content
app.post('/api/content/bulk', upload.array('files', 10), async (req, res) => {
  try {
    const { moduleId } = req.body;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const documents = [];
    
    for (const file of req.files) {
      const baseMetadata = {
        module: moduleId,
        filename: file.originalname,
        uploadedAt: new Date().toISOString(),
        fileType: file.originalname.toLowerCase().endsWith('.pdf') ? 'pdf' : 'text'
      };
      
      // Process document into chunks
      const chunks = await documentProcessor.processDocument(file.path, baseMetadata);
      
      if (chunks.length > 0) {
        documents.push(...chunks);
        logger.info(`Processed ${file.originalname}: ${chunks.length} chunks`);
      } else {
        logger.warn(`Could not process ${file.originalname}`);
      }
      
      // Clean up file
      await fs.unlink(file.path);
    }
    
    // Add all chunks to ChromaDB
    const docIds = [];
    for (const chunk of documents) {
      const docId = await chromaService.addDocument(chunk.content, chunk.metadata);
      docIds.push(docId);
    }
    
    res.json({ 
      success: true,
      documentsAdded: docIds.length,
      documentIds: docIds 
    });
  } catch (error) {
    logger.error('Error in bulk upload:', error);
    res.status(500).json({ error: 'Failed to upload content' });
  }
});

// Get module content
app.get('/api/modules/:moduleId/content', async (req, res) => {
  try {
    const { moduleId } = req.params;
    const content = await chromaService.getDocumentsByModule(moduleId);
    res.json(content);
  } catch (error) {
    logger.error('Error fetching module content:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// Search content
app.post('/api/search', async (req, res) => {
  try {
    const { query, module, limit = 5 } = req.body;
    const results = await chromaService.searchSimilar(query, {
      module,
      nResults: limit
    });
    res.json(results);
  } catch (error) {
    logger.error('Error searching content:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const result = await postgresService.query(`
      SELECT
        u.id,
        u.whatsapp_id,
        u.name,
        u.current_module_id,
        u.created_at,
        u.updated_at,
        up.progress_percentage,
        up.last_activity_at
      FROM users u
      LEFT JOIN user_progress up ON u.id = up.user_id AND up.module_id = u.current_module_id
      ORDER BY u.created_at DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// Add new user
app.post('/api/users', async (req, res) => {
  try {
    const { name, whatsapp_id, course_name } = req.body;

    if (!name || !whatsapp_id) {
      return res.status(400).json({ success: false, message: 'Name and WhatsApp ID required' });
    }

    // Use verification service to create user and send verification code
    const verificationService = require('./services/verification.service');
    const result = await verificationService.createUserAndSendCode(name, whatsapp_id);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    res.json({
      success: true,
      verification_code: result.code,
      phone_number: result.phoneNumber,
      expires_at: result.expiresAt,
      message: 'Verification code sent to user via WhatsApp'
    });
  } catch (error) {
    logger.error('Error adding user:', error);
    res.status(500).json({ success: false, message: 'Failed to add user' });
  }
});

// Delete user
app.delete('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Delete user progress and quiz attempts
    await postgresService.query('DELETE FROM quiz_attempts WHERE user_id = $1', [userId]);
    await postgresService.query('DELETE FROM user_progress WHERE user_id = $1', [userId]);
    await postgresService.query('DELETE FROM users WHERE id = $1', [userId]);

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

// Get user progress
app.get('/api/users/:userId/progress', async (req, res) => {
  try {
    const { userId } = req.params;
    const progress = await neo4jService.getUserLearningPath(userId);
    res.json(progress);
  } catch (error) {
    logger.error('Error fetching user progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// Get analytics
app.get('/api/analytics', async (req, res) => {
  try {
    const analytics = await neo4jService.getLearningAnalytics();
    const chromaStats = await chromaService.getStats();
    
    res.json({
      learningAnalytics: analytics,
      contentStats: chromaStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Test WhatsApp message sending
app.post('/api/test/whatsapp', async (req, res) => {
  try {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone and message are required' });
    }
    
    await whatsappService.sendMessage(phone, message);
    res.json({ success: true, message: 'Test message sent' });
  } catch (error) {
    logger.error('Error sending test message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Generate quiz for module
app.post('/api/modules/:moduleId/generate-quiz', async (req, res) => {
  try {
    const { moduleId } = req.params;
    const moduleContent = await chromaService.getDocumentsByModule(moduleId, 5);
    
    if (moduleContent.length === 0) {
      return res.status(404).json({ error: 'No content found for module' });
    }
    
    const quiz = await vertexAIService.generateQuizQuestions(
      moduleContent.map(d => d.content).join('\n'),
      moduleId
    );
    
    res.json(quiz);
  } catch (error) {
    logger.error('Error generating quiz:', error);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

// Get chat history for a session
app.get('/api/chat/history', async (req, res) => {
  try {
    const { user_id = 1, module_id, limit = 50 } = req.query;

    // Get or create session
    const session = await chatHistoryService.getOrCreateSession(parseInt(user_id), module_id ? parseInt(module_id) : null);

    // Get session history
    const messages = await chatHistoryService.getSessionHistory(session.id, parseInt(limit));

    res.json({
      success: true,
      session_id: session.id,
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.message_role,
        content: msg.message_content,
        sources: msg.context_sources || [],
        created_at: msg.created_at
      }))
    });
  } catch (error) {
    logger.error('Error retrieving chat history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve chat history',
      details: error.message
    });
  }
});

// Clear chat history for a session
app.post('/api/chat/clear', async (req, res) => {
  try {
    const { user_id = 1, module_id } = req.body;

    // Get existing session
    const session = await chatHistoryService.getOrCreateSession(parseInt(user_id), module_id ? parseInt(module_id) : null);

    // Delete all messages in this session
    await postgresService.query(
      'DELETE FROM chat_messages WHERE session_id = $1',
      [session.id]
    );

    logger.info(`Cleared chat history for session ${session.id}`);

    res.json({
      success: true,
      message: 'Chat history cleared successfully',
      session_id: session.id
    });
  } catch (error) {
    logger.error('Error clearing chat history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear chat history',
      details: error.message
    });
  }
});

// Chat endpoint for testing documents (with context memory)
app.post('/api/chat', async (req, res) => {
  try {
    const { message, module_id, module, history = [], useContext = true, language = 'english', user_id = 1 } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Get or create chat session for context memory
    let session = null;
    let conversationHistory = '';
    try {
      session = await chatHistoryService.getOrCreateSession(user_id, module_id);
      // Get recent conversation context (last 5 messages)
      conversationHistory = await chatHistoryService.getConversationContext(session.id, 5);
    } catch (error) {
      logger.warn('Chat history unavailable, continuing without context memory:', error.message);
    }

    let context = [];
    let contextDocuments = [];
    let graphContext = null;

    // If useContext is true, search for relevant documents
    if (useContext) {
      // 1. Search for relevant content in ChromaDB (Vector/RAG)
      const searchResults = await chromaService.searchSimilar(message, {
        module_id: module_id || undefined,
        module: module || undefined,  // Fallback for backward compatibility
        nResults: 3
      });

      if (searchResults && searchResults.length > 0) {
        contextDocuments = searchResults.map(doc => {
          // Extract meaningful title from metadata
          // Priority: original_file > filename > title > chunk_title
          let displayTitle = 'Untitled';

          if (doc.metadata?.original_file) {
            displayTitle = doc.metadata.original_file;
          } else if (doc.metadata?.filename) {
            // Remove timestamp prefix if present (e.g., "1234567890-file.pdf" -> "file.pdf")
            displayTitle = doc.metadata.filename.replace(/^\d+-/, '');
          } else if (doc.metadata?.title) {
            displayTitle = doc.metadata.title;
          } else if (doc.metadata?.chunk_title && doc.metadata.chunk_title.length < 50) {
            // Only use chunk_title if it's short enough to be a section header
            displayTitle = doc.metadata.chunk_title;
          }

          return {
            content: doc.content,
            module: doc.metadata?.module_name || doc.metadata?.module || 'unknown',
            title: displayTitle,
            source: 'vector_db'
          };
        });

        context = searchResults.map(doc => doc.content).join('\n\n');
        logger.info(`Found ${searchResults.length} relevant documents for chat context from ChromaDB`);
      }

      // 2. Enrich with Neo4j graph context if user is authenticated
      if (req.user?.id) {
        try {
          const userId = req.user.id;

          // Get user's learning path and recommendations
          const [learningPath, recommendations] = await Promise.all([
            neo4jService.getUserLearningPath(userId).catch(() => null),
            neo4jService.getPersonalizedRecommendations(userId).catch(() => null)
          ]);

          graphContext = {
            learningPath,
            recommendations: recommendations?.slice(0, 3) || []
          };

          // Add graph insights to context if available
          if (learningPath || recommendations) {
            const graphInsights = [];
            if (learningPath?.currentModule) {
              graphInsights.push(`User is currently on: ${learningPath.currentModule}`);
            }
            if (recommendations && recommendations.length > 0) {
              graphInsights.push(`Related concepts: ${recommendations.map(r => r.concept || r.title).join(', ')}`);
            }

            if (graphInsights.length > 0) {
              context = `${context}\n\n[Learning Context]\n${graphInsights.join('\n')}`;
              logger.info(`Added graph-based learning context for user ${userId}`);
            }
          }
        } catch (error) {
          logger.warn('Failed to fetch graph context:', error.message);
        }
      }
    }

    // Combine conversation history with document context
    const fullContext = conversationHistory
      ? `${conversationHistory}\n\n[Document Context]\n${context || 'No specific context available.'}`
      : context || 'No specific context available.';

    // Generate response using Vertex AI with language support
    let response;
    try {
      response = await vertexAIService.generateEducationalResponse(
        message,
        fullContext,
        language
      );
    } catch (vertexError) {
      logger.warn('Vertex AI failed, using fallback response:', vertexError.message);

      // Fallback response when Vertex AI is not available
      if (contextDocuments.length > 0) {
        response = `Based on the uploaded content, here's what I found:\n\n${context.substring(0, 500)}...\n\n(Note: Full AI responses require Google Cloud setup. Please upload content first or configure Vertex AI credentials.)`;
      } else {
        response = `Hello! I can help answer questions about "${module || 'your course'}" once you upload some content files (PDF, DOCX, or TXT).\n\nTo get started:\n1. Click "Upload Content" button\n2. Select a file about your course topic\n3. After upload, ask me questions!\n\n(Note: Full AI chat requires content to be uploaded first and Google Cloud Vertex AI credentials to be configured.)`;
      }
    }

    // Save messages to chat history
    if (session) {
      try {
        // Save user message
        await chatHistoryService.saveMessage(
          session.id,
          user_id,
          'user',
          message,
          module_id,
          [],
          { language }
        );

        // Save assistant response
        await chatHistoryService.saveMessage(
          session.id,
          user_id,
          'assistant',
          response,
          module_id,
          contextDocuments.map(doc => ({ title: doc.title, module: doc.module })),
          { language, hasContext: !!context }
        );

        logger.info(`Saved chat exchange to session ${session.id}`);
      } catch (error) {
        logger.warn('Failed to save chat history:', error.message);
      }
    }

    // Log the interaction for analytics
    if (module) {
      try {
        await neo4jService.createInteraction(
          'admin_chat',
          module,
          'chat_query',
          { query: message, hadContext: context ? true : false }
        );
      } catch (err) {
        // Log error but don't fail the request
        logger.warn('Failed to log interaction:', err.message);
      }
    }

    res.json({
      success: true,
      response: response,
      context: contextDocuments,
      graphContext: graphContext,
      module: module || 'all',
      module_id: module_id,
      session_id: session?.id,
      sources: {
        vector_db: contextDocuments.length,
        graph_db: graphContext ? 1 : 0
      }
    });

  } catch (error) {
    logger.error('Chat API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat message',
      details: error.message
    });
  }
});

// Admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Index page (new clean admin)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize services and start server
async function startServer() {
  try {
    logger.info('Initializing services...');
    
    // Initialize PostgreSQL connection (non-blocking for existing functionality)
    postgresService.initialize().then(() => {
      logger.info('✅ PostgreSQL connected successfully');
    }).catch(err => {
      logger.warn('⚠️  PostgreSQL connection failed - auth features disabled:', err.message);
    });
    
    // Initialize orchestrator (which initializes other services)
    await orchestratorService.initialize();

    // Initialize Moodle orchestrator (loads quiz questions)
    const moodleOrchestrator = require('./services/moodle-orchestrator.service');
    await moodleOrchestrator.initialize();
    
    app.listen(PORT, () => {
      logger.info(`🚀 Teachers Training Server running on port ${PORT}`);
      logger.info(`📚 Admin Dashboard: http://localhost:${PORT}/admin`);
      logger.info(`🔗 WhatsApp Webhook: http://localhost:${PORT}/webhook`);
      logger.info(`❤️  Health Check: http://localhost:${PORT}/health`);
      logger.info(`🔐 Admin Login: http://localhost:${PORT}/admin/login.html`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  
  try {
    await neo4jService.close();
    logger.info('All connections closed');
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
  
  process.exit(0);
});

// Start the server
startServer();