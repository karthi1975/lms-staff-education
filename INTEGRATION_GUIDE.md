# AI Classification System Integration Guide

## Overview

This guide provides complete step-by-step instructions to integrate the AI-powered content classification system into your Teachers Training platform. Follow these steps in order to enable bulk upload and automatic module organization.

---

## Prerequisites

Before starting integration:

- [x] Node.js 16+ installed
- [x] Docker & Docker Compose installed
- [x] PostgreSQL database running
- [x] ChromaDB service running
- [x] Neo4j service running
- [x] Vertex AI configured and authenticated
- [x] Admin authentication system working

---

## Integration Checklist

### Phase 1: Backend Setup ✅ COMPLETE

- [x] Create `services/content-classification.service.js`
- [x] Create `routes/classification.routes.js`
- [x] Run database migration `005_add_classification_support.sql`
- [x] Add service import to admin routes
- [ ] Mount classification routes in main app

### Phase 2: Frontend Setup

- [ ] Copy `bulk-upload.html` to `public/admin/`
- [ ] Copy `classification-review.html` to `public/admin/`
- [ ] Add navigation links in existing admin pages
- [ ] Test file upload interface
- [ ] Test classification review interface

### Phase 3: Testing & Verification

- [ ] Run database migration
- [ ] Create uploads directory with proper permissions
- [ ] Test end-to-end workflow with sample files
- [ ] Verify module creation
- [ ] Verify file processing (RAG + Graph)
- [ ] Test error handling

### Phase 4: Production Deployment

- [ ] Deploy to GCP
- [ ] Run migration on production database
- [ ] Configure environment variables
- [ ] Set up monitoring and logging
- [ ] Create admin documentation

---

## Step-by-Step Integration

### Step 1: Mount Classification Routes

**File**: `server.js` or `app.js`

**Add these lines after existing route declarations**:

```javascript
// Existing routes
const adminRoutes = require('./routes/admin.routes');
const userRoutes = require('./routes/user.routes');
const whatsappRoutes = require('./routes/whatsapp.routes');

// 👇 ADD THIS
const classificationRoutes = require('./routes/classification.routes');

// Mount routes
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// 👇 ADD THIS
app.use('/api/admin/classify', classificationRoutes);
```

**Verify**:
```bash
# Restart server
docker-compose restart app

# Check logs
docker logs teachers_training-app-1 --tail 50

# Should see: "Classification routes mounted at /api/admin/classify"
```

---

### Step 2: Run Database Migration

#### Local Development

```bash
# Connect to PostgreSQL
DB_HOST=localhost \
DB_PORT=5432 \
DB_NAME=teachers_training \
DB_USER=teachers_user \
DB_PASSWORD=teachers_pass_2024 \
psql -U teachers_user -d teachers_training -f database/migrations/005_add_classification_support.sql
```

#### GCP Production

```bash
# Option 1: Via Docker exec
gcloud compute ssh teachers-training --zone=us-east5-a \
  --command="sudo docker exec teachers_training_app_1 \
  psql -U teachers_user -d teachers_training \
  -f /app/database/migrations/005_add_classification_support.sql"

# Option 2: Copy and run
gcloud compute scp database/migrations/005_add_classification_support.sql \
  teachers-training:/tmp/ --zone=us-east5-a

gcloud compute ssh teachers-training --zone=us-east5-a \
  --command="sudo docker exec -i teachers_training_postgres_1 \
  psql -U teachers_user -d teachers_training < /tmp/005_add_classification_support.sql"
```

**Verify Migration**:

```bash
# Check tables exist
psql -U teachers_user -d teachers_training -c "\dt classification*"

# Should show:
# - classification_temp
# - classification_history

# Check columns added
psql -U teachers_user -d teachers_training -c "\d module_content"

# Should show new columns:
# - classification_confidence
# - classification_topics
# - ai_suggested_module
# - classification_metadata

# Check view created
psql -U teachers_user -d teachers_training -c "\dv classification_stats"
```

