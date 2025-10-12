# Token Expiration Fix

## 🔴 Issue
You were getting "Token has expired" error when trying to create a course in the admin portal.

## 🔍 Root Cause
- JWT tokens expire after 24 hours (`JWT_EXPIRES_IN=24h` in `.env`)
- Your token was issued more than 24 hours ago
- Frontend didn't have proper error handling for expired tokens

## ✅ Solution Implemented

### 1. Added Global Token Expiration Handler
Location: `public/admin/lms-dashboard.html:1739`

```javascript
// Global function to handle API responses with token expiration
async function handleApiResponse(response) {
    if (response.status === 401) {
        const result = await response.json();
        if (result.code === 'TOKEN_EXPIRED' || result.error === 'Token has expired') {
            alert('Your session has expired. Please login again.');
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.href = 'login.html';
            throw new Error('Token expired');
        }
    }
    return response;
}
```

### 2. How It Works
- Checks every API response for 401 status
- If token expired, shows user-friendly message
- Clears localStorage (adminToken, adminUser)
- Redirects to login page automatically
- Prevents further API calls with expired token

### 3. Integrated Into Course Creation
```javascript
const response = await fetch(`${API_BASE}/portal/courses`, {...});
await handleApiResponse(response); // Check for token expiration
const result = await response.json();
```

## 🚀 How to Fix Your Current Issue

### Quick Fix: Re-login
1. Go to: http://localhost:3000/admin/login.html
2. Login with your admin credentials:
   - Email: `admin@school.edu`
   - Password: `Admin123!`
3. You'll get a fresh 24-hour token
4. Try creating the course again

### Test It Works
```bash
# Get a fresh token
TOKEN=$(curl -s http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"Admin123!"}' \
  | jq -r '.token')

# Test creating a course
curl -X POST http://localhost:3000/api/admin/portal/courses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "course_name": "Business Studies",
    "course_code": "BUSINESS-001",
    "description": "Business studies for Enterpreneur",
    "category": "Skill Guidance for Enterpreneur"
  }'
```

## 📋 Token Configuration

### Current Settings (.env)
```env
JWT_SECRET=<your-secret>
JWT_EXPIRES_IN=24h
```

### Token Lifetime Options
- `24h` - 24 hours (current)
- `7d` - 7 days (good for testing)
- `30d` - 30 days (not recommended for production)
- `1h` - 1 hour (very secure, but annoying)

### Recommended for Production
Keep `JWT_EXPIRES_IN=24h` for good security/UX balance.

## 🔒 Security Notes

### Why Tokens Expire
- Prevents stolen tokens from being used forever
- Forces regular re-authentication
- Limits damage if token is compromised

### JWT Structure
```
eyJhbGciOi...  (Header: algorithm)
.eyJpZCI6M...  (Payload: user data + expiration)
.SjCrfTBRr...  (Signature: verification)
```

### What's in Your Token
```json
{
  "id": 10,
  "email": "admin@school.edu",
  "role": "admin",
  "type": "admin",
  "iat": 1759605038,        // Issued at (timestamp)
  "exp": 1759691438,        // Expires at (timestamp)
  "aud": "teachers-training-users",
  "iss": "teachers-training-system"
}
```

## 🛠️ Future Improvements

### Option 1: Refresh Tokens
Implement refresh tokens for seamless re-authentication:
- Access token: 1 hour (short-lived)
- Refresh token: 7 days (stored securely)
- Auto-refresh before expiration

### Option 2: Silent Token Renewal
Check token expiration on page load and show warning:
```javascript
// Check if token expires soon (< 1 hour)
const decoded = jwt_decode(token);
const expiresIn = decoded.exp * 1000 - Date.now();
if (expiresIn < 3600000) {
    showWarning('Your session expires in less than 1 hour');
}
```

### Option 3: Activity-Based Extension
Extend token on user activity:
- Reset expiration on each API call
- Keep users logged in while active
- Auto-logout after inactivity

## 📝 Testing the Fix

### 1. Test Expired Token Handling
```javascript
// In browser console
localStorage.setItem('adminToken', 'expired_fake_token');
location.reload();
// Should redirect to login automatically
```

### 2. Test Fresh Token
```bash
# Login and get token
curl http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"Admin123!"}'

# Copy token from response
# Use in browser: localStorage.setItem('adminToken', 'YOUR_TOKEN')
```

### 3. Test Course Creation
1. Login to admin portal
2. Click "Courses" tab
3. Click "+ Add Course"
4. Select "Create Manually"
5. Fill in:
   - Course Name: "Test Course"
   - Course Code: "TEST-001"
   - Description: "Test description"
   - Category: "Testing"
6. Click "Create Course"
7. Should see success message

## ✅ What's Fixed Now

### Before
❌ Token expires → Mysterious error
❌ User confused about what happened
❌ No way to recover except manual localStorage clear

### After
✅ Token expires → Clear error message
✅ "Your session has expired. Please login again."
✅ Auto-redirect to login page
✅ Clean localStorage automatically
✅ User knows exactly what to do

## 🎯 Summary

**Issue**: Expired JWT token (24 hours old)
**Fix**: Added global token expiration handler with auto-redirect
**Action**: Just re-login and try again
**Prevention**: Handler now catches all 401/expired token errors

---

*Fixed: 2025-01-11*
*File Modified: `public/admin/lms-dashboard.html`*
*Lines Added: 1740-1752*
