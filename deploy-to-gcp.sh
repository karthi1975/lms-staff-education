#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║        Deploy Teachers Training to GCP Compute Engine     ║"
echo "║                 Option 1: e2-standard-4                    ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Configuration
export PROJECT_ID="lms-tanzania-consultant"
export INSTANCE_NAME="teachers-training"
export ZONE="us-east5-a"
export MACHINE_TYPE="e2-standard-4"
export SERVICE_ACCOUNT="teachers-training-sa@${PROJECT_ID}.iam.gserviceaccount.com"
export REGION="us-east5"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Project: $PROJECT_ID"
echo "  Instance: $INSTANCE_NAME"
echo "  Zone: $ZONE"
echo "  Machine Type: $MACHINE_TYPE (4 vCPUs, 16 GB RAM)"
echo "  Service Account: $SERVICE_ACCOUNT"
echo ""
echo -e "${YELLOW}Press Enter to continue or Ctrl+C to cancel...${NC}"
read

# Set project
echo -e "\n${GREEN}==> Step 1: Setting project${NC}"
gcloud config set project $PROJECT_ID
echo -e "${GREEN}✓ Project set to: $PROJECT_ID${NC}"

# Check if service account exists
echo -e "\n${GREEN}==> Step 2: Checking service account${NC}"
if gcloud iam service-accounts describe $SERVICE_ACCOUNT 2>/dev/null; then
  echo -e "${GREEN}✓ Service account exists${NC}"
else
  echo -e "${YELLOW}⚠ Service account not found. Creating...${NC}"
  ./setup-gcp-service-account.sh
fi

# Enable required APIs
echo -e "\n${GREEN}==> Step 3: Enabling required APIs${NC}"
gcloud services enable compute.googleapis.com --quiet
gcloud services enable aiplatform.googleapis.com --quiet
echo -e "${GREEN}✓ APIs enabled${NC}"

# Create firewall rules
echo -e "\n${GREEN}==> Step 4: Setting up firewall rules${NC}"

# HTTP/HTTPS
if gcloud compute firewall-rules describe allow-http-https 2>/dev/null; then
  echo -e "${GREEN}✓ HTTP/HTTPS firewall rule exists${NC}"
else
  gcloud compute firewall-rules create allow-http-https \
    --network=default \
    --allow=tcp:80,tcp:443,tcp:3000 \
    --source-ranges=0.0.0.0/0 \
    --target-tags=http-server,https-server \
    --description="Allow HTTP, HTTPS, and app port 3000" \
    --quiet
  echo -e "${GREEN}✓ HTTP/HTTPS firewall rule created${NC}"
fi

# SSH (restricted to your IP)
YOUR_IP=$(curl -s ifconfig.me)
if gcloud compute firewall-rules describe allow-ssh-restricted 2>/dev/null; then
  echo -e "${GREEN}✓ SSH firewall rule exists${NC}"
else
  gcloud compute firewall-rules create allow-ssh-restricted \
    --network=default \
    --allow=tcp:22 \
    --source-ranges="${YOUR_IP}/32" \
    --target-tags=ssh-access \
    --description="Allow SSH from current IP" \
    --quiet
  echo -e "${GREEN}✓ SSH firewall rule created (restricted to ${YOUR_IP})${NC}"
fi

# Check if instance already exists
echo -e "\n${GREEN}==> Step 5: Checking if instance exists${NC}"
if gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE 2>/dev/null; then
  echo -e "${YELLOW}⚠ Instance already exists${NC}"
  echo -e "${YELLOW}Options:${NC}"
  echo "  1. Delete and recreate"
  echo "  2. Use existing instance"
  echo "  3. Cancel"
  read -p "Choose (1/2/3): " choice

  if [ "$choice" = "1" ]; then
    echo -e "${YELLOW}Deleting existing instance...${NC}"
    gcloud compute instances delete $INSTANCE_NAME --zone=$ZONE --quiet
    echo -e "${GREEN}✓ Instance deleted${NC}"
  elif [ "$choice" = "2" ]; then
    echo -e "${GREEN}✓ Using existing instance${NC}"
    INSTANCE_EXISTS=true
  else
    echo -e "${RED}Deployment cancelled${NC}"
    exit 0
  fi