---

### Step 3: Create Uploads Directory

```bash
# Local
mkdir -p uploads
chmod 755 uploads
chown -R $(whoami):$(whoami) uploads

# GCP
gcloud compute ssh teachers-training --zone=us-east5-a \
  --command="sudo docker exec teachers_training_app_1 mkdir -p /app/uploads && \
  sudo docker exec teachers_training_app_1 chmod 755 /app/uploads"
```

**Add to `.gitignore`**:
```bash
echo "uploads/" >> .gitignore
```

**Add to `docker-compose.yml`** (if not already present):
```yaml
services:
  app:
    volumes:
      - ./uploads:/app/uploads
```

---

### Step 4: Copy Frontend Files

```bash
# Copy HTML files
cp UI_IMPLEMENTATION.md bulk-upload.html public/admin/bulk-upload.html
cp UI_IMPLEMENTATION.md classification-review.html public/admin/classification-review.html

# Or manually create files from UI_IMPLEMENTATION.md
# (Copy the HTML content from the guide)
```

**Verify files exist**:
```bash
ls -la public/admin/

# Should show:
# - bulk-upload.html
# - classification-review.html
```

---

### Step 5: Add Navigation Links

#### In `public/admin/courses.html`

After the course list table, add a bulk upload button:

```html
<!-- Add this in the course detail/action section -->
<button class="btn btn-primary"
        onclick="window.location.href='bulk-upload.html?courseId=' + courseId"
        style="margin-left: 10px;">
  📤 Bulk Upload with AI
</button>
```

#### In `public/admin/index.html` (Dashboard)

Add a new action card:

```html
<div class="action-card" onclick="window.location.href='courses.html'" style="cursor: pointer;">
  <div class="card-icon" style="font-size: 48px;">🎓</div>
  <h3>AI Course Builder</h3>
  <p>Upload course files in bulk. AI will automatically organize into modules.</p>
</div>
```

#### Create New Course Page (Optional Enhancement)

In `public/admin/courses.html`, add a "Quick Start" button:

```html
<div class="action-buttons" style="margin-bottom: 20px; display: flex; gap: 10px;">
  <button class="btn btn-primary" onclick="showCreateCourseModal()">
    Create New Course
  </button>
  <button class="btn btn-secondary" onclick="showQuickStartModal()">
    🚀 Quick Start with AI
  </button>
</div>
```

---

### Step 6: Test the Integration

#### 6.1 Prepare Test Files

```bash
# Create test directory
mkdir -p test-files

# Download or copy sample PDFs
# Need at least 10-20 files for meaningful testing
```

#### 6.2 Login as Admin

```bash
# Get admin token
curl -X POST http://localhost:3000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@school.edu",
    "password": "Admin123!"
  }' | jq -r '.token'

# Save token
export TOKEN="<your-token>"
```

#### 6.3 Create Test Course

```bash
# Create course
curl -X POST http://localhost:3000/api/admin/courses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "AI Classification Test Course",
    "code": "TEST-001",
    "description": "Testing AI-powered bulk upload and classification",
    "category": "Test",
    "difficulty_level": "intermediate",
    "duration_weeks": 4,
    "sequence_order": 999
  }' | jq .

# Save course ID
export COURSE_ID=<course-id-from-response>
```

#### 6.4 Test Bulk Upload via API

```bash
# Upload files
curl -X POST "http://localhost:3000/api/admin/classify/courses/$COURSE_ID/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@test-files/file1.pdf" \
  -F "files=@test-files/file2.pdf" \
  -F "files=@test-files/file3.pdf" \
  | jq .

# Response should include:
# - classification_id
# - summary with file counts
# - module_suggestions array
```

#### 6.5 Retrieve Classification Results

```bash
# Get classification (use classification_id from previous step)
export CLASSIFICATION_ID="<classification_id>"

curl -X GET "http://localhost:3000/api/admin/classify/$CLASSIFICATION_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | jq .
```

#### 6.6 Accept Classification

