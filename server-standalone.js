// Standalone server without Docker dependencies
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// In-memory storage (replacement for ChromaDB and Neo4j when not available)
const storage = {
  documents: [],
  users: new Map(),
  sessions: new Map(),
  modules: [
    { id: 'module_1', name: 'Introduction to Teaching', order: 1 },
    { id: 'module_2', name: 'Classroom Management', order: 2 },
    { id: 'module_3', name: 'Lesson Planning', order: 3 },
    { id: 'module_4', name: 'Assessment Strategies', order: 4 },
    { id: 'module_5', name: 'Technology in Education', order: 5 }
  ]
};

// Simple logger
const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: (msg, err) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, err || ''),
  debug: (msg) => console.log(`[DEBUG] ${new Date().toISOString()} - ${msg}`)
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    mode: 'standalone',
    services: {
      chromadb: 'in-memory',
      neo4j: 'in-memory'
    },
    timestamp: new Date().toISOString()
  });
});

// WhatsApp Webhook Verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'your_webhook_verify_token_here';

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      logger.info('WhatsApp webhook verified');
      res.send(challenge);
    } else {
      logger.error('WhatsApp webhook verification failed');
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// WhatsApp Webhook Messages
app.post('/webhook', async (req, res) => {
  try {
    // Acknowledge receipt immediately
    res.sendStatus(200);
    
    logger.info('Received webhook:', JSON.stringify(req.body, null, 2));
    
    // Extract message if present
    if (req.body.entry && 
        req.body.entry[0].changes && 
        req.body.entry[0].changes[0].value.messages) {
      
      const message = req.body.entry[0].changes[0].value.messages[0];
      const from = message.from;
      const messageBody = message.text?.body || '';
      
      logger.info(`Message from ${from}: ${messageBody}`);
      
      // Store in session
      storage.sessions.set(from, {
        lastMessage: messageBody,
        timestamp: new Date()
      });
      
      // Here you would normally process and respond
      // For standalone mode, just log it
      logger.info(`Would respond to ${from} with educational content`);
    }
  } catch (error) {
    logger.error('Error processing webhook:', error);
  }
});

// Admin API Routes
app.get('/api/modules', (req, res) => {
  res.json(storage.modules);
});

// Simplified content upload
app.post('/api/modules/:moduleId/content', (req, res) => {
  const { moduleId } = req.params;
  const { title, content } = req.body;
  
  const doc = {
    id: uuidv4(),
    moduleId,
    title,
    content,
    createdAt: new Date().toISOString()
  };
  
  storage.documents.push(doc);
  
  res.json({ 
    success: true, 
    documentId: doc.id,
    message: 'Content stored in memory' 
  });
});

// Get module content
app.get('/api/modules/:moduleId/content', (req, res) => {
  const { moduleId } = req.params;
  const content = storage.documents.filter(d => d.moduleId === moduleId);
  res.json(content);
});

// Simple search
app.post('/api/search', (req, res) => {
  const { query } = req.body;
  const results = storage.documents.filter(d => 
    d.content?.toLowerCase().includes(query.toLowerCase()) ||
    d.title?.toLowerCase().includes(query.toLowerCase())
  );
  res.json(results);
});

// Get analytics
app.get('/api/analytics', (req, res) => {
  res.json({
    learningAnalytics: {
      total_users: storage.users.size,
      active_users: storage.sessions.size,
      completed_modules: 0,
      average_score: 0
    },
    contentStats: {
      total_documents: storage.documents.length
    },
    timestamp: new Date().toISOString()
  });
});

// Test WhatsApp message (mock)
app.post('/api/test/whatsapp', async (req, res) => {
  const { phone, message } = req.body;
  
  if (!phone || !message) {
    return res.status(400).json({ error: 'Phone and message are required' });
  }
  
  logger.info(`Test message to ${phone}: ${message}`);
  
  // In production, this would use the WhatsApp API
  // For now, just simulate success
  res.json({ 
    success: true, 
    message: 'Test message logged (WhatsApp API not configured)',
    note: 'Configure WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID to send real messages'
  });
});

// Admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Teachers Training Server (Standalone Mode) running on port ${PORT}`);
  logger.info(`📚 Admin Dashboard: http://localhost:${PORT}/admin`);
  logger.info(`🔗 WhatsApp Webhook: http://localhost:${PORT}/webhook`);
  logger.info(`❤️  Health Check: http://localhost:${PORT}/health`);
  logger.info('');
  logger.info('⚠️  Running in standalone mode (no ChromaDB/Neo4j)');
  logger.info('For full functionality, start Docker containers or install services locally');
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});