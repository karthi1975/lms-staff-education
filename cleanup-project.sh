#!/bin/bash
# cleanup-project.sh
# Teachers Training System - Project Cleanup Script
# Safely archives development documentation and test files

echo "🧹 Starting project cleanup..."

# Create archive directories
echo "📁 Creating archive directories..."
mkdir -p docs/archive/session-notes
mkdir -p docs/archive/research
mkdir -p docs/archive/test-scripts
mkdir -p docs/archive/temp-files

# Move session documentation (40+ files)
echo "📝 Moving session notes..."
mv CHAT_AND_UPLOAD_FIX.md docs/archive/session-notes/ 2>/dev/null
mv CHAT_FIX.md docs/archive/session-notes/ 2>/dev/null
mv CHAT_RAG_FIX.md docs/archive/session-notes/ 2>/dev/null
mv CHROMADB_RESET_COMPLETE.md docs/archive/session-notes/ 2>/dev/null
mv CONTENT_IMPORT_COMPLETE.md docs/archive/session-notes/ 2>/dev/null
mv DELETE_COURSE_FEATURE.md docs/archive/session-notes/ 2>/dev/null
mv DUAL_SOURCE_ARCHITECTURE.md docs/archive/session-notes/ 2>/dev/null
mv FINAL_MODEL_RECOMMENDATION.md docs/archive/session-notes/ 2>/dev/null
mv FIX_VERTEX_AI.md docs/archive/session-notes/ 2>/dev/null
mv GRAPH_ANALYSIS_GUIDE.md docs/archive/session-notes/ 2>/dev/null
mv IMPLEMENTATION_COMPLETE.md docs/archive/session-notes/ 2>/dev/null
mv IMPLEMENTATION_SUMMARY.md docs/archive/session-notes/ 2>/dev/null
mv LLAMA_VS_GEMINI_REPORT.md docs/archive/session-notes/ 2>/dev/null
mv LMS_DASHBOARD_UPDATES.md docs/archive/session-notes/ 2>/dev/null
mv METRICS_GUIDE.md docs/archive/session-notes/ 2>/dev/null
mv MODULE_DISPLAY_UPDATE.md docs/archive/session-notes/ 2>/dev/null
mv MOODLE_FILE_DELETE_FIX.md docs/archive/session-notes/ 2>/dev/null
mv MOODLE_IMPORT_INTEGRATION.md docs/archive/session-notes/ 2>/dev/null
mv MOODLE_SETTINGS_GUIDE.md docs/archive/session-notes/ 2>/dev/null
mv MOODLE_SYNC_FIX_NEEDED.md docs/archive/session-notes/ 2>/dev/null
mv MOODLE_SYNC_FIXED.md docs/archive/session-notes/ 2>/dev/null
mv MOODLE_SYNC_README.md docs/archive/session-notes/ 2>/dev/null
mv MOODLE_SYNC_SUCCESS.md docs/archive/session-notes/ 2>/dev/null
mv MOODLE_WHATSAPP_INTEGRATION_PLAN.md docs/archive/session-notes/ 2>/dev/null
mv PROJECT_ESSENTIAL_FILES.md docs/archive/session-notes/ 2>/dev/null
mv QUALITY_CONFIDENCE_REPORT.md docs/archive/session-notes/ 2>/dev/null
mv QUIZ_FIX_FINAL.md docs/archive/session-notes/ 2>/dev/null
mv QUIZ_FIX_ROOT_CAUSE.md docs/archive/session-notes/ 2>/dev/null
mv RAG_COMPLETE_SUCCESS.md docs/archive/session-notes/ 2>/dev/null
mv RAG_GRAPHDB_INTEGRATION.md docs/archive/session-notes/ 2>/dev/null
mv RAG_WIRING_FIX.md docs/archive/session-notes/ 2>/dev/null
mv RESUME_CONTEXT.md docs/archive/session-notes/ 2>/dev/null
mv SESSION_CHECKPOINT.md docs/archive/session-notes/ 2>/dev/null
mv THREE_WAY_COMPARISON_REPORT.md docs/archive/session-notes/ 2>/dev/null
mv TOKEN_EXPIRATION_FIX.md docs/archive/session-notes/ 2>/dev/null
mv TWILIO_QUICK_START.md docs/archive/session-notes/ 2>/dev/null
mv TWILIO_WHATSAPP_SETUP.md docs/archive/session-notes/ 2>/dev/null
mv UI_CHAT_FIXED.md docs/archive/session-notes/ 2>/dev/null
mv UNIFIED_ARCHITECTURE_SETUP.md docs/archive/session-notes/ 2>/dev/null
mv UPLOAD_BUGS_FIXED.md docs/archive/session-notes/ 2>/dev/null
mv URGENT_FIX_STEPS.md docs/archive/session-notes/ 2>/dev/null
mv USER_PROGRESS_GUIDE.md docs/archive/session-notes/ 2>/dev/null
mv VERTEX_AI_FIXED.md docs/archive/session-notes/ 2>/dev/null
mv VERTEX_AI_SETUP.md docs/archive/session-notes/ 2>/dev/null

