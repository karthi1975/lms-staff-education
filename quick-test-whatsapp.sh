#!/bin/bash

# Quick WhatsApp Test Script
# Usage: ./quick-test-whatsapp.sh [phone_number]

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load environment variables
source .env

# Phone number (from argument or default)
PHONE="${1:-+1234567890}"

echo -e "${BLUE}🎓 Teachers Training WhatsApp Quick Test${NC}"
echo "======================================="
echo -e "${BLUE}Phone Number ID:${NC} $WHATSAPP_PHONE_NUMBER_ID"
echo -e "${BLUE}Sending to:${NC} $PHONE"
echo ""

# Function to send message
send_message() {
    local message="$1"
    echo -e "${YELLOW}📤 Sending:${NC} $message"
    
    response=$(curl -s -X POST \
        "https://graph.facebook.com/v18.0/$WHATSAPP_PHONE_NUMBER_ID/messages" \
        -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"messaging_product\": \"whatsapp\",
            \"to\": \"${PHONE//+/}\",
            \"type\": \"text\",
            \"text\": {
                \"body\": \"$message\"
            }
        }")
    
    if echo "$response" | grep -q "messages"; then
        echo -e "${GREEN}✅ Sent successfully!${NC}"
        echo "$response" | grep -o '"id":"[^"]*"' | head -1
    else
        echo -e "${RED}❌ Failed to send${NC}"
        echo "$response" | jq .
    fi
    echo ""
}

# Test messages
echo -e "${BLUE}Starting test sequence...${NC}"
echo ""

# Message 1: Welcome
send_message "🎓 Welcome to Teachers Training Bot Test!

This is a test message sent at $(date '+%Y-%m-%d %H:%M:%S')

Available commands:
• Type 'help' for options
• Type 'menu' for modules
• Type '1' to start Module 1"

sleep 2

# Message 2: Interactive buttons (using curl directly)
echo -e "${YELLOW}📤 Sending interactive buttons...${NC}"
curl -s -X POST \
    "https://graph.facebook.com/v18.0/$WHATSAPP_PHONE_NUMBER_ID/messages" \
    -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "messaging_product": "whatsapp",
        "to": "'${PHONE//+/}'",
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {
                "text": "What would you like to do?"
            },
            "action": {
                "buttons": [
                    {
                        "type": "reply",
                        "reply": {
                            "id": "start_learning",
                            "title": "Start Learning"
                        }
                    },
                    {
                        "type": "reply",
                        "reply": {
                            "id": "view_progress",
                            "title": "View Progress"
                        }
                    },
                    {
                        "type": "reply",
                        "reply": {
                            "id": "take_quiz",
                            "title": "Take Quiz"
                        }
                    }
                ]
            }
        }
    }' | jq . 2>/dev/null || echo -e "${GREEN}✅ Interactive message sent${NC}"

echo ""
echo -e "${GREEN}✨ Test complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Check your WhatsApp for messages"
echo "2. Reply to test the webhook"
echo "3. Monitor logs: tail -f logs/combined.log"
echo "4. Check admin panel: http://localhost:3000/admin.html"