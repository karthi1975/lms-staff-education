# SQL Migrations Verification Report
**Generated**: Wed Oct 29 05:50:19 MDT 2025

## 1. Available Migration Files

### Main Database Migrations
```
-rw-r--r--@ 1 karthi  staff   1.2K Oct 15 07:56 /Users/karthi/business/staff_education/teachers_training/database/fix_conversation_context.sql
-rw-r--r--@ 1 karthi  staff   7.3K Oct 14 16:32 /Users/karthi/business/staff_education/teachers_training/database/init.sql
-rw-r--r--@ 1 karthi  staff   661B Oct  5 08:58 /Users/karthi/business/staff_education/teachers_training/database/migration_002_moodle_integration.sql
-rw-r--r--@ 1 karthi  staff    12K Oct  6 12:33 /Users/karthi/business/staff_education/teachers_training/database/migration_003_simplified_moodle.sql
-rw-r--r--@ 1 karthi  staff   5.5K Oct 13 13:12 /Users/karthi/business/staff_education/teachers_training/database/migration_004_add_courses_table.sql
-rw-r--r--@ 1 karthi  staff    14K Oct 15 07:47 /Users/karthi/business/staff_education/teachers_training/database/migration_005_complete_lms.sql
-rw-r--r--@ 1 karthi  staff   9.5K Oct 15 15:55 /Users/karthi/business/staff_education/teachers_training/database/migration_006_business_studies_f2.sql
-rw-r--r--@ 1 karthi  staff   1.7K Oct 28 18:17 /Users/karthi/business/staff_education/teachers_training/database/migration_007_fix_quiz_schema.sql
-rw-r--r--@ 1 karthi  staff   7.6K Oct 28 18:17 /Users/karthi/business/staff_education/teachers_training/database/migration_008_quiz_completion_tracking.sql
-rw-r--r--@ 1 karthi  staff    12K Oct  3 14:41 /Users/karthi/business/staff_education/teachers_training/database/quiz-questions.sql
-rw-r--r--@ 1 karthi  staff   8.5K Oct 15 16:12 /Users/karthi/business/staff_education/teachers_training/database/seed_business_studies_questions.sql
```

### Database Migrations Folder
```
-rw-r--r--@ 1 karthi  staff   2.0K Oct 28 18:17 /Users/karthi/business/staff_education/teachers_training/database/migrations/001_create_base_schema.sql
-rw-r--r--@ 1 karthi  staff   1.7K Oct 16 22:58 /Users/karthi/business/staff_education/teachers_training/database/migrations/004_create_learning_interactions.sql
-rw-r--r--@ 1 karthi  staff   8.9K Oct 28 18:17 /Users/karthi/business/staff_education/teachers_training/database/migrations/005_add_classification_support.sql
-rw-r--r--@ 1 karthi  staff   2.1K Oct 16 12:54 /Users/karthi/business/staff_education/teachers_training/database/migrations/007_pin_enrollment_system.sql
-rw-r--r--@ 1 karthi  staff   9.7K Oct 28 18:17 /Users/karthi/business/staff_education/teachers_training/database/migrations/008_coaching_nudges_reflections.sql
```

### Migrations Folder (Root)
```
-rw-r--r--@ 1 karthi  staff   2.5K Oct  7 17:29 /Users/karthi/business/staff_education/teachers_training/migrations/002_add_source_columns.sql
-rw-r--r--@ 1 karthi  staff   1.6K Oct  8 10:51 /Users/karthi/business/staff_education/teachers_training/migrations/003_add_moodle_settings.sql
-rw-r--r--@ 1 karthi  staff   2.6K Oct 13 10:35 /Users/karthi/business/staff_education/teachers_training/migrations/004_add_chat_history.sql
-rw-r--r--@ 1 karthi  staff   2.6K Oct 28 18:17 /Users/karthi/business/staff_education/teachers_training/migrations/009_content_moderation_log.sql
-rw-r--r--@ 1 karthi  staff   2.1K Oct 28 18:17 /Users/karthi/business/staff_education/teachers_training/migrations/010_add_injection_logging.sql
-rw-r--r--@ 1 karthi  staff    19K Oct 28 21:01 /Users/karthi/business/staff_education/teachers_training/migrations/complete_database_setup.sql
-rw-r--r--@ 1 karthi  staff   1.9K Oct 28 18:17 /Users/karthi/business/staff_education/teachers_training/migrations/create_course_content_table.sql
-rw-r--r--@ 1 karthi  staff   750B Oct 28 18:17 /Users/karthi/business/staff_education/teachers_training/migrations/fix-uploaded-by-constraint.sql
```

## 2. Current Database Tables (GCP)

```
       table_name       | column_count 
------------------------+--------------
 admin_users            |           10
 chat_messages          |            9
 chat_sessions          |            8
 classification_history |           12
 classification_temp    |            9
 coaching_events        |            7
 coaching_nudges        |            8
 content_moderation_log |            9
 course_content         |           17
 course_enrollments     |            9
 courses                |           12
 enrollment_history     |            6
 learning_interactions  |            8
 module_content         |           18
 modules                |           12
 nudges                 |            9
 prompt_injection_log   |            9
 quiz_attempts          |            9
 quiz_questions         |           10
 quizzes                |           10
 reflection_reminders   |            7
 reflections            |           14
 sessions               |            8
 system_events          |            6
 user_progress          |           10
 users                  |           16
 verification_codes     |            9
 whatsapp_messages      |           10
(28 rows)

```

## 3. Critical Tables Verification

### Table: `users`
- **Status**: ✅ Exists
- **Columns**: 16
- **Rows**: 2

### Table: `admin_users`
- **Status**: ✅ Exists
- **Columns**: 10
- **Rows**: 1

### Table: `courses`
- **Status**: ✅ Exists
- **Columns**: 12
- **Rows**: 1

### Table: `modules`
- **Status**: ✅ Exists
- **Columns**: 12
- **Rows**: 5

### Table: `quizzes`
- **Status**: ✅ Exists
- **Columns**: 10
- **Rows**: 5

### Table: `quiz_questions`
- **Status**: ✅ Exists
- **Columns**: 10
- **Rows**: 25

### Table: `quiz_attempts`
- **Status**: ✅ Exists
- **Columns**: 9
- **Rows**: 0

### Table: `user_progress`
- **Status**: ✅ Exists
- **Columns**: 10
- **Rows**: 0

### Table: `enrollment_history`
- **Status**: ✅ Exists
- **Columns**: 6
- **Rows**: 2

### Table: `chat_history`
- **Status**: ❌ Missing

### Table: `conversation_context`
- **Status**: ❌ Missing

### Table: `course_content`
- **Status**: ✅ Exists
- **Columns**: 17
- **Rows**: 15

## 4. Enrollment System Columns Check

Verifying all enrollment columns exist in users table:
```
    column_name    |          data_type          | is_nullable |        column_default        
-------------------+-----------------------------+-------------+------------------------------
 enrolled_at       | timestamp without time zone | YES         | 
 enrolled_by       | integer                     | YES         | 
 enrollment_pin    | character varying           | YES         | 
 enrollment_status | character varying           | YES         | 'pending'::character varying
 is_verified       | boolean                     | YES         | false
 pin_attempts      | integer                     | YES         | 3
 pin_expires_at    | timestamp without time zone | YES         | 
(7 rows)

```

## 5. Quiz System Columns Check

Verifying quiz_questions columns match code expectations:
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

## 6. Recommendations

Based on verification:

⚠️  **2 critical tables are missing** - Run missing migrations
