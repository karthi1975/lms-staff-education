/**
 * Translation Service
 * Centralized bilingual support for English/Swahili
 */

const contentModerationService = require('./content-moderation.service');
const logger = require('../utils/logger');

class TranslationService {
  constructor() {
    this.translations = {
      // GREETING & NAVIGATION
      error_occurred: {
        en: "Sorry, an error occurred. Type 'help' for assistance.",
        sw: "Samahani, kuna hitilafu. Andika 'msaada' kwa usaidizi."
      },
      something_wrong: {
        en: "Something went wrong. Type 'start' to begin again.",
        sw: "Kuna tatizo. Andika 'anza' ili kuanza tena."
      },
      welcome_message: {
        en: "👋 Welcome! Type 'teach me' to start learning, or 'help' for options.",
        sw: "👋 Karibu! Andika 'nifundishe' ili kuanza kujifunza, au 'msaada' kwa chaguo."
      },

      // COURSE SELECTION
      platform_title: {
        en: "📚 Teachers Training Platform",
        sw: "📚 Jukwaa la Mafunzo ya Walimu"
      },
      welcome_choose_course: {
        en: "Welcome! Choose your course to get started:",
        sw: "Karibu! Chagua kozi yako ili kuanza:"
      },
      available_courses: {
        en: "📚 Available Courses",
        sw: "📚 Kozi Zinazopatikana"
      },
      select_course_journey: {
        en: "Select a course to begin your learning journey:",
        sw: "Chagua kozi ili kuanza safari yako ya kujifunza:"
      },
      view_courses: {
        en: "View Courses",
        sw: "Tazama Kozi"
      },
      all_courses: {
        en: "All Courses",
        sw: "Kozi Zote"
      },
      please_select_course: {
        en: "Please select a course by number:",
        sw: "Tafadhali chagua kozi kwa nambari:"
      },
      invalid_course: {
        en: "Invalid course selection. Please try again.",
        sw: "Uchaguzi wa kozi si sahihi. Tafadhali jaribu tena."
      },
      modules_text: {
        en: "modules",
        sw: "moduli"
      },
      how_to_select: {
        en: "How to Select:",
        sw: "Jinsi ya Kuchagua:"
      },
      reply_with_number: {
        en: "Reply with the *number*",
        sw: "Jibu kwa *nambari*"
      },

      // MODULE SELECTION
      course_modules: {
        en: "Course Modules",
        sw: "Moduli za Kozi"
      },
      available_text: {
        en: "available",
        sw: "zinazopatikana"
      },
      view_modules: {
        en: "View Modules",
        sw: "Tazama Moduli"
      },
      available_modules: {
        en: "Available Modules",
        sw: "Moduli Zinazopatikana"
      },
      quiz_available: {
        en: "📝 Quiz available",
        sw: "📝 Jaribio linapatikana"
      },
      learning_module: {
        en: "📖 Learning module",
        sw: "📖 Moduli ya kujifunza"
      },
      please_select_module: {
        en: "Please select a module by number:",
        sw: "Tafadhali chagua moduli kwa nambari:"
      },
      invalid_module: {
        en: "Invalid module selection. Please choose a number between 1 and {count}.",
        sw: "Uchaguzi wa moduli si sahihi. Tafadhali chagua nambari kati ya 1 na {count}."
      },
      select_module: {
        en: "Select a Module:",
        sw: "Chagua Moduli:"
      },

      // MODULE START (LEARNING)
      started_learning: {
        en: "✅ Great! You've started learning!",
        sw: "✅ Vizuri! Umeanza kujifunza!"
      },
      what_you_learn: {
        en: "📚 *What You'll Learn:*",
        sw: "📚 *Utakachojifunza:*"
      },
      learn_concepts: {
        en: "Learn key concepts and practical skills",
        sw: "Jifunze dhana muhimu na ujuzi wa vitendo"
      },
      in_module: {
        en: "in",
        sw: "katika"
      },
      ask_me_anything: {
        en: "💬 *Ask Me Anything!*",
        sw: "💬 *Uliza Chochote!*"
      },
      examples: {
        en: "Examples:",
        sw: "Mifano:"
      },

      // TEACHER TRAINING EXAMPLES
      example_lesson_plans: {
        en: "How to create engaging lesson plans?",
        sw: "Jinsi ya kuunda mipango ya masomo yenye kuvutia?"
      },
      example_classroom_mgmt: {
        en: "What are effective classroom management techniques?",
        sw: "Ni mbinu gani bora za usimamizi wa darasa?"
      },
      example_assessment: {
        en: "How to assess student learning in Business Studies?",
        sw: "Jinsi ya kutathmini ujifunzaji wa wanafunzi katika Masomo ya Biashara?"
      },

      // BUSINESS STUDIES EXAMPLES (Generic)
      example_entrepreneurship: {
        en: "What is entrepreneurship?",
        sw: "Ujasiriamali ni nini?"
      },
      example_opportunities: {
        en: "How to identify opportunities?",
        sw: "Jinsi ya kutambua fursa?"
      },
      example_market_research: {
        en: "Tell me about market research",
        sw: "Niambie kuhusu utafiti wa soko"
      },

      // MODULE-SPECIFIC EXAMPLES - Production
      example_production_1: {
        en: "What is production in small business?",
        sw: "Uzalishaji katika biashara ndogo ni nini?"
      },
      example_production_2: {
        en: "How do I manage quality control?",
        sw: "Jinsi ya kusimamia ubora wa bidhaa?"
      },
      example_production_3: {
        en: "Tell me about production planning",
        sw: "Niambie kuhusu mipango ya uzalishaji"
      },

      // MODULE-SPECIFIC EXAMPLES - Financing
      example_financing_1: {
        en: "How to get funding for small business?",
        sw: "Jinsi ya kupata fedha kwa biashara ndogo?"
      },
      example_financing_2: {
        en: "What are financing options available?",
        sw: "Ni chaguo gani za ufadhili zinazopatikana?"
      },
      example_financing_3: {
        en: "Tell me about microfinance",
        sw: "Niambie kuhusu mikopo midogo"
      },

      // MODULE-SPECIFIC EXAMPLES - Business Management
      example_management_1: {
        en: "How to manage a small business?",
        sw: "Jinsi ya kusimamia biashara ndogo?"
      },
      example_management_2: {
        en: "What are key management skills?",
        sw: "Ni ujuzi gani muhimu wa usimamizi?"
      },
      example_management_3: {
        en: "Tell me about business planning",
        sw: "Niambie kuhusu mipango ya biashara"
      },

      // MODULE-SPECIFIC EXAMPLES - Warehousing
      example_warehousing_1: {
        en: "How to manage inventory effectively?",
        sw: "Jinsi ya kusimamia hisa kwa ufanisi?"
      },
      example_warehousing_2: {
        en: "What is stock control?",
        sw: "Udhibiti wa hisa ni nini?"
      },
      example_warehousing_3: {
        en: "Tell me about warehousing best practices",
        sw: "Niambie kuhusu mazoea bora ya uhifadhi"
      },

      // MODULE-SPECIFIC EXAMPLES - Business Opportunities
      example_business_opp_1: {
        en: "How to identify business opportunities?",
        sw: "Jinsi ya kutambua fursa za kibiashara?"
      },
      example_business_opp_2: {
        en: "What makes a good business idea?",
        sw: "Ni nini kinachofanya wazo la biashara kuwa zuri?"
      },
      example_business_opp_3: {
        en: "Tell me about market analysis",
        sw: "Niambie kuhusu uchanganuzi wa soko"
      },

      // MODULE-SPECIFIC EXAMPLES - Business Studies Orientation Modules
      // Module 1: Introduction to Pedagogical Standards
      example_cbc_standards_1: {
        en: "What are the pedagogical standards in CBC?",
        sw: "Ni vigezo gani vya kufundishia katika CBC?"
      },
      example_cbc_standards_2: {
        en: "How do I apply CBC framework in Business Studies?",
        sw: "Ninawezaje kutumia mfumo wa CBC katika Masomo ya Biashara?"
      },
      example_cbc_standards_3: {
        en: "Tell me about competency-based teaching",
        sw: "Niambie kuhusu ufundishaji kulingana na ujuzi"
      },

      // Module 2: Assigning Business Studies Projects
      example_assign_projects_1: {
        en: "How do I assign effective Business Studies projects?",
        sw: "Ninawezeaje kupangia miradi bora ya Masomo ya Biashara?"
      },
      example_assign_projects_2: {
        en: "What makes a good project assignment?",
        sw: "Ni nini kinachofanya kazi ya mradi kuwa nzuri?"
      },
      example_assign_projects_3: {
        en: "Tell me about project rubrics and criteria",
        sw: "Niambie kuhusu vigezo vya kupima miradi"
      },

      // Module 3: Practical Project Work
      example_practical_work_1: {
        en: "How do students conduct practical project work?",
        sw: "Wanafunzi wanafanyaje kazi za vitendo za miradi?"
      },
      example_practical_work_2: {
        en: "What skills do students develop through projects?",
        sw: "Ni ujuzi gani wanafunzi wanajifunza kupitia miradi?"
      },
      example_practical_work_3: {
        en: "Tell me about monitoring student progress",
        sw: "Niambie kuhusu kufuatilia maendeleo ya wanafunzi"
      },

      // Module 4: Project Presentations
      example_presentations_1: {
        en: "How should students present their projects?",
        sw: "Wanafunzi wanapaswa kuzinduaje miradi yao?"
      },
      example_presentations_2: {
        en: "What makes an effective presentation?",
        sw: "Ni nini kinachofanya uwasilishaji kuwa mzuri?"
      },
      example_presentations_3: {
        en: "Tell me about assessing presentations",
        sw: "Niambie kuhusu kutathmini mawasilisho"
      },

      // Module 5: Project-based Learning and Assessment Guidelines
      example_pba_guidelines_1: {
        en: "What is Performance-Based Assessment?",
        sw: "Tathmini kulingana na Utendaji ni nini?"
      },
      example_pba_guidelines_2: {
        en: "How do I grade project-based work fairly?",
        sw: "Ninawezaje kukadiria kazi za miradi kwa usawa?"
      },
      example_pba_guidelines_3: {
        en: "Tell me about PBA rubrics and guidelines",
        sw: "Niambie kuhusu vigezo na miongozo ya PBA"
      },

      // QUIZ SECTION
      ready_test_knowledge: {
        en: "📝 *Take the Quiz!*",
        sw: "📝 *Fanya Jaribio!*"
      },
      type_quiz: {
        en: "Type: *quiz* please",
        sw: "Andika: *jaribio* tafadhali"
      },
      need_help: {
        en: "🔄 *Need Help?*",
        sw: "🔄 *Unahitaji Msaada?*"
      },
      type_menu: {
        en: "Type: *\"menu\"* to see options",
        sw: "Andika: *\"menyu\"* ili kuona chaguo"
      },

      // RAG PROMPTS
      ask_another_quiz: {
        en: "💡 _Ask another question or type *\"quiz\"* to take the quiz!_",
        sw: "💡 _Uliza swali lingine au andika *\"jaribio\"* ili kufanya mtihani!_"
      },
      ask_another_continue: {
        en: "💡 _Ask another question to continue learning!_",
        sw: "💡 _Uliza swali lingine ili kuendelea kujifunza!_"
      },
      error_searching: {
        en: "I encountered an error while searching for content about your question.",
        sw: "Nimekutana na hitilafu wakati wa kutafuta maudhui kuhusu swali lako."
      },
      please_try: {
        en: "Please try:",
        sw: "Tafadhali jaribu:"
      },
      rephrase_question: {
        en: "• Rephrasing your question",
        sw: "• Ubadilishe jinsi ya kuuliza swali"
      },
      ask_specific_topics: {
        en: "• Asking about specific topics in {module}",
        sw: "• Uliza kuhusu mada mahususi katika {module}"
      },
      type_menu_explore: {
        en: "• Type *'menu'* to explore other modules",
        sw: "• Andika *'menyu'* ili uchunguze moduli zingine"
      },

      // ERROR MESSAGES
      no_courses_available: {
        en: "⚠️ No courses are currently available for you.\n\nThis might mean:\n• Courses are still being set up\n• You haven't been assigned to a course yet\n\nPlease contact your administrator to be assigned to a course.\n\nType \"help\" for more information.",
        sw: "⚠️ Hakuna kozi zinazopatikana kwa ajili yako.\n\nHii inaweza kumaanisha:\n• Kozi bado zinaandaliwa\n• Bado hujapewa kozi\n\nTafadhali wasiliana na msimamizi ili upatiwe kozi.\n\nAndika \"msaada\" kwa maelezo zaidi."
      },
      invalid_module_id: {
        en: "⚠️ System error: Invalid module assignment.\n\nPlease contact your administrator.\n\nError code: INVALID_MODULE_ID",
        sw: "⚠️ Hitilafu ya mfumo: Mgawo wa moduli si sahihi.\n\nTafadhali wasiliana na msimamizi.\n\nMsimbo wa hitilafu: INVALID_MODULE_ID"
      },
      module_updated: {
        en: "⚠️ Your assigned module was updated.\n\nStarting from the first available module...\n\nPlease send your question again or type \"help\" for available commands.",
        sw: "⚠️ Moduli yako iliyopewa imebadilishwa.\n\nKuanzia moduli ya kwanza inayopatikana...\n\nTafadhali tuma swali lako tena au andika \"msaada\" kwa amri zinazopatikana."
      },
      no_courses_contact_admin: {
        en: "⚠️ No courses are currently available.\n\nPlease contact your administrator.",
        sw: "⚠️ Hakuna kozi zinazopatikana kwa sasa.\n\nTafadhali wasiliana na msimamizi."
      }
    };
  }

