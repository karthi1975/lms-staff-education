# HTTPS Setup Checklist

Quick reference checklist for setting up HTTPS on GCP instance.

## ☐ Phase 1: Domain Setup (15-30 minutes)

- [ ] **1.1** Register domain name (or use existing)
  - Recommended: Namecheap, Google Domains, or Cloudflare
  - Cost: ~$8-15/year
  - Domain suggestion: `teachers-training.com` or `lms-tanzania.com`

- [ ] **1.2** Reserve static IP in GCP
  ```bash
  gcloud compute addresses create teachers-training-ip \
    --region=us-east5 \
    --project=lms-tanzania-consultant
  ```

- [ ] **1.3** Assign static IP to instance
  ```bash
  # Get IP address first
  gcloud compute addresses describe teachers-training-ip \
    --region=us-east5 \
    --project=lms-tanzania-consultant \
    --format="get(address)"

  # Follow steps in GCP_HTTPS_DOMAIN_SETUP.md Step 2
  ```

- [ ] **1.4** Point domain DNS to GCP IP
  - Login to domain registrar
  - Add A record: `@` → `34.162.136.203`
  - Add A record: `www` → `34.162.136.203`
  - TTL: 300 seconds

- [ ] **1.5** Verify DNS propagation (wait 5-30 min)
  ```bash
  nslookup your-domain.com
  ```

## ☐ Phase 2: Nginx Setup (10-15 minutes)

- [ ] **2.1** SSH into GCP instance
  ```bash
  gcloud compute ssh --zone "us-east5-a" "teachers-training" \
    --project "lms-tanzania-consultant"
  ```

- [ ] **2.2** Install nginx
  ```bash
  sudo apt update
  sudo apt install -y nginx
  sudo systemctl enable nginx
  ```

- [ ] **2.3** Configure nginx reverse proxy
  - Create: `/etc/nginx/sites-available/teachers-training`
  - Use config from `GCP_HTTPS_DOMAIN_SETUP.md` Step 5
  - Replace `your-domain.com` with actual domain

- [ ] **2.4** Enable nginx config
  ```bash
  sudo ln -s /etc/nginx/sites-available/teachers-training \
             /etc/nginx/sites-enabled/
  sudo nginx -t
  sudo systemctl reload nginx
  ```

- [ ] **2.5** Test HTTP access
  ```bash
  curl http://your-domain.com/health
  ```

## ☐ Phase 3: SSL Certificate (5-10 minutes)

- [ ] **3.1** Install Certbot
  ```bash
  sudo apt install -y certbot python3-certbot-nginx
  ```

- [ ] **3.2** Obtain SSL certificate
  ```bash
  sudo certbot --nginx \
    -d your-domain.com \
    -d www.your-domain.com \
    --email your-email@example.com \
    --agree-tos \
    --redirect
  ```

- [ ] **3.3** Test HTTPS
  ```bash
  curl https://your-domain.com/health
  ```

- [ ] **3.4** Test auto-renewal
  ```bash
  sudo certbot renew --dry-run
  ```

## ☐ Phase 4: Firewall & Security (5 minutes)

- [ ] **4.1** Allow HTTPS in GCP firewall
  ```bash
  gcloud compute firewall-rules create allow-https \
    --allow tcp:443 \
    --source-ranges 0.0.0.0/0 \
    --target-tags http-server \
    --project lms-tanzania-consultant
  ```

- [ ] **4.2** Update nginx security headers
  - Add headers from `GCP_HTTPS_DOMAIN_SETUP.md` Security section
  - Reload nginx

- [ ] **4.3** Test SSL rating
  - Visit: https://www.ssllabs.com/ssltest/
  - Enter your domain
  - Should get A or A+ rating

## ☐ Phase 5: Application Update (10 minutes)

- [ ] **5.1** Update .env file on server
  ```bash
  cd /home/karthi/teachers_training
  nano .env
  ```
  Add:
  ```env
  DOMAIN=your-domain.com
  BASE_URL=https://your-domain.com
  WEBHOOK_URL=https://your-domain.com/webhook/whatsapp
  ```

