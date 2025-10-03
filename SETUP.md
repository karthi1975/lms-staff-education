# Teacher Training Bot - Complete Setup Guide

## Prerequisites

- Docker Desktop installed
- Node.js v18+ installed
- Google Cloud SDK installed
- ngrok account (free tier is fine)

## 1. Environment Setup

### 1.1 Clone and Configure Environment
```bash
cd /Users/karthi/business/staff_education/teachers_training

# Copy the environment file (if not exists)
cp .env.example .env 2>/dev/null || echo ".env already exists"

# Verify .env has these key configurations:
# - GCP_PROJECT_ID=staff-education
# - VERTEX_AI_REGION=us-east5
# - NEO4J_PASSWORD=password
# - WHATSAPP_ACCESS_TOKEN=<your-token>
```

### 1.2 Google Cloud Authentication
```bash
# Login to Google Cloud
gcloud auth login

# Set project
gcloud config set project staff-education

# Configure Application Default Credentials
gcloud auth application-default login

# Set quota project
gcloud auth application-default set-quota-project staff-education

# Verify Vertex AI is enabled
gcloud services list --enabled | grep aiplatform
```

## 2. Docker Setup

### 2.1 Start Docker Services
```bash
# Navigate to project directory
cd /Users/karthi/business/staff_education/teachers_training

# Clean up any existing containers
docker-compose down -v

# Start all services (Neo4j, ChromaDB, and App)
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 2.2 Verify Services are Running
```bash
# Check Neo4j (should return HTML)
curl http://localhost:7474

# Check ChromaDB (v2 API)
curl http://localhost:8000/api/v1

# Check application
curl http://localhost:3000/health
```

### 2.3 Docker Commands Reference
```bash
# Start services
docker-compose up -d

# Stop services (keep data)
docker-compose stop

# Stop and remove containers (keep data)
docker-compose down

# Stop and remove everything (including data)
docker-compose down -v

# View logs for specific service
docker-compose logs -f app
docker-compose logs -f neo4j
docker-compose logs -f chromadb

# Restart a specific service
docker-compose restart app

# Rebuild and restart app (after code changes)
docker-compose build app
docker-compose up -d app
```

## 3. ngrok Setup for WhatsApp Webhook

### 3.1 Install ngrok
```bash
# macOS with Homebrew
brew install ngrok

# Or download from https://ngrok.com/download
```

### 3.2 Configure ngrok
```bash
# Sign up at https://ngrok.com and get auth token
# Add your auth token
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

### 3.3 Start ngrok Tunnel
```bash
# In a new terminal, create tunnel to Docker container
ngrok http 3000

# You'll see output like:
# Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
# Copy the https URL (e.g., https://abc123.ngrok-free.app)
```

