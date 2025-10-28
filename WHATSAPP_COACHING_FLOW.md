# WhatsApp Coaching, Nudging & Reflection Flow

## 📱 How It Works for Real Users

This document explains how coaching, nudging, and reflection features work in **actual WhatsApp conversations** with users.

---

## 🔄 The User Experience Flow

### Scenario 1: Automatic Coaching After Every Message

**Every time a user sends a message via WhatsApp, the system:**

1. **User sends message:** "What is classroom management?"
2. **System processes message** and sends educational response
3. **Background coaching check** (non-blocking):
   - Tracks user activity in Neo4j
   - Updates engagement metrics
   - Checks if user needs encouragement
   - Logs learning behavior

**Location in code:** `services/course-orchestrator.service.js:189-233`

```javascript
// After sending response, check coaching opportunities
setImmediate(async () => {
  await this.checkCoachingOpportunities(userId, context, message);
});
```

---

### Scenario 2: Inactive User Nudge (Automated)

**When a user hasn't messaged in 48 hours:**

#### What the User Sees:
```
📚 Hi Sarah! We noticed you haven't checked in for a while.

We're here to help you continue your learning journey!
Your progress is important to us.

Reply with "continue" to pick up where you left off,
or "help" if you need assistance.

Keep learning! 💪
```

#### How It's Triggered:
- **Automated scheduler** runs every 6 hours
- Checks `user_progress` table for inactive users
- Sends personalized nudge via WhatsApp

**Location in code:** `services/coaching/nudging.service.js:89-145`

```javascript
// Check for inactive users (48 hours no activity)
async nudgeInactiveUsers() {
  const inactiveUsers = await UserService.getUsersForNudging(
    this.config.inactivityThreshold
  );

  for (const user of inactiveUsers) {
    await this.sendNudge(user, 'welcome_back');
  }
}
```

---

### Scenario 3: Quiz Reminder Nudge

**When a user is in a module but hasn't taken the quiz:**

#### What the User Sees:
```
📝 Hi John! Quick reminder:

You're doing great in Module 2: Classroom Management!

Ready to test your knowledge? Complete the quiz to
move forward and earn your certificate.

Reply "quiz" to start, or "help" if you need review materials.

You've got this! 🎯
```

#### How It's Triggered:
- Scheduled check every 6 hours
- Looks for users in `learning` state with pending quizzes
- Sends reminder if 24+ hours since last quiz attempt

**Location in code:** `services/coaching/nudging.service.js:147-177`

---

### Scenario 4: Quiz Failed - Retry Encouragement

**When a user fails a quiz (< 70%):**

#### What the User Sees:
```
💪 Don't give up, Maria!

We noticed you didn't pass the quiz this time.
That's okay - learning takes practice!

Here's what you can do:
• Review the module materials
• Try the practice questions
• Ask me specific questions
• Take the quiz again when ready

Remember: You can retake the quiz. We believe in you! 🌟

Reply "review" to go over the content, or "retry" when ready.
```

#### How It's Triggered:
- Immediately after quiz submission with score < 70%
- Sends encouraging message with actionable steps
- Provides retry link

**Location in code:** `services/coaching/nudging.service.js:179-221`

---

### Scenario 5: Milestone Celebration

**When a user completes a module:**

#### What the User Sees:
```
🎉 Congratulations, David!

You just completed Module 1: Introduction to Teaching!

This is a huge accomplishment! You're building valuable
skills that will transform your teaching practice.

Progress: 1/5 modules complete
Next up: Module 2 - Classroom Management

Keep up the amazing work! 🚀

Reply "continue" to start the next module.
```

#### How It's Triggered:
- Automatically when module completion is recorded
- Can also be triggered manually by admin via dashboard
- Celebrates user achievements

**Location in code:** `services/coaching/nudging.service.js:223-260`

---

### Scenario 6: Reflection Prompt (Scheduled)

**User receives reflection prompts weekly (or their chosen frequency):**

#### What the User Sees:
```
📝 *Reflection Time!*

Hi Sarah! Time for your weekly learning reflection.

*Question:* What's one key insight you learned this week
that you're excited to apply in your classroom?

*Think about:*
• What went well in your learning
• Any challenges you faced
• How you'll use what you learned

Please take a few moments to share your thoughts.
Your reflection helps us support you better!
```

#### User Response:
```
I learned that proactive classroom management is better
than reactive. I plan to implement the traffic light
system in my class next week. The key challenge was
understanding how to handle disruptions calmly.
```

#### System's AI Analysis & Feedback:
```
✨ *Great reflection, Sarah!*

**Key insights I noticed:**
• Proactive vs reactive management (excellent understanding!)
• Concrete action plan (traffic light system)
• Self-awareness about challenges

**Feedback:**
Your plan to implement the traffic light system shows
you're applying what you learned. Great job identifying
that staying calm during disruptions is key!

**Suggested next steps:**
• Practice the traffic light system in small groups first
• Review Module 2 section on de-escalation techniques

Keep up this reflective practice! 💡
```