```bash
# Accept and create modules
curl -X POST "http://localhost:3000/api/admin/classify/courses/$COURSE_ID/accept" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "classification_id": "'$CLASSIFICATION_ID'",
    "module_decisions": [
      {
        "action": "create",
        "title": "Test Module 1",
        "description": "First test module",
        "sequence_order": 1,
        "topics": ["topic1", "topic2"],
        "learning_level": "beginner",
        "estimated_duration_hours": 4,
        "files": [
          {
            "file_name": "file1.pdf",
            "file_path": "uploads/file-123456.pdf",
            "file_type": "application/pdf",
            "file_size": 123456,
            "topics": ["topic1"],
            "confidence": 0.95
          }
        ]
      }
    ],
    "auto_process": true
  }' | jq .
```

#### 6.7 Verify Module Creation

```bash
# Check modules created
curl -X GET "http://localhost:3000/api/admin/courses/$COURSE_ID/modules" \
  -H "Authorization: Bearer $TOKEN" \
  | jq .

# Check module content
curl -X GET "http://localhost:3000/api/admin/modules/<module-id>/content" \
  -H "Authorization: Bearer $TOKEN" \
  | jq .
```

#### 6.8 Test via UI

```bash
# 1. Open browser
open http://localhost:3000/admin/login.html

# 2. Login with admin credentials
# Email: admin@school.edu
# Password: Admin123!

# 3. Navigate to Courses
# Click "Courses" or go to /admin/courses.html

# 4. Select test course
# Click on "AI Classification Test Course"

# 5. Click "Bulk Upload with AI"
# Should redirect to /admin/bulk-upload.html?courseId=X

# 6. Upload files
# Drag & drop 10-20 PDF files or click "Select Files"

# 7. Start classification
# Click "Start AI Classification"
# Wait for processing (should take 1-2 minutes)

# 8. Review results
# Should auto-redirect to classification-review.html
# Review suggested modules and confidence scores

# 9. Accept classification
# Click "Accept & Process"
# Wait for module creation and file processing

# 10. Verify
# Should redirect back to course detail page
# Check that modules were created
# Verify files are listed under each module
```

---

### Step 7: GCP Deployment

#### 7.1 Push Code to Repository

```bash
# Commit all changes
git add .
git commit -m "feat: Add AI-powered content classification system

- Add content-classification.service.js
- Add classification.routes.js
- Add database migration for classification metadata
- Add bulk-upload.html and classification-review.html
- Add comprehensive documentation

Closes #<issue-number>"

git push origin feature/course-management-ui
```

#### 7.2 Deploy to GCP

```bash
# SSH into GCP instance
gcloud compute ssh teachers-training --zone=us-east5-a

# Pull latest code
cd /opt/teachers_training
sudo git pull origin feature/course-management-ui

# Run migration
sudo docker exec teachers_training_app_1 \
  psql -U teachers_user -d teachers_training \
  -f /app/database/migrations/005_add_classification_support.sql

# Create uploads directory
sudo docker exec teachers_training_app_1 mkdir -p /app/uploads
sudo docker exec teachers_training_app_1 chmod 755 /app/uploads

# Restart services
sudo docker-compose restart app

# Check logs
sudo docker logs teachers_training_app_1 --tail 100

# Verify deployment
curl http://34.124.129.154:3000/health

# Exit SSH
exit
```

#### 7.3 Test GCP Deployment

```bash
# Login to GCP instance
curl -X POST http://34.124.129.154:3000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@school.edu",
    "password": "Admin123!"
  }'

# Test classification endpoint
curl -X POST "http://34.124.129.154:3000/api/admin/classify/courses/1/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@test.pdf"
```

---

### Step 8: Environment Variables

Ensure these environment variables are set:

```bash
# In docker-compose.yml or .env file

# Vertex AI
VERTEX_AI_PROJECT_ID=your-gcp-project
VERTEX_AI_LOCATION=us-central1
VERTEX_AI_MODEL=gemini-1.5-pro

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=teachers_training
DB_USER=teachers_user
DB_PASSWORD=teachers_pass_2024

# ChromaDB
CHROMA_URL=http://chromadb:8000

# Neo4j
NEO4J_URL=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Upload settings
UPLOAD_MAX_SIZE=52428800  # 50MB
MAX_FILES_PER_UPLOAD=200
```

---

## Verification Checklist

After completing integration, verify:

- [ ] Server starts without errors
- [ ] Classification routes are accessible
- [ ] Database migration ran successfully
- [ ] `classification_temp` table exists
- [ ] `classification_history` table exists
- [ ] New columns added to `module_content`
- [ ] New columns added to `modules`
- [ ] Uploads directory exists with proper permissions
- [ ] Bulk upload page loads correctly
- [ ] Classification review page loads correctly
- [ ] Can upload files via UI
- [ ] AI classification completes successfully
- [ ] Module suggestions are displayed
- [ ] Can edit module details
- [ ] Can accept classification
- [ ] Modules are created in database
- [ ] Files are processed (RAG + Graph)
- [ ] Navigation links work correctly
- [ ] Error handling works properly
- [ ] GCP deployment successful

---

## Common Issues and Solutions

### Issue 1: "Classification routes not found"

**Symptoms**: 404 error when accessing `/api/admin/classify/*`

**Solution**:
```bash
# Check if routes are mounted
grep "classify" server.js

# Should show:
# app.use('/api/admin/classify', classificationRoutes);

# Restart server
docker-compose restart app
```

### Issue 2: "Migration failed: relation already exists"

**Symptoms**: Error when running migration about existing tables/columns

**Solution**:
```sql
-- Check what exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'classification%';

-- If tables exist from previous attempt, drop them first
DROP TABLE IF EXISTS classification_history CASCADE;
DROP TABLE IF EXISTS classification_temp CASCADE;

-- Then re-run migration
\i database/migrations/005_add_classification_support.sql
```

### Issue 3: "Upload failed: ENOENT"

**Symptoms**: Files fail to upload with "no such file or directory"

**Solution**:
```bash
# Create uploads directory
mkdir -p uploads
chmod 755 uploads

# In Docker, ensure volume is mounted
docker-compose down
docker-compose up -d

# Check volume
docker exec teachers_training-app-1 ls -la /app/uploads
```

### Issue 4: "Vertex AI authentication failed"

**Symptoms**: Classification fails with auth errors

**Solution**:
```bash
# Check Vertex AI configuration
docker exec teachers_training-app-1 \
  node -e "console.log(require('./services/vertex-ai.service').isConfigured())"

# Verify service account
gcloud auth list

# Re-authenticate if needed
gcloud auth application-default login

# Restart app
docker-compose restart app
```

### Issue 5: "Low classification confidence"

**Symptoms**: Most files have <70% confidence scores

**Solution**:
1. Check if LLM prompt is appropriate for content type
2. Increase context window (currently 3000 words)
3. Provide better module descriptions in existing modules
4. Fine-tune temperature parameter (currently 0.2)

**Edit in `services/content-classification.service.js`**:
```javascript
// Increase sample size
const textSample = await this.extractTextSample(file.path, 5000); // was 3000

// Adjust temperature
temperature: 0.1,  // was 0.2 (lower = more consistent)
```

### Issue 6: "Module suggestions missing topics"

**Symptoms**: Suggested modules have empty or generic topics

**Solution**:
1. Ensure files have sufficient text content
2. Check OCR quality for scanned documents
3. Review LLM response format

**Debug**:
```javascript
// Add logging in classifyFile method
logger.debug('LLM Response:', response);
logger.debug('Parsed Classification:', classification);
```

---

## Performance Optimization

### For Large Uploads (100+ files)

