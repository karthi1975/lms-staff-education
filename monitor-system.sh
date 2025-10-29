#!/bin/bash

# Continuous System Monitoring
# Watch for errors or issues after deployment

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "👀 SYSTEM MONITORING (Press Ctrl+C to stop)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

while true; do
  clear
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📊 System Status - $(date +'%H:%M:%S')"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  gcloud compute ssh teachers-training --zone "us-east5-a" \
    --project "lms-tanzania-consultant" --command "
  # Container status
  echo '1️⃣  Container Status:'
  docker ps | grep teachers_training_app | head -1
  echo ''

  # Recent errors
  echo '2️⃣  Recent Errors (last 2 min):'
  docker logs teachers_training_app_1 --since 2m 2>&1 | grep -i 'error\|failed' | tail -5 || echo '   ✅ No errors'
  echo ''

  # Chat activity
  echo '3️⃣  Recent Chat Activity:'
  docker logs teachers_training_app_1 --since 2m 2>&1 | grep -i 'processed successfully' | tail -3 || echo '   No recent chat activity'
  echo ''

  # Nudge activity
  echo '4️⃣  Nudge System:'
  docker logs teachers_training_app_1 --since 2m 2>&1 | grep -i 'nudge.*sent\|checking.*inactive' | tail -3 || echo '   No recent nudge activity'
  echo ''

  # Health endpoint
  echo '5️⃣  Health Check:'
  curl -s http://localhost:3000/health | head -c 50 || echo '   Health endpoint not responding'
  echo ''
  "

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔄 Refreshing in 10 seconds... (Ctrl+C to stop)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  sleep 10
done
