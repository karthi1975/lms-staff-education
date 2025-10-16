# Cloud Webhook Configuration for Twilio

## Cloud Instance Details
- **IP Address**: 34.162.136.203
- **Port**: 3000
- **Webhook URL**: http://34.162.136.203:3000/webhook/twilio/

## Twilio Configuration Steps

### 1. WhatsApp Sender Configuration
Go to: https://console.twilio.com/us1/develop/sms/senders/whatsapp-senders

For your production number **+1 806 515 7636**:
1. Click on the WhatsApp Sender
2. Find "Webhook Configuration" section
3. Set **When a message comes in**:
   - URL: `http://34.162.136.203:3000/webhook/twilio/`
   - Method: `HTTP POST`
4. Save configuration

### 2. Status Callback (Optional)
For message delivery status:
- URL: `http://34.162.136.203:3000/webhook/twilio/status`
- Method: `HTTP POST`

### 3. Test the Webhook
```bash
# Test from local machine
curl -X POST http://34.162.136.203:3000/webhook/twilio/ \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+18016809129" \
  -d "To=whatsapp:+18065157636" \
  -d "Body=Hello" \
  -d "MessageSid=TEST123"
```

### 4. Check Cloud Instance Health
```bash
curl http://34.162.136.203:3000/health
```

## Security Recommendations

### ⚠️ IMPORTANT: Use HTTPS in Production
The current setup uses HTTP, which is not recommended for production. Consider:

1. **Setup SSL Certificate**:
   - Use Let's Encrypt for free SSL
   - Configure nginx as reverse proxy with SSL

2. **Add Firewall Rules**:
   ```bash
   # Allow only Twilio IP ranges
   gcloud compute firewall-rules create allow-twilio-webhook \
     --allow tcp:3000 \
     --source-ranges=54.172.60.0/23,54.244.51.0/24 \
     --target-tags=twilio-webhook
   ```

3. **Enable Twilio Signature Validation**:
   Update `.env`:
   ```
   TWILIO_SKIP_VALIDATION=false
   ```

## Current Configuration

### Production Number
- **Number**: +1 806 515 7636
- **WhatsApp Number**: whatsapp:+18065157636
- **Webhook**: http://34.162.136.203:3000/webhook/twilio/

### Sandbox Number (Testing)
- **Number**: +1 415 523 8886
- **WhatsApp Number**: whatsapp:+14155238886
- **Join Code**: "join <code>" (check Twilio console)

## Testing Checklist

- [ ] Health endpoint responds: `curl http://34.162.136.203:3000/health`
- [ ] Webhook receives test message
- [ ] Send WhatsApp message to +1 806 515 7636
- [ ] Receive educational response about Business Studies
- [ ] Check cloud instance logs: `docker logs teachers_training-app-1`
- [ ] Verify RAG retrieval working (should get content from ChromaDB)
- [ ] Verify Vertex AI responses (not fallback method)

## Monitoring

### Check Cloud Instance Logs
```bash
# SSH into cloud instance
gcloud compute ssh <instance-name> --zone=<zone>

# Check Docker logs
docker logs -f teachers_training-app-1

# Check for webhook activity
docker logs teachers_training-app-1 2>&1 | grep -i "webhook\|twilio"
```

### Health Check Endpoint
Monitor: http://34.162.136.203:3000/health
```json
{
  "status": "healthy",
  "services": {
    "postgres": "healthy",
    "neo4j": "healthy",
    "chroma": "healthy"
  }
}
```

## Troubleshooting

### Webhook Not Receiving Messages
1. Check Twilio console for webhook errors
2. Verify firewall allows traffic on port 3000
3. Test with curl from external machine
4. Check cloud instance is running: `docker ps`

### Messages Not Getting Responses
1. Check cloud instance logs for errors
2. Verify ChromaDB has content: Check `/health` endpoint
3. Verify Vertex AI credentials are fresh
4. Check database connections

## Next Steps

1. ✅ Update Twilio webhook URL in console
2. ✅ Test with WhatsApp message
3. 🔒 Setup HTTPS/SSL (recommended)
4. 🔒 Add firewall rules for security
5. 📊 Setup monitoring/alerting

---
**Cloud Instance**: 34.162.136.203:3000  
**Webhook**: http://34.162.136.203:3000/webhook/twilio/  
**Production Number**: +1 806 515 7636  
**Status**: Ready for configuration ✅
