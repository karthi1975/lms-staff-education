# WhatsApp Bot Setup Guide

## Your Configuration (From Meta Developer Console)

- **App ID**: 671972558666089
- **Test Phone Number**: +1 555 154 4211
- **Phone Number ID**: 780151865181414
- **Business Account ID**: 2547033899011381
- **App Mode**: Development

## Step 1: Start Your Server

```bash
# Make sure Docker containers are running
docker-compose up -d

# Or if using local server
npm start
```

Server will be running on: `http://localhost:3000`

## Step 2: Start ngrok

```bash
ngrok http 3000
```

You'll get output like:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

**Copy the https URL** (e.g., `https://abc123.ngrok.io`)

## Step 3: Configure Webhook in Meta Developer Console

1. Go to: https://developers.facebook.com/apps/671972558666089/whatsapp-business/wa-dev-console/

2. Click on **"Configuration"** (left sidebar under WhatsApp)

3. Under **"Webhook"** section:
   - **Callback URL**: `https://YOUR-NGROK-URL.ngrok.io/webhook`
     - Example: `https://abc123.ngrok.io/webhook`

   - **Verify Token**: `education_bot_verify_2024`
     (This must match WEBHOOK_VERIFY_TOKEN in .env)

4. Click **"Verify and Save"**

5. Under **"Webhook fields"**, subscribe to:
   - ✅ `messages`
   - ✅ `message_status` (optional)

## Step 4: Test the Connection

### Option A: Send Test Message from Meta Console

1. Still in Meta Developer Console
2. Go to **"API Setup"**
3. Under "Step 2: Send messages with the API"
4. Click **"Send message"** button
5. Select recipient: Your phone number (+18016809129)
6. It will send to the test number

### Option B: Message from WhatsApp App

**Important**: With test numbers, you can only send messages TO specific numbers that are added as testers.

1. Add +18016809129 as a test recipient:
   - In Meta console > WhatsApp > API Setup
   - Under "To" dropdown, add your phone number

2. From your phone (+18016809129), send a message to `+1 555 154 4211`

## Step 5: Verify It's Working

### Check Logs:
```bash
# Docker logs
docker logs -f teachers_training-app-1

# Or local server logs
tail -f logs/combined.log
```

Look for:
```
Processing WhatsApp message from +18016809129
Session created/retrieved for user...
Generated response type: menu
Response sent successfully
```

### Test Messages to Send:

```
hello
```

Expected response: Main menu with 5 modules

```
1
```

Expected response: Module 1 - Introduction to Teaching

```
What are effective teaching methods?
```

Expected response: AI-generated answer from module content

## Troubleshooting

### Webhook Verification Failed

**Error**: "The callback URL or verify token couldn't be validated"

**Fix**:
1. Make sure ngrok is running
2. Verify URL is correct: `https://YOUR-NGROK-URL.ngrok.io/webhook`
3. Check WEBHOOK_VERIFY_TOKEN matches in .env
4. Check server logs for errors

### No Response from Bot

**Check**:
1. Server is running: `curl http://localhost:3000/health`
2. ngrok is connected: Check ngrok web interface at `http://localhost:4040`
3. Webhook is subscribed to "messages" field
4. Your phone number is added as a test recipient

### Wrong Content Showing

If you see Business Studies content:
- You're messaging a different bot
- Make sure you're messaging `+1 555 154 4211`
- Not the Business Studies bot number

## Configuration Summary

```env
WHATSAPP_ACCESS_TOKEN=EAAJjJ82oeWk... (already set)
WHATSAPP_PHONE_NUMBER_ID=780151865181414
WHATSAPP_BUSINESS_ACCOUNT_ID=2547033899011381
WHATSAPP_TEST_NUMBER=+15551544211
WEBHOOK_VERIFY_TOKEN=education_bot_verify_2024
```

## Important Notes

### Test Number Limitations

- **Free for 90 days**: Test numbers allow free messaging for 90 days
- **5 recipients max**: Can only send messages TO up to 5 phone numbers
- **Must add recipients**: Add +18016809129 in Meta console as a test recipient
- **No incoming limit**: Anyone can send messages TO the test number

### Webhook URL Changes

⚠️ **ngrok URL changes every restart** (on free plan)

Every time you restart ngrok, you need to:
1. Copy new ngrok URL
2. Update webhook in Meta console
3. Re-verify

### Keeping ngrok URL Stable

**Option 1**: Use ngrok with auth token (URLs last longer)
```bash
ngrok config add-authtoken YOUR_TOKEN
ngrok http 3000
```

**Option 2**: Deploy to a public server (Heroku, Railway, etc.)

**Option 3**: Use ngrok paid plan (static domains)

## Quick Test Commands

```bash
# 1. Start everything
docker-compose up -d
ngrok http 3000

# 2. Test webhook locally
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "18016809129",
            "text": {"body": "hello"},
            "id": "test123"
          }]
        }
      }]
    }]
  }'

# 3. Check logs
docker logs -f teachers_training-app-1 | grep -i whatsapp
```

## Next Steps After Setup

1. ✅ Verify webhook connection
2. ✅ Send "hello" from your phone
3. ✅ Receive menu response
4. ✅ Try "1" to access Module 1
5. ✅ Ask a question about teaching
6. ✅ Check web dashboard at http://localhost:3000/user-login.html

---

**Ready to test!** 🚀

Start ngrok, update the webhook, and message the bot!
