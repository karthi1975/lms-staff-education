# Complete Testing Guide: WhatsApp & Chat Endpoints

## Overview
This guide shows how to test both endpoints that use Swahili auto-detection:
1. **Twilio WhatsApp Webhook** - For incoming WhatsApp messages
2. **Chat API** - For admin chat interface

Both endpoints automatically detect Swahili without requiring a language parameter.

---

## 🌍 Environment URLs

| Environment | Base URL |
|-------------|----------|
| **Local (Docker)** | http://localhost:3000 |
| **GCP Production** | http://34.162.136.203:3000 |

---

## 📱 Method 1: Testing Twilio WhatsApp Webhook

### Endpoint Details
```
POST /webhook/twilio
Content-Type: application/x-www-form-urlencoded
```

This endpoint receives incoming WhatsApp messages from Twilio.

### Request Format (URL-encoded)
```bash
curl -X POST http://localhost:3000/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+255123456789" \
  -d "Body=Habari yako? Nina swali kuhusu elimu."
```

### Test Examples

#### Example 1: Swahili Message
```bash
#!/bin/bash
# Test Swahili auto-detection via WhatsApp webhook

curl -X POST http://localhost:3000/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+255700111222" \
  -d "Body=Habari yako? Nina swali kuhusu elimu."

# Expected: Swahili response with educational content
```

**Swahili words detected:** habari (✓), yako (✓), nina (✓) = 3 indicators
**Auto-detected language:** Swahili
**Expected response:** Swahili greeting + educational content

---

#### Example 2: English Message
```bash
#!/bin/bash
# Test English default via WhatsApp webhook

curl -X POST http://localhost:3000/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+255700333444" \
  -d "Body=What is classroom management?"

# Expected: English response with educational content
```

**Swahili words detected:** 0 indicators
**Auto-detected language:** English
**Expected response:** English greeting + educational content

---

#### Example 3: Mixed Language
```bash
#!/bin/bash
# Test mixed Swahili-English via WhatsApp webhook

curl -X POST http://localhost:3000/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+255700555666" \
  -d "Body=Asante for the help sana"

# Expected: Swahili response (2+ Swahili words detected)
```

**Swahili words detected:** asante (✓), sana (✓) = 2 indicators
**Auto-detected language:** Swahili
**Expected response:** "Asante sana..." with educational content

---

## 💬 Method 2: Testing Chat API

### Endpoint Details
```
POST /api/chat
Content-Type: application/json
```

This endpoint is used by the admin chat interface.

### Request Format (JSON)
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Vipi naweza kufundisha vizuri?",
    "useContext": true
  }'
```

### Test Examples

#### Example 1: Swahili Educational Question
```bash
#!/bin/bash
# Test Swahili auto-detection via chat API

curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Vipi naweza kufundisha vizuri?",
    "useContext": true
  }' | jq -r '.response'

# Expected: Educational content about teaching methods
```

**Swahili words detected:** vipi (✓), naweza (✓) = 2 indicators
**Auto-detected language:** Swahili
**Expected response:** Educational teaching guidance

---

#### Example 2: English Educational Question
```bash
#!/bin/bash
# Test English via chat API

curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I create effective lesson plans?",
    "useContext": true
  }' | jq -r '.response'

# Expected: English lesson planning guidance
```

**Swahili words detected:** 0 indicators
**Auto-detected language:** English
**Expected response:** Lesson planning strategies

---

#### Example 3: With Module Context
```bash
#!/bin/bash
# Test with specific module context

curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Nina swali kuhusu classroom management",
    "module_id": 2,
    "useContext": true
  }' | jq -r '.response'

# Expected: Swahili response with Module 2 content
```

**Swahili words detected:** nina (✓), kuhusu (✓) = 2 indicators
**Auto-detected language:** Swahili
**Module context:** 2 (Classroom Management)

---

## 🧪 Complete Test Script

Save this as `test-complete-swahili-detection.sh`:

```bash
#!/bin/bash

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "🧪 Complete Swahili Auto-Detection Test Suite"
echo "=============================================="
echo "Testing on: $BASE_URL"
echo ""

# ============================================================================
# PART 1: WhatsApp Webhook Tests
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 PART 1: WhatsApp Webhook (/webhook/twilio)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Swahili WhatsApp message
echo "Test 1: Swahili Message"
echo "────────────────────────"
curl -X POST $BASE_URL/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+255700111222" \
  -d "Body=Habari yako? Nina swali kuhusu elimu."
echo ""
echo ""

# Test 2: English WhatsApp message
echo "Test 2: English Message"
echo "────────────────────────"
curl -X POST $BASE_URL/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+255700333444" \
  -d "Body=What is classroom management?"
echo ""
echo ""

# Test 3: Mixed WhatsApp message
echo "Test 3: Mixed Language (Swahili + English)"
echo "───────────────────────────────────────────"
curl -X POST $BASE_URL/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+255700555666" \
  -d "Body=Asante for the help sana"
echo ""
echo ""

# ============================================================================
# PART 2: Chat API Tests
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💬 PART 2: Chat API (/api/chat)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 4: Swahili chat message
echo "Test 4: Swahili Educational Question"
echo "─────────────────────────────────────"
curl -s -X POST $BASE_URL/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Vipi naweza kufundisha vizuri?",
    "useContext": true
  }' | jq -r '.response' | head -c 300
echo ""
echo ""