fi

# Create VM instance
if [ "$INSTANCE_EXISTS" != "true" ]; then
  echo -e "\n${GREEN}==> Step 6: Creating VM instance${NC}"
  echo "  Machine: $MACHINE_TYPE"
  echo "  Disk: 100 GB SSD"
  echo "  OS: Ubuntu 22.04 LTS"
  echo ""

  gcloud compute instances create $INSTANCE_NAME \
    --project=$PROJECT_ID \
    --zone=$ZONE \
    --machine-type=$MACHINE_TYPE \
    --service-account=$SERVICE_ACCOUNT \
    --scopes=https://www.googleapis.com/auth/cloud-platform \
    --boot-disk-size=100GB \
    --boot-disk-type=pd-ssd \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --tags=http-server,https-server,ssh-access \
    --metadata=startup-script='#!/bin/bash
      apt-get update
      apt-get install -y docker.io docker-compose git curl
      systemctl enable docker
      systemctl start docker
      usermod -aG docker $(whoami)
    '

  echo -e "${GREEN}✓ VM instance created${NC}"
  echo -e "${YELLOW}Waiting 60 seconds for VM to initialize...${NC}"
  sleep 60
else
  echo -e "\n${GREEN}==> Step 6: Using existing VM instance${NC}"
fi

# Get instance IP
EXTERNAL_IP=$(gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
echo -e "${GREEN}✓ Instance IP: ${EXTERNAL_IP}${NC}"

# Wait for SSH to be ready
echo -e "\n${GREEN}==> Step 7: Waiting for SSH to be ready${NC}"
for i in {1..30}; do
  if gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="echo 'SSH ready'" 2>/dev/null; then
    echo -e "${GREEN}✓ SSH is ready${NC}"
    break
  fi
  echo -n "."
  sleep 2
done
echo ""

# Install dependencies
echo -e "\n${GREEN}==> Step 8: Installing dependencies on VM${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
  set -e
  echo '==> Installing Docker and dependencies'
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io docker-compose git curl htop 2>&1 | tail -5
  sudo systemctl enable docker
  sudo systemctl start docker
  sudo usermod -aG docker \$USER
  echo '✓ Docker installed'
"
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Create deployment directory
echo -e "\n${GREEN}==> Step 9: Creating deployment directory${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
  sudo mkdir -p /opt/teachers-training
  sudo chown -R \$USER:\$USER /opt/teachers-training
"
echo -e "${GREEN}✓ Directory created${NC}"

# Copy application files
echo -e "\n${GREEN}==> Step 10: Uploading application files${NC}"
echo "  Copying project files to VM..."
gcloud compute scp --recurse \
  --zone=$ZONE \
  --exclude=".git" \
  --exclude="node_modules" \
  --exclude="uploads/*" \
  --exclude="logs/*" \
  . $INSTANCE_NAME:/opt/teachers-training/
echo -e "${GREEN}✓ Files uploaded${NC}"

# Create .env file on VM
echo -e "\n${GREEN}==> Step 11: Creating .env configuration${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
cat > /opt/teachers-training/.env << 'EOF'
# Application Configuration
NODE_ENV=production
PORT=3000

# Database Configuration (Docker internal)
DB_HOST=postgres
DB_PORT=5432
DB_NAME=teachers_training
DB_USER=teachers_user
DB_PASSWORD=teachers_pass_2024

# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production-$(openssl rand -hex 32)
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# ChromaDB Configuration
CHROMA_URL=http://chromadb:8000
CHROMA_HOST=chromadb
CHROMA_PORT=8000

# Neo4j Configuration
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
NEO4J_HOST=neo4j
NEO4J_PORT=7687

# WhatsApp Configuration
WHATSAPP_ACCESS_TOKEN=${WHATSAPP_ACCESS_TOKEN:-your_token_here}
WHATSAPP_PHONE_NUMBER_ID=${WHATSAPP_PHONE_NUMBER_ID:-your_phone_id_here}
WHATSAPP_BUSINESS_ACCOUNT_ID=${WHATSAPP_BUSINESS_ACCOUNT_ID:-your_account_id_here}
WEBHOOK_VERIFY_TOKEN=education_bot_verify_2024

# GCP Vertex AI Configuration
ENDPOINT=us-east5-aiplatform.googleapis.com
REGION=us-east5
GCP_PROJECT_ID=lms-tanzania-consultant
VERTEX_AI_ENDPOINT=us-east5-aiplatform.googleapis.com
VERTEX_AI_REGION=us-east5
VERTEX_AI_MODEL=meta/llama-4-maverick-17b-128e-instruct-maas
GOOGLE_CLOUD_QUOTA_PROJECT=lms-tanzania-consultant

# File Upload Configuration
UPLOAD_MAX_SIZE=104857600
CONTENT_CHUNK_SIZE=1000
EOF
"
echo -e "${GREEN}✓ .env file created${NC}"

# Install npm dependencies and start containers
echo -e "\n${GREEN}==> Step 12: Installing npm dependencies${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
  cd /opt/teachers-training
  npm install --production 2>&1 | tail -10
"
echo -e "${GREEN}✓ npm dependencies installed${NC}"

# Start Docker containers
echo -e "\n${GREEN}==> Step 13: Starting Docker containers${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
  cd /opt/teachers-training
  sudo docker-compose down 2>/dev/null || true
  sudo docker-compose up -d
  sleep 10
  sudo docker-compose ps
"
echo -e "${GREEN}✓ Docker containers started${NC}"

# Wait for app to be ready
echo -e "\n${GREEN}==> Step 14: Waiting for application to start${NC}"
for i in {1..30}; do
  if gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="curl -s http://localhost:3000/health" 2>/dev/null | grep -q "ok"; then
    echo -e "${GREEN}✓ Application is ready${NC}"
    break
  fi
  echo -n "."
  sleep 2
done
echo ""

# Get application status
echo -e "\n${GREEN}==> Step 15: Checking application status${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
  cd /opt/teachers-training
  echo '=== Docker Container Status ==='
  sudo docker-compose ps
  echo ''
  echo '=== Application Logs (last 20 lines) ==='
  sudo docker-compose logs --tail=20 app
"

echo -e "\n${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║                  ✅ DEPLOYMENT COMPLETE!                   ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "\n${GREEN}Your application is now running!${NC}"
echo ""
echo -e "${YELLOW}Application URLs:${NC}"
echo "  Admin Dashboard: http://${EXTERNAL_IP}:3000/admin/login.html"
echo "  Health Check:    http://${EXTERNAL_IP}:3000/health"
echo "  API Base:        http://${EXTERNAL_IP}:3000/api"
echo ""
echo -e "${YELLOW}Default Admin Credentials:${NC}"
echo "  Email:    admin@school.edu"
echo "  Password: Admin123!"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo "  SSH to VM:       gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
echo "  View logs:       gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command='cd /opt/teachers-training && sudo docker-compose logs -f'"
echo "  Restart app:     gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command='cd /opt/teachers-training && sudo docker-compose restart'"
echo "  Stop VM:         gcloud compute instances stop $INSTANCE_NAME --zone=$ZONE"
echo "  Start VM:        gcloud compute instances start $INSTANCE_NAME --zone=$ZONE"
echo ""
echo -e "${YELLOW}Instance Details:${NC}"
echo "  Name:            $INSTANCE_NAME"
echo "  Zone:            $ZONE"
echo "  Machine Type:    $MACHINE_TYPE (4 vCPUs, 16 GB RAM)"
echo "  External IP:     $EXTERNAL_IP"
echo "  Internal IP:     $(gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --format='get(networkInterfaces[0].networkIP)')"
echo "  Cost:            ~$120/month"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Open: http://${EXTERNAL_IP}:3000/admin/login.html"
echo "  2. Login with default admin credentials"
echo "  3. Upload training content"
echo "  4. Test WhatsApp integration"
echo ""
echo -e "${GREEN}Vertex AI authentication is automatic via Metadata Server! ✅${NC}"
echo ""
