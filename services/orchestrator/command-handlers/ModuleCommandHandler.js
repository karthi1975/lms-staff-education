const BaseCommandHandler = require('./BaseCommandHandler');

/**
 * ModuleCommandHandler
 *
 * SOLID Principles:
 * - SRP: Handles module selection ONLY
 * - OCP: Extends BaseCommandHandler without modification
 * - LSP: Can be substituted for BaseCommandHandler
 */
class ModuleCommandHandler extends BaseCommandHandler {
  canHandle(input, session) {
    const lowerInput = input.toLowerCase().trim();
    return lowerInput.startsWith('module');
  }

  async handle(userId, input, userProgress, session) {
    const lowerInput = input.toLowerCase().trim();
    const moduleMatch = lowerInput.match(/module\s*(\d)/);

    if (!moduleMatch) {
      return {
        type: 'text',
        content: 'Please specify a module number (e.g., "module 1", "module 2")'
      };
    }

    const moduleId = `module_${moduleMatch[1]}`;

    // Check module access
    const canAccess = await this.moduleManager.canUserAccessModule(userId, moduleId);

    if (!canAccess) {
      return {
        type: 'text',
        content: '🔒 Complete previous modules first to unlock this one!'
      };
    }

    // Get module details
    const module = this.config.getModuleById(moduleId);
    if (!module) {
      return {
        type: 'text',
        content: 'Invalid module number. Try "module 1" through "module 5".'
      };
    }

    // Get module content
    const moduleContent = await this.chromaService.getDocumentsByModule(moduleId, 1);

    // Update progress to in_progress
    await this.moduleManager.updateProgress(userId, moduleId, {
      status: 'in_progress',
      completion_percentage: 10,
      time_spent: 0
    });

    const content = moduleContent[0]?.content ||
      `Welcome to ${module.name}!\n\nAsk questions about the topic or type "quiz" when ready to test your knowledge.`;

    return {
      type: 'text',
      content: `📖 **${module.name}**\n\n${content}\n\nOptions:\n• Ask questions\n• Type "quiz ${module.order}" to take assessment\n• Type "menu" for main menu`
    };
  }
}

module.exports = ModuleCommandHandler;
