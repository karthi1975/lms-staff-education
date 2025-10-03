# Business Verification Process - Step by Step

## Prerequisites Checklist
Before starting, ensure you have:
- [ ] Business legal name
- [ ] Business address
- [ ] Business phone number
- [ ] Email address for business
- [ ] One of these documents:
  - Business license
  - Articles of incorporation
  - Tax registration certificate
  - Utility bill showing business name/address

## Step 1: Access Meta Business Settings
1. Go to: https://business.facebook.com/settings
2. Log in with your Facebook account
3. If you don't have a Business Manager, create one first

## Step 2: Start Business Verification
1. In Business Settings, click **"Security Center"** in left menu
2. Click **"Business Verification"**
3. Click **"Start Verification"** button
4. Select your country/region
5. Enter your business details:
   - Legal business name
   - Business address
   - Business phone number
   - Business website (use your ngrok URL temporarily if needed)

## Step 3: Upload Documents
Choose ONE of these options:

### Option A: Business License
- Upload clear photo/scan of business license
- Must show business name and address

### Option B: Tax Documents
- Upload tax registration certificate
- Or business tax return
- Must be recent (within last 12 months)

### Option C: Utility Bill
- Upload recent utility bill (electricity, water, internet)
- Must show business name and address
- Must be dated within last 90 days

### Option D: Articles of Incorporation
- Upload incorporation documents
- Must show business legal name

## Step 4: Verify Business Phone
1. Click "Verify Phone Number"
2. Choose verification method:
   - **Text message** (recommended)
   - Phone call
3. Enter verification code

## Step 5: Verify Business Domain (Optional but Helps)
1. Add your website domain
2. Choose verification method:
   - DNS TXT record
   - HTML file upload
   - Meta tag
3. Follow instructions to verify

## Step 6: Submit for Review
1. Review all entered information
2. Click "Submit for Review"
3. You'll receive email confirmation

## Timeline
- **Review time**: 2-3 business days (often faster)
- **Status updates**: Via email and in Business Manager
- **If rejected**: You'll get specific reasons and can resubmit

## After Verification is Approved

### Enable WhatsApp Business Platform
1. Go to: https://developers.facebook.com/apps/
2. Select your app (should show your App ID)
3. Go to **"WhatsApp" → "Getting Started"**
4. Click **"Start Using the API"**

### Request Advanced Access
1. In app dashboard: **"App Review" → "Permissions and Features"**
2. Find and request:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
3. For each permission:
   - Describe use case: "Educational bot providing teacher training materials in multiple languages to educators"
   - Provide test instructions:
     ```
     1. Send "menu" to see available modules
     2. Send "help" for assistance
     3. Ask "What is Chimbuko la Kazi?" for content
     ```

### Submit App Review
1. Go to **"App Review" → "My Apps"**
2. Provide required URLs:
   - **Privacy Policy URL**: Create a simple one or use a generator
   - **Terms of Service URL**: Create basic terms
   - **Data Deletion URL**: Can be email instructions
3. Add app description:
   ```
   Teachers Training Bot provides educational content and training materials 
   to teachers. It offers curriculum guidance, teaching methods, and 
   assessment strategies in multiple languages including English and Swahili.
   ```

### Recording Demo Video
1. Record 2-3 minute video showing:
   - User sending first message
   - Bot responding with menu
   - User selecting module
   - Bot providing educational content
   - User asking questions
2. Upload to YouTube (unlisted) or use Loom
3. Submit video URL with app review

## Quick Privacy Policy Template
```
Privacy Policy for Teachers Training Bot

Last updated: [Date]

We collect:
- Phone numbers for message delivery
- Message content for providing responses
- Learning progress for personalization

We do not:
- Share data with third parties
- Use data for marketing
- Store messages beyond session

Contact: [Your email]
```

## Terms of Service Template
```
Terms of Service for Teachers Training Bot

1. Service Description
Educational bot providing teacher training materials.

2. Acceptable Use
- Educational purposes only
- No spam or abuse
- Respect content copyrights

3. Disclaimer
Educational content provided as-is for training purposes.

Contact: [Your email]
```

## Common Rejection Reasons & Fixes
1. **Incomplete business info** → Double-check all fields
2. **Unclear use case** → Be specific about educational purpose
3. **Missing test instructions** → Provide step-by-step guide
4. **No privacy policy** → Add one (use template above)

## Need Help?
- Meta Business Support: https://business.facebook.com/business/help
- WhatsApp Business API Docs: https://developers.facebook.com/docs/whatsapp

## Next Steps After Approval
1. Toggle app from "Development" to "Live"
2. Remove test number restrictions
3. Your bot works for ANY WhatsApp number!

## Alternative: Quick BSP Setup
If you need public access TODAY, use Twilio:
1. Sign up: https://www.twilio.com/whatsapp
2. Get approved sandbox instantly
3. Upgrade to production ($15/month + messages)
4. Works globally within 1 hour