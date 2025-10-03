# Teachers Training System

An integrated educational platform combining WhatsApp Business API with RAG (Retrieval-Augmented Generation) pipeline for teacher training.

## Features

- 📱 **WhatsApp Bot Integration** - Interactive learning through WhatsApp
- 🧠 **RAG Pipeline** - Context-aware responses using ChromaDB and Vertex AI
- 📊 **Progress Tracking** - Neo4j knowledge graph for learning paths
- 📚 **Module-Based Learning** - 5 sequential training modules
- 📝 **Quiz System** - Auto-generated assessments with 70% pass threshold
- 🎯 **Admin Dashboard** - Content management and analytics

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   WhatsApp API  │────▶│ Orchestrator │────▶│  Vertex AI  │
└─────────────────┘     └──────────────┘     └─────────────┘
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
              ┌──────────┐        ┌──────────┐
              │ ChromaDB │        │  Neo4j   │
              └──────────┘        └──────────┘
```

## Quick Start

### Prerequisites
- Node.js 16+
- Docker & Docker Compose
- Google Cloud SDK (gcloud)
- WhatsApp Business API access

### Installation

1. Clone and navigate to project:
```bash
cd /Users/karthi/business/staff_education/teachers_training
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. Start services with Docker:
```bash
npm run docker:up
```

5. Or run locally:
```bash
# Start ChromaDB
docker run -p 8000:8000 chromadb/chroma

# Start Neo4j  
docker run -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:5-community

# Start application
npm start
```

## Configuration

### WhatsApp Setup
1. Get Meta Business Account
2. Create WhatsApp Business App
3. Add phone number
4. Configure webhook URL: `https://yourdomain.com/webhook`
5. Set verify token in `.env`

### Google Cloud Setup
```bash
gcloud auth login
gcloud config set project staff-education
```

### Environment Variables
- `WHATSAPP_ACCESS_TOKEN` - Meta access token
- `WHATSAPP_PHONE_NUMBER_ID` - WhatsApp phone ID
- `WEBHOOK_VERIFY_TOKEN` - Webhook verification
- `GCP_PROJECT_ID` - Google Cloud project
- `NEO4J_PASSWORD` - Neo4j database password

## Usage

### Admin Dashboard
Access at `http://localhost:3000/admin` to:
- Upload training content
- Monitor user progress
- Test WhatsApp messages
- Search content
- View analytics

### WhatsApp Commands
Users can interact via WhatsApp:
- `menu` - View all modules
- `module X` - Access module X
- `quiz X` - Take module X quiz
- `progress` - View learning progress
- `help` - Get assistance

### API Endpoints

#### Content Management
- `POST /api/modules/:moduleId/content` - Upload content
- `GET /api/modules/:moduleId/content` - Get module content
- `POST /api/content/bulk` - Bulk upload

#### Analytics
- `GET /api/analytics` - System analytics
- `GET /api/users/:userId/progress` - User progress

#### Testing
- `POST /api/test/whatsapp` - Send test message
- `GET /health` - Health check

## Modules

1. **Introduction to Teaching** - Teaching fundamentals
2. **Classroom Management** - Behavior and environment
3. **Lesson Planning** - Curriculum design
4. **Assessment Strategies** - Evaluation methods
5. **Technology in Education** - Digital tools

## Development

### Project Structure
```
teachers_training/
├── services/          # Core services
│   ├── orchestrator.service.js
│   ├── whatsapp.service.js
│   ├── chroma.service.js
│   ├── neo4j.service.js
│   └── vertexai.service.js
├── public/           # Admin dashboard
├── utils/            # Utilities
├── server.js         # Main server
└── docker-compose.yml
```

### Testing
```bash
npm test
npm run test:watch
```

### Logs
- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`

## Docker Commands

```bash
# Build and start
npm run docker:build
npm run docker:up

# View logs
npm run docker:logs

# Stop services
npm run docker:down
```

## Troubleshooting

### ChromaDB Connection Issues
- Ensure Docker is running
- Check port 8000 availability
- Verify CHROMA_URL in .env

### Neo4j Connection Issues
- Default credentials: neo4j/password
- Check port 7687 availability
- Wait for database initialization

### WhatsApp Webhook Issues
- Verify token matches Meta configuration
- Use ngrok for local testing
- Check webhook URL is HTTPS

## Support

For issues or questions:
- Check logs in `logs/` directory
- Review `.env` configuration
- Ensure all Docker containers running
- Verify Google Cloud authentication