# Fresh Start Guide - Teachers Training System

## Step 1: Rebuild Docker with Empty Database

```bash
cd ~/business/staff_education/teachers_training

# Stop all containers and remove volumes
docker-compose down -v

# Remove all volumes completely
docker volume rm teachers_training_postgres_data 2>/dev/null || true
docker volume rm teachers_training_neo4j_data 2>/dev/null || true
docker volume rm teachers_training_chroma_data 2>/dev/null || true

# Start fresh containers
docker-compose up -d

# Wait for services to start
sleep 30

# Check health
curl http://localhost:3000/health
```

## Step 2: Create Admin User

```bash
# Register admin user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@school.edu",
    "password": "Admin123!",
    "name": "System Admin",
    "role": "admin"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "admin@school.edu",
    "name": "System Admin",
    "role": "admin"
  }
}
```

## Step 3: Login to Get Token

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@school.edu",
    "password": "Admin123!"
  }'
```

Expected response:
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "email": "admin@school.edu",
    "name": "System Admin",
    "role": "admin"
  }
}
```

Save the token from the response!

## Step 4: Use Token for API Calls

```bash
# Set token variable (replace with actual token from login)
TOKEN="your_token_here"

# Create a course
curl -X POST http://localhost:3000/api/admin/courses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Business Studies",
    "code": "BUS-001",
    "description": "Comprehensive business training",
    "category": "Business",
    "difficulty_level": "beginner",
    "duration_weeks": 8,
    "sequence_order": 1
  }'

# List all courses
curl -X GET http://localhost:3000/api/admin/courses \
  -H "Authorization: Bearer $TOKEN"

# Create a module for course (assuming course_id = 1)
curl -X POST http://localhost:3000/api/admin/courses/1/modules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Introduction to Business",
    "description": "Basic business concepts",
    "sequence_order": 1
  }'

# List modules for a course
curl -X GET http://localhost:3000/api/admin/courses/1/modules \
  -H "Authorization: Bearer $TOKEN"
```

## Step 5: Create WhatsApp User

```bash
# Create WhatsApp user
curl -X POST http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "whatsapp_id": "+1234567890",
    "role": "student"
  }'

# List all users
curl -X GET http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer $TOKEN"
```

## Step 6: Access Web Interface

Open browser: http://localhost:3000/admin/login.html

Login with:
- Email: admin@school.edu
- Password: Admin123!

## Complete Reset Script (One Command)

Save this as `complete-reset.sh`:

```bash
#!/bin/bash

cd ~/business/staff_education/teachers_training

echo "Stopping containers..."
docker-compose down -v

echo "Removing volumes..."
docker volume rm teachers_training_postgres_data 2>/dev/null || true
docker volume rm teachers_training_neo4j_data 2>/dev/null || true
docker volume rm teachers_training_chroma_data 2>/dev/null || true

echo "Starting fresh..."
docker-compose up -d

echo "Waiting 30 seconds..."
sleep 30

echo "Creating admin user..."
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@school.edu",
    "password": "Admin123!",
    "name": "System Admin",
    "role": "admin"
  }'

echo ""
echo "✅ Done!"
echo "Login at: http://localhost:3000/admin/login.html"
echo "Email: admin@school.edu"
echo "Password: Admin123!"
```

Then run: `chmod +x complete-reset.sh && ./complete-reset.sh`
