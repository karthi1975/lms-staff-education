#!/bin/bash

# Change Admin Password on GCP
# This script changes a user's password after a security incident

# Check if environment variables are set
if [ -z "$ADMIN_EMAIL" ] || [ -z "$NEW_PASSWORD" ]; then
    echo "❌ Error: Missing required environment variables"
    echo "   Required: ADMIN_EMAIL, NEW_PASSWORD"
    echo ""
    echo "Usage:"
    echo "  ADMIN_EMAIL='email@example.com' \\"
    echo "  NEW_PASSWORD='NewSecurePassword123!' \\"
    echo "  ./change-password-gcp.sh"
    exit 1
fi

echo "================================================"
echo "Changing Admin Password on GCP"
echo "================================================"

GCP_INSTANCE="teachers-training"
GCP_ZONE="us-east5-a"
GCP_PROJECT="lms-tanzania-consultant"

echo ""
echo "Step 1: Copying script to GCP instance..."

# Copy the script to GCP
gcloud compute scp scripts/change-admin-password.js \
  karthi@${GCP_INSTANCE}:/tmp/ \
  --zone="${GCP_ZONE}" \
  --project="${GCP_PROJECT}"

if [ $? -eq 0 ]; then
    echo "✅ Script copied successfully"
else
    echo "❌ Failed to copy script"
    exit 1
fi

echo ""
echo "Step 2: Executing password change on GCP instance..."

# Execute the script on GCP
gcloud compute ssh ${GCP_INSTANCE} \
  --zone="${GCP_ZONE}" \
  --project="${GCP_PROJECT}" \
  --command="cd /home/karthi/teachers_training && \
    docker cp /tmp/change-admin-password.js teachers_training_app_1:/app/scripts/ && \
    docker exec -e ADMIN_EMAIL='$ADMIN_EMAIL' -e NEW_PASSWORD='$NEW_PASSWORD' \
      teachers_training_app_1 node scripts/change-admin-password.js"

if [ $? -eq 0 ]; then
    echo ""
    echo "================================================"
    echo "✅ PASSWORD CHANGED SUCCESSFULLY"
    echo "================================================"
    echo ""
    echo "⚠️  IMPORTANT:"
    echo "   1. Inform the user of their new password securely"
    echo "   2. User should change password on first login"
    echo "   3. The exposed password has been rotated"
    echo ""
else
    echo "❌ Failed to change password on GCP"
    exit 1
fi
