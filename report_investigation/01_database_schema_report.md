# Database Schema Investigation Report
**Generated**: Wed Oct 29 05:44:52 MDT 2025
**Database**: PostgreSQL on GCP

## Table of Contents
1. All Tables Overview
2. Detailed Schema for Each Table
3. Foreign Key Relationships
4. Indexes

## 1. All Tables Overview

```
       table_name       
------------------------
 admin_users
 chat_messages
 chat_sessions
 classification_history
 classification_temp
 coaching_events
 coaching_nudges
 content_moderation_log
 course_content
 course_enrollments
 courses
 enrollment_history
 learning_interactions
 module_content
 modules
 nudges
 prompt_injection_log
 quiz_attempts
 quiz_questions
 quizzes
 reflection_reminders
 reflections
 sessions
 system_events
 user_progress
 users
 verification_codes
 whatsapp_messages
(28 rows)

```

## 2. Detailed Schema for Each Table

### Table: `users`

```
                                            Table "public.users"
      Column       |            Type             | Collation | Nullable |              Default              
-------------------+-----------------------------+-----------+----------+-----------------------------------
 id                | integer                     |           | not null | nextval('users_id_seq'::regclass)
 whatsapp_id       | character varying(20)       |           | not null | 
 name              | character varying(100)      |           | not null | 
 created_at        | timestamp with time zone    |           |          | now()
 updated_at        | timestamp with time zone    |           |          | now()
 last_active_at    | timestamp with time zone    |           |          | 
 current_module_id | integer                     |           |          | 1
 is_active         | boolean                     |           |          | true
 metadata          | jsonb                       |           |          | 
 enrollment_pin    | character varying(60)       |           |          | 
 enrollment_status | character varying(20)       |           |          | 'pending'::character varying
 pin_attempts      | integer                     |           |          | 3
 pin_expires_at    | timestamp without time zone |           |          | 
 enrolled_by       | integer                     |           |          | 
 enrolled_at       | timestamp without time zone |           |          | 
 is_verified       | boolean                     |           |          | false
Indexes:
    "users_pkey" PRIMARY KEY, btree (id)
    "idx_users_active" btree (is_active, last_active_at)
    "idx_users_enrollment_status" btree (enrollment_status)
    "idx_users_metadata" gin (metadata)
    "idx_users_whatsapp" btree (whatsapp_id)
    "users_whatsapp_id_key" UNIQUE CONSTRAINT, btree (whatsapp_id)
Check constraints:
    "check_enrollment_status" CHECK (enrollment_status::text = ANY (ARRAY['pending'::character varying, 'active'::character varying, 'blocked'::character varying]::text[]))
Foreign-key constraints:
    "users_enrolled_by_fkey" FOREIGN KEY (enrolled_by) REFERENCES admin_users(id)
Referenced by:
    TABLE "chat_messages" CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    TABLE "chat_sessions" CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    TABLE "coaching_events" CONSTRAINT "coaching_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    TABLE "coaching_nudges" CONSTRAINT "coaching_nudges_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    TABLE "content_moderation_log" CONSTRAINT "content_moderation_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    TABLE "course_enrollments" CONSTRAINT "course_enrollments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    TABLE "enrollment_history" CONSTRAINT "enrollment_history_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    TABLE "learning_interactions" CONSTRAINT "learning_interactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    TABLE "nudges" CONSTRAINT "nudges_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    TABLE "prompt_injection_log" CONSTRAINT "prompt_injection_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    TABLE "quiz_attempts" CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    TABLE "reflection_reminders" CONSTRAINT "reflection_reminders_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    TABLE "reflections" CONSTRAINT "reflections_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    TABLE "sessions" CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    TABLE "system_events" CONSTRAINT "system_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    TABLE "user_progress" CONSTRAINT "user_progress_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    TABLE "whatsapp_messages" CONSTRAINT "whatsapp_messages_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
Triggers:
    update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()

```

**Row Count:**
```
 row_count 
-----------
         1
(1 row)

```

### Table: `admin_users`

```
                                        Table "public.admin_users"
    Column     |           Type           | Collation | Nullable |                 Default                 
---------------+--------------------------+-----------+----------+-----------------------------------------
 id            | integer                  |           | not null | nextval('admin_users_id_seq'::regclass)
 email         | character varying(255)   |           | not null | 
 password_hash | character varying(255)   |           | not null | 
 name          | character varying(100)   |           | not null | 
 role          | user_role                |           |          | 'viewer'::user_role
 ldap_dn       | character varying(500)   |           |          | 
 created_at    | timestamp with time zone |           |          | now()
 updated_at    | timestamp with time zone |           |          | now()
 last_login_at | timestamp with time zone |           |          | 
 is_active     | boolean                  |           |          | true
Indexes:
    "admin_users_pkey" PRIMARY KEY, btree (id)
    "admin_users_email_key" UNIQUE CONSTRAINT, btree (email)
    "idx_admin_email" btree (email)
    "idx_admin_users_email" btree (email)
    "idx_admin_users_role" btree (role)
Referenced by:
    TABLE "course_content" CONSTRAINT "course_content_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES admin_users(id)
    TABLE "enrollment_history" CONSTRAINT "enrollment_history_performed_by_fkey" FOREIGN KEY (performed_by) REFERENCES admin_users(id)
    TABLE "module_content" CONSTRAINT "module_content_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES admin_users(id)
    TABLE "system_events" CONSTRAINT "system_events_admin_user_id_fkey" FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
    TABLE "users" CONSTRAINT "users_enrolled_by_fkey" FOREIGN KEY (enrolled_by) REFERENCES admin_users(id)
Triggers:
    update_admin_users_updated_at BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()

```

