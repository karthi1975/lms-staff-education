/**
 * Message Handlers Index
 *
 * SOLID Principles:
 * - OCP: Adding new handlers doesn't require modifying this file
 * - SRP: This file only exports handlers
 *
 * Central export point for all message handlers.
 */

module.exports = {
  BaseMessageHandler: require('./BaseMessageHandler'),
  TextMessageHandler: require('./TextMessageHandler'),
  InteractiveListHandler: require('./InteractiveListHandler'),
  ButtonHandler: require('./ButtonHandler'),
  DocumentHandler: require('./DocumentHandler'),
  TypingIndicatorHandler: require('./TypingIndicatorHandler'),
  ReadReceiptHandler: require('./ReadReceiptHandler')
};
