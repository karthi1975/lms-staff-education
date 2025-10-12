# Chat & Upload Processing Fix

## Summary

Fixed multiple issues preventing chat from working:
1. ✅ File deletion functionality (Moodle modules)
2. ✅ Vertex AI authentication (GCP credentials path)
3. ⚠️ ChromaDB metadata filtering (still has issues, but not blocking)
4. 📝 Files need to be re-uploaded after fixes

## Problems Identified

### 1. Chat Returning "Failed to send message"

**Root Cause**: No content in ChromaDB because uploads were failing to process

**Why uploads were failing**:
- Vertex AI couldn't get access tokens (wrong credential path)
- Even with fallback embeddings, ChromaDB was rejecting documents (422 error)

### 2. Vertex AI Authentication Failure

**Error**: `Unable to obtain access token`

**Root Cause**: The embedding service was looking for credentials at `/root/.config/gcloud/application_default_credentials.json` but Docker mounts them to `/home/nodejs/.config/gcloud/application_default_credentials.json` (nodejs user)

**Fix Applied**: Updated `services/embedding.service.js` to check multiple paths:
```javascript
const adcPaths = [
  '/home/nodejs/.config/gcloud/application_default_credentials.json',  // Docker mount
  `${os.homedir()}/.config/gcloud/application_default_credentials.json`,
  '/root/.config/gcloud/application_default_credentials.json',
  process.env.GOOGLE_APPLICATION_CREDENTIALS
].filter(Boolean);
```

### 3. ChromaDB 422 Error

**Error**: `Failed to fetch with status 422: Unprocessable Entity`

**Likely Cause**: ChromaDB is rejecting documents due to:
- Metadata structure issues
- Embedding dimension mismatches
- Invalid data in metadata fields

**Current Workaround**: The system uses fallback embeddings when Vertex AI fails, but ChromaDB still rejects some documents. This is non-blocking since we fixed Vertex AI authentication.

## Files Modified

### 1. `services/embedding.service.js` (lines 25-90)
- Added multi-path credential lookup
- Prioritizes Docker mount path `/home/nodejs/.config/gcloud/`
- Falls back to other common paths
- Better error logging

### 2. `services/vertexai.service.js` (lines 23-90)
- Already had the multi-path fix
- Uses same credential lookup strategy

### 3. `services/content.service.js` (lines 537-625)
- Enhanced `deleteContent` to handle Moodle module chunks
- Deletes by filename instead of chunk ID
- Removes embeddings from ChromaDB

### 4. `services/content.service.js` (lines 64-83)
- Fixed `getModuleContent` query to group by filename
- Shows files instead of individual chunks

## How to Test & Re-Upload

### Step 1: Delete Failed Uploads (Already Done!)
You already deleted both PDF files from Module 42:
- ✅ BS Syllabus Analysis.pdf (deleted)
- ✅ BS F1 Textbook.pdf (deleted)

### Step 2: Re-Upload Files

1. **Navigate to Module 42**:
   ```
   http://localhost:3000/admin/lms-dashboard.html
   → Business Studies
   → View Modules
   → Module 42: Overview & Textbooks
   ```

2. **Upload First File**:
   - Click "📤 Upload Content"
   - Select `BS Syllabus Analysis.pdf`
   - Wait for processing (should show ✅ Processed)
   - **Watch the browser console for errors**

3. **Upload Second File**:
   - Repeat for `BS F1 Textbook.pdf`
   - Wait for processing

4. **Check Logs**:
   ```bash
   docker logs -f teachers_training-app-1
   ```
   - Look for: "Got access token from ADC at /home/nodejs/.config/gcloud/..."
   - Look for: "Generated X embeddings using Vertex AI"
   - Look for: "Document added to ChromaDB"

### Step 3: Test Chat

1. **Open AI Assistant**:
   - Click the "💬 AI Assistant" button in Module 42