**Row Count:**
```
 row_count 
-----------
         1
(1 row)

```

### Table: `courses`

```
                                          Table "public.courses"
      Column      |           Type           | Collation | Nullable |               Default               
------------------+--------------------------+-----------+----------+-------------------------------------
 id               | integer                  |           | not null | nextval('courses_id_seq'::regclass)
 title            | character varying(255)   |           | not null | 
 code             | character varying(50)    |           | not null | 
 description      | text                     |           |          | 
 category         | character varying(100)   |           |          | 
 difficulty_level | character varying(20)    |           |          | 
 duration_weeks   | integer                  |           |          | 
 sequence_order   | integer                  |           |          | 0
 moodle_course_id | integer                  |           |          | 
 is_active        | boolean                  |           |          | true
 created_at       | timestamp with time zone |           |          | now()
 updated_at       | timestamp with time zone |           |          | now()
Indexes:
    "courses_pkey" PRIMARY KEY, btree (id)
    "courses_code_key" UNIQUE CONSTRAINT, btree (code)
    "idx_courses_active" btree (is_active)
    "idx_courses_category" btree (category)
    "idx_courses_code" btree (code)
    "idx_courses_sequence" btree (sequence_order)
Referenced by:
    TABLE "chat_sessions" CONSTRAINT "chat_sessions_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
    TABLE "classification_history" CONSTRAINT "classification_history_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    TABLE "classification_temp" CONSTRAINT "classification_temp_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    TABLE "course_content" CONSTRAINT "course_content_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    TABLE "course_enrollments" CONSTRAINT "course_enrollments_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    TABLE "modules" CONSTRAINT "modules_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
Triggers:
    update_courses_updated_at BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()

```

**Row Count:**
```
 row_count 
-----------
         1
(1 row)

```

### Table: `modules`

```
                                              Table "public.modules"
          Column          |           Type           | Collation | Nullable |               Default               
--------------------------+--------------------------+-----------+----------+-------------------------------------
 id                       | integer                  |           | not null | nextval('modules_id_seq'::regclass)
 course_id                | integer                  |           |          | 
 title                    | character varying(200)   |           | not null | 
 description              | text                     |           |          | 
 sequence_order           | integer                  |           | not null | 
 is_active                | boolean                  |           |          | true
 created_at               | timestamp with time zone |           |          | now()
 updated_at               | timestamp with time zone |           |          | now()
 learning_level           | character varying(50)    |           |          | 'intermediate'::character varying
 estimated_duration_hours | integer                  |           |          | 4
 prerequisites            | text[]                   |           |          | 
 topics                   | text[]                   |           |          | 
Indexes:
    "modules_pkey" PRIMARY KEY, btree (id)
    "idx_modules_active" btree (is_active)
    "idx_modules_course" btree (course_id)
    "idx_modules_learning_level" btree (learning_level)
    "idx_modules_sequence" btree (sequence_order)
Check constraints:
    "modules_learning_level_check" CHECK (learning_level::text = ANY (ARRAY['beginner'::character varying, 'intermediate'::character varying, 'advanced'::character varying, 'expert'::character varying]::text[]))
Foreign-key constraints:
    "modules_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
Referenced by:
    TABLE "chat_messages" CONSTRAINT "chat_messages_module_id_fkey" FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE SET NULL
    TABLE "chat_sessions" CONSTRAINT "chat_sessions_module_id_fkey" FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE SET NULL
    TABLE "course_enrollments" CONSTRAINT "course_enrollments_current_module_id_fkey" FOREIGN KEY (current_module_id) REFERENCES modules(id)
    TABLE "learning_interactions" CONSTRAINT "learning_interactions_moodle_module_id_fkey" FOREIGN KEY (moodle_module_id) REFERENCES modules(id) ON DELETE SET NULL
    TABLE "module_content" CONSTRAINT "module_content_module_id_fkey" FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    TABLE "quiz_questions" CONSTRAINT "quiz_questions_module_id_fkey" FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    TABLE "quizzes" CONSTRAINT "quizzes_module_id_fkey" FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    TABLE "reflections" CONSTRAINT "reflections_module_id_fkey" FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE SET NULL
    TABLE "user_progress" CONSTRAINT "user_progress_module_id_fkey" FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
Triggers:
    update_modules_updated_at BEFORE UPDATE ON modules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()

```

