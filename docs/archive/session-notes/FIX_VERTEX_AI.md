# Fix Vertex AI 403 Permission Error

## Exact Issue

**Status**: ❌ Permission Denied (403)

**Error Message**:
```
Permission 'aiplatform.endpoints.predict' denied on resource
'//aiplatform.googleapis.com/projects/staff-education/locations/us-east5/endpoints/openapi'
```

**Root Cause**:
- ✅ Authentication working (access token retrieved successfully)
- ❌ IAM permissions missing for Vertex AI in project `staff-education`
- Your account: `karthi@kpitechllc.com`
- Missing role: `roles/aiplatform.user`

## What's Happening Now

1. **RAG Pipeline**: ✅ Working perfectly
   - ChromaDB retrieves 5 relevant documents
   - Module filtering working
   - Embeddings using fallback (simple hash method)

2. **Vertex AI Calls**: ❌ Failing with 403
   - Cannot generate embeddings
   - Cannot generate AI responses
   - Falling back to hardcoded responses

## Quick Fix (Choose One)

### Option 1: Grant IAM Permissions (Recommended)

**Step 1: Refresh gcloud auth**
```bash
gcloud auth application-default login
```

**Step 2: Grant Vertex AI permissions**
```bash
# For your user account
gcloud projects add-iam-policy-binding staff-education \
  --member="user:karthi@kpitechllc.com" \
  --role="roles/aiplatform.user"
```

**Step 3: Verify**
```bash
# Check if role was granted
gcloud projects get-iam-policy staff-education \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/aiplatform.user"
```

**Step 4: Test**
```bash
docker restart teachers_training-app-1
docker exec teachers_training-app-1 node test-vertex-ai-detailed.js
```

### Option 2: Use Quota Project Permissions

If you have permissions on `lms-tanzania-consultant` instead:

```bash
gcloud projects add-iam-policy-binding lms-tanzania-consultant \
  --member="user:karthi@kpitechllc.com" \
  --role="roles/aiplatform.user"
```

### Option 3: Enable Vertex AI API

Check if API is enabled:
```bash
gcloud services list --enabled \
  --filter="name:aiplatform.googleapis.com" \
  --project=staff-education
```

If not enabled:
```bash
gcloud services enable aiplatform.googleapis.com --project=staff-education
```

### Option 4: Use Service Account (Alternative)

If you can't grant permissions to user account, create a service account:

```bash
# 1. Create service account
gcloud iam service-accounts create vertex-ai-user \
  --display-name="Vertex AI User" \
  --project=staff-education

# 2. Grant permissions
gcloud projects add-iam-policy-binding staff-education \
  --member="serviceAccount:vertex-ai-user@staff-education.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# 3. Create key
gcloud iam service-accounts keys create vertex-ai-key.json \
  --iam-account=vertex-ai-user@staff-education.iam.gserviceaccount.com \
  --project=staff-education

# 4. Update docker-compose.yml
# Add to environment:
#   GOOGLE_APPLICATION_CREDENTIALS: /app/vertex-ai-key.json
# Add to volumes:
#   - ./vertex-ai-key.json:/app/vertex-ai-key.json:ro
```

## Verification Commands

### Test Vertex AI Access
```bash
docker exec teachers_training-app-1 node test-vertex-ai-detailed.js
```

Look for:
- ✅ "Embedding generated successfully" (not fallback)
- ✅ "Text generation successful" (AI response, not Swahili fallback)
- ❌ Any 403 errors

### Test Chat API End-to-End
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is entrepreneurship and business ideas?",
    "module_id": 1,
    "language": "english"
  }' | jq '.response'
```

**Expected (before fix)**:
```
"Effective classroom management involves establishing clear expectations..."
```
(This is the hardcoded fallback)

**Expected (after fix)**:
```
"Entrepreneurship is the process of identifying opportunities and creating business ventures..."
```
(This will be AI-generated based on actual content)

## Alternative Solutions (If Can't Fix GCP)

### Switch to OpenAI

1. Get OpenAI API key from https://platform.openai.com/api-keys

2. Update `.env`:
```env
USE_OPENAI=true
OPENAI_API_KEY=sk-...your-key...
OPENAI_MODEL=gpt-4-turbo-preview
```

3. Modify `services/vertexai.service.js` to use OpenAI client

### Switch to Local Model

Use Ollama for local inference:

```bash
# Install Ollama
brew install ollama

# Download model
ollama pull llama2

# Update code to use Ollama API
# http://localhost:11434/api/generate
```

### Use Anthropic Claude

1. Get API key from https://console.anthropic.com/

2. Update `.env`:
```env
USE_CLAUDE=true
ANTHROPIC_API_KEY=sk-ant-...your-key...
CLAUDE_MODEL=claude-3-sonnet-20240229
```

## Expected Timeline

- **Option 1 (IAM fix)**: 5 minutes
- **Option 2 (Service account)**: 15 minutes
- **Option 3 (OpenAI)**: 10 minutes
- **Option 4 (Local model)**: 30 minutes

## Summary

**Current State:**
- RAG pipeline: ✅ Working
- Document retrieval: ✅ Working
- Module filtering: ✅ Working
- Vertex AI: ❌ 403 Permission Denied
- AI responses: ❌ Using hardcoded fallbacks

**After Fix:**
- Everything above ✅
- Vertex AI: ✅ Working
- AI responses: ✅ Real AI-generated content

**The only issue is GCP IAM permissions - everything else is wired correctly!**

---

Run this to fix:
```bash
gcloud auth application-default login
gcloud projects add-iam-policy-binding staff-education \
  --member="user:karthi@kpitechllc.com" \
  --role="roles/aiplatform.user"
```

Then test:
```bash
docker restart teachers_training-app-1
docker exec teachers_training-app-1 node test-vertex-ai-detailed.js
```
