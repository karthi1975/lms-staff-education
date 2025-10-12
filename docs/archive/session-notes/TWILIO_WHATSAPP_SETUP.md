# Twilio WhatsApp Integration Setup Guide

## Overview
This guide will help you configure Twilio WhatsApp integration for the Teachers Training System.

## Prerequisites
- Twilio account (free trial works for testing)
- ngrok or similar tunneling service running
- Node.js server running on port 3000

## Step 1: Get Twilio Credentials

From your Twilio Console (https://console.twilio.com):

1. **Account SID**: `<your-account-sid>` (from your dashboard)
2. **Auth Token**: Click "Show" to reveal it
   - Path: Console → Account → Auth Token
   - **IMPORTANT**: Keep this secret!
3. **Phone Number**: `+18014366249` (your Twilio number)

## Step 2: Join WhatsApp Sandbox (for Testing)

1. Go to **Messaging** → **Try it out** → **Send a WhatsApp message**
2. You'll see a sandbox number (e.g., `+1 415 523 8886`)
3. From your WhatsApp, send the join code to that number
   - Example: `join <your-code>`
4. You should receive a confirmation message

## Step 3: Configure .env File

Update your `.env` file with Twilio credentials:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=<your-twilio-account-sid>
TWILIO_AUTH_TOKEN=<your-twilio-auth-token>
TWILIO_PHONE_NUMBER=<your-twilio-phone-number>
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
TWILIO_SKIP_VALIDATION=false

# Set provider to Twilio
WHATSAPP_PROVIDER=twilio
```

**To get your Auth Token:**
1. Go to https://console.twilio.com
2. Click on "Account" in the left sidebar
3. Find "Auth Token" and click "Show"
4. Copy and paste it into `.env`


## Step 4: Configure Twilio Webhook

### Get Your ngrok URL
```bash
# If ngrok is running, get the URL
curl http://localhost:4040/api/tunnels | grep public_url
# Example output: https://9c3008b6d5c7.ngrok-free.app
```

### Set Webhook in Twilio Console

1. Go to **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Scroll to **Sandbox Configuration**
3. Set the following:

   **When a message comes in:**
   - URL: `https://<your-ngrok-url>/webhook/twilio`
   - Method: `HTTP POST`

   **Status callback URL (optional):**
   - URL: `https://<your-ngrok-url>/webhook/twilio/status`
   - Method: `HTTP POST`

4. Click **Save**

## Step 5: Restart Your Server

```bash
# If running locally
npm start

# If using Docker
docker-compose restart teachers-training-app
```

## Step 6: Test the Integration

### Test 1: Send a WhatsApp Message

1. Open WhatsApp on your phone
2. Send a message to the sandbox number: `+1 415 523 8886`
3. Send: `hello`
4. You should get a welcome response from the bot

### Test 2: Test API Endpoint

```bash
curl -X POST http://localhost:3000/api/twilio/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "message": "Hello from Twilio!"
  }'
```

Replace `+1234567890` with your WhatsApp number (must have joined sandbox).

### Test 3: Check Logs

```bash
# If running locally
tail -f logs/app.log

# If using Docker
docker logs -f teachers-training-app
```

Look for:
- ✅ `Twilio WhatsApp service initialized`
- ✅ `Twilio webhook received`
- ✅ `Message sent to +...`

## Webhooks Overview

The system now supports both Meta and Twilio webhooks:

| Provider | Webhook URL | Purpose |
|----------|------------|---------|
| Meta | `/webhook` | Original Meta WhatsApp webhook |
| Twilio | `/webhook/twilio` | Twilio WhatsApp messages |
| Twilio Status | `/webhook/twilio/status` | Message delivery status |

## Environment Variables

```env
# Choose provider: 'meta' or 'twilio'
WHATSAPP_PROVIDER=twilio

# Twilio credentials
TWILIO_ACCOUNT_SID=<your-twilio-account-sid>
TWILIO_AUTH_TOKEN=<your-auth-token>
TWILIO_PHONE_NUMBER=<your-twilio-phone-number>
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
TWILIO_SKIP_VALIDATION=false  # Set to true only for local testing
```

## Differences: Meta vs Twilio

### Meta WhatsApp (Cloud API)
✅ Native interactive buttons
✅ Native interactive lists
✅ Typing indicators
✅ Read receipts
❌ More complex setup (requires Facebook Business Manager)
❌ Requires webhook verification token

### Twilio WhatsApp
✅ Easier setup (just Account SID + Auth Token)
✅ Unified billing with other Twilio services
✅ Better documentation and support
❌ No native interactive messages (fallback to numbered lists)
❌ No typing indicators
❌ No read receipts

## Production Deployment

### For Production with Twilio:

1. **Get WhatsApp Business API Approval**
   - Go to Twilio Console → Messaging → WhatsApp
   - Submit request for WhatsApp Business API
   - Link your Facebook Business Manager account

2. **Get Approved WhatsApp Number**
   - Replace sandbox number with your approved number
   - Update `TWILIO_WHATSAPP_NUMBER` in `.env`

3. **Update Webhook URL**
   - Use production domain (not ngrok)
   - Enable signature validation: `TWILIO_SKIP_VALIDATION=false`

4. **Security**
   - Store `TWILIO_AUTH_TOKEN` in secure secrets manager
   - Enable Twilio webhook signature validation
   - Use HTTPS only

## Troubleshooting

### Issue: "Twilio client not initialized"
**Solution:** Check that `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are set in `.env`

### Issue: "Invalid Twilio signature"
**Solution:**
1. Check that webhook URL matches exactly (including protocol and query params)
2. For testing only, set `TWILIO_SKIP_VALIDATION=true`
3. Verify `TWILIO_AUTH_TOKEN` is correct

### Issue: Messages not sending
**Solution:**
1. Check phone number format: must include `+` and country code
2. Verify recipient has joined sandbox (for testing)
3. Check Twilio dashboard for error messages

### Issue: Webhook not receiving messages
**Solution:**
1. Verify ngrok is running: `http://localhost:4040`
2. Check webhook URL in Twilio Console matches ngrok URL
3. Test webhook manually:
   ```bash
   curl -X POST https://your-ngrok-url/webhook/twilio \
     -d "From=whatsapp:+1234567890" \
     -d "To=whatsapp:+14155238886" \
     -d "Body=test" \
     -d "MessageSid=SM123"
   ```

## Monitoring

### Check Message Status
```bash
# Using the API
curl http://localhost:3000/api/twilio/status/SM123456789
```

### View Twilio Logs
- Twilio Console → Monitor → Logs → Messaging
- Shows all sent/received messages with status

## Support

- Twilio Docs: https://www.twilio.com/docs/whatsapp
- Twilio Support: https://support.twilio.com
- Project Issues: [Your GitHub repo]

## Next Steps

1. ✅ Complete setup following this guide
2. ✅ Test with sandbox number
3. 🔲 Apply for WhatsApp Business API approval
4. 🔲 Get production WhatsApp number
5. 🔲 Deploy to production with proper domain
6. 🔲 Switch from sandbox to production number
