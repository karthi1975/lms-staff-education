# Coaching Modes API Documentation

**Version:** 1.0.0
**Base URL:** `http://your-domain.com/api`
**Last Updated:** 2025-10-31

---

## Overview

The Coaching Modes API provides endpoints for managing dual coaching modes (Regular Mode and Socratic Mode) in the Teachers Training System. The API supports user preference management, session tracking, and analytics.

### Authentication

Admin endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Response Format

All endpoints return JSON responses in the following format:

```json
{
  "success": true|false,
  "message": "Description of result",
  "data": {...} // Response data
}
```

---

## Endpoints Summary

| Category | Method | Endpoint | Auth Required |
|----------|--------|----------|---------------|
| **User Endpoints (8)** |
| Config | GET | `/coaching-mode/config/:courseId` | No |
| Switch | POST | `/coaching-mode/switch` | No |
| Preference | GET | `/coaching-mode/preference/:userId/:courseId` | No |
| Session Start | POST | `/coaching-mode/session/start` | No |
| Session End | POST | `/coaching-mode/session/end` | No |
| Session Message | POST | `/coaching-mode/session/message` | No |
| Session History | GET | `/coaching-mode/session/history/:userId` | No |
| Commands | GET | `/coaching-mode/commands` | No |
| **Admin Endpoints (5)** |
| Create Config | POST | `/coaching-mode/admin/config` | Admin |
| Update Config | PUT | `/coaching-mode/admin/config/:id` | Admin |
| Get Config | GET | `/coaching-mode/admin/config/:courseId` | Admin |
| Delete Config | DELETE | `/coaching-mode/admin/config/:id` | Super Admin |
| Seed Defaults | POST | `/coaching-mode/admin/seed-defaults` | Super Admin |
| **Analytics Endpoints (2)** |
| Get Analytics | GET | `/coaching-mode/admin/analytics/:courseId` | Admin |
| Generate Analytics | POST | `/coaching-mode/admin/analytics/generate` | Admin |

---

## User Endpoints

### 1. Get Course Configuration

Retrieve the coaching mode configuration for a course.

**Endpoint:** `GET /coaching-mode/config/:courseId`

**Parameters:**
- `courseId` (path, integer, required) - Course ID

**Response:**
```json
{
  "success": true,
  "data": {
    "course_id": 7,
    "default_mode": "regular",
    "allow_mode_switching": true,
    "switch_cooldown_minutes": 0,
    "regular_greeting": "Hello! I'm your teaching assistant...",
    "regular_help_text": "In Regular Mode, I provide...",
    "socratic_greeting": "Hello! Let's learn together...",
    "socratic_help_text": "In Socratic Mode, I guide..."
  }
}
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/coaching-mode/config/7"
```

---

### 2. Switch Mode

Switch user's coaching mode for a course.

**Endpoint:** `POST /coaching-mode/switch`

**Request Body:**
```json
{
  "userId": 1,
  "courseId": 7,
  "mode": "socratic"
}
```

**Parameters:**
- `userId` (integer, required) - User ID
- `courseId` (integer, required) - Course ID
- `mode` (string, required) - Mode to switch to: "regular" or "socratic"

**Response (Success):**
```json
{
  "success": true,
  "message": "Successfully switched to socratic mode",
  "current_mode": "socratic",
  "switches_count": 1,
  "preference": {
    "id": 1,
    "user_id": 1,
    "course_id": 7,
    "selected_mode": "socratic",
    "mode_switches_count": 1,
    "last_mode_switch": "2025-10-31T12:00:00Z"
  }
}
```

**Response (Cooldown):**
```json
{
  "success": false,
  "message": "Please wait 5 more minute(s) before switching modes",
  "cooldown_remaining_minutes": 5
}
```

**Example:**
```bash
curl -X POST "http://localhost:3000/api/coaching-mode/switch" \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"courseId":7,"mode":"socratic"}'
```

---

### 3. Get User Preference

Retrieve user's mode preference for a course.

**Endpoint:** `GET /coaching-mode/preference/:userId/:courseId`

**Parameters:**
- `userId` (path, integer, required) - User ID
- `courseId` (path, integer, required) - Course ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "course_id": 7,
    "selected_mode": "socratic",
    "mode_switches_count": 3,
    "last_mode_switch": "2025-10-31T12:00:00Z",
    "regular_mode_sessions": 5,
    "regular_mode_time_minutes": 120,
    "socratic_mode_sessions": 8,
    "socratic_mode_time_minutes": 200,
    "created_at": "2025-10-01T10:00:00Z",
    "updated_at": "2025-10-31T12:00:00Z"
  }
}
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/coaching-mode/preference/1/7"
```

---

### 4. Start Session

Start a new coaching session.

**Endpoint:** `POST /coaching-mode/session/start`

**Request Body:**
```json
{
  "userId": 1,
  "courseId": 7
}
```

**Response:**
```json
{
  "success": true,
  "message": "Session started successfully",
  "data": {
    "id": 123,
    "user_id": 1,
    "course_id": 7,
    "mode_used": "socratic",
    "session_start": "2025-10-31T12:00:00Z",
    "messages_sent": 0,
    "questions_asked": 0,
    "completion_status": "in_progress"
  }
}
```

**Example:**
```bash
curl -X POST "http://localhost:3000/api/coaching-mode/session/start" \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"courseId":7}'
```

---

### 5. End Session

End a coaching session with optional metrics.

**Endpoint:** `POST /coaching-mode/session/end`

**Request Body:**
```json
{
  "sessionId": 123,
  "status": "completed",
  "metrics": {
    "quiz_score": 85,
    "satisfaction_rating": 5
  }
}
```

**Parameters:**
- `sessionId` (integer, required) - Session ID
- `status` (string, optional) - Status: "completed", "abandoned" (default: "completed")
- `metrics` (object, optional) - Additional metrics
  - `quiz_score` (integer) - Quiz score (0-100)
  - `satisfaction_rating` (integer) - Rating (1-5)

**Response:**
```json
{
  "success": true,
  "message": "Session ended successfully",
  "data": {
    "id": 123,
    "user_id": 1,
    "course_id": 7,
    "mode_used": "socratic",
    "session_start": "2025-10-31T12:00:00Z",
    "session_end": "2025-10-31T12:30:00Z",
    "duration_minutes": 30,
    "messages_sent": 15,
    "questions_asked": 8,
    "quiz_score": 85,
    "completion_status": "completed",
    "satisfaction_rating": 5
  }
}
```

**Example:**
```bash
curl -X POST "http://localhost:3000/api/coaching-mode/session/end" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":123,"status":"completed","metrics":{"quiz_score":85,"satisfaction_rating":5}}'
```

---

### 6. Log Session Message

Log a message in an active session.

**Endpoint:** `POST /coaching-mode/session/message`

**Request Body:**
```json
{
  "sessionId": 123,
  "isQuestion": true
}
```

**Parameters:**
- `sessionId` (integer, required) - Session ID
- `isQuestion` (boolean, optional) - Whether the message is a question (default: false)

**Response:**
```json
{
  "success": true,
  "message": "Message logged successfully"
}
```

**Example:**
```bash
curl -X POST "http://localhost:3000/api/coaching-mode/session/message" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":123,"isQuestion":true}'
```

---

### 7. Get Session History

Retrieve user's session history with optional filtering.

**Endpoint:** `GET /coaching-mode/session/history/:userId`

**Parameters:**
- `userId` (path, integer, required) - User ID
- `courseId` (query, integer, optional) - Filter by course
- `limit` (query, integer, optional) - Number of sessions (default: 10)
- `mode` (query, string, optional) - Filter by mode: "regular" or "socratic"

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "user_id": 1,
      "course_id": 7,
      "mode_used": "socratic",
      "session_start": "2025-10-31T12:00:00Z",
      "session_end": "2025-10-31T12:30:00Z",
      "duration_minutes": 30,
      "messages_sent": 15,
      "questions_asked": 8,
      "quiz_score": 85,
      "completion_status": "completed",
      "satisfaction_rating": 5
    }
  ],
  "count": 1
}
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/coaching-mode/session/history/1?courseId=7&limit=5&mode=socratic"
```

---

### 8. Get Available Commands

Retrieve list of available WhatsApp commands.

**Endpoint:** `GET /coaching-mode/commands`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "command": "/regular",
      "alias": "/direct",
      "description": "Switch to Regular Mode (direct teaching)",
      "mode": "regular"
    },
    {
      "command": "/socratic",
      "alias": "/discovery",
      "description": "Switch to Socratic Mode (question-based learning)",
      "mode": "socratic"
    },
    {
      "command": "/mode",
      "description": "Show current coaching mode",
      "action": "show_current"
    },
    {
      "command": "/modes",
      "description": "List all available coaching modes",
      "action": "list_all"
    }
  ]
}
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/coaching-mode/commands"
```

---

## Admin Endpoints (RBAC Protected)

### 9. Create/Update Course Configuration

Create or update coaching mode configuration for a course.

**Endpoint:** `POST /coaching-mode/admin/config`

**Authentication:** Required (Admin or Super Admin)

**Request Body:**
```json
{
  "courseId": 7,
  "config": {
    "regular_prompt": "You are a helpful teaching assistant...",
    "regular_greeting": "Hello! I'm here to help...",
    "regular_help_text": "I provide direct answers...",
    "socratic_prompt": "You are a Socratic teaching assistant...",
    "socratic_greeting": "Let's discover together...",
    "socratic_help_text": "I guide you through questions...",
    "default_mode": "regular",
    "allow_mode_switching": true,
    "switch_cooldown_minutes": 5
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Configuration created/updated successfully",
  "data": {
    "id": 1,
    "course_id": 7,
    "regular_prompt": "You are a helpful teaching assistant...",
    "regular_greeting": "Hello! I'm here to help...",
    "regular_help_text": "I provide direct answers...",
    "socratic_prompt": "You are a Socratic teaching assistant...",
    "socratic_greeting": "Let's discover together...",
    "socratic_help_text": "I guide you through questions...",
    "default_mode": "regular",
    "allow_mode_switching": true,
    "switch_cooldown_minutes": 5,
    "created_at": "2025-10-31T12:00:00Z",
    "updated_at": "2025-10-31T12:00:00Z",
    "created_by": 1
  }
}
```

**Example:**
```bash
curl -X POST "http://localhost:3000/api/coaching-mode/admin/config" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"courseId":7,"config":{"default_mode":"regular","allow_mode_switching":true}}'
```

---

### 10. Update Configuration by ID

Update an existing configuration by its ID.

**Endpoint:** `PUT /coaching-mode/admin/config/:id`

**Authentication:** Required (Admin or Super Admin)

**Parameters:**
- `id` (path, integer, required) - Config ID

**Request Body:**
```json
{
  "config": {
    "switch_cooldown_minutes": 10,
    "allow_mode_switching": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Configuration updated successfully",
  "data": {...}
}
```

**Example:**
```bash
curl -X PUT "http://localhost:3000/api/coaching-mode/admin/config/1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"config":{"switch_cooldown_minutes":10}}'
```

---

### 11. Get Full Course Configuration

Retrieve complete configuration including prompts (admin view).

**Endpoint:** `GET /coaching-mode/admin/config/:courseId`

**Authentication:** Required (Admin or Super Admin)

**Parameters:**
- `courseId` (path, integer, required) - Course ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "course_id": 7,
    "regular_prompt": "Full prompt text...",
    "regular_greeting": "Hello!...",
    "regular_help_text": "Help text...",
    "socratic_prompt": "Full prompt text...",
    "socratic_greeting": "Hello!...",
    "socratic_help_text": "Help text...",
    "default_mode": "regular",
    "allow_mode_switching": true,
    "switch_cooldown_minutes": 5,
    "created_at": "2025-10-31T12:00:00Z",
    "updated_at": "2025-10-31T12:00:00Z",
    "created_by": 1
  }
}
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/coaching-mode/admin/config/7" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 12. Delete Configuration

Delete a course bot configuration.

**Endpoint:** `DELETE /coaching-mode/admin/config/:id`

**Authentication:** Required (Super Admin only)

**Parameters:**
- `id` (path, integer, required) - Config ID

**Response:**
```json
{
  "success": true,
  "message": "Configuration deleted successfully",
  "data": {...}
}
```

**Example:**
```bash
curl -X DELETE "http://localhost:3000/api/coaching-mode/admin/config/1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 13. Seed Default Configurations

Create default configurations for all active courses that don't have one.

**Endpoint:** `POST /coaching-mode/admin/seed-defaults`

**Authentication:** Required (Super Admin only)

**Response:**
```json
{
  "success": true,
  "message": "Default configurations created for 3 courses",
  "count": 3,
  "data": [...]
}
```

**Example:**
```bash
curl -X POST "http://localhost:3000/api/coaching-mode/admin/seed-defaults" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Analytics Endpoints (RBAC Protected)

### 14. Get Mode Analytics

Retrieve mode analytics for a course within a date range.

**Endpoint:** `GET /coaching-mode/admin/analytics/:courseId`

**Authentication:** Required (Admin or Super Admin)

**Parameters:**
- `courseId` (path, integer, required) - Course ID
- `startDate` (query, string, optional) - Start date (ISO 8601, default: 30 days ago)
- `endDate` (query, string, optional) - End date (ISO 8601, default: today)

**Response:**
```json
{
  "success": true,
  "data": {
    "course_id": 7,
    "period": {
      "start": "2025-10-01T00:00:00Z",
      "end": "2025-10-31T23:59:59Z"
    },
    "analytics": {
      "regular": {
        "total_users": 50,
        "total_sessions": 120,
        "total_messages": 1200,
        "avg_duration": 25.5,
        "avg_quiz": 82.5,
        "completion_rate": 85.5,
        "preference_percentage": 60.0
      },
      "socratic": {
        "total_users": 35,
        "total_sessions": 80,
        "total_messages": 950,
        "avg_duration": 32.8,
        "avg_quiz": 87.2,
        "completion_rate": 90.0,
        "preference_percentage": 40.0
      }
    }
  }
}
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/coaching-mode/admin/analytics/7?startDate=2025-10-01&endDate=2025-10-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 15. Generate and Save Analytics

Generate analytics for a period and save to database.

**Endpoint:** `POST /coaching-mode/admin/analytics/generate`

**Authentication:** Required (Admin or Super Admin)

**Request Body:**
```json
{
  "courseId": 7,
  "startDate": "2025-10-01",
  "endDate": "2025-10-31"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Analytics generated and saved successfully",
  "data": {
    "course_id": 7,
    "period": {
      "start": "2025-10-01T00:00:00Z",
      "end": "2025-10-31T23:59:59Z"
    },
    "analytics": {...}
  }
}
```

**Example:**
```bash
curl -X POST "http://localhost:3000/api/coaching-mode/admin/analytics/generate" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"courseId":7,"startDate":"2025-10-01","endDate":"2025-10-31"}'
```

---

## Error Responses

All endpoints return appropriate HTTP status codes:

| Status Code | Meaning |
|-------------|---------|
| 200 | Success |
| 201 | Resource Created |
| 400 | Bad Request (missing or invalid parameters) |
| 401 | Unauthorized (missing or invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Internal Server Error |

**Example Error Response:**
```json
{
  "success": false,
  "message": "Missing required fields: userId, courseId"
}
```

---

## Rate Limiting

- User endpoints: 100 requests per minute
- Admin endpoints: 60 requests per minute
- Analytics endpoints: 20 requests per minute

---

## Best Practices

1. **Mode Switching:** Check cooldown status before attempting to switch modes
2. **Session Management:** Always end sessions to ensure accurate analytics
3. **Analytics:** Generate analytics daily or weekly for best performance
4. **Error Handling:** Always check the `success` field in responses
5. **Authentication:** Store JWT tokens securely and refresh when needed

---

## Support

For API support, please contact the development team or create an issue in the repository.

**Last Updated:** 2025-10-31
**Version:** 1.0.0