**Row Count:**
```
 row_count 
-----------
         5
(1 row)

```

### Table: `quizzes`

```
                                           Table "public.quizzes"
       Column       |           Type           | Collation | Nullable |               Default               
--------------------+--------------------------+-----------+----------+-------------------------------------
 id                 | integer                  |           | not null | nextval('quizzes_id_seq'::regclass)
 module_id          | integer                  |           |          | 
 title              | character varying(255)   |           | not null | 
 description        | text                     |           |          | 
 pass_threshold     | integer                  |           |          | 70
 time_limit_minutes | integer                  |           |          | 
 max_attempts       | integer                  |           |          | 2
 is_active          | boolean                  |           |          | true
 created_at         | timestamp with time zone |           |          | now()
 updated_at         | timestamp with time zone |           |          | now()
Indexes:
    "quizzes_pkey" PRIMARY KEY, btree (id)
    "idx_quizzes_active" btree (is_active)
    "idx_quizzes_module" btree (module_id)
Foreign-key constraints:
    "quizzes_module_id_fkey" FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
Triggers:
    update_quizzes_updated_at BEFORE UPDATE ON quizzes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()

```

**Row Count:**
```
 row_count 
-----------
         5
(1 row)

```

### Table: `quiz_questions`

```
                                         Table "public.quiz_questions"
     Column     |           Type           | Collation | Nullable |                  Default                   
----------------+--------------------------+-----------+----------+--------------------------------------------
 id             | integer                  |           | not null | nextval('quiz_questions_id_seq'::regclass)
 module_id      | integer                  |           |          | 
 quiz_id        | integer                  |           |          | 
 question       | text                     |           | not null | 
 options        | jsonb                    |           | not null | 
 correct_answer | text                     |           | not null | 
 explanation    | text                     |           |          | 
 difficulty     | character varying(20)    |           |          | 'medium'::character varying
 created_at     | timestamp with time zone |           |          | now()
 updated_at     | timestamp with time zone |           |          | now()
Indexes:
    "quiz_questions_pkey" PRIMARY KEY, btree (id)
    "idx_quiz_questions_module" btree (module_id)
    "idx_quiz_questions_quiz" btree (quiz_id)
Foreign-key constraints:
    "quiz_questions_module_id_fkey" FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
Triggers:
    update_quiz_questions_updated_at BEFORE UPDATE ON quiz_questions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()

```

**Row Count:**
```
 row_count 
-----------
        25
(1 row)

```

### Table: `quiz_attempts`

```
                                         Table "public.quiz_attempts"
     Column      |           Type           | Collation | Nullable |                  Default                  
-----------------+--------------------------+-----------+----------+-------------------------------------------
 id              | integer                  |           | not null | nextval('quiz_attempts_id_seq'::regclass)
 user_id         | integer                  |           | not null | 
 module_id       | integer                  |           | not null | 
 attempt_number  | integer                  |           | not null | 
 score           | integer                  |           | not null | 
 total_questions | integer                  |           | not null | 
 passed          | boolean                  |           | not null | 
 answers         | jsonb                    |           |          | 
 attempted_at    | timestamp with time zone |           |          | now()
Indexes:
    "quiz_attempts_pkey" PRIMARY KEY, btree (id)
    "idx_quiz_attempts_module" btree (module_id)
    "idx_quiz_attempts_user" btree (user_id)
    "idx_quiz_user_module" btree (user_id, module_id)
Foreign-key constraints:
    "quiz_attempts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

```

**Row Count:**
```
 row_count 
-----------
         0
(1 row)

```

### Table: `user_progress`

```
                                           Table "public.user_progress"
       Column        |           Type           | Collation | Nullable |                  Default                  
---------------------+--------------------------+-----------+----------+-------------------------------------------
 id                  | integer                  |           | not null | nextval('user_progress_id_seq'::regclass)
 user_id             | integer                  |           | not null | 
 module_id           | integer                  |           | not null | 
 status              | character varying(20)    |           |          | 'not_started'::character varying
 progress_percentage | integer                  |           |          | 0
 started_at          | timestamp with time zone |           |          | 
 completed_at        | timestamp with time zone |           |          | 
 time_spent_minutes  | integer                  |           |          | 0
 last_activity_at    | timestamp with time zone |           |          | 
 evidence_submitted  | jsonb                    |           |          | 
Indexes:
    "user_progress_pkey" PRIMARY KEY, btree (id)
    "idx_progress_module" btree (module_id)
    "idx_progress_status" btree (status)
    "idx_progress_user" btree (user_id)
    "idx_user_progress_module" btree (module_id)
    "idx_user_progress_status" btree (status)
    "idx_user_progress_user" btree (user_id)
    "user_progress_user_id_module_id_key" UNIQUE CONSTRAINT, btree (user_id, module_id)
Foreign-key constraints:
    "user_progress_module_id_fkey" FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    "user_progress_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

```

**Row Count:**
```
 row_count 
-----------
         0
(1 row)

```

### Table: `enrollment_history`

```
                                         Table "public.enrollment_history"
    Column    |            Type             | Collation | Nullable |                    Default                     
--------------+-----------------------------+-----------+----------+------------------------------------------------
 id           | integer                     |           | not null | nextval('enrollment_history_id_seq'::regclass)
 user_id      | integer                     |           |          | 
 action       | character varying(50)       |           | not null | 
 performed_by | integer                     |           |          | 
 metadata     | jsonb                       |           |          | 
 created_at   | timestamp without time zone |           |          | now()
Indexes:
    "enrollment_history_pkey" PRIMARY KEY, btree (id)
    "idx_enrollment_history_action" btree (action)
    "idx_enrollment_history_user_id" btree (user_id)
Foreign-key constraints:
    "enrollment_history_performed_by_fkey" FOREIGN KEY (performed_by) REFERENCES admin_users(id)
    "enrollment_history_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

```

**Row Count:**
```
 row_count 
-----------
         1
(1 row)

```

### Table: `chat_history`

```
Did not find any relation named "chat_history".
Table not found
```

**Row Count:**
```
ERROR:  relation "chat_history" does not exist
LINE 1: SELECT COUNT(*) as row_count FROM chat_history;
                                          ^
Cannot count rows
```

### Table: `conversation_context`

```
Did not find any relation named "conversation_context".
Table not found
```

**Row Count:**
```
ERROR:  relation "conversation_context" does not exist
LINE 1: SELECT COUNT(*) as row_count FROM conversation_context;
                                          ^
Cannot count rows
```

### Table: `course_content`

```
                                          Table "public.course_content"
      Column       |           Type           | Collation | Nullable |                  Default                   
-------------------+--------------------------+-----------+----------+--------------------------------------------
 id                | integer                  |           | not null | nextval('course_content_id_seq'::regclass)
 course_id         | integer                  |           | not null | 
 file_name         | character varying(500)   |           | not null | 
 original_name     | character varying(500)   |           | not null | 
 file_path         | text                     |           | not null | 
 file_type         | character varying(100)   |           |          | 
 file_size         | bigint                   |           |          | 
 uploaded_by       | integer                  |           |          | 
 uploaded_at       | timestamp with time zone |           |          | now()
 processed         | boolean                  |           |          | false
 processing_status | character varying(50)    |           |          | 'uploaded'::character varying
 processed_at      | timestamp with time zone |           |          | 
 chunk_count       | integer                  |           |          | 0
 error_message     | text                     |           |          | 
 metadata          | jsonb                    |           |          | '{}'::jsonb
 created_at        | timestamp with time zone |           |          | now()
 updated_at        | timestamp with time zone |           |          | now()
Indexes:
    "course_content_pkey" PRIMARY KEY, btree (id)
    "idx_course_content_course_id" btree (course_id)
    "idx_course_content_metadata" gin (metadata)
    "idx_course_content_processed" btree (processed)
    "idx_course_content_status" btree (processing_status)
    "idx_course_content_uploaded_at" btree (uploaded_at DESC)
Foreign-key constraints:
    "course_content_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    "course_content_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES admin_users(id)

```

**Row Count:**
```
 row_count 
-----------
        15
(1 row)

```

### Table: `whatsapp_messages`

```
                                           Table "public.whatsapp_messages"
       Column       |           Type           | Collation | Nullable |                    Default                    
--------------------+--------------------------+-----------+----------+-----------------------------------------------
 id                 | integer                  |           | not null | nextval('whatsapp_messages_id_seq'::regclass)
 user_id            | integer                  |           |          | 
 whatsapp_id        | character varying(20)    |           | not null | 
 direction          | character varying(10)    |           | not null | 
 message_type       | character varying(20)    |           |          | 'text'::character varying
 message_content    | text                     |           |          | 
 twilio_message_sid | character varying(100)   |           |          | 
 status             | character varying(20)    |           |          | 
 metadata           | jsonb                    |           |          | '{}'::jsonb
 created_at         | timestamp with time zone |           |          | now()
Indexes:
    "whatsapp_messages_pkey" PRIMARY KEY, btree (id)
    "idx_whatsapp_messages_created" btree (created_at DESC)
    "idx_whatsapp_messages_user" btree (user_id)
    "idx_whatsapp_messages_whatsapp_id" btree (whatsapp_id)
Foreign-key constraints:
    "whatsapp_messages_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL

```

**Row Count:**
```
 row_count 
-----------
         0
(1 row)

```

## 3. Foreign Key Relationships

```
       table_name       |    column_name    | foreign_table_name | foreign_column_name 
------------------------+-------------------+--------------------+---------------------
 chat_messages          | module_id         | modules            | id
 chat_messages          | session_id        | chat_sessions      | id
 chat_messages          | user_id           | users              | id
 chat_sessions          | course_id         | courses            | id
 chat_sessions          | module_id         | modules            | id
 chat_sessions          | user_id           | users              | id
 classification_history | course_id         | courses            | id
 classification_temp    | course_id         | courses            | id
 coaching_events        | user_id           | users              | id
 coaching_nudges        | user_id           | users              | id
 content_moderation_log | user_id           | users              | id
 course_content         | course_id         | courses            | id
 course_content         | uploaded_by       | admin_users        | id
 course_enrollments     | course_id         | courses            | id
 course_enrollments     | current_module_id | modules            | id
 course_enrollments     | user_id           | users              | id
 enrollment_history     | performed_by      | admin_users        | id
 enrollment_history     | user_id           | users              | id
 learning_interactions  | moodle_module_id  | modules            | id
 learning_interactions  | user_id           | users              | id
 module_content         | module_id         | modules            | id
 module_content         | uploaded_by       | admin_users        | id
 modules                | course_id         | courses            | id
 nudges                 | user_id           | users              | id
 prompt_injection_log   | user_id           | users              | id
 quiz_attempts          | user_id           | users              | id
 quiz_questions         | module_id         | modules            | id
 quizzes                | module_id         | modules            | id
 reflection_reminders   | user_id           | users              | id
 reflections            | module_id         | modules            | id
 reflections            | user_id           | users              | id
 sessions               | user_id           | users              | id
 system_events          | admin_user_id     | admin_users        | id
 system_events          | user_id           | users              | id
 user_progress          | module_id         | modules            | id
 user_progress          | user_id           | users              | id
 users                  | enrolled_by       | admin_users        | id
 whatsapp_messages      | user_id           | users              | id
(38 rows)

```

## 4. Indexes

