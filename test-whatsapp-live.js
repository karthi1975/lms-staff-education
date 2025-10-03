require('dotenv').config();
const axios = require('axios');

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

async function sendTestMessage(phoneNumber) {
  try {
    console.log('Sending WhatsApp message to:', phoneNumber);
    
    const response = await axios({
      method: 'POST',
      url: `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: {
          body: '🎓 *Teachers Training Bot Active!*\n\nI can now answer questions about:\n• Chimbuko la Kazi\n• Business Studies curriculum\n• Teaching methodologies\n• Training schedules\n\nTry asking me:\n"What is Chimbuko la Kazi?"\n"Eleza ratiba ya mafunzo"\n"What are the Day 1 activities?"'
        }
      }
    });
    
    console.log('✅ Message sent successfully!');
    console.log('Message ID:', response.data.messages[0].id);
    
    // Send interactive buttons
    await axios({
      method: 'POST',
      url: `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: 'Choose a topic to learn about:'
          },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: {
                  id: 'chimbuko',
                  title: 'Chimbuko la Kazi'
                }
              },
              {
                type: 'reply',
                reply: {
                  id: 'schedule',
                  title: 'Training Schedule'
                }
              },
              {
                type: 'reply',
                reply: {
                  id: 'business',
                  title: 'Business Studies'
                }
              }
            ]
          }
        }
      }
    });
    
    console.log('✅ Interactive buttons sent!');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Usage: node test-whatsapp-live.js +1234567890
const phoneNumber = process.argv[2];
if (!phoneNumber) {
  console.log('Usage: node test-whatsapp-live.js +1234567890');
  console.log('Example: node test-whatsapp-live.js +12025551234');
  process.exit(1);
}

sendTestMessage(phoneNumber);