/**
 * GIFT Format Parser
 * Parses Moodle GIFT format quiz files
 */

const fs = require('fs').promises;
const logger = require('../utils/logger');

class GiftParserService {
  /**
   * Parse GIFT file and extract questions
   */
  async parseGiftFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parseGiftContent(content);
    } catch (error) {
      logger.error(`Failed to parse GIFT file: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Parse GIFT content string
   */
  parseGiftContent(content) {
    const questions = [];
    let currentCategory = 'General';

    // Split by question delimiter (::)
    const lines = content.split('\n');
    let currentQuestion = null;
    let inAnswerBlock = false;
    let answerBuffer = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines
      if (!line) continue;

      // Category definition
      if (line.startsWith('$CATEGORY:')) {
        currentCategory = line.replace('$CATEGORY:', '').trim();
        continue;
      }

      // Question start (::QuestionName Question text?::)
      if (line.startsWith('::') && line.includes('::')) {
        // Save previous question if exists
        if (currentQuestion) {
          questions.push(currentQuestion);
        }

        // Parse question name and text
        const parts = line.split('::').filter(p => p.trim());
        const questionName = parts[0].trim();
        const questionText = parts.slice(1).join('::').trim();

        currentQuestion = {
          id: questionName,
          question: this.unescapeGift(questionText),
          category: currentCategory,
          type: 'unknown',
          options: [],
          correctAnswer: null,
          points: {}
        };
        continue;
      }

      // Answer block start
      if (line.startsWith('{')) {
        inAnswerBlock = true;
        answerBuffer = line;

        // Check if single-line answer block
        if (line.endsWith('}')) {
          this.parseAnswerBlock(answerBuffer, currentQuestion);
          inAnswerBlock = false;
          answerBuffer = '';
        }
        continue;
      }

      // Answer block end
      if (inAnswerBlock && line.endsWith('}')) {
        answerBuffer += '\n' + line;
        this.parseAnswerBlock(answerBuffer, currentQuestion);
        inAnswerBlock = false;
        answerBuffer = '';
        continue;
      }

      // Answer block content
      if (inAnswerBlock) {
        answerBuffer += '\n' + line;
      }
    }

    // Add last question
    if (currentQuestion) {
      questions.push(currentQuestion);
    }

    logger.info(`Parsed ${questions.length} questions from GIFT content`);
    return questions;
  }

  /**
   * Parse answer block and determine question type
   */
  parseAnswerBlock(block, question) {
    // Remove { and }
    const content = block.replace(/^\{/, '').replace(/\}$/, '').trim();

    // True/False question
    if (content === 'T' || content === 'TRUE') {
      question.type = 'truefalse';
      question.correctAnswer = 'True';
      question.options = ['True', 'False'];
      return;
    }
    if (content === 'F' || content === 'FALSE') {
      question.type = 'truefalse';
      question.correctAnswer = 'False';
      question.options = ['True', 'False'];
      return;
    }

    // Multiple choice or matching
    const lines = content.split('\n').filter(l => l.trim());

    // Check for matching question (= ... -> ...)
    if (lines.some(l => l.includes('->'))) {
      question.type = 'matching';
      question.pairs = [];
      lines.forEach(line => {
        if (line.includes('->')) {
          const [left, right] = line.split('->').map(s => s.replace(/^=/, '').trim());
          question.pairs.push({ left, right });
        }
      });
      return;
    }

    // Multiple choice
    const options = [];
    let correctAnswers = [];
    let hasPercentages = false;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Correct answer (=)
      if (trimmed.startsWith('=')) {
        const optionText = trimmed.substring(1).trim();
        options.push(optionText);
        correctAnswers.push(options.length - 1);
      }
      // Wrong answer (~)
      else if (trimmed.startsWith('~')) {
        // Check for percentage (~%20%)
        const percentMatch = trimmed.match(/^~%([0-9.]+)%/);
        if (percentMatch) {
          hasPercentages = true;
          const percentage = parseFloat(percentMatch[1]);
          const optionText = trimmed.replace(/^~%[0-9.]+%/, '').trim();
          options.push(optionText);

          if (percentage > 0) {
            correctAnswers.push(options.length - 1);
            question.points[options.length - 1] = percentage;
          }
        } else {
          const optionText = trimmed.substring(1).trim();
          options.push(optionText);
        }
      }
    });

    question.options = options;

    // Determine if multiple answer or single answer
    if (hasPercentages || correctAnswers.length > 1) {
      question.type = 'multiresponse';
      question.correctAnswers = correctAnswers;
    } else {
      question.type = 'multichoice';
      question.correctAnswer = correctAnswers[0];
    }
  }

  /**
   * Unescape GIFT special characters
   */
  unescapeGift(text) {
    return text
      .replace(/\\:/g, ':')
      .replace(/\\=/g, '=')
      .replace(/\\~/g, '~')
      .replace(/\\#/g, '#')
      .replace(/\\{/g, '{')
      .replace(/\\}/g, '}')
      .replace(/\\\\/g, '\\');
  }

  /**
   * Format question for WhatsApp display
   */
  formatForWhatsApp(question, questionNumber, totalQuestions) {
    let message = `*Question ${questionNumber}/${totalQuestions}*\n\n`;
    message += `${question.question}\n\n`;

    if (question.type === 'truefalse') {
      message += `A) True\n`;
      message += `B) False\n\n`;
      message += `_Reply with A or B_`;
    } else if (question.type === 'matching') {
      message += `*Match the following:*\n\n`;
      question.pairs.forEach((pair, idx) => {
        message += `${idx + 1}. ${pair.left} → ${pair.right}\n`;
      });
      message += `\n_This is a reference - no answer needed for matching questions in WhatsApp_`;
    } else {
      // Multiple choice
      question.options.forEach((option, idx) => {
        const letter = String.fromCharCode(65 + idx); // A, B, C, D
        message += `${letter}) ${option}\n`;
      });
      message += `\n_Reply with ${question.options.map((_, i) => String.fromCharCode(65 + i)).join(', ')}_`;
    }

    return message;
  }

  /**
   * Check if answer is correct
   */
  checkAnswer(question, userAnswer) {
    const answerUpper = userAnswer.trim().toUpperCase();

    if (question.type === 'truefalse') {
      // Convert A/B to True/False
      const userChoice = answerUpper === 'A' ? 'True' : answerUpper === 'B' ? 'False' : null;
      return userChoice === question.correctAnswer;
    }

    if (question.type === 'multichoice') {
      // Convert letter to index
      const answerIndex = answerUpper.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
      return answerIndex === question.correctAnswer;
    }

    if (question.type === 'multiresponse') {
      // For multi-response, check if answer is in correct answers
      const answerIndex = answerUpper.charCodeAt(0) - 65;
      return question.correctAnswers.includes(answerIndex);
    }

    return false;
  }

  /**
   * Get correct answer text
   */
  getCorrectAnswerText(question) {
    if (question.type === 'truefalse') {
      return question.correctAnswer;
    }

    if (question.type === 'multichoice') {
      const letter = String.fromCharCode(65 + question.correctAnswer);
      return `${letter}) ${question.options[question.correctAnswer]}`;
    }

    if (question.type === 'multiresponse') {
      return question.correctAnswers
        .map(idx => `${String.fromCharCode(65 + idx)}) ${question.options[idx]}`)
        .join(', ');
    }

    return 'N/A';
  }

  /**
   * Get questions by category
   */
  getQuestionsByCategory(questions, category) {
    return questions.filter(q => q.category === category);
  }

  /**
   * Get all categories
   */
  getCategories(questions) {
    return [...new Set(questions.map(q => q.category))];
  }
}

module.exports = new GiftParserService();
