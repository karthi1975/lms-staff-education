/**
 * Command Handlers Index
 *
 * SOLID Principles:
 * - OCP: Adding new handlers doesn't require modifying this file
 * - SRP: This file only exports handlers
 *
 * Central export point for all command handlers.
 */

module.exports = {
  BaseCommandHandler: require('./BaseCommandHandler'),
  GreetingCommandHandler: require('./GreetingCommandHandler'),
  MenuCommandHandler: require('./MenuCommandHandler'),
  ProgressCommandHandler: require('./ProgressCommandHandler'),
  ModuleCommandHandler: require('./ModuleCommandHandler'),
  QuizCommandHandler: require('./QuizCommandHandler'),
  ContentQueryHandler: require('./ContentQueryHandler')
};
