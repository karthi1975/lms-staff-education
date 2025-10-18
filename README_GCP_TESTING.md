# GCP Testing Guide - Quick Start

## 🚀 Everything is Ready on GitHub!

**Latest commit**: `6acf46d`
**Branch**: `master`
**Status**: Ready to pull and test on GCP

---

## 📦 What's Been Committed

### **New Diagnostic & Fix Tools** ✅

1. **`COMPLETE_RAG_FIX_GUIDE.md`** ⭐ **START HERE**
   - Complete step-by-step guide (13 steps)
   - Fixes Vertex AI authentication
   - Re-processes content
   - Tests WhatsApp RAG
   - **Time**: ~30-50 minutes

2. **`FIX_VERTEX_AI_AND_RAG.md`**
   - Technical reference
   - Multiple fix options
   - Troubleshooting guide

3. **`test-whatsapp-rag-wiring.sh`**
   - Quick health check
   - Run anytime to check status
   - Shows all system diagnostics

4. **`setup-vertex-auth-gcp.sh`**
   - Automated auth setup
   - Configures `karthi@kpitechllc.com`
   - Sets up Application Default Credentials

5. **`gcp-pull-and-test.sh`** 🆕
   - Pull latest code
   - Run wiring test
   - Show next steps

### **Existing Tools** ✅

- `CURRENT_STATE.md` - Project status
- `GCP_DATABASE_CLEANUP_REPORT.md` - Database cleanup report
- Quiz upload fix (working)
- PIN enrollment system (working)

---

## 🎯 Quick Start (2 Options)

### **Option 1: Automated Pull & Test** (Recommended)

From your local machine:

```bash
cd /Users/karthi/business/staff_education/teachers_training
./gcp-pull-and-test.sh
```

This will:
- ✅ SSH into GCP
- ✅ Pull latest code
- ✅ Run wiring test
- ✅ Show next steps

### **Option 2: Manual SSH & Pull**

```bash
# SSH into GCP
gcloud compute ssh teachers-training --zone us-east5-a

# Pull latest code
cd ~/teachers_training
git stash
git pull origin master

# Run wiring test
chmod +x test-whatsapp-rag-wiring.sh
./test-whatsapp-rag-wiring.sh

# Read the complete fix guide
cat COMPLETE_RAG_FIX_GUIDE.md
```

---

## 📋 Current Issues (Need to Fix)

From wiring test results:

| Issue | Status | Impact |
|-------|--------|--------|
| **Vertex AI Auth** | ❌ BROKEN | Critical - blocks all processing |
| **Content Processing** | ❌ FAILED | 21 files, 0 chunks |
| **ChromaDB Empty** | ❌ NO DATA | RAG returns nothing |
| **WhatsApp RAG** | ❌ EMPTY RESPONSES | Cannot answer questions |

**Root Cause**: Vertex AI authentication failing → Cannot generate embeddings → RAG pipeline broken

---

## 🔧 Fix Process (Follow Guide)

After pulling code on GCP:

### **Step 1: Read the Guide**

```bash
cat COMPLETE_RAG_FIX_GUIDE.md | less
# Press 'q' to exit
```

### **Step 2: Run Through 13 Steps**

