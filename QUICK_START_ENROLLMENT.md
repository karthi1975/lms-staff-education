# Quick Start: PIN Enrollment System

## ✅ System Status: READY FOR USE

All enrollment infrastructure is implemented and tested. The database is clean and ready for your courses.

---

## What's Working

✅ **Admin can enroll users with 4-digit PINs**
✅ **Users verify PINs via WhatsApp**
✅ **System gates access based on enrollment**
✅ **Security: PIN hashing, attempts, expiry**
✅ **Full audit trail maintained**

---

## Quick Test (Already Done)

```
✅ Created user: John Teacher (+254712345678)
✅ Generated PIN: 4615 (hashed with bcrypt)
✅ Verified PIN: User activated successfully
✅ Status changed: pending → active
```

---

## How to Use

### 1. Enroll a User

**Via Admin Portal** (Easiest):
1. Go to: `http://localhost:3000/admin/users.html`
2. Click "Enroll New User"
3. Enter name and phone (+254XXXXXXXXX)
4. Copy the PIN shown in the modal
5. Share PIN with user

**Via API**:
```bash
# Get token first
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"YOUR_PASSWORD"}'

# Enroll user
curl -X POST http://localhost:3000/api/admin/users/enroll \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Student Name","phoneNumber":"+254XXXXXXXXX"}'
```

### 2. User Activates via WhatsApp

**User sends**: "Hello" (or any message)

**Bot responds**: "Welcome! Please verify your identity by sending your *4-digit PIN*"

**User sends**: "1234" (their PIN)

**Bot responds** (if correct): "🎉 Account Activated! Welcome to Teachers Training..."

---

## Next Steps

### 1. Create Your Courses

```bash
# Via admin portal
http://localhost:3000/admin/lms-dashboard.html

# Create course → Add modules → Upload content
```

### 2. Upload Training Content

- PDFs (text-based or scanned)
- DOCX files
- TXT files

System will automatically:
- Extract text
- Generate embeddings
- Store in ChromaDB for RAG
- Build knowledge graph

### 3. Upload Quizzes

```bash
# You have quiz files ready in:
quizzes/CORRECT_MODULES/module_01_production.json
quizzes/CORRECT_MODULES/module_02_financing.json
# ... etc

# Upload via admin portal per module
```

### 4. Enroll Real Students

Use admin portal to:
- Add students
- Get their PINs
- Distribute PINs via SMS/email
- Students activate via WhatsApp

---

## Security Features

✅ **PIN Hashing**: bcrypt with 10 salt rounds
✅ **Attempt Limiting**: 3 attempts max
✅ **Auto-Block**: After failed attempts
✅ **Expiry**: 7 days from enrollment
✅ **Access Gating**: Only active users can chat

---

## Troubleshooting

**User can't verify PIN?**
```bash
# Check in database
docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training -c \
  "SELECT * FROM users WHERE whatsapp_id = '+254XXXXXXXXX'"

# Reset PIN via admin portal or API
POST /api/admin/users/+254XXXXXXXXX/reset-pin
```

**System not responding?**
```bash
# Check health
curl http://localhost:3000/health

# Check logs
docker logs teachers_training-app-1 --tail 50
```

---

## Files Created/Modified

✅ `services/enrollment.service.js` - PIN enrollment logic
✅ `routes/admin.routes.js` - Admin enrollment endpoints
✅ `services/whatsapp-handler.service.js` - WhatsApp PIN verification
✅ `public/admin/users.html` - Enrollment UI
✅ `test-enrollment-flow.sh` - Test script
✅ `ENROLLMENT_VALIDATION_REPORT.md` - Full documentation

---

## Database Schema

```sql
-- Users table has enrollment fields:
enrollment_pin         VARCHAR(60)  -- Hashed PIN
enrollment_status      VARCHAR(20)  -- 'pending'|'active'|'blocked'
pin_attempts           INTEGER      -- Remaining attempts (default 3)
pin_expires_at         TIMESTAMP    -- 7 days from enrollment
enrolled_by            INTEGER      -- Admin who enrolled
enrolled_at            TIMESTAMP    -- Enrollment date
is_verified            BOOLEAN      -- Verified via PIN?

-- Enrollment history tracks all actions
CREATE TABLE enrollment_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(50),  -- 'enrolled', 'pin_verified', 'blocked', etc
  performed_by INTEGER REFERENCES admin_users(id),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Ready to Go! 🚀

1. ✅ Enrollment system: **WORKING**
2. ⚠️ Courses: **READY FOR YOU TO CREATE**
3. ⚠️ Content: **READY FOR YOU TO UPLOAD**
4. ⚠️ Students: **READY FOR YOU TO ENROLL**

**Start with**: Create a course in the admin portal!

---

**Questions?** See `ENROLLMENT_VALIDATION_REPORT.md` for full details.
