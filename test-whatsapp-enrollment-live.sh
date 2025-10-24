#!/bin/bash

# Test WhatsApp User Enrollment Flow for Live User
# This script helps you enroll a real WhatsApp user

echo "📱 WhatsApp User Enrollment - Live Test"
echo "════════════════════════════════════════════════════════════"
echo ""

# Get user input
read -p "Enter user's name: " USER_NAME
read -p "Enter user's WhatsApp number (with country code, e.g., +255712345678): " PHONE_NUMBER

echo ""
echo "🔐 Step 1: Admin Login..."

# Login to get admin token
LOGIN_RESPONSE=$(curl -s -X POST http://34.162.136.203:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@school.edu\",\"password\":\"Admin123!\"}")

# Extract token (check both possible response formats)
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
  TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
fi

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed. Response:"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Admin login successful"
echo ""

# Enroll the user
echo "🔐 Step 2: Enrolling user..."

ENROLL_RESPONSE=$(curl -s -X POST http://34.162.136.203:3000/api/admin/users/enroll \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"$USER_NAME\",\"phoneNumber\":\"$PHONE_NUMBER\"}")

echo "$ENROLL_RESPONSE"
echo ""

# Extract PIN from response
PIN=$(echo "$ENROLL_RESPONSE" | grep -o '"pin":"[^"]*' | cut -d'"' -f4)
EXPIRES_AT=$(echo "$ENROLL_RESPONSE" | grep -o '"expiresAt":"[^"]*' | cut -d'"' -f4)

if [ -n "$PIN" ]; then
  echo "════════════════════════════════════════════════════════════"
  echo "✅ USER ENROLLED SUCCESSFULLY!"
  echo "════════════════════════════════════════════════════════════"
  echo ""
  echo "📋 Enrollment Details:"
  echo "   Name: $USER_NAME"
  echo "   Phone: $PHONE_NUMBER"
  echo ""
  echo "🔑 PIN: $PIN"
  echo "   Expires: $EXPIRES_AT"
  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo ""
  echo "📲 NEXT STEPS - Share these instructions with the user:"
  echo "════════════════════════════════════════════════════════════"
  echo ""
  echo "1. Message the WhatsApp bot at: +1 806 515 7636"
  echo ""
  echo "2. When the bot asks for your PIN, send:"
  echo "   $PIN"
  echo ""
  echo "3. After verification, you'll receive a welcome message"
  echo ""
  echo "4. Type 'help' to see available commands"
  echo ""
  echo "5. Type 'courses' to start learning!"
  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo ""
  echo "📊 Monitor user status:"
  echo "   • Admin Portal: http://34.162.136.203:3000/admin/users.html"
  echo "   • Check logs: docker logs teachers_training-app-1 -f"
  echo ""
else
  echo "❌ Enrollment failed. Response:"
  echo "$ENROLL_RESPONSE"
  exit 1
fi

echo ""
echo "✅ Ready for live user test!"
echo ""
