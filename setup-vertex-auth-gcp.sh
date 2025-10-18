#!/bin/bash

echo "=================================================="
echo "Setup Vertex AI Authentication on GCP"
echo "Using: karthi@kpitechllc.com"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Step 1: SSH into GCP instance..."
gcloud compute ssh teachers-training --zone us-east5-a << 'ENDSSH'

echo "Step 2: Configuring gcloud with karthi@kpitechllc.com..."
gcloud config set account karthi@kpitechllc.com
gcloud config set project lms-tanzania-consultant

echo "Step 3: Setting up Application Default Credentials..."
echo ""
echo "⚠️  IMPORTANT: You will be prompted to authenticate in your browser"
echo "   1. Click the link that appears"
echo "   2. Login with: karthi@kpitechllc.com"
echo "   3. Grant permissions"
echo ""

# Set up Application Default Credentials
# This will store credentials outside Docker at ~/.config/gcloud/
gcloud auth application-default login

echo ""
echo "Step 4: Verifying authentication..."
gcloud auth application-default print-access-token > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Authentication successful!"
else
  echo "❌ Authentication failed!"
  exit 1
fi

echo ""
echo "Step 5: Checking credential location..."
ls -lh ~/.config/gcloud/application_default_credentials.json

echo ""
echo "Step 6: Updating Docker environment to use host credentials..."
cd ~/teachers_training

# Update .env to point to mounted credentials
if grep -q "GOOGLE_APPLICATION_CREDENTIALS" .env; then
  sed -i 's|GOOGLE_APPLICATION_CREDENTIALS=.*|GOOGLE_APPLICATION_CREDENTIALS=/home/nodejs/.config/gcloud/application_default_credentials.json|' .env
else
  echo "GOOGLE_APPLICATION_CREDENTIALS=/home/nodejs/.config/gcloud/application_default_credentials.json" >> .env
fi

echo "✅ Updated .env file"

echo ""
echo "Step 7: Restarting Docker containers..."
sudo docker-compose restart app

echo ""
echo "Waiting 20 seconds for app to start..."
sleep 20

echo ""
echo "Step 8: Verifying Vertex AI connectivity..."
docker logs teachers_training_app_1 --tail 50 2>&1 | grep -E '(vertex|embed|token)' | tail -10

echo ""
echo "=================================================="
echo "Setup Complete!"
echo "=================================================="
echo ""
echo "Credentials stored at:"
echo "  ~/.config/gcloud/application_default_credentials.json"
echo ""
echo "Next Steps:"
echo "  1. Check logs above for 'Unable to obtain access token'"
echo "  2. If no errors: Re-upload content files"
echo "  3. Verify chunks > 0 after upload"
echo "  4. Test WhatsApp chat"
echo ""

ENDSSH

echo ""
echo "=================================================="
echo "Done! Now verify content processing works"
echo "=================================================="
echo ""