# Test 5: English chat message
echo "Test 5: English Educational Question"
echo "─────────────────────────────────────"
curl -s -X POST $BASE_URL/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I create lesson plans?",
    "useContext": true
  }' | jq -r '.response' | head -c 300
echo ""
echo ""

# Test 6: Mixed chat message
echo "Test 6: Mixed Language Chat"
echo "───────────────────────────"
curl -s -X POST $BASE_URL/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Asante for explaining sana",
    "useContext": true
  }' | jq -r '.response' | head -c 300
echo ""
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All Tests Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Expected Results:"
echo "  • Tests 1, 3: Swahili responses (2+ Swahili words)"
echo "  • Tests 2, 5: English responses (0 Swahili words)"
echo "  • Tests 4, 6: Swahili responses (2+ Swahili words)"
echo ""
```

### Run the complete test:
```bash
# Local testing
chmod +x test-complete-swahili-detection.sh
./test-complete-swahili-detection.sh

# GCP testing
BASE_URL=http://34.162.136.203:3000 ./test-complete-swahili-detection.sh
```

---

## 🔍 Verification Methods

### Method 1: Check Response Language
Look for language-specific greetings:
- **Swahili**: "Habari", "Karibu", "Asante sana"
- **English**: "Hello", "Welcome", "Thank you"

### Method 2: Check Database Logs
```sql
-- Connect to PostgreSQL
docker exec -it teachers_training_postgres_1 psql -U teachers_user -d teachers_training

-- Query content moderation logs
SELECT
  phone,
  message_text,
  detected_language,
  category,
  created_at
FROM content_moderation_log
WHERE detected_language = 'swahili'
ORDER BY created_at DESC
LIMIT 10;
```

### Method 3: Monitor Real-Time Logs
```bash
# Watch Docker logs for detection events
docker logs -f teachers_training_app_1 | grep -i "swahili\|detected"
```

---

## 🌐 Testing on GCP Production

### Simple GCP Tests

**Test 1: Swahili via Chat (GCP)**
```bash
curl -s -X POST http://34.162.136.203:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Habari yako? Nina swali kuhusu elimu.",
    "useContext": true
  }' | jq -r '.response'
```

**Test 2: English via Chat (GCP)**
```bash
curl -s -X POST http://34.162.136.203:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is classroom management?",
    "useContext": true
  }' | jq -r '.response'
```

**Test 3: WhatsApp Webhook (GCP)**
```bash
curl -X POST http://34.162.136.203:3000/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+255123456789" \
  -d "Body=Vipi naweza kufundisha vizuri?"
```

---

## 📊 Auto-Detection Rules

### Detection Algorithm
```javascript
// services/content-moderation.service.js:370-390

1. Scan message for 30+ Swahili indicators:
   ['ni', 'na', 'wa', 'ya', 'kwa', 'habari', 'asante', 'nina',
    'naweza', 'vipi', 'sana', 'tafadhali', ...]

2. Use word boundaries (\b) to match whole words only

3. Count matches

4. IF match_count >= 2:
     detected_language = 'swahili'
   ELSE:
     detected_language = 'english'

5. Return detected language
```

### Common Swahili Indicators
| Word | Meaning | Common in Messages |
|------|---------|-------------------|
| habari | hello/news | Very common |
| asante | thank you | Very common |
| sana | very much | Very common |
| nina | I have | Common |
| naweza | I can | Common |
| vipi | how | Common |
| nini | what | Common |
| tafadhali | please | Common |

---

## ⚠️ Important Notes

### Endpoint Differences

| Feature | WhatsApp Webhook | Chat API |
|---------|-----------------|----------|
| **Content-Type** | x-www-form-urlencoded | application/json |
| **Field Name** | `Body` | `message` |
| **Phone Field** | `From` (whatsapp:+255...) | Not required |
| **Context** | Automatic from ChromaDB | Optional (`useContext: true`) |
| **Module** | Auto-detected | Optional (`module_id`) |

### Common Issues

**Issue 1: WhatsApp webhook returns 404**
- **Cause:** Twilio webhook routes not loaded
- **Solution:** Check `server.js` includes twilio-webhook.routes.js

**Issue 2: Chat returns "Cannot POST /api/chat"**
- **Cause:** Enhanced RAG routes not loaded
- **Solution:** Check `server.js` includes enhanced-rag.routes.js

**Issue 3: No Swahili detection**
- **Cause:** Message has < 2 Swahili words
- **Solution:** Add more Swahili words to message (e.g., "Habari, nina swali")

---

## 🎯 Quick Reference

### Test Locally (Docker)
```bash
# Chat endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Habari yako?", "useContext": true}'

# WhatsApp webhook
curl -X POST http://localhost:3000/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+255123456789" \
  -d "Body=Habari yako?"
```

### Test on GCP
```bash
# Chat endpoint
curl -X POST http://34.162.136.203:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Habari yako?", "useContext": true}'

# WhatsApp webhook
curl -X POST http://34.162.136.203:3000/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+255123456789" \
  -d "Body=Habari yako?"
```

---

## 📚 Related Documentation

- `/tmp/swahili_auto_detection_testing_guide.md` - Detailed testing manual
- `/tmp/swahili_auto_detection_test_results.md` - GCP production test results
- `services/content-moderation.service.js:370-390` - Detection algorithm
- `routes/twilio-webhook.routes.js` - WhatsApp webhook implementation
- `routes/enhanced-rag.routes.js` - Chat API implementation

---

**Last Updated:** 2025-10-26
**System:** Teachers Training Platform
**Feature:** Swahili Auto-Detection
**Status:** ✅ Production Ready
