# Admin Dashboard Guide

## 🏠 Main Dashboard

**URL:** http://localhost:3000/admin/lms-dashboard.html  
(or http://localhost:3000/admin/index.html - auto-redirects)

### Top Navigation:
- 📊 **Dashboard** - Overview and stats
- 📚 **Modules** - Content management  
- 👥 **Users** - User progress tracking
- 👥 **Manage Users** - Add/Delete users (NEW!)
- 🤖 **AI Assistant** - Test chat interface

---

## 👥 User Management (NEW!)

**URL:** http://localhost:3000/admin/user-management.html

### Features:

**Add User:**
1. Click **➕ Add User**
2. Enter Name (e.g., "Karthi")
3. Enter WhatsApp (e.g., "+18016809129")
4. User starts with Module 1

**Delete User:**
1. Click **Delete** button
2. Confirm deletion
3. Removes all user data

**Search/Filter:**
- Search by name or phone
- Filter: All / Active / Inactive

---

## 📊 Dashboard Metrics

### Stats Fixed:
**"Completions" now shows:** Count of users who completed at least 1 module  
(Was showing "0000000000" - bug fixed ✅)

- **Total Users** - All registered
- **Active Users** - Active in last 7 days
- **Completions** - Users with module completions

---

## 🔧 Common Tasks

### Add WhatsApp User:
```
1. Go to: /admin/user-management.html
2. Click "➕ Add User"
3. Enter details
4. ✅ Done
```

### Delete User:
```
1. Go to: /admin/user-management.html
2. Find user in table
3. Click "Delete"
4. Confirm
5. ✅ Removed
```

### View Progress:
```
1. Go to: /admin/lms-dashboard.html
2. Click "Users" tab
3. See all user progress
```

---

## 📝 Admin Pages

| Page | URL |
|------|-----|
| Dashboard | `/admin/lms-dashboard.html` |
| Manage Users | `/admin/user-management.html` |
| User Progress | `/admin/users.html` |
| AI Chat | `/admin/chat.html` |

---

**Main:** http://localhost:3000/admin/lms-dashboard.html  
**Users:** http://localhost:3000/admin/user-management.html
