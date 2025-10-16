# GCP Deployment with Cache Clearing - Complete Guide

**Date:** October 16, 2025
**Status:** ✅ **AUTOMATED DEPLOYMENT SCRIPT READY**

---

## Overview

This guide explains how to properly deploy code to GCP while ensuring Docker cache is cleared and browsers receive fresh files.

---

## Problem We're Solving

### Cache Issues
1. **Docker Cache:** Container serves cached files from volume mount
2. **Browser Cache:** Browsers cache JavaScript/HTML aggressively
3. **Result:** Users see old code even after deployment

### Solution
1. ✅ **HTTP Cache-Control Headers** - Tell browsers not to cache
2. ✅ **Docker Container Restart** - Force Docker to reload files
3. ✅ **Automated Deployment Script** - Do it all automatically
4. ✅ **Version Logging** - Know which build is running

---

## Quick Start

### Option 1: Automated Script (RECOMMENDED)

```bash
# 1. Make your code changes
vim public/admin/user-management.html

# 2. Commit changes
git add .
git commit -m "Your commit message"

# 3. Deploy with automatic cache clearing
./deploy-to-gcp-clean.sh
```

**What the script does:**
- ✅ Verifies all changes are committed
- ✅ Pushes to GitHub
- ✅ Pulls on GCP
- ✅ Touches HTML files (updates timestamps)
- ✅ **Restarts Docker container** (clears cache)
- ✅ Waits for container to be healthy
- ✅ Verifies deployment
- ✅ Shows browser cache clear instructions

### Option 2: Manual Deployment

```bash
# 1. Commit and push
git add .
git commit -m "Your changes"
git push origin master

# 2. Deploy to GCP with Docker restart
gcloud compute ssh teachers-training --zone=us-east5-a --command="
    cd ~/teachers_training &&
    git pull origin master &&
    docker restart teachers_training_app_1 &&
    sleep 5 &&
    docker ps --filter name=teachers_training_app_1
"

# 3. Wait for container to be healthy (shows 'healthy' in status)
# This takes ~30 seconds

# 4. Clear browser cache
# Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
```

---

## Cache-Busting Features Implemented

### 1. HTTP Cache-Control Headers

**File:** `public/admin/user-management.html`

```html
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>User Management - Teachers Training</title>
```

**What these do:**
- `Cache-Control: no-cache, no-store, must-revalidate` - Tells browser never to cache
- `Pragma: no-cache` - HTTP/1.0 backward compatibility
- `Expires: 0` - Forces immediate expiration

### 2. Version Build Tags

**File:** `public/admin/user-management.html` (Line 989)

```javascript
// Cache buster - Updated 2025-10-16 22:30 - PIN enrollment with no-cache headers
console.log('User Management v6 - PIN modal persistent + anti-cache headers - Build: 20251016-2230');
```

**How to check version:**
1. Open browser console (F12)
2. Look for console log message
3. Should show: `"Build: 20251016-2230"`

### 3. Docker Container Restart

**Why this is needed:**
- Docker volumes mount host files
- Container may cache file handles
- Restart forces fresh file load

**How it works:**
```bash
docker restart teachers_training_app_1
```

**Status check:**
```bash
docker ps --filter name=teachers_training_app_1
# Wait for status: "Up XX seconds (healthy)"
```

---

## Deployment Script Details

### Script: `deploy-to-gcp-clean.sh`

**Usage:**
```bash
chmod +x deploy-to-gcp-clean.sh
./deploy-to-gcp-clean.sh
```

