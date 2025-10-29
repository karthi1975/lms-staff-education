# Live WhatsApp User Enrollment Checklist

## ✅ Pre-Flight Checklist

Before testing with a live user, verify these items:

### 1. Server Status ✅
```bash
curl http://34.162.136.203:3000/health
```
**Expected**: `{"status":"healthy","services":{"postgres":"healthy","neo4j":"healthy","chroma":"healthy"}}`

### 2. Docker Services Running
```bash
ssh karthi@34.162.136.203 "docker ps"
```
**Expected**: All 4 containers running (app, postgres, neo4j, chroma)

### 3. WhatsApp Webhook Active
- **Twilio Number**: +1 806 515 7636
- **Webhook URL**: http://34.162.136.203:3000/webhook/whatsapp
- **Webhook Method**: POST
- **Status**: Should be configured in Twilio console

### 4. Course Content Loaded
```bash
# Check if courses exist
curl -s http://34.162.136.203:3000/api/courses | head -20
```

---

## 📱 Enrollment Flow (Step-by-Step)

### STEP 1: Enroll User via Script

Run the enrollment script:
```bash
./test-whatsapp-enrollment-live.sh
```

**Prompts:**
1. Enter user's name (e.g., "John Teacher")
2. Enter WhatsApp number with country code (e.g., "+255712345678")

**Expected Output:**
```
✅ USER ENROLLED SUCCESSFULLY!

📋 Enrollment Details:
   Name: John Teacher
   Phone: +255712345678

🔑 PIN: 5355
   Expires: 2025-10-30T10:30:00.000Z
```

**Copy the PIN** - you'll need to share it with the user!

---

### STEP 2: User Messages WhatsApp Bot

User sends **first message** to bot at **+1 806 515 7636**

**User can send anything**, e.g.:
- "Hello"
- "Hi"
- "Start"

**Expected Bot Response:**
```
Welcome! 👋

Please verify your identity by sending your 4-digit PIN.

You should have received this PIN when you were enrolled in the training program.

If you haven't received a PIN or it has expired, please contact your administrator.
```

---

### STEP 3: User Sends PIN

User sends the **4-digit PIN** (e.g., `5355`)

**Expected Bot Response:**
```
✅ Verification successful! Welcome to the Teachers Training Program.

You now have access to the following courses:
• Business Studies: Entrepreneurship
• Business Studies: Production
• Business Studies: Marketing
• Business Studies: Financing

Type 'help' to see available commands or start asking questions about the course content!
```

---

### STEP 4: User Starts Learning

User can now:

1. **Ask questions**:
   ```
   What is entrepreneurship?
   ```

   **Expected**: RAG-powered response with sources

2. **View help**:
   ```
   help
   ```

   **Expected**: List of commands

3. **View courses**:
   ```
   courses
   ```

   **Expected**: List of available courses

---

## 🔍 Verification Steps

### A. Check User in Admin Portal

1. Open: http://34.162.136.203:3000/admin/users.html
2. Login with: admin@school.edu / Admin123!
3. Find the user in the list
4. **Before PIN verification**: Status = "pending"
5. **After PIN verification**: Status = "active"

### B. Monitor Server Logs

```bash
ssh karthi@34.162.136.203 "docker logs -f teachers_training-app-1 --tail 100"
```

**Watch for:**
- `[WhatsApp] Message received from +255712345678`
- `[Enrollment] PIN verification successful`
- `[Enrollment] User activated`
- `[RAG] Processing question`

### C. Check Database

```bash
ssh karthi@34.162.136.203 "docker exec -it teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c \"SELECT whatsapp_id, name, enrollment_status, is_verified FROM users ORDER BY enrolled_at DESC LIMIT 5;\""
```

**Expected After PIN Verification:**
```
 whatsapp_id    |     name      | enrollment_status | is_verified
----------------+---------------+-------------------+-------------
 +255712345678  | John Teacher  | active            | t
```

---

## 🚨 Troubleshooting

### Issue: User doesn't receive PIN prompt

