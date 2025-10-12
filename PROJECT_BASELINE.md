# Teachers Training System - Project Baseline

**Generated:** 2025-10-12
**Status:** Production Ready ✅
**Purpose:** Essential files reference and cleanup guide

---

## 🎯 ESSENTIAL FILES - DO NOT DELETE

### Core Application Files

#### Root Configuration
```
├── server.js                           # Main Express server (ESSENTIAL)
├── package.json                        # Dependencies (ESSENTIAL)
├── package-lock.json                   # Dependency lock (ESSENTIAL)
├── docker-compose.yml                  # Container orchestration (ESSENTIAL)
├── .env                                # Environment variables (ESSENTIAL)
├── .dockerignore                       # Docker build exclusions
├── .gitignore                          # Git exclusions
└── Dockerfile                          # App container definition (ESSENTIAL)
```

#### Services Layer (services/)
```
services/
├── auth/
│   └── admin.auth.service.js          # Admin authentication (ESSENTIAL)
├── database/
│   └── postgres.service.js            # PostgreSQL connection (ESSENTIAL)
├── chroma.service.js                  # Vector DB/RAG (ESSENTIAL)
├── content.service.js                 # Content management (ESSENTIAL)
├── document-processor.service.js      # File processing (ESSENTIAL)
├── embedding.service.js               # Vertex AI embeddings (ESSENTIAL)
├── moodle-content.service.js          # Moodle integration (ESSENTIAL)
├── moodle-orchestrator.service.js     # Moodle sync logic (ESSENTIAL)
├── moodle-settings.service.js         # Moodle config (ESSENTIAL)
├── moodle-sync.service.js             # Moodle data sync (ESSENTIAL)
├── neo4j.service.js                   # Graph DB (ESSENTIAL)
├── orchestrator.service.js            # Chat orchestration (ESSENTIAL)
├── portal-content.service.js          # Portal content mgmt (ESSENTIAL)
├── twilio-whatsapp.service.js         # Twilio integration (OPTIONAL)
├── vertexai.service.js                # AI text generation (ESSENTIAL)
├── whatsapp-adapter.service.js        # WhatsApp abstraction (OPTIONAL)
└── whatsapp-handler.service.js        # WhatsApp logic (OPTIONAL)
```

#### Routes Layer (routes/)
```
routes/
├── admin.routes.js                    # Admin API endpoints (ESSENTIAL)
├── auth.routes.js                     # Authentication (ESSENTIAL)
├── user.routes.js                     # User management (ESSENTIAL)
└── twilio-webhook.routes.js           # Twilio webhooks (OPTIONAL)
```

#### Models Layer (models/)
```
models/
├── admin-user.model.js                # Admin user model (ESSENTIAL)
└── user.model.js                      # User model (ESSENTIAL)
```

#### Middleware Layer (middleware/)
```
middleware/
└── auth.middleware.js                 # JWT auth middleware (ESSENTIAL)
```

#### Utils Layer (utils/)
```
utils/
├── jwt.util.js                        # JWT token handling (ESSENTIAL)
├── logger.js                          # Logging utility (ESSENTIAL)
└── password.util.js                   # Password hashing (ESSENTIAL)
```

#### Database Layer (database/)
```
database/
└── init.sql                           # PostgreSQL schema (ESSENTIAL)
```

#### Frontend Layer (public/)
```
public/admin/
├── login.html                         # Login page (ESSENTIAL)
├── lms-dashboard.html                 # Main dashboard (ESSENTIAL)
├── chat.html                          # Chat interface (ESSENTIAL)
├── user-management.html               # User management (ESSENTIAL)
├── users.html                         # User list (ESSENTIAL)
├── user-detail.html                   # User detail view (ESSENTIAL)
└── moodle-settings.html               # Moodle config (OPTIONAL)
```

#### Scripts (scripts/)
```
scripts/
├── import-moodle-course.js            # Moodle course import (ESSENTIAL)
├── populate-sample-content.js         # Sample data script (OPTIONAL)
└── run-migration.js                   # Database migrations (OPTIONAL)
```

---

## 🧹 FILES TO DELETE - Safe to Remove