**Output Example:**
```
==========================================
🚀 GCP Deployment with Cache Clear
==========================================

📋 Pre-deployment checklist:
✓ Instance: teachers-training
✓ Zone: us-east5-a
✓ Project: ~/teachers_training

Step 1: Checking local git status...
✓ Local changes committed

Step 2: Pushing to GitHub...
✓ Pushed to GitHub

Step 3: Pulling changes on GCP...
📥 Pulling latest code...
✓ Code pulled on GCP

Step 4: Clearing Docker cache for public directory...
🗑️  Clearing Docker cached files...
✓ Updated HTML file timestamps
✓ Docker container restarted
⏳ Waiting for container to be healthy...
Up 5 seconds (healthy)
✓ Docker cache cleared

Step 5: Verifying deployment...
🔍 Checking latest commit...
d929d7e feat: Add cache-busting headers and deployment script

🔍 Checking Docker container...
-rw-r--r-- 1 nodejs nogroup 36.7K Oct 16 22:30 /app/public/admin/user-management.html

🔍 Verifying file content...
1
✓ Deployment verified

==========================================
✅ DEPLOYMENT COMPLETE!
==========================================

📍 Access your application:
   http://34.162.136.203:3000/admin/user-management.html

⚠️  IMPORTANT: Clear browser cache before testing:
   Windows/Linux: Ctrl + Shift + R
   Mac: Cmd + Shift + R

🔍 Or use incognito/private window:
   Chrome: Ctrl + Shift + N / Cmd + Shift + N
   Firefox: Ctrl + Shift + P / Cmd + Shift + P
==========================================
```

### Script Features

1. **Pre-flight Checks:**
   - ✅ Verifies all changes are committed
   - ✅ Fails if uncommitted changes exist
   - ✅ Shows helpful git commands

2. **Deployment Steps:**
   - ✅ Pushes to GitHub (master branch)
   - ✅ SSH to GCP and pulls latest code
   - ✅ Updates file timestamps (touch command)
   - ✅ Restarts Docker container
   - ✅ Waits for container health check

3. **Verification:**
   - ✅ Shows latest commit hash
   - ✅ Shows file timestamps
   - ✅ Verifies file content
   - ✅ Checks container status

4. **User Instructions:**
   - ✅ Shows access URL
   - ✅ Reminds to clear browser cache
   - ✅ Suggests incognito mode
   - ✅ Provides log checking command

---

## Browser Cache Clearing

### Method 1: Hard Refresh (FASTEST)

**Windows/Linux:** `Ctrl + Shift + R`
**Mac:** `Cmd + Shift + R`

This forces browser to bypass cache and fetch fresh files.

### Method 2: DevTools Disable Cache

1. Open DevTools (F12)
2. Go to **Network** tab
3. Check **"Disable cache"** checkbox
4. Refresh page (F5)

### Method 3: Incognito/Private Window

**Chrome:** `Ctrl + Shift + N` / `Cmd + Shift + N`
**Firefox:** `Ctrl + Shift + P` / `Cmd + Shift + P`

Incognito mode starts with empty cache.

### Method 4: Clear All Cache

**Chrome:**
1. F12 → Right-click refresh button
2. Select **"Empty Cache and Hard Reload"**

**Firefox:**
1. `Ctrl + Shift + Delete`
2. Check "Cache"
3. Click "Clear Now"

---

## Verification Steps

### 1. Check Docker Container is Healthy

```bash
gcloud compute ssh teachers-training --zone=us-east5-a \
  --command="docker ps --filter name=teachers_training_app_1"
```

**Expected Output:**
```
NAMES                        STATUS
teachers_training_app_1      Up 30 seconds (healthy)
```

Wait until you see `(healthy)` status.

### 2. Check File is Updated

```bash
gcloud compute ssh teachers-training --zone=us-east5-a \
  --command="docker exec teachers_training_app_1 grep 'Build: 20251016' /app/public/admin/user-management.html"
```

**Expected Output:**
```javascript
console.log('User Management v6 - PIN modal persistent + anti-cache headers - Build: 20251016-2230');
```

### 3. Check Browser Console

1. Open `http://34.162.136.203:3000/admin/user-management.html`
2. Press F12 to open DevTools
3. Go to **Console** tab
4. Look for log message

**Expected:**
```
User Management v6 - PIN modal persistent + anti-cache headers - Build: 20251016-2230
```

### 4. Check Network Tab

1. Open DevTools (F12)
2. Go to **Network** tab
3. Refresh page (F5)
4. Click on `user-management.html` request
5. Check **Response Headers**

**Expected Headers:**
```
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
```

---

## Common Issues and Solutions

### Issue 1: Docker Container Not Healthy

**Symptoms:**
```bash
docker ps
# Shows: Up XX seconds (health: starting)
```

**Solution:**
Wait 30-60 seconds. The health check takes time.

**If still not healthy after 2 minutes:**
```bash
# Check logs
docker logs --tail 50 teachers_training_app_1

# Restart again
docker restart teachers_training_app_1
```

### Issue 2: Browser Still Shows Old Code

**Symptoms:**
- Console shows old version (v5 instead of v6)
- PIN modal auto-closes
- Old behavior persists

**Solution:**
1. **Hard refresh:** Ctrl+Shift+R / Cmd+Shift+R
2. **Use incognito window**
3. **Clear all browser data** (see Browser Cache Clearing section)
4. **Check Network tab:** Verify you're fetching from server, not cache

### Issue 3: Deployment Script Fails

**Symptoms:**
```
❌ ERROR: You have uncommitted changes!
```

**Solution:**
```bash
# Check what's uncommitted
git status

# Option 1: Commit changes
git add .
git commit -m "Your message"

# Option 2: Stash changes temporarily
git stash
./deploy-to-gcp-clean.sh
git stash pop
```

### Issue 4: File Not Updated on GCP

**Symptoms:**
- Docker shows old file
- Build tag is old
- Changes not visible

**Solution:**
```bash
# 1. Verify you pushed to GitHub
git log --oneline -1

# 2. Verify GCP pulled
gcloud compute ssh teachers-training --zone=us-east5-a \
  --command="cd ~/teachers_training && git log --oneline -1"

# 3. If different, pull again
gcloud compute ssh teachers-training --zone=us-east5-a \
  --command="cd ~/teachers_training && git pull origin master"

# 4. Restart Docker
gcloud compute ssh teachers-training --zone=us-east5-a \
  --command="docker restart teachers_training_app_1"
```

---

## Complete Deployment Checklist

### Before Deployment

- [ ] All code changes made
- [ ] Code tested locally
- [ ] All files saved
- [ ] Git changes committed
- [ ] Commit message is descriptive

### During Deployment

- [ ] Run `./deploy-to-gcp-clean.sh` OR manual steps
- [ ] Verify script shows ✓ for all steps
- [ ] Wait for Docker container to be healthy (30-60 seconds)
- [ ] Check deployment verification output

### After Deployment

- [ ] Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)
- [ ] Open admin page: http://34.162.136.203:3000/admin/user-management.html
- [ ] Check browser console for correct build version
- [ ] Test PIN enrollment flow
- [ ] Verify PIN modal stays open
- [ ] Confirm no old behavior

---

## Rollback Procedure

If deployment causes issues:

```bash
# 1. SSH to GCP
gcloud compute ssh teachers-training --zone=us-east5-a

# 2. Find previous commit
cd ~/teachers_training
git log --oneline -5

# 3. Revert to previous commit (replace COMMIT_HASH)
git reset --hard COMMIT_HASH

# 4. Restart Docker
docker restart teachers_training_app_1

# 5. Verify
docker logs --tail 50 teachers_training_app_1
```

---

## Summary

### What We Added

1. ✅ **HTTP Cache-Control Headers** (Lines 6-8)
   - Prevents browser caching
   - Forces fresh fetch

2. ✅ **Version Build Tags** (Line 989)
   - Console logging for verification
   - Timestamp: 20251016-2230

3. ✅ **Deployment Script** (`deploy-to-gcp-clean.sh`)
   - Automates entire deployment
   - Includes Docker restart
   - Verifies success

### How to Deploy (Simple)

```bash
# 1. Commit changes
git add .
git commit -m "Your changes"

# 2. Deploy
./deploy-to-gcp-clean.sh

# 3. Clear browser cache
# Ctrl+Shift+R / Cmd+Shift+R

# 4. Test
# Open: http://34.162.136.203:3000/admin/user-management.html
```

### Current Deployment

- ✅ Cache-busting headers deployed
- ✅ Docker container restarted
- ✅ Build version: 20251016-2230
- ✅ PIN modal persistence fix active
- ✅ No auto-close behavior

### Access

**URL:** http://34.162.136.203:3000/admin/user-management.html

**After opening:**
1. Clear cache: Ctrl+Shift+R / Cmd+Shift+R
2. Check console: Should show "Build: 20251016-2230"
3. Test enrollment: Modal should stay open

---

**Generated with Claude Code** 🤖
**Documentation Date:** October 16, 2025
**Current Build:** 20251016-2230
**Status:** ✅ Ready for Use
