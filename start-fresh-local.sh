#!/bin/bash

# Fresh local setup: Install dependencies and start Docker

echo "========================================="
echo "Fresh Local Setup"
echo "========================================="
echo ""

# Step 1: Install npm dependencies
echo "Step 1: Installing npm dependencies..."
echo "---------------------------------------"
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -eq 0 ]; then
        echo "✅ Dependencies installed"
    else
        echo "❌ npm install failed"
        exit 1
    fi
else
    echo "✅ node_modules already exists"
fi

echo ""

# Step 2: Check Docker
echo "Step 2: Checking Docker..."
echo "---------------------------------------"
if ! docker ps &> /dev/null; then
    echo "❌ Docker is not running"
    echo "Please start Docker Desktop and run this script again"
    exit 1
fi
echo "✅ Docker is running"

echo ""

# Step 3: Stop any existing containers
echo "Step 3: Cleaning up old containers..."
echo "---------------------------------------"
docker-compose down 2>/dev/null || true
echo "✅ Old containers stopped"

echo ""

# Step 4: Start fresh Docker containers
echo "Step 4: Starting Docker containers..."
echo "---------------------------------------"
docker-compose up -d

if [ $? -eq 0 ]; then
    echo "✅ Containers started"
else
    echo "❌ Failed to start containers"
    exit 1
fi

echo ""
echo "Waiting 15 seconds for services to initialize..."
sleep 15

echo ""

# Step 5: Check container status
echo "Step 5: Checking container status..."
echo "---------------------------------------"
docker-compose ps

echo ""

# Step 6: Test health endpoint
echo "Step 6: Testing health endpoint..."
echo "---------------------------------------"
curl -s http://localhost:3000/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/health

echo ""
echo ""
echo "========================================="
echo "✅ LOCAL SETUP COMPLETE!"
echo "========================================="
echo ""
echo "Your local application is running at:"
echo "  http://localhost:3000/admin/login.html"
echo ""
echo "Default credentials:"
echo "  Email: admin@school.edu"
echo "  Password: Admin123!"
echo ""
echo "Container logs:"
echo "  docker-compose logs -f app"
echo ""
