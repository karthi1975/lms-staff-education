#!/bin/bash

# HTTPS Setup Script for GCP Instance
# This script automates nginx + Let's Encrypt setup
# Run this ON THE GCP SERVER (not locally)

set -e  # Exit on error

echo "🔐 HTTPS Setup for Teachers Training System"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
   echo "❌ Please run this script as a regular user with sudo privileges"
   echo "   Do NOT run as root"
   exit 1
fi

# Prompt for domain information
read -p "Enter your domain name (e.g., teachers-training.com): " DOMAIN
read -p "Include www subdomain? (yes/no): " INCLUDE_WWW
read -p "Enter your email for SSL notifications: " EMAIL

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "❌ Domain and email are required!"
    exit 1
fi

# Set up domain list
if [ "$INCLUDE_WWW" = "yes" ]; then
    WWW_DOMAIN="www.$DOMAIN"
    CERTBOT_DOMAINS="-d $DOMAIN -d $WWW_DOMAIN"
    NGINX_SERVER_NAME="$DOMAIN $WWW_DOMAIN"
else
    CERTBOT_DOMAINS="-d $DOMAIN"
    NGINX_SERVER_NAME="$DOMAIN"
fi

echo ""
echo "📋 Configuration Summary:"
echo "   Domain: $DOMAIN"
if [ "$INCLUDE_WWW" = "yes" ]; then
    echo "   WWW: $WWW_DOMAIN"
fi
echo "   Email: $EMAIL"
echo ""
read -p "Continue with this configuration? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Setup cancelled"
    exit 0
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "🚀 Starting HTTPS setup..."
echo "════════════════════════════════════════════════════════════════"
echo ""

# Step 1: Update system
echo "📦 [1/7] Updating system packages..."
sudo apt update -qq

# Step 2: Install nginx
echo "🌐 [2/7] Installing nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    sudo systemctl enable nginx
    echo "   ✅ Nginx installed"
else
    echo "   ℹ️  Nginx already installed"
fi

# Step 3: Configure nginx
echo "⚙️  [3/7] Configuring nginx reverse proxy..."

# Backup existing config if it exists
if [ -f /etc/nginx/sites-available/teachers-training ]; then
    sudo cp /etc/nginx/sites-available/teachers-training \
           /etc/nginx/sites-available/teachers-training.backup.$(date +%Y%m%d_%H%M%S)
    echo "   ℹ️  Backed up existing config"
fi

# Create nginx config
sudo tee /etc/nginx/sites-available/teachers-training > /dev/null <<EOF
server {
    listen 80;
    server_name $NGINX_SERVER_NAME;

    # Logging
    access_log /var/log/nginx/teachers-training-access.log;
    error_log /var/log/nginx/teachers-training-error.log;

    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';

        # Standard proxy headers
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Timeouts for long-running requests
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;

        proxy_cache_bypass \$http_upgrade;
    }

    # Health check endpoint (no auth required)
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }

    # WhatsApp webhook
    location /webhook {
        proxy_pass http://localhost:3000/webhook;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # File upload size limit
    client_max_body_size 50M;
}
EOF

# Enable site
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/teachers-training /etc/nginx/sites-enabled/

# Test nginx config
echo "   🧪 Testing nginx configuration..."
if sudo nginx -t; then
    echo "   ✅ Nginx config valid"
    sudo systemctl reload nginx
    echo "   ✅ Nginx reloaded"
else
    echo "   ❌ Nginx config test failed!"
    exit 1
fi

# Step 4: Test HTTP access
echo "🧪 [4/7] Testing HTTP access..."
sleep 2
if curl -s -o /dev/null -w "%{http_code}" http://localhost | grep -q "200\|302"; then
    echo "   ✅ HTTP access working"
else
    echo "   ⚠️  HTTP access test inconclusive (app might not be running)"
fi

# Step 5: Open firewall ports
echo "🔥 [5/7] Configuring firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 80/tcp -q 2>/dev/null || true
    sudo ufw allow 443/tcp -q 2>/dev/null || true
    echo "   ✅ Firewall rules added"
else
    echo "   ℹ️  UFW not installed, skipping firewall config"
fi

# Step 6: Install Certbot
echo "🔐 [6/7] Installing Certbot (Let's Encrypt client)..."
if ! command -v certbot &> /dev/null; then
    sudo apt install -y certbot python3-certbot-nginx
    echo "   ✅ Certbot installed"
else
    echo "   ℹ️  Certbot already installed"
fi

# Step 7: Obtain SSL certificate
echo "📜 [7/7] Obtaining SSL certificate from Let's Encrypt..."
echo ""
echo "   ⚠️  IMPORTANT: DNS must already point to this server!"
echo "   ⚠️  Domain: $DOMAIN → $(curl -s ifconfig.me)"
echo ""
read -p "   Has DNS been configured? (yes/no): " DNS_READY

if [ "$DNS_READY" != "yes" ]; then
    echo ""
    echo "⏸️  Setup paused. Please configure DNS first:"
    echo ""
    echo "   1. Login to your domain registrar"
    echo "   2. Add A record: $DOMAIN → $(curl -s ifconfig.me)"
    if [ "$INCLUDE_WWW" = "yes" ]; then
        echo "   3. Add A record: www.$DOMAIN → $(curl -s ifconfig.me)"
    fi
    echo "   4. Wait 5-30 minutes for DNS propagation"
    echo "   5. Verify with: nslookup $DOMAIN"
    echo ""
    echo "   Then run this command to complete SSL setup:"
    echo ""
    echo "   sudo certbot --nginx $CERTBOT_DOMAINS \\"
    echo "     --email $EMAIL --agree-tos --redirect --non-interactive"
    echo ""
    exit 0
fi

# Verify DNS before proceeding
echo "   🔍 Verifying DNS resolution..."
RESOLVED_IP=$(dig +short $DOMAIN | tail -n1)
SERVER_IP=$(curl -s ifconfig.me)

if [ -z "$RESOLVED_IP" ]; then
    echo "   ⚠️  Warning: Domain $DOMAIN does not resolve to an IP"
    echo "   ⚠️  SSL certificate request will likely fail"
    read -p "   Continue anyway? (yes/no): " FORCE_CONTINUE
    if [ "$FORCE_CONTINUE" != "yes" ]; then
        exit 0
    fi
elif [ "$RESOLVED_IP" != "$SERVER_IP" ]; then
    echo "   ⚠️  Warning: DNS mismatch!"
    echo "   ⚠️  Domain resolves to: $RESOLVED_IP"
    echo "   ⚠️  Server IP is: $SERVER_IP"
    read -p "   Continue anyway? (yes/no): " FORCE_CONTINUE
    if [ "$FORCE_CONTINUE" != "yes" ]; then
        exit 0
    fi
else
    echo "   ✅ DNS resolution verified"
fi

echo ""
echo "   🔐 Requesting SSL certificate..."
if sudo certbot --nginx $CERTBOT_DOMAINS \
    --email $EMAIL \
    --agree-tos \
    --redirect \
    --non-interactive; then
    echo "   ✅ SSL certificate obtained and installed!"
else
    echo "   ❌ SSL certificate request failed"
    echo ""
    echo "   Common causes:"
    echo "   - DNS not propagated yet (wait 10-30 minutes)"
    echo "   - Port 80 not accessible from internet"
    echo "   - Domain already has a certificate (rate limit)"
    echo ""
    echo "   Check logs:"
    echo "   sudo tail -f /var/log/letsencrypt/letsencrypt.log"
    exit 1
fi

# Test auto-renewal
echo ""
echo "🔄 Testing auto-renewal setup..."
if sudo certbot renew --dry-run; then
    echo "   ✅ Auto-renewal configured successfully"
else
    echo "   ⚠️  Auto-renewal test failed (certificate renewal may not work)"
fi

# Final verification
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "🎉 HTTPS Setup Complete!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "✅ Your site is now accessible at:"
echo "   https://$DOMAIN"
if [ "$INCLUDE_WWW" = "yes" ]; then
    echo "   https://$WWW_DOMAIN"
fi
echo ""
echo "🔒 SSL Certificate:"
echo "   Issuer: Let's Encrypt"
echo "   Expires: 90 days (auto-renews)"
echo "   Notifications: $EMAIL"
echo ""
echo "📊 Test your SSL rating:"
echo "   https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
echo ""
echo "🔧 Next Steps:"
echo "   1. Update Twilio webhook URL to https://$DOMAIN/webhook/whatsapp"
echo "   2. Update application .env file with new domain"
echo "   3. Test WhatsApp bot enrollment flow"
echo "   4. Run endurance test with HTTPS URLs"
echo ""
echo "📝 View certificate details:"
echo "   sudo certbot certificates"
echo ""
echo "🔄 Manual renewal (usually not needed):"
echo "   sudo certbot renew && sudo systemctl reload nginx"
echo ""
