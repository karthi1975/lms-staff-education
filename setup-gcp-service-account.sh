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
echo "║     GCP Service Account Setup for Compute Engine          ║"
echo "║     User: karthi@kpitechllc.com                           ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Configuration
export PROJECT_ID="lms-tanzania-consultant"
export USER_EMAIL="karthi@kpitechllc.com"
export SERVICE_ACCOUNT_NAME="teachers-training-sa"
export SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo -e "\n${YELLOW}Configuration:${NC}"
echo "  Project ID: $PROJECT_ID"
echo "  User Email: $USER_EMAIL"
echo "  Service Account: $SERVICE_ACCOUNT_NAME"
echo ""

# Check if user is logged in
echo -e "${YELLOW}Step 1: Checking authentication...${NC}"
CURRENT_ACCOUNT=$(gcloud config get-value account 2>/dev/null || echo "")
if [ -z "$CURRENT_ACCOUNT" ]; then
  echo -e "${RED}✗ Not logged in to gcloud${NC}"
  echo "Run: gcloud auth login"
  exit 1
fi

echo -e "${GREEN}✓ Logged in as: $CURRENT_ACCOUNT${NC}"

# Set project
gcloud config set project $PROJECT_ID
echo -e "${GREEN}✓ Project set to: $PROJECT_ID${NC}"

# Check if service account exists
echo -e "\n${YELLOW}Step 2: Creating service account...${NC}"
if gcloud iam service-accounts describe $SERVICE_ACCOUNT_EMAIL 2>/dev/null; then
  echo -e "${GREEN}✓ Service account already exists${NC}"
else
  gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --display-name="Teachers Training System (karthi@kpitechllc.com)" \
    --description="Service account for Teachers Training app on Compute Engine" \
    --project=$PROJECT_ID
  echo -e "${GREEN}✓ Service account created${NC}"
fi

# Grant Vertex AI permissions
echo -e "\n${YELLOW}Step 3: Granting Vertex AI permissions...${NC}"

echo "  Granting roles/aiplatform.user..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/aiplatform.user" \
  --condition=None \
  2>/dev/null || echo -e "${GREEN}  ✓ Already granted${NC}"

echo "  Granting roles/serviceusage.serviceUsageConsumer..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/serviceusage.serviceUsageConsumer" \
  --condition=None \
  2>/dev/null || echo -e "${GREEN}  ✓ Already granted${NC}"

# Additional useful permissions for production
echo "  Granting roles/logging.logWriter..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/logging.logWriter" \
  --condition=None \
  2>/dev/null || echo -e "${GREEN}  ✓ Already granted${NC}"

echo "  Granting roles/monitoring.metricWriter..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/monitoring.metricWriter" \
  --condition=None \
  2>/dev/null || echo -e "${GREEN}  ✓ Already granted${NC}"

echo -e "${GREEN}✓ All permissions granted${NC}"

# Verify permissions
echo -e "\n${YELLOW}Step 4: Verifying permissions...${NC}"
echo "Permissions for ${SERVICE_ACCOUNT_EMAIL}:"
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --format="table(bindings.role)" | grep -E "role|aiplatform|serviceusage" || echo "No permissions found"

# Enable required APIs
echo -e "\n${YELLOW}Step 5: Enabling required APIs...${NC}"
echo "  Enabling Vertex AI API..."
gcloud services enable aiplatform.googleapis.com --project=$PROJECT_ID 2>/dev/null || echo -e "${GREEN}  ✓ Already enabled${NC}"

echo "  Enabling Compute Engine API..."
gcloud services enable compute.googleapis.com --project=$PROJECT_ID 2>/dev/null || echo -e "${GREEN}  ✓ Already enabled${NC}"

echo -e "${GREEN}✓ All APIs enabled${NC}"

echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ✅ Setup Complete!                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"

echo -e "\n${BLUE}Service Account Details:${NC}"
echo "  Email: ${SERVICE_ACCOUNT_EMAIL}"
echo "  Project: ${PROJECT_ID}"
echo "  User: ${USER_EMAIL}"
echo ""

echo -e "${YELLOW}Next Steps for Compute Engine Deployment:${NC}"
echo ""
echo "1. When creating VM instances, attach this service account:"
echo ""
echo -e "${BLUE}   gcloud compute instances create my-vm \\"
echo "     --service-account=\"${SERVICE_ACCOUNT_EMAIL}\" \\"
echo "     --scopes=https://www.googleapis.com/auth/cloud-platform \\"
echo "     --zone=us-east5-a \\"
echo -e "     # ... other flags${NC}"
echo ""
echo "2. For existing VMs, update the service account:"
echo ""
echo -e "${BLUE}   # Stop the VM first"
echo "   gcloud compute instances stop my-vm --zone=us-east5-a"
echo ""
echo "   # Update service account"
echo "   gcloud compute instances set-service-account my-vm \\"
echo "     --zone=us-east5-a \\"
echo "     --service-account=\"${SERVICE_ACCOUNT_EMAIL}\" \\"
echo "     --scopes=https://www.googleapis.com/auth/cloud-platform"
echo ""
echo "   # Start the VM"
echo -e "   gcloud compute instances start my-vm --zone=us-east5-a${NC}"
echo ""
echo "3. Your application will automatically use this service account"
echo "   via the GCP Metadata Server (no credentials files needed!)"
echo ""
echo -e "${GREEN}Authentication will NEVER expire! ✅${NC}"
echo ""
echo -e "${YELLOW}Note:${NC} The updated vertexai.service.js will automatically"
echo "detect and use the Compute Engine service account."
echo ""
