#!/usr/bin/env node

/**
 * WhatsApp Chatbot Test Suite
 * Complete testing solution for Teachers Training WhatsApp Bot
 * 
 * Features:
 * - Send test messages
 * - Simulate user conversations
 * - Test interactive buttons/lists
 * - Verify webhook responses
 * - Test document Q&A flow
 */

require('dotenv').config();
const axios = require('axios');
const readline = require('readline');
const chalk = require('chalk');

// Configuration
const config = {
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_API_VERSION: 'v18.0',
    LOCAL_SERVER: 'http://localhost:3000',
    TEST_RECIPIENT: process.argv[2] || '+1234567890' // Your phone number
};

const API_URL = `https://graph.facebook.com/${config.WHATSAPP_API_VERSION}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`;

// Console colors
const log = {
    info: (msg) => console.log(chalk.blue('ℹ'), msg),
    success: (msg) => console.log(chalk.green('✅'), msg),
    error: (msg) => console.log(chalk.red('❌'), msg),
    warning: (msg) => console.log(chalk.yellow('⚠️'), msg),
    chat: (msg) => console.log(chalk.cyan('💬'), msg)
};

// Test scenarios
const testScenarios = {
    welcome: {
        name: "Welcome Flow",
        messages: [
            { text: "Hi" },
            { text: "help" },
            { text: "menu" }
        ]
    },
    learning: {
        name: "Learning Module Flow",
        messages: [
            { text: "1" }, // Select module 1
            { text: "start" },
            { text: "What is covered in this module?" },
            { text: "next" },
            { text: "quiz" }
        ]
    },
    questions: {
        name: "Q&A about Uploaded Documents",
        messages: [
            { text: "What teaching strategies are covered?" },
            { text: "How do I manage classroom behavior?" },
            { text: "Explain lesson planning best practices" },
            { text: "What assessment methods should I use?" }
        ]
    },
    quiz: {
        name: "Quiz Interaction",
        messages: [
            { text: "quiz module 1" },
            { text: "A" }, // Answer first question
            { text: "B" }, // Answer second question
            { text: "C" }, // Answer third question
            { text: "score" }
        ]
    },
    navigation: {
        name: "Navigation Commands",
        messages: [
            { text: "progress" },
            { text: "modules" },
            { text: "help" },
            { text: "about" },
            { text: "contact" }
        ]
    }
};

// Message sender class
class WhatsAppSender {
    constructor() {
        this.messagesSent = 0;
        this.messagesReceived = 0;
    }

    async sendTextMessage(to, text) {
        try {
            const response = await axios({
                method: 'POST',
                url: API_URL,
                headers: {
                    'Authorization': `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    messaging_product: 'whatsapp',
                    to: to.replace('+', ''),
                    type: 'text',
                    text: { body: text }
                }
            });
            
            this.messagesSent++;
            return { 
                success: true, 
                messageId: response.data.messages[0].id,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data?.error?.message || error.message 
            };
        }
    }

    async sendInteractiveButtons(to, body, buttons) {
        try {
            const response = await axios({
                method: 'POST',
                url: API_URL,
                headers: {
                    'Authorization': `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
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
            
            this.messagesSent++;
            return { 
                success: true, 
                messageId: response.data.messages[0].id 
            };
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data?.error?.message || error.message 
            };
        }
    }

    async sendList(to, header, body, buttonText, sections) {
        try {
            const response = await axios({
                method: 'POST',
                url: API_URL,
                headers: {
                    'Authorization': `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    messaging_product: 'whatsapp',
                    to: to.replace('+', ''),
                    type: 'interactive',
                    interactive: {
                        type: 'list',
                        header: { type: 'text', text: header },
                        body: { text: body },
                        action: {
                            button: buttonText,
                            sections: sections
                        }
                    }
                }
            });
            
            this.messagesSent++;
            return { 
                success: true, 
                messageId: response.data.messages[0].id 
            };
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data?.error?.message || error.message 
            };
        }
    }

    async sendTemplate(to, templateName, languageCode = 'en_US', components = []) {
        try {
            const response = await axios({
                method: 'POST',
                url: API_URL,
                headers: {
                    'Authorization': `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    messaging_product: 'whatsapp',
                    to: to.replace('+', ''),
                    type: 'template',
                    template: {
                        name: templateName,
                        language: { code: languageCode },
                        components: components
                    }
                }
            });
            
            this.messagesSent++;
            return { 
                success: true, 
                messageId: response.data.messages[0].id 
            };
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data?.error?.message || error.message 
            };
        }
    }

    printStats() {
        console.log('\n📊 Statistics:');
        console.log(`   Messages sent: ${this.messagesSent}`);
        console.log(`   Success rate: ${this.messagesSent > 0 ? '100%' : '0%'}`);
    }
}

// Test runner
class TestRunner {
    constructor(sender) {
        this.sender = sender;
        this.results = [];
    }

