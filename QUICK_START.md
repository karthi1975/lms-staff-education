# 🚀 Quick Start Guide - Teachers Training System

## 🔗 Admin Login URL
**http://localhost:3000/admin/login.html**

**Credentials**:
- Email: `admin@school.edu`
- Password: `Admin123!`

---

## 🗑️ Clean All Databases (Optional - Fresh Start)

```bash
./scripts/cleanup-all-databases.sh
```

Type `yes` to confirm. This deletes:
- PostgreSQL (all users, courses, content)
- ChromaDB (all vectors/RAG data)
- Neo4j (all graph data)

---

## 📚 Quick Setup Steps

### 1. Login
http://localhost:3000/admin/login.html

### 2. Create Course (API)
```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"Admin123!"}' \
  | jq -r '.token')

# Create course
curl -X POST http://localhost:3000/api/admin/portal/courses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "course_name": "Teacher Training Fundamentals",
    "course_code": "TEACH-001",
    "description": "Core concepts for new teachers"
  }'
```

### 3. Add Module
```bash
COURSE_ID=1  # Use ID from step 2

curl -X POST http://localhost:3000/api/admin/portal/courses/$COURSE_ID/modules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "module_name": "Introduction to Teaching",
    "description": "Fundamental teaching principles",
    "sequence_order": 1
  }'
```

### 4. Upload Content
```bash
MODULE_ID=1  # Use ID from step 3

curl -X POST http://localhost:3000/api/admin/portal/courses/$COURSE_ID/modules/$MODULE_ID/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/your/document.pdf"
```

### 5. Test RAG Chat
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "message": "What are key teaching principles?",
    "module": "module_1",
    "useContext": true
  }'
```

### 6. Register User (WhatsApp Verification)
```bash
curl -X POST http://localhost:3000/api/admin/users/register-with-verification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Karthi",
    "phoneNumber": "+18016809129"
  }'
```

**User receives WhatsApp message** → User sends `HI [code]` → **Account activated!**

---

## 📱 User Flow (WhatsApp)

**Twilio WhatsApp Number**: +1 806 515 7636
**Test User**: Karthi (+1 801 680 9129)

1. **Verification**:
   - User receives: "Your code is: 192556"
   - User sends: `HI 192556`
   - System: Creates account + sends welcome message

2. **Learning**:
   - User: `module 1`
   - System: Sends module content
   - User: Asks questions (RAG-powered responses)
   - User: `quiz` (when ready)
   - System: Sends quiz questions one-by-one

3. **Progress**:
   - User: `progress`
   - System: Shows completion status for all modules

---

## 📄 Full Documentation

- **Admin Portal Setup**: `ADMIN_PORTAL_SETUP.md`
- **Verification System**: `VERIFICATION_SETUP.md`
- **Refactoring Plan**: See plan.txt implementation status

---

## 🔧 Troubleshooting

### Can't login?
```bash
docker exec teachers_training-app-1 node -e "
const AdminAuthService = require('./services/auth/admin.auth.service');
(async () => {
  await AdminAuthService.createAdmin({
    email: 'admin@school.edu',
    password: 'Admin123!',
    name: 'Admin',
    role: 'admin'
  }, 'admin');
})();
"
```

### Check health:
```bash
curl http://localhost:3000/health
```

### View logs:
```bash
docker logs teachers_training-app-1 -f
```

---

## ✅ Success Checklist

- [ ] Admin login works
- [ ] Course & modules created
- [ ] Content uploaded
- [ ] RAG chat tested
- [ ] User registered via WhatsApp
- [ ] User verified and started learning

---

**Need Help?** Read `ADMIN_PORTAL_SETUP.md` for detailed instructions!
