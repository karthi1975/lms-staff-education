#!/bin/bash

# Test file upload endpoint on GCP

echo "Creating test file..."
echo "This is a test document for upload testing." > /tmp/test-upload.txt

echo "Logging in to get token..."
TOKEN=$(gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command 'docker exec teachers_training_app_1 node -e "console.log(JSON.stringify({email:\"admin@school.edu\",password:\"Admin123!\"}))" | curl -s -X POST http://localhost:3000/api/admin/login -H "Content-Type: application/json" --data-binary @- | grep -o "\"accessToken\":\"[^\"]*\"" | cut -d"\"" -f4')

echo "Token: ${TOKEN:0:50}..."

echo ""
echo "Testing file upload endpoint..."

# Copy test file to GCP
gcloud compute scp --zone "us-east5-a" /tmp/test-upload.txt teachers-training:/tmp/test-upload.txt --project "lms-tanzania-consultant"

# Test upload from within GCP
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant" --command "curl -s -X POST http://localhost:3000/api/admin/courses/1/simple-upload \
  -H 'Authorization: Bearer $TOKEN' \
  -F 'files=@/tmp/test-upload.txt' \
  --verbose"

echo ""
echo "✅ Test complete"