    async runScenario(scenario) {
        console.log(`\n${'='.repeat(50)}`);
        log.info(`Running: ${scenario.name}`);
        console.log('='.repeat(50));
        
        for (const message of scenario.messages) {
            await this.delay(2000); // Wait between messages
            
            if (message.text) {
                log.chat(`User: "${message.text}"`);
                const result = await this.sender.sendTextMessage(config.TEST_RECIPIENT, message.text);
                
                if (result.success) {
                    log.success(`Sent (ID: ${result.messageId.substring(0, 10)}...)`);
                    this.results.push({ scenario: scenario.name, message: message.text, success: true });
                } else {
                    log.error(`Failed: ${result.error}`);
                    this.results.push({ scenario: scenario.name, message: message.text, success: false, error: result.error });
                }
            }
        }
    }

    async runInteractiveTests() {
        console.log(`\n${'='.repeat(50)}`);
        log.info('Testing Interactive Elements');
        console.log('='.repeat(50));
        
        // Test buttons
        await this.delay(2000);
        log.chat('Sending button message...');
        const buttonResult = await this.sender.sendInteractiveButtons(
            config.TEST_RECIPIENT,
            'What would you like to learn today?',
            [
                { id: 'module_1', title: 'Start Module' },
                { id: 'quiz', title: 'Take Quiz' },
                { id: 'progress', title: 'View Progress' }
            ]
        );
        
        if (buttonResult.success) {
            log.success('Interactive buttons sent');
        } else {
            log.error(`Failed: ${buttonResult.error}`);
        }
        
        // Test list
        await this.delay(2000);
        log.chat('Sending list message...');
        const listResult = await this.sender.sendList(
            config.TEST_RECIPIENT,
            '📚 Training Modules',
            'Select a module to begin your learning journey',
            'View Modules',
            [
                {
                    title: 'Foundation Modules',
                    rows: [
                        { id: 'mod_1', title: 'Introduction', description: 'Basics of teaching' },
                        { id: 'mod_2', title: 'Classroom Mgmt', description: 'Managing your classroom' }
                    ]
                },
                {
                    title: 'Advanced Modules',
                    rows: [
                        { id: 'mod_3', title: 'Lesson Planning', description: 'Create effective lessons' },
                        { id: 'mod_4', title: 'Assessment', description: 'Student evaluation methods' }
                    ]
                }
            ]
        );
        
        if (listResult.success) {
            log.success('Interactive list sent');
        } else {
            log.error(`Failed: ${listResult.error}`);
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    printResults() {
        console.log(`\n${'='.repeat(50)}`);
        console.log('📝 Test Results Summary');
        console.log('='.repeat(50));
        
        const successCount = this.results.filter(r => r.success).length;
        const failureCount = this.results.filter(r => !r.success).length;
        
        console.log(`✅ Successful: ${successCount}`);
        console.log(`❌ Failed: ${failureCount}`);
        
        if (failureCount > 0) {
            console.log('\n❌ Failed tests:');
            this.results.filter(r => !r.success).forEach(r => {
                console.log(`   - ${r.scenario}: "${r.message}" - ${r.error}`);
            });
        }
        
        const successRate = (successCount / (successCount + failureCount) * 100).toFixed(1);
        console.log(`\n📊 Success Rate: ${successRate}%`);
    }
}

// Interactive CLI mode
async function interactiveMode() {
    const sender = new WhatsAppSender();
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'WhatsApp> '
    });
    
    console.log('\n🤖 WhatsApp Interactive Test Mode');
    console.log('Type messages to send, or commands:');
    console.log('  /buttons - Send button test');
    console.log('  /list    - Send list test');
    console.log('  /stats   - Show statistics');
    console.log('  /quit    - Exit');
    console.log('');
    
    rl.prompt();
    
