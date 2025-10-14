#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Deploy Teachers Training to GCP (Automated)           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"

# Configuration
export PROJECT_ID="lms-tanzania-consultant"
export INSTANCE_NAME="teachers-training"
export ZONE="us-east5-a"
export MACHINE_TYPE="e2-standard-4"
export SERVICE_ACCOUNT="teachers-training-sa@${PROJECT_ID}.iam.gserviceaccount.com"

echo -e "${GREEN}==> Step 1: Setting project${NC}"
gcloud config set project $PROJECT_ID --quiet

echo -e "${GREEN}==> Step 2: Checking service account${NC}"
if ! gcloud iam service-accounts describe $SERVICE_ACCOUNT 2>/dev/null; then
  echo -e "${YELLOW}Creating service account...${NC}"
  gcloud iam service-accounts create teachers-training-sa \
    --display-name="Teachers Training System" \
    --project=$PROJECT_ID --quiet

  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/aiplatform.user" --quiet

  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/serviceusage.serviceUsageConsumer" --quiet
fi
echo -e "${GREEN}✓ Service account ready${NC}"

echo -e "${GREEN}==> Step 3: Enabling APIs${NC}"
gcloud services enable compute.googleapis.com --quiet
gcloud services enable aiplatform.googleapis.com --quiet
echo -e "${GREEN}✓ APIs enabled${NC}"

echo -e "${GREEN}==> Step 4: Setting up firewall${NC}"
gcloud compute firewall-rules create allow-http-https --network=default \
  --allow=tcp:80,tcp:443,tcp:3000 --source-ranges=0.0.0.0/0 \
  --target-tags=http-server --quiet 2>/dev/null || echo "Firewall rule exists"
echo -e "${GREEN}✓ Firewall configured${NC}"

echo -e "${GREEN}==> Step 5: Checking existing instance${NC}"
if gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE 2>/dev/null; then
  echo -e "${YELLOW}Instance exists, deleting...${NC}"
  gcloud compute instances delete $INSTANCE_NAME --zone=$ZONE --quiet
fi

echo -e "${GREEN}==> Step 6: Creating VM (this takes ~2 minutes)${NC}"
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
  --tags=http-server,https-server \
  --quiet

echo -e "${GREEN}✓ VM created${NC}"
echo -e "${YELLOW}Waiting 60s for VM to initialize...${NC}"
sleep 60

EXTERNAL_IP=$(gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
echo -e "${GREEN}✓ Instance IP: ${EXTERNAL_IP}${NC}"

echo -e "${GREEN}==> Step 7: Installing Docker${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io docker-compose git
  sudo systemctl enable docker
  sudo systemctl start docker
  sudo usermod -aG docker \$USER
" --quiet 2>&1 | tail -5
echo -e "${GREEN}✓ Docker installed${NC}"

echo -e "${GREEN}==> Step 8: Uploading application${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="sudo mkdir -p /opt/teachers-training && sudo chown -R \$USER:\$USER /opt/teachers-training" --quiet
gcloud compute scp --recurse --zone=$ZONE --quiet \
  --exclude=".git" --exclude="node_modules" --exclude="uploads/*" --exclude="logs/*" \
  . $INSTANCE_NAME:/opt/teachers-training/ 2>&1 | tail -5
echo -e "${GREEN}✓ Files uploaded${NC}"

echo -e "${GREEN}==> Step 9: Starting application${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
  cd /opt/teachers-training
  sudo docker-compose up -d
  sleep 15
" --quiet 2>&1 | tail -10
echo -e "${GREEN}✓ Application started${NC}"

echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  ✅ DEPLOYMENT COMPLETE!                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${GREEN}Your application is running at:${NC}"
echo -e "${YELLOW}  http://${EXTERNAL_IP}:3000/admin/login.html${NC}\n"
echo -e "${GREEN}Default credentials:${NC}"
echo "  Email: admin@school.edu"
echo "  Password: Admin123!"
echo ""
echo -e "${GREEN}VM Details:${NC}"
echo "  Name: $INSTANCE_NAME"
echo "  IP: $EXTERNAL_IP"
echo "  Zone: $ZONE"
echo "  Type: $MACHINE_TYPE"
echo ""
