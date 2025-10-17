# User Registration & PIN Verification Wiring Report

## Executive Summary

**Status**: WIRING MISMATCH DETECTED ❌

The user registration and PIN verification flow has a critical mismatch between the admin API and WhatsApp handler services. There are TWO different services handling enrollment, causing the flow to break.

## The Problem

### Two Different Services

1. **verification.service.js** (OLD)
   - Generates **6-digit** codes
   - Stores codes in **memory** (Map)
   - No database persistence
   - Used by: `/api/users` endpoint (server.js:330)

2. **enrollment.service.js** (NEW)
   - Generates **4-digit** PINs
   - Stores PINs in **PostgreSQL database**
   - Hashes PINs with bcrypt
   - Used by: WhatsApp handler (whatsapp-handler.service.js:33)

### The Flow Breakdown

#### Current (Broken) Flow:
1. ✅ Admin calls `/api/users` with name + phone
2. ✅ `verification.service` generates 6-digit code (e.g., "882940")
3. ✅ Code sent via WhatsApp successfully
4. ✅ Code stored in memory Map
5. ❌ User sends code via WhatsApp
6. ❌ WhatsApp handler checks `enrollment.service` (not verification.service!)
7. ❌ No enrollment found in database → "User not enrolled" error

#### Expected Flow:
1. Admin calls `/api/users` with name + phone
2. `enrollment.service` generates 4-digit PIN (e.g., "7342")
3. PIN hashed and stored in PostgreSQL database
4. PIN sent via WhatsApp
5. User sends PIN via WhatsApp
6. WhatsApp handler validates PIN via `enrollment.service`
7. User account activated

## Test Results

### Test 1: Admin User Creation ✅
```bash
POST /api/users
Body: { "name": "Lynda Test", "whatsapp_id": "+254724444625" }

Response:
{
  "success": true,
  "verification_code": "882940",
  "phone_number": "+254724444625",
  "expires_at": "2025-10-17T04:50:24.246Z",
  "message": "Verification code sent to user via WhatsApp"
}
```
**Result**: Code generated and WhatsApp message sent (SID: SM49685701238c9a76f510b33e8b6fc2ea)

### Test 2: Database Check ❌
```sql
SELECT * FROM users WHERE whatsapp_id = '+254724444625';
-- Result: 0 rows (NO USER CREATED)

SELECT * FROM verification_codes WHERE whatsapp_id = '+254724444625';
-- Result: 0 rows (NO CODE IN DATABASE)
```
**Result**: No database persistence - verification.service uses in-memory storage

### Test 3: WhatsApp PIN Verification ❌
```
User sends: "HI 882940"
System response: "❌ This number is not enrolled. Please contact your administrator to register."
```
**Result**: WhatsApp handler uses enrollment.service which finds no user in database

## Root Cause

The `/api/users` endpoint (server.js:330-360) is using the wrong service:

```javascript
// CURRENT (WRONG)
const verificationService = require('./services/verification.service');
const result = await verificationService.createUserAndSendCode(name, whatsapp_id);

// SHOULD BE
const enrollmentService = require('./services/enrollment.service');
const result = await enrollmentService.enrollUser(name, whatsapp_id, adminId);
```

## Fix Required

### File: server.js (line 330-360)

**Change needed:**
1. Import `enrollment.service` instead of `verification.service`
2. Call `enrollmentService.enrollUser()` with admin ID
3. Update response format to match enrollment service

### Before (Current):
```javascript
const verificationService = require('./services/verification.service');
const result = await verificationService.createUserAndSendCode(name, whatsapp_id);
```

### After (Fixed):
```javascript
const enrollmentService = require('./services/enrollment.service');

// Get admin ID from authenticated session or use default
const adminId = req.user?.id || 1; // Default admin ID

const result = await enrollmentService.enrollUser(name, whatsapp_id, adminId);
```

## Impact

### Critical User Journeys Affected:
- ❌ Admin cannot successfully register new users
- ❌ WhatsApp users cannot complete verification
- ❌ No users can access the learning system via WhatsApp

### Services Still Working:
- ✅ WhatsApp message sending (Twilio integration)
- ✅ Admin API endpoint accepting requests
- ✅ Database schema and enrollment service logic
- ✅ ChromaDB RAG pipeline
- ✅ Neo4j GraphDB

## Recommendation

**Priority**: CRITICAL - Fix immediately

**Estimated Fix Time**: 5-10 minutes

**Testing Required After Fix**:
1. Admin creates user → verify PIN stored in database
2. User sends PIN via WhatsApp → verify account activated
3. User sends greeting → verify welcome message received
4. User asks question → verify RAG response

## Migration Notes

The `verification.service.js` appears to be legacy code that should be deprecated. The newer `enrollment.service.js` has:
- ✅ Database persistence
- ✅ PIN hashing (security)
- ✅ Attempt tracking
- ✅ Audit trail (enrollment_history)
- ✅ PIN expiry
- ✅ Account blocking

**Recommendation**: Update all references to use enrollment.service and deprecate verification.service

---

*Report generated: 2025-10-17*
*Test environment: GCP VM (teachers-training, us-east5-a)*
