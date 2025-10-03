# WhatsApp Quiz Flow Guide

## Overview
Users can now complete Module 2 (Classroom Management) via WhatsApp with a 5-question quiz. Upon passing (70% or higher), the module is automatically marked as completed.

## Features Implemented

### 1. Module Access
- Users can request any module by typing: `module 2`
- The system checks if previous modules are completed
- Module 2 requires Module 1 to be completed first

### 2. Quiz System
- **5 Multiple Choice Questions** covering classroom management
- **Pass Threshold**: 70% (4 out of 5 correct)
- **Maximum Attempts**: 2 attempts per module
- **Auto-completion**: Module marked as completed upon passing

### 3. Progress Tracking
- Real-time progress updates in PostgreSQL database
- Quiz attempts and scores saved
- Module completion status tracked

## WhatsApp Commands

### For Karthi (+18016809129)

#### Access Module 2
```
User: module 2
Bot: 📚 Module 2: Classroom Management

Welcome to Module 2! This module covers effective classroom management strategies.

Topics covered:
• Setting clear expectations
• Prevention strategies
• Non-verbal interventions
• Positive reinforcement
• Handling disruptions

When you're ready to test your knowledge, type "start quiz" to begin the assessment.
```

#### Start Quiz
```
User: start quiz
Bot: *Question 1/5*

What is the PRIMARY goal of effective classroom management?

A) To maintain strict discipline
B) To create a positive learning environment
C) To reduce teacher workload
D) To increase test scores

_Reply with A, B, C, or D_
```

#### Answer Questions
```
User: B
Bot: *Question 2/5*
...
```

#### Quiz Completion
```
Bot: *📊 Quiz Results - Attempt 1*

Score: 5/5 (100%)
Status: ✅ PASSED

*🎉 Congratulations!*
You have successfully completed Module 2: Classroom Management!

Your progress has been updated. You can now proceed to the next module.
```

#### View Progress
```
User: progress
Bot: *📊 Your Progress*

✅ *Module 1*: Introduction to Teaching
   Status: Completed
   Progress: 100%
   Quizzes Passed: 1

🔄 *Module 2*: Classroom Management
   Status: In Progress
   Progress: 45%

⚪ *Module 3*: Lesson Planning
   Status: Not Started
...
```

#### Get Help
```
User: help
Bot: *🤖 Teachers Training Bot Help*

*Commands:*
• Type "module 2" - Access Module 2: Classroom Management
• Type "start quiz" - Begin quiz for current module
• Type "progress" - View your training progress
• Type "help" - Show this help message

*Modules:*
1. Introduction to Teaching
2. Classroom Management
3. Lesson Planning
4. Assessment Strategies
5. Technology in Education

Complete modules in order to unlock the next one!
```

## Module 2 Quiz Questions

### Question 1
**What is the PRIMARY goal of effective classroom management?**
- A) To maintain strict discipline
- **B) To create a positive learning environment** ✓
- C) To reduce teacher workload
- D) To increase test scores

### Question 2
**Which strategy is MOST effective for preventing classroom disruptions?**
- **A) Setting clear expectations from day one** ✓
- B) Using harsh punishments
- C) Ignoring minor misbehaviors
- D) Letting students create their own rules

### Question 3
**What does 'proximity control' mean in classroom management?**
- A) Keeping students close to the teacher's desk
- **B) Moving near students to redirect behavior without verbal intervention** ✓
- C) Controlling classroom temperature
- D) Managing classroom seating arrangements

### Question 4
**How should teachers respond to minor disruptions during instruction?**
- A) Stop teaching and address it immediately with consequences
- B) Send the student to the principal
- **C) Use non-verbal cues or proximity to redirect** ✓
- D) Ignore all disruptions completely

### Question 5
**What is the '80/20 rule' in classroom management?**
- A) Spend 80% of time teaching, 20% managing behavior
- B) 80% of problems come from 20% of students
- **C) Give 80% attention to positive behaviors, 20% to negative** ✓
- D) 80% prevention, 20% intervention

