# Cloud Content Reindexing Guide

## Problem
ChromaDB on the cloud instance is empty, causing RAG queries to return "I don't have specific information about that yet."

## Solution: Upload and Reindex Content

### Option 1: Upload Content via Admin Dashboard (Easiest)

1. **Access Cloud Admin Dashboard**:
   ```
   http://34.162.136.203:3000/admin/login.html
   ```

2. **Login** with admin credentials

3. **Navigate to Modules** page

4. **Upload content** for each module:
   - Module 1: Overview & Textbooks
   - Module 2: Entrepreneurship & Business Ideas

5. **Wait for processing** - Content will be automatically:
   - Extracted (text from PDFs)
   - Chunked (into 1000-char segments)
   - Embedded (using Vertex AI)
   - Indexed (into ChromaDB)

6. **Verify** by sending WhatsApp message

### Option 2: Copy Uploads from Local (Faster)

#### Step 1: Copy content files to cloud
```bash
# Get cloud instance name and zone
gcloud compute instances list

# Copy uploads directory
gcloud compute scp --recurse ./uploads \
  teachers-training-vm:~/teachers_training/uploads \
  --zone=us-central1-a

# Also copy database (if needed)
gcloud compute scp --recurse ./database \
  teachers-training-vm:~/teachers_training/database \
  --zone=us-central1-a
```

#### Step 2: SSH to cloud instance
```bash
gcloud compute ssh teachers-training-vm --zone=us-central1-a
```

#### Step 3: Check current ChromaDB status
```bash
cd ~/teachers_training

# Check ChromaDB document count (should be 0)
docker exec teachers_training-app-1 node -e \
  "const chromaService = require('./services/chroma.service'); \
   chromaService.initialize().then(() => chromaService.getStats()) \
   .then(stats => console.log('ChromaDB docs:', stats.total_documents))"
```

#### Step 4: Reindex all content
```bash
# Run reindexing script
docker exec teachers_training-app-1 node scripts/reindex-chromadb.js

# Expected output:
# ✅ Found 5 processed content items in database
# 📄 Processing: BS Syllabus Analysis.pdf (Module: Overview & Textbooks)
# ...
# 📊 ChromaDB after: 81 documents
# 🎉 All content successfully reindexed into ChromaDB!
```

#### Step 5: Verify reindexing
```bash
# Check ChromaDB document count (should be 81)
docker exec teachers_training-app-1 node -e \
  "const chromaService = require('./services/chroma.service'); \
   chromaService.initialize().then(() => chromaService.getStats()) \
   .then(stats => console.log('ChromaDB docs:', stats.total_documents))"
```

### Option 3: Fresh Upload to Cloud (Recommended if no local content)

If you don't have the uploads locally, you can upload fresh content:

#### Step 1: Prepare content files
```bash
# Organize your PDF files
mkdir -p content_to_upload/module1
mkdir -p content_to_upload/module2

# Copy your PDFs
# Module 1: Business Studies syllabus, overview docs
# Module 2: Entrepreneurship, community needs, business ideas
```

#### Step 2: SSH to cloud and upload via admin dashboard
```bash
# SSH to cloud
gcloud compute ssh teachers-training-vm --zone=us-central1-a

# Check Docker is running
docker ps

# Access admin dashboard from browser
# http://34.162.136.203:3000/admin/login.html
```

#### Step 3: Upload content through web interface
1. Login to admin dashboard
2. Go to Modules page
3. Click on each module
4. Upload PDF files
5. Wait for processing

## Verification

### 1. Check ChromaDB Stats
```bash
# From cloud instance
docker exec teachers_training-app-1 node -e \
  "const chromaService = require('./services/chroma.service'); \
   chromaService.initialize().then(() => chromaService.getStats()) \
   .then(stats => console.log('Total documents:', stats.total_documents))"

# Expected: 81 documents (or more if you uploaded additional content)
```

### 2. Test RAG Retrieval
```bash
# Send WhatsApp message to +1 806 515 7636
"What is entrepreneurship?"

# Expected: Educational content from indexed PDFs
# Should NOT see: "I don't have specific information about that yet"
```

### 3. Check Logs
```bash
# Watch logs for RAG activity
docker logs -f teachers_training-app-1 | grep -i "rag\|chromadb\|search"

# Look for:
# "ChromaDB search found X results"
# "RAG query: ..."
# "Document added to ChromaDB"
```

## Troubleshooting

### Issue: "No content to reindex"
**Problem**: Database has no processed content  
**Solution**: Upload content via admin dashboard first

### Issue: "Vertex AI embedding failed"
**Problem**: Credentials not configured on cloud  
**Solution**: 
```bash
# Copy credentials to cloud
gcloud compute scp credentials/application_default_credentials.json \
  teachers-training-vm:~/teachers_training/credentials/ \
  --zone=us-central1-a

# Restart Docker
docker-compose restart app
```

### Issue: Still getting "no specific information"
**Problem**: Content not indexed or RAG not querying correctly  
**Solution**: 
```bash
# Check module_content table
docker exec -i teachers_training-postgres-1 psql -U teachers_user -d teachers_training \
  -c "SELECT COUNT(*) as content_count FROM module_content WHERE processed = true;"

# If 0, upload content via admin dashboard
# If >0, run reindex script again
```

## Expected Results

After successful reindexing:
- ✅ ChromaDB: 81 documents (5 files → 81 chunks)
- ✅ RAG queries return relevant content
- ✅ WhatsApp responses include educational material
- ✅ No more "I don't have specific information" messages

## Quick Commands Reference

```bash
# SSH to cloud
gcloud compute ssh teachers-training-vm --zone=us-central1-a

# Check ChromaDB
docker exec teachers_training-app-1 node -e \
  "const chromaService = require('./services/chroma.service'); \
   chromaService.initialize().then(() => chromaService.getStats()) \
   .then(console.log)"

# Reindex content
docker exec teachers_training-app-1 node scripts/reindex-chromadb.js

# Check logs
docker logs -f teachers_training-app-1 | grep -i "chromadb\|rag"

# Check database
docker exec -i teachers_training-postgres-1 psql -U teachers_user -d teachers_training \
  -c "SELECT id, module_id, original_name, processed, chunk_count FROM module_content;"
```

---
**Next Steps**: Choose option 1, 2, or 3 above and follow the steps to reindex content on cloud.
