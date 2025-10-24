const BaseCommandHandler = require('./BaseCommandHandler');

/**
 * ProgressCommandHandler
 *
 * SOLID Principles:
 * - SRP: Handles progress reports ONLY
 * - OCP: Extends BaseCommandHandler without modification
 * - LSP: Can be substituted for BaseCommandHandler
 */
class ProgressCommandHandler extends BaseCommandHandler {
  canHandle(input, session) {
    const lowerInput = input.toLowerCase().trim();
    return lowerInput === 'progress';
  }

  async handle(userId, input, userProgress, session) {
    if (!userProgress || !userProgress.modules) {
      return {
        type: 'text',
        content: '📊 No progress recorded yet. Start with Module 1!'
      };
    }

    const completedModules = userProgress.modules.filter(
      m => m.progress?.status === 'completed'
    ).length;
    const totalModules = this.config.modules.length;
    const overallProgress = (completedModules / totalModules) * 100;

    let progressText = `📊 **Your Learning Progress**\n\n`;
    progressText += `Overall: ${overallProgress.toFixed(0)}% Complete\n`;
    progressText += `Modules: ${completedModules}/${totalModules} Completed\n\n`;

    for (const module of this.config.modules) {
      const moduleProgress = userProgress.modules.find(m => m.id === module.id);
      const status = moduleProgress?.progress?.status || 'locked';
      const score = moduleProgress?.progress?.quiz_score;

      progressText += `${module.order}. ${module.name}\n`;
      progressText += `   Status: ${status}`;
      if (score) progressText += ` | Quiz: ${score.toFixed(0)}%`;
      progressText += '\n';
    }

    return {
      type: 'text',
      content: progressText
    };
  }
}

module.exports = ProgressCommandHandler;
