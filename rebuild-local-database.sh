#!/bin/bash

# Completely destroy and rebuild local database

echo "========================================="
echo "Rebuild Local Database from Scratch"
echo "========================================="
echo ""
echo "This will:"
echo "  ❌ Stop all Docker containers"
echo "  ❌ Delete ALL database volumes"
echo "  ❌ Destroy ALL data completely"
echo "  ✅ Rebuild fresh database"
echo "  ✅ Start with clean state"
echo ""
read -p "Type 'DELETE' to confirm: " CONFIRM

if [ "$CONFIRM" != "DELETE" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Step 1: Stopping all containers..."
docker-compose down -v

echo ""
echo "Step 2: Removing database volumes..."
docker volume rm teachers_training_postgres_data 2>/dev/null || true
docker volume rm teachers_training_neo4j_data 2>/dev/null || true
docker volume rm teachers_training_chroma_data 2>/dev/null || true

echo ""
echo "Step 3: Removing any orphaned containers..."
docker container prune -f

echo ""
echo "Step 4: Starting fresh containers..."
docker-compose up -d

echo ""
echo "Step 5: Waiting for database to initialize (30 seconds)..."
sleep 30

echo ""
echo "Step 6: Verifying services..."
docker-compose ps

echo ""
echo "Step 7: Testing health endpoint..."
curl -s http://localhost:3000/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/health

echo ""
echo ""
echo "========================================="
echo "✅ COMPLETE - Fresh Database!"
echo "========================================="
echo ""
echo "Your local database has been completely rebuilt"
echo "All data is fresh from database/init.sql"
echo ""
echo "Default admin login:"
echo "  Email: admin@school.edu"
echo "  Password: Admin123!"
echo ""
echo "Open: http://localhost:3000/admin/courses.html"
echo "Press Cmd+Shift+R to hard refresh"
echo ""