The guide covers:
1. SSH into GCP ✅ (you're already here)
2. Configure gcloud account
3. **Setup Application Default Credentials** (needs browser)
4. Verify authentication works
5. Update environment variables
6. Restart Docker
7. Verify Vertex AI working
8. Test content processing
9. **Trigger reprocessing** (re-upload files)
10. Monitor processing
11. Verify chunks > 0
12. Check ChromaDB has data
13. **Test WhatsApp chat**

### **Step 3: Verify Everything Works**

```bash
# Run health check
./test-whatsapp-rag-wiring.sh

# Expected after fix:
# ✅ 21 files with chunks > 0
# ✅ ChromaDB > 100MB
# ✅ No Vertex AI errors
# ✅ WhatsApp returns detailed answers
```

---

## 📱 WhatsApp Testing

**Bot number**: `whatsapp:+18065157636`

### **Test Messages** (after fix):

1. **Content question**:
   ```
   What are the four factors of production?
   ```
   **Expected**: Detailed answer about Land, Labour, Capital, Entrepreneur

2. **Module selection**:
   ```
   module 1
   ```
   **Expected**: Module 1 introduction

3. **Quiz**:
   ```
   quiz
   ```
   **Expected**: Quiz questions (already uploaded)

4. **Progress**:
   ```
   progress
   ```
   **Expected**: Module completion status

---

## ✅ Success Criteria

All must be ✅ after fix:

- [ ] Vertex AI authentication working (no token errors)
- [ ] All 21 content files processed (chunks > 0)
- [ ] ChromaDB database > 100MB
- [ ] Neo4j has knowledge graph nodes
- [ ] WhatsApp test returns detailed answers
- [ ] Quiz upload working (already ✅)
- [ ] PIN enrollment working (already ✅)

---

## 🛠️ Available Commands on GCP

After pulling latest code:

```bash
# Quick health check (run anytime)
./test-whatsapp-rag-wiring.sh

# Read complete fix guide
cat COMPLETE_RAG_FIX_GUIDE.md

# Read technical reference
cat FIX_VERTEX_AI_AND_RAG.md

# Check current project status
cat CURRENT_STATE.md

# Setup Vertex AI auth (interactive)
./setup-vertex-auth-gcp.sh

# View recent commits
git log --oneline -5

# Check what changed
git diff HEAD~5 --stat
```

---

## ⏱️ Expected Timeline

| Phase | Time |
|-------|------|
| **Pull code** | 1 min |
| **Read guide** | 5 min |
| **Fix Vertex AI** | 10 min |
| **Re-upload content** | 20-30 min |
| **Verify & test** | 10 min |
| **Total** | **45-55 min** |

---

## 🆘 If Something Goes Wrong

### **Problem 1**: Git pull fails with merge conflict

```bash
cd ~/teachers_training
git stash
git pull origin master
```

### **Problem 2**: Authentication fails

- Make sure you use `karthi@kpitechllc.com`
- Check you have permissions for `lms-tanzania-consultant` project
- See troubleshooting in COMPLETE_RAG_FIX_GUIDE.md

### **Problem 3**: Processing still failing after auth fix

- Check Vertex AI quota (may be exceeded)
- Wait 1 hour and retry
- Check logs: `docker logs teachers_training_app_1 --tail 100 | grep error`

### **Problem 4**: WhatsApp still returns empty

- Verify chunks > 0: See Step 11 in guide
- Check ChromaDB size: `du -sh /home/karthi/chromadb_data`
- Make sure user has selected a module first

---

## 📊 File Structure on GCP

After pulling, you'll have:

```
~/teachers_training/
├── COMPLETE_RAG_FIX_GUIDE.md        ⭐ Main guide
├── FIX_VERTEX_AI_AND_RAG.md         📖 Reference
├── test-whatsapp-rag-wiring.sh      🔍 Health check
├── setup-vertex-auth-gcp.sh         🔑 Auth setup
├── CURRENT_STATE.md                 📊 Project status
├── GCP_DATABASE_CLEANUP_REPORT.md   🗄️ DB cleanup
├── routes/                          📁 Code
├── services/                        📁 Code
├── public/                          📁 Admin UI
└── ...
```

---

## 🎉 What Works Already

✅ **Infrastructure**:
- PostgreSQL, Neo4j, ChromaDB running
- Docker containers healthy
- Admin portal accessible

✅ **Features**:
- Course/module management
- Content upload (UI works, processing broken)
- Quiz upload (FIXED, working)
- PIN enrollment system (working)
- WhatsApp webhook (configured)

❌ **Not Working**:
- Vertex AI authentication
- Content processing (0 chunks)
- RAG pipeline
- WhatsApp content Q&A

---

## 🚀 Let's Get Started!

### **Run this now**:

```bash
# From your local machine
cd /Users/karthi/business/staff_education/teachers_training
./gcp-pull-and-test.sh
```

Then follow the guide that appears!

---

**All code is on GitHub and ready to test!** 🎯

**Latest commit**: `6acf46d`
**Ready to pull**: `git pull origin master`
**Start here**: `COMPLETE_RAG_FIX_GUIDE.md`

---

*Good luck with testing! Follow the 13 steps and your RAG pipeline will be working in ~45 minutes.* 🚀
