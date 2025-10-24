# GCP Instance HTTPS & Domain Name Setup Guide

## Overview

This guide will help you:
1. Get a domain name (or use an existing one)
2. Point the domain to your GCP instance
3. Set up HTTPS with free SSL certificate (Let's Encrypt)
4. Configure nginx as reverse proxy
5. Update your application to use HTTPS

---

## Prerequisites

- ✅ GCP Instance running: `teachers-training` (34.162.136.203)
- ✅ Application running on port 3000
- ✅ SSH access to GCP instance
- ⏳ Domain name (we'll get this)
- ⏳ SSL certificate (we'll get this free)

---

## Step 1: Get a Domain Name

### Option A: Register a New Domain

**Popular Domain Registrars:**

1. **Namecheap** (https://www.namecheap.com)
   - Cost: ~$8-15/year
   - Easy to use
   - Good support

2. **Google Domains** (https://domains.google)
   - Cost: ~$12/year
   - Integrated with GCP
   - Simple DNS management

3. **Cloudflare Registrar** (https://www.cloudflare.com/products/registrar/)
   - Cost: At-cost pricing (~$8-10/year)
   - Free CDN and DDoS protection
   - Great performance

4. **GoDaddy** (https://www.godaddy.com)
   - Cost: ~$12-20/year
   - Well-known
   - 24/7 support

**Recommended Domain Names:**
- `teachers-training.com`
- `teachersedu.org`
- `lms-tanzania.com`
- `staffedu.net`

### Option B: Use Existing Domain

If you already have a domain, you can:
- Use the main domain (e.g., `example.com`)
- Create a subdomain (e.g., `lms.example.com`)

---

## Step 2: Reserve a Static IP Address in GCP

Currently, your instance uses an ephemeral IP that can change. Let's make it permanent.

```bash
# 1. Reserve a static IP address
gcloud compute addresses create teachers-training-ip \
  --region=us-east5 \
  --project=lms-tanzania-consultant

# 2. Get the IP address
gcloud compute addresses describe teachers-training-ip \
  --region=us-east5 \
  --project=lms-tanzania-consultant \
  --format="get(address)"

# 3. Stop the instance
gcloud compute instances stop teachers-training \
  --zone=us-east5-a \
  --project=lms-tanzania-consultant

# 4. Assign the static IP to the instance
gcloud compute instances delete-access-config teachers-training \
  --zone=us-east5-a \
  --access-config-name="external-nat" \
  --project=lms-tanzania-consultant

gcloud compute instances add-access-config teachers-training \
  --zone=us-east5-a \
  --access-config-name="external-nat" \
  --address=teachers-training-ip \
  --project=lms-tanzania-consultant

# 5. Start the instance
gcloud compute instances start teachers-training \
  --zone=us-east5-a \
  --project=lms-tanzania-consultant
```

**Note**: After this, your static IP will remain `34.162.136.203` (or similar).

---

## Step 3: Point Your Domain to GCP IP

### In Your Domain Registrar's DNS Settings:

1. **Login** to your domain registrar (Namecheap, GoDaddy, etc.)
2. **Go to DNS Management** for your domain
3. **Add/Edit DNS Records**:

#### For Root Domain (example.com):

```
Type    Host    Value                   TTL
A       @       34.162.136.203          300
A       www     34.162.136.203          300
```

#### For Subdomain (lms.example.com):

```
Type    Host    Value                   TTL
A       lms     34.162.136.203          300
```

**TTL**: 300 seconds (5 minutes) for testing, increase to 3600 later

### Example: Namecheap

1. Login → Dashboard
2. Select your domain → Manage
3. Advanced DNS tab
4. Add New Record:
   - Type: `A Record`
   - Host: `@` (for root) or `lms` (for subdomain)
   - Value: `34.162.136.203`
   - TTL: `Automatic`

### Example: Cloudflare

1. Login → Select your domain
2. DNS → Records
3. Add record:
   - Type: `A`
   - Name: `@` or `lms`
   - IPv4 address: `34.162.136.203`
   - Proxy status: ☁️ Proxied (optional, for CDN)
   - TTL: `Auto`

### Verify DNS Propagation

```bash
# Wait 5-10 minutes, then test:
nslookup your-domain.com
# or
dig your-domain.com

# Expected output:
# your-domain.com    300    IN    A    34.162.136.203
```

**Online Tools:**
- https://dnschecker.org
- https://www.whatsmydns.net

---

## Step 4: Install Nginx on GCP Instance

SSH into your GCP instance:

```bash
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant"
```

Install nginx:

```bash
# Update package list
sudo apt update

# Install nginx
sudo apt install -y nginx

# Check nginx status
sudo systemctl status nginx

# Enable nginx to start on boot
sudo systemctl enable nginx

# Allow HTTP and HTTPS through firewall
sudo ufw allow 'Nginx Full'
```

Test nginx is working:
```bash
curl http://localhost
# Should see "Welcome to nginx!"
```

---

## Step 5: Configure Nginx as Reverse Proxy

Create nginx configuration for your application:

```bash
# Remove default config
sudo rm /etc/nginx/sites-enabled/default

# Create new config
sudo nano /etc/nginx/sites-available/teachers-training
```

**Paste this configuration** (replace `your-domain.com` with your actual domain):

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Redirect all HTTP to HTTPS (will be enabled after SSL setup)
    # return 301 https://$server_name$request_uri;

    # Temporary: Proxy to Node.js app
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Increase timeouts for long-running requests
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }

    # WhatsApp webhook endpoint
    location /webhook {
        proxy_pass http://localhost:3000/webhook;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }

    # Client max body size (for file uploads)
    client_max_body_size 50M;
}
```

**Enable the configuration:**

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/teachers-training /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# If test passes, reload nginx
sudo systemctl reload nginx
```

**Test HTTP access:**

```bash
# From your local machine
curl http://your-domain.com/health

# Expected: {"status":"healthy",...}
```

---

## Step 6: Install SSL Certificate (Let's Encrypt)

Install Certbot (Let's Encrypt client):

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow the prompts:
# - Enter email address (for renewal notifications)
# - Agree to Terms of Service: Yes
# - Share email with EFF: Your choice
# - Redirect HTTP to HTTPS: Yes (recommended)
```

**Certbot will:**
1. Verify you own the domain
2. Generate SSL certificate
3. Automatically update nginx config
4. Set up HTTPS redirect

**Test HTTPS:**

```bash
# From your local machine
curl https://your-domain.com/health

# Open in browser
https://your-domain.com
```

---

## Step 7: Auto-Renewal Setup

Let's Encrypt certificates expire after 90 days. Certbot sets up auto-renewal.

**Test auto-renewal:**

```bash
# Dry run (doesn't actually renew)
sudo certbot renew --dry-run

# If successful, auto-renewal is configured!
```

**Check renewal timer:**

```bash
# Certbot installs a systemd timer
sudo systemctl list-timers | grep certbot

# Expected output:
# Wed 2025-10-24 12:00:00 UTC  certbot.timer
```

**Manual renewal (if needed):**

```bash
sudo certbot renew
sudo systemctl reload nginx
```

---

## Step 8: Update GCP Firewall Rules

Ensure HTTPS traffic is allowed:

```bash
# Allow HTTPS (port 443)
gcloud compute firewall-rules create allow-https \
  --allow tcp:443 \
  --source-ranges 0.0.0.0/0 \
  --target-tags http-server \
  --project lms-tanzania-consultant

# Verify firewall rules
gcloud compute firewall-rules list --project lms-tanzania-consultant
```

**Or via GCP Console:**
1. Go to VPC Network → Firewall
2. Create Firewall Rule:
   - Name: `allow-https`
   - Targets: `All instances in the network`
   - Source IP ranges: `0.0.0.0/0`
   - Protocols and ports: `tcp:443`
   - Action: `Allow`

---

## Step 9: Update Application Configuration

Update your application to use the new domain.

### On GCP Server:

```bash
# SSH to server
gcloud compute ssh --zone "us-east5-a" "teachers-training" --project "lms-tanzania-consultant"

cd /home/karthi/teachers_training

# Update environment variables
nano .env
```

**Add/Update:**

```env
# Domain Configuration
DOMAIN=your-domain.com
BASE_URL=https://your-domain.com

# Frontend URLs (if needed)
FRONTEND_URL=https://your-domain.com
ADMIN_URL=https://your-domain.com/admin

# WhatsApp Webhook (update in Twilio console)
WEBHOOK_URL=https://your-domain.com/webhook/whatsapp

# CORS Configuration
CORS_ORIGIN=https://your-domain.com
```

**Restart Docker containers:**

```bash
docker-compose restart
```

---

## Step 10: Update Twilio WhatsApp Webhook URL

1. Login to **Twilio Console**: https://console.twilio.com
2. Go to **Messaging** → **Try it Out** → **Send a WhatsApp message**
3. Select your WhatsApp number: `+1 806 515 7636`
4. Scroll to **Webhook Configuration**
5. Update webhook URL:
   - **When a message comes in**: `https://your-domain.com/webhook/whatsapp`
   - **HTTP Method**: POST

**Test webhook:**

```bash
# Send test message from your phone to +1 806 515 7636
# Check server logs
docker logs teachers_training-app-1 -f --tail 50
```

---

## Step 11: Test Everything

### 1. Test HTTPS Website

```bash
# From local machine
curl -I https://your-domain.com

# Expected:
# HTTP/2 200
# server: nginx
```

### 2. Test Admin Portal

Open in browser:
- https://your-domain.com/admin/login.html
- Should show login page with 🔒 padlock in browser

### 3. Test WhatsApp Webhook

Send message to WhatsApp bot and check logs:

```bash
docker logs teachers_training-app-1 -f | grep -i webhook
```

### 4. Test Health Endpoint

```bash
curl https://your-domain.com/health

# Expected:
# {"status":"healthy","services":{"postgres":"healthy","neo4j":"healthy","chroma":"healthy"}}
```

### 5. Test SSL Certificate

Check SSL rating:
- https://www.ssllabs.com/ssltest/
- Enter your domain
- Should get A or A+ rating

---

## Troubleshooting

### Issue: Domain not resolving

```bash
# Check DNS propagation
nslookup your-domain.com
dig your-domain.com

# If not working:
# - Wait 10-30 minutes for DNS propagation
# - Verify DNS records in registrar
# - Check TTL is not too high
```

### Issue: SSL certificate failed

```bash
# Check certbot logs
sudo tail -f /var/log/letsencrypt/letsencrypt.log

# Common fixes:
# 1. Ensure port 80 is open (required for verification)
sudo ufw allow 80

# 2. Check nginx is serving on port 80
curl http://your-domain.com

# 3. Try manual DNS challenge instead of HTTP
sudo certbot certonly --manual --preferred-challenges dns -d your-domain.com
```

### Issue: nginx not starting

```bash
# Check nginx config
sudo nginx -t

# Check nginx logs
sudo tail -f /var/log/nginx/error.log

# Common fix: SELinux issues
sudo setsebool -P httpd_can_network_connect 1
```

### Issue: Application not accessible

```bash
# Check if app is running
docker ps

# Check app logs
docker logs teachers_training-app-1 --tail 100

# Check nginx is proxying correctly
curl -I http://localhost:3000
curl -I http://localhost (should proxy to :3000)
```

---

## Security Enhancements

### 1. Enable HTTP/2

Already enabled in the nginx config above!

### 2. Add Security Headers

Edit nginx config:

```bash
sudo nano /etc/nginx/sites-available/teachers-training
```

Add inside `server` block:

```nginx
# Security headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
```

Reload nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 3. Rate Limiting

Add to nginx config:

```nginx
# Rate limiting zone
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

# Apply to API endpoints
location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://localhost:3000;
    # ... other proxy settings ...
}
```

---

## Cost Summary

| Item | Cost | Notes |
|------|------|-------|
| Domain Name | $8-15/year | Namecheap, Google Domains |
| Static IP | ~$3-7/month | GCP charges for reserved IPs |
| SSL Certificate | FREE | Let's Encrypt |
| **Total** | **~$40-100/year** | Depends on domain registrar |

---

## Quick Reference Commands

### Renew SSL Certificate

```bash
sudo certbot renew
sudo systemctl reload nginx
```

### Check Certificate Expiry

```bash
sudo certbot certificates
```

### Update Nginx Config

```bash
sudo nano /etc/nginx/sites-available/teachers-training
sudo nginx -t
sudo systemctl reload nginx
```

### View Logs

```bash
# Nginx access log
sudo tail -f /var/log/nginx/access.log

# Nginx error log
sudo tail -f /var/log/nginx/error.log

# Application logs
docker logs teachers_training-app-1 -f
```

---

## Next Steps

After HTTPS is working:

1. ✅ Update all hardcoded URLs in frontend to use HTTPS
2. ✅ Update Twilio webhook to HTTPS
3. ✅ Test WhatsApp enrollment flow
4. ✅ Run endurance test against HTTPS domain
5. ✅ Set up monitoring (optional):
   - Uptime monitoring: https://uptimerobot.com (free)
   - SSL monitoring: https://sslmate.com/certspotter (free)
6. ✅ Enable Cloudflare CDN (optional, free tier available)

---

## Example: Complete Setup Script

Save as `setup-https.sh`:

```bash
#!/bin/bash

DOMAIN="your-domain.com"
WWW_DOMAIN="www.your-domain.com"
EMAIL="your-email@example.com"

echo "🔐 Setting up HTTPS for $DOMAIN"
echo "════════════════════════════════════════"

# 1. Install nginx
echo "📦 Installing nginx..."
sudo apt update
sudo apt install -y nginx

# 2. Configure nginx
echo "⚙️ Configuring nginx..."
sudo tee /etc/nginx/sites-available/teachers-training > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN $WWW_DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    client_max_body_size 50M;
}
EOF

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/teachers-training /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 3. Install certbot
echo "🔐 Installing certbot..."
sudo apt install -y certbot python3-certbot-nginx

# 4. Get SSL certificate
echo "📜 Obtaining SSL certificate..."
sudo certbot --nginx -d $DOMAIN -d $WWW_DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect

# 5. Test
echo "✅ Testing HTTPS..."
curl -I https://$DOMAIN

echo ""
echo "════════════════════════════════════════"
echo "✅ HTTPS Setup Complete!"
echo "════════════════════════════════════════"
echo ""
echo "🌐 Your site is now live at: https://$DOMAIN"
echo "🔒 SSL Certificate: Active (auto-renews)"
echo "📧 Renewal notifications: $EMAIL"
echo ""
```

---

**Ready to set up HTTPS? Follow the steps above!** 🚀

*Last Updated: 2025-10-23*
*For: Teachers Training System GCP Instance*
