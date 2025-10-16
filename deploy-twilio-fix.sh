#!/bin/bash
# Deploy TwiML webhook fix to GCP

echo "🚀 Deploying Twilio webhook fix..."

gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command "
  cd ~/teachers_training && \
  git pull && \
  docker-compose restart app && \
  echo '⏳ Waiting for app to restart...' && \
  sleep 15 && \
  echo '✅ Checking health...' && \
  curl -s http://localhost:3000/health | jq '.' && \
  echo '' && \
  echo '🎉 Deploy complete!' && \
  echo '' && \
  echo '📱 Now send a WhatsApp message to +1 (806) 515-7636' && \
  echo '   Example: \"hello\" or \"teach me\"'
"

echo ""
echo "✅ Deployment finished!"
echo ""
echo "Next steps:"
echo "1. Send a WhatsApp message to: +1 (806) 515-7636"
echo "2. You should get a response!"
