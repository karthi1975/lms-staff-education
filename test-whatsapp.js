#!/usr/bin/env node

/**
 * WhatsApp Message Test Script
 * This script sends test messages to your WhatsApp number
 * Usage: node test-whatsapp.js [phone_number]
 */

require('dotenv').config();
const axios = require('axios');

// Configuration from environment
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

// Get phone number from command line or use default
const phoneNumber = process.argv[2] || '+1234567890'; // Replace with your default number

// Test messages
const testMessages = [
    {
        name: "Welcome Message",
        text: "🎓 Welcome to Teachers Training Bot!\n\nI'm here to help you with your professional development journey.\n\nType 'help' to see available options or 'menu' to view all training modules."
    },
    {
        name: "Module List",
        text: "📚 *Available Training Modules:*\n\n1️⃣ Introduction to Teaching\n2️⃣ Classroom Management\n3️⃣ Lesson Planning\n4️⃣ Assessment Strategies\n5️⃣ Technology in Education\n\nType the module number to start learning!"
    },
    {
        name: "Interactive Message with Buttons",
        type: "interactive",
        body: "What would you like to do today?",
        buttons: [
            { id: "start_module", title: "Start Learning" },
            { id: "view_progress", title: "View Progress" },
            { id: "take_quiz", title: "Take a Quiz" }
        ]
    },
    {
        name: "Quiz Question",
        text: "❓ *Quick Quiz*\n\nWhat is the most important factor in classroom management?\n\nA) Strict rules\nB) Building relationships\nC) Punishment\nD) Rewards\n\nReply with your answer (A, B, C, or D)"
    },
    {
        name: "Progress Update",
        text: "📊 *Your Learning Progress*\n\n✅ Module 1: Completed (Score: 85%)\n🔄 Module 2: In Progress (60%)\n⏳ Module 3: Not Started\n⏳ Module 4: Not Started\n⏳ Module 5: Not Started\n\n*Overall Progress: 30%*\n\nKeep up the great work! 💪"
    }
];

// Function to send text message
async function sendTextMessage(to, text) {
    try {
        const response = await axios({
            method: 'POST',
            url: WHATSAPP_API_URL,
            headers: {
                'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            data: {
                messaging_product: 'whatsapp',
                to: to.replace('+', ''), // Remove + if present
                type: 'text',
                text: { body: text }
            }
        });
        
        return { success: true, messageId: response.data.messages[0].id };
    } catch (error) {
        return { 
            success: false, 
            error: error.response?.data?.error?.message || error.message 
        };
    }
}

// Function to send interactive button message
async function sendInteractiveMessage(to, body, buttons) {
    try {
        const response = await axios({
            method: 'POST',
            url: WHATSAPP_API_URL,
            headers: {
                'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            data: {
                messaging_product: 'whatsapp',
                to: to.replace('+', ''),
                type: 'interactive',
                interactive: {
                    type: 'button',
                    body: { text: body },
                    action: {
                        buttons: buttons.map(btn => ({
                            type: 'reply',
                            reply: {
                                id: btn.id,
                                title: btn.title
                            }
                        }))
                    }
                }
            }
        });
        
        return { success: true, messageId: response.data.messages[0].id };
    } catch (error) {
        return { 
            success: false, 
            error: error.response?.data?.error?.message || error.message 
        };
    }
}

// Main function
async function main() {
    console.log('🚀 WhatsApp Message Test Script');
    console.log('================================\n');
    
    // Check configuration
    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
        console.error('❌ Error: Missing WhatsApp configuration in .env file');
        console.error('Required variables:');
        console.error('  - WHATSAPP_ACCESS_TOKEN');
        console.error('  - WHATSAPP_PHONE_NUMBER_ID');
        process.exit(1);
    }
    
    console.log(`📱 Sending messages to: ${phoneNumber}`);
    console.log(`🔑 Using Phone Number ID: ${WHATSAPP_PHONE_NUMBER_ID}`);
    console.log('\n---\n');
    
    // Send test messages with delay
    for (const message of testMessages) {
        console.log(`📤 Sending: ${message.name}`);
        
        let result;
        if (message.type === 'interactive') {
            result = await sendInteractiveMessage(phoneNumber, message.body, message.buttons);
        } else {
            result = await sendTextMessage(phoneNumber, message.text);
        }
        
        if (result.success) {
            console.log(`✅ Success! Message ID: ${result.messageId}`);
        } else {
            console.error(`❌ Failed: ${result.error}`);
        }
        
        console.log('');
        
        // Wait 2 seconds between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n---\n');
    console.log('✨ Test completed!');
    console.log('\n💡 Tips:');
    console.log('1. Check your WhatsApp for the messages');
    console.log('2. Try replying to test the webhook');
    console.log('3. Use ngrok URL in Meta webhook configuration');
    console.log('4. Monitor server logs for incoming messages');
}

// Quick test function (sends single message)
async function quickTest() {
    console.log('⚡ Quick WhatsApp Test\n');
    
    const testMessage = "👋 Quick test from Teachers Training Bot!\n\nTimestamp: " + new Date().toISOString();
    
    console.log(`📱 Sending to: ${phoneNumber}`);
    console.log(`📝 Message: ${testMessage}\n`);
    
    const result = await sendTextMessage(phoneNumber, testMessage);
    
    if (result.success) {
        console.log(`✅ Message sent successfully!`);
        console.log(`📧 Message ID: ${result.messageId}`);
    } else {
        console.error(`❌ Failed to send message`);
        console.error(`Error: ${result.error}`);
    }
}

// Command line handling
const command = process.argv[3];

if (command === '--quick' || command === '-q') {
    quickTest();
} else if (command === '--help' || command === '-h') {
    console.log('WhatsApp Message Test Script\n');
    console.log('Usage:');
    console.log('  node test-whatsapp.js [phone_number] [options]\n');
    console.log('Options:');
    console.log('  --quick, -q     Send a single quick test message');
    console.log('  --help, -h      Show this help message\n');
    console.log('Examples:');
    console.log('  node test-whatsapp.js +1234567890          # Send all test messages');
    console.log('  node test-whatsapp.js +1234567890 --quick  # Send quick test');
    console.log('  node test-whatsapp.js                      # Use default number from script');
} else {
    main().catch(console.error);
}