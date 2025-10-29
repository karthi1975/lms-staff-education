#!/bin/bash
# Apply All Critical Edge Case Fixes
# Based on EDGE_CASE_FIXES.md analysis

set -e

echo "🔧 Applying Critical Edge Case Fixes..."
echo ""

# Backup current files
echo "📦 Creating backups..."
cp services/course-orchestrator.service.js services/course-orchestrator.service.js.backup
cp services/whatsapp-handler.service.js services/whatsapp-handler.service.js.backup
cp routes/admin.routes.js routes/admin.routes.js.backup

echo "✅ Backups created"
echo ""

# Apply fixes
echo "📝 Summary of Fixes to Apply:"
echo ""
echo "CRITICAL (Phase 1):"
echo "  1. ✅ Prevent enrollment with no modules (ALREADY IMPLEMENTED)"
echo "  2. ⏳ Fix NULL module crash in course-orchestrator"
echo "  3. ⏳ Validate module existence before using"
echo "  4. ⏳ Add module reset for deleted modules"
echo ""
echo "HIGH PRIORITY (Phase 2):"
echo "  5. ⏳ Session cache cleanup (memory leak prevention)"
echo "  6. ⏳ Graceful user deletion handling"
echo ""
echo "MEDIUM PRIORITY (Phase 3):"
echo "  7. ⏳ Return 404 for deleted users in API"
echo ""

echo "⚠️  Manual Implementation Required:"
echo ""
echo "The following fixes require careful code modifications:"
echo "1. services/course-orchestrator.service.js - Add NULL/deleted module handling"
echo "2. services/whatsapp-handler.service.js - Add session cleanup"
echo "3. routes/admin.routes.js - Add user existence check"
echo ""
echo "Please review EDGE_CASE_FIXES.md for detailed implementation."
echo ""

# Create a fixes tracking file
cat > EDGE_CASE_FIXES_STATUS.md << 'STATUS_EOF'
# Edge Case Fixes Status

## Implementation Status

### ✅ Already Implemented
1. **Prevent enrollment with no modules** (enrollment.service.js:117-126)
   - Status: COMPLETE
   - File: services/enrollment.service.js
   - Lines: 117-126

2. **Quiz retrieval column fix** (Just committed)
   - Status: COMPLETE
   - File: routes/admin.routes.js
   - Fixed: question_text → question, ORDER BY issue

### ⏳ Pending Implementation

#### Critical (Phase 1)
3. **Fix NULL module crash**
   - File: services/course-orchestrator.service.js
   - Line: ~416
   - Code: Add check before parseInt(context.current_module_id)
   - Status: NEEDS IMPLEMENTATION

4. **Validate module existence**
   - File: services/course-orchestrator.service.js
   - Add methods: checkModuleExists(), resetUserToFirstModule()
   - Status: NEEDS IMPLEMENTATION

#### High Priority (Phase 2)
5. **Session cache cleanup**
   - File: services/whatsapp-handler.service.js
   - Add: startSessionCleanup() method
   - Status: NEEDS IMPLEMENTATION

6. **Graceful user deletion**
   - File: services/whatsapp-handler.service.js
   - Line: ~225-229
   - Status: NEEDS IMPLEMENTATION

#### Medium Priority (Phase 3)
7. **Return 404 for deleted users**
   - File: routes/admin.routes.js
   - Endpoint: GET /user-progress/:userId
   - Status: NEEDS IMPLEMENTATION

## Next Steps

1. Review files in services/ folder
2. Implement each fix manually with testing
3. Commit each fix separately
4. Deploy to GCP
5. Test in production

## References
- EDGE_CASES_ANALYSIS.md - Detailed analysis
- EDGE_CASE_FIXES.md - Implementation guide
STATUS_EOF

echo "✅ Created EDGE_CASE_FIXES_STATUS.md"
echo ""
echo "📚 Next Steps:"
echo "1. Review EDGE_CASE_FIXES.md for implementation details"
echo "2. Implement each fix in the respective service files"
echo "3. Test locally before deploying to GCP"
echo "4. Run: ./deploy-edge-case-fixes-to-gcp.sh"
echo ""
echo "🔍 To see which files need changes:"
echo "   cat EDGE_CASE_FIXES_STATUS.md"