```
       tablename        |                  indexname                   |                                                                                 indexdef                                                                                 
------------------------+----------------------------------------------+--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 admin_users            | admin_users_email_key                        | CREATE UNIQUE INDEX admin_users_email_key ON public.admin_users USING btree (email)
 admin_users            | admin_users_pkey                             | CREATE UNIQUE INDEX admin_users_pkey ON public.admin_users USING btree (id)
 admin_users            | idx_admin_email                              | CREATE INDEX idx_admin_email ON public.admin_users USING btree (email)
 admin_users            | idx_admin_users_email                        | CREATE INDEX idx_admin_users_email ON public.admin_users USING btree (email)
 admin_users            | idx_admin_users_role                         | CREATE INDEX idx_admin_users_role ON public.admin_users USING btree (role)
 chat_messages          | chat_messages_pkey                           | CREATE UNIQUE INDEX chat_messages_pkey ON public.chat_messages USING btree (id)
 chat_messages          | idx_chat_messages_created                    | CREATE INDEX idx_chat_messages_created ON public.chat_messages USING btree (created_at DESC)
 chat_messages          | idx_chat_messages_session                    | CREATE INDEX idx_chat_messages_session ON public.chat_messages USING btree (session_id)
 chat_messages          | idx_chat_messages_user                       | CREATE INDEX idx_chat_messages_user ON public.chat_messages USING btree (user_id)
 chat_sessions          | chat_sessions_pkey                           | CREATE UNIQUE INDEX chat_sessions_pkey ON public.chat_sessions USING btree (id)
 chat_sessions          | idx_chat_sessions_active                     | CREATE INDEX idx_chat_sessions_active ON public.chat_sessions USING btree (is_active)
 chat_sessions          | idx_chat_sessions_module                     | CREATE INDEX idx_chat_sessions_module ON public.chat_sessions USING btree (module_id)
 chat_sessions          | idx_chat_sessions_user                       | CREATE INDEX idx_chat_sessions_user ON public.chat_sessions USING btree (user_id)
 classification_history | classification_history_pkey                  | CREATE UNIQUE INDEX classification_history_pkey ON public.classification_history USING btree (id)
 classification_history | idx_classification_history_admin             | CREATE INDEX idx_classification_history_admin ON public.classification_history USING btree (admin_user_id, created_at DESC)
 classification_history | idx_classification_history_course            | CREATE INDEX idx_classification_history_course ON public.classification_history USING btree (course_id, created_at DESC)
 classification_temp    | classification_temp_pkey                     | CREATE UNIQUE INDEX classification_temp_pkey ON public.classification_temp USING btree (id)
 classification_temp    | idx_classification_temp_course               | CREATE INDEX idx_classification_temp_course ON public.classification_temp USING btree (course_id)
 classification_temp    | idx_classification_temp_expires              | CREATE INDEX idx_classification_temp_expires ON public.classification_temp USING btree (expires_at) WHERE (NOT processed)
 coaching_events        | coaching_events_pkey                         | CREATE UNIQUE INDEX coaching_events_pkey ON public.coaching_events USING btree (id)
 coaching_events        | idx_coaching_events_type                     | CREATE INDEX idx_coaching_events_type ON public.coaching_events USING btree (event_type)
 coaching_events        | idx_coaching_events_user_id                  | CREATE INDEX idx_coaching_events_user_id ON public.coaching_events USING btree (user_id)
 coaching_events        | idx_coaching_user                            | CREATE INDEX idx_coaching_user ON public.coaching_events USING btree (user_id, sent_at)
 coaching_nudges        | coaching_nudges_pkey                         | CREATE UNIQUE INDEX coaching_nudges_pkey ON public.coaching_nudges USING btree (id)
 coaching_nudges        | idx_coaching_nudges_sent                     | CREATE INDEX idx_coaching_nudges_sent ON public.coaching_nudges USING btree (sent_at DESC)
 coaching_nudges        | idx_coaching_nudges_type                     | CREATE INDEX idx_coaching_nudges_type ON public.coaching_nudges USING btree (nudge_type)
 coaching_nudges        | idx_coaching_nudges_user                     | CREATE INDEX idx_coaching_nudges_user ON public.coaching_nudges USING btree (user_id)
 content_moderation_log | content_moderation_log_pkey                  | CREATE UNIQUE INDEX content_moderation_log_pkey ON public.content_moderation_log USING btree (id)
 content_moderation_log | idx_moderation_log_blocked                   | CREATE INDEX idx_moderation_log_blocked ON public.content_moderation_log USING btree (blocked)
 content_moderation_log | idx_moderation_log_created                   | CREATE INDEX idx_moderation_log_created ON public.content_moderation_log USING btree (created_at DESC)
 content_moderation_log | idx_moderation_log_user                      | CREATE INDEX idx_moderation_log_user ON public.content_moderation_log USING btree (user_id)
 course_content         | course_content_pkey                          | CREATE UNIQUE INDEX course_content_pkey ON public.course_content USING btree (id)
 course_content         | idx_course_content_course_id                 | CREATE INDEX idx_course_content_course_id ON public.course_content USING btree (course_id)
 course_content         | idx_course_content_metadata                  | CREATE INDEX idx_course_content_metadata ON public.course_content USING gin (metadata)
 course_content         | idx_course_content_processed                 | CREATE INDEX idx_course_content_processed ON public.course_content USING btree (processed)
 course_content         | idx_course_content_status                    | CREATE INDEX idx_course_content_status ON public.course_content USING btree (processing_status)
 course_content         | idx_course_content_uploaded_at               | CREATE INDEX idx_course_content_uploaded_at ON public.course_content USING btree (uploaded_at DESC)
 course_enrollments     | course_enrollments_pkey                      | CREATE UNIQUE INDEX course_enrollments_pkey ON public.course_enrollments USING btree (id)
 course_enrollments     | course_enrollments_user_id_course_id_key     | CREATE UNIQUE INDEX course_enrollments_user_id_course_id_key ON public.course_enrollments USING btree (user_id, course_id)
 course_enrollments     | idx_enrollments_active                       | CREATE INDEX idx_enrollments_active ON public.course_enrollments USING btree (is_active)
 course_enrollments     | idx_enrollments_course                       | CREATE INDEX idx_enrollments_course ON public.course_enrollments USING btree (course_id)
 course_enrollments     | idx_enrollments_user                         | CREATE INDEX idx_enrollments_user ON public.course_enrollments USING btree (user_id)
 courses                | courses_code_key                             | CREATE UNIQUE INDEX courses_code_key ON public.courses USING btree (code)
 courses                | courses_pkey                                 | CREATE UNIQUE INDEX courses_pkey ON public.courses USING btree (id)
 courses                | idx_courses_active                           | CREATE INDEX idx_courses_active ON public.courses USING btree (is_active)
 courses                | idx_courses_category                         | CREATE INDEX idx_courses_category ON public.courses USING btree (category)
 courses                | idx_courses_code                             | CREATE INDEX idx_courses_code ON public.courses USING btree (code)
 courses                | idx_courses_sequence                         | CREATE INDEX idx_courses_sequence ON public.courses USING btree (sequence_order)
 enrollment_history     | enrollment_history_pkey                      | CREATE UNIQUE INDEX enrollment_history_pkey ON public.enrollment_history USING btree (id)
 enrollment_history     | idx_enrollment_history_action                | CREATE INDEX idx_enrollment_history_action ON public.enrollment_history USING btree (action)
 enrollment_history     | idx_enrollment_history_user_id               | CREATE INDEX idx_enrollment_history_user_id ON public.enrollment_history USING btree (user_id)
 learning_interactions  | idx_learning_interactions_created_at         | CREATE INDEX idx_learning_interactions_created_at ON public.learning_interactions USING btree (created_at DESC)
 learning_interactions  | idx_learning_interactions_module_id          | CREATE INDEX idx_learning_interactions_module_id ON public.learning_interactions USING btree (moodle_module_id)
 learning_interactions  | idx_learning_interactions_type               | CREATE INDEX idx_learning_interactions_type ON public.learning_interactions USING btree (interaction_type)
 learning_interactions  | idx_learning_interactions_user_id            | CREATE INDEX idx_learning_interactions_user_id ON public.learning_interactions USING btree (user_id)
 learning_interactions  | learning_interactions_pkey                   | CREATE UNIQUE INDEX learning_interactions_pkey ON public.learning_interactions USING btree (id)
 module_content         | idx_content_module                           | CREATE INDEX idx_content_module ON public.module_content USING btree (module_id)
 module_content         | idx_content_processed                        | CREATE INDEX idx_content_processed ON public.module_content USING btree (processed)
 module_content         | idx_module_content_classification_confidence | CREATE INDEX idx_module_content_classification_confidence ON public.module_content USING btree (classification_confidence) WHERE (classification_confidence IS NOT NULL)
 module_content         | idx_module_content_classification_topics     | CREATE INDEX idx_module_content_classification_topics ON public.module_content USING gin (classification_topics) WHERE (classification_topics IS NOT NULL)
 module_content         | module_content_pkey                          | CREATE UNIQUE INDEX module_content_pkey ON public.module_content USING btree (id)
 modules                | idx_modules_active                           | CREATE INDEX idx_modules_active ON public.modules USING btree (is_active)
 modules                | idx_modules_course                           | CREATE INDEX idx_modules_course ON public.modules USING btree (course_id)
 modules                | idx_modules_learning_level                   | CREATE INDEX idx_modules_learning_level ON public.modules USING btree (learning_level)
 modules                | idx_modules_sequence                         | CREATE INDEX idx_modules_sequence ON public.modules USING btree (sequence_order)
 modules                | modules_pkey                                 | CREATE UNIQUE INDEX modules_pkey ON public.modules USING btree (id)
 nudges                 | idx_nudges_responded                         | CREATE INDEX idx_nudges_responded ON public.nudges USING btree (responded_at) WHERE (responded_at IS NOT NULL)
 nudges                 | idx_nudges_sent_at                           | CREATE INDEX idx_nudges_sent_at ON public.nudges USING btree (sent_at DESC)
 nudges                 | idx_nudges_type                              | CREATE INDEX idx_nudges_type ON public.nudges USING btree (nudge_type)
 nudges                 | idx_nudges_user_id                           | CREATE INDEX idx_nudges_user_id ON public.nudges USING btree (user_id)
 nudges                 | nudges_pkey                                  | CREATE UNIQUE INDEX nudges_pkey ON public.nudges USING btree (id)
 prompt_injection_log   | idx_injection_log_created                    | CREATE INDEX idx_injection_log_created ON public.prompt_injection_log USING btree (created_at DESC)
 prompt_injection_log   | idx_injection_log_user                       | CREATE INDEX idx_injection_log_user ON public.prompt_injection_log USING btree (user_id)
 prompt_injection_log   | prompt_injection_log_pkey                    | CREATE UNIQUE INDEX prompt_injection_log_pkey ON public.prompt_injection_log USING btree (id)
 quiz_attempts          | idx_quiz_attempts_module                     | CREATE INDEX idx_quiz_attempts_module ON public.quiz_attempts USING btree (module_id)
 quiz_attempts          | idx_quiz_attempts_user                       | CREATE INDEX idx_quiz_attempts_user ON public.quiz_attempts USING btree (user_id)
 quiz_attempts          | idx_quiz_user_module                         | CREATE INDEX idx_quiz_user_module ON public.quiz_attempts USING btree (user_id, module_id)
 quiz_attempts          | quiz_attempts_pkey                           | CREATE UNIQUE INDEX quiz_attempts_pkey ON public.quiz_attempts USING btree (id)
 quiz_questions         | idx_quiz_questions_module                    | CREATE INDEX idx_quiz_questions_module ON public.quiz_questions USING btree (module_id)
 quiz_questions         | idx_quiz_questions_quiz                      | CREATE INDEX idx_quiz_questions_quiz ON public.quiz_questions USING btree (quiz_id)
 quiz_questions         | quiz_questions_pkey                          | CREATE UNIQUE INDEX quiz_questions_pkey ON public.quiz_questions USING btree (id)
 quizzes                | idx_quizzes_active                           | CREATE INDEX idx_quizzes_active ON public.quizzes USING btree (is_active)
 quizzes                | idx_quizzes_module                           | CREATE INDEX idx_quizzes_module ON public.quizzes USING btree (module_id)
 quizzes                | quizzes_pkey                                 | CREATE UNIQUE INDEX quizzes_pkey ON public.quizzes USING btree (id)
 reflection_reminders   | idx_reflection_reminders_active              | CREATE INDEX idx_reflection_reminders_active ON public.reflection_reminders USING btree (active)
 reflection_reminders   | idx_reflection_reminders_next                | CREATE INDEX idx_reflection_reminders_next ON public.reflection_reminders USING btree (next_reminder_at) WHERE (active = true)
 reflection_reminders   | idx_reflection_reminders_user_id             | CREATE INDEX idx_reflection_reminders_user_id ON public.reflection_reminders USING btree (user_id)
 reflection_reminders   | reflection_reminders_pkey                    | CREATE UNIQUE INDEX reflection_reminders_pkey ON public.reflection_reminders USING btree (id)
 reflections            | idx_reflections_created_at                   | CREATE INDEX idx_reflections_created_at ON public.reflections USING btree (created_at DESC)
 reflections            | idx_reflections_depth                        | CREATE INDEX idx_reflections_depth ON public.reflections USING btree (depth_level)
 reflections            | idx_reflections_module_id                    | CREATE INDEX idx_reflections_module_id ON public.reflections USING btree (module_id)
 reflections            | idx_reflections_type                         | CREATE INDEX idx_reflections_type ON public.reflections USING btree (reflection_type)
 reflections            | idx_reflections_user_id                      | CREATE INDEX idx_reflections_user_id ON public.reflections USING btree (user_id)
 reflections            | reflections_pkey                             | CREATE UNIQUE INDEX reflections_pkey ON public.reflections USING btree (id)
 sessions               | idx_sessions_expiry                          | CREATE INDEX idx_sessions_expiry ON public.sessions USING btree (expires_at)
 sessions               | idx_sessions_user                            | CREATE INDEX idx_sessions_user ON public.sessions USING btree (user_id, is_active)
 sessions               | sessions_pkey                                | CREATE UNIQUE INDEX sessions_pkey ON public.sessions USING btree (id)
 system_events          | idx_system_events_created                    | CREATE INDEX idx_system_events_created ON public.system_events USING btree (created_at DESC)
 system_events          | idx_system_events_type                       | CREATE INDEX idx_system_events_type ON public.system_events USING btree (event_type)
 system_events          | system_events_pkey                           | CREATE UNIQUE INDEX system_events_pkey ON public.system_events USING btree (id)
 user_progress          | idx_progress_module                          | CREATE INDEX idx_progress_module ON public.user_progress USING btree (module_id)
 user_progress          | idx_progress_status                          | CREATE INDEX idx_progress_status ON public.user_progress USING btree (status)
 user_progress          | idx_progress_user                            | CREATE INDEX idx_progress_user ON public.user_progress USING btree (user_id)
 user_progress          | idx_user_progress_module                     | CREATE INDEX idx_user_progress_module ON public.user_progress USING btree (module_id)
 user_progress          | idx_user_progress_status                     | CREATE INDEX idx_user_progress_status ON public.user_progress USING btree (status)
 user_progress          | idx_user_progress_user                       | CREATE INDEX idx_user_progress_user ON public.user_progress USING btree (user_id)
 user_progress          | user_progress_pkey                           | CREATE UNIQUE INDEX user_progress_pkey ON public.user_progress USING btree (id)
 user_progress          | user_progress_user_id_module_id_key          | CREATE UNIQUE INDEX user_progress_user_id_module_id_key ON public.user_progress USING btree (user_id, module_id)
 users                  | idx_users_active                             | CREATE INDEX idx_users_active ON public.users USING btree (is_active, last_active_at)
 users                  | idx_users_enrollment_status                  | CREATE INDEX idx_users_enrollment_status ON public.users USING btree (enrollment_status)
 users                  | idx_users_metadata                           | CREATE INDEX idx_users_metadata ON public.users USING gin (metadata)
 users                  | idx_users_whatsapp                           | CREATE INDEX idx_users_whatsapp ON public.users USING btree (whatsapp_id)
 users                  | users_pkey                                   | CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)
 users                  | users_whatsapp_id_key                        | CREATE UNIQUE INDEX users_whatsapp_id_key ON public.users USING btree (whatsapp_id)
 verification_codes     | idx_verification_code                        | CREATE INDEX idx_verification_code ON public.verification_codes USING btree (code)
 verification_codes     | idx_verification_whatsapp                    | CREATE INDEX idx_verification_whatsapp ON public.verification_codes USING btree (whatsapp_id)
 verification_codes     | verification_codes_pkey                      | CREATE UNIQUE INDEX verification_codes_pkey ON public.verification_codes USING btree (id)
 whatsapp_messages      | idx_whatsapp_messages_created                | CREATE INDEX idx_whatsapp_messages_created ON public.whatsapp_messages USING btree (created_at DESC)
 whatsapp_messages      | idx_whatsapp_messages_user                   | CREATE INDEX idx_whatsapp_messages_user ON public.whatsapp_messages USING btree (user_id)
 whatsapp_messages      | idx_whatsapp_messages_whatsapp_id            | CREATE INDEX idx_whatsapp_messages_whatsapp_id ON public.whatsapp_messages USING btree (whatsapp_id)
 whatsapp_messages      | whatsapp_messages_pkey                       | CREATE UNIQUE INDEX whatsapp_messages_pkey ON public.whatsapp_messages USING btree (id)
(121 rows)

```