# Move research files
echo "🔬 Moving research files..."
mv llama_vs_gemini_20251010_111500.json docs/archive/research/ 2>/dev/null
mv model_comparison_summary_*.json docs/archive/research/ 2>/dev/null
mv quality_report_*.json docs/archive/research/ 2>/dev/null
mv compare_all_three_models.py docs/archive/research/ 2>/dev/null
mv compare_llama_vs_gemini.py docs/archive/research/ 2>/dev/null
mv plot_model_comparison.py docs/archive/research/ 2>/dev/null
mv quality_confidence_validator.py docs/archive/research/ 2>/dev/null
mv quality_validator_llama_gemini.py docs/archive/research/ 2>/dev/null
mv model_comparison_graphs*.png docs/archive/research/ 2>/dev/null

# Move test scripts
echo "🧪 Moving test scripts..."
mv test-chat-wiring.sh docs/archive/test-scripts/ 2>/dev/null
mv test-chromadb-offline.js docs/archive/test-scripts/ 2>/dev/null
mv test-vertex-ai-detailed.js docs/archive/test-scripts/ 2>/dev/null
mv test-webhook-endpoint.sh docs/archive/test-scripts/ 2>/dev/null
mv quick-test-whatsapp.sh docs/archive/test-scripts/ 2>/dev/null
mv inspect-quiz-questions.js docs/archive/test-scripts/ 2>/dev/null

# Move temporary files
echo "🗂️  Moving temporary files..."
mv server-standalone.js docs/archive/temp-files/ 2>/dev/null
mv user-instructions.txt docs/archive/temp-files/ 2>/dev/null
mv test-features.md docs/archive/temp-files/ 2>/dev/null

# Optional: Move setup scripts if not needed
echo "⚙️  Setup scripts (kept in root - move manually if not needed):"
echo "   - setup-gcp-auth.sh"
echo "   - setup-ngrok.sh"
echo "   - setup-ngrok.md"
echo "   - setup-whatsapp.sh"
echo "   - upload-sample-content.sh"

# Create archive index
echo "📋 Creating archive index..."
cat > docs/archive/README.md << 'EOF'
# Archived Development Files

This directory contains files from the development process that are no longer needed in the main project directory but are preserved for reference.

## Directory Structure

- **session-notes/** - Development session documentation, fixes, and guides
- **research/** - Model comparison research and evaluation results
- **test-scripts/** - Test and debug scripts used during development
- **temp-files/** - Temporary or experimental files

## Notes

These files document the development journey and can be useful for:
- Understanding past design decisions
- Troubleshooting similar issues in the future
- Reference for architecture evolution
- Historical context for new developers

All functionality from these documents is now integrated into the main codebase and documented in the root README.md and SETUP.md files.

EOF

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📊 Summary:"
echo "   - Session notes moved to: docs/archive/session-notes/"
echo "   - Research files moved to: docs/archive/research/"
echo "   - Test scripts moved to: docs/archive/test-scripts/"
echo "   - Temp files moved to: docs/archive/temp-files/"
echo ""
echo "📖 Next steps:"
echo "   1. Review docs/archive/ to verify all files moved correctly"
echo "   2. Update README.md with current architecture"
echo "   3. Commit changes: git add . && git commit -m 'chore: project cleanup'"
echo ""
echo "🎯 Essential files kept in root:"
ls -1 *.md *.js *.json *.yml 2>/dev/null | grep -E "^(README|QUICK_START|SETUP|CLAUDE|server|package|docker-compose|sync-postgres)" | sort
echo ""
