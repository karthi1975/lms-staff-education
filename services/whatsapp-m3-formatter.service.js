/**
 * WhatsApp M3 Formatter Service
 * Material Design 3 inspired formatting for WhatsApp messages
 *
 * Uses Unicode symbols, emojis, and WhatsApp's native formatting
 * to create clean, hierarchical, visually appealing messages
 */

const logger = require('../utils/logger');

class WhatsAppM3FormatterService {
  constructor() {
    // M3-inspired symbols using Unicode
    this.symbols = {
      // Box drawing characters
      topLeft: '┌',
      topRight: '┐',
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '─',
      vertical: '│',
      divider: '━',

      // Bullets and indicators
      bullet: '•',
      arrow: '→',
      check: '✓',
      cross: '✗',
      star: '★',
      circle: '○',
      filledCircle: '●',

      // Interactive elements
      radio: '◉',
      radioEmpty: '○',
      checkbox: '☑',
      checkboxEmpty: '☐',

      // Status indicators
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',

      // Emojis for context
      course: '📚',
      module: '📖',
      quiz: '📝',
      chat: '💬',
      progress: '📊',
      trophy: '🏆',
      rocket: '🚀',
      lightbulb: '💡',
      fire: '🔥',
      sparkles: '✨'
    };
  }

  /**
   * Create M3-style card with header, content, and optional footer
   */
  createCard({ title, subtitle, content, footer, icon = null }) {
    const lines = [];
    const width = 28; // WhatsApp friendly width

    // Top border
    lines.push(this.symbols.divider.repeat(width));

    // Header with icon
    if (title) {
      const headerIcon = icon || this.symbols.sparkles;
      lines.push(`${headerIcon} *${title}*`);
      if (subtitle) {
        lines.push(`   _${subtitle}_`);
      }
      lines.push('');
    }

    // Content
    if (content) {
      if (Array.isArray(content)) {
        content.forEach(line => lines.push(line));
      } else {
        lines.push(content);
      }
    }

    // Footer
    if (footer) {
      lines.push('');
      lines.push(this.symbols.divider.repeat(width));
      lines.push(footer);
    }

    // Bottom border
    lines.push(this.symbols.divider.repeat(width));

    return lines.join('\n');
  }

  /**
   * Format course selection with M3 styling
   */
  formatCourseSelection(courses) {
    const lines = [];

    // Header card - centered
    lines.push(this.symbols.divider.repeat(32));
    lines.push(`${this.symbols.rocket} *Teachers Training Platform*`);
    lines.push(`   _Your Learning Journey Starts Here_`);
    lines.push(this.symbols.divider.repeat(32));
    lines.push('');

    // Title
    lines.push(`${this.symbols.course} *Available Courses*`);
    lines.push('');

    // Course list with improved M3 cards
    courses.forEach((course, idx) => {
      const number = `${idx + 1}`;
      const emoji = this.getCourseEmoji(course.name);

      // Clean card design without borders
      lines.push(`${emoji} *${number}. ${course.name}*`);

      // Description (truncate if too long)
      if (course.description) {
        const desc = course.description.length > 45
          ? course.description.substring(0, 42) + '...'
          : course.description;
        lines.push(`   _${desc}_`);
      }

      // Module count with bullet
      const moduleCount = course.modules ? course.modules.length : 0;
      lines.push(`   ${this.symbols.bullet} ${moduleCount} modules`);

      // Separator line between courses
      lines.push(`   ${this.symbols.horizontal.repeat(28)}`);
      lines.push('');
    });

    // Footer with instructions
    lines.push(this.symbols.divider.repeat(32));
    lines.push(`${this.symbols.arrow} *How to Select:*`);
    lines.push(`   Reply with the *number* (1-${courses.length})`);
    lines.push(this.symbols.divider.repeat(32));

    return lines.join('\n');
  }

  /**
   * Format module selection with M3 styling
   */
  formatModuleSelection(course) {
    const lines = [];

    // Course header
    lines.push(this.symbols.divider.repeat(32));
    lines.push(`${this.symbols.course} *${course.name}*`);
    lines.push(this.symbols.divider.repeat(32));
    lines.push('');

    // Modules title
    lines.push(`${this.symbols.module} *Course Modules*`);
    lines.push('');

    // Module cards - clean design without boxes
    course.modules.forEach((module, idx) => {
      const number = `${idx + 1}`;
      const emoji = this.getModuleEmoji(idx);

      // Module title
      lines.push(`${emoji} *${number}. ${module.name}*`);

      // Description - properly formatted
      if (module.description) {
        const desc = module.description.length > 50
          ? module.description.substring(0, 47) + '...'
          : module.description;
        lines.push(`   ${desc}`);
      }

      // Quiz indicator
      if (module.has_quiz) {
        lines.push(`   ${this.symbols.quiz} Quiz available`);
      }

      // Separator line
      lines.push(`   ${this.symbols.horizontal.repeat(28)}`);
      lines.push('');
    });

    // Footer
    lines.push(this.symbols.divider.repeat(32));
    lines.push(`${this.symbols.arrow} *Select a Module:*`);
    lines.push(`   Reply with *number* (1-${course.modules.length})`);
    lines.push(this.symbols.divider.repeat(32));

    return lines.join('\n');
  }

  /**
   * Format quiz question with selectable options (M3 style)
   */
  formatQuizQuestion(question, currentNum, totalQuestions) {
    const lines = [];

    // Quiz header
    lines.push(this.symbols.divider.repeat(32));
    lines.push(`${this.symbols.quiz} *Quiz Question ${currentNum}/${totalQuestions}*`);
    lines.push(this.symbols.divider.repeat(32));
    lines.push('');

    // Question text
    lines.push(`${this.symbols.lightbulb} *Question:*`);
    const questionLines = this.wrapText(question.question_text, 30);
    questionLines.forEach(line => lines.push(`   ${line}`));
    lines.push('');

    // Options with M3 selectable styling - clean design
    lines.push(`${this.symbols.radio} *Select Your Answer:*`);
    lines.push('');

    const optionLabels = ['A', 'B', 'C', 'D'];
    const options = [
      question.option_a,
      question.option_b,
      question.option_c,
      question.option_d
    ].filter(opt => opt); // Filter out null options

    options.forEach((option, idx) => {
      const label = optionLabels[idx];
      // Clean option format with radio button
      lines.push(`${this.symbols.radioEmpty} *${label}.* ${option}`);
      // Separator between options
      if (idx < options.length - 1) {
        lines.push(`   ${this.symbols.horizontal.repeat(28)}`);
      }
      lines.push('');
    });

    // Footer instructions
    lines.push(this.symbols.divider.repeat(32));
    lines.push(`${this.symbols.arrow} *Reply with:* A, B, C, or D`);
    lines.push(this.symbols.divider.repeat(32));

    return lines.join('\n');
  }

  /**
   * Format quiz results with celebration styling
   */
  formatQuizResults({ score, totalQuestions, correctAnswers, passed, feedback }) {
    const lines = [];
    const percentage = Math.round((correctAnswers / totalQuestions) * 100);

    // Results header
    lines.push(this.symbols.divider.repeat(32));
    if (passed) {
      lines.push(`${this.symbols.trophy} *Quiz Complete - PASSED!* ${this.symbols.sparkles}`);
    } else {
      lines.push(`${this.symbols.quiz} *Quiz Complete*`);
    }
    lines.push(this.symbols.divider.repeat(32));
    lines.push('');

    // Score card
    lines.push(`┌${this.symbols.horizontal.repeat(30)}`);
    lines.push(`│ 📊 *Your Results*`);
    lines.push(`│`);
    lines.push(`│ ${this.symbols.star} Score: *${percentage}%*`);
    lines.push(`│ ${this.symbols.check} Correct: *${correctAnswers}/${totalQuestions}*`);
    lines.push(`│ ${passed ? this.symbols.success : this.symbols.warning} Status: *${passed ? 'PASSED' : 'NEEDS REVIEW'}*`);
    lines.push(`└${this.symbols.horizontal.repeat(30)}`);
    lines.push('');

    // Feedback
    if (feedback) {
      lines.push(`${this.symbols.lightbulb} *Feedback:*`);
      const feedbackLines = this.wrapText(feedback, 30);
      feedbackLines.forEach(line => lines.push(`   ${line}`));
      lines.push('');
    }

    // Celebration or encouragement
    if (passed) {
      lines.push(`${this.symbols.fire} *Excellent work!* You're ready for the next module!`);
    } else {
      lines.push(`${this.symbols.info} Keep studying and try again. You've got this!`);
    }

    lines.push(this.symbols.divider.repeat(32));

    return lines.join('\n');
  }

