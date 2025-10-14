#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Setting up Persistent Authentication for karthi@kpitechllc.com ===${NC}"

# Configuration
USER_EMAIL="karthi@kpitechllc.com"
PROJECT_ID="lms-tanzania-consultant"
CREDENTIALS_DIR="$(pwd)/credentials"
ADC_SOURCE="$HOME/.config/gcloud/application_default_credentials.json"
ADC_DEST="$CREDENTIALS_DIR/application_default_credentials.json"

echo -e "\n${YELLOW}Step 1: Checking gcloud authentication...${NC}"

# Check if user is logged in
ACTIVE_ACCOUNT=$(gcloud config get-value account 2>/dev/null || echo "")
if [ "$ACTIVE_ACCOUNT" != "$USER_EMAIL" ]; then
  echo -e "${YELLOW}Please login with your account:${NC}"
  gcloud auth login --account=$USER_EMAIL
fi

# Set the project
gcloud config set project $PROJECT_ID
echo -e "${GREEN}✓ Using account: $USER_EMAIL${NC}"
echo -e "${GREEN}✓ Using project: $PROJECT_ID${NC}"

echo -e "\n${YELLOW}Step 2: Setting up Application Default Credentials...${NC}"

# Run application-default login to get refresh token
echo -e "${YELLOW}Opening browser for authentication...${NC}"
gcloud auth application-default login --project=$PROJECT_ID

# Wait a moment for credentials to be written
sleep 2

if [ ! -f "$ADC_SOURCE" ]; then
  echo -e "${RED}✗ Application default credentials not found${NC}"
  echo "Expected at: $ADC_SOURCE"
  exit 1
fi

echo -e "${GREEN}✓ Application default credentials created${NC}"

echo -e "\n${YELLOW}Step 3: Copying credentials for Docker...${NC}"

# Create credentials directory
mkdir -p "$CREDENTIALS_DIR"

# Copy the ADC file
cp "$ADC_SOURCE" "$ADC_DEST"
chmod 644 "$ADC_DEST"

echo -e "${GREEN}✓ Credentials copied to: $ADC_DEST${NC}"

# Verify the credentials file
if grep -q '"type": "authorized_user"' "$ADC_DEST"; then
  echo -e "${GREEN}✓ User credentials with refresh token detected${NC}"
else
  echo -e "${RED}✗ Invalid credentials format${NC}"
  exit 1
fi

echo -e "\n${YELLOW}Step 4: Verifying authentication...${NC}"

# Test getting access token
export GOOGLE_APPLICATION_CREDENTIALS="$ADC_DEST"
TOKEN=$(gcloud auth application-default print-access-token 2>&1)
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Successfully obtained access token${NC}"
  echo "Token (first 30 chars): ${TOKEN:0:30}..."
else
  echo -e "${RED}✗ Failed to get access token${NC}"
  echo "$TOKEN"
  exit 1
fi

echo -e "\n${YELLOW}Step 5: Testing Vertex AI API access...${NC}"

# Test API endpoint
API_URL="https://us-east5-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-east5/endpoints/openapi/chat/completions"
MODEL="meta/llama-4-maverick-17b-128e-instruct-maas"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: $PROJECT_ID" \
  -d '{
    "model": "'"$MODEL"'",
    "messages": [
      {"role": "user", "content": "Say hello!"}
    ],
    "max_tokens": 20
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Vertex AI API call successful!${NC}"
else
  echo -e "${YELLOW}⚠ API call returned status: $HTTP_CODE${NC}"
  echo "This may be normal if the model needs warm-up"
fi

echo -e "\n${GREEN}=== Setup Complete! ===${NC}"
echo ""
echo -e "${YELLOW}Important Notes:${NC}"
echo "1. Your credentials are stored in: $ADC_DEST"
echo "2. These credentials use a refresh token to get new access tokens automatically"
echo "3. Refresh tokens are long-lived (typically 6 months to 1 year)"
echo "4. Docker will use: /app/credentials/application_default_credentials.json"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Restart Docker containers:"
echo "   docker-compose down && docker-compose up -d"
echo ""
echo "2. Test authentication:"
echo "   ./test-user-auth.sh"
echo ""
echo -e "${YELLOW}When credentials expire (after ~6 months):${NC}"
echo "   Just run this script again to refresh!"
