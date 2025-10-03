# User Progress Login Guide

## Overview
Users (teachers) can now view their training progress through a web interface using their WhatsApp number.

## User Access

### Login URL
```
http://localhost:3000/user-login.html
```

### How to Login
1. Navigate to the user login page
2. Enter WhatsApp number with country code
   - Example: `+1234567890`
   - Format: Must start with `+` followed by country code
3. Click "View My Progress"

### Test Users
From the database seed data, these WhatsApp users are available:

| Name | WhatsApp Number |
|------|----------------|
| John Teacher | +1234567890 |
| Jane Educator | +0987654321 |
| Sarah Johnson | +14155551234 |
| Michael Chen | +14155551235 |
| Emily Rodriguez | +14155551236 |
| David Kim | +14155551237 |
| Maria Garcia | +14155551238 |
| James Wilson | +14155551239 |

## User Progress Dashboard

### Overview Cards (Top Section)
Shows summary statistics:
- **Completed**: Number of modules finished
- **In Progress**: Number of modules currently working on
- **Quizzes Passed**: Total quiz attempts that passed
- **Total Time**: Combined time spent across all modules

### Module Cards
Each module displays:

**Header**
- Module number and title
- Description
- Status badge:
  - ✅ **Completed**: Module finished
  - 🔄 **In Progress**: Currently working on
  - ⚪ **Not Started**: Not yet begun

**Progress Bar**
- Visual representation of completion percentage
- Shows exact percentage value

**Statistics**
- Time Spent: Hours and minutes spent on the module
- Started: Date when module was first accessed
- Completed: Date when module was finished (if applicable)

**Quiz Attempts** (if any)
- Attempt number
- Score (e.g., 8/10)
- Pass/Fail status
- Visual indicators:
  - ✓ Green for passed
  - ✗ Red for failed

## Features

### No Registration Required
- Users login directly with WhatsApp number
- No password needed
- Auto-redirect if already logged in

### Real-Time Progress
- Shows current progress from database
- Updates reflect WhatsApp interactions
- Refresh page to see latest data

### Mobile Responsive
- Works on phones, tablets, and desktops
- Optimized for mobile viewing

### Secure
- Users can only view their own progress
- WhatsApp number validation
- Session management via localStorage

## Admin vs User Access

### Admin Portal (`/admin/login.html`)
- Requires email and password
- Can view all users
- Can upload content
- Can manage modules
- Full system access

### User Portal (`/user-login.html`)
- Requires only WhatsApp number
- Can view only own progress
- Read-only access
- No management capabilities

## Technical Details

### API Endpoints Used
- `POST /api/user/verify` - Verify WhatsApp number
- `GET /api/admin/users/:userId/progress` - Get user progress (with guest token)

### Authentication
- User login uses simplified guest token
- Format: `guest-token-{userId}`
- Stored in localStorage
- No expiration (session-based)

### Data Stored Locally
- `userId` - User database ID
- `userName` - User's name
- `userWhatsappId` - WhatsApp number

### Logout
- Clears localStorage
- Redirects to login page
- No server-side session termination needed

## Progress Tracking

### Module Status States
1. **Not Started** (`not_started`)
   - User hasn't interacted with module
   - 0% progress
   - No time tracked

2. **In Progress** (`in_progress`)
   - User has begun module
   - 1-99% progress
   - Time tracking active
   - May have quiz attempts

3. **Completed** (`completed`)
   - User finished module
   - 100% progress
   - Final completion date recorded
   - All quiz requirements met

### Progress Calculation
- Automatically tracked via WhatsApp interactions
- Updated by orchestrator service
- Includes:
  - Content consumption
  - Quiz completion
  - Time spent
  - Evidence submission

## Troubleshooting

### "User not found" Error
- Verify WhatsApp number format (must include +)
- Check number is in database
- Contact administrator to add user

### Progress Not Showing
- Ensure user has interacted via WhatsApp
- Refresh the page
- Check database for user_progress entries

### Can't Login
- Verify WhatsApp number matches database exactly
- Check browser console for errors
- Clear localStorage and try again

### Page Not Loading
- Ensure server is running
- Check URL is correct
- Verify PostgreSQL database is connected

## Next Steps

Users should:
1. Bookmark the login page for easy access
2. Check progress regularly to stay motivated
3. Continue training via WhatsApp
4. Contact admin if progress seems incorrect

---

*For admin access and content management, see ADMIN_GUIDE.md*
