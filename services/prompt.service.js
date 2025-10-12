class PromptService {
  constructor() {
    this.language = 'english'; // Default language
  }

  /**
   * Get the appropriate prompt based on language and context
   */
  getPrompt(language = 'english') {
    switch (language.toLowerCase()) {
      case 'swahili':
        return this.getSwahiliPrompt();
      case 'spanish':
        return this.getSpanishPrompt();
      default:
        return this.getEnglishPrompt();
    }
  }

  /**
   * English prompt for teacher training Q&A
   */
  getEnglishPrompt() {
    return `You are a helpful teacher training assistant. Answer the question using the information provided below.

Instructions:
- Give a clear, direct answer based on the information provided
- Use practical examples when available
- Keep your answer focused and helpful
- If the information doesn't contain the answer, say "I don't have specific information about that in the current materials"

Information:
{context}

Question: {question}

Answer:`;
  }

  /**
   * Swahili prompt for teacher training (Tanzanian context)
   */
  getSwahiliPrompt() {
    return `Wewe ni msaidizi wa mafunzo ya walimu. Jibu swali kwa kutumia taarifa zilizotolewa hapa chini.

Maelekezo:
- Toa jibu wazi na la moja kwa moja kulingana na taarifa zilizotolewa
- Tumia mifano ya vitendo inapowezekana
- Weka jibu lako lenye kulenga na kusaidia
- Ikiwa taarifa hazijumuishi jibu, sema "Sina taarifa maalum kuhusu hilo katika nyenzo za sasa"

Taarifa:
{context}

Swali: {question}

Jibu:`;
  }

  /**
   * Spanish prompt (for international contexts)
   */
  getSpanishPrompt() {
    return `Eres un asistente de formación docente. Responde la pregunta usando la información proporcionada abajo.

Instrucciones:
- Da una respuesta clara y directa basada en la información proporcionada
- Usa ejemplos prácticos cuando estén disponibles
- Mantén tu respuesta enfocada y útil
- Si la información no contiene la respuesta, di "No tengo información específica sobre eso en los materiales actuales"

Información:
{context}

Pregunta: {question}

Respuesta:`;
  }

  /**
   * Format the prompt with context and question
   * Uses narrative chunking for better context organization
   */
  formatPrompt(question, context, language = 'english') {
    const promptTemplate = this.getPrompt(language);

    // Format context using narrative chunking
    let formattedContext = this.formatContextWithNarrativeChunking(context);

    // Replace placeholders
    return promptTemplate
      .replace('{context}', formattedContext)
      .replace('{question}', question);
  }

  /**
   * Format context using narrative chunking technique
   * Organizes chunks into coherent narrative blocks
   */
  formatContextWithNarrativeChunking(context) {
    if (!context) return 'No information available.';

    // Handle array of chunks
    if (Array.isArray(context)) {
      if (context.length === 0) return 'No information available.';

      // Group related chunks by similarity/topic
      const narrativeBlocks = context.map((item, index) => {
        let content = '';

        if (typeof item === 'object' && item.content) {
          content = item.content;
          // Add metadata if available
          if (item.metadata) {
            const source = item.metadata.source || item.metadata.module || 'Source';
            return `[${source}]\n${content}`;
          }
        } else if (typeof item === 'string') {
          content = item;
        }

        return content;
      });

      // Join blocks with clear separators
      return narrativeBlocks.filter(Boolean).join('\n\n---\n\n');
    }

    // Handle single object
    if (typeof context === 'object' && context.content) {
      return context.content;
    }

    // Handle string
    if (typeof context === 'string') {
      return context;
    }

    return String(context);
  }

  /**
   * Get a system prompt for general guidance
   */
  getSystemPrompt(role = 'teacher_trainer') {
    const prompts = {
      teacher_trainer: `You are an expert teacher trainer and educational consultant. Your role is to provide evidence-based guidance on teaching methodologies, classroom management, curriculum development, and professional growth. Always maintain a supportive and constructive tone while focusing on practical, implementable solutions.`,
      
      curriculum_specialist: `You are a curriculum development specialist. Focus on learning objectives, assessment strategies, content sequencing, and alignment with educational standards. Provide detailed guidance on creating effective lesson plans and educational materials.`,
      
      classroom_manager: `You are an expert in classroom management and student behavior. Provide strategies for creating positive learning environments, managing diverse learners, handling behavioral challenges, and building strong teacher-student relationships.`,
      
      assessment_expert: `You are an educational assessment specialist. Focus on formative and summative assessment strategies, rubric development, feedback techniques, and using assessment data to improve instruction.`,
      
      technology_integration: `You are an educational technology integration specialist. Provide guidance on effectively using technology in the classroom, digital tools for learning, online teaching strategies, and maintaining engagement in digital environments.`,
      
      general: `You are a knowledgeable educational assistant helping with teacher training. Provide accurate, helpful information based on best practices in education. Be supportive, professional, and focus on practical applications.`
    };
    
    return prompts[role] || prompts.general;
  }

  /**
   * Get a prompt for generating quiz questions from content
   */
  getQuizGenerationPrompt() {
    return `Based on the educational content provided, create 5 high-quality multiple-choice questions that test understanding of key concepts.

Requirements:
1. Questions should assess different cognitive levels (knowledge, comprehension, application)
2. Include clear, unambiguous question stems
3. Provide 4 answer options for each question
4. Ensure distractors are plausible but clearly incorrect
5. Include a brief explanation for the correct answer

Content:
{content}

Return the response in this exact JSON format:
{
  "questions": [
    {
      "question": "Clear question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Brief explanation of why this answer is correct",
      "difficulty": "easy|medium|hard",
      "topic": "Main topic being assessed"
    }
  ]
}`;
  }

  /**
   * Get a prompt for summarizing educational content
   */
  getSummarizationPrompt() {
    return `Summarize the following educational content for teachers, highlighting:
1. Key concepts and main ideas
2. Practical strategies or techniques mentioned
3. Important takeaways for classroom application
4. Any specific examples or case studies

Keep the summary concise but comprehensive (around 200-300 words).

Content:
{content}

Summary:`;
  }

  /**
   * Get a prompt for generating lesson plan suggestions
   */
  getLessonPlanPrompt() {
    return `Based on the educational content provided, suggest a lesson plan structure including:

1. Learning Objectives (2-3 specific, measurable objectives)
2. Introduction/Hook (engaging way to start the lesson)
3. Main Activities (2-3 core learning activities with time estimates)
4. Assessment Strategy (how to check understanding)
5. Closure (way to summarize and reinforce learning)
6. Differentiation Suggestions (for diverse learners)
7. Required Materials/Resources

Content:
{content}

Topic: {topic}

Lesson Plan Suggestions:`;
  }
}

module.exports = new PromptService();