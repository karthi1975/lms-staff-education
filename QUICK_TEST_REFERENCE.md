# Quick Test Reference - Copy & Paste Commands

## 🚀 Instant Testing (Copy & Run)

### Local Testing (Docker)

```bash
# Test 1: WhatsApp Webhook - Swahili Message
curl -X POST http://localhost:3000/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+255123456789" \
  -d "Body=Habari yako? Nina swali kuhusu elimu."

# Test 2: Chat API - Swahili Message
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Habari yako? Nina swali kuhusu elimu.", "useContext": true}' \
  | jq -r '.response'

# Test 3: Chat API - English Message
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is classroom management?", "useContext": true}' \
  | jq -r '.response'
```

---

### GCP Production Testing

```bash
# Test 1: WhatsApp Webhook - Swahili Message
curl -X POST http://34.162.136.203:3000/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+255123456789" \
  -d "Body=Habari yako? Nina swali kuhusu elimu."

# Test 2: Chat API - Swahili Message
curl -s -X POST http://34.162.136.203:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Vipi naweza kufundisha vizuri?", "useContext": true}' \
  | jq -r '.response'

# Test 3: Chat API - English Message
curl -s -X POST http://34.162.136.203:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I create lesson plans?", "useContext": true}' \
  | jq -r '.response'
```

---

## 📋 Test Scripts (Run with 1 command)

### All Tests at Once

```bash
# Local
./test-both-endpoints.sh

# GCP
./test-both-endpoints.sh gcp
```

### WhatsApp Webhook Only

```bash
# Local
./test-whatsapp-webhook.sh

# GCP
./test-whatsapp-webhook.sh http://34.162.136.203:3000
```

### Chat Endpoint Only

```bash
# Local
./test-swahili-chat-endpoint.sh

# GCP (already configured)
./test-swahili-chat-endpoint.sh
```

---

## 🔍 Verification Commands

### Check if server is running
```bash
curl -s http://localhost:3000/health | jq
curl -s http://34.162.136.203:3000/health | jq
```

### View Docker logs
```bash
docker logs -f teachers_training_app_1 | grep -i "education\|swahili"
```

### Check database logs
```bash
docker exec -it teachers_training_postgres_1 psql -U teachers_user -d teachers_training \
  -c "SELECT phone, message_text, detected_language, created_at FROM content_moderation_log WHERE detected_language='swahili' ORDER BY created_at DESC LIMIT 5;"
```

---

## 📚 Full Documentation

- `TESTING_GUIDE.md` - Complete testing manual
- `/tmp/complete_testing_summary.md` - All test results
- `/tmp/swahili_auto_detection_testing_guide.md` - Detection algorithm
- `/tmp/swahili_auto_detection_test_results.md` - GCP results

---

## ✅ Expected Results

**Swahili Messages:** Should see "Habari", "Karibu", or "Asante sana"
**English Messages:** Should see "Hello", "Welcome", or standard English greeting
**WhatsApp Webhook:** Returns `<Response/>` (XML) - actual message sent async
**Chat API:** Returns JSON with response text immediately