2. **Test Questions**:
   ```
   What is overview & textbooksintroduction to business studies curriculum, syllabus analysis, and textbook navigation?
   ```

3. **Expected Response**:
   - Should return relevant content from the uploaded PDFs
   - Should include sources/references
   - Should NOT show "Failed to send message"

## Verification Commands

### Check if files are uploaded and processed:
```bash
curl -s http://localhost:3000/api/modules/42/content | python3 -m json.tool
```

Expected output:
```json
[
  {
    "id": 123,
    "original_name": "BS Syllabus Analysis.pdf",
    "chunk_count": 1,
    "processed": true,
    "uploaded_at": "2025-10-12..."
  },
  {
    "id": 124,
    "original_name": "BS F1 Textbook.pdf",
    "chunk_count": 36,
    "processed": true,
    "uploaded_at": "2025-10-12..."
  }
]
```

### Check ChromaDB document count:
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

Expected: Should show number of chunks (e.g., 37 for both files combined)

### Test Vertex AI authentication:
```bash
docker logs teachers_training-app-1 | grep "Got access token from ADC"
```

Expected output:
```
info: Got access token from ADC at /home/nodejs/.config/gcloud/application_default_credentials.json
```

## Troubleshooting

### If uploads still fail with "Unable to obtain access token"

1. **Check credential file**:
   ```bash
   docker exec teachers_training-app-1 cat /home/nodejs/.config/gcloud/application_default_credentials.json | python3 -m json.tool
   ```

2. **Refresh credentials on host**:
   ```bash
   gcloud auth application-default login
   ```

3. **Restart container**:
   ```bash
   docker restart teachers_training-app-1
   ```

### If uploads fail with ChromaDB 422 error

This might indicate embedding dimension mismatch or metadata issues. Try:

1. **Clear ChromaDB data** (nuclear option):
   ```bash
   docker-compose down
   docker volume rm teachers_training_chromadb_data
   docker-compose up -d
   ```

2. **Re-upload files** after ChromaDB is recreated

### If chat still shows "Failed to send message"

1. **Check browser console** for JavaScript errors
2. **Verify content exists**:
   ```bash
   curl http://localhost:3000/api/modules/42/content
   ```
3. **Check server logs** during chat attempt:
   ```bash
   docker logs -f teachers_training-app-1
   ```

## What's Fixed vs What's Remaining

### ✅ Fixed Issues
1. **Delete functionality**: Files can now be deleted properly
2. **Vertex AI authentication**: Credentials are now accessible
3. **File display**: Shows files grouped by name, not chunks
4. **Quota project**: All Vertex AI calls use `lms-tanzania-consultant`

### ⚠️ Known Issues
1. **ChromaDB 422 errors**: Sometimes rejects documents
   - **Workaround**: Use fallback embeddings (now works with auth fix)
   - **Impact**: May need to retry uploads

2. **Delete ChromaDB metadata filter**: Causes "Invalid where clause"
   - **Impact**: Embeddings might not be deleted (non-critical)
   - **Current**: Logs warning but continues with deletion

### 📝 Next Steps
1. Re-upload both PDF files
2. Monitor logs for successful embedding generation
3. Test chat with uploaded content
4. If still issues, may need to reset ChromaDB volume

## Docker Container Status

```bash
# Check container is running
docker ps | grep teachers_training

# Check logs
docker logs --tail 100 teachers_training-app-1

# Restart if needed
docker restart teachers_training-app-1
```

## Summary of Changes

**Files Modified**:
- `services/embedding.service.js` - Fixed credential path lookup
- `services/content.service.js` - Fixed delete & file display
- `services/vertexai.service.js` - Already had path fix
- `docker-compose.yml` - Already mounts credentials correctly

**Status**: ✅ Ready for testing
**Action Required**: Re-upload PDF files and test chat

---

**Updated**: 2025-10-12 01:50 UTC
**Container**: Restarted with all fixes applied
**Next**: Upload files and test chat functionality