#### How It's Triggered:
- User schedules reflection reminders (weekly/biweekly/monthly)
- Scheduler sends prompt at scheduled time
- System analyzes response using AI
- Extracts key points, depth level, emotional tone
- Generates personalized feedback

**Location in code:**
- Prompt generation: `services/coaching/reflection.service.js:29-98`
- Response processing: `services/coaching/reflection.service.js:100-182`
- Scheduler: `services/coaching/scheduler.service.js:194-242`

---

### Scenario 7: Daily Learning Tip

**Every day at 9 AM, active users receive a learning tip:**

#### What the User Sees:
```
💡 *Daily Teaching Tip*

Good morning! Here's today's teaching insight:

"The best classroom management starts with clear
expectations set on day one. Students thrive when
they know what's expected."

*Quick Question:* Have you set clear expectations
in your classroom?

Reply "yes" or "tell me more" to discuss!
```

#### How It's Triggered:
- Automated scheduler runs at 9 AM daily
- Sends to active users (engaged in last 7 days)
- Rotates through curated tip library

**Location in code:** `services/coaching/nudging.service.js:262-308`

---

## 🤖 Automated Scheduler Behavior

### Schedule Configuration

```javascript
// Default settings (configurable via .env)
{
  nudgeCheckInterval: 6 hours,      // Check for nudges every 6 hours
  dailyTipHour: 9,                  // Send daily tips at 9 AM
  inactivityThreshold: 48 hours,    // Flag users after 48h no activity
  cooldownPeriod: 24 hours          // Wait 24h between same nudge type
}
```

### What Runs Automatically

**Every 6 Hours:**
- Check for inactive users → Send "welcome back" nudges
- Check for pending quizzes → Send quiz reminders
- Check for failed quizzes → Send retry encouragement
- Check for completed milestones → Send celebrations

**Daily at 9 AM:**
- Send learning tips to active users
- Rotate tip content to avoid repetition

**User-Scheduled:**
- Reflection reminders (weekly/biweekly/monthly)
- Custom nudge schedules per user

**Location in code:** `services/coaching/scheduler.service.js`

---

## 💬 WhatsApp Message Flow

### Complete Flow Diagram

```
User WhatsApp Message
       ↓
[Twilio Webhook] /webhook/twilio
       ↓
[WhatsApp Handler] services/whatsapp-handler.service.js
       ↓
[Course Orchestrator] services/course-orchestrator.service.js
       ↓
┌─────────────────────────────────────────────┐
│ 1. Process message & send response          │
│ 2. Update user progress                     │
│ 3. Track activity in Neo4j                  │
│ 4. Run coaching check (non-blocking)        │
└─────────────────────────────────────────────┘
       ↓
[Coaching Engine] services/coaching/coaching-engine.service.js
       ↓
┌─────────────────────────────────────────────┐
│ Analyze:                                    │
│ • User engagement level                     │
│ • Time since last activity                  │
│ • Quiz performance                          │
│ • Module progress                           │
└─────────────────────────────────────────────┘
       ↓
[Nudging Service] services/coaching/nudging.service.js
       ↓
Decision: Does user need a nudge?
       ↓
       Yes → Send WhatsApp message
       No  → Log activity only
```

---

## 📊 Engagement Scoring

### How the System Measures Engagement

```javascript
Engagement Score =
  (messages_sent * 10) +
  (modules_started * 20) +
  (modules_completed * 50) +
  (quizzes_passed * 30) +
  (reflections_submitted * 15) -
  (days_inactive * 5)
```

### Score Levels:
- **High (80+):** Active learner, send encouragement
- **Medium (40-79):** Progressing, send tips
- **Low (0-39):** At risk, send motivational nudges

**Location in code:** `services/coaching/coaching-engine.service.js:29-89`

---

## 🧪 Testing the Flow

### Test Inactive User Nudge

```bash
# Simulate a WhatsApp message from inactive user
curl -X POST http://34.162.136.203:3000/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+1234567890" \
  -d "Body=hello" \
  -d "MessageSid=TEST123"

# Check coaching logs
gcloud compute ssh --zone "us-east5-a" "teachers-training" \
  --project "lms-tanzania-consultant" \
  --command "docker logs teachers_training_app_1 | grep -i 'coaching\|nudge'"
```

### Manually Trigger Nudges

```bash
# Via admin dashboard
# 1. Go to http://34.162.136.203:3000/admin/coaching-analytics.html
# 2. Click "Trigger Nudge Check Now"

# Or via API
TOKEN="your-admin-token"
curl -X POST http://34.162.136.203:3000/api/coaching/nudges/send-all \
  -H "Authorization: Bearer $TOKEN"
```

### Send Test Nudge to Specific User

```bash
# Send to user ID 27
TOKEN="your-admin-token"
curl -X POST http://34.162.136.203:3000/api/coaching/nudges/send/27 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nudgeType": "welcome_back",
    "variables": {
      "name": "Sarah"
    }
  }'
```

