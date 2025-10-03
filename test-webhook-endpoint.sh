#!/bin/bash

# Test script for WhatsApp webhook endpoint

echo "=== WhatsApp Webhook Test ==="
echo ""

# Get ngrok URL from user
echo "Enter your ngrok URL (e.g., https://xxxx.ngrok-free.app):"
read NGROK_URL

if [ -z "$NGROK_URL" ]; then
    echo "Error: ngrok URL is required"
    exit 1
fi

echo ""
echo "Testing webhook verification..."
echo ""

# Test webhook verification
curl -i -X GET "${NGROK_URL}/webhook?hub.mode=subscribe&hub.verify_token=education_bot_verify_2024&hub.challenge=test123"

echo ""
echo ""
echo "Testing webhook POST endpoint..."
echo ""

# Test webhook POST with sample WhatsApp message
curl -i -X POST "${NGROK_URL}/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "field": "messages",
        "value": {
          "messages": [{
            "from": "12025551234",
            "id": "test_message_123",
            "type": "text",
            "text": {
              "body": "help"
            }
          }]
        }
      }]
    }]
  }'

echo ""
echo ""
echo "Check your app logs for processing details:"
echo "docker logs teachers_training-app-1 --tail 50"