# GCP Deployment Guide

## Quick Deployment from GitHub

### Option 1: Deploy from Local Machine (Recommended)

```bash
# Pull latest changes and deploy to GCP
./gcp-pull-and-deploy.sh remote
```

This will:
1. SSH into your GCP VM
2. Pull latest changes from GitHub
3. Rebuild Docker containers
4. Restart all services
5. Verify health

### Option 2: Deploy Directly on GCP VM

```bash
# SSH into GCP
gcloud compute ssh teachers-training --zone=us-east5-a --project=lms-tanzania-consultant

# Navigate to project directory
cd ~/teachers_training

# Pull and deploy
./gcp-pull-and-deploy.sh
```

## Complete Setup (First Time)

### 1. Set Twilio Credentials (Local Machine)

```bash
# Create .env.twilio with your credentials
source .env.twilio

# Run complete setup
./complete-gcp-setup.sh
```

### 2. Or Set Environment Variables Manually

```bash
export TWILIO_ACCOUNT_SID=your_account_sid
export TWILIO_AUTH_TOKEN=your_auth_token
export TWILIO_PHONE_NUMBER=+1234567890

./complete-gcp-setup.sh
```

## Deployment Workflow

### Making Changes

1. **Make changes locally**
   ```bash
   # Edit files
   vim routes/admin.routes.js
   ```

2. **Test locally** (optional)
   ```bash
   docker-compose up -d
   curl http://localhost:3000/health
   ```

3. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

4. **Push to GitHub**
   ```bash
   git push origin master
   ```

5. **Deploy to GCP**
   ```bash
   ./gcp-pull-and-deploy.sh remote
   ```

6. **Verify deployment**
   ```bash
   curl http://34.152.120.95:3000/health
   ```

## Important URLs

- **Admin Login**: http://34.152.120.95:3000/admin/login.html
- **Health Check**: http://34.152.120.95:3000/health
- **Twilio Webhook**: http://34.152.120.95:3000/webhook/twilio
- **Twilio Status**: http://34.152.120.95:3000/webhook/twilio/status

## Credentials

### Admin Login
- Email: `admin@school.edu`
- Password: `Admin123!`

### Twilio Configuration
Set these URLs in [Twilio Console](https://console.twilio.com):
1. **When a message comes in**: `http://34.152.120.95:3000/webhook/twilio` (POST)
2. **Status callback URL**: `http://34.152.120.95:3000/webhook/twilio/status` (POST)

## Monitoring

### View Container Status
```bash
gcloud compute ssh teachers-training --zone=us-east5-a -- 'cd ~/teachers_training && sudo docker-compose ps'
```

### View Application Logs
```bash
gcloud compute ssh teachers-training --zone=us-east5-a -- 'sudo docker logs -f teachers_training_app_1'
```

### View Health Status
```bash
curl http://34.152.120.95:3000/health | jq
```

## Troubleshooting

### Container Not Starting
```bash
# Check logs
sudo docker logs teachers_training_app_1

# Restart specific container
sudo docker-compose restart app
```

### Database Connection Issues
```bash
# Check PostgreSQL
sudo docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c "SELECT COUNT(*) FROM admin_users;"

# Check all databases
curl http://localhost:3000/health | jq
```

### Admin User Not Found
```bash
# Recreate admin user on GCP
gcloud compute ssh teachers-training --zone=us-east5-a -- "sudo docker exec teachers_training_postgres_1 psql -U teachers_user -d teachers_training -c \"INSERT INTO admin_users (email, password_hash, name, role, is_active, created_at, updated_at) VALUES ('admin@school.edu', '\\\$2b\\\$10\\\$c2AfudbBGIFHWO6dCCtopO2DwMDDx3cCZPF5tRlqy8wvAw8VRdF8a', 'System Admin', 'admin', true, NOW(), NOW()) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;\""
```

### Rebuild Containers from Scratch
```bash
cd ~/teachers_training
sudo docker-compose down -v  # WARNING: Deletes all data
sudo docker-compose up -d
```

## Scripts Reference

- `complete-gcp-setup.sh` - Full initial setup with service account
- `gcp-pull-and-deploy.sh` - Pull from GitHub and redeploy
- `test-gcp-login.sh` - Test admin login
- `scripts/generate-admin-hash.js` - Generate bcrypt password hash

## Environment Variables

### Required for GCP
- `GCP_PROJECT_ID` - lms-tanzania-consultant
- `VERTEX_AI_REGION` - us-east5
- `VERTEX_AI_MODEL` - meta/llama-4-maverick-17b-128e-instruct-maas

### Required for Twilio (set before deployment)
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

### Database (Docker internal)
- `DB_HOST` - postgres
- `DB_PORT` - 5432
- `DB_NAME` - teachers_training
- `DB_USER` - teachers_user
- `DB_PASSWORD` - teachers_pass_2024

## Security Notes

1. **Never commit** `.env` files or credentials to GitHub
2. **Always use** environment variables for secrets
3. **Keep** `.env.twilio` local only (in .gitignore)
4. **Rotate** JWT_SECRET in production
5. **Use HTTPS** in production (configure with nginx/Let's Encrypt)

## Next Steps

1. Configure domain name (optional)
2. Set up SSL/TLS with Let's Encrypt
3. Configure GitHub Actions for CI/CD (optional)
4. Set up monitoring and alerting
5. Configure backup strategy for databases
