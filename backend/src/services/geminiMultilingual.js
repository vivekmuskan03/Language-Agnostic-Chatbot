const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * Enhanced multilingual understanding using Gemini AI
 * @param {string} query - User query
 * @param {string} detectedLang - Detected language
 * @param {Array} contextData - Context data from various sources
 * @returns {Promise<Object>} - Enhanced understanding and response
 */
async function enhanceMultilingualUnderstanding(query, detectedLang, contextData = []) {
  try {
    const languageNames = {
      'en': 'English',
      'hi': 'Hindi',
      'te': 'Telugu',
      'gu': 'Gujarati',
      'ta': 'Tamil',
      'kn': 'Kannada'
    };

    const contextText = contextData.map(item => {
      if (item.question && item.answer) {
        return `Q: ${item.question}\nA: ${item.answer}`;
      } else if (item.title && item.content) {
        return `${item.title}: ${item.content}`;
      } else if (item.content) {
        return item.content;
      }
      return '';
    }).join('\n\n');

    const prompt = `
You are a multilingual AI assistant for a university chatbot. The user's query is in ${languageNames[detectedLang]} language.

User Query: "${query}"

Context Information:
${contextText}

Please provide:
1. A clear understanding of what the user is asking
2. The most relevant information from the context
3. A helpful response in the user's preferred language (${languageNames[detectedLang]})
4. If the query is about HOD (Head of Department), faculty, or academic information, provide specific details
5. If the information is not available in the context, suggest where they might find it

Format your response as JSON:
{
  "understanding": "What the user is asking for",
  "relevantInfo": "Most relevant information from context",
  "response": "Helpful response in ${languageNames[detectedLang]}",
  "suggestions": "Additional suggestions or next steps"
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    try {
      return JSON.parse(text);
    } catch (parseError) {
      // If JSON parsing fails, return a structured response
      return {
        understanding: "Query processed",
        relevantInfo: contextText.substring(0, 500),
        response: text,
        suggestions: "Please contact the university administration for more details"
      };
    }
  } catch (error) {
    console.error('Gemini AI enhancement failed:', error);
    return {
      understanding: "Query processed",
      relevantInfo: contextData.map(item => item.content || item.answer || '').join(' ').substring(0, 500),
      response: `I understand you're asking about: ${query}. Let me help you with the available information.`,
      suggestions: "Please contact the university administration for more details"
    };
  }
}

/**
 * Generate multilingual responses using Gemini AI
 * @param {string} query - User query
 * @param {string} targetLang - Target language for response
 * @param {Array} knowledgeItems - Knowledge items
 * @param {Array} faqs - FAQ items
 * @param {Array} events - Event items
 * @returns {Promise<string>} - Generated response
 */
async function generateMultilingualResponse(query, targetLang, knowledgeItems = [], faqs = [], events = []) {
  try {
    const languageNames = {
      'en': 'English',
      'hi': 'Hindi',
      'te': 'Telugu',
      'gu': 'Gujarati',
      'ta': 'Tamil',
      'kn': 'Kannada'
    };

    const contextData = [
      ...knowledgeItems.map(item => ({ title: item.title, content: item.content })),
      ...faqs.map(faq => ({ question: faq.question, answer: faq.answer })),
      ...events.map(event => ({ title: event.title, content: event.description }))
    ];

    const contextText = contextData.map(item => {
      if (item.question && item.answer) {
        return `Q: ${item.question}\nA: ${item.answer}`;
      } else if (item.title && item.content) {
        return `${item.title}: ${item.content}`;
      }
      return '';
    }).join('\n\n');

    const prompt = `
You are a helpful university chatbot assistant. The user's query is: "${query}"

Context Information:
${contextText}

Please provide a comprehensive, helpful response in ${languageNames[targetLang]} that:
1. Directly addresses the user's question
2. Uses the most relevant information from the context
3. Is clear, concise, and helpful
4. If asking about HOD or faculty, provide specific details
5. If information is not available, suggest where to find it
6. Maintains a friendly, professional tone

Respond only with the answer in ${languageNames[targetLang]}, no additional formatting.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini response generation failed:', error);
    return `I understand you're asking about: ${query}. Let me help you with the available information.`;
  }
}

/**
 * Detect and enhance query understanding using Gemini AI
 * @param {string} query - User query
 * @returns {Promise<Object>} - Enhanced query understanding
 */
async function detectAndEnhanceQuery(query) {
  try {
    const prompt = `
Analyze this user query and provide detailed understanding:

Query: "${query}"

Please provide:
1. The primary intent of the query
2. Key entities mentioned (HOD, department, faculty, etc.)
3. The most likely language (en, hi, te, gu, ta, kn)
4. Suggested search terms for finding relevant information
5. Category of information needed (academic, administrative, general, etc.)

Format as JSON:
{
  "intent": "What the user wants to know",
  "entities": ["entity1", "entity2"],
  "language": "detected_language_code",
  "searchTerms": ["term1", "term2"],
  "category": "information_category"
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    try {
      return JSON.parse(text);
    } catch (parseError) {
      return {
        intent: "General inquiry",
        entities: [],
        language: "en",
        searchTerms: [query],
        category: "general"
      };
    }
  } catch (error) {
    console.error('Gemini query analysis failed:', error);
    return {
      intent: "General inquiry",
      entities: [],
      language: "en",
      searchTerms: [query],
      category: "general"
    };
  }
}

module.exports = {
  enhanceMultilingualUnderstanding,
  generateMultilingualResponse,
  detectAndEnhanceQuery
};