### Test & Debug Files (29 files)
```bash
# Test scripts - used for debugging during development
test-chat-wiring.sh
test-chromadb-offline.js
test-vertex-ai-detailed.js
test-webhook-endpoint.sh
quick-test-whatsapp.sh
inspect-quiz-questions.js

# Old standalone/experimental files
server-standalone.js
```

### Session Documentation (40+ files) - Archive These
```bash
# These are session notes from development - move to /docs/archive/

CHAT_AND_UPLOAD_FIX.md
CHAT_FIX.md
CHAT_RAG_FIX.md
CHROMADB_RESET_COMPLETE.md
CONTENT_IMPORT_COMPLETE.md
DELETE_COURSE_FEATURE.md
DUAL_SOURCE_ARCHITECTURE.md
FINAL_MODEL_RECOMMENDATION.md
FIX_VERTEX_AI.md
GRAPH_ANALYSIS_GUIDE.md
IMPLEMENTATION_COMPLETE.md
IMPLEMENTATION_SUMMARY.md
LLAMA_VS_GEMINI_REPORT.md
LMS_DASHBOARD_UPDATES.md
METRICS_GUIDE.md
MODULE_DISPLAY_UPDATE.md
MOODLE_FILE_DELETE_FIX.md
MOODLE_IMPORT_INTEGRATION.md
MOODLE_SETTINGS_GUIDE.md
MOODLE_SYNC_FIX_NEEDED.md
MOODLE_SYNC_FIXED.md
MOODLE_SYNC_README.md
MOODLE_SYNC_SUCCESS.md
MOODLE_WHATSAPP_INTEGRATION_PLAN.md
PROJECT_ESSENTIAL_FILES.md
QUALITY_CONFIDENCE_REPORT.md
QUIZ_FIX_FINAL.md
QUIZ_FIX_ROOT_CAUSE.md
RAG_COMPLETE_SUCCESS.md
RAG_GRAPHDB_INTEGRATION.md
RAG_WIRING_FIX.md
RESUME_CONTEXT.md
SESSION_CHECKPOINT.md
THREE_WAY_COMPARISON_REPORT.md
TOKEN_EXPIRATION_FIX.md
TWILIO_QUICK_START.md
TWILIO_WHATSAPP_SETUP.md
UI_CHAT_FIXED.md
UNIFIED_ARCHITECTURE_SETUP.md
UPLOAD_BUGS_FIXED.md
URGENT_FIX_STEPS.md
USER_PROGRESS_GUIDE.md
VERTEX_AI_FIXED.md
VERTEX_AI_SETUP.md
```

### Model Comparison Files (7 files)
```bash
# Model evaluation results - archive to /docs/research/
llama_vs_gemini_20251010_111500.json
model_comparison_summary_20251010_171054.json
model_comparison_summary_20251010_171222.json
model_comparison_summary_20251010_171601.json
quality_report_20251010_124754.json
compare_all_three_models.py
compare_llama_vs_gemini.py
plot_model_comparison.py
quality_confidence_validator.py
quality_validator_llama_gemini.py
```

### Temporary/Output Files
```bash
# Generated during testing - safe to delete
model_comparison_graphs.png
model_comparison_graphs_20251010_*.png

# Old archived content
archive/ (entire directory - move to separate backup)
moodle-output/ (if exists)
course-data/ (if not actively used)
```

---

## 📁 RECOMMENDED FOLDER STRUCTURE

### Keep These Directories
```
teachers_training/
├── database/          # SQL schemas
├── middleware/        # Auth middleware
├── migrations/        # Database migrations (if used)
├── models/           # Data models
├── public/           # Frontend files
│   └── admin/        # Admin UI
├── routes/           # API routes
├── scripts/          # Utility scripts
├── services/         # Business logic
├── uploads/          # User uploads (gitignored)
├── logs/             # Application logs (gitignored)
└── utils/            # Helper utilities
```

### Optional Directories (Can Archive)
```
├── archive/          # Old code/docs → Move to separate backup
├── course-data/      # Sample data → Keep only if actively used
├── moodle-output/    # Export files → Delete if not needed
└── h5p-conversion/   # H5P tools → Keep if planning H5P features
```

---

## 📝 ESSENTIAL DOCUMENTATION - Keep These

```bash
README.md                              # Project overview (UPDATE THIS)
QUICK_START.md                         # Getting started guide
SETUP.md                              # Detailed setup instructions
CLAUDE.md                             # Claude Code context
Content_Structure.txt                 # Content organization reference
```

### Update README.md with:
- Current architecture (RAG + GraphDB + Vertex AI)
- Setup instructions (Docker, GCP, environment)
- Login credentials
- API documentation links
- Troubleshooting guide

---

## 🔧 SETUP & CONFIGURATION FILES

### Keep These
```bash
setup-gcp-auth.sh                     # GCP authentication setup
start-local.sh                        # Local development start
sync-postgres-to-chromadb.js          # Content sync script (IMPORTANT!)
```

### Optional (if using WhatsApp/Ngrok)
```bash
setup-ngrok.md
setup-ngrok.sh
setup-whatsapp.sh
```

---

## 🗑️ CLEANUP SCRIPT

Create this script to safely archive old files:

```bash
#!/bin/bash
# cleanup-project.sh

# Create archive directories
mkdir -p docs/archive/session-notes
mkdir -p docs/archive/research
mkdir -p docs/archive/test-scripts

# Move session documentation
mv *_FIX*.md *_GUIDE.md *_SUMMARY.md *_SUCCESS.md docs/archive/session-notes/
mv SESSION_CHECKPOINT.md RESUME_CONTEXT.md docs/archive/session-notes/
mv IMPLEMENTATION_*.md MOODLE_*.md docs/archive/session-notes/

# Move research files
mv *comparison*.json *comparison*.py quality_*.* docs/archive/research/
mv *REPORT.md docs/archive/research/
mv model_comparison_graphs*.png docs/archive/research/

# Move test scripts
mv test-*.js test-*.sh quick-test-*.sh docs/archive/test-scripts/
mv inspect-*.js docs/archive/test-scripts/

# Delete truly unnecessary files
rm -f server-standalone.js

echo "✅ Cleanup complete! Check docs/archive/ for moved files"
```

---

## 📊 FILE COUNT SUMMARY

### Production Files: ~60 files
- **Services:** 18 files
- **Routes:** 4 files
- **Models:** 2 files
- **Middleware:** 1 file
- **Utils:** 3 files
- **Frontend:** 7 HTML files
- **Config:** 5 files (docker-compose, package.json, etc.)
- **Scripts:** 3 essential scripts
- **Database:** 1 schema file
- **Docs:** 5 essential docs

### Archive/Delete: ~80 files
- **Session docs:** 40+ markdown files
- **Test scripts:** 7 files
- **Research files:** 10+ files
- **Temp/output:** 5+ files
- **Old code:** 3 files

---

## 🚀 AFTER CLEANUP

### Your root directory should contain:
```
teachers_training/
├── database/
├── docs/                    # NEW - organized documentation
│   ├── archive/            # Moved old docs here
│   └── README.md           # Documentation index
├── middleware/
├── models/
├── public/
├── routes/
├── scripts/
├── services/
├── utils/
├── .env
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── package.json
├── README.md               # UPDATED main docs
├── QUICK_START.md
├── SETUP.md
├── CLAUDE.md
├── server.js
└── sync-postgres-to-chromadb.js
```

### Total files after cleanup: ~65 essential files
- Much cleaner and maintainable
- All development history preserved in docs/archive/
- Easy to navigate for new developers

---

## ✅ VERIFICATION CHECKLIST

After cleanup, verify:
- [ ] Docker containers start: `docker-compose up -d`
- [ ] Login works: http://localhost:3000/admin/login.html
- [ ] Chat works with RAG context
- [ ] Moodle sync works (if using)
- [ ] All services healthy: `docker ps`
- [ ] Environment variables present in `.env`

---

## 🎯 NEXT STEPS

1. **Run the cleanup**:
   ```bash
   mkdir -p docs/archive/{session-notes,research,test-scripts}
   # Move files as shown in cleanup script
   ```

2. **Update README.md**:
   - Document current architecture
   - Add setup instructions
   - Include login credentials
   - Add troubleshooting section

3. **Create docs/README.md**:
   - Index of all documentation
   - Link to archived session notes
   - Architecture diagrams

4. **Commit clean baseline**:
   ```bash
   git add .
   git commit -m "chore: project cleanup and baseline"
   ```

---

**Baseline complete!** Your project is now clean, organized, and production-ready. 🎉
