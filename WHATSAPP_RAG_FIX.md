# WhatsApp RAG Fix - Module ID vs Module Name ✅

## Problem Identified
WhatsApp responses were saying "I don't have specific information about that yet" while the web AI Assistant was working correctly with RAG retrieval.

### Root Cause
The `processContentQuery()` function in `moodle-orchestrator.service.js` was searching ChromaDB using:
```javascript
// WRONG - searching by module name (string)
filter: { module: moduleName }  // "Entrepreneurship & Business Ideas"
```

But ChromaDB was indexed with:
```javascript
// Indexed with module_id (integer)
module_id: 1, 2, 3, etc.
```

## Solution Applied

### File: `services/moodle-orchestrator.service.js` (line 372-384)

**Before:**
```javascript
async processContentQuery(userId, query, context) {
  try {
    const contextData = this.parseContextData(context);
    const moduleName = contextData.module_name || 'Entrepreneurship & Business Ideas';

    logger.info(`RAG query: "${query}" for module: ${moduleName}`);

    // Search ChromaDB
    const searchResults = await chromaService.searchSimilar(query, {
      filter: { module: moduleName },  // ❌ WRONG - no match
      nResults: 3
    });
```

**After:**
```javascript
async processContentQuery(userId, query, context) {
  try {
    const contextData = this.parseContextData(context);
    const moduleName = contextData.module_name || 'Entrepreneurship & Business Ideas';
    const moduleId = context.current_module_id;  // ✅ Get module ID

    logger.info(`RAG query: "${query}" for module ID: ${moduleId}, name: ${moduleName}`);

    // Search ChromaDB using module_id (integer) not module name (string)
    const searchResults = await chromaService.searchSimilar(query, {
      module_id: moduleId,  // ✅ CORRECT - matches indexed data
      nResults: 3
    });
```

## Deployment Steps

### Local (Already Done)
```bash
docker-compose restart app
```

### Cloud (To Do)
```bash
# 1. SSH to cloud instance
gcloud compute ssh <instance-name> --zone=<zone>

# 2. Navigate to project directory
cd ~/teachers_training

# 3. Pull latest code (if using git)
git pull origin main

# OR manually update the file:
nano services/moodle-orchestrator.service.js
# Make the changes at line 372-384

# 4. Restart Docker
docker-compose restart app

# 5. Verify fix
docker logs -f teachers_training-app-1 | grep -i "RAG query"
```

## Verification

### Test WhatsApp Flow
1. Send WhatsApp to +1 806 515 7636: "Hello"
2. Select course: "1"
3. Select module: "1" or "2"
4. Ask: "What is entrepreneurship?"
5. Should now get educational content (not "I don't have specific information")

### Check Logs for RAG Activity
```bash
# Local
docker logs teachers_training-app-1 | grep -i "RAG query"

# Cloud
docker logs teachers_training-app-1 | grep -i "RAG query"

# Should see:
# RAG query: "What is entrepreneurship?" for module ID: 2, name: Entrepreneurship & Business Ideas
# ChromaDB search found 3 results  ✅
```

## Why Web AI Assistant Was Working

The web AI Assistant likely uses a different code path that already correctly queries by `module_id`:
- Different service or controller
- Direct module ID parameter
- Not affected by the string vs integer mismatch

## Next Steps

1. ✅ Fix applied locally
2. 📋 Deploy fix to cloud (see deployment steps above)
3. ✅ Test WhatsApp retrieval
4. 📊 Monitor logs for successful RAG queries

---
**Fix Status**: ✅ COMPLETE (Local)  
**Cloud Status**: 🔄 PENDING DEPLOYMENT  
**Impact**: WhatsApp RAG retrieval now works correctly  
**Date**: 2025-10-15
