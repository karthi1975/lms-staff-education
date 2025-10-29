#!/bin/bash
# API Endpoints Documentation Script
# Extracts and documents all API endpoints from route files

OUTPUT_FILE="/Users/karthi/business/staff_education/teachers_training/report_investigation/02_api_endpoints_report.md"

echo "# API Endpoints Documentation Report" > "$OUTPUT_FILE"
echo "**Generated**: $(date)" >> "$OUTPUT_FILE"
echo "**Server**: Express.js on GCP" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## Table of Contents" >> "$OUTPUT_FILE"
echo "1. Authentication Routes" >> "$OUTPUT_FILE"
echo "2. Admin Routes" >> "$OUTPUT_FILE"
echo "3. User Routes" >> "$OUTPUT_FILE"
echo "4. WhatsApp Routes" >> "$OUTPUT_FILE"
echo "5. File Processing Routes" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Extract routes from each route file
echo "## 1. Authentication Routes (/api)" >> "$OUTPUT_FILE"
echo "**File**: \`routes/auth.routes.js\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
grep -n "router\\.post\|router\\.get\|router\\.put\|router\\.delete" /Users/karthi/business/staff_education/teachers_training/routes/auth.routes.js | \
  sed -E "s/([0-9]+):.*router\\.([a-z]+)\\('([^']+)'.*/- **\U\2\E** \`\/api\3\` (line \1)/" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## 2. Admin Routes (/api/admin)" >> "$OUTPUT_FILE"
echo "**File**: \`routes/admin.routes.js\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "### Enrollment Endpoints" >> "$OUTPUT_FILE"
grep -n "router\\.post.*enroll\|router\\.get.*enroll" /Users/karthi/business/staff_education/teachers_training/routes/admin.routes.js | \
  sed -E "s/([0-9]+):.*router\\.([a-z]+)\\('([^']+)'.*/- **\U\2\E** \`\/api\/admin\3\` (line \1)/" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "### User Management Endpoints" >> "$OUTPUT_FILE"
grep -n "router\\.post.*users\|router\\.get.*users\|router\\.put.*users\|router\\.delete.*users" /Users/karthi/business/staff_education/teachers_training/routes/admin.routes.js | \
  head -20 | \
  sed -E "s/([0-9]+):.*router\\.([a-z]+)\\('([^']+)'.*/- **\U\2\E** \`\/api\/admin\3\` (line \1)/" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "### Course Management Endpoints" >> "$OUTPUT_FILE"
grep -n "router\\.post.*courses\|router\\.get.*courses\|router\\.put.*courses\|router\\.delete.*courses" /Users/karthi/business/staff_education/teachers_training/routes/admin.routes.js | \
  head -20 | \
  sed -E "s/([0-9]+):.*router\\.([a-z]+)\\('([^']+)'.*/- **\U\2\E** \`\/api\/admin\3\` (line \1)/" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "### Module Management Endpoints" >> "$OUTPUT_FILE"
grep -n "router\\.post.*modules\|router\\.get.*modules\|router\\.put.*modules\|router\\.delete.*modules" /Users/karthi/business/staff_education/teachers_training/routes/admin.routes.js | \
  head -20 | \
  sed -E "s/([0-9]+):.*router\\.([a-z]+)\\('([^']+)'.*/- **\U\2\E** \`\/api\/admin\3\` (line \1)/" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "### Quiz Management Endpoints" >> "$OUTPUT_FILE"
grep -n "router\\.post.*quiz\|router\\.get.*quiz\|router\\.put.*quiz\|router\\.delete.*quiz" /Users/karthi/business/staff_education/teachers_training/routes/admin.routes.js | \
  sed -E "s/([0-9]+):.*router\\.([a-z]+)\\('([^']+)'.*/- **\U\2\E** \`\/api\/admin\3\` (line \1)/" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## 3. User Routes (/api/users)" >> "$OUTPUT_FILE"
echo "**File**: \`routes/user.routes.js\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
if [ -f "/Users/karthi/business/staff_education/teachers_training/routes/user.routes.js" ]; then
  grep -n "router\\.post\|router\\.get\|router\\.put\|router\\.delete" /Users/karthi/business/staff_education/teachers_training/routes/user.routes.js | \
    sed -E "s/([0-9]+):.*router\\.([a-z]+)\\('([^']+)'.*/- **\U\2\E** \`\/api\/users\3\` (line \1)/" >> "$OUTPUT_FILE"
else
  echo "*File not found*" >> "$OUTPUT_FILE"
fi
echo "" >> "$OUTPUT_FILE"

echo "## 4. WhatsApp Routes (/whatsapp)" >> "$OUTPUT_FILE"
echo "**File**: \`routes/whatsapp.routes.js\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
if [ -f "/Users/karthi/business/staff_education/teachers_training/routes/whatsapp.routes.js" ]; then
  grep -n "router\\.post\|router\\.get\|router\\.put\|router\\.delete" /Users/karthi/business/staff_education/teachers_training/routes/whatsapp.routes.js | \
    sed -E "s/([0-9]+):.*router\\.([a-z]+)\\('([^']+)'.*/- **\U\2\E** \`\/whatsapp\3\` (line \1)/" >> "$OUTPUT_FILE"
else
  echo "*File not found*" >> "$OUTPUT_FILE"
fi
echo "" >> "$OUTPUT_FILE"

echo "## 5. File Processing Routes (/api/file-processing)" >> "$OUTPUT_FILE"
echo "**File**: \`routes/file-processing.routes.js\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
if [ -f "/Users/karthi/business/staff_education/teachers_training/routes/file-processing.routes.js" ]; then
  grep -n "router\\.post\|router\\.get\|router\\.put\|router\\.delete" /Users/karthi/business/staff_education/teachers_training/routes/file-processing.routes.js | \
    sed -E "s/([0-9]+):.*router\\.([a-z]+)\\('([^']+)'.*/- **\U\2\E** \`\/api\/file-processing\3\` (line \1)/" >> "$OUTPUT_FILE"
else
  echo "*File not found*" >> "$OUTPUT_FILE"
fi
echo "" >> "$OUTPUT_FILE"

echo "## 6. All Route Files" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
ls -la /Users/karthi/business/staff_education/teachers_training/routes/*.js >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"

echo "✅ API endpoints report generated: $OUTPUT_FILE"
