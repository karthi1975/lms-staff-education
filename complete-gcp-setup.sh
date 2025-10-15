#!/bin/bash

# Complete GCP deployment with credentials setup
# This script deploys the teachers training system to GCP with all configurations

INSTANCE_NAME="teachers-training"
ZONE="us-east5-a"
PROJECT_ID="lms-tanzania-consultant"
SERVICE_ACCOUNT="teachers-training-sa@${PROJECT_ID}.iam.gserviceaccount.com"

echo "========================================="
echo "Complete GCP Setup with Credentials"
echo "========================================="
echo ""

echo "Step 1: Creating service account key locally..."
gcloud iam service-accounts keys create /tmp/gcp-key.json \
  --iam-account=$SERVICE_ACCOUNT \
  --project=$PROJECT_ID

echo "✅ Service account key created"

echo ""
echo "Step 2: Copying service account key to GCP VM..."
gcloud compute scp /tmp/gcp-key.json $INSTANCE_NAME:~/teachers_training/gcp-key.json \
  --zone=$ZONE \
  --project=$PROJECT_ID

rm /tmp/gcp-key.json
echo "✅ Key copied and local copy deleted"

echo ""
echo "Step 3: Setting up environment on GCP..."
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --project=$PROJECT_ID << 'REMOTE_SCRIPT'
cd ~/teachers_training

# Create .env file with ALL settings from current configuration
cat > .env << 'ENVFILE'
# Application Configuration
NODE_ENV=production
PORT=3000

# Database Configuration (Docker internal networking)
DB_HOST=postgres
DB_PORT=5432
DB_NAME=teachers_training
DB_USER=teachers_user
DB_PASSWORD=teachers_pass_2024

# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# ChromaDB Configuration (Docker internal networking)
CHROMA_URL=http://chromadb:8000
CHROMA_HOST=chromadb
CHROMA_PORT=8000

# Neo4j Configuration (Docker internal networking)
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
NEO4J_HOST=neo4j
NEO4J_PORT=7687

# Vertex AI Configuration (us-east5)
ENDPOINT=us-east5-aiplatform.googleapis.com
REGION=us-east5
GCP_PROJECT_ID=lms-tanzania-consultant
VERTEX_AI_ENDPOINT=us-east5-aiplatform.googleapis.com
VERTEX_AI_REGION=us-east5
VERTEX_AI_MODEL=meta/llama-4-maverick-17b-128e-instruct-maas

# Google Cloud Authentication - Service Account
GOOGLE_APPLICATION_CREDENTIALS=/app/gcp-key.json
GOOGLE_CLOUD_QUOTA_PROJECT=lms-tanzania-consultant

# File Upload Configuration
UPLOAD_MAX_SIZE=104857600
CONTENT_CHUNK_SIZE=1000

# Twilio Configuration (set these in your GCP environment or pass as parameters)
TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID:-your_twilio_account_sid}
TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN:-your_twilio_auth_token}
TWILIO_PHONE_NUMBER=${TWILIO_PHONE_NUMBER:-+1234567890}
TWILIO_WHATSAPP_NUMBER=whatsapp:${TWILIO_PHONE_NUMBER}
TWILIO_SKIP_VALIDATION=false
WHATSAPP_PROVIDER=twilio
ENVFILE

echo "✅ .env file created with full configuration"

# Update docker-compose to mount the service account key
echo ""
echo "Checking docker-compose configuration..."
if grep -q "gcp-key.json" docker-compose.yml; then
    echo "✅ docker-compose already has gcp-key.json mount"
else
    echo "⚠️  Need to add gcp-key.json mount to docker-compose.yml"
fi

# Stop any existing containers
echo ""
echo "Stopping existing Docker containers..."
sudo docker-compose down 2>/dev/null

# Clean up old volumes (optional - uncomment if you want fresh databases)
# echo "Cleaning up old volumes..."
# sudo docker volume rm teachers_training_postgres_data 2>/dev/null
# sudo docker volume rm teachers_training_neo4j_data 2>/dev/null
# sudo docker volume rm teachers_training_chromadb_data 2>/dev/null

