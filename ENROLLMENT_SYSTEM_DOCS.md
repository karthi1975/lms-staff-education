# Enrollment and Progress Tracking System Documentation

## Overview
The Teachers Training system uses a **PIN-based enrollment system** for WhatsApp users with comprehensive progress tracking through the Admin Portal.

## System Architecture

### 1. Enrollment Flow

```
Admin Portal → Enroll User → Generate PIN → User Receives PIN
    ↓
WhatsApp User → Messages Bot → Prompted for PIN
    ↓
User Sends PIN → Verified → Account Activated → Education Chat Begins
```

### 2. Key Components

#### A. **Enrollment Service** (`services/enrollment.service.js`)
- **PIN Generation**: 4-digit random PIN with 7-day expiry
- **PIN Verification**: bcrypt-based secure verification
- **Status Management**: pending → active transitions
- **Attempt Tracking**: 3 attempts max, auto-block on exhaustion
- **Module Initialization**: First module progress auto-created on verification

#### B. **Admin Portal UI** (`public/admin/users.html`)
- **User Enrollment Modal**: Name + Phone number input
- **PIN Display Modal**: Shows PIN, expiry, and WhatsApp bot instructions
- **User List**: Displays all enrolled users with progress stats
- **Progress Detail View**: Click user to see detailed module progress
- **Search & Filter**: Real-time search by name or phone number

#### C. **WhatsApp Handler** (`services/whatsapp-handler.service.js`)
- **Enrollment Check**: Lines 33-96 validate enrollment status
- **PIN Prompt**: Pending users prompted for PIN
- **PIN Verification**: 4-digit PIN verified via enrollment service
- **Welcome Message**: Sent after successful verification
- **Education Chat**: Proceeds to course orchestrator after activation

#### D. **Backend API** (`routes/admin.routes.js`)

**Enrollment Endpoints:**
```
POST   /api/admin/users/enroll                  # Enroll new user
GET    /api/admin/users/:phone/enrollment-status # Check enrollment status
POST   /api/admin/users/:phone/reset-pin         # Reset PIN
POST   /api/admin/users/:phone/unblock           # Unblock user
GET    /api/admin/users/:userId/enrollment-history # Audit trail
```

**Progress Tracking Endpoints:**
```
GET    /api/admin/users                          # All users with progress summary
GET    /api/admin/user-progress/:userId          # Detailed module progress
GET    /api/admin/users/:userId/progress         # Alternative progress endpoint
```

## Enrollment Workflow

### Admin Actions

1. **Login to Admin Portal**
   - Navigate to `http://localhost:3000/admin/login.html`
   - Login with admin credentials

2. **Enroll New User**
   - Go to "User Progress Tracking" page
   - Click "Add User" button
   - Enter:
     - Name (e.g., "John Teacher")
     - WhatsApp Number (e.g., "+255712345678")
   - Click "Add User"

3. **Receive PIN**
   - PIN modal displays:
     - 4-digit PIN prominently
     - Expiration date (7 days from enrollment)
     - WhatsApp bot number
     - Instructions for user
   - **Copy PIN** and share with user via SMS or email

4. **Monitor User Progress**
   - User appears in user list immediately
   - Status: "pending" until PIN verified
   - Click user row to view detailed progress

### User Actions

1. **Message WhatsApp Bot**
   - User messages bot at `+1 806 515 7636`
   - Bot checks enrollment status

2. **Send PIN**
   - Bot prompts: "Please verify your identity by sending your 4-digit PIN"
   - User sends PIN (e.g., "5355")

3. **Account Activated**
   - Upon successful verification:
     - User status: pending → active
     - `is_verified`: false → true
     - First module progress initialized
     - Welcome message sent
   - User can now start education chat

4. **Start Learning**
   - Type "help" for commands
   - Type "courses" to see available courses
   - Ask questions about course content
   - Progress tracked automatically

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    whatsapp_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    enrollment_pin TEXT,                    -- Hashed PIN
    enrollment_status VARCHAR(20) DEFAULT 'pending',  -- pending|active|blocked
    pin_attempts INTEGER DEFAULT 3,
    pin_expires_at TIMESTAMP,
    is_verified BOOLEAN DEFAULT false,
    current_module_id INTEGER,
    enrolled_by INTEGER REFERENCES admin_users(id),
    enrolled_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### User Progress Table
```sql
CREATE TABLE user_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'not_started',  -- not_started|in_progress|completed
    progress_percentage INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    last_activity_at TIMESTAMP,
    time_spent_minutes INTEGER DEFAULT 0,
    UNIQUE(user_id, module_id)
);
```

### Enrollment History Table
```sql
CREATE TABLE enrollment_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,  -- enrolled|pin_verified|pin_failed|blocked|unblocked
    performed_by INTEGER REFERENCES admin_users(id),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Progress Tracking Features

### 1. Admin Portal - User List View

**Displays:**
- User name
- WhatsApp number
- Modules completed (green badge)
- Modules in progress (yellow badge)
- Quizzes passed (blue badge)
- Total time spent (hours/minutes)
- Last active timestamp

**Features:**
- Real-time search by name or phone
- Click user row to view details
- Add new user button
- Logout button

### 2. Admin Portal - User Detail Modal

**Displays per module:**
- Module title
- Status badge (Not Started / In Progress / Completed)
- Progress percentage (0-100%)
- Progress bar visualization
- Time spent on module
- Started timestamp
- Completed timestamp (if applicable)

### 3. Progress Initialization

When user verifies PIN (lines 283-296 in `enrollment.service.js`):
```javascript
// Initialize first module progress
await postgresService.query(
  `INSERT INTO user_progress (user_id, module_id, status, progress_percentage, started_at, last_activity_at)
   VALUES ($1, $2, 'not_started', 0, NOW(), NOW())
   ON CONFLICT (user_id, module_id) DO NOTHING`,
  [user.id, currentModuleId]
);
```

### 4. Progress Updates

Progress updates occur when:
- User starts a module (status: not_started → in_progress)
- User completes content sections (progress_percentage increments)
- User completes quizzes (quiz_attempts tracked)
- User completes module (status: in_progress → completed)

## Security Features

### 1. PIN Security
- **Hashed with bcrypt** (10 salt rounds)
- **Never stored in plain text**
- **7-day expiration** enforced
- **3 attempts maximum** before account block
- **Cleared after verification** (NULL in database)

### 2. Enrollment Validation
```javascript
// WhatsApp handler checks (lines 33-96)
1. User enrolled? → If not, deny access
2. User blocked? → If yes, show blocked message
3. User pending? → If yes, prompt for PIN
4. User active? → If yes, allow education chat
```

### 3. Admin Authentication
- JWT-based authentication
- Token required for all admin endpoints
- Role-based access control (admin/viewer)
- Session management with refresh tokens

## Testing

### Run Enrollment Flow Test
```bash
./test-enrollment-flow.sh
```

**Test Coverage:**
1. ✅ Admin login
2. ✅ User enrollment with PIN generation
3. ✅ Enrollment status verification
4. ✅ User appears in admin portal
5. ✅ Module progress initialization
6. Manual: WhatsApp PIN verification

### Manual WhatsApp Test

1. Run enrollment test to get PIN
2. Message WhatsApp bot: `+1 806 515 7636`
3. Send PIN when prompted
4. Verify welcome message received
5. Type "help" to verify education chat works
6. Check admin portal for status update

## Troubleshooting

### Issue: User not receiving PIN prompt

**Check:**
1. User enrolled in database?
   ```sql
   SELECT * FROM users WHERE whatsapp_id = '+1234567890';
   ```
2. Enrollment status is 'pending'?
3. PIN not expired?
4. Attempts remaining > 0?

**Solution:**
- Reset PIN via Admin Portal
- Check WhatsApp bot logs for errors

### Issue: PIN verification fails

**Check:**
1. User sending correct 4-digit PIN?
2. PIN not expired?
3. Attempts remaining?
4. bcrypt verification working?

**Solution:**
- Reset PIN if expired
- Check enrollment_history for failed attempts
- Unblock user if blocked

### Issue: User can't start education chat after verification

**Check:**
1. `is_verified` = true in database?
2. `enrollment_status` = 'active'?
3. Course orchestrator initialized?
4. Modules loaded from database?

**Solution:**
- Verify enrollment_service.verifyUserPIN() completed
- Check server logs for course orchestrator errors
- Restart Docker containers if needed

## Production Deployment

### Environment Variables
```env
# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h

# Enrollment Settings
PIN_EXPIRY_DAYS=7
MAX_PIN_ATTEMPTS=3

# WhatsApp Bot Number
WHATSAPP_BOT_NUMBER=+18065157636

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=teachers_training
DB_USER=teachers_user
DB_PASSWORD=teachers_pass_2024
```

### Admin User Setup

Create initial admin user:
```sql
INSERT INTO admin_users (email, name, password_hash, role, is_active)
VALUES (
  'admin@school.edu',
  'System Admin',
  '$2b$10$hash_goes_here',  -- bcrypt hash of password
  'admin',
  true
);
```

Or use API:
```bash
curl -X POST http://localhost:3000/api/admin/admin-users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name": "John Admin",
    "email": "john@school.edu",
    "password": "SecurePass123!",
    "role": "admin"
  }'
```

## API Examples

### 1. Enroll User
```bash
curl -X POST http://localhost:3000/api/admin/users/enroll \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Jane Teacher",
    "phoneNumber": "+255712345678"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "User enrolled successfully. Share PIN with user.",
  "data": {
    "userId": 123,
    "phoneNumber": "+255712345678",
    "pin": "5355",
    "expiresAt": "2025-10-29T12:00:00.000Z"
  }
}
```

### 2. Check Enrollment Status
```bash
curl -X GET "http://localhost:3000/api/admin/users/%2B255712345678/enrollment-status" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": 123,
    "name": "Jane Teacher",
    "status": "pending",
    "isVerified": false,
    "attemptsRemaining": 3,
    "pinExpiresAt": "2025-10-29T12:00:00.000Z",
    "enrolledAt": "2025-10-22T12:00:00.000Z"
  }
}
```

### 3. Get User Progress
```bash
curl -X GET http://localhost:3000/api/admin/user-progress/123 \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "success": true,
  "modules": [
    {
      "id": 1,
      "module_id": 1,
      "module_title": "Introduction to Business Studies",
      "status": "in_progress",
      "progress_percentage": 45,
      "started_at": "2025-10-22T13:00:00.000Z",
      "completed_at": null,
      "time_spent_minutes": 120,
      "last_activity_at": "2025-10-22T15:00:00.000Z"
    }
  ]
}
```

### 4. Reset PIN
```bash
curl -X POST http://localhost:3000/api/admin/users/%2B255712345678/reset-pin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customPin": "1234"
  }'
```

## Monitoring and Analytics

### Key Metrics to Track

1. **Enrollment Metrics**
   - Total enrolled users
   - Pending vs. verified users
   - PIN verification success rate
   - Average time to verify
   - Blocked users count

2. **Engagement Metrics**
   - Active users (last 7 days)
   - Average time spent per user
   - Modules completion rate
   - Quiz pass rate
   - Daily/weekly active users

3. **Progress Metrics**
   - Users per module status
   - Average progress percentage
   - Module completion time
   - Drop-off points

### Query Examples

**Enrollment Statistics:**
```sql
SELECT
  enrollment_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM users
GROUP BY enrollment_status;
```

**Active Users (Last 7 Days):**
```sql
SELECT COUNT(DISTINCT user_id) as active_users
FROM user_progress
WHERE last_activity_at > NOW() - INTERVAL '7 days';
```

**Module Completion Rates:**
```sql
SELECT
  m.title,
  COUNT(CASE WHEN up.status = 'completed' THEN 1 END) as completed,
  COUNT(*) as total,
  ROUND(COUNT(CASE WHEN up.status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 2) as completion_rate
FROM modules m
LEFT JOIN user_progress up ON m.id = up.module_id
GROUP BY m.id, m.title
ORDER BY m.sequence_order;
```

## Future Enhancements

### Planned Features

1. **SMS Integration**: Auto-send PIN via SMS when user is enrolled
2. **Email Notifications**: Send enrollment confirmation and PIN via email
3. **Bulk Enrollment**: CSV upload for enrolling multiple users
4. **Progress Reports**: Generate PDF reports for user progress
5. **Learning Analytics**: Dashboard with charts and insights
6. **Certificate Generation**: Auto-generate certificates on course completion
7. **Reminders**: Automated nudges for inactive users
8. **Mobile App**: Dedicated mobile app for admin management

### Technical Improvements

1. **Rate Limiting**: Prevent PIN brute-force attacks
2. **Redis Caching**: Cache user sessions and progress data
3. **WebSocket Support**: Real-time progress updates in admin portal
4. **Audit Logging**: Comprehensive audit trail for all admin actions
5. **Data Export**: Export user data and progress to CSV/Excel
6. **Backup/Restore**: Automated database backups

---

## Quick Reference

### Admin Portal URLs
- Login: `http://localhost:3000/admin/login.html`
- Dashboard: `http://localhost:3000/admin/lms-dashboard.html`
- User Management: `http://localhost:3000/admin/users.html`
- Course Management: `http://localhost:3000/admin/courses.html`

### WhatsApp Bot
- Number: `+1 806 515 7636`

### Key Commands
- Run enrollment test: `./test-enrollment-flow.sh`
- Check Docker status: `docker ps`
- View app logs: `docker logs teachers_training-app-1`
- Restart services: `docker-compose restart`

### Support Contacts
- Admin Email: admin@school.edu
- System Administrator: [Contact Info]

---

*Last Updated: 2025-10-22*
*Version: 1.0*
