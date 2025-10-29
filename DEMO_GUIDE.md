# Nudge System Demo Guide
**Quick Reference for Demo Preparation**

---

## 🎯 Before Demo: Enable Testing Mode

Run this command to activate 1-minute nudge system:

```bash
./enable-testing-mode.sh
```

**What it does**:
- ✅ Sets inactivity threshold to **1 minute**
- ✅ Sets scheduler to check every **60 seconds**
- ✅ Sets cooldown period to **3 minutes**
- ✅ Restarts application automatically
- ✅ Verifies testing mode is active

**Expected output**:
```
✅ TESTING MODE ENABLED SUCCESSFULLY!

📊 Configuration Active:
   ✓ Inactivity threshold: 1 minute
   ✓ Scheduler checks: Every 60 seconds
   ✓ Cooldown period: 3 minutes
```

---

## 🎬 During Demo: How to Show Nudges

### Step 1: Reset User Activity
Send a WhatsApp message to the bot:
```
"Tell me about entrepreneurship"
```

### Step 2: Explain While Waiting
Tell your audience:
- "The user just became active by sending a message"
- "Now we wait 1 minute for the user to become inactive"
- "The scheduler checks every 60 seconds"
- "Within 1-2 minutes, the user will receive a nudge"

### Step 3: Wait and Show
- Wait 1-2 minutes (stay silent, don't send more messages)
- Show your WhatsApp screen
- The nudge will arrive:
  ```
  Hi [Name]! Welcome back! 🎓
  Ready to continue your learning journey?

  Reply 'CONTINUE' to resume your learning journey!
  ```

### Step 4: Explain Cooldown
- "The system won't spam the user"
- "There's a 3-minute cooldown period"
- "After 3 minutes + 1 minute inactive, another nudge can be sent"

---

## 🎭 Demo Talking Points

### 1. Problem Statement (30 seconds)
> "Teacher training programs face a challenge: learners start with enthusiasm but drop off over time. Without reminders, they forget to continue their learning journey."

### 2. Solution Overview (30 seconds)
> "Our WhatsApp-based system includes intelligent nudging. The system automatically detects when a learner has been inactive and sends friendly reminders via WhatsApp."

### 3. Technical Features (1 minute)
> "The nudge system has three key features:
> 1. **Smart Detection**: Automatically tracks user activity
> 2. **Timely Reminders**: Sends nudges after configured inactivity period
> 3. **Spam Prevention**: Cooldown periods prevent overwhelming users"

### 4. Live Demo (2 minutes)
> "Let me show you how it works in real-time..."
>
> [Follow steps above]

### 5. Flexibility (30 seconds)
> "For testing and demos, we use a 1-minute threshold. In production, we configure it to 48 hours - sending nudges after 2 days of inactivity. The system automatically adapts."

---

## ⚙️ Current Testing Mode Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| Inactivity threshold | 1 minute | User marked inactive after this time |
| Scheduler interval | 60 seconds | How often system checks for inactive users |
| Cooldown period | 3 minutes | Minimum time between nudges |
| Auto-detection | Enabled | System automatically detects mode |

---

## 🔄 After Demo: Rollback to Production

**IMPORTANT**: After your demo, restore production settings:

```bash
./rollback-nudge.sh
```

**What it does**:
- ✅ Sets inactivity threshold to **48 hours** (2 days)
- ✅ Sets scheduler to check every **6 hours**
- ✅ Sets cooldown period to **72 hours** (3 days)
- ✅ Restarts application automatically
- ✅ Verifies production mode is active

**Expected output**:
```
✅ PRODUCTION MODE ENABLED SUCCESSFULLY!

📊 Configuration Active:
   ✓ Inactivity threshold: 48 hours (2 days)
   ✓ Scheduler checks: Every 6 hours
   ✓ Cooldown period: 72 hours (3 days)
```

---

## 🧪 Quick Testing (Before Demo)

Test the system 10 minutes before your demo:

```bash
# 1. Enable testing mode
./enable-testing-mode.sh

# 2. Send a test message (via your phone or curl)
# WhatsApp: Send "Hello" to the bot

# 3. Wait 1-2 minutes
# Watch for nudge on your phone

# 4. Verify it worked
# You should receive the nudge
```

---

## 📱 Demo Checklist

**Before Demo** (15 minutes prior):
- [ ] Run `./enable-testing-mode.sh`
- [ ] Wait for "TESTING MODE ENABLED" confirmation
- [ ] Send a test message to verify system is working
- [ ] Wait 1-2 minutes to receive test nudge
- [ ] Confirm nudge received
- [ ] Clear WhatsApp chat or prepare clean view

**During Demo**:
- [ ] Explain the problem (teacher dropout)
- [ ] Introduce the nudge solution
- [ ] Send a message (demonstrate activity)
- [ ] Talk about the system while waiting (1 min)
- [ ] Show the nudge when it arrives
- [ ] Explain cooldown and spam prevention

**After Demo** (immediately):
- [ ] Run `./rollback-nudge.sh`
- [ ] Wait for "PRODUCTION MODE ENABLED" confirmation
- [ ] Verify production settings are active

---

## 🚨 Troubleshooting

### Nudge Not Received During Demo?

**Quick Checks**:
1. **Check if testing mode is active**:
   ```bash
   gcloud compute ssh teachers-training --zone "us-east5-a" \
     --project "lms-tanzania-consultant" --command "
   docker logs teachers_training_app_1 | grep 'TESTING MODE'
   "
   ```
   Should show: `Nudge checks scheduled every 60 seconds (TESTING MODE)`

2. **Check recent nudge activity**:
   ```bash
   gcloud compute ssh teachers-training --zone "us-east5-a" \
     --project "lms-tanzania-consultant" --command "
   docker logs teachers_training_app_1 | tail -30 | grep 'Sent.*nudges'
   "
   ```

3. **Cooldown blocking?**
   If you received a nudge in the last 3 minutes, wait longer.

4. **Re-enable testing mode**:
   ```bash
   ./enable-testing-mode.sh
   ```

---

## 💡 Demo Tips

1. **Practice First**: Run through the demo at least once before presenting

2. **Timing**: Start the 1-minute wait while explaining the system architecture

3. **Backup Plan**: Have screenshots of successful nudges ready, just in case

4. **Explain Auto-Detection**: Emphasize that the system automatically switches modes - no code changes needed

5. **Show Flexibility**: Mention that the threshold can be configured to any value (1 min, 1 hour, 48 hours, etc.)

6. **Highlight Impact**: "This keeps learners engaged and increases course completion rates"

---

## 📊 System Verification Commands

### Check Current Mode
```bash
gcloud compute ssh teachers-training --zone "us-east5-a" \
  --project "lms-tanzania-consultant" --command "
docker exec teachers_training_app_1 printenv NUDGE_INACTIVITY_HOURS
"
```
- `0.0167` = Testing mode (1 minute)
- `48` = Production mode (48 hours)

### Check Scheduler Status
```bash
gcloud compute ssh teachers-training --zone "us-east5-a" \
  --project "lms-tanzania-consultant" --command "
docker logs teachers_training_app_1 | grep 'Nudge checks scheduled' | tail -1
"
```

### Check Recent Nudges Sent
```bash
gcloud compute ssh teachers-training --zone "us-east5-a" \
  --project "lms-tanzania-consultant" --command "
docker logs teachers_training_app_1 | grep 'Sent.*inactivity nudges' | tail -5
"
```

---

## 🎯 Key Messages for Demo

1. **Automated Engagement**: "The system works 24/7, automatically re-engaging learners"

2. **WhatsApp Native**: "Uses WhatsApp - no app installation required"

3. **Smart & Respectful**: "Intelligent cooldowns prevent spam"

4. **Configurable**: "Easily adjusted for different use cases"

5. **Bilingual**: "Supports both English and Swahili"

6. **Production Ready**: "Already deployed and working with real users"

---

## 📝 Quick Reference

| Command | Purpose |
|---------|---------|
| `./enable-testing-mode.sh` | Activate demo mode (1-min nudge) |
| `./rollback-nudge.sh` | Restore production (48-hour nudge) |
| `./test-nudge-now.sh` | Automated test with 2-minute wait |
| `./monitor-system.sh` | Live monitor of nudge activity |

---

**Last Updated**: 2025-10-29
**System Status**: ✅ Fully Operational
**Ready for Demo**: YES

---

*This guide assumes testing mode is already deployed. If starting fresh, run `./enable-testing-mode.sh` first.*
