# Fix Vertex AI Authentication & RAG Processing

## Problem Summary

**Status**: ❌ **RAG is NOT working** ❌

### Issues Found:
1. ✅ Services healthy (PostgreSQL, Neo4j, ChromaDB)
2. ❌ **Content processing FAILED**: 21 files uploaded, 0 chunks processed
3. ❌ **Vertex AI authentication BROKEN**: "Unable to obtain access token"
4. ⚠️  Database schema missing `session_title` column in `chat_sessions`

### Why WhatsApp Chat Shows Empty Responses:
- Content files are uploaded but **not processed** (0 chunks)
- Vertex AI cannot authenticate → cannot generate embeddings
- ChromaDB has no embeddings → RAG pipeline returns nothing
- WhatsApp receives empty response

---

## Solution: Fix Vertex AI Authentication on GCP

### Option 1: Use Application Default Credentials (Recommended)

```bash
# SSH into GCP
gcloud compute ssh teachers-training --zone us-east5-a

# Setup application default credentials
gcloud auth application-default login

# Restart app to pick up new credentials
cd ~/teachers_training
sudo docker-compose restart app

# Wait for startup
sleep 20

# Check logs
docker logs teachers_training_app_1 --tail 50 | grep -E '(vertex|embed|error)'
```

### Option 2: Use Service Account Key

```bash
# On GCP instance
gcloud compute ssh teachers-training --zone us-east5-a

cd ~/teachers_training

# Check if service account key exists and is valid
cat gcp-key.json | jq .

# If invalid or missing, create new one:
# (Run this from YOUR LOCAL MACHINE with proper permissions)
gcloud iam service-accounts keys create ~/gcp-key-new.json \
  --iam-account=YOUR_SERVICE_ACCOUNT@lms-tanzania-consultant.iam.gserviceaccount.com

# Upload to GCP
gcloud compute scp ~/gcp-key-new.json teachers-training:~/teachers_training/gcp-key.json --zone us-east5-a

# Restart
gcloud compute ssh teachers-training --zone us-east5-a -- "cd ~/teachers_training && sudo docker-compose restart app"
```

---

## After Fixing Vertex AI: Re-process Content

### Method 1: Trigger Re-processing via API

```bash
# Login as admin
TOKEN=$(curl -s -X POST http://34.162.136.203:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"Admin123!"}' | \
  python3 -c "import json,sys; print(json.load(sys.stdin)['tokens']['accessToken'])")

# Get all module content IDs
curl -s http://34.162.136.203:3000/api/admin/modules \
  -H "Authorization: Bearer $TOKEN"

# For each module, trigger reprocessing by re-uploading
# (Or delete and re-upload content files via UI)
```

### Method 2: Re-upload All Content via Admin Portal

1. Go to: http://34.162.136.203:3000/admin/lms-dashboard.html
2. For each module:
   - Click "Delete" on existing files (with 0 chunks)
   - Re-upload the same files
   - Wait for processing (check chunks > 0)

### Method 3: Manual Re-processing Script (Advanced)

```bash
# SSH into GCP
gcloud compute ssh teachers-training --zone us-east5-a

cd ~/teachers_training

# Run re-processing script (to be created)
node scripts/reprocess-all-content.js
```

---

## Verification After Fix

### 1. Check Vertex AI is Working

```bash
# Look for successful embedding generation
docker logs teachers_training_app_1 --tail 100 | grep -E '(embed|vertex|chunk)'

# Should see:
# - "Generated X embeddings"
# - "Processed X chunks"
# - NO "Failed to get access token" errors
```

### 2. Check Content Has Chunks

```bash
gcloud compute ssh teachers-training --zone us-east5-a -- \
  "docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training \
   -c 'SELECT file_path, chunk_count, processing_status FROM module_content LIMIT 10'"

# Should see chunk_count > 0 and status = 'completed'
```

### 3. Check ChromaDB Has Embeddings

```bash
# ChromaDB should have grown significantly
gcloud compute ssh teachers-training --zone us-east5-a -- "du -sh /home/karthi/chromadb_data"

# Should be much larger than 22M (currently 22M with no embeddings)
# With 21 files processed, expect ~100-500MB
```

### 4. Test WhatsApp RAG Query

Send a WhatsApp message to your bot:
```
"What is production in business?"
```

Expected response: Detailed answer from uploaded Business Studies content

If you get empty response: Processing still broken

---

## Fix Database Schema Issue (Optional - for chat history)

The `chat_sessions` table is missing `session_title` column. This doesn't affect RAG but breaks chat history:

```sql
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS session_title VARCHAR(255);
```

Run on GCP:
```bash
gcloud compute ssh teachers-training --zone us-east5-a -- \
  "docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training \
   -c 'ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS session_title VARCHAR(255)'"
```

---

## Quick Fix Commands (All in One)

```bash
# 1. Fix Vertex AI authentication
gcloud compute ssh teachers-training --zone us-east5-a -- "gcloud auth application-default login"

# 2. Restart app
gcloud compute ssh teachers-training --zone us-east5-a -- "cd ~/teachers_training && sudo docker-compose restart app && sleep 20"

# 3. Check if processing works now
gcloud compute ssh teachers-training --zone us-east5-a -- "docker logs teachers_training_app_1 --tail 50 | grep -E '(vertex|embed)'"

# 4. If working, delete and re-upload ONE test file via admin portal
# 5. Check if chunks > 0 for that file
# 6. If yes, re-upload all other files
```

---

## Expected Timeline

1. **Fix Vertex AI**: 5-10 minutes
2. **Re-upload 21 files**: 10-20 minutes (depending on file sizes)
3. **Processing time**: 5-30 minutes (system processes in background)
4. **Verification**: 5 minutes

**Total**: ~30-60 minutes to get RAG fully working

---

## Summary

**Current State**: ❌ RAG NOT working (Vertex AI broken, 0 chunks processed)

**Required Actions**:
1. ✅ Fix Vertex AI authentication
2. ✅ Re-upload or trigger re-processing of all 21 content files
3. ✅ Verify chunks > 0 for all files
4. ✅ Test WhatsApp chat with content question

**After Fix**: WhatsApp chat will return AI-generated responses based on uploaded Business Studies content!

---

*Generated: 2025-10-18*
*Run `./test-whatsapp-rag-wiring.sh` to check current status*
