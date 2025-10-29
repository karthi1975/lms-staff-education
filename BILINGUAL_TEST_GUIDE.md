# Bilingual Testing Guide for Business Studies Orientation

## Quick Test Commands

### Test 1: English Query
```bash
gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant" --command "
curl -X POST 'http://localhost:3000/webhook/twilio' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'From=whatsapp:+255712345678' \
  -d 'To=whatsapp:+14155238886' \
  -d 'Body=Tell me about entrepreneurship' \
  -d 'MessageSid=SM_TEST_EN'
"
```

**Expected**: Response in English about entrepreneurship from Business Studies course

---

### Test 2: Swahili Query
```bash
gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant" --command "
curl -X POST 'http://localhost:3000/webhook/twilio' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'From=whatsapp:+255712345678' \
  -d 'To=whatsapp:+14155238886' \
  -d 'Body=Niambie kuhusu ujasiriamali' \
  -d 'MessageSid=SM_TEST_SW'
"
```

**Expected**: Response in Swahili about ujasiriamali (entrepreneurship) from Business Studies course

---

### Test 3: Check Logs for Responses
```bash
gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant" --command "
docker logs teachers_training_app_1 --tail 50 2>&1 | grep -A 5 'Sending Twilio WhatsApp'
"
```

This shows the actual messages being sent to WhatsApp

---

### Test 4: View Full Conversation
```bash
gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant" --command "
docker logs teachers_training_app_1 --tail 100 2>&1 | grep 'Body\|processed'
"
```

---

## Simple Test Phrases

### English Queries:
- `Tell me about entrepreneurship`
- `What is business planning?`
- `Explain business management`
- `How do I start a business?`
- `What are business strategies?`

### Swahili Queries:
- `Niambie kuhusu ujasiriamali` (Tell me about entrepreneurship)
- `Nifundishe kuhusu biashara` (Teach me about business)
- `Mpango wa biashara ni nini?` (What is business planning?)
- `Je, naweza kujifunza biashara?` (Can I learn business?)
- `Usimamizi wa biashara ni nini?` (What is business management?)

---

## Testing via Real WhatsApp

1. **Get your Twilio WhatsApp number** (from Twilio console)
2. **Send WhatsApp message** from your phone
3. **Try these messages:**
   - English: "Tell me about entrepreneurship"
   - Swahili: "Niambie kuhusu ujasiriamali"
4. **Compare responses** - they should be in the same language as your question

---

## What to Verify

✅ **Language Detection:**
- English queries → English responses
- Swahili queries → Swahili responses

✅ **Content Accuracy:**
- Responses mention entrepreneurship/ujasiriamali
- Content from Business Studies course
- Relevant to the query

✅ **Formatting:**
- Material Design 3 formatting preserved
- Proper emoji usage
- Clear section headers

✅ **Navigation:**
- Menu options in detected language
- Course selection in user's language
- Module navigation in user's language

---

## Troubleshooting

### If responses are always in English:
```bash
# Check if translation service is loaded
gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant" --command "
docker exec teachers_training_app_1 ls -l /app/services/translation.service.js
"
```

### If no response received:
```bash
# Check if user is verified
gcloud compute ssh teachers-training --zone "us-east5-a" --project "lms-tanzania-consultant" --command "
docker exec teachers_training_app_1 node -e \"
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});
(async () => {
  const result = await pool.query('SELECT whatsapp_id, is_verified, enrollment_status FROM users WHERE whatsapp_id = \\'+255712345678\\'');
  console.log(result.rows[0]);
  await pool.end();
})();
\"
"
```

---

## Production URL
**GCP Instance**: http://34.162.168.124:3000

---

## Key Translation Examples

| English | Swahili |
|---------|---------|
| Welcome | Karibu |
| Available Courses | Kozi Zinazopatikana |
| Choose a course | Chagua kozi |
| Modules | Moduli |
| Entrepreneurship | Ujasiriamali |
| Business | Biashara |
| Start learning | Anza kujifunza |
| Quiz | Jaribio |
| Assessment | Tathmini |
| Help | Msaada |

---

## Files Created

- `test-business-studies-bilingual.sh` - Automated test script
- `simple-bilingual-examples.txt` - Copy-paste examples
- `BILINGUAL_TEST_GUIDE.md` - This guide (comprehensive reference)

---

**Last Updated**: 2025-10-29
**Branch**: feature/quiz-upload-and-ocr-fixes
**Deployment**: GCP Production
