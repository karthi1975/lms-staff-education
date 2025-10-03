# Setting up ngrok for WhatsApp Webhook

## 1. Install ngrok

### Option A: Download from website
```bash
# Visit https://ngrok.com/download
# Download for macOS and install
```

### Option B: Install with Homebrew
```bash
brew install ngrok
```

## 2. Create ngrok account
1. Go to https://ngrok.com
2. Sign up for free account
3. Get your auth token from dashboard

## 3. Configure ngrok
```bash
# Add your auth token
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

## 4. Start your local server first
```bash
cd /Users/karthi/business/staff_education/teachers_training
npm start
# Server will run on port 3000
```

## 5. Start ngrok tunnel in new terminal
```bash
# Create tunnel to your local server
ngrok http 3000
```

You'll see output like:
```
Session Status                online
Account                       your-email@example.com
Version                       3.0.0
Region                        United States (us)
Forwarding                    https://abc123.ngrok.io -> http://localhost:3000
```

## 6. Configure WhatsApp Business

1. Go to Meta for Developers: https://developers.facebook.com
2. Select your app
3. Go to WhatsApp > Configuration
4. In Webhook URL field, enter:
   ```
   https://abc123.ngrok.io/webhook
   ```
   (Replace abc123 with your ngrok URL)

5. In Verify Token field, enter:
   ```
   your_webhook_verify_token_here
   ```
   (This must match the token in your .env file)

6. Click "Verify and Save"

7. Subscribe to webhook fields:
   - messages
   - messaging_postbacks
   - messaging_optins
   - message_deliveries
   - message_reads

## 7. Test the webhook

Send a test message to your WhatsApp Business number. You should see:
- Activity in ngrok terminal showing incoming POST requests
- Logs in your application console
- Response from the bot

## 8. Important ngrok commands

```bash
# View ngrok dashboard (shows all requests)
# Open browser to: http://localhost:4040

# Keep ngrok running permanently (paid feature)
ngrok http 3000 --domain=your-custom-domain.ngrok.io

# Basic authentication (optional)
ngrok http 3000 --auth="username:password"
```

## 9. Production Alternative

For production, instead of ngrok, use:
- Deploy to cloud (AWS, GCP, Azure)
- Use proper domain with SSL
- Configure permanent webhook URL

## Quick Start Commands
```bash
# Terminal 1: Start application
cd /Users/karthi/business/staff_education/teachers_training
npm start

# Terminal 2: Start ngrok
ngrok http 3000

# Terminal 3: Monitor logs
tail -f logs/combined.log
```

## Troubleshooting

1. **Webhook verification fails**
   - Check WEBHOOK_VERIFY_TOKEN in .env matches Meta config
   - Ensure ngrok is running and URL is correct
   - Check server is running on port 3000

2. **Messages not received**
   - Verify webhook subscriptions in Meta
   - Check ngrok dashboard for incoming requests
   - Review application logs for errors

3. **ngrok session expires**
   - Free tier limits to 8 hours
   - Restart ngrok and update webhook URL in Meta
   - Consider ngrok paid plan for stable URL