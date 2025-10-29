# Meta WhatsApp Cloud API Setup Guide

## Overview

This guide explains how to migrate from Twilio to Meta WhatsApp Cloud API for **real interactive UI components** in WhatsApp messages.

### Benefits of Meta WhatsApp Cloud API

✅ **Real Interactive Buttons** (up to 3 per message)
✅ **Real Interactive Lists** (up to 10 items)
✅ **Lower Cost** (~$0.005/message vs Twilio's pricing)
✅ **Better Delivery Rates**
✅ **Official Meta Support**
✅ **More Features** (catalogs, flows, payments)

### What Gets Upgraded

| Feature | Before (Twilio) | After (Meta Cloud API) |
|---------|-----------------|------------------------|
| **Course Selection** | Text with numbers | 🔘 Real tappable buttons |
| **Module Selection** | Text with numbers | 📋 Real interactive list |
| **Quiz Questions** | Text with A/B/C/D | 🔘 Tappable answer buttons |
| **User Experience** | Manual typing | Tap and select |

---

## Step 1: Sign Up for Meta WhatsApp Cloud API

### 1.1 Create Meta Business Account

1. Go to [Meta Business Suite](https://business.facebook.com)
2. Create a new Business Account (or use existing)
3. Navigate to **Meta Business Settings**

### 1.2 Create WhatsApp App

1. Go to [Meta for Developers](https://developers.facebook.com/apps/)
2. Click **"Create App"**
3. Select **"Business"** as app type
4. Fill in app details:
   - **App Name**: Teachers Training System
   - **Business Account**: Select your business
5. Click **"Create App"**

### 1.3 Set Up WhatsApp Product

1. In your app dashboard, find **"WhatsApp"** in the product list
2. Click **"Set up"**
3. Follow the configuration wizard:
   - Add WhatsApp as a product
   - Select or create a **Business Portfolio**
   - Select or create a **WhatsApp Business Account**

### 1.4 Get Phone Number

**Option A: Use Test Number (Free, for development)**
- Meta provides a test number automatically
- Can send to 5 test numbers
- Good for development

**Option B: Add Your Own Number** (for production)
1. Go to **WhatsApp > API Setup**
2. Click **"Add phone number"**
3. Verify your business phone number
4. Complete verification process

---

## Step 2: Get API Credentials

### 2.1 Get Access Token

1. Go to **WhatsApp > API Setup** in your app
2. Under **"Temporary access token"**, click **"Generate"**
   - This is a 24-hour token for testing
3. Copy the token (starts with `EAAG...`)

**For Production**: Create a permanent token
1. Go to **Settings > Basic**
2. Generate a **System User Access Token**:
   - Business Manager > Business Settings
   - Users > System Users
   - Create new system user
   - Assign WhatsApp permissions
   - Generate token (never expires)

### 2.2 Get Phone Number ID

1. In **WhatsApp > API Setup**, find **"From"** section
2. Copy the **Phone Number ID** (numeric ID, not the actual phone number)
   - Example: `123456789012345`

### 2.3 Get API Version

- Current version: **v18.0** (as of 2025)
- Check [Meta's API Changelog](https://developers.facebook.com/docs/graph-api/changelog) for latest version

---

## Step 3: Configure Webhook

### 3.1 Set Up Webhook URL

1. In your app, go to **WhatsApp > Configuration**
2. Find **"Webhook"** section
3. Click **"Edit"**
4. Enter your webhook details:

```
Callback URL: https://your-domain.com/webhook/meta
Verify Token: your_custom_verify_token_here
```

**Example for GCP**:
```
Callback URL: http://34.162.136.203:3000/webhook/meta
Verify Token: education_bot_verify_2024
```

### 3.2 Subscribe to Webhook Fields

Check these boxes:
- ☑ **messages** (required)
- ☑ **message_status** (optional, for delivery tracking)

### 3.3 Verify Webhook

- Meta will send a GET request to verify your webhook
- Your server must respond with the challenge parameter
- See `routes/meta-webhook.routes.js` (to be created) for implementation

---

## Step 4: Update Environment Variables

Add these to your `.env` file:

```env
# ============================================
# WhatsApp Provider Configuration
# ============================================

# Set to 'true' to enable Meta WhatsApp Cloud API (interactive UI)
USE_META_CLOUD_API=true

# Meta WhatsApp Cloud API Credentials
WHATSAPP_ACCESS_TOKEN=EAAG...your_token_here
PHONE_NUMBER_ID=123456789012345
WHATSAPP_API_VERSION=v18.0

# Webhook Verification Token (you choose this)
META_WEBHOOK_VERIFY_TOKEN=education_bot_verify_2024

# ============================================
# Twilio Configuration (keep for fallback)
# ============================================
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

---

## Step 5: Restart Your Application

### Local Development

```bash
# Stop current server
# Update .env with Meta credentials
# Restart server
npm start
```

### GCP Production

```bash
# SSH into GCP instance
gcloud compute ssh --zone "us-east5-a" "teachers-training" \
  --project "lms-tanzania-consultant"

# Update environment variables in docker-compose.yml
cd /home/karthi/teachers_training
nano docker-compose.yml

# Add these environment variables to the 'app' service:
#   - USE_META_CLOUD_API=true
#   - WHATSAPP_ACCESS_TOKEN=your_token
#   - PHONE_NUMBER_ID=your_phone_id
#   - WHATSAPP_API_VERSION=v18.0
#   - META_WEBHOOK_VERIFY_TOKEN=education_bot_verify_2024

# Restart containers
docker-compose down
docker-compose up -d

# Check logs
docker logs -f teachers_training_app_1

# Should see:
# ✅ Meta WhatsApp Cloud API initialized
# ✅ Using Meta WhatsApp Cloud API (Interactive UI enabled)
```

---

## Step 6: Test Interactive Messages

### 6.1 Test Course Selection (Buttons)

Send a WhatsApp message to your bot:
```
Hi
```

**Expected Result** (if 1-3 courses):
- You'll see a message with real tappable buttons
- Each button shows a course name
- Tap a button to select a course

**Before (Twilio Text)**:
```
📚 Available Courses

1. Business Studies
   Learn entrepreneurship
   • 5 modules

Reply with the number (1-1)
```

**After (Meta Cloud API Buttons)**:
```
📚 Teachers Training Platform
Welcome! Choose your course to get started:

[📖 1. Business] [button]
```

### 6.2 Test Module Selection (List)

After selecting a course, you should see:

**Expected Result**:
- You'll see a message with a **"View Modules"** button
- Tap the button to open a native list picker
- Select a module from the interactive list

**Before (Twilio Text)**:
```
📚 Business Studies

📖 Course Modules

1. Introduction
   Module description
   📝 Quiz available

Reply with number (1-5)
```

**After (Meta Cloud API List)**:
```
📚 Business Studies
Course Modules (5 available):

[View Modules] ← Tap to open list

(Opens native WhatsApp list picker with 5 modules)
```

### 6.3 Test Quiz Questions (Buttons)

Start a quiz:
```
quiz
```

**Expected Result** (for 2-3 option questions):
- You'll see interactive buttons for each answer option
- Tap the button to submit your answer

**Expected Result** (for 4-option questions):
- You'll see a **"Select Answer"** button
- Tap to open a list with all answer options

**Before (Twilio Text)**:
```
📝 Quiz Question 1/5

💡 Question:
   What is entrepreneurship?

○ Select Your Answer:

┌──────────────────────────────
│ ○ A. Starting a business
└──────────────────────────────

Reply with: A, B, C, or D
```

**After (Meta Cloud API List)**:
```
📝 Question 1/5
What is entrepreneurship?

[Select Answer] ← Tap to view options

(Opens list with A/B/C/D options)
```

---

## Step 7: Webhook Implementation (Already Done)

The system already handles Meta webhooks via:
- `services/meta-whatsapp-cloud.service.js` - API client
- `services/whatsapp-adapter.service.js` - Unified adapter
- `services/whatsapp-handler.service.js` - Message handler
- `services/course-orchestrator.service.js` - Interactive responses

### Webhook Payload Format

**Incoming Message (Text)**:
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "1234567890",
          "id": "wamid.xxx",
          "timestamp": "1234567890",
          "type": "text",
          "text": { "body": "Hello" }
        }]
      }
    }]
  }]
}
```

**Incoming Button Reply**:
```json
{
  "messages": [{
    "from": "1234567890",
    "type": "interactive",
    "interactive": {
      "type": "button_reply",
      "button_reply": {
        "id": "course_1",
        "title": "1. Business"
      }
    }
  }]
}
```

---

## Troubleshooting

### Issue 1: Webhook Not Receiving Messages

**Check**:
1. Webhook URL is publicly accessible
2. Webhook is subscribed to `messages` field
3. Verify token matches your configuration
4. Check server logs for webhook calls

**Fix**:
```bash
# Check if webhook endpoint is accessible
curl -X GET "https://your-domain.com/webhook/meta?hub.mode=subscribe&hub.verify_token=education_bot_verify_2024&hub.challenge=test"

# Should return: test
```

### Issue 2: Messages Still Show Text Format

**Check**:
1. `USE_META_CLOUD_API=true` in environment variables
2. `WHATSAPP_ACCESS_TOKEN` and `PHONE_NUMBER_ID` are set
3. Server logs show: `✅ Using Meta WhatsApp Cloud API (Interactive UI enabled)`

**Fix**:
```bash
# Check environment variables
docker exec teachers_training_app_1 env | grep WHATSAPP

# Restart with new environment
docker-compose down && docker-compose up -d
```

### Issue 3: Access Token Expired

**Symptoms**:
- API returns 401 Unauthorized
- Messages fail to send

**Fix**:
1. Generate a new access token (Step 2.1)
2. For production, use System User token (never expires)
3. Update `WHATSAPP_ACCESS_TOKEN` environment variable
4. Restart application

### Issue 4: Phone Number Not Verified

**Symptoms**:
- Cannot send messages
- API returns "Phone number not registered"

**Fix**:
1. Verify your business phone number in Meta Business Manager
2. Complete SMS/call verification
3. Wait for approval (usually 24-48 hours)

---

## Cost Comparison

### Twilio vs Meta WhatsApp Cloud API

| Feature | Twilio | Meta Cloud API |
|---------|--------|----------------|
| **Pricing** | $0.005-0.03/message | $0.005/message (conversation-based) |
| **Free Tier** | Trial credits | 1,000 conversations/month FREE |
| **Interactive UI** | Limited | Full support (buttons, lists) |
| **Setup** | Easy | Medium (requires Business Manager) |
| **Delivery** | Good | Excellent |

### Meta Pricing Model

- **Free**: First 1,000 business-initiated conversations/month
- **After Free Tier**: ~$0.005/conversation (varies by country)
- **Conversation** = 24-hour window after user message
- **More Info**: [Meta Pricing](https://developers.facebook.com/docs/whatsapp/pricing)

---

## Migration Checklist

- [ ] Create Meta Business Account
- [ ] Create WhatsApp App
- [ ] Get Access Token
- [ ] Get Phone Number ID
- [ ] Configure Webhook URL
- [ ] Update `.env` with Meta credentials
- [ ] Set `USE_META_CLOUD_API=true`
- [ ] Restart application
- [ ] Test course selection (buttons)
- [ ] Test module selection (list)
- [ ] Test quiz questions (buttons/list)
- [ ] Monitor logs for errors
- [ ] Update documentation

---

## Support

### Documentation
- [Meta WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Meta Business Manager](https://business.facebook.com)
- [API Reference](https://developers.facebook.com/docs/graph-api/reference/whatsapp-business-account)

### Common Issues
- [Troubleshooting Guide](https://developers.facebook.com/docs/whatsapp/cloud-api/support/troubleshooting)
- [Error Codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes)

---

*Last Updated: 2025-10-24*
*Version: 1.0.0*
