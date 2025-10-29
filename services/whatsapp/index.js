/**
 * WhatsApp Service Module - SOLID Compliant
 *
 * This module provides a refactored WhatsApp service following SOLID principles:
 * - S: Single Responsibility - Each class has one job
 * - O: Open/Closed - Easy to extend with new message types
 * - L: Liskov Substitution - All handlers implement same interface
 * - I: Interface Segregation - Clean, focused interfaces
 * - D: Dependency Inversion - Depends on abstractions
 *
 * Usage (Backward Compatible):
 *   const whatsappService = require('./services/whatsapp');
 *   await whatsappService.sendMessage(phone, text);
 *
 * Advanced Usage:
 *   const { WhatsAppServiceFactory } = require('./services/whatsapp');
 *   const customService = WhatsAppServiceFactory.create({
 *     accessToken: 'custom_token',
 *     maxMessageLength: 3000
 *   });
 */

const WhatsAppServiceFactory = require('./WhatsAppServiceFactory');

// Create default service instance for backward compatibility
const defaultService = WhatsAppServiceFactory.create();

// Export default service (backward compatible)
module.exports = defaultService;

// Export factory and components for advanced usage
module.exports.WhatsAppServiceFactory = WhatsAppServiceFactory;
module.exports.WhatsAppConfig = require('./WhatsAppConfig');
module.exports.WebhookVerifier = require('./WebhookVerifier');
module.exports.MessageExtractor = require('./MessageExtractor');
module.exports.MessageChunker = require('./MessageChunker');
module.exports.MessageSender = require('./MessageSender');
module.exports.HttpClient = require('./HttpClient');
module.exports.MessageHandlers = require('./message-handlers');

// Export convenience methods
module.exports.createTestService = () => WhatsAppServiceFactory.createTestService();
module.exports.createCustomService = (options) => WhatsAppServiceFactory.create(options);