1. **Implement Background Processing**:
```javascript
// In classification.routes.js
const Queue = require('bull');
const classificationQueue = new Queue('classification', 'redis://redis:6379');

// Queue classification instead of running inline
classificationQueue.add({
  courseId,
  files: filePaths,
  adminUserId
});

// Return immediately
res.json({
  success: true,
  classification_id: classificationId,
  status: 'processing',
  message: 'Classification started in background'
});
```

2. **Add Progress Polling Endpoint**:
```javascript
router.get('/status/:classificationId', async (req, res) => {
  const { classificationId } = req.params;

  const progress = await getClassificationProgress(classificationId);

  res.json({
    classification_id: classificationId,
    status: progress.status, // 'processing' | 'completed' | 'failed'
    completed: progress.completed,
    total: progress.total,
    percentage: Math.round((progress.completed / progress.total) * 100)
  });
});
```

3. **Batch LLM Calls**:
```javascript
// Instead of sequential calls
for (const file of files) {
  await classifyFile(file); // Slow!
}

// Use batch processing
const batches = chunk(files, 10); // Process 10 at a time
for (const batch of batches) {
  await Promise.all(batch.map(file => classifyFile(file)));
}
```

### Caching Strategy

```javascript
// Cache classification results
const redis = require('redis');
const cache = redis.createClient({ url: 'redis://redis:6379' });

// Before calling LLM
const cachedResult = await cache.get(`classification:${fileHash}`);
if (cachedResult) {
  return JSON.parse(cachedResult);
}

// After LLM response
await cache.setex(
  `classification:${fileHash}`,
  86400, // 24 hours
  JSON.stringify(classification)
);
```

---

## Monitoring and Logging

### Add Classification Metrics

```javascript
// In classification.routes.js
const metrics = {
  totalClassifications: 0,
  successfulClassifications: 0,
  failedClassifications: 0,
  averageConfidence: 0,
  averageProcessingTime: 0
};

// Track metrics
logger.info('Classification Metrics:', {
  classification_id: classificationId,
  total_files: files.length,
  processing_time: Date.now() - startTime,
  success_rate: (successful / total) * 100,
  avg_confidence: avgConfidence
});
```

### CloudWatch/Stackdriver Integration (GCP)

```javascript
const { Logging } = require('@google-cloud/logging');
const logging = new Logging();
const log = logging.log('classification-audit');

// Log classification events
log.write(log.entry({
  resource: { type: 'global' },
  severity: 'INFO',
  jsonPayload: {
    event: 'classification_completed',
    classification_id: classificationId,
    course_id: courseId,
    total_files: files.length,
    success_rate: successRate,
    duration_ms: processingTime
  }
}));
```

---

## Security Considerations

### File Upload Validation

Already implemented in `routes/classification.routes.js`:

```javascript
fileFilter: (req, file, cb) => {
  const allowedTypes = /pdf|docx|txt|png|jpg|jpeg/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only PDF, DOCX, TXT, and image files are allowed'));
  }
}
```

### Additional Security Measures

```javascript
// 1. Virus scanning (optional)
const ClamScan = require('clamscan');
const clamscan = await new ClamScan().init();

for (const file of files) {
  const { isInfected } = await clamscan.isInfected(file.path);
  if (isInfected) {
    fs.unlinkSync(file.path);
    throw new Error('Infected file detected');
  }
}

// 2. Rate limiting
const rateLimit = require('express-rate-limit');
const classificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 classifications per 15 minutes
  message: 'Too many classification requests'
});

router.post('/courses/:courseId/bulk', classificationLimiter, ...);

// 3. File size limits
limits: {
  fileSize: 50 * 1024 * 1024,  // 50MB per file
  files: 200  // Max 200 files
}
```

---

## Next Steps After Integration

1. **User Training**:
   - Create admin user guide (see USER_JOURNEY_COURSE_CREATION.md)
   - Record video tutorial
   - Conduct training session with admin users

2. **Content Preparation**:
   - Organize existing course materials
   - Prepare batch of test content
   - Run pilot with 1-2 courses

3. **Monitoring Setup**:
   - Set up dashboards for classification metrics
   - Configure alerts for failures
   - Track user adoption

