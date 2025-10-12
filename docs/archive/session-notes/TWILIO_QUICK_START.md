# Twilio WhatsApp - Quick Start (5 Minutes)

## 1. Get Your Auth Token

Visit: https://console.twilio.com
- Click "Show" on Auth Token
- Copy it

## 2. Update .env

```bash
# Add these lines to .env
TWILIO_ACCOUNT_SID=AC906ca9524b640b
TWILIO_AUTH_TOKEN=paste_your_token_here
TWILIO_PHONE_NUMBER=+18014366249
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
WHATSAPP_PROVIDER=twilio
```

## 3. Get ngrok URL

```bash
# Check ngrok status
curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*ngrok[^"]*' | head -1
```

Example output: `https://9c3008b6d5c7.ngrok-free.app`

## 4. Configure Twilio Webhook

1. Go to: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
2. Scroll to "Sandbox Configuration"
3. Set:
   - **When a message comes in**: `https://YOUR-NGROK-URL/webhook/twilio`
   - Method: `HTTP POST`
4. Click **Save**

## 5. Join Sandbox

1. Open WhatsApp on your phone
2. Send this message to `+1 415 523 8886`:
   ```
   join <your-code-from-twilio-console>
   ```
3. Wait for confirmation

## 6. Test It!

Send a WhatsApp message to `+1 415 523 8886`:
```
hello
```

You should get a response from the bot! 🎉

---

## Troubleshooting

**Bot not responding?**
```bash
# Check server logs
docker logs -f teachers-training-app

# Or if running locally
npm start
```

**Need help?** See full guide: `TWILIO_WHATSAPP_SETUP.md`
