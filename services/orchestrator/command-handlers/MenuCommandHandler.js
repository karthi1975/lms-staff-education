const BaseCommandHandler = require('./BaseCommandHandler');

/**
 * MenuCommandHandler
 *
 * SOLID Principles:
 * - SRP: Handles menu/help commands ONLY
 * - OCP: Extends BaseCommandHandler without modification
 * - LSP: Can be substituted for BaseCommandHandler
 */
class MenuCommandHandler extends BaseCommandHandler {
  canHandle(input, session) {
    const lowerInput = input.toLowerCase().trim();
    return lowerInput === 'menu' || lowerInput === 'help';
  }

  async handle(userId, input, userProgress, session) {
    const modules = userProgress?.modules || [];

    let menuText = `📚 *Teachers Training Menu*\n\n`;
    menuText += `*Available Modules:*\n\n`;

    this.config.modules.forEach(m => {
      const progress = modules.find(p => p.id === m.id);
      const status = progress?.progress?.status || 'locked';
      const icon = this.getStatusIcon(status);
      const percentage = progress?.progress?.completion_percentage || 0;

      menuText += `${icon} *Module ${m.order}*: ${m.name}\n`;
      menuText += `   Status: ${status}`;
      if (percentage > 0) menuText += ` (${percentage}%)`;
      menuText += `\n\n`;
    });

    menuText += `\n*Commands:*\n`;
    menuText += `• Type "module 1" to start a module\n`;
    menuText += `• Type "quiz 1" to take a quiz\n`;
    menuText += `• Type "progress" to see details\n`;
    menuText += `• Ask me any teaching questions!\n`;

    return {
      type: 'text',
      content: menuText
    };
  }

  getStatusIcon(status) {
    switch (status) {
      case 'completed': return '✅';
      case 'in_progress': return '📖';
      case 'unlocked': return '🔓';
      default: return '🔒';
    }
  }
}

module.exports = MenuCommandHandler;
