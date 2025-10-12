# Complete Feature Testing Guide

## Prerequisites
✅ Module 1 routing fixed
✅ All services running (Docker + ngrok)
✅ WhatsApp number: +18016809129

---

## 1. Test Module Navigation

### WhatsApp Commands:
```
module 1     → Shows Module 1: Introduction to Teaching ✅
module 2     → Shows Module 2: Classroom Management
progress     → Shows your learning progress
help         → Shows all available commands
```

---

## 2. Test Quiz Functionality

### Upload Content First (Admin Portal):
1. Open: http://localhost:3000/admin/index.html
2. Click "Upload Training Content"
3. Select Module 1
4. Upload a text/PDF file with teaching content

### Then Test Quiz:
```
WhatsApp: start quiz
Bot: Question 1/5: [Question about uploaded content]
     A. Option 1
     B. Option 2
     C. Option 3
     D. Option 4

You: A
Bot: ✅ Correct! [Next question...]

(Complete all 5 questions)

Bot: 🎯 Quiz Complete!
     Score: 80%
     Correct: 4/5

     🎉 Congratulations! You passed! Next module unlocked!
```

---

## 3. Test Coaching & Nudging

### Automatic Nudges (Background Process):

**A) Inactivity Nudge** (3 days inactive):
- Stop using WhatsApp for 3 days
- System sends: "Hi! We noticed you haven't been active lately. Your learning journey awaits! 📖"

**B) Quiz Reminder** (viewed content but didn't take quiz):
- View Module 1 content
- Don't take quiz for 24 hours
- System sends: "You're ready for the quiz! 📝 Feel confident to test your knowledge."

**C) Quiz Retry Nudge** (failed quiz):
- Fail a quiz (<70%)
- System sends: "Don't give up! Review the materials and try the quiz again. Every expert was once a beginner. 💪"

**D) Milestone Celebration** (complete a module):
- Pass Module 1 quiz
- System sends: "🎉 Congratulations! You've completed Module 1! Keep up the excellent work!"

### Manual Test Nudging:

Run this command to trigger nudges immediately:
```bash
docker exec -i teachers_training-app-1 node -e "
const NudgingService = require('./services/coaching/nudging.service');
(async () => {
  await NudgingService.checkAndSendNudges();
  console.log('✅ Nudges sent');
})();
"
```

---

## 4. Test Reflection Prompts

### Reflection Service Features:

**A) Post-Module Reflection**:
After completing Module 1 quiz, bot asks:
```
"🤔 Reflection Time!

How will you apply what you learned about building rapport with students in your classroom?

Share your thoughts:"
```

**B) Weekly Reflection**:
After 7 days of activity:
```
"📝 Weekly Reflection

Looking back at this week:
1. What was your biggest learning moment?
2. What challenged you most?
3. What will you implement first?

Type 'reflect' to respond"
```

**C) Evidence Collection**:
```
WhatsApp: I want to share my teaching practice

Bot: "📸 Great! Please share:
     1. A photo of your classroom setup
     2. A brief description of what you implemented

     This helps track your progress!"
```

### Manual Test Reflections:

Run this command:
```bash
docker exec -i teachers_training-app-1 node -e "
const ReflectionService = require('./services/coaching/reflection.service');
(async () => {
  await ReflectionService.sendReflectionPrompt(
    '18016809129',
    'post_module',
    { moduleId: 1, moduleName: 'Introduction to Teaching' }
  );
  console.log('✅ Reflection prompt sent');
})();
"
```

---

## 5. Test Context-Aware Responses (RAG)

### Upload content to ChromaDB first, then:

```
WhatsApp: What are learning theories?

Bot: [Uses RAG to search ChromaDB and responds with context from uploaded materials]
     "Learning theories provide frameworks for understanding how students acquire knowledge.
     The three main theories are behaviorism, cognitivism, and constructivism..."

WhatsApp: Tell me more about that

Bot: [Remembers context from previous message]
     "Behaviorism focuses on observable behaviors and reinforcement. Teachers can apply this
     by providing immediate feedback and positive reinforcement..."
```

---

## 6. Test Personalized Learning

### Progress Tracking:
```
WhatsApp: progress

Bot: 📊 Your Learning Progress

     Overall: 20% Complete
     Modules: 1/5 Completed

     1. Introduction to Teaching
        Status: completed | Quiz: 80%

     2. Classroom Management
        Status: unlocked

     3. Lesson Planning
        Status: locked

     4. Assessment Strategies
        Status: locked

     5. Technology in Education
        Status: locked
```

### Adaptive Recommendations:
```
(After completing Module 1)

Bot: "Based on your Module 1 score (80%), I recommend:
     - Review 'Learning Theories' before Module 2
     - You excelled at 'Building Rapport' - great job!
     - Module 2 builds on these concepts"
```

---

## 7. Check GraphDB (Neo4j) for Tracking

Open Neo4j Browser: http://localhost:7474

Login: neo4j / password

Run query:
```cypher
MATCH (u:User)-[r:ENROLLED_IN]->(m:Module)
RETURN u.name, m.name, r.status, r.completion_percentage
```

This shows:
- User learning paths
- Module progression
- Completion status
- Prerequisites met

---

## 8. Automated Coaching Schedule

The system runs these checks automatically every 6 hours:

1. **Inactivity Check**: Users inactive >3 days
2. **Quiz Reminders**: Users who viewed content but didn't quiz
3. **Retry Nudges**: Users who failed quizzes
4. **Daily Tips**: Send teaching tips to active users
5. **Milestone Celebrations**: Congratulate completions

View scheduled jobs:
```bash
docker logs teachers_training-app-1 | grep "nudge\|coaching\|reflection"
```

---

## Quick Test Summary

✅ **Fixed**: Module 1 now shows correct content
✅ **Coaching**: Nudges sent automatically based on user behavior
✅ **Nudging**: 5 types (inactivity, quiz reminder, retry, milestone, tips)
✅ **Reflection**: Post-module, weekly, evidence collection
✅ **Context-Aware**: RAG pipeline with session memory
✅ **Personalized**: Progress tracking, adaptive recommendations
✅ **GraphDB**: Tracks learning paths and relationships

---

## Current Status

- ✅ Text-only WhatsApp messages (no buttons)
- ✅ Module routing fixed
- ✅ Session memory cleared
- ⚠️ Quiz requires content upload via admin portal
- ⚠️ Nudging requires background scheduler (runs every 6h)

**Next:** Upload content via admin portal to enable quiz!
