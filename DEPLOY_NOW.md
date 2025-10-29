# Deploy Dashboard Number Fix - Commands to Run NOW

You're already SSH'd into GCP. Run these commands:

```bash
# 1. Go to project directory
cd /home/karthi/teachers_training

# 2. Pull latest code from GitHub
git pull origin feature/course-management-ui

# 3. Deploy dashboard.html to Docker container
docker cp public/admin/dashboard.html teachers_training-app-1:/app/public/admin/dashboard.html

# 4. Deploy users.html to Docker container
docker cp public/admin/users.html teachers_training-app-1:/app/public/admin/users.html

# 5. Verify the fix is deployed
docker exec teachers_training-app-1 grep -q "parseInt(u.modules_completed)" /app/public/admin/dashboard.html && echo "✅ Fix deployed successfully!" || echo "❌ Fix not found"

# Done!
```

Then test:
- Open: http://34.162.136.203:3000/admin/dashboard.html
- Check "Modules Completed" stat (should show correct number like "3", not "02100000")
