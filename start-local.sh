#!/bin/bash

echo "🚀 Starting Teachers Training System (Local Mode)"
echo "================================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "⚠️  Docker is not running. Starting services locally..."
    echo ""
    echo "You can optionally start Docker Desktop and run:"
    echo "  npm run docker:up"
    echo ""
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Environment variables loaded"
else
    echo "❌ .env file not found!"
    exit 1
fi

# Create necessary directories
mkdir -p logs uploads

echo ""
echo "📋 Instructions:"
echo "----------------"
echo "1. Make sure you have ChromaDB and Neo4j running (or use Docker)"
echo "2. The server will start on port 3000"
echo "3. Admin dashboard: http://localhost:3000/admin"
echo "4. Health check: http://localhost:3000/health"
echo ""
echo "For WhatsApp webhook with ngrok:"
echo "  Terminal 2: ngrok http 3000"
echo ""

# Start the application
echo "Starting application..."
node server.js