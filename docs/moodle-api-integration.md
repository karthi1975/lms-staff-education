# Moodle API Integration Guide

## Overview
This document provides step-by-step instructions for integrating with Moodle 5.1 Web Services API for the Teachers Training System.

---

## Table of Contents
1. [API Overview](#api-overview)
2. [Setup Steps (Moodle Admin)](#setup-steps-moodle-admin)
3. [API Authentication](#api-authentication)
4. [Key API Functions](#key-api-functions)
5. [Implementation Plan](#implementation-plan)
6. [Code Examples](#code-examples)

---

## API Overview

### Available Protocols
- **REST** (Recommended) - JSON/XML responses
- SOAP - XML-based
- XML-RPC - Legacy support
- AMF - Flash/ActionScript

### Authentication Method
- **Token-based authentication** - Each user gets a unique security token

### Base Endpoint
```
https://<moodle-domain>/webservice/rest/server.php
```

### Key Moodle 5.1 APIs
1. **Web Services API** - External function exposure
2. **User API** - User management and search
3. **Enrolment API** - Course participants management
4. **Calendar API** - Event and scheduling
5. **Message API** - User notifications
6. **Access API** - Permission management

---

## Setup Steps (Moodle Admin)

### Step 1: Enable Web Services
1. Log in as Moodle administrator
2. Navigate to: **Site administration → Server → Web services → Overview**
3. Follow the setup wizard or manual steps below

### Step 2: Enable REST Protocol
1. Go to: **Site administration → Server → Web services → Manage protocols**
2. Enable **REST protocol** (click the eye icon)

### Step 3: Create a Web Service
1. Go to: **Site administration → Server → Web services → External services**
2. Click **Add** button
3. Fill in:
   - **Name**: `Teachers Training Service`
   - **Short name**: `teachers_training_ws`
   - **Enabled**: ✓ (checked)
   - **Authorised users only**: ✓ (checked for security)
   - **Can download files**: ✓ (if needed)
   - **Can upload files**: ✓ (if needed)
4. Click **Add service**

### Step 4: Add Functions to Service
1. Click on **Functions** link next to your service
2. Click **Add functions**
3. Add the following functions (search and select):

#### Essential Functions for Teachers Training:
```
core_course_get_courses              - Get list of courses
core_course_get_contents             - Get course contents/modules
core_course_get_course_module        - Get specific module details
core_enrol_get_enrolled_users        - Get course participants
core_user_get_users                  - Search users
core_user_get_users_by_field         - Get user by field (id, email)
mod_lesson_get_lessons_by_courses    - Get lessons in courses
mod_resource_get_resources_by_courses - Get resources
mod_quiz_get_quizzes_by_courses      - Get quizzes
core_calendar_get_calendar_events    - Get calendar events
```

5. Click **Add functions**

### Step 5: Create a Web Service User (Recommended)
1. Go to: **Site administration → Users → Accounts → Add a new user**
2. Create a dedicated service account:
   - **Username**: `ws_teachers_training`
   - **Email**: `webservice@yourdomain.edu`
   - **First name**: `Teachers Training`
   - **Last name**: `Web Service`
3. Save the user

### Step 6: Assign Role with Web Service Capabilities
1. Go to: **Site administration → Users → Permissions → Define roles**
2. Click **Add a new role**
3. Create role:
   - **Short name**: `webserviceuser`
   - **Custom full name**: `Web Service User`
   - **Role archetype**: None
4. In **Filter**, search for: `webservice`
5. Allow these capabilities:
   ```
   webservice/rest:use
   moodle/webservice:createtoken
   ```
6. Also allow course viewing capabilities:
   ```
   moodle/course:view
   moodle/course:viewhiddencourses
   moodle/user:viewdetails
   ```
7. Assign this role to the web service user at **System context**

### Step 7: Generate Token
1. Go to: **Site administration → Server → Web services → Manage tokens**
2. Click **Add**
3. Select:
   - **User**: `ws_teachers_training` (or your service user)
   - **Service**: `Teachers Training Service`
4. Click **Save changes**
5. **IMPORTANT**: Copy the generated token - you'll need this for API calls

**Example Token**: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

### Step 8: Test the Connection
Use this URL in browser (replace values):
```
https://your-moodle.edu/webservice/rest/server.php?wstoken=YOUR_TOKEN&wsfunction=core_webservice_get_site_info&moodlewsrestformat=json
```

Expected response:
```json
{
  "sitename": "Your Moodle Site",
  "username": "ws_teachers_training",
  "userid": 123,
  "siteurl": "https://your-moodle.edu"
}
```

---

## API Authentication

### Token-Based Authentication

Every API request requires a token parameter:

**URL Format:**
```
https://moodle.edu/webservice/rest/server.php?wstoken={TOKEN}&wsfunction={FUNCTION}&moodlewsrestformat=json
```

**Components:**
- `wstoken` - Your API token
- `wsfunction` - The Moodle function to call
- `moodlewsrestformat` - Response format (json or xml)

### Security Best Practices
1. **Store tokens securely** - Use environment variables, never commit to git
2. **Use HTTPS** - Always use SSL/TLS for API calls
3. **Restrict IP addresses** (optional) - Configure in Moodle security settings
4. **Token rotation** - Regenerate tokens periodically
5. **Dedicated service user** - Don't use admin account tokens

---

## Key API Functions

### 1. Get Site Information
**Function**: `core_webservice_get_site_info`

**Purpose**: Test connection and get site details

**Request:**
```bash
curl "https://moodle.edu/webservice/rest/server.php?wstoken=TOKEN&wsfunction=core_webservice_get_site_info&moodlewsrestformat=json"
```

**Response:**
```json
{
  "sitename": "School Moodle",
  "username": "webservice_user",
  "userid": 5,
  "functions": [...]
}
```

---

### 2. Get All Courses
**Function**: `core_course_get_courses`

**Purpose**: Retrieve list of all courses (or specific courses by ID)

**Request (All Courses):**
```bash
curl "https://moodle.edu/webservice/rest/server.php?wstoken=TOKEN&wsfunction=core_course_get_courses&moodlewsrestformat=json"
```

**Request (Specific Courses):**
```bash
curl -X POST "https://moodle.edu/webservice/rest/server.php" \
  -d "wstoken=TOKEN" \
  -d "wsfunction=core_course_get_courses" \
  -d "moodlewsrestformat=json" \
  -d "options[ids][0]=6" \
  -d "options[ids][1]=12"
```

**Response:**
```json
[
  {
    "id": 6,
    "fullname": "Teacher Training Module 1",
    "shortname": "TTM1",
    "categoryid": 3,
    "summary": "Introduction to effective teaching",
    "format": "topics",
    "visible": 1,
    "startdate": 1609459200,
    "enddate": 1640995200
  }
]
```

---

### 3. Get Course Contents
**Function**: `core_course_get_contents`

**Purpose**: Get all modules, activities, and resources in a course

**Request:**
```bash
curl -X POST "https://moodle.edu/webservice/rest/server.php" \
  -d "wstoken=TOKEN" \
  -d "wsfunction=core_course_get_contents" \
  -d "moodlewsrestformat=json" \
  -d "courseid=6"
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Topic 1: Classroom Management",
    "summary": "Learn effective classroom techniques",
    "modules": [
      {
        "id": 45,
        "url": "https://moodle.edu/mod/lesson/view.php?id=45",
        "name": "Introduction to Classroom Management",
        "modname": "lesson",
        "modicon": "https://moodle.edu/theme/image.php/boost/lesson",
        "modplural": "Lessons",
        "description": "Interactive lesson on classroom setup"
      },
      {
        "id": 46,
        "url": "https://moodle.edu/mod/resource/view.php?id=46",
        "name": "Classroom Management PDF Guide",
        "modname": "resource",
        "contents": [
          {
            "filename": "classroom_guide.pdf",
            "fileurl": "https://moodle.edu/webservice/pluginfile.php/...",
            "filesize": 524288
          }
        ]
      }
    ]
  }
]
```

---

### 4. Get Enrolled Users
**Function**: `core_enrol_get_enrolled_users`

**Purpose**: Get list of users enrolled in a course

**Request:**
```bash
curl -X POST "https://moodle.edu/webservice/rest/server.php" \
  -d "wstoken=TOKEN" \
  -d "wsfunction=core_enrol_get_enrolled_users" \
  -d "moodlewsrestformat=json" \
  -d "courseid=6"
```

**Response:**
```json
[
  {
    "id": 123,
    "username": "teacher1",
    "firstname": "John",
    "lastname": "Doe",
    "fullname": "John Doe",
    "email": "john.doe@school.edu",
    "roles": [
      {
        "roleid": 5,
        "name": "",
        "shortname": "student"
      }
    ]
  }
]
```

---

### 5. Search Users
**Function**: `core_user_get_users`

**Purpose**: Search users by criteria

**Request:**
```bash
curl -X POST "https://moodle.edu/webservice/rest/server.php" \
  -d "wstoken=TOKEN" \
  -d "wsfunction=core_user_get_users" \
  -d "moodlewsrestformat=json" \
  -d "criteria[0][key]=email" \
  -d "criteria[0][value]=teacher@school.edu"
```

---

### 6. Get Lessons
**Function**: `mod_lesson_get_lessons_by_courses`

**Purpose**: Get all lessons in specified courses

**Request:**
```bash
curl -X POST "https://moodle.edu/webservice/rest/server.php" \
  -d "wstoken=TOKEN" \
  -d "wsfunction=mod_lesson_get_lessons_by_courses" \
  -d "moodlewsrestformat=json" \
  -d "courseids[0]=6"
```

**Response:**
```json
{
  "lessons": [
    {
      "id": 12,
      "course": 6,
      "name": "Effective Teaching Strategies",
      "intro": "Learn various teaching methods",
      "timemodified": 1640000000,
      "section": 1,
      "visible": 1
    }
  ]
}
```

---

## Deep Linking

### URL Formats for Direct Access

1. **Lesson Deep Link:**
   ```
   https://moodle.edu/mod/lesson/view.php?id={MODULE_ID}
   ```

2. **Resource (PDF, Document) Deep Link:**
   ```
   https://moodle.edu/mod/resource/view.php?id={MODULE_ID}
   ```

3. **Quiz Deep Link:**
   ```
   https://moodle.edu/mod/quiz/view.php?id={MODULE_ID}
   ```

4. **Course Deep Link:**
   ```
   https://moodle.edu/course/view.php?id={COURSE_ID}
   ```

5. **Mobile App Deep Link (if mobile app is used):**
   ```
   moodlemobile://link={ENCODED_URL}
   ```

### Mobile Deep Link Generation
```javascript
function generateMobileDeepLink(webUrl) {
  const encodedUrl = encodeURIComponent(webUrl);
  return `moodlemobile://link=${encodedUrl}`;
}

// Example:
// generateMobileDeepLink('https://moodle.edu/mod/lesson/view.php?id=45')
// Returns: moodlemobile://link=https%3A%2F%2Fmoodle.edu%2Fmod%2Flesson%2Fview.php%3Fid%3D45
```

---

## Implementation Plan

### Phase 1: Setup & Testing (2 days)

#### Day 1: Moodle Configuration
- [ ] Complete Steps 1-8 (Setup in Moodle)
- [ ] Document token and endpoint URL
- [ ] Test basic connection with `core_webservice_get_site_info`
- [ ] Test course retrieval with `core_course_get_courses`

#### Day 2: API Testing
- [ ] Test all required functions manually (using curl or Postman)
- [ ] Document all course IDs relevant to teacher training
- [ ] Map module types to deep link formats
- [ ] Create test data samples in `test-data/moodle-samples.json`

**Deliverable**: `docs/moodle-setup-results.md` with:
- Working token
- List of available courses
- Sample API responses
- Deep link examples

---

### Phase 2: Service Implementation (3 days)

#### Create Moodle Service (`services/integration/moodle.service.js`)

```javascript
const axios = require('axios');
const logger = require('../../utils/logger');

class MoodleService {
  constructor() {
    this.baseUrl = process.env.MOODLE_BASE_URL;
    this.token = process.env.MOODLE_TOKEN;
    this.wsEndpoint = `${this.baseUrl}/webservice/rest/server.php`;
  }

  /**
   * Make a Moodle Web Service API call
   */
  async callFunction(functionName, params = {}) {
    try {
      const requestParams = {
        wstoken: this.token,
        wsfunction: functionName,
        moodlewsrestformat: 'json',
        ...params
      };

      const response = await axios.post(this.wsEndpoint, null, {
        params: requestParams
      });

      if (response.data.exception) {
        throw new Error(`Moodle API Error: ${response.data.message}`);
      }

      return response.data;
    } catch (error) {
      logger.error(`Moodle API call failed: ${functionName}`, error.message);
      throw error;
    }
  }

  /**
   * Get all courses or specific courses by ID
   */
  async getCourses(courseIds = []) {
    const params = {};
    if (courseIds.length > 0) {
      courseIds.forEach((id, index) => {
        params[`options[ids][${index}]`] = id;
      });
    }

    return await this.callFunction('core_course_get_courses', params);
  }

  /**
   * Get course contents (modules, activities, resources)
   */
  async getCourseContents(courseId) {
    return await this.callFunction('core_course_get_contents', {
      courseid: courseId
    });
  }

  /**
   * Get lessons in courses
   */
  async getLessonsByCourses(courseIds) {
    const params = {};
    courseIds.forEach((id, index) => {
      params[`courseids[${index}]`] = id;
    });

    return await this.callFunction('mod_lesson_get_lessons_by_courses', params);
  }

  /**
   * Search content by keywords
   */
  async searchContent(keywords, courseIds = []) {
    const results = {
      lessons: [],
      resources: [],
      quizzes: []
    };

    // Get all course contents
    for (const courseId of courseIds) {
      const contents = await this.getCourseContents(courseId);

      // Search through modules
      contents.forEach(section => {
        section.modules.forEach(module => {
          const matchesKeyword = keywords.some(keyword =>
            module.name.toLowerCase().includes(keyword.toLowerCase()) ||
            (module.description && module.description.toLowerCase().includes(keyword.toLowerCase()))
          );

          if (matchesKeyword) {
            const item = {
              id: module.id,
              courseId: courseId,
              name: module.name,
              type: module.modname,
              url: module.url,
              description: module.description
            };

            if (module.modname === 'lesson') {
              results.lessons.push(item);
            } else if (module.modname === 'resource') {
              results.resources.push(item);
            } else if (module.modname === 'quiz') {
              results.quizzes.push(item);
            }
          }
        });
      });
    }

    return results;
  }

  /**
   * Generate deep link for a module
   */
  generateDeepLink(moduleType, moduleId, courseId = null) {
    const baseUrl = this.baseUrl;

    switch (moduleType) {
      case 'lesson':
        return `${baseUrl}/mod/lesson/view.php?id=${moduleId}`;
      case 'resource':
        return `${baseUrl}/mod/resource/view.php?id=${moduleId}`;
      case 'quiz':
        return `${baseUrl}/mod/quiz/view.php?id=${moduleId}`;
      case 'course':
        return `${baseUrl}/course/view.php?id=${courseId}`;
      default:
        return `${baseUrl}/mod/${moduleType}/view.php?id=${moduleId}`;
    }
  }

  /**
   * Generate mobile app deep link
   */
  generateMobileDeepLink(webUrl) {
    const encodedUrl = encodeURIComponent(webUrl);
    return `moodlemobile://link=${encodedUrl}`;
  }

  /**
   * Sync courses and cache content
   */
  async syncContent() {
    try {
      logger.info('Starting Moodle content sync...');

      // Get all courses
      const courses = await this.getCourses();
      logger.info(`Found ${courses.length} courses`);

      const allContent = [];

      // Get contents for each course
      for (const course of courses) {
        const contents = await this.getCourseContents(course.id);

        contents.forEach(section => {
          section.modules.forEach(module => {
            allContent.push({
              source: 'moodle',
              sourceId: module.id,
              courseId: course.id,
              courseName: course.fullname,
              type: module.modname,
              title: module.name,
              description: module.description || '',
              url: module.url,
              deepLink: this.generateDeepLink(module.modname, module.id, course.id),
              mobileDeepLink: this.generateMobileDeepLink(module.url)
            });
          });
        });
      }

      logger.info(`Synced ${allContent.length} content items from Moodle`);
      return allContent;
    } catch (error) {
      logger.error('Moodle sync failed:', error);
      throw error;
    }
  }

  /**
   * Test connection
   */
  async testConnection() {
    try {
      const siteInfo = await this.callFunction('core_webservice_get_site_info');
      logger.info('Moodle connection successful:', {
        sitename: siteInfo.sitename,
        username: siteInfo.username,
        version: siteInfo.release
      });
      return true;
    } catch (error) {
      logger.error('Moodle connection failed:', error.message);
      return false;
    }
  }
}

module.exports = new MoodleService();
```

---

### Phase 3: Database Integration (2 days)

#### Create Migration
```bash
touch database/migrations/003_moodle_integration.sql
```

```sql
-- Store Moodle configuration
INSERT INTO content_sources (name, type, base_url, auth_type, is_active) VALUES
('School Moodle LMS', 'moodle', 'https://moodle.school.edu', 'token', true);

-- Sample curriculum keywords for Moodle content mapping
INSERT INTO curriculum_keywords (module_id, topic, keywords, priority) VALUES
('module_1', 'Introduction to Teaching', ARRAY['teaching', 'introduction', 'ufundishaji', 'utangulizi'], 1),
('module_2', 'Classroom Management', ARRAY['classroom', 'management', 'discipline', 'darasa', 'usimamizi'], 1),
('module_2', 'Lesson Planning', ARRAY['lesson', 'planning', 'preparation', 'mpango', 'somo'], 2),
('module_3', 'Assessment', ARRAY['assessment', 'evaluation', 'testing', 'tathmini', 'ukaguzi'], 1);
```

#### Sync Job
```javascript
// services/jobs/moodle-sync.job.js
const cron = require('node-cron');
const moodleService = require('../integration/moodle.service');
const db = require('../../database/db');
const logger = require('../../utils/logger');

class MoodleSyncJob {
  start() {
    // Run every 24 hours at 2 AM
    cron.schedule('0 2 * * *', async () => {
      await this.syncContent();
    });

    logger.info('Moodle sync job scheduled');
  }

  async syncContent() {
    try {
      logger.info('Starting scheduled Moodle sync');
      const content = await moodleService.syncContent();

      // Store in database
      const sourceId = await db.query(
        'SELECT id FROM content_sources WHERE type = $1 LIMIT 1',
        ['moodle']
      );

      for (const item of content) {
        await db.query(`
          INSERT INTO external_content
          (source_id, external_id, content_type, title, description, url, deep_link, metadata, last_updated)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          ON CONFLICT (source_id, external_id)
          DO UPDATE SET
            title = $4, description = $5, url = $6, deep_link = $7,
            metadata = $8, last_updated = NOW()
        `, [
          sourceId.rows[0].id,
          item.sourceId,
          item.type,
          item.title,
          item.description,
          item.url,
          item.deepLink,
          JSON.stringify({
            courseId: item.courseId,
            courseName: item.courseName,
            mobileDeepLink: item.mobileDeepLink
          })
        ]);
      }

      // Update last sync time
      await db.query(
        'UPDATE content_sources SET last_sync_at = NOW() WHERE type = $1',
        ['moodle']
      );

      logger.info(`Moodle sync complete: ${content.length} items updated`);
    } catch (error) {
      logger.error('Moodle sync job failed:', error);
    }
  }

  async runManual() {
    return await this.syncContent();
  }
}

module.exports = new MoodleSyncJob();
```

---

### Phase 4: Testing (1 day)

#### Integration Test
```javascript
// tests/integration/moodle.test.js
const moodleService = require('../../services/integration/moodle.service');

describe('Moodle Integration', () => {
  test('should connect to Moodle API', async () => {
    const result = await moodleService.testConnection();
    expect(result).toBe(true);
  });

  test('should fetch courses', async () => {
    const courses = await moodleService.getCourses();
    expect(Array.isArray(courses)).toBe(true);
    expect(courses.length).toBeGreaterThan(0);
  });

  test('should get course contents', async () => {
    const courses = await moodleService.getCourses();
    const contents = await moodleService.getCourseContents(courses[0].id);
    expect(Array.isArray(contents)).toBe(true);
  });

  test('should generate correct deep links', () => {
    const link = moodleService.generateDeepLink('lesson', 45);
    expect(link).toContain('/mod/lesson/view.php?id=45');
  });

  test('should search content by keywords', async () => {
    const results = await moodleService.searchContent(['classroom', 'management'], [6]);
    expect(results).toHaveProperty('lessons');
    expect(results).toHaveProperty('resources');
  });

  test('should sync content successfully', async () => {
    const content = await moodleService.syncContent();
    expect(Array.isArray(content)).toBe(true);
    expect(content.length).toBeGreaterThan(0);
  });
});
```

---

## Environment Variables

Add to `.env`:
```env
# Moodle Integration
MOODLE_BASE_URL=https://moodle.school.edu
MOODLE_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
MOODLE_SERVICE_NAME=teachers_training_ws
MOODLE_SYNC_ENABLED=true
MOODLE_SYNC_INTERVAL_HOURS=24

# Courses to sync (comma-separated IDs)
MOODLE_COURSE_IDS=6,12,15,18
```

---

## Troubleshooting

### Error: "Access to the service is not allowed"
**Solution**: Ensure the user has the `webservice/rest:use` capability and is authorized for the service.

### Error: "Invalid token"
**Solution**: Regenerate token in Moodle admin interface.

### Error: "Function does not exist"
**Solution**: Add the function to your external service in Moodle.

### Error: "User is not enrolled in course"
**Solution**: The web service user needs appropriate access to courses. Assign as teacher or manager role.

---

## Next Steps

1. ✅ Complete Moodle admin setup (Steps 1-8)
2. ✅ Implement MoodleService class
3. ⬜ Create content sync job
4. ⬜ Integrate with orchestrator
5. ⬜ Add admin UI for Moodle configuration
6. ⬜ Test with real teacher queries

---

## References

- [Moodle 5.1 API Documentation](https://moodledev.io/docs/5.1/apis)
- [Web Services API](https://docs.moodle.org/dev/Web_services)
- [External Services Security](https://docs.moodle.org/dev/External_services_security)
