# Complete RAG Fix Guide - Step by Step

## 🎯 Goal
Get WhatsApp RAG chat working by fixing Vertex AI authentication and reprocessing content.

---

## ⚠️ Current Status

❌ **RAG is NOT working**
- 21 files uploaded but **0 chunks processed**
- Vertex AI authentication failing
- WhatsApp returns empty responses

---

## 🔧 Step-by-Step Fix (Follow Exactly)

### **Step 1: SSH into GCP Instance**

Open a terminal and run:

```bash
gcloud compute ssh teachers-training --zone us-east5-a
```

You should now be connected to your GCP instance.

---

### **Step 2: Configure gcloud with Your Account**

Run these commands on the GCP instance:

```bash
# Remove old config if it has permission issues
rm -rf ~/.config/gcloud 2>/dev/null

# Configure account
gcloud config set account karthi@kpitechllc.com
gcloud config set project lms-tanzania-consultant
```

Expected output:
```
Updated property [core/account].
Updated property [core/project].
```

---

### **Step 3: Setup Application Default Credentials**

⚠️ **IMPORTANT**: This will open a browser window for authentication

```bash
gcloud auth application-default login
```

**What will happen:**
1. A URL will appear in your terminal
2. Copy and paste the URL into your browser
3. Login with `karthi@kpitechllc.com`
4. Grant the requested permissions
5. You'll see "You are now authenticated"

**Troubleshooting:**
- If URL doesn't appear, try: `gcloud auth application-default login --no-browser`
- Then manually paste the URL in your browser

---

### **Step 4: Verify Authentication Works**

```bash
# Test if you can get an access token
gcloud auth application-default print-access-token
```

Expected output: A long token string (e.g., `ya29.c.c0ASRK0Ga...`)

If you see an error, authentication failed - go back to Step 3.

---

### **Step 5: Update Environment Variables**

```bash
cd ~/teachers_training

# Backup current .env
cp .env .env.backup

# Update GOOGLE_APPLICATION_CREDENTIALS path
# Point to the credentials we just created
cat >> .env << 'EOF'

# Vertex AI credentials (outside Docker)
GOOGLE_APPLICATION_CREDENTIALS=/home/karthi/.config/gcloud/application_default_credentials.json
EOF

# Verify it was added
tail -5 .env
```

---

### **Step 6: Restart Docker Containers**

```bash
cd ~/teachers_training

# Restart app to pick up new credentials
sudo docker-compose restart app

# Wait for startup
sleep 20

# Check if app is healthy
curl http://localhost:3000/health | python3 -m json.tool
```

Expected output:
```json
{
    "status": "healthy",
    "services": {
        "postgres": "healthy",
        "neo4j": "healthy",
        "chroma": "healthy"
    }
}
```

---

### **Step 7: Verify Vertex AI is Working**

```bash
# Check logs for Vertex AI errors
docker logs teachers_training_app_1 --tail 100 | grep -E '(vertex|embed|token|error)' | tail -20
```

**GOOD signs:**
- ✅ No "Unable to obtain access token" errors
- ✅ No "Vertex AI embedding failed" errors

**BAD signs:**
- ❌ "Failed to get access token"
- ❌ "Vertex AI embedding failed"

If you see BAD signs, authentication didn't work. Go back to Step 3.

---

### **Step 8: Test Content Processing**

Let's test if one file can be processed:

```bash
# Check current content status
docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training \
  -c "SELECT id, file_path, chunk_count, processing_status FROM module_content LIMIT 5"
```

You should see files with `chunk_count = 0` and `processing_status = 'processing'` or `'pending'`.

---

### **Step 9: Trigger Reprocessing**

**Option A: Via Admin Portal (Recommended)**

1. Open: http://34.162.136.203:3000/admin/lms-dashboard.html
2. Login with your admin credentials
3. Click on any course
4. Click on Module 1
5. **Delete** one file that shows "0 chunks"
6. **Re-upload** the same file
7. Wait 2-3 minutes
8. Refresh page - check if **chunks > 0**

If chunks > 0, Vertex AI is working! ✅

If chunks = 0, processing failed. Check logs:
```bash
docker logs teachers_training_app_1 --tail 50 | grep -E '(Processing|chunk|error)'
```

**Option B: Trigger via Script (if portal fails)**

```bash
cd ~/teachers_training

# Create reprocessing script
cat > reprocess-content.sh << 'SCRIPT'
#!/bin/bash
# Mark all content as pending for reprocessing
docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training << 'SQL'
UPDATE module_content
SET processing_status = 'pending',
    chunk_count = 0,
    updated_at = NOW()
WHERE processing_status != 'completed' OR chunk_count = 0;
SQL

# Restart app to trigger processing
docker-compose restart app
SCRIPT

chmod +x reprocess-content.sh
./reprocess-content.sh
```

---

### **Step 10: Monitor Processing**

Watch the logs to see processing happen:

```bash
# Follow logs in real-time
docker logs -f teachers_training_app_1 | grep -E '(Processing|chunk|embed)'
```

Press `Ctrl+C` to stop.

**What to look for:**
- ✅ "Processing file: BS F1 Textbook.pdf"
- ✅ "Generated X chunks"
- ✅ "Created X embeddings"
- ✅ "Stored in ChromaDB"

Processing each large PDF can take 2-10 minutes.

---

### **Step 11: Verify All Content Processed**

```bash
# Check how many files have chunks
docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training << 'SQL'
SELECT
  COUNT(*) as total_files,
  COUNT(*) FILTER (WHERE chunk_count > 0) as processed_files,
  SUM(chunk_count) as total_chunks
FROM module_content;
SQL
```

