# 1-Minute Nudge Test Guide

## ✅ Deployed Successfully!

Your system is now configured to send nudges after **1 minute of inactivity**.

## 🎯 IMPORTANT: Nudges DON'T Block Chat!

**Key Points:**
- ✓ Nudges are just **friendly reminder messages**
- ✓ Users can **chat anytime** - before, during, or after nudge
- ✓ Chat services are **always available**
- ✓ Nudge = automated message, NOT a blocker

---

## 🧪 Quick Test (Manual)

### Method 1: Via WhatsApp
1. Send message: "Hello" to your Twilio WhatsApp number
2. **Wait 60 seconds** (do nothing)
3. You should receive: "Hi again! 📚 Let's pick up where you left off. You're doing great!"
4. **Reply with any message** - chat still works perfectly!

### Method 2: Via curl
```bash
# Step 1: Send initial message
gcloud compute ssh teachers-training --zone "us-east5-a" \
  --project "lms-tanzania-consultant" --command "
curl -X POST 'http://localhost:3000/webhook/twilio' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'From=whatsapp:+255712345678' \
  -d 'To=whatsapp:+14155238886' \
  -d 'Body=Hello' \
  -d 'MessageSid=SM_TEST_001'
"

# Step 2: Wait 70 seconds
sleep 70

# Step 3: Check logs for nudge
gcloud compute ssh teachers-training --zone "us-east5-a" \
  --project "lms-tanzania-consultant" --command "
docker logs teachers_training_app_1 --tail 30 | grep -i 'nudge\|inactive'
"

# Step 4: Test chat still works
gcloud compute ssh teachers-training --zone "us-east5-a" \
  --project "lms-tanzania-consultant" --command "
curl -X POST 'http://localhost:3000/webhook/twilio' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'From=whatsapp:+255712345678' \
  -d 'To=whatsapp:+14155238886' \
  -d 'Body=Tell me about business' \
  -d 'MessageSid=SM_TEST_002'
"
```

### Method 3: Automated Test
```bash
./test-1min-nudge-live.sh
```
This script does everything automatically and shows results.

---

## 📋 What Happens

### Timeline:
```
00:00 - User sends message "Hello"
00:00 - User's last_active_at updated
00:59 - Nudge scheduler runs (every minute)
01:00 - System detects 1 min inactivity
01:00 - Nudge sent: "Hi again! 📚 Let's pick up..."
01:05 - User can still chat normally
```

### Chat Flow:
```
User: "Hello"
Bot: "Welcome! Choose your course..."
[User inactive for 60 seconds]
Bot: "Hi again! 📚 Let's pick up..." (nudge)
User: "Tell me about business"
Bot: [Normal response about business]
```

**Notice**: Chat never stops working! Nudge is just an extra message.

---

## 🔍 Check Nudge Scheduler Status

```bash
gcloud compute ssh teachers-training --zone "us-east5-a" \
  --project "lms-tanzania-consultant" --command "
docker logs teachers_training_app_1 | grep -i 'scheduler\|nudge.*started\|checking.*inactive'
"
```

Expected output:
- "Nudge scheduler started"
- "Checking for users inactive for..."
- "Sent X nudges"

---

## 🎛️ Nudge Configuration

**Current Setting:**
```
NUDGE_INACTIVITY_HOURS=0.0167 (1 minute)
```

**Location:**
- GCP: `/app/.env` in container `teachers_training_app_1`

**To Change Back to Production (48 hours):**
```bash
gcloud compute ssh teachers-training --zone "us-east5-a" \
  --project "lms-tanzania-consultant" --command "
docker exec teachers_training_app_1 sh -c 'sed -i \"s/NUDGE_INACTIVITY_HOURS=.*/NUDGE_INACTIVITY_HOURS=48/\" /app/.env'
docker restart teachers_training_app_1
"
```

---

## ✅ Verification Checklist

- [ ] Nudge sent after 1 minute
- [ ] Nudge message received on WhatsApp
- [ ] User can reply to nudge
- [ ] User can send new messages
- [ ] Chat services not blocked
- [ ] Normal conversation continues

---

## 🚨 Important Notes

1. **Testing Only**: 1-minute nudge is for testing. Use 48 hours in production.
2. **No Blocking**: Nudges NEVER block or prevent chat messages.
3. **Scheduler Runs**: Nudge check runs every minute (cron job).
4. **User Activity**: Any message updates `last_active_at`, resetting the timer.

---

## 📊 Expected Messages

### Nudge Templates (Random):
1. "Hi again! 📚 Let's pick up where you left off. You're doing great!"
2. "Welcome back! 🎓 Ready to continue your learning journey? Your progress has been saved."
3. "Good to see you back! 🌟 Your next lesson is waiting for you."

---

**Deployed**: $(date)
**System**: GCP Production (http://34.162.168.124:3000)
**Status**: ✅ Active (1-minute nudge for testing)