### 3.4 Configure WhatsApp Webhook
1. Go to [Meta for Developers](https://developers.facebook.com)
2. Select your app
3. Navigate to WhatsApp > Configuration
4. Configure webhook:
   - Webhook URL: `https://abc123.ngrok-free.app/webhook`
   - Verify Token: `education_bot_verify_2024` (from .env)
5. Click "Verify and Save"
6. Subscribe to webhook fields: messages, messaging_postbacks, messaging_optins

## 4. Testing the Setup

### 4.1 Test Vertex AI Integration
```bash
# Run the Vertex AI test
node test-vertex-integration.js
```

### 4.2 Test WhatsApp Integration
1. Send a message to your WhatsApp Business number
2. Check ngrok dashboard: http://localhost:4040
3. Monitor application logs:
```bash
docker-compose logs -f app
# Or
tail -f logs/combined.log
```

### 4.3 Test Admin Interface
```bash
# Open in browser
open http://localhost:3000/admin.html
```

## 5. Quick Start Commands

### Option A: Docker Compose (Recommended)
```bash
# Terminal 1: Start all services with Docker
cd /Users/karthi/business/staff_education/teachers_training
docker-compose up -d
docker-compose logs -f

# Terminal 2: Start ngrok
ngrok http 3000

# Terminal 3: Monitor ngrok requests (optional)
open http://localhost:4040
```

### Option B: Local Development (Without Docker)
```bash
# Terminal 1: Start Neo4j (requires local installation)
neo4j start

# Terminal 2: Start ChromaDB (requires Python)
pip install chromadb
chroma run --host 0.0.0.0 --port 8000

# Terminal 3: Start application
cd /Users/karthi/business/staff_education/teachers_training
npm install
npm start

# Terminal 4: Start ngrok
ngrok http 3000
```

## 6. Monitoring and Debugging

### 6.1 Check Service Health
```bash
# Application health
curl http://localhost:3000/health

# Neo4j browser
open http://localhost:7474

# ChromaDB collections
curl http://localhost:8000/api/v1/collections

# View Docker resource usage
docker stats
```

### 6.2 View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app --tail=100

# Application logs
tail -f logs/combined.log
tail -f logs/error.log

# ngrok requests
open http://localhost:4040
```

### 6.3 Database Access
```bash
# Neo4j Browser
open http://localhost:7474
# Username: neo4j
# Password: password

# Connect to Neo4j via Docker
docker exec -it teachers_training-neo4j-1 cypher-shell -u neo4j -p password

# Query example
MATCH (n) RETURN count(n);
```

## 7. Troubleshooting

### Issue: Docker containers won't start
```bash
# Clean up everything
docker-compose down -v
docker system prune -a
docker-compose up -d
```

### Issue: Port already in use
```bash
# Find process using port 3000
lsof -i :3000
# Kill the process
kill -9 <PID>

# Or change port in docker-compose.yml and .env
```

### Issue: ngrok URL changes
```bash
# Free tier URLs change on restart
# Update webhook URL in Meta Developer Console
# Consider ngrok paid plan for stable URL
```

### Issue: Vertex AI authentication fails
```bash
# Re-authenticate
gcloud auth application-default login
gcloud auth application-default set-quota-project staff-education

# Verify credentials
gcloud auth application-default print-access-token
```

### Issue: WhatsApp webhook verification fails
```bash
# Check token matches
grep WEBHOOK_VERIFY_TOKEN .env
# Should be: education_bot_verify_2024

# Check app is running
curl http://localhost:3000/webhook

# Check ngrok is forwarding
curl https://your-ngrok-url.ngrok-free.app/webhook
```

## 8. Stopping Services

```bash
# Stop everything gracefully
docker-compose stop

# Stop ngrok
# Press Ctrl+C in ngrok terminal

# Remove containers but keep data
docker-compose down

# Remove everything including data
docker-compose down -v
```

## 9. Production Deployment Notes

For production deployment:
1. Use a proper domain instead of ngrok
2. Set up SSL certificates
3. Use managed databases (Cloud SQL, Atlas, etc.)
4. Configure proper authentication and secrets management
5. Set up monitoring and alerting
6. Use container orchestration (Kubernetes, Cloud Run, etc.)

## 10. Environment Variables Reference

Key environment variables in `.env`:
```bash
# Application
NODE_ENV=production
PORT=3000

# Databases
CHROMA_URL=http://chromadb:8000
NEO4J_URI=bolt://neo4j:7687
NEO4J_PASSWORD=password

# WhatsApp
WHATSAPP_ACCESS_TOKEN=<your-token>
WHATSAPP_PHONE_NUMBER_ID=<your-phone-id>
WEBHOOK_VERIFY_TOKEN=education_bot_verify_2024

# Google Cloud
GCP_PROJECT_ID=staff-education
VERTEX_AI_REGION=us-east5
VERTEX_AI_MODEL=gemini-1.5-flash-001
```

## Quick Reference Card

```bash
# Start everything
docker-compose up -d && ngrok http 3000

# Stop everything
docker-compose down && killall ngrok

# View logs
docker-compose logs -f app

# Test Vertex AI
node test-vertex-integration.js

# Access admin
open http://localhost:3000/admin.html

# Monitor requests
open http://localhost:4040
```

---
Last updated: January 2025
For issues, check logs first: `docker-compose logs -f app`