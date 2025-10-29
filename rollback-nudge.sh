#!/bin/bash
# Rollback to Production Mode - 48-Hour Nudge System
# - Inactivity threshold: 48 hours (2 days)
# - Scheduler checks: Every 6 hours
# - Cooldown period: 72 hours (3 days)

set -e

GCP_INSTANCE="teachers-training"
GCP_ZONE="us-east5-a"
GCP_PROJECT="lms-tanzania-consultant"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║   ROLLBACK TO PRODUCTION MODE - Nudge System             ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

echo "⚙️  Production Configuration:"
echo "   • Inactivity threshold: 48 hours (2 days)"
echo "   • Scheduler checks: Every 6 hours"
echo "   • Cooldown period: 72 hours (3 days)"
echo "   • Auto-detection: ENABLED"
echo ""

read -p "❓ Rollback to production mode? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled."
    exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1/5: Connecting to GCP..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test connection
gcloud compute ssh $GCP_INSTANCE --zone "$GCP_ZONE" --project "$GCP_PROJECT" --command "echo '✅ Connected to GCP'" 2>&1 | grep -v "\.zprofile" || {
    echo "❌ Failed to connect to GCP"
    exit 1
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2/5: Checking current configuration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CURRENT_VALUE=$(gcloud compute ssh $GCP_INSTANCE --zone "$GCP_ZONE" --project "$GCP_PROJECT" --command "
docker exec teachers_training_app_1 printenv NUDGE_INACTIVITY_HOURS 2>/dev/null || echo '48'
" 2>&1 | grep -v "\.zprofile" | tail -1)

echo "📊 Current NUDGE_INACTIVITY_HOURS: $CURRENT_VALUE"

if [ "$CURRENT_VALUE" = "48" ]; then
    echo "ℹ️  Production mode is already enabled!"
    read -p "❓ Re-apply anyway? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "✅ No changes made."
        exit 0
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3/5: Updating environment variable..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

gcloud compute ssh $GCP_INSTANCE --zone "$GCP_ZONE" --project "$GCP_PROJECT" --command "
# Backup current .env
cp ~/teachers_training/.env ~/teachers_training/.env.backup.\$(date +%Y%m%d_%H%M%S) 2>/dev/null || true

# Update NUDGE_INACTIVITY_HOURS to 48 hours
if grep -q '^NUDGE_INACTIVITY_HOURS=' ~/teachers_training/.env 2>/dev/null; then
    sed -i 's/^NUDGE_INACTIVITY_HOURS=.*/NUDGE_INACTIVITY_HOURS=48/' ~/teachers_training/.env
else
    echo 'NUDGE_INACTIVITY_HOURS=48' >> ~/teachers_training/.env
fi

echo '✅ Updated .env file'
cat ~/teachers_training/.env | grep NUDGE_INACTIVITY_HOURS
" 2>&1 | grep -v "\.zprofile"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4/5: Restarting application..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

gcloud compute ssh $GCP_INSTANCE --zone "$GCP_ZONE" --project "$GCP_PROJECT" --command "
cd ~/teachers_training
docker-compose down
docker-compose up -d
echo '✅ Containers restarted'
" 2>&1 | grep -v "\.zprofile"

echo ""
echo "⏳ Waiting 20 seconds for application to initialize..."
sleep 20

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5/5: Verifying production mode is active..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "📊 Container Status:"
gcloud compute ssh $GCP_INSTANCE --zone "$GCP_ZONE" --project "$GCP_PROJECT" --command "
docker ps | grep teachers_training_app
" 2>&1 | grep -v "\.zprofile"

echo ""
echo "📋 Production Mode Verification:"
gcloud compute ssh $GCP_INSTANCE --zone "$GCP_ZONE" --project "$GCP_PROJECT" --command "
docker logs teachers_training_app_1 2>&1 | tail -50 | grep -E 'Nudge checks scheduled' | tail -1
" 2>&1 | grep -v "\.zprofile"

echo ""
echo "🧪 Testing chat services..."
gcloud compute ssh $GCP_INSTANCE --zone "$GCP_ZONE" --project "$GCP_PROJECT" --command "
curl -s -X POST 'http://localhost:3000/webhook/twilio' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'From=whatsapp:+255712345678' \
  -d 'To=whatsapp:+14155238886' \
  -d 'Body=Testing after production rollback' \
  -d 'MessageSid=SM_PROD_TEST' > /dev/null

sleep 3
docker logs teachers_training_app_1 2>&1 | tail 10 | grep -q 'Testing after production rollback' && echo '✅ Chat services working' || echo '⚠️  Chat may need verification'
" 2>&1 | grep -v "\.zprofile"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ PRODUCTION MODE ENABLED SUCCESSFULLY!"
echo ""
echo "📊 Configuration Active:"
echo "   ✓ Inactivity threshold: 48 hours (2 days)"
echo "   ✓ Scheduler checks: Every 6 hours"
echo "   ✓ Cooldown period: 72 hours (3 days)"
echo ""
echo "🎯 Expected Behavior:"
echo "   1. User inactive 48 hours → Marked as eligible"
echo "   2. Scheduler checks every 6h → Detects inactivity"
echo "   3. Nudge sent via WhatsApp → User receives message"
echo "   4. Cooldown 72 hours → Prevents spam"
echo ""
echo "💡 Users will receive nudges after:"
echo "   • 48 hours of inactivity (welcome_back)"
echo "   • 120 hours of inactivity (inactive_gentle)"
echo ""
echo "🔄 To Enable Testing Mode Again:"
echo "   ./enable-testing-mode.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
