# Admin Portal Guide - Teachers Training System

## Overview
This guide explains how to use the admin portal to manage training modules, upload content, and track user progress.

## Getting Started

### 1. Access the Admin Portal
Navigate to: `http://localhost:3000/admin/login.html`

### 2. Login Credentials
Default admin credentials (from database seed):
- **Email**: `admin@school.edu`
- **Password**: `Admin123!`

Other test accounts:
- `principal@lincoln.edu` / `Admin123!` (admin)
- `supervisor@training.edu` / `Admin123!` (admin)

## Features

### Module Management (`/admin/modules.html`)

#### View All Modules
- See all 5 training modules
- View content file count and chunk count per module
- Modules are displayed in sequence order

#### Upload Content to a Module

**Option 1: Single File Upload**
1. Click "Upload Content" on any module card
2. Click the upload area or drag & drop a file
3. Supported formats: `.txt`, `.pdf`, `.docx`
4. Max file size: 10MB
5. File will be processed automatically in the background

**Option 2: Bulk Upload**
1. Click "Bulk Upload" button in header
2. All files from `training-content/` directory will be uploaded
3. Files must follow naming convention: `module{N}_*.{txt|pdf|docx}`
   - Example: `module1_introduction_to_teaching.txt`

**Option 3: Using Script**
```bash
node scripts/bulk-upload-content.js
```

#### View Module Content
1. Click "View Content" on any module card
2. See all uploaded files for that module
3. View processing status:
   - ✅ **Processed**: Text extracted, chunked, and embedded in ChromaDB
   - ⚠️ **Processing**: Currently being processed (may take 1-2 minutes)

#### Delete Content
1. Click "View Content" on a module
2. Click "Delete" button next to any file
3. Confirm deletion
4. File will be removed from:
   - Database
   - File system
   - ChromaDB (embeddings)

### User Progress Tracking (`/admin/users.html`)

#### View All Users
- List of all WhatsApp users
- Summary statistics per user:
  - Modules completed
  - Modules in progress
  - Quizzes passed
  - Total time spent
  - Last activity date

#### Search Users
- Use search box to filter by name or WhatsApp number
- Real-time filtering

#### View User Details
1. Click on any user row
2. Modal shows:
   - **Overview Stats**: Completed modules, in-progress, quizzes passed, time spent
   - **Module Progress**: Detailed breakdown per module
     - Status (Not Started, In Progress, Completed)
     - Progress percentage
     - Time spent per module
     - Last activity
     - Quiz attempts with scores

#### Module Status Indicators
- ✅ **Completed**: Module finished
- 🔄 **In Progress**: Currently working on module
- ⚪ **Not Started**: Haven't begun module

## Training Modules

### Module 1: Introduction to Teaching
Foundational concepts and principles of effective teaching

### Module 2: Classroom Management
Strategies for creating and maintaining positive learning environments

### Module 3: Lesson Planning
Designing effective, engaging, and standards-aligned lessons

### Module 4: Assessment Strategies
Formative and summative assessment techniques

### Module 5: Technology in Education
Integrating educational technology effectively

## Content Files

All 5 module content files are available in `training-content/`:

```
training-content/
├── module1_introduction_to_teaching.txt
├── module2_classroom_management.txt
├── module3_lesson_planning.txt
├── module4_assessment_strategies.txt
└── module5_technology_in_education.txt
```

## How Content Processing Works

1. **Upload**: File is saved to `uploads/` directory
2. **Text Extraction**:
   - `.txt` files: Read directly
   - `.pdf` files: Extracted using pdf-parse
   - `.docx` files: Extracted using document-processor
3. **Chunking**: Text split into 512-1024 token chunks
4. **Embedding Generation**: Each chunk sent to Vertex AI for embedding
5. **Storage**: Embeddings stored in ChromaDB with metadata:
   - module_id
   - module_title
   - file_name
   - chunk_index
   - upload timestamp

## API Endpoints

### Modules
- `GET /api/admin/modules` - List all modules
- `GET /api/admin/modules/:id` - Get module by ID
- `GET /api/admin/modules/:id/content` - Get module content files

### Content Upload
- `POST /api/admin/modules/:id/content` - Upload file (multipart/form-data)
- `DELETE /api/admin/content/:id` - Delete content file

### Users
- `GET /api/admin/users` - List all users with progress summary
- `GET /api/admin/users/:id/progress` - Get detailed user progress

### Bulk Operations
- `POST /api/admin/bulk-upload` - Upload all files from training-content/

## Database Tables

### modules
Stores training module information
- id, title, description, sequence_order

### module_content
Tracks uploaded content files
- id, module_id, file_name, file_path, processed, chunk_count

### user_progress
Tracks user progress per module
- user_id, module_id, status, progress_percentage, time_spent_minutes

### quiz_attempts
Records quiz attempts
- user_id, module_id, attempt_number, score, passed

## Troubleshooting

### Content Not Processing
1. Check server logs for errors
2. Verify file format is supported
3. Ensure Vertex AI credentials are configured
4. Check ChromaDB connection

### Users Not Showing Progress
1. Verify user has interacted via WhatsApp
2. Check user_progress table in database
3. Ensure session tracking is working

### Upload Fails
1. Check file size (max 10MB)
2. Verify file format (.txt, .pdf, .docx only)
3. Check uploads/ directory exists and is writable
4. Review server logs for errors

## Environment Variables

Required for content management:

```env
# ChromaDB
CHROMA_DB_PATH=./chroma_db
CHROMA_COLLECTION_NAME=teacher_training

# Vertex AI
VERTEX_AI_PROJECT_ID=your-project-id
VERTEX_AI_LOCATION=us-central1

# Upload Settings
UPLOAD_MAX_SIZE=10485760
CONTENT_CHUNK_SIZE=1000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/teachers_training
```

## Best Practices

1. **Content Organization**: Use descriptive filenames with module numbers
2. **Regular Backups**: Backup database and ChromaDB regularly
3. **Monitor Processing**: Check logs after bulk uploads
4. **User Privacy**: Don't share user progress data externally
5. **Content Quality**: Review content before uploading to ensure accuracy

## Support

For issues or questions:
- Check server logs: `logs/`
- Review database: PostgreSQL admin tool
- Inspect ChromaDB: Check collection metadata
- Contact system administrator

---

*Last Updated: 2025-10-02*
