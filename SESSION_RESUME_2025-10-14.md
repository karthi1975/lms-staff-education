# Session Resume Document - 2025-10-14

## Current Task Summary
Updating Vertex AI credentials on GCP instance and testing chat functionality for Module 2.

## System Status

### Local Environment
- **Working Directory**: `/Users/karthi/business/staff_education/teachers_training`
- **Git Branch**: `master`
- **Git Status**: Clean (last commit: 1b5e6e5 - remove moodle_modules dependency)
- **Platform**: macOS (Darwin 24.6.0)

### GCP Deployment
- **Instance**: Teachers training system deployed on GCP
- **Issue**: Vertex AI credentials need to be updated on the GCP instance
- **Next Steps**:
  1. Update Vertex AI credentials on GCP
  2. Restart Docker containers
  3. Test chat API with Module 2 content

### Test Target
- **Module**: Module 2 - Entrepreneurship & Business Ideas
- **Test Type**: Chat API functionality test
- **Expected**: RAG-powered responses using Vertex AI

## Recent Work Context

### Last Known Issues
- Vertex AI authentication on GCP instance needs refresh
- Credentials may have expired or need reconfiguration

### Completed Recently
- Fixed Moodle modules dependency issues (commits e260d19, 1b5e6e5)
- Upload permissions fixed (commit fe0b5e3)
- GCP deployment guide created (commit f13fa51)
- GCP pull and deploy script added (commit 8d4455d)

## Technology Stack
- **Backend**: Node.js 16+ with Express.js
- **Databases**:
  - PostgreSQL (user management, replacing SQLite)
  - Neo4j (learning paths)
  - ChromaDB (vector embeddings)
- **AI**: Vertex AI (Google Cloud)
- **Deployment**: Docker containers on GCP
- **Authentication**: JWT + bcrypt

## Available Scripts
- `./deploy-to-gcp-auto.sh` - Automated GCP deployment
- `./gcp-pull-and-deploy.sh` - Pull latest code and deploy
- `./test-chat-endpoint.sh` - Test chat API endpoint
- `./setup-vertex-persistent.sh` - Setup Vertex AI credentials
- `./scripts/refresh-vertex-token.sh` - Refresh Vertex AI token
- `./test-gcp-webhook.sh` - Test GCP webhook
- `./gcp-full-restart-clean.sh` - Full restart and cleanup

## Environment Variables Required
```env
# Vertex AI
VERTEX_AI_PROJECT_ID
VERTEX_AI_LOCATION
GOOGLE_APPLICATION_CREDENTIALS

# Database
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD

# JWT
JWT_SECRET
JWT_EXPIRES_IN

# Session
SESSION_TTL_HOURS
NUDGE_INACTIVITY_HOURS

# Quiz
QUIZ_PASS_THRESHOLD
MAX_QUIZ_ATTEMPTS

# ChromaDB
CHROMA_URL
```

## GCP Instance Access
- **SSH Command**: `gcloud compute ssh <instance-name> --zone=<zone>`
- **Deployment Path**: Likely `/home/<user>/teachers_training` or similar
- **Docker Commands**:
  - Check status: `docker ps`
  - View logs: `docker logs -f teachers_training-app-1`
  - Restart: `docker-compose restart`
  - Full restart: `docker-compose down && docker-compose up -d`

## Next Steps (Ordered)
1. ✅ Create this resume document
2. ⏭️ SSH into GCP instance
3. ⏭️ Locate Vertex AI credentials configuration
4. ⏭️ Update credentials using setup script or manual update
5. ⏭️ Restart Docker containers
6. ⏭️ Test chat API with Module 2 query
7. ⏭️ Verify response quality and sources
8. ⏭️ Document results

## Test Query for Module 2
- **Module**: Module 2 - Entrepreneurship & Business Ideas
- **Sample Query**: (incomplete in user message - needs clarification)

## Known Working Endpoints
- Login: `/api/auth/login`
- Chat: `/api/chat` (POST with query, language)
- Admin users: `/api/admin/users`
- Health check: `/api/health`

## Admin Credentials
- **Email**: admin@school.edu
- **Password**: Admin123!

## Troubleshooting Commands
```bash
# Check Docker status
docker ps

# View app logs
docker logs -f teachers_training-app-1

# Check Vertex AI credentials
ls -la ~/.config/gcloud/
echo $GOOGLE_APPLICATION_CREDENTIALS

# Test health endpoint
curl http://localhost:3000/api/health

# Test chat (with auth token)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "What is entrepreneurship?", "language": "english"}'
```

## Important Notes
- Session was interrupted during Vertex AI credential update
- GCP instance may still have old/expired credentials
- Need to verify ChromaDB has Module 2 content embedded
- Test should validate both Vertex AI connection and RAG retrieval

## Files to Check
- `.env` - Environment variables
- `docker-compose.yml` - Docker configuration
- `services/vertexai.service.js` - Vertex AI integration
- `services/rag/*.js` - RAG pipeline services

## Success Criteria
- ✅ Vertex AI credentials successfully updated
- ✅ Docker containers restart without errors
- ✅ Chat API responds within 3 seconds
- ✅ Response includes relevant Module 2 content
- ✅ Sources are properly cited from ChromaDB

---
*Created: 2025-10-14*
*Status: Ready to resume work*