## Testing the Flow

### Option 1: Real WhatsApp (Recommended)
1. Make sure ngrok is running and webhook is configured
2. Send messages from Karthi's WhatsApp: `+18016809129`
3. Follow the conversation flow above

### Option 2: Test Script (Local Testing)
```bash
# Run the test script
docker exec teachers_training-app-1 node test-quiz-flow.js

# Check results
docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "
  SELECT u.name, up.module_id, up.status, up.progress_percentage
  FROM users u
  JOIN user_progress up ON u.id = up.user_id
  WHERE u.whatsapp_id = '+18016809129'
  ORDER BY up.module_id;
"
```

### Option 3: Direct API Testing
```bash
# Simulate webhook message
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "18016809129",
            "id": "test_msg_123",
            "timestamp": "1234567890",
            "type": "text",
            "text": {
              "body": "module 2"
            }
          }]
        }
      }]
    }]
  }'
```

## Database Schema

### Tables Used

#### `user_progress`
```sql
SELECT
  user_id,
  module_id,
  status,              -- 'not_started', 'in_progress', 'completed'
  progress_percentage,
  started_at,
  completed_at,
  time_spent_minutes,
  last_activity_at
FROM user_progress
WHERE user_id = 9 AND module_id = 2;
```

#### `quiz_attempts`
```sql
SELECT
  user_id,
  module_id,
  attempt_number,
  score,
  total_questions,
  passed,
  answers,
  attempted_at
FROM quiz_attempts
WHERE user_id = 9 AND module_id = 2;
```

## Current Status for Karthi

### Database State
```sql
-- Karthi's current progress
user_id: 9
whatsapp_id: +18016809129

-- Module 1: COMPLETED
module_id: 1
status: 'completed'
progress_percentage: 100

-- Module 2: IN PROGRESS (45%)
module_id: 2
status: 'in_progress'
progress_percentage: 45
```

## Expected Behavior

### After Completing Quiz
1. **Passing Score (70%+)**:
   - Module 2 status → `'completed'`
   - Progress percentage → `100`
   - `completed_at` timestamp set
   - User receives congratulations message
   - Can proceed to Module 3

2. **Failing Score (<70%)**:
   - Module 2 remains `'in_progress'`
   - User can retry (if attempts remaining)
   - Receives feedback on score

3. **No Attempts Remaining**:
   - Quiz blocked
   - User instructed to contact instructor

## Troubleshooting

### Check if services are running
```bash
docker-compose ps
curl http://localhost:3000/health
```

### View logs
```bash
docker logs teachers_training-app-1 -f
```

### Check webhook connectivity
```bash
# If using ngrok
curl https://your-ngrok-url.ngrok-free.app/webhook?hub.mode=subscribe&hub.verify_token=education_bot_verify_2024&hub.challenge=test
```

### Verify database connection
```bash
docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c "SELECT COUNT(*) FROM users;"
```

## Files Modified/Created

1. **New Services**:
   - `services/quiz.service.js` - Quiz logic and questions
   - `services/whatsapp-handler.service.js` - Message routing and quiz flow

2. **Modified Files**:
   - `server.js` - Updated webhook handler
   - `routes/admin.routes.js` - Fixed user endpoint
   - `routes/auth.routes.js` - Removed duplicate routes

3. **Test Files**:
   - `test-quiz-flow.js` - Automated test script

## Next Steps

1. **Test the flow** with real WhatsApp messages from +18016809129
2. **Monitor logs** to see message processing
3. **Verify database** updates after quiz completion
4. **Check admin dashboard** to see updated progress

## Admin Dashboard

Login and view Karthi's progress:
- URL: `http://localhost:3000/admin/login.html`
- Email: `admin@school.edu`
- Password: `admin123`

Navigate to "View Users" → Click on Karthi → See updated module status
