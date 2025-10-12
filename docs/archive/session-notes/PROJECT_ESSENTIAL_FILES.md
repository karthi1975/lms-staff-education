# Essential Files for Teachers Training System

## 📂 PROJECT STRUCTURE

### **KEEP: Core Application Files**

#### 1. Backend Services (Node.js/Express)
```
server.js                                    # Main Express server
package.json                                 # Dependencies & scripts
docker-compose.yml                           # Container orchestration
.env.example                                 # Environment template
```

#### 2. Services Layer
```
services/
├── whatsapp-handler.service.js             # WhatsApp message routing (Twilio)
├── twilio-whatsapp.service.js              # Twilio API integration
├── whatsapp-adapter.service.js             # WhatsApp message formatting
├── orchestrator.service.js                 # Main RAG orchestrator
├── moodle-orchestrator.service.js          # Moodle content orchestration
├── vertexai.service.js                     # Vertex AI LLM integration
├── neo4j.service.js                        # Knowledge graph (learning paths)
├── document-processor.service.js           # Text extraction, chunking
├── moodle-content.service.js               # Moodle API integration
├── moodle-sync.service.js                  # Moodle data synchronization
├── moodle-settings.service.js              # Moodle configuration
└── portal-content.service.js               # Admin portal content
```

#### 3. Routes
```
routes/
├── admin.routes.js                         # Admin dashboard API
├── twilio-webhook.routes.js                # Twilio webhook endpoints
└── (other route files)
```

#### 4. Database Configuration
```
config/
└── database.config.js                      # DB connection config

migrations/                                  # PostgreSQL migrations
```

#### 5. Frontend (Admin Dashboard)
```
public/
├── admin/
│   ├── index.html                          # Admin dashboard home
│   ├── login.html                          # Admin login
│   ├── users.html                          # User list
│   ├── user-detail.html                    # User progress tracking
│   ├── user-management.html                # User CRUD operations
│   ├── lms-dashboard.html                  # LMS integration dashboard
│   └── moodle-settings.html                # Moodle configuration UI
└── js/                                     # Frontend JavaScript
```

#### 6. Scripts
```
scripts/
├── populate-sample-content.js              # Sample data generator
├── import-moodle-course.js                 # Moodle course import
├── run-migration.js                        # Database migration runner
└── download-course-data.js                 # Course data backup
```

---

### **KEEP: Model Comparison Analysis Files**

#### Python Scripts (Model Testing & Comparison)
```
compare_all_three_models.py                 # 🔥 Three-way model comparison (Llama/Gemini/Claude)
plot_model_comparison.py                    # 🔥 Generate comparison graphs
compare_llama_vs_gemini.py                  # Llama vs Gemini head-to-head test
```

#### Supporting Test Scripts
```
test_closest_regions_to_tanzania.py         # Regional availability test
find_closest_gemini.py                      # Find best Gemini region
check_vertex_quotas.py                      # GCP quota checker
```

#### Results & Documentation
```
METRICS_GUIDE.md                            # 🔥 Metrics documentation
GRAPH_ANALYSIS_GUIDE.md                     # 🔥 How to read graphs
QUALITY_CONFIDENCE_REPORT.md                # Quality scoring analysis
THREE_WAY_COMPARISON_REPORT.md              # Full comparison report
LLAMA_VS_GEMINI_REPORT.md                   # Llama vs Gemini analysis
FINAL_MODEL_RECOMMENDATION.md               # Final decision summary

model_comparison_graphs_20251010_171601.png # 🔥 Comparison visualization
model_comparison_summary_20251010_171601.json # Graph data source
```

---

### **KEEP: Documentation**

#### Setup & Configuration
```
CLAUDE.md                                   # Claude Code project context
QUICK_START.md                              # Project quick start guide
TWILIO_QUICK_START.md                       # Twilio WhatsApp setup
TWILIO_WHATSAPP_SETUP.md                    # Twilio configuration
VERTEX_AI_SETUP.md                          # Vertex AI setup
```

#### Architecture & Design
```
DUAL_SOURCE_ARCHITECTURE.md                 # RAG + Moodle architecture
UNIFIED_ARCHITECTURE_SETUP.md               # System architecture
```

#### Feature Documentation
```
CHAT_FIX.md                                 # Chat functionality fixes
CONTENT_IMPORT_COMPLETE.md                  # Content import guide
DELETE_COURSE_FEATURE.md                    # Course deletion feature
IMPLEMENTATION_COMPLETE.md                  # Implementation notes
LMS_DASHBOARD_UPDATES.md                    # LMS dashboard changes
```

#### GCP & Infrastructure
```
docs/
├── gcp-infrastructure-setup.md             # GCP setup guide
├── gcp-quick-setup-guide.md                # Quick GCP reference
└── claude-code-gcp-setup.md                # Claude Code on GCP
```

---

### **KEEP: Configuration Files**

```
.env                                        # Environment variables (DO NOT COMMIT)
.env.example                                # Environment template
docker-compose.yml                          # Docker services
package.json                                # Node.js dependencies
.vscode/settings.json                       # VS Code config
```

---

### **DELETE: Test Results & Temporary Files**

#### Old Test Results (Can be regenerated)
```
❌ all_gemini_mumbai_results.json
❌ all_models_results.json
❌ best_model_quick_20251010_104840.json
❌ closest_regions_results.json
❌ final_rag_recommendation_20251010_110244.json
❌ gemini_*.json (all timestamped gemini test files)
❌ llama_vs_gemini_20251010_110940.json
❌ region_test_results.json
```