4. **Optimization**:
   - Analyze classification accuracy
   - Fine-tune LLM prompts based on results
   - Implement suggested optimizations

5. **Feature Enhancements**:
   - Add manual file reassignment (drag & drop)
   - Implement classification templates
   - Add bulk module editing
   - Create classification analytics dashboard

---

## Support and Troubleshooting

### Check Logs

```bash
# Application logs
docker logs teachers_training-app-1 --tail 100 -f

# Database logs
docker logs teachers_training-postgres-1 --tail 100 -f

# Filter classification logs
docker logs teachers_training-app-1 2>&1 | grep "classification"
```

### Database Queries for Debugging

```sql
-- Check classification_temp records
SELECT id, course_id, created_at, expires_at, processed
FROM classification_temp
ORDER BY created_at DESC
LIMIT 10;

-- Check classification history
SELECT classification_id, course_id, total_files,
       successful_classifications, suggested_modules_count
FROM classification_history
ORDER BY created_at DESC
LIMIT 20;

-- Check module_content with classification data
SELECT mc.id, mc.file_name, mc.classification_confidence,
       mc.classification_topics, m.title as module_title
FROM module_content mc
JOIN modules m ON mc.module_id = m.id
WHERE mc.classification_confidence IS NOT NULL
ORDER BY mc.classification_confidence DESC
LIMIT 50;

-- Clean up expired classifications
SELECT cleanup_expired_classifications();
```

---

## Success Metrics

Track these metrics to measure success:

1. **Adoption Rate**: % of courses created using AI classification
2. **Time Savings**: Average time to create course (before vs after)
3. **Classification Accuracy**: Average confidence score across all files
4. **Module Acceptance Rate**: % of suggested modules accepted by admins
5. **User Satisfaction**: Admin feedback on accuracy and usefulness
6. **Error Rate**: % of classifications that fail
7. **Processing Time**: Average time to classify N files

**Target Metrics**:
- Time savings: >70% (4-8 hours → 10-15 minutes)
- Classification accuracy: >85% average confidence
- Module acceptance rate: >80%
- Error rate: <5%
- Processing time: <2 minutes for 50 files

---

## Documentation References

- **AI_CLASSIFICATION_SYSTEM.md**: Technical architecture and system design
- **USER_JOURNEY_COURSE_CREATION.md**: Step-by-step user workflow
- **UI_IMPLEMENTATION.md**: Complete frontend code and API reference
- **NEW_ENDPOINTS.md**: Original endpoint specifications
- **This file (INTEGRATION_GUIDE.md)**: Integration instructions

---

## Rollback Plan

If integration causes issues, rollback procedure:

```bash
# 1. Stop services
docker-compose down

# 2. Revert code
git checkout master
# or
git revert <commit-hash>

# 3. Rollback database migration
psql -U teachers_user -d teachers_training << EOF
DROP TABLE IF EXISTS classification_history CASCADE;
DROP TABLE IF EXISTS classification_temp CASCADE;
DROP VIEW IF EXISTS classification_stats CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_classifications();

ALTER TABLE module_content DROP COLUMN IF EXISTS classification_confidence;
ALTER TABLE module_content DROP COLUMN IF EXISTS classification_topics;
ALTER TABLE module_content DROP COLUMN IF EXISTS ai_suggested_module;
ALTER TABLE module_content DROP COLUMN IF EXISTS classification_metadata;

ALTER TABLE modules DROP COLUMN IF EXISTS learning_level;
ALTER TABLE modules DROP COLUMN IF EXISTS estimated_duration_hours;
ALTER TABLE modules DROP COLUMN IF EXISTS prerequisites;
ALTER TABLE modules DROP COLUMN IF EXISTS topics;
EOF

# 4. Restart services
docker-compose up -d

# 5. Verify system working
curl http://localhost:3000/health
```

---

*Created: 2025-10-18*
*Version: 1.0*
*Status: Ready for integration*

For questions or support, contact: [Your contact info]
