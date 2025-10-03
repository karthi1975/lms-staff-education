#!/bin/bash

echo "Setting up Google Cloud Authentication for Teachers Training Project"
echo "====================================================================="

# Option 1: Use Application Default Credentials (Recommended for local development)
echo ""
echo "Option 1: Using Application Default Credentials (Recommended)"
echo "--------------------------------------------------------------"
echo "Run the following command to authenticate:"
echo ""
echo "gcloud auth application-default login"
echo ""
echo "After authentication, update .env file:"
echo "Comment out: # GOOGLE_APPLICATION_CREDENTIALS=..."
echo "Uncomment: USE_APPLICATION_DEFAULT_CREDENTIALS=true"
echo ""

# Option 2: Create Service Account Key
echo "Option 2: Using Service Account Key (For production)"
echo "-----------------------------------------------------"
echo "1. Go to Google Cloud Console"
echo "2. Navigate to IAM & Admin > Service Accounts"
echo "3. Create a service account with the following roles:"
echo "   - Vertex AI User"
echo "   - Storage Object Viewer"
echo "4. Download the JSON key and save it as:"
echo "   /Users/karthi/business/staff_education/teachers_training/service-account-key.json"
echo ""
echo "Make sure the service account key path in .env matches the actual file location."
echo ""

# Check current auth status
echo "Current Authentication Status:"
echo "------------------------------"
gcloud config get-value project 2>/dev/null || echo "No project set"
gcloud auth list 2>/dev/null || echo "No auth configured"