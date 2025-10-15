#!/bin/bash

# Finish GCP deployment - create .env, start Docker, create admin user

INSTANCE_NAME="teachers-training"
ZONE="us-east5-a"
PROJECT_ID="lms-tanzania-consultant"

echo "========================================="
echo "Finishing GCP Deployment"
echo "========================================="
echo ""

echo "Step 1: Creating .env file on GCP..."
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --project=$PROJECT_ID << 'REMOTE_SCRIPT'
cd ~/teachers_training

# Create .env file
cat > .env << 'ENVFILE'
DB_HOST=localhost
DB_PORT=5432
DB_NAME=teachers_training
DB_USER=teachers_user
DB_PASSWORD=teachers_pass_2024

NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=neo4j_pass_2024

CHROMA_URL=http://localhost:8000

JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=24h

PORT=3000
NODE_ENV=production

GOOGLE_CLOUD_PROJECT=lms-tanzania-consultant
VERTEX_AI_LOCATION=us-central1

SESSION_TTL_HOURS=24
NUDGE_INACTIVITY_HOURS=48

QUIZ_PASS_THRESHOLD=0.7
MAX_QUIZ_ATTEMPTS=2
ENVFILE

echo "✅ .env file created"

# Start Docker containers
echo ""
echo "Starting Docker containers..."
sudo docker-compose up -d

# Wait for containers to be ready
echo "Waiting 30 seconds for containers to initialize..."
sleep 30

# Show container status
echo ""
echo "Container status:"
sudo docker-compose ps

# Create admin user
echo ""
echo "Creating admin user..."
sudo docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "INSERT INTO admin_users (email, password_hash, name, role, is_active, created_at, updated_at) VALUES ('admin@school.edu', '\$2b\$10\$mDRhU21qYaVckm.qkvrN..Hpb150MAUMtWlfr1wdw64fndnjdoKEa', 'System Admin', 'admin', true, NOW(), NOW()) ON CONFLICT (email) DO NOTHING;"

# Verify admin user
echo ""
echo "Verifying admin user..."
sudo docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "SELECT id, email, name, role FROM admin_users;"

# Test health endpoint
echo ""
echo "Testing health endpoint..."
curl -s http://localhost:3000/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/health

echo ""
echo "✅ Deployment complete!"

REMOTE_SCRIPT

EXTERNAL_IP=$(gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --project=$PROJECT_ID --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

echo ""
echo "========================================="
echo "✅ GCP DEPLOYMENT COMPLETE!"
echo "========================================="
echo ""
echo "Your application is running at:"
echo "  http://$EXTERNAL_IP:3000/admin/login.html"
echo ""
echo "Login credentials:"
echo "  Email: admin@school.edu"
echo "  Password: Admin123!"
echo ""
echo "Health check:"
echo "  http://$EXTERNAL_IP:3000/health"
echo ""