# Pull latest images
echo ""
echo "Pulling latest Docker images..."
sudo docker-compose pull

# Start Docker containers
echo ""
echo "Starting Docker containers..."
sudo docker-compose up -d

# Wait for containers to be healthy
echo "Waiting 45 seconds for containers to initialize..."
sleep 45

# Show container status
echo ""
echo "Container status:"
sudo docker-compose ps

# Create admin user with correct password hash for Admin123!
echo ""
echo "Creating admin user..."
sudo docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "INSERT INTO admin_users (email, password_hash, name, role, is_active, created_at, updated_at) VALUES ('admin@school.edu', '\$2b\$10\$c2AfudbBGIFHWO6dCCtopO2DwMDDx3cCZPF5tRlqy8wvAw8VRdF8a', 'System Admin', 'admin', true, NOW(), NOW()) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;"

# Verify admin user
echo ""
echo "Verifying admin user..."
sudo docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "SELECT id, email, name, role FROM admin_users;"

# Check database tables
echo ""
echo "Checking database tables..."
sudo docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "\dt"

# Test health endpoint
echo ""
echo "Testing health endpoint..."
curl -s http://localhost:3000/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/health

# Test admin login endpoint
echo ""
echo "Testing admin login endpoint..."
curl -s http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"Admin123!"}' \
  | python3 -m json.tool 2>/dev/null || echo "(Login endpoint test)"

# Check application logs
echo ""
echo "Recent application logs:"
sudo docker logs --tail 50 teachers_training-app-1

echo ""
echo "✅ Setup complete on GCP VM!"

REMOTE_SCRIPT

# Get external IP
EXTERNAL_IP=$(gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --project=$PROJECT_ID --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

echo ""
echo "========================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "========================================="
echo ""
echo "Application URLs:"
echo "  Admin Login:  http://$EXTERNAL_IP:3000/admin/login.html"
echo "  Admin Index:  http://$EXTERNAL_IP:3000/admin/index.html"
echo "  Health Check: http://$EXTERNAL_IP:3000/health"
echo ""
echo "Login Credentials:"
echo "  Email:    admin@school.edu"
echo "  Password: Admin123!"
echo ""
echo "Webhook Configuration:"
echo "  Twilio Webhook URL: http://$EXTERNAL_IP:3000/webhook/twilio"
echo "  Configure this URL in your Twilio Console:"
echo "  https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox"
echo ""
echo "API Endpoints:"
echo "  Health:       http://$EXTERNAL_IP:3000/health"
echo "  Admin Login:  http://$EXTERNAL_IP:3000/api/admin/login"
echo "  Admin Users:  http://$EXTERNAL_IP:3000/api/admin/users"
echo "  Admin Courses:http://$EXTERNAL_IP:3000/api/admin/courses"
echo "  Chat:         http://$EXTERNAL_IP:3000/api/chat"
echo ""
echo "Database Connections:"
echo "  PostgreSQL: postgres:5432 (internal Docker network)"
echo "  Neo4j:      neo4j:7687 (internal Docker network)"
echo "  ChromaDB:   chromadb:8000 (internal Docker network)"
echo ""
echo "Google Cloud Configuration:"
echo "  Project:    lms-tanzania-consultant"
echo "  Region:     us-east5"
echo "  Model:      meta/llama-4-maverick-17b-128e-instruct-maas"
echo "  Credentials:/app/gcp-key.json (mounted in container)"
echo ""
echo "Next Steps:"
echo "  1. Test admin login: curl http://$EXTERNAL_IP:3000/api/admin/login -d '{\"email\":\"admin@school.edu\",\"password\":\"Admin123!\"}' -H 'Content-Type: application/json'"
echo "  2. Configure Twilio webhook URL in Twilio Console"
echo "  3. Test WhatsApp by sending a message to: +1 806 515 7636"
echo "  4. Monitor logs: gcloud compute ssh $INSTANCE_NAME --zone=$ZONE -- 'cd ~/teachers_training && sudo docker logs -f teachers_training-app-1'"
echo ""
echo "To view deployment status later, run:"
echo "  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE -- 'cd ~/teachers_training && sudo docker-compose ps'"
echo ""
