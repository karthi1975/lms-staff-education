#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Setting up Persistent Vertex AI Authentication ===${NC}"

# Configuration
export PROJECT_ID="lms-tanzania-consultant"
export SERVICE_ACCOUNT_NAME="teachers-training-sa"
export KEY_FILE="$HOME/teachers-training-key.json"

echo -e "\n${YELLOW}Step 1: Creating service account...${NC}"
# Check if service account already exists
if gcloud iam service-accounts list --project=$PROJECT_ID | grep -q "$SERVICE_ACCOUNT_NAME@"; then
  echo "✓ Service account already exists"
else
  gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --display-name="Teachers Training System" \
    --project=$PROJECT_ID
  echo "✓ Service account created"
fi

echo -e "\n${YELLOW}Step 2: Granting Vertex AI permissions...${NC}"
# Grant Vertex AI User role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user" \
  --condition=None \
  2>/dev/null || echo "✓ Vertex AI User permission already granted"

# Grant additional necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/serviceusage.serviceUsageConsumer" \
  --condition=None \
  2>/dev/null || echo "✓ Service Usage Consumer permission already granted"

echo -e "\n${YELLOW}Step 3: Creating service account key...${NC}"
# Delete old key if exists
if [ -f "$KEY_FILE" ]; then
  echo "Removing old key file..."
  rm "$KEY_FILE"
fi

# Create new key
gcloud iam service-accounts keys create "$KEY_FILE" \
  --iam-account="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --project=$PROJECT_ID

echo "✓ Key file created: $KEY_FILE"

# Set secure permissions
chmod 400 "$KEY_FILE"
echo "✓ Set secure file permissions (400)"

echo -e "\n${YELLOW}Step 4: Creating credentials directory...${NC}"
# Create credentials directory for Docker
mkdir -p "$(pwd)/credentials"
cp "$KEY_FILE" "$(pwd)/credentials/service-account-key.json"
chmod 400 "$(pwd)/credentials/service-account-key.json"
echo "✓ Copied key to ./credentials/"

echo -e "\n${YELLOW}Step 5: Verifying authentication...${NC}"
# Test the service account credentials
export GOOGLE_APPLICATION_CREDENTIALS="$KEY_FILE"

# Get access token to verify it works
TOKEN=$(gcloud auth application-default print-access-token 2>/dev/null || echo "")
if [ -z "$TOKEN" ]; then
  # Activate the service account
  gcloud auth activate-service-account --key-file="$KEY_FILE" --project=$PROJECT_ID
  TOKEN=$(gcloud auth print-access-token)
fi

if [ -n "$TOKEN" ]; then
  echo "✓ Successfully obtained access token"
  echo "Token (first 20 chars): ${TOKEN:0:20}..."
else
  echo -e "${RED}✗ Failed to obtain access token${NC}"
  exit 1
fi

echo -e "\n${GREEN}=== Setup Complete! ===${NC}"
echo ""
echo "Next steps:"
echo "1. Add this to your .env file:"
echo "   GOOGLE_APPLICATION_CREDENTIALS=/app/credentials/service-account-key.json"
echo ""
echo "2. Restart Docker containers:"
echo "   docker-compose down && docker-compose up -d"
echo ""
echo "3. Test Vertex AI connection:"
echo "   ./test-vertex-now.sh"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo "- Service account credentials never expire"
echo "- Key file is stored at: $KEY_FILE"
echo "- Docker will use: ./credentials/service-account-key.json"
echo "- Keep the key file secure and never commit to git"
