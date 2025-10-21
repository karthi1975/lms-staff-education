#!/bin/bash

# Upload Business Studies F2 Content to GCP
# This script uploads content files to modules

set -e

GCP_HOST="34.162.136.203:3000"
CONTENT_DIR="/Users/karthi/business/staff_education/education_materials"

echo "🚀 Business Studies Content Upload Script"
echo "=========================================="
echo ""

# Login and get token
echo "📝 Logging in..."
TOKEN=$(curl -s -X POST "http://${GCP_HOST}/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"Admin123!"}' | \
  python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('tokens', {}).get('accessToken', data.get('token', '')))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get authentication token"
  exit 1
fi

echo "✅ Login successful"
echo ""

# Use fixed course ID (Business Studies for Entrepreneurs)
COURSE_ID=2
echo "📚 Using Course ID: $COURSE_ID (Business Studies)"
echo ""

# Module mappings
declare -A MODULES
MODULES[6]="Production"
MODULES[7]="Financing"
MODULES[8]="Management"
MODULES[9]="Warehousing"
MODULES[10]="Opportunity"

# File to module mapping (based on content relevance)
upload_file() {
  local MODULE_ID=$1
  local MODULE_NAME=$2
  local FILE_PATH=$3
  local ORIGINAL_NAME=$(basename "$FILE_PATH")

  echo "📤 Uploading to Module $MODULE_ID ($MODULE_NAME): $ORIGINAL_NAME"

  # Check file size (10MB limit)
  FILE_SIZE=$(stat -f%z "$FILE_PATH" 2>/dev/null || stat -c%s "$FILE_PATH" 2>/dev/null)
  if [ $FILE_SIZE -gt 10485760 ]; then
    echo "   ⚠️  File too large ($((FILE_SIZE / 1024 / 1024))MB), skipping (max 10MB)"
    return
  fi

  RESPONSE=$(curl -s -X POST "http://${GCP_HOST}/api/admin/portal/courses/${COURSE_ID}/modules/${MODULE_ID}/upload" \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@${FILE_PATH}" \
    -F "original_file=${ORIGINAL_NAME}")

  SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "false")

  if [ "$SUCCESS" = "True" ]; then
    echo "   ✅ Upload successful"
  else
    echo "   ❌ Upload failed: $RESPONSE"
  fi

  echo ""
  sleep 2  # Rate limiting
}

echo "🔄 Starting uploads..."
echo ""

# Upload main textbook to all modules (covers all topics)
if [ -f "${CONTENT_DIR}/BUSINESS_STUDIES_F2_Part1.pdf" ]; then
  for MODULE_ID in "${!MODULES[@]}"; do
    upload_file $MODULE_ID "${MODULES[$MODULE_ID]}" "${CONTENT_DIR}/BUSINESS_STUDIES_F2_Part1.pdf"
  done
fi

if [ -f "${CONTENT_DIR}/BUSINESS_STUDIES_F2_Part2.pdf" ]; then
  for MODULE_ID in "${!MODULES[@]}"; do
    upload_file $MODULE_ID "${MODULES[$MODULE_ID]}" "${CONTENT_DIR}/BUSINESS_STUDIES_F2_Part2.pdf"
  done
fi

# Upload lesson plans (relevant to all modules)
if [ -f "${CONTENT_DIR}/BS Lesson Plan Book_Final_May 2025.pdf" ]; then
  upload_file 6 "Production" "${CONTENT_DIR}/BS Lesson Plan Book_Final_May 2025.pdf"
fi

# Upload teacher's manual (helpful for all modules)
if [ -f "${CONTENT_DIR}/BS Teachers-Project Manual_Final_May 2025.pdf" ]; then
  upload_file 7 "Financing" "${CONTENT_DIR}/BS Teachers-Project Manual_Final_May 2025.pdf"
fi

# Upload syllabus analysis
if [ -f "${CONTENT_DIR}/BS Syllabus Analysis.pdf" ]; then
  upload_file 8 "Management" "${CONTENT_DIR}/BS Syllabus Analysis.pdf"
fi

# Upload project guidelines
if [ -f "${CONTENT_DIR}/GUIDELINES_FOR_PROJECT_BASED_ASSESSMENT_FOR_BUSINESS_STUDIES.pdf" ]; then
  upload_file 10 "Opportunity" "${CONTENT_DIR}/GUIDELINES_FOR_PROJECT_BASED_ASSESSMENT_FOR_BUSINESS_STUDIES.pdf"
fi

# Upload Form II projects
if [ -f "${CONTENT_DIR}/Form II-Term I-Project.pdf" ]; then
  upload_file 9 "Warehousing" "${CONTENT_DIR}/Form II-Term I-Project.pdf"
fi

if [ -f "${CONTENT_DIR}/Form II-Term II-Project.pdf" ]; then
  upload_file 10 "Opportunity" "${CONTENT_DIR}/Form II-Term II-Project.pdf"
fi

echo ""
echo "=========================================="
echo "✅ Upload complete!"
echo ""
echo "🔍 Next steps:"
echo "1. Visit: http://${GCP_HOST}/admin/courses.html"
echo "2. Click on 'Business Studies for Entrepreneurs'"
echo "3. Verify files are uploaded for each module"
echo "4. Test chat: http://${GCP_HOST}/admin/chat.html"
echo ""
echo "💬 The chat should now work with real content!"
