#!/bin/bash
# Enable Testing Mode for Nudge System
# - Inactivity threshold: 1 minute
# - Scheduler checks: Every 60 seconds
# - Cooldown period: 3 minutes

set -e

GCP_INSTANCE="teachers-training"
GCP_ZONE="us-east5-a"
GCP_PROJECT="lms-tanzania-consultant"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║   ENABLE TESTING MODE - Nudge System                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

echo "⚙️  Configuration:"
echo "   • Inactivity threshold: 1 minute (0.0167 hours)"
echo "   • Scheduler checks: Every 60 seconds"
echo "   • Cooldown period: 3 minutes (0.05 hours)"
echo "   • Auto-detection: ENABLED"
echo ""

read -p "❓ Enable testing mode? (y/N) " -n 1 -r
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

if [ "$CURRENT_VALUE" = "0.0167" ]; then
    echo "ℹ️  Testing mode is already enabled!"
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

# Update NUDGE_INACTIVITY_HOURS to 1 minute
if grep -q '^NUDGE_INACTIVITY_HOURS=' ~/teachers_training/.env 2>/dev/null; then
    sed -i 's/^NUDGE_INACTIVITY_HOURS=.*/NUDGE_INACTIVITY_HOURS=0.0167/' ~/teachers_training/.env
else
    echo 'NUDGE_INACTIVITY_HOURS=0.0167' >> ~/teachers_training/.env
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
echo "Step 5/5: Verifying testing mode is active..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "📊 Container Status:"
gcloud compute ssh $GCP_INSTANCE --zone "$GCP_ZONE" --project "$GCP_PROJECT" --command "
docker ps | grep teachers_training_app
" 2>&1 | grep -v "\.zprofile"

echo ""
echo "📋 Testing Mode Verification:"
gcloud compute ssh $GCP_INSTANCE --zone "$GCP_ZONE" --project "$GCP_PROJECT" --command "
docker logs teachers_training_app_1 2>&1 | tail -50 | grep -E 'TESTING MODE|testingMode.*true|Nudge checks scheduled' | tail -3
" 2>&1 | grep -v "\.zprofile"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ TESTING MODE ENABLED SUCCESSFULLY!"
echo ""
echo "📊 Configuration Active:"
echo "   ✓ Inactivity threshold: 1 minute"
echo "   ✓ Scheduler checks: Every 60 seconds"
echo "   ✓ Cooldown period: 3 minutes"
echo ""
echo "🎯 Expected Behavior:"
echo "   1. User sends message → Activity recorded"
echo "   2. User inactive 1 minute → Marked as eligible"
echo "   3. Scheduler checks (60s) → Detects inactivity"
echo "   4. Nudge sent via WhatsApp → User receives message"
echo "   5. Cooldown 3 minutes → Prevents spam"
echo ""
echo "🧪 To Test:"
echo "   1. Send a WhatsApp message to the bot"
echo "   2. Wait 1-2 minutes (stay inactive)"
echo "   3. Check WhatsApp for nudge"
echo ""
echo "🔄 To Switch Back to Production Mode:"
echo "   ./rollback-nudge.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
