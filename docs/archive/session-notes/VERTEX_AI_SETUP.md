# Vertex AI Setup for Tanzania LMS

## Issue: Llama Model Quota Exceeded

You were getting quota errors with the Llama-4 model. This is common because:
1. Llama models are third-party (Meta) with stricter quotas
2. New GCP projects have limited quota for these models
3. Gemini models (Google's native) have better quota availability

## Solution: Switch to Gemini Models

### Recommended Models (in order of preference):

1. **Gemini 2.0 Flash (Experimental)** ⭐ BEST
   - Fastest model
   - Best quota availability
   - Good for production use despite "experimental" label
   - Model ID: `gemini-2.0-flash-exp`

2. **Gemini 1.5 Flash** ⭐ RECOMMENDED
   - Fast and efficient
   - Good balance of speed and capability
   - Excellent quota
   - Model ID: `gemini-1.5-flash-002`

3. **Gemini 1.5 Pro**
   - Most capable model
   - Better reasoning and longer context
   - Stricter quotas
   - Model ID: `gemini-1.5-pro-002`

### Regions Closest to Tanzania

Tanzania is located at approximately 6°S, 35°E. Here are the closest GCP regions:

1. **me-west1 (Tel Aviv)** - ~4,000 km ⭐ CLOSEST
2. **asia-south1 (Mumbai)** - ~4,200 km ⭐ VERY CLOSE
3. **europe-west1 (Belgium)** - ~6,500 km
4. **europe-west4 (Netherlands)** - ~6,700 km
5. **europe-west3 (Frankfurt)** - ~6,800 km
6. **us-east5 (Columbus)** - ~12,000 km (current)

## Testing Scripts

### 1. Test Africa-Closest Regions (RECOMMENDED)

This will test all regions close to Africa and find the best working configuration:

```bash
cd /Users/karthi/business/staff_education/teachers_training
python test_africa_regions.py
```

This script will:
- Test multiple regions starting with closest to Tanzania
- Try different Gemini models in each region
- Show you which combinations work
- Recommend the best configuration for your use case

### 2. Test Gemini in Current Region

If you want to keep using us-east5, test Gemini models there:

```bash
python test_gemini_server.py
```

## Steps to Update Your Configuration

### Step 1: Run the Africa Regions Test

```bash
cd /Users/karthi/business/staff_education/teachers_training
python test_africa_regions.py
```

### Step 2: Update .env Based on Results

The script will tell you the optimal configuration. For example, if Mumbai works:

```env
# Update these lines in .env:
ENDPOINT=asia-south1-aiplatform.googleapis.com
REGION=asia-south1
VERTEX_AI_REGION=asia-south1
VERTEX_AI_ENDPOINT=asia-south1-aiplatform.googleapis.com
VERTEX_AI_MODEL=gemini-2.0-flash-exp
```

### Step 3: Restart Docker

```bash
docker-compose restart app
```

### Step 4: Test the Application

```bash
# Check health
curl http://localhost:3000/health

# Test chat endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is teaching pedagogy?","module":"1"}'
```

## Current Configuration (Already Updated)

Your `.env` file has been updated to use:
- **Model**: `gemini-1.5-pro-002` (from Llama)
- **Region**: `us-east5` (no change yet)

To get better latency for Tanzania users, run `test_africa_regions.py` and switch to a closer region.

## Troubleshooting

### If Test Scripts Fail

1. **Check Authentication**:
   ```bash
   gcloud auth application-default login
   gcloud config set project lms-tanzania-consultant
   ```

2. **Enable Vertex AI API**:
   ```bash
   gcloud services enable aiplatform.googleapis.com
   ```

3. **Check Current Project**:
   ```bash
   gcloud config get-value project
   ```

### If All Regions Fail

You may need to:
1. Request quota increase in GCP Console
2. Enable billing on your project
3. Verify Vertex AI API is enabled
4. Check if your account has the necessary permissions

## Performance Comparison

| Model | Speed | Capability | Quota | Best For |
|-------|-------|------------|-------|----------|
| Gemini 2.0 Flash | ⚡⚡⚡ | ⭐⭐⭐ | ✅✅✅ | Production, High Volume |
| Gemini 1.5 Flash | ⚡⚡ | ⭐⭐⭐⭐ | ✅✅✅ | Balanced Use |
| Gemini 1.5 Pro | ⚡ | ⭐⭐⭐⭐⭐ | ✅✅ | Complex Reasoning |
| Llama 4 | ⚡⚡ | ⭐⭐⭐⭐ | ❌ | Limited Quota |

## API Format Differences

### Llama API (Old - Quota Issues)
```json
{
  "instances": [{"prompt": "question"}],
  "parameters": {"maxOutputTokens": 100}
}
```

### Gemini API (New - Works!)
```json
{
  "contents": [{
    "role": "user",
    "parts": [{"text": "question"}]
  }],
  "generationConfig": {
    "maxOutputTokens": 100,
    "temperature": 0.7
  }
}
```

## Next Steps

1. ✅ Run `python test_africa_regions.py` to find best region
2. ⬜ Update `.env` with recommended configuration
3. ⬜ Restart Docker: `docker-compose restart app`
4. ⬜ Test the application
5. ⬜ Monitor performance and adjust if needed

---

**Created**: 2025-10-10
**Purpose**: Switch from Llama to Gemini models for better quota and regional availability
**Status**: Ready to test - Run `python test_africa_regions.py`