---

## 🎯 Real Examples

### Example 1: Struggling Student

**User:** Ahmed (inactive 3 days, failed quiz twice)

**System Actions:**
1. Day 1: Failed quiz → Immediate retry encouragement
2. Day 2: No activity → Wait (cooldown period)
3. Day 3: Still inactive → "Welcome back" nudge + resources
4. Day 4: Responds "help" → Adaptive coaching kicks in
5. System provides: Review materials, practice questions, tutor support

**Messages Sent:**
```
Day 1: "Don't worry Ahmed! Let's review the materials together..."
Day 3: "Hi Ahmed! We haven't heard from you. Need help?"
Day 4: "Great to hear from you! Here are resources to help..."
```

### Example 2: High Achiever

**User:** Fatima (completed 3 modules, 90%+ quiz scores)

**System Actions:**
1. Each module completion → Celebration message
2. Weekly reflection → "What was your biggest win this week?"
3. Daily tips → Advanced teaching strategies
4. Recommendation → "Ready for Module 4: Assessment Strategies?"

**Messages Sent:**
```
"🎉 Amazing work Fatima! 3 modules done!"
"📝 Reflection time: Share your success story..."
"💡 Advanced tip: Try differentiated instruction..."
"🚀 You're ready for advanced modules!"
```

### Example 3: Needs Encouragement

**User:** John (started strong, slowing down)

**System Actions:**
1. Week 1: 5 messages/day → High engagement
2. Week 2: 1 message/day → Medium engagement
3. Week 3: No messages → Inactivity nudge
4. Day 1 return: "Welcome back!" + progress summary
5. Reflection prompt → "What's been challenging?"

**Messages Sent:**
```
Week 3: "We miss you John! You were doing so well..."
Return: "Welcome back! You've completed 40% - don't stop now!"
Reflection: "Tell us what's been difficult. We're here to help."
```

---

## 🔒 Cooldown & Throttling

### To Avoid Spam:

**Rules:**
- Same nudge type: 24 hours minimum between sends
- Any nudge: 6 hours minimum between different types
- Daily tips: Once per day max
- Reflections: User-controlled frequency

**Location in code:** `services/coaching/nudging.service.js:310-350`

```javascript
// Check cooldown before sending
const lastNudge = await this.getLastNudge(userId, nudgeType);
const hoursSince = (Date.now() - lastNudge) / (1000 * 60 * 60);

if (hoursSince < this.config.cooldownHours) {
  logger.info(`Skipping nudge - cooldown period (${hoursSince}h)`);
  return false;
}
```

---

## 📱 Message Templates

### All Nudge Types

**Location:** `services/coaching/nudging.service.js:352-440`

1. **welcome_back** - Inactive user return
2. **inactive_gentle** - First inactivity notice
3. **inactive_urgent** - Extended inactivity
4. **quiz_reminder** - Pending quiz
5. **quiz_retry** - Failed quiz encouragement
6. **milestone_celebration** - Achievement
7. **daily_tip** - Learning tip
8. **reflection_prompt** - Reflection request

Each template includes:
- Personalized greeting with user's name
- Context-specific message
- Clear call-to-action
- Encouraging tone
- Emoji for visual appeal

---

## 🎛️ Admin Controls

### From Dashboard (http://34.162.136.203:3000/admin/coaching-analytics.html):

**Can Do:**
- Trigger manual nudge check for all users
- Send specific nudge to individual user
- View nudge statistics and effectiveness
- Monitor user engagement levels
- See reflection submissions and quality
- Adjust nudge frequencies (via config)

**Cannot Do:**
- Cannot disable nudges for individual users (feature request)
- Cannot customize message templates (uses defaults)
- Cannot A/B test different messages (future enhancement)

---

## 🚀 Summary

### How It All Connects:

1. **User interacts** → WhatsApp webhook receives message
2. **System responds** → Educational content delivered
3. **Coaching checks** → Background analysis runs
4. **Scheduler monitors** → Automated nudges every 6 hours
5. **User receives** → Personalized coaching messages
6. **Engagement tracked** → Analytics updated
7. **Admin monitors** → Dashboard shows insights

### Key Integration Points:

- `routes/twilio-webhook.routes.js` → Entry point
- `services/whatsapp-handler.service.js` → Message processing
- `services/course-orchestrator.service.js` → Coaching trigger
- `services/coaching/coaching-engine.service.js` → Analysis
- `services/coaching/nudging.service.js` → Message delivery
- `services/coaching/reflection.service.js` → Reflection processing
- `services/coaching/scheduler.service.js` → Automation

---

**The coaching system runs 24/7, automatically supporting users throughout their learning journey!** 🎓

---

*For testing and troubleshooting, see the test scripts:*
- `test-coaching-nudging.sh` - API tests
- `test-coaching-gcp.sh` - GCP verification
- `tests/e2e/coaching-analytics-navigation.spec.js` - E2E tests