    rl.on('line', async (line) => {
        const input = line.trim();
        
        if (input === '/quit') {
            sender.printStats();
            rl.close();
            return;
        }
        
        if (input === '/stats') {
            sender.printStats();
        } else if (input === '/buttons') {
            const result = await sender.sendInteractiveButtons(
                config.TEST_RECIPIENT,
                'Test buttons',
                [
                    { id: 'btn1', title: 'Option 1' },
                    { id: 'btn2', title: 'Option 2' },
                    { id: 'btn3', title: 'Option 3' }
                ]
            );
            console.log(result.success ? '✅ Buttons sent' : `❌ Failed: ${result.error}`);
        } else if (input === '/list') {
            const result = await sender.sendList(
                config.TEST_RECIPIENT,
                'Test List',
                'Select an option',
                'Options',
                [{
                    title: 'Section',
                    rows: [
                        { id: 'opt1', title: 'Option 1', description: 'First option' },
                        { id: 'opt2', title: 'Option 2', description: 'Second option' }
                    ]
                }]
            );
            console.log(result.success ? '✅ List sent' : `❌ Failed: ${result.error}`);
        } else if (input) {
            const result = await sender.sendTextMessage(config.TEST_RECIPIENT, input);
            console.log(result.success ? `✅ Sent (ID: ${result.messageId.substring(0, 10)}...)` : `❌ Failed: ${result.error}`);
        }
        
        rl.prompt();
    });
}

// Main execution
async function main() {
    console.log(chalk.bold.blue('\n🎓 Teachers Training WhatsApp Bot Test Suite'));
    console.log('='.repeat(50));
    
    // Check configuration
    if (!config.WHATSAPP_ACCESS_TOKEN || !config.WHATSAPP_PHONE_NUMBER_ID) {
        log.error('Missing WhatsApp configuration in .env file');
        console.log('\nRequired environment variables:');
        console.log('  - WHATSAPP_ACCESS_TOKEN');
        console.log('  - WHATSAPP_PHONE_NUMBER_ID');
        process.exit(1);
    }
    
    log.info(`Phone Number ID: ${config.WHATSAPP_PHONE_NUMBER_ID}`);
    log.info(`Recipient: ${config.TEST_RECIPIENT}`);
    
    const sender = new WhatsAppSender();
    const runner = new TestRunner(sender);
    
    // Run test scenarios
    const scenarioName = process.argv[3];
    
    if (scenarioName === '--interactive' || scenarioName === '-i') {
        await interactiveMode();
    } else if (scenarioName && testScenarios[scenarioName]) {
        await runner.runScenario(testScenarios[scenarioName]);
        sender.printStats();
    } else if (scenarioName === '--all') {
        for (const scenario of Object.values(testScenarios)) {
            await runner.runScenario(scenario);
        }
        await runner.runInteractiveTests();
        runner.printResults();
        sender.printStats();
    } else {
        // Quick test
        log.info('Sending quick test message...');
        const result = await sender.sendTextMessage(
            config.TEST_RECIPIENT,
            `🎓 Test from Teachers Training Bot\n\nTime: ${new Date().toLocaleString()}\n\nReply 'help' for options!`
        );
        
        if (result.success) {
            log.success(`Message sent! ID: ${result.messageId}`);
            
            // Send follow-up with buttons
            await runner.delay(2000);
            log.info('Sending interactive follow-up...');
            const buttonResult = await sender.sendInteractiveButtons(
                config.TEST_RECIPIENT,
                'What would you like to test?',
                [
                    { id: 'modules', title: 'View Modules' },
                    { id: 'quiz', title: 'Take Quiz' },
                    { id: 'help', title: 'Get Help' }
                ]
            );
            
            if (buttonResult.success) {
                log.success('Interactive message sent!');
            }
        } else {
            log.error(`Failed: ${result.error}`);
        }
    }
    
    console.log('\n💡 Tips:');
    console.log('1. Check WhatsApp for messages');
    console.log('2. Reply to test webhook responses');
    console.log('3. Monitor server logs: tail -f logs/combined.log');
    console.log('\n📚 Available test scenarios:');
    Object.keys(testScenarios).forEach(key => {
        console.log(`   node test-whatsapp-chatbot.js ${config.TEST_RECIPIENT} ${key}`);
    });
    console.log(`   node test-whatsapp-chatbot.js ${config.TEST_RECIPIENT} --all`);
    console.log(`   node test-whatsapp-chatbot.js ${config.TEST_RECIPIENT} --interactive`);
}

// Execute
main().catch(error => {
    log.error('Fatal error:');
    console.error(error);
    process.exit(1);
});