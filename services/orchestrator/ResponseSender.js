/**
 * ResponseSender
 *
 * SOLID Principle: Single Responsibility Principle (SRP)
 * Responsibility: Send responses via WhatsApp ONLY
 *
 * Handles formatting and sending different response types.
 */
class ResponseSender {
  constructor(whatsappService, logger) {
    this.whatsappService = whatsappService;
    this.logger = logger;
  }

  /**
   * Send response to user
   * @param {string} to - Recipient phone number
   * @param {Object} response - Response object
   * @returns {Promise<void>}
   */
  async send(to, response) {
    switch (response.type) {
      case 'text':
        await this.sendText(to, response);
        break;

      case 'menu':
        await this.sendMenu(to, response);
        break;

      case 'quiz':
        await this.sendQuiz(to, response);
        break;

      default:
        await this.whatsappService.sendMessage(to, response.content);
    }
  }

  /**
   * Send text response
   * @param {string} to - Recipient phone number
   * @param {Object} response - Response object
   */
  async sendText(to, response) {
    await this.whatsappService.sendMessage(to, response.content);

    if (response.suggestions) {
      // Send suggestions as text
      const suggestionsText = '\n\nOptions:\n' + response.suggestions.join('\n');
      await this.whatsappService.sendMessage(to, suggestionsText);
    }
  }

  /**
   * Send menu response
   * @param {string} to - Recipient phone number
   * @param {Object} response - Response object
   */
  async sendMenu(to, response) {
    // Convert menu to text format
    let menuText = `${response.headerText}\n\n${response.bodyText}\n\n`;

    response.sections.forEach(section => {
      menuText += `${section.title}\n`;
      section.rows.forEach(row => {
        menuText += `${row.title}\n`;
      });
    });

    menuText += '\n\nType the module number (1-5) to select';
    await this.whatsappService.sendMessage(to, menuText);
  }

  /**
   * Send quiz response
   * @param {string} to - Recipient phone number
   * @param {Object} response - Response object
   */
  async sendQuiz(to, response) {
    // Send quiz as text with options
    let quizText = response.content + '\n\nOptions:\n';

    response.options.forEach((opt, idx) => {
      quizText += `${String.fromCharCode(65 + idx)}. ${opt.title}\n`;
    });

    await this.whatsappService.sendMessage(to, quizText);
  }
}

module.exports = ResponseSender;
