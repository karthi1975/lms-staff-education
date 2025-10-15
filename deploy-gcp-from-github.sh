#!/bin/bash
set -e

# Deploy to GCP from GitHub (fresh clone, no local migration)

echo "========================================="
echo "Deploy to GCP from GitHub"
echo "========================================="
echo ""

# Configuration
PROJECT_ID="lms-tanzania-consultant"
INSTANCE_NAME="teachers-training"
ZONE="us-east5-a"
MACHINE_TYPE="e2-standard-4"
GITHUB_REPO="https://github.com/karthi1975/lms-staff-education.git"
GITHUB_BRANCH="master"

echo "Configuration:"
echo "  Project: $PROJECT_ID"
echo "  Instance: $INSTANCE_NAME"
echo "  Zone: $ZONE"
echo "  GitHub: $GITHUB_REPO"
echo "  Branch: $GITHUB_BRANCH"
echo ""
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Step 1: Setting project..."
gcloud config set project $PROJECT_ID

echo ""
echo "Step 2: Checking if instance exists..."
if gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE 2>/dev/null; then
    echo "Instance exists. Deleting..."
    gcloud compute instances delete $INSTANCE_NAME --zone=$ZONE --quiet
fi

echo ""
echo "Step 3: Creating VM instance..."
gcloud compute instances create $INSTANCE_NAME \
  --project=$PROJECT_ID \
  --zone=$ZONE \
  --machine-type=$MACHINE_TYPE \
  --boot-disk-size=100GB \
  --boot-disk-type=pd-ssd \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --tags=http-server,https-server

echo ""
echo "Waiting 60 seconds for VM to initialize..."
sleep 60

EXTERNAL_IP=$(gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
echo "✅ Instance IP: $EXTERNAL_IP"

echo ""
echo "Step 4: Installing Docker and dependencies..."
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
    sudo apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io docker-compose git nodejs npm
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker \$USER
" 2>&1 | tail -10

echo ""
echo "Step 5: Cloning repository from GitHub..."
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
    cd ~
    rm -rf teachers_training
    git clone -b $GITHUB_BRANCH $GITHUB_REPO teachers_training
    cd teachers_training
    echo 'Repository cloned successfully'
    ls -la
"

echo ""
echo "Step 6: Installing npm dependencies..."
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
    cd ~/teachers_training
    npm install
    echo '✅ Dependencies installed'
"

echo ""
echo "Step 7: Creating .env file..."
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
    cd ~/teachers_training
    cat > .env << 'ENVEOF'
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=teachers_training
DB_USER=teachers_user
DB_PASSWORD=teachers_pass_2024

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=neo4j_pass_2024

# ChromaDB
CHROMA_URL=http://localhost:8000

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=24h

# Server
PORT=3000
NODE_ENV=production

# Vertex AI (update with your project details)
GOOGLE_CLOUD_PROJECT=lms-tanzania-consultant
VERTEX_AI_LOCATION=us-central1

# Session
SESSION_TTL_HOURS=24
NUDGE_INACTIVITY_HOURS=48

# Quiz
QUIZ_PASS_THRESHOLD=0.7
MAX_QUIZ_ATTEMPTS=2
ENVEOF
    echo '✅ .env file created'
"

echo ""
echo "Step 8: Starting Docker containers..."
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
    cd ~/teachers_training
    sudo docker-compose up -d
    sleep 20
    sudo docker-compose ps
"

echo ""
echo "Step 8: Creating admin user..."
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
    cd ~/teachers_training
    sudo docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c \"INSERT INTO admin_users (email, password_hash, name, role, is_active, created_at, updated_at) VALUES ('admin@school.edu', '\\\$2b\\\$10\\\$mDRhU21qYaVckm.qkvrN..Hpb150MAUMtWlfr1wdw64fndnjdoKEa', 'System Admin', 'admin', true, NOW(), NOW()) ON CONFLICT (email) DO NOTHING;\"
    echo '✅ Admin user created'
"

echo ""
echo "Step 9: Testing health endpoint..."
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
    curl -s http://localhost:3000/health | python3 -m json.tool
"

echo ""
echo "========================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "========================================="
echo ""
echo "Your application is running at:"
echo "  http://$EXTERNAL_IP:3000/admin/login.html"
echo ""
echo "Login credentials:"
echo "  Email: admin@school.edu"
echo "  Password: Admin123!"
echo ""
echo "VM Details:"
echo "  Name: $INSTANCE_NAME"
echo "  IP: $EXTERNAL_IP"
echo "  Zone: $ZONE"
echo ""
echo "To view logs:"
echo "  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
echo "  cd ~/teachers_training"
echo "  sudo docker-compose logs -f app"
echo ""
