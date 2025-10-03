#!/bin/bash

echo "🚀 WhatsApp Bot - ngrok Setup Helper"
echo "===================================="
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed"
    echo ""
    echo "Install ngrok:"
    echo "  brew install ngrok"
    echo ""
    echo "Or download from: https://ngrok.com/download"
    exit 1
fi

echo "✅ ngrok is installed"
echo ""

# Check if server is running
echo "Checking if server is running on port 3000..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Server is running on port 3000"
else
    echo "⚠️  Server is not running!"
    echo ""
    echo "Start the server first:"
    echo "  docker-compose up -d"
    echo "  OR"
    echo "  npm start"
    echo ""
    read -p "Press Enter to continue anyway, or Ctrl+C to exit..."
fi

echo ""
echo "📡 Starting ngrok..."
echo ""
echo "⏳ Please wait while ngrok connects..."
echo ""

# Start ngrok in background and capture output
ngrok http 3000 > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

# Wait for ngrok to start
sleep 3

# Get the public URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | grep -o 'https://[^"]*' | head -1)

if [ -z "$NGROK_URL" ]; then
    echo "❌ Failed to get ngrok URL"
    echo ""
    echo "Check ngrok logs:"
    echo "  cat /tmp/ngrok.log"
    echo ""
    echo "Or visit: http://localhost:4040"
    exit 1
fi

echo "✅ ngrok is running!"
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  📋 Your Webhook Configuration                             ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
echo "║  Callback URL:                                             ║"
echo "║  $NGROK_URL/webhook"
echo "║                                                            ║"
echo "║  Verify Token:                                             ║"
echo "║  education_bot_verify_2024                                 ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Go to Meta Developer Console:"
echo "   https://developers.facebook.com/apps/671972558666089/whatsapp-business/wa-dev-console/"
echo ""
echo "2. Click 'Configuration' in the left sidebar"
echo ""
echo "3. Under 'Webhook', enter:"
echo "   • Callback URL: $NGROK_URL/webhook"
echo "   • Verify Token: education_bot_verify_2024"
echo ""
echo "4. Click 'Verify and Save'"
echo ""
echo "5. Subscribe to webhook fields:"
echo "   ✓ messages"
echo "   ✓ message_status (optional)"
echo ""
echo "6. Test by sending 'hello' to: +1 555 154 4211"
echo "   From your phone: +18016809129"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 ngrok Web Interface: http://localhost:4040"
echo "📊 Server Health Check: http://localhost:3000/health"
echo "👤 User Login: http://localhost:3000/user-login.html"
echo "🔧 Admin Portal: http://localhost:3000/admin/login.html"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  IMPORTANT:"
echo "   • Keep this terminal window open"
echo "   • ngrok URL will change if you restart"
echo "   • You'll need to update webhook again after restart"
echo ""
echo "📝 Press Ctrl+C to stop ngrok"
echo ""

# Keep script running
wait $NGROK_PID