#### Older Test Scripts (Superseded)
```
❌ test_all_gemini_mumbai.py
❌ test_all_models.py
❌ test_all_models_mumbai.py
❌ test_all_publishers.py
❌ test_gemini_*.py (all specific gemini tests)
❌ test_llama*.py (all llama tests)
❌ test_mumbai_models.py
❌ test_regions_comparison.py
❌ test_africa_regions.py
```

#### Temporary/Debug Files
```
❌ gemini_production_test_output.txt
❌ model_test_results.json
❌ debug-chroma.js
❌ test-moodle-courses.js
❌ test-moodle-offline.js
❌ check-quiz-info.js
❌ get-quiz-id.js
❌ clear-moodle-attempt.js
```

#### Old Documentation (Outdated)
```
❌ AFRICA_REGIONS_RESEARCH.md (superseded by final recommendation)
❌ AFRICA_MODEL_RECOMMENDATION.md (superseded by THREE_WAY_COMPARISON)
❌ BUSINESS_VERIFICATION_STEPS.md
❌ CERTIFICATE_AND_QUIZ_DOWNLOAD_IMPLEMENTATION.md
❌ CHAT_AND_QUIZ_FIXES.md
❌ COMPLETE_FIXES_SUMMARY.md
❌ DOWNLOADED_DATA_SUMMARY.md
❌ FINAL_QUIZ_FIX_SUCCESS.md
❌ GCP_MUMBAI_REQUEST.md
❌ GCP_SOUTH_AFRICA_REQUEST.md
❌ IMPORT_FIXES_COMPLETE.md
❌ MANUAL_COURSE_CREATION_COMPLETE.md
❌ NEO4J_FIX.md
❌ QUOTA_CHECK_GUIDE.md
❌ QUOTA_INCREASE_REQUEST.md
❌ READY_FOR_IMPORT.md
❌ RUN_MODEL_TEST.md
❌ SECTION_AS_MODULE_IMPORT.md
❌ WHATSAPP_QUIZ_UX_GUIDE.md
```

#### Utility Scripts (Cleanup)
```
❌ clear-import-data.sh
❌ claude-setup-gcp.sh
```

---

## 🎯 ESSENTIAL FILE COUNT

### Core Application: ~50 files
- Server & config: 4 files
- Services: 12 files
- Routes: 3+ files
- Frontend: 7+ HTML files
- Scripts: 4+ files
- Migrations: As needed

### Model Comparison: 15 files
- **KEEP 3 Python scripts**: compare_all_three_models.py, plot_model_comparison.py, compare_llama_vs_gemini.py
- **KEEP 5 Documentation**: METRICS_GUIDE.md, GRAPH_ANALYSIS_GUIDE.md, QUALITY_CONFIDENCE_REPORT.md, THREE_WAY_COMPARISON_REPORT.md, FINAL_MODEL_RECOMMENDATION.md
- **KEEP 2 Results**: model_comparison_graphs_*.png, model_comparison_summary_*.json

### Documentation: ~15 files
- Setup guides: 5 files
- Architecture: 2 files
- Feature docs: 5+ files
- GCP docs: 3 files

---

## 🔥 CRITICAL FILES (DO NOT DELETE)

1. **compare_all_three_models.py** - Model quality testing
2. **plot_model_comparison.py** - Graph generation
3. **METRICS_GUIDE.md** - Metrics documentation
4. **GRAPH_ANALYSIS_GUIDE.md** - Graph interpretation
5. **model_comparison_graphs_20251010_171601.png** - Visual comparison
6. **model_comparison_summary_20251010_171601.json** - Graph data
7. **server.js** - Main application server
8. **services/orchestrator.service.js** - RAG pipeline
9. **services/vertexai.service.js** - LLM integration
10. **docker-compose.yml** - Container setup
11. **package.json** - Dependencies
12. **.env** - Configuration (keep secret!)

---

## 📦 RECOMMENDED ACTIONS

### 1. Delete Old Test Files
```bash
rm -f *_results.json
rm -f gemini_*.json
rm -f test_gemini_*.py
rm -f test_llama_*.py
rm -f test_all_*.py
rm -f test_mumbai_*.py
rm -f test_regions_*.py
rm -f test_africa_*.py
```

### 2. Delete Temporary Scripts
```bash
rm -f debug-*.js
rm -f test-moodle-*.js
rm -f check-quiz-info.js
rm -f get-quiz-id.js
rm -f clear-moodle-attempt.js
rm -f clear-import-data.sh
```

### 3. Archive Old Documentation
```bash
mkdir -p archive/old-docs
mv AFRICA_REGIONS_RESEARCH.md archive/old-docs/
mv BUSINESS_VERIFICATION_STEPS.md archive/old-docs/
mv CERTIFICATE_AND_QUIZ_DOWNLOAD_IMPLEMENTATION.md archive/old-docs/
mv CHAT_AND_QUIZ_FIXES.md archive/old-docs/
mv COMPLETE_FIXES_SUMMARY.md archive/old-docs/
mv GCP_*.md archive/old-docs/
mv *_FIX*.md archive/old-docs/
mv QUOTA_*.md archive/old-docs/
```

### 4. Keep Clean Structure
```
teachers_training/
├── server.js
├── package.json
├── docker-compose.yml
├── .env.example
├── services/          # RAG, Twilio, Moodle, LLM
├── routes/            # API endpoints
├── public/            # Admin UI
├── scripts/           # Utilities
├── migrations/        # DB migrations
├── docs/              # Architecture & setup
├── compare_all_three_models.py  # Model testing
├── plot_model_comparison.py     # Graph generation
├── METRICS_GUIDE.md             # Metrics docs
├── GRAPH_ANALYSIS_GUIDE.md      # Graph interpretation
└── model_comparison_graphs_*.png # Visualization
```

---

*Generated: 2025-10-10*
*Purpose: Identify essential files for Twilio/RAG/LLM/UI system + model comparison*