  /**
   * Get translation for a key
   * @param {string} key - Translation key
   * @param {string} language - 'english' or 'swahili'
   * @param {object} replacements - Variables to replace in translation
   * @returns {string} Translated text
   */
  t(key, language = 'english', replacements = {}) {
    try {
      const lang = language === 'swahili' ? 'sw' : 'en';

      if (!this.translations[key]) {
        logger.warn(`Translation key not found: ${key}`);
        return key; // Return key if translation missing
      }

      let text = this.translations[key][lang];

      // Replace placeholders like {module}, {count}, etc.
      Object.keys(replacements).forEach(placeholder => {
        const regex = new RegExp(`\\{${placeholder}\\}`, 'g');
        text = text.replace(regex, replacements[placeholder]);
      });

      return text;
    } catch (error) {
      logger.error('Translation error:', error);
      return key;
    }
  }

  /**
   * Detect language from message using existing content moderation service
   * @param {string} message - User message
   * @returns {string} 'english' or 'swahili'
   */
  detectLanguageFromMessage(message) {
    try {
      const isSwahili = contentModerationService.containsSwahili(message);
      return isSwahili ? 'swahili' : 'english';
    } catch (error) {
      logger.error('Language detection error:', error);
      return 'english'; // Default to English
    }
  }

  /**
   * Get language from context data
   * @param {object} contextData - Parsed context data
   * @returns {string|null} 'english', 'swahili', or null
   */
  getLanguageFromContext(contextData) {
    return contextData?.language || null;
  }
}

module.exports = new TranslationService();
