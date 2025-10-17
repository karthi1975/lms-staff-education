# Fix GCP Merge Conflict - Step by Step

## Problem
```
error: Your local changes to the following files would be overwritten by merge:
        docker-compose.yml
        server.js
        services/neo4j.service.js
        services/whatsapp-adapter.service.js
        services/whatsapp-handler.service.js
```

## Solution: Run These Commands on GCP Instance

### Option 1: Automated Script (Recommended)

```bash
# Pull the resolution script
git fetch origin

# Copy the script from the fetched content
git show origin/master:RESOLVE_GCP_MERGE_CONFLICT.sh > /tmp/resolve.sh

# Make it executable and run
chmod +x /tmp/resolve.sh
/tmp/resolve.sh
```

### Option 2: Manual Steps (If script fails)

```bash
cd ~/teachers_training

# Step 1: Backup local changes
mkdir -p ~/backup_$(date +%Y%m%d_%H%M%S)
cp docker-compose.yml ~/backup_$(date +%Y%m%d_%H%M%S)/ 2>/dev/null || true
cp server.js ~/backup_$(date +%Y%m%d_%H%M%S)/ 2>/dev/null || true
cp services/*.js ~/backup_$(date +%Y%m%d_%H%M%S)/ 2>/dev/null || true

# Step 2: Stash local changes
git stash push -u -m "GCP local changes $(date)"

# Step 3: Pull from GitHub
git pull origin master

# Step 4: Restart Docker
sudo docker-compose restart app
sleep 15

# Step 5: Verify
curl http://localhost:3000/health
```

### Option 3: Force Update (If you don't need local changes)

**⚠️ WARNING: This will DISCARD all local changes!**

```bash
cd ~/teachers_training

# Backup first (just in case)
cp -r ~/teachers_training ~/teachers_training_backup_$(date +%Y%m%d_%H%M%S)

# Discard local changes and pull
git reset --hard origin/master
git pull origin master

# Restart
sudo docker-compose restart app
sleep 15
curl http://localhost:3000/health
```

---

## What This Does

1. **Backs up** your local GCP changes
2. **Stashes** git changes (saves them safely)
3. **Pulls** latest code from GitHub with:
   - ✅ Complete PIN enrollment system
   - ✅ Clean database setup
   - ✅ All documentation
   - ✅ Test scripts
4. **Restarts** Docker to apply changes
5. **Verifies** system health

---

## After Update

Your GCP instance will have:
- ✅ PIN enrollment system (tested and working)
- ✅ Clean database (0 courses, ready for creation)
- ✅ Complete documentation in:
  - `ENROLLMENT_VALIDATION_REPORT.md`
  - `QUICK_START_ENROLLMENT.md`
- ✅ Test script: `test-enrollment-flow.sh`

---

## If You Need Local Changes Back

```bash
# See what was stashed
git stash list

# See what's in the stash
git stash show -p

# Restore the stashed changes
git stash pop

# Or access the backup
ls -la ~/backup_*/
```

---

## Quick Verification After Update

```bash
# Check system health
curl http://localhost:3000/health

# Check enrollment service exists
grep -n "enrollUser" routes/admin.routes.js

# Verify database is clean
sudo docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "SELECT COUNT(*) FROM courses"

# Should show: 0 courses (clean)
```

---

## Summary

**Choose Option 1** (automated script) - safest and easiest

**Choose Option 2** (manual) - if you want to see each step

**Choose Option 3** (force update) - if you don't care about GCP local changes

All options will get your GCP instance updated with the latest enrollment system! ✅