  /**
   * Format chat response with M3 card styling
   */
  formatChatResponse({ content, sources = [], moduleName = null }) {
    const lines = [];

    // Response card header
    lines.push(this.symbols.divider.repeat(32));
    if (moduleName) {
      lines.push(`${this.symbols.chat} *${moduleName}*`);
      lines.push(this.symbols.divider.repeat(32));
      lines.push('');
    }

    // Convert markdown to WhatsApp formatting
    const formattedContent = this.convertMarkdownToWhatsApp(content);

    // Content - properly indented and centered for better readability
    const contentLines = this.wrapText(formattedContent, 32);

    // Add generous indentation for better visual centering
    contentLines.forEach((line, idx) => {
      if (line.trim()) {
        // Add 6-space indentation for better visual centering
        lines.push(`      ${line}`);
      } else {
        lines.push('');
      }
    });
    lines.push('');

    // Sources footer
    if (sources && sources.length > 0) {
      lines.push(this.symbols.horizontal.repeat(32));
      lines.push(`${this.symbols.info} *Sources:*`);
      sources.slice(0, 3).forEach(source => {
        const sourceName = typeof source === 'string' ? source : source.title || source.name || 'Document';
        const truncated = sourceName.length > 28
          ? sourceName.substring(0, 25) + '...'
          : sourceName;
        lines.push(`   ${this.symbols.bullet} ${truncated}`);
      });
    }

    lines.push(this.symbols.divider.repeat(32));

    return lines.join('\n');
  }

  /**
   * Format welcome message
   */
  formatWelcomeMessage({ name, courseName = null }) {
    const lines = [];

    lines.push(this.symbols.divider.repeat(32));
    lines.push(`${this.symbols.sparkles} *Welcome!* ${this.symbols.sparkles}`);
    lines.push(this.symbols.divider.repeat(32));
    lines.push('');
    lines.push(`👋 Hi *${name}*!`);
    lines.push('');

    if (courseName) {
      lines.push(`You're enrolled in:`);
      lines.push(`${this.symbols.course} *${courseName}*`);
      lines.push('');
    }

    lines.push(`${this.symbols.rocket} *Getting Started:*`);
    lines.push(`   ${this.symbols.bullet} Ask me questions`);
    lines.push(`   ${this.symbols.bullet} Type *'courses'* to browse`);
    lines.push(`   ${this.symbols.bullet} Type *'progress'* to track learning`);
    lines.push(`   ${this.symbols.bullet} Type *'help'* for commands`);
    lines.push('');
    lines.push(`${this.symbols.fire} Ready to learn? Let's go!`);
    lines.push(this.symbols.divider.repeat(32));

    return lines.join('\n');
  }

  /**
   * Format progress report
   */
  formatProgressReport({ userName, modules, overallProgress }) {
    const lines = [];

    lines.push(this.symbols.divider.repeat(32));
    lines.push(`${this.symbols.progress} *Your Learning Progress*`);
    lines.push(this.symbols.divider.repeat(32));
    lines.push('');
    lines.push(`Student: *${userName}*`);
    lines.push(`Overall: *${overallProgress}%* complete`);
    lines.push('');

    // Module progress
    modules.forEach((module, idx) => {
      const emoji = this.getProgressEmoji(module.status);
      const progressBar = this.createProgressBar(module.progress || 0);

      lines.push(`${emoji} *Module ${idx + 1}*: ${module.name}`);
      lines.push(`   ${progressBar} ${module.progress || 0}%`);

      if (module.quizPassed) {
        lines.push(`   ${this.symbols.trophy} Quiz passed`);
      }
      lines.push('');
    });

    lines.push(this.symbols.divider.repeat(32));
    lines.push(`${this.symbols.rocket} Keep up the great work!`);
    lines.push(this.symbols.divider.repeat(32));

    return lines.join('\n');
  }

  /**
   * Helper: Convert markdown to WhatsApp-friendly formatting
   */
  convertMarkdownToWhatsApp(text) {
    if (!text) return text;

    // Convert markdown headings (## Heading) to UPPERCASE with emoji
    text = text.replace(/^#{1,3}\s+(.+)$/gm, (match, heading) => {
      return `▪️ ${heading.toUpperCase()}`;
    });

    // Convert markdown bold (**text**) to UPPERCASE or remove asterisks
    // Since WhatsApp via Twilio doesn't reliably render *bold*, we'll use visual emphasis
    text = text.replace(/\*\*([^*]+?)\*\*/g, (match, boldText) => {
      // For short text (< 30 chars), use uppercase
      if (boldText.length < 30) {
        return boldText.toUpperCase();
      }
      // For longer text, just remove asterisks
      return boldText;
    });

    // Remove any remaining single asterisks used for emphasis
    // But keep proper WhatsApp markdown if it's surrounded by spaces
    text = text.replace(/\*([^*]+?)\*/g, '$1');

    // Convert markdown italic (__text__) - just remove underscores
    text = text.replace(/__([^_]+?)__/g, '$1');

    return text;
  }

  /**
   * Helper: Wrap text to specified width
   */
  wrapText(text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
      if ((currentLine + word).length > maxWidth) {
        if (currentLine) lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    });

    if (currentLine.trim()) lines.push(currentLine.trim());
    return lines;
  }

  /**
   * Helper: Create progress bar
   */
  createProgressBar(percentage, width = 10) {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Helper: Get emoji for course
   */
  getCourseEmoji(courseName) {
    const lower = courseName.toLowerCase();
    if (lower.includes('business')) return '💼';
    if (lower.includes('science')) return '🔬';
    if (lower.includes('math')) return '🔢';
    if (lower.includes('language')) return '📝';
    if (lower.includes('technology')) return '💻';
    return '📚';
  }

  /**
   * Helper: Get emoji for module by index
   */
  getModuleEmoji(index) {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    return emojis[index] || '📖';
  }

  /**
   * Helper: Get emoji for progress status
   */
  getProgressEmoji(status) {
    switch (status) {
      case 'completed': return this.symbols.success;
      case 'in_progress': return this.symbols.filledCircle;
      case 'locked': return '🔒';
      default: return this.symbols.circle;
    }
  }

  /**
   * Format answer confirmation (for quiz)
   */
  formatAnswerFeedback({ correct, explanation, nextQuestion = null }) {
    const lines = [];

    if (correct) {
      lines.push(`${this.symbols.success} *Correct!* ${this.symbols.fire}`);
    } else {
      lines.push(`${this.symbols.cross} *Incorrect*`);
    }

    if (explanation) {
      lines.push('');
      lines.push(`${this.symbols.lightbulb} ${explanation}`);
    }

    if (nextQuestion) {
      lines.push('');
      lines.push(`${this.symbols.arrow} Next question coming up...`);
    }

    return lines.join('\n');
  }

  /**
   * Format error message
   */
  formatError(message) {
    const lines = [];
    lines.push(this.symbols.divider.repeat(32));
    lines.push(`${this.symbols.error} *Error*`);
    lines.push(this.symbols.divider.repeat(32));
    lines.push('');
    lines.push(message);
    lines.push('');
    lines.push(`${this.symbols.info} Type *'help'* for assistance`);
    lines.push(this.symbols.divider.repeat(32));
    return lines.join('\n');
  }

  /**
   * Format help menu
   */
  formatHelpMenu() {
    const lines = [];

    lines.push(this.symbols.divider.repeat(32));
    lines.push(`${this.symbols.info} *Help & Commands*`);
    lines.push(this.symbols.divider.repeat(32));
    lines.push('');

    lines.push(`${this.symbols.rocket} *Getting Started:*`);
    lines.push(`   ${this.symbols.bullet} *start* - Begin learning`);
    lines.push(`   ${this.symbols.bullet} *courses* - Browse courses`);
    lines.push('');

    lines.push(`${this.symbols.module} *During Learning:*`);
    lines.push(`   ${this.symbols.bullet} Ask any question`);
    lines.push(`   ${this.symbols.bullet} *quiz* - Take module quiz`);
    lines.push(`   ${this.symbols.bullet} *progress* - View progress`);
    lines.push('');

    lines.push(`${this.symbols.chat} *Other Commands:*`);
    lines.push(`   ${this.symbols.bullet} *help* - Show this menu`);
    lines.push(`   ${this.symbols.bullet} *restart* - Start over`);
    lines.push('');

    lines.push(this.symbols.divider.repeat(32));
    lines.push(`${this.symbols.sparkles} Happy learning!`);
    lines.push(this.symbols.divider.repeat(32));

    return lines.join('\n');
  }
}

module.exports = new WhatsAppM3FormatterService();
