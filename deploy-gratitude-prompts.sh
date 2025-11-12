#!/bin/bash

# Deploy Updated Gratitude Handling Prompts to GCP

echo "================================================"
echo "Deploying Gratitude Handling Prompt Updates"
echo "================================================"

GCP_INSTANCE="teachers-training"
GCP_ZONE="us-east5-a"
GCP_PROJECT="lms-tanzania-consultant"

echo ""
echo "Step 1: Copying updated service files to GCP..."

# Copy bilingual-rag.service.js
gcloud compute scp services/bilingual-rag.service.js \
  karthi@${GCP_INSTANCE}:/tmp/ \
  --zone="${GCP_ZONE}" \
  --project="${GCP_PROJECT}"

# Copy prompt.service.js
gcloud compute scp services/prompt.service.js \
  karthi@${GCP_INSTANCE}:/tmp/ \
  --zone="${GCP_ZONE}" \
  --project="${GCP_PROJECT}"

if [ $? -eq 0 ]; then
    echo "✅ Files copied successfully"
else
    echo "❌ Failed to copy files"
    exit 1
fi

echo ""
echo "Step 2: Updating files in Docker container..."

gcloud compute ssh ${GCP_INSTANCE} \
  --zone="${GCP_ZONE}" \
  --project="${GCP_PROJECT}" \
  --command="
    cd /home/karthi/teachers_training && \
    echo '📋 Backing up current files...' && \
    docker exec teachers_training_app_1 cp /app/services/bilingual-rag.service.js /app/services/bilingual-rag.service.js.backup && \
    docker exec teachers_training_app_1 cp /app/services/prompt.service.js /app/services/prompt.service.js.backup && \
    echo '✅ Backup complete' && \
    echo '' && \
    echo '📋 Copying new files to container...' && \
    docker cp /tmp/bilingual-rag.service.js teachers_training_app_1:/app/services/ && \
    docker cp /tmp/prompt.service.js teachers_training_app_1:/app/services/ && \
    echo '✅ Files updated' && \
    echo '' && \
    echo '📋 Restarting application container...' && \
    docker restart teachers_training_app_1 && \
    echo '✅ Container restarted' && \
    echo '' && \
    echo 'Waiting 10 seconds for application to start...' && \
    sleep 10 && \
    echo '' && \
    echo '================================================' && \
    echo '✅ DEPLOYMENT COMPLETE' && \
    echo '================================================'
  "

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Gratitude handling prompts deployed successfully!"
    echo ""
    echo "Testing the update..."
    echo ""

    # Test with a thank you message
    echo "Test 1: English 'Thank you' message"
    curl -s -X POST http://34.162.168.124:3000/api/chat \
      -H "Content-Type: application/json" \
      -d '{
        "phone": "test_gratitude",
        "message": "Thank you so much for your help!",
        "language": "english"
      }' | jq -r '.response' | head -c 200

    echo ""
    echo ""
    echo "Test 2: Swahili 'Asante' message"
    curl -s -X POST http://34.162.168.124:3000/api/chat \
      -H "Content-Type: application/json" \
      -d '{
        "phone": "test_gratitude_sw",
        "message": "Asante sana!",
        "language": "swahili"
      }' | jq -r '.response' | head -c 200

    echo ""
    echo ""
    echo "================================================"
    echo "✅ Update Complete!"
    echo "================================================"
    echo ""
    echo "Changes Applied:"
    echo "- Updated bilingual-rag.service.js with gratitude handling"
    echo "- Updated prompt.service.js with courtesy instructions"
    echo "- Both English and Swahili prompts enhanced"
    echo ""
    echo "Expected Behavior:"
    echo "When users say 'thank you', 'thanks', or 'asante':"
    echo "  1. Bot responds warmly (You're welcome!, Karibu sana!)"
    echo "  2. Reminds user it's available for education questions"
    echo "  3. Maintains polite, supportive tone"
else
    echo "❌ Deployment failed"
    exit 1
fi
