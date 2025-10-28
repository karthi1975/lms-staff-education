#!/bin/bash
# Setup automated daily backups on GCP instance

echo "🔧 Setting up automated backups on GCP..."

# Upload backup script to GCP
echo "📤 Step 1: Uploading backup script..."
gcloud compute scp --zone "us-east5-a" \
  backup.sh \
  teachers-training:/home/karthi/backup.sh \
  --project "lms-tanzania-consultant"

# Setup cron job on GCP
echo "⏰ Step 2: Setting up daily cron job (2 AM)..."
gcloud compute ssh --zone "us-east5-a" "teachers-training" \
  --project "lms-tanzania-consultant" --command "
    chmod +x /home/karthi/backup.sh

    # Add cron job (daily at 2 AM)
    (crontab -l 2>/dev/null | grep -v backup.sh; echo '0 2 * * * /home/karthi/backup.sh >> /home/karthi/backup.log 2>&1') | crontab -

    echo '✅ Cron job installed'
    crontab -l | grep backup
"

# Run first backup immediately
echo "🚀 Step 3: Running first backup now..."
gcloud compute ssh --zone "us-east5-a" "teachers-training" \
  --project "lms-tanzania-consultant" --command "
    /home/karthi/backup.sh
"

echo ""
echo "✅ Done! Automated backups configured:"
echo "   • Runs daily at 2:00 AM UTC"
echo "   • Keeps last 7 days of backups"
echo "   • Location: /home/karthi/backups/"
echo ""
echo "📋 To check backups:"
echo "   gcloud compute ssh teachers-training --zone us-east5-a --command 'ls -lh /home/karthi/backups/'"