Expected output after successful processing:
```
 total_files | processed_files | total_chunks
-------------+-----------------+--------------
          21 |              21 |          500+
```

If `processed_files < total_files`, some files failed. Check which ones:

```bash
docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training << 'SQL'
SELECT file_path, chunk_count, processing_status
FROM module_content
WHERE chunk_count = 0
ORDER BY created_at DESC;
SQL
```

---

### **Step 12: Check ChromaDB Has Data**

```bash
# ChromaDB database should have grown significantly
du -sh /home/karthi/chromadb_data
```

**Before processing**: ~22MB
**After processing**: ~100-500MB (with 21 files)

If still 22MB, embeddings weren't stored.

---

### **Step 13: Test WhatsApp RAG**

Send a test message to your WhatsApp bot:

**Your WhatsApp number**: `whatsapp:+18065157636`

**Test message 1:**
```
What is production in business studies?
```

**Expected response**:
Detailed answer explaining factors of production (Land, Labour, Capital, Entrepreneur) based on the uploaded Business Studies textbook.

**Test message 2:**
```
Explain financing for small businesses
```

**Expected response**:
Information about sources of funds, microfinancing, cooperatives from Module 2 content.

**If you get empty or generic responses:**
- Processing didn't complete
- Go back and check logs in Step 11

---

## 🎯 Success Criteria

✅ All checks must pass:

1. **Vertex AI authentication**: No token errors in logs
2. **Content processed**: 21 files with chunks > 0
3. **ChromaDB data**: > 100MB
4. **WhatsApp test**: Detailed answers from uploaded content

---

## 🔥 Troubleshooting Common Issues

### Issue 1: "Unable to obtain access token"

**Solution**:
- Redo Step 3 (auth login)
- Make sure you login with `karthi@kpitechllc.com`
- Check credentials file exists:
  ```bash
  ls -lh ~/.config/gcloud/application_default_credentials.json
  ```

### Issue 2: Files stuck at "Processing" with 0 chunks

**Solution**:
- Check app logs for specific error:
  ```bash
  docker logs teachers_training_app_1 --tail 100 | grep -i error
  ```
- Most common: Vertex AI quota exceeded
- Solution: Wait 1 hour and retry

### Issue 3: ChromaDB not growing

**Solution**:
- Restart ChromaDB:
  ```bash
  pkill -f 'chroma run'
  nohup chroma run --host 0.0.0.0 --port 8000 --path /home/karthi/chromadb_data > chromadb.log 2>&1 &
  ```
- Restart app:
  ```bash
  cd ~/teachers_training && sudo docker-compose restart app
  ```

### Issue 4: WhatsApp returns "Sorry, I don't have information"

**Causes**:
1. Content not indexed (check Step 11)
2. Wrong module context (user needs to select module first)
3. Question doesn't match content

**Test with a very specific question**:
```
List the four factors of production
```

This should definitely be in the content.

---

## 📞 Quick Health Check Command

Run this anytime to check status:

```bash
cat > ~/check-rag-health.sh << 'SCRIPT'
#!/bin/bash
echo "=== RAG Health Check ==="
echo ""
echo "1. Service Health:"
curl -s http://localhost:3000/health | python3 -m json.tool
echo ""
echo "2. Content Status:"
docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c \
  "SELECT COUNT(*) as files, SUM(chunk_count) as chunks FROM module_content" 2>&1 | grep -A 2 files
echo ""
echo "3. ChromaDB Size:"
du -sh /home/karthi/chromadb_data
echo ""
echo "4. Recent Errors:"
docker logs teachers_training_app_1 --tail 50 2>&1 | grep -i error | tail -5
echo ""
SCRIPT

chmod +x ~/check-rag-health.sh
~/check-rag-health.sh
```

---

## ⏱️ Expected Timeline

- **Step 1-7** (Auth setup): ~5-10 minutes
- **Step 8-10** (Content reprocessing): ~15-30 minutes
- **Step 11-12** (Verification): ~5 minutes
- **Step 13** (WhatsApp test): ~2 minutes

**Total**: ~30-50 minutes

---

## 📋 Checklist

Before marking as complete, verify:

- [ ] Vertex AI auth working (no token errors)
- [ ] All 21 files have chunk_count > 0
- [ ] ChromaDB database > 100MB
- [ ] Neo4j has nodes (run: `MATCH (n) RETURN COUNT(n)`)
- [ ] WhatsApp returns detailed answers from content
- [ ] Can ask questions about different modules
- [ ] Quiz functionality works

---

## 🎉 After Everything Works

Your WhatsApp bot will be able to:

1. **Answer content questions**: Uses RAG to search uploaded PDFs
2. **Navigate modules**: Users can select Module 1-5
3. **Take quizzes**: 5 questions per module
4. **Track progress**: View completion status
5. **Get personalized responses**: Context-aware answers

**Test all modules**:
- Module 1: Production questions
- Module 2: Financing questions
- Module 3: Management questions
- Module 4: Warehousing questions
- Module 5: Opportunity identification questions

---

## 📝 Notes

- Credentials are stored at: `~/.config/gcloud/application_default_credentials.json`
- Docker mounts this from host (outside container)
- If you recreate the GCP instance, you'll need to redo authentication
- Processing happens in background - large files take longer
- Vertex AI has rate limits - if you hit them, wait 1 hour

---

**Created**: 2025-10-18
**Status**: Ready to execute
**Next**: Start with Step 1 and work through sequentially

🚀 **Let's get your RAG pipeline working!**