- [ ] **5.2** Restart Docker containers
  ```bash
  docker-compose restart
  ```

- [ ] **5.3** Update Twilio webhook URL
  - Login: https://console.twilio.com
  - WhatsApp number: +1 806 515 7636
  - Webhook: `https://your-domain.com/webhook/whatsapp`

- [ ] **5.4** Update frontend URLs (if hardcoded)
  - Search codebase for `34.162.136.203`
  - Replace with `your-domain.com`

## ☐ Phase 6: Testing (15 minutes)

- [ ] **6.1** Test admin portal
  - URL: https://your-domain.com/admin/login.html
  - Should show 🔒 padlock
  - Login works

- [ ] **6.2** Test WhatsApp webhook
  - Send message to +1 806 515 7636
  - Check logs: `docker logs teachers_training-app-1 -f`
  - Bot responds

- [ ] **6.3** Test enrollment flow
  - Use: `./test-whatsapp-enrollment-live.sh`
  - Update script to use HTTPS domain

- [ ] **6.4** Test all API endpoints
  ```bash
  curl https://your-domain.com/health
  curl https://your-domain.com/api/courses
  ```

- [ ] **6.5** Run endurance test
  - Update `BASE_URL` in test to use HTTPS
  - Run: `./run-endurance-test-comprehensive.sh`

## ☐ Phase 7: Monitoring (Optional, 10 minutes)

- [ ] **7.1** Set up uptime monitoring
  - Sign up: https://uptimerobot.com (free)
  - Add monitor: `https://your-domain.com/health`

- [ ] **7.2** Set up SSL monitoring
  - Sign up: https://sslmate.com/certspotter (free)
  - Monitor: `your-domain.com`

- [ ] **7.3** Set up log monitoring
  ```bash
  # Add to crontab for daily log rotation
  sudo nano /etc/logrotate.d/teachers-training
  ```

## ☐ Phase 8: Documentation Update

- [ ] **8.1** Update README.md
  - Add HTTPS URLs
  - Update deployment instructions

- [ ] **8.2** Update API documentation
  - Change all examples to use HTTPS

- [ ] **8.3** Update environment variables docs
  - Add DOMAIN and BASE_URL

- [ ] **8.4** Commit and push changes
  ```bash
  git add .
  git commit -m "feat: Enable HTTPS with domain name"
  git push
  ```

---

## Quick Commands Reference

### Check nginx status
```bash
sudo systemctl status nginx
sudo nginx -t
```

### Reload nginx
```bash
sudo systemctl reload nginx
```

### Check SSL certificate
```bash
sudo certbot certificates
```

### Renew SSL (manual)
```bash
sudo certbot renew
sudo systemctl reload nginx
```

### View logs
```bash
# Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# App
docker logs teachers_training-app-1 -f

# Certbot
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

---

## Troubleshooting

### DNS not propagating
```bash
# Check DNS
nslookup your-domain.com
dig your-domain.com

# Wait 10-30 minutes
# Check: https://dnschecker.org
```

### SSL certificate failed
```bash
# Check port 80 is open
sudo ufw allow 80
curl http://your-domain.com

# Check certbot logs
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

### Nginx not starting
```bash
# Test config
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/error.log

# Restart
sudo systemctl restart nginx
```

---

## Estimated Time

- **Total**: 1.5 - 2 hours
- **Domain setup**: 15-30 min (+ DNS propagation wait)
- **Nginx & SSL**: 20-30 min
- **Testing**: 15-20 min
- **Optional monitoring**: 10-15 min

---

## Cost Breakdown

| Item | Cost | Frequency |
|------|------|-----------|
| Domain | $8-15 | Annual |
| Static IP | $3-7 | Monthly |
| SSL Cert | FREE | - |

**Total**: ~$40-100/year

---

**Ready?** Start with Phase 1! 🚀

See detailed guide: `GCP_HTTPS_DOMAIN_SETUP.md`
