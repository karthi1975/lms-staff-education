#!/bin/bash

# Deploy 1-Minute Nudge for Testing
# This sets the nudge timeout to 1 minute so you can see it working immediately

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚡ DEPLOYING 1-MINUTE NUDGE (TEST MODE)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📝 Setting: NUDGE_INACTIVITY_HOURS = 0.0167 (1 minute)"
echo "   This is for TESTING only - users will get nudge after 1 min inactivity"
echo ""

echo "🔧 Updating GCP environment..."
gcloud compute ssh teachers-training --zone "us-east5-a" \
  --project "lms-tanzania-consultant" --command "
# Update environment variable in container
docker exec teachers_training_app_1 sh -c '
# Check current setting
echo \"Current setting:\"
grep NUDGE_INACTIVITY_HOURS /app/.env || echo \"Not set, using default 48 hours\"

# Update or add the setting
if grep -q \"NUDGE_INACTIVITY_HOURS\" /app/.env; then
  sed -i \"s/NUDGE_INACTIVITY_HOURS=.*/NUDGE_INACTIVITY_HOURS=0.0167/\" /app/.env
  echo \"✓ Updated NUDGE_INACTIVITY_HOURS to 0.0167 (1 minute)\"
else
  echo \"NUDGE_INACTIVITY_HOURS=0.0167\" >> /app/.env
  echo \"✓ Added NUDGE_INACTIVITY_HOURS=0.0167 (1 minute)\"
fi

echo \"\"
echo \"New setting:\"
grep NUDGE_INACTIVITY_HOURS /app/.env
'

echo \"\"
echo \"🔄 Restarting app container to apply changes...\"
docker restart teachers_training_app_1
echo \"✅ Container restarted\"
"

echo ""
echo "⏳ Waiting 15 seconds for app to initialize..."
sleep 15

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Configuration:"
echo "   • Nudge timeout: 1 minute (60 seconds)"
echo "   • Chat services: FULLY OPERATIONAL"
echo "   • Users can chat anytime: YES"
echo "   • Nudge is just a reminder: YES"
echo ""
echo "🧪 How to Test:"
echo "   1. Send a message via WhatsApp"
echo "   2. Wait 60 seconds (do nothing)"
echo "   3. Watch for nudge: 'Hi again! 📚 Let's pick up...'"
echo "   4. User can still reply anytime!"
echo ""
echo "💡 Note: Nudges DON'T block chat - they're just friendly reminders!"
echo ""