**Possible Causes:**
1. User not enrolled in database
2. Webhook not configured correctly
3. Twilio number issue

**Solution:**
```bash
# Check if user exists
ssh karthi@34.162.136.203 "docker exec -it teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c \"SELECT * FROM users WHERE whatsapp_id = '+255712345678';\""

# Check webhook logs
ssh karthi@34.162.136.203 "docker logs teachers_training-app-1 | grep -i webhook"
```

---

### Issue: PIN verification fails

**Possible Causes:**
1. Wrong PIN entered
2. PIN expired (7 days)
3. Too many attempts (3 max)
4. Case sensitivity issue

**Solution:**
```bash
# Reset PIN via API
curl -X POST http://34.162.136.203:3000/api/admin/users/%2B255712345678/reset-pin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"customPin":"1234"}'
```

---

### Issue: User verified but can't chat

**Possible Causes:**
1. Course orchestrator not initialized
2. No courses loaded
3. ChromaDB issue

**Solution:**
```bash
# Restart services
ssh karthi@34.162.136.203 "cd /home/karthi/teachers_training && docker-compose restart app"

# Check courses exist
curl http://34.162.136.203:3000/api/courses
```

---

## 📊 Success Indicators

✅ **All systems working if:**

1. User receives PIN prompt immediately after first message
2. PIN verification succeeds on first try
3. Welcome message shows list of courses
4. User can ask questions and get RAG responses with sources
5. Admin portal shows user status as "active"
6. Database shows `is_verified = true`

---

## 🎯 Quick Test Commands

### Fast Server Health Check
```bash
curl -s http://34.162.136.203:3000/health && echo "" && echo "✅ Server healthy"
```

### Check Docker Status on GCP
```bash
ssh karthi@34.162.136.203 "docker ps --format 'table {{.Names}}\t{{.Status}}'"
```

### View Recent WhatsApp Messages
```bash
ssh karthi@34.162.136.203 "docker logs teachers_training-app-1 --tail 50 | grep -i whatsapp"
```

### Monitor Live Enrollment
```bash
ssh karthi@34.162.136.203 "docker logs -f teachers_training-app-1 | grep -i 'enrollment\|whatsapp\|pin'"
```

---

## 📝 Test User Template

Use this for consistent testing:

**Name**: Test Teacher 001
**Phone**: +1234567890 (use your real number)
**Expected PIN**: Will be generated (4 digits)
**Status Timeline**:
- T+0s: Enrolled (pending)
- T+5s: First WhatsApp message sent
- T+10s: PIN prompt received
- T+15s: PIN sent by user
- T+20s: Welcome message received (active)
- T+30s: First question asked
- T+40s: RAG response with sources received

---

## 🔐 Security Notes

1. **Never share PINs publicly** - only via secure channels
2. **PINs expire in 7 days** - remind users to verify quickly
3. **3 attempts maximum** - users get blocked after failed attempts
4. **Admin can reset PINs** - via admin portal or API
5. **All PINs are hashed** - never stored in plain text

---

## 📞 Support Information

**WhatsApp Bot Number**: +1 806 515 7636
**Admin Portal**: http://34.162.136.203:3000/admin/
**Admin Email**: admin@school.edu
**Admin Password**: Admin123!

**Server**: GCP - us-east5-a
**Instance**: teachers-training
**Project**: lms-tanzania-consultant

---

## ✅ Final Checklist Before Live Test

- [ ] Server health check passes
- [ ] All Docker containers running
- [ ] Admin portal accessible
- [ ] Courses loaded (at least 1)
- [ ] Enrollment script tested
- [ ] User's phone number ready (with country code)
- [ ] User knows bot number (+1 806 515 7636)
- [ ] You're ready to share PIN immediately
- [ ] Monitoring tools ready (logs, admin portal)

---

**Ready to test? Run:**
```bash
./test-whatsapp-enrollment-live.sh
```

**Good luck!** 🚀

---

*Last Updated: 2025-10-23*
*System Status: Production Ready*
