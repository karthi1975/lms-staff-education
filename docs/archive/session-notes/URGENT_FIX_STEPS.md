# URGENT: Fix Chat & Upload Issues

## Problem Summary

Chat is failing because **NO content is being saved to ChromaDB**. Two issues are blocking uploads:

1. **GCP Credentials Expired** (HTTP 400 error when refreshing token)
2. **ChromaDB 422 Error** (Rejects all documents, even fallback embeddings)

## Quick Fix (5 minutes)

### Step 1: Refresh GCP Credentials (2 min)

The credentials are expired. Run this on your Mac:

```bash
gcloud auth application-default login
```

This will:
- Open your browser
- Ask you to log in to Google
- Save new credentials to `~/.config/gcloud/application_default_credentials.json`
- Docker will automatically use the new credentials (volume is mounted)

### Step 2: Reset ChromaDB (3 min)

ChromaDB is corrupted and rejecting all documents. Reset it:

```bash
# Stop containers
cd /Users/karthi/business/staff_education/teachers_training
docker-compose down

# Delete ChromaDB data
docker volume rm teachers_training_chromadb_data

# Start fresh
docker-compose up -d

# Wait for containers to be ready
sleep 10

# Check status
docker ps
```

Expected output:
```
teachers_training-postgres-1   Up
teachers_training-chromadb-1   Up
teachers_training-neo4j-1      Up
teachers_training-app-1        Up
```

### Step 3: Re-Upload Files (1 min per file)

1. **Go to Module 42 or 43**
2. **Delete any failed uploads** (if they show in the list)
3. **Upload your PDFs again**
4. **Watch the logs**:
   ```bash
   docker logs -f teachers_training-app-1
   ```

Look for:
- ✅ "Got access token from ADC"
- ✅ "Generated X embeddings using Vertex AI"
- ✅ "Document added to ChromaDB"

### Step 4: Test Chat

Open the AI Assistant and ask a question about the uploaded content.

## Why This Happens

### GCP Credentials Issue
- OAuth refresh tokens expire after ~7 days of inactivity
- HTTP 400 error means the refresh token is invalid
- Need to re-authenticate with `gcloud auth application-default login`

### ChromaDB 422 Error
- Can happen when ChromaDB collection gets corrupted
- Can happen when embedding dimensions change
- Can happen when metadata structure is inconsistent
- Solution: Delete the volume and start fresh

## Detailed Error Flow

```
User uploads PDF
  ↓
App extracts text and creates chunks
  ↓
App tries to generate embeddings via Vertex AI
  ↓
❌ Vertex AI returns 400 (expired credentials)
  ↓
App falls back to local embeddings
  ↓
App tries to save to ChromaDB
  ↓
❌ ChromaDB returns 422 (Unprocessable Entity)
  ↓
Upload fails, no content saved
  ↓
Chat has no content to search
  ↓
❌ Chat returns "Failed to send message"
```

## Verification Commands

### Check GCP auth works:
```bash
docker exec teachers_training-app-1 node -e "
const axios = require('axios');
const fs = require('fs');
const adc = JSON.parse(fs.readFileSync('/home/nodejs/.config/gcloud/application_default_credentials.json', 'utf8'));
(async () => {
  try {
    const res = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: adc.client_id,
      client_secret: adc.client_secret,
      refresh_token: adc.refresh_token,
      grant_type: 'refresh_token'
    });
    console.log('✅ Token refresh works!');
    console.log('Access token:', res.data.access_token.substring(0, 30) + '...');
  } catch (e) {
    console.log('❌ Token refresh failed:', e.response?.status, e.response?.data);
  }
})();
"
```

### Check ChromaDB is empty and working:
```bash
docker exec teachers_training-app-1 node -e "
const chromaService = require('./services/chroma.service');
(async () => {
  await chromaService.initialize();
  const stats = await chromaService.getStats();
  console.log('ChromaDB documents:', stats.total_documents);
})();
"
```

Expected: `ChromaDB documents: 0` (after reset)

### Monitor upload progress:
```bash
docker logs -f teachers_training-app-1 | grep -E "Processing|embedding|ChromaDB|access token"
```

## If Still Failing After These Steps

### Check which Google account is authenticated:
```bash
gcloud auth list
gcloud config get-value project
```

Make sure:
- You're logged in with the correct account
- The project is set to `lms-tanzania-consultant`

### Set project if needed:
```bash
gcloud config set project lms-tanzania-consultant
gcloud auth application-default login
```

### Check Docker logs for other errors:
```bash
docker logs teachers_training-app-1 | tail -100
```

## Alternative: Use Fallback Embeddings Only

If you don't want to deal with GCP auth, you could disable Vertex AI temporarily and just use fallback embeddings:

**NOT RECOMMENDED** - but if you need chat working ASAP:

1. Reset ChromaDB (Step 2 above)
2. Comment out Vertex AI in code (or accept fallback)
3. Re-upload files
4. Chat will work with less accurate embeddings

The issue is ChromaDB 422 error is blocking even fallback embeddings, so you MUST reset ChromaDB.

---

## TL;DR - Copy/Paste This

```bash
# 1. Refresh GCP credentials
gcloud auth application-default login

# 2. Reset ChromaDB
cd /Users/karthi/business/staff_education/teachers_training
docker-compose down
docker volume rm teachers_training_chromadb_data
docker-compose up -d
sleep 10

# 3. Check containers are up
docker ps

# 4. Monitor logs
docker logs -f teachers_training-app-1
```

Then re-upload your PDFs through the web interface.

---

**Status**: Ready to execute
**Time**: ~5 minutes
**Impact**: Fixes both auth and ChromaDB issues
**Result**: Chat will work after files are re-uploaded
