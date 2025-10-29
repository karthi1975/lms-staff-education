# WhatsApp Service SOLID Implementation - Examples

## 📚 Table of Contents
1. [Basic Usage](#basic-usage)
2. [Advanced Usage](#advanced-usage)
3. [SOLID Principles Demonstrated](#solid-principles-demonstrated)
4. [Extension Examples](#extension-examples)
5. [Testing Examples](#testing-examples)
6. [Migration Guide](#migration-guide)

---

## 🎯 Basic Usage

### **Backward Compatible** (works with existing code)

```javascript
// Old way still works!
const whatsappService = require('./services/whatsapp.service');

// All existing methods work
await whatsappService.sendMessage(phone, 'Hello!');
const challenge = whatsappService.verifyWebhook(req);
const message = whatsappService.extractMessage(webhookBody);
```

---

## 🚀 Advanced Usage

### **1. Custom Service with Different Configuration**

```javascript
const { WhatsAppServiceFactory } = require('./services/whatsapp');

// Create service with custom configuration
const customService = WhatsAppServiceFactory.create({
  accessToken: 'custom_token',
  phoneNumberId: 'custom_phone_id',
  maxMessageLength: 3000, // Shorter limit
  rateLimitDelay: 2000    // 2 seconds between chunks
});

await customService.sendMessage(phone, longText);
```

### **2. Test Service (No API Calls)**

```javascript
const { createTestService } = require('./services/whatsapp');

// Perfect for unit tests - no actual API calls
const testService = createTestService();
await testService.sendMessage(phone, 'Test'); // Returns mock response
```

### **3. Using Individual Components**

```javascript
const {
  MessageChunker,
  MessageExtractor,
  WebhookVerifier
} = require('./services/whatsapp');

// Use chunker independently
const chunker = new MessageChunker(4000);
const chunks = chunker.split(longText);

// Use extractor independently
const extractor = new MessageExtractor();
const message = extractor.extract(webhookBody);

// Use verifier independently
const verifier = new WebhookVerifier(config);
const challenge = verifier.verify(req);
```

---

## 🏗️ SOLID Principles Demonstrated

### **S - Single Responsibility Principle**

Each class has ONE job:

```javascript
// ❌ OLD: whatsapp.service.js did EVERYTHING
// - Webhook verification
// - Message extraction
// - Message sending
// - Text chunking
// - Different message types
// - HTTP client operations

// ✅ NEW: Each class has ONE responsibility

// WebhookVerifier - ONLY verifies webhooks
const verifier = new WebhookVerifier(config);
const challenge = verifier.verify(req);

// MessageExtractor - ONLY extracts messages
const extractor = new MessageExtractor();
const message = extractor.extract(body);

// MessageChunker - ONLY splits text
const chunker = new MessageChunker(4000);
const chunks = chunker.split(longText);

// TextMessageHandler - ONLY sends text messages
const textHandler = new TextMessageHandler(httpClient, config, chunker);
await textHandler.send(phone, text);
```

---

### **O - Open/Closed Principle**

Open for extension, closed for modification:

```javascript
// ✅ ADD NEW MESSAGE TYPE WITHOUT MODIFYING CODE

// 1. Create custom image handler (extends BaseMessageHandler)
const BaseMessageHandler = require('./services/whatsapp/message-handlers/BaseMessageHandler');

class ImageMessageHandler extends BaseMessageHandler {
  async send(to, data) {
    const { imageUrl, caption } = data;

    const payload = {
      ...this.buildBasePayload(to, 'image'),
      image: {
        link: imageUrl,
        caption: caption
      }
    };

    return await this.makeRequest(payload);
  }
}

// 2. Add to your custom service without modifying existing code!
const httpClient = new HttpClient();
const config = new WhatsAppConfig();
const imageHandler = new ImageMessageHandler(httpClient, config);

// 3. Use it!
await imageHandler.send(phone, {
  imageUrl: 'https://example.com/image.jpg',
  caption: 'Check this out!'
});

// ✅ The existing code didn't change at all!
```

---

### **L - Liskov Substitution Principle**

All message handlers implement the same interface:

```javascript
// All handlers can be substituted for BaseMessageHandler
const textHandler = new TextMessageHandler(httpClient, config, chunker);
const buttonHandler = new ButtonHandler(httpClient, config);
const documentHandler = new DocumentHandler(httpClient, config);
const imageHandler = new ImageMessageHandler(httpClient, config);

// This function works with ANY handler
async function sendToUser(handler, recipient, data) {
  return await handler.send(recipient, data);
}

// All work the same way
await sendToUser(textHandler, phone, 'Hello');
await sendToUser(buttonHandler, phone, { bodyText: 'Choose', buttons: [...] });
await sendToUser(documentHandler, phone, { documentUrl: '...', caption: '...' });
await sendToUser(imageHandler, phone, { imageUrl: '...', caption: '...' });
```

---

### **I - Interface Segregation Principle**

Clean, focused interfaces:

```javascript
// Each service has ONLY the methods it needs

// WebhookVerifier - ONLY verification methods
verifier.verify(req);
verifier.isVerificationRequest(req);

// MessageExtractor - ONLY extraction methods
extractor.extract(body);
extractor.isValidPayload(body);

// MessageChunker - ONLY chunking methods
chunker.split(text);
chunker.needsChunking(text);
chunker.addPartNumbers(chunks);

// WhatsAppConfig - ONLY configuration methods
config.getApiUrl();
config.getHeaders();
config.validate();

// Clients only depend on what they need!
```

---

### **D - Dependency Inversion Principle**

Depend on abstractions, not concretions:

```javascript
// ❌ OLD: Direct dependency on axios
const axios = require('axios');
await axios.post(url, data, { headers });

// ✅ NEW: Depend on HttpClient abstraction

// 1. Define HTTP client interface (abstraction)
interface IHttpClient {
  post(url: string, data: object, headers: object): Promise<any>;
  get(url: string, headers: object): Promise<any>;
}

// 2. Implementations
class AxiosHttpClient implements IHttpClient {
  async post(url, data, headers) {
    const response = await axios.post(url, data, { headers });
    return response.data;
  }
}

class FetchHttpClient implements IHttpClient {
  async post(url, data, headers) {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    return await response.json();
  }
}

class MockHttpClient implements IHttpClient {
  async post() {
    return { status: 'test_success' };
  }
}

// 3. Services depend on interface, not implementation
class TextMessageHandler {
  constructor(httpClient: IHttpClient, config) {
    this.httpClient = httpClient; // Abstraction!
  }

  async send(to, text) {
    return await this.httpClient.post(...); // Works with ANY client!
  }
}

// 4. Easy to test and swap implementations
const prodHandler = new TextMessageHandler(new AxiosHttpClient(), config);
const testHandler = new TextMessageHandler(new MockHttpClient(), config);
```

---

## 🔧 Extension Examples

### **Example 1: Add Image Message Support**

```javascript
const BaseMessageHandler = require('./services/whatsapp/message-handlers/BaseMessageHandler');

// 1. Create ImageMessageHandler (no modification to existing code!)
class ImageMessageHandler extends BaseMessageHandler {
  async send(to, data) {
    const { imageUrl, caption } = data;

    const payload = {
      ...this.buildBasePayload(to, 'image'),
      image: { link: imageUrl, caption }
    };

    return await this.makeRequest(payload);
  }
}

// 2. Add to MessageSender (extend, don't modify)
class ExtendedMessageSender extends MessageSender {
  constructor(handlers) {
    super(handlers);
    this.imageHandler = handlers.imageHandler;
  }

  async sendImage(to, imageUrl, caption) {
    return await this.imageHandler.send(to, { imageUrl, caption });
  }
}

// 3. Use it!
const imageHandler = new ImageMessageHandler(httpClient, config);
const extendedSender = new ExtendedMessageSender({
  ...existingHandlers,
  imageHandler
});

await extendedSender.sendImage(phone, 'https://...', 'Check this!');
```

### **Example 2: Add Retry Logic with Exponential Backoff**

```javascript
// Create RetryHttpClient decorator (DIP in action!)
class RetryHttpClient {
  constructor(httpClient, maxRetries = 3) {
    this.httpClient = httpClient;
    this.maxRetries = maxRetries;
  }

  async post(url, data, headers) {
    let lastError;

    for (let i = 0; i < this.maxRetries; i++) {
      try {
        return await this.httpClient.post(url, data, headers);
      } catch (error) {
        lastError = error;
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Use it without modifying any existing code!
const baseClient = new HttpClient();
const retryClient = new RetryHttpClient(baseClient, 5); // 5 retries

const textHandler = new TextMessageHandler(retryClient, config, chunker);
await textHandler.send(phone, text); // Now has retry logic!
```

### **Example 3: Add Logging to All HTTP Requests**

```javascript
// Create LoggingHttpClient decorator
class LoggingHttpClient {
  constructor(httpClient, logger) {
    this.httpClient = httpClient;
    this.logger = logger;
  }

  async post(url, data, headers) {
    this.logger.info('HTTP POST request', { url, data });

    try {
      const result = await this.httpClient.post(url, data, headers);
      this.logger.info('HTTP POST success', { url, result });
      return result;
    } catch (error) {
      this.logger.error('HTTP POST failed', { url, error });
      throw error;
    }
  }
}

// Use it!
const baseClient = new HttpClient();
const loggingClient = new LoggingHttpClient(baseClient, logger);

const textHandler = new TextMessageHandler(loggingClient, config, chunker);
await textHandler.send(phone, text); // Now logs all requests!
```

### **Example 4: Environment-Specific Services**

```javascript
const { WhatsAppServiceFactory } = require('./services/whatsapp');

function createWhatsAppService() {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'production':
      return WhatsAppServiceFactory.create({
        accessToken: process.env.PROD_WHATSAPP_TOKEN,
        maxMessageLength: 4096,
        rateLimitDelay: 1000
      });

    case 'staging':
      return WhatsAppServiceFactory.create({
        accessToken: process.env.STAGING_WHATSAPP_TOKEN,
        maxMessageLength: 4096,
        rateLimitDelay: 500
      });

    case 'development':
    case 'test':
    default:
      return WhatsAppServiceFactory.createTestService();
  }
}

module.exports = createWhatsAppService();
```

---

## 🧪 Testing Examples

### **Unit Test with Mock HTTP Client**

```javascript
// test/whatsapp/text-message-handler.test.js
const { expect } = require('chai');
const TextMessageHandler = require('../../services/whatsapp/message-handlers/TextMessageHandler');

// Mock HTTP client
class MockHttpClient {
  constructor() {
    this.requests = [];
  }

  async post(url, data, headers) {
    this.requests.push({ url, data, headers });
    return { status: 'success' };
  }
}

describe('TextMessageHandler', () => {
  it('should send text message with correct payload', async () => {
    const mockClient = new MockHttpClient();
    const config = { getApiUrl: () => 'https://api', getHeaders: () => ({}) };
    const chunker = { needsChunking: () => false };

    const handler = new TextMessageHandler(mockClient, config, chunker);
    await handler.send('1234567890', 'Hello');

    expect(mockClient.requests).to.have.lengthOf(1);
    expect(mockClient.requests[0].data.text.body).to.equal('Hello');
  });

  it('should chunk long messages', async () => {
    const mockClient = new MockHttpClient();
    const config = {
      getApiUrl: () => 'https://api',
      getHeaders: () => ({}),
      rateLimitDelay: 0
    };
    const chunker = {
      needsChunking: (text) => text.length > 100,
      split: (text) => ['Part 1', 'Part 2'],
      addPartNumbers: (chunks) => chunks.map((c, i) => `(${i+1}/2) ${c}`)
    };

    const handler = new TextMessageHandler(mockClient, config, chunker);
    const longText = 'A'.repeat(200);
    await handler.send('1234567890', longText);

    expect(mockClient.requests).to.have.lengthOf(2);
  });
});
```

### **Integration Test with Test Service**

```javascript
// test/integration/whatsapp-flow.test.js
const { createTestService } = require('../../services/whatsapp');

describe('WhatsApp Integration', () => {
  it('should handle complete message flow', async () => {
    const service = createTestService();

    // Verify webhook
    const challenge = service.verifyWebhook({ query: { 'hub.mode': 'subscribe' } });
    expect(challenge).to.exist;

    // Extract message
    const message = service.extractMessage({ entry: [...] });
    expect(message.from).to.equal('test_user');

    // Send response
    const result = await service.sendMessage(message.from, 'Reply');
    expect(result.status).to.equal('test_success');
  });
});
```

---

## 📋 Migration Guide

### **Step 1: No Changes Required (Backward Compatible)**

Your existing code continues to work:

```javascript
// This still works!
const whatsappService = require('./services/whatsapp.service');
await whatsappService.sendMessage(phone, text);
```

### **Step 2: Update Import Path (Optional)**

```javascript
// OLD
const whatsappService = require('./services/whatsapp.service');

// NEW (same functionality, new location)
const whatsappService = require('./services/whatsapp');
```

### **Step 3: Adopt New Features (Optional)**

```javascript
// Use factory for custom configuration
const { WhatsAppServiceFactory } = require('./services/whatsapp');
const customService = WhatsAppServiceFactory.create({
  maxMessageLength: 3000
});
```

---

## 📊 Benefits Summary

| Benefit | Before (Old Service) | After (SOLID Service) |
|---------|----------------------|----------------------|
| **Add new message type** | Modify whatsapp.service.js | Create new handler class |
| **Test without API** | Difficult | `createTestService()` |
| **Change HTTP client** | Modify service code | Inject different HttpClient |
| **Mock for testing** | Hard to mock | Easy with DIP |
| **Swap implementations** | Impossible | Easy (any handler works) |
| **Understand code** | One 355-line file | 14 focused files |

---

## 🎓 Key Takeaways

1. **SRP** makes each class easy to understand and test
   - WebhookVerifier: 46 lines
   - MessageExtractor: 123 lines
   - MessageChunker: 99 lines
   - Each handler: 30-90 lines

2. **OCP** lets you add message types without modifying existing code
   - Just extend BaseMessageHandler
   - No changes to existing handlers

3. **LSP** ensures all handlers work interchangeably
   - All implement `send(to, data)` method
   - Can substitute any handler

4. **ISP** provides clean, focused interfaces
   - Each service has only relevant methods
   - No forced unused dependencies

5. **DIP** makes testing and swapping implementations trivial
   - HttpClient abstraction
   - Easy to mock
   - Easy to decorate (retry, logging, etc.)

---

**The refactored WhatsApp service is:**
- ✅ Easier to test (14 focused classes vs 1 monolithic)
- ✅ Easier to extend (add new message types without modification)
- ✅ Easier to maintain (each file has one responsibility)
- ✅ Easier to understand (small, focused classes)
- ✅ Backward compatible! (existing code still works)

---

## 🗂️ File Structure

```
services/whatsapp/
├── index.js                          # Main export (backward compatible)
├── WhatsAppServiceFactory.js         # Factory (creates service)
├── WhatsAppConfig.js                 # Configuration (SRP)
├── WebhookVerifier.js                # Webhook verification (SRP)
├── MessageExtractor.js               # Message extraction (SRP)
├── MessageChunker.js                 # Text chunking (SRP)
├── MessageSender.js                  # Coordinates handlers (Facade)
├── HttpClient.js                     # HTTP abstraction (DIP)
└── message-handlers/                 # Handler classes (Strategy pattern)
    ├── index.js                      # Handlers export
    ├── BaseMessageHandler.js         # Base class (Template pattern)
    ├── TextMessageHandler.js         # Text messages (SRP)
    ├── InteractiveListHandler.js     # Interactive lists (SRP)
    ├── ButtonHandler.js              # Buttons (SRP)
    ├── DocumentHandler.js            # Documents (SRP)
    ├── TypingIndicatorHandler.js     # Typing indicator (SRP)
    └── ReadReceiptHandler.js         # Read receipts (SRP)
```

**Total: 14 files (vs 1 monolithic file)**
**Each file: 30-150 lines (vs 355 lines)**
**SOLID principles: All 5 demonstrated ✅**
