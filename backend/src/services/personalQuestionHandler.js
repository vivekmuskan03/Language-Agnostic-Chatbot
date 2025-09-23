const { retrieveRelevantKnowledge, searchKnowledgeBase } = require('./learningIntegration');
const { searchAcademicInfo, searchWeb: webSearch } = require('./webSearch');
const { detectLanguage, translateText } = require('./translate');
const FAQ = require('../models/FAQ');
const Event = require('../models/Event');
const ChatLog = require('../models/ChatLog');
const User = require('../models/User');
const { generateChatResponse } = require('./gemini');

// Cache for frequently accessed data
let faqCache = [];
let lastCacheUpdate = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function searchFAQs(question, lang = 'en') {
  try {
    // Refresh cache if needed
    const now = Date.now();
    if (now - lastCacheUpdate > CACHE_TTL || faqCache.length === 0) {
      faqCache = await FAQ.find({}).lean();
      lastCacheUpdate = now;
    }

    // Tokenize and clean the question
    const tokens = question.toLowerCase()
      .replace(/[^\w\s]|_/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(token => token.length > 2); // Remove short tokens

    // Score each FAQ based on token matches
    const scoredFAQs = faqCache.map(faq => {
      const text = `${faq.question} ${faq.answer}`.toLowerCase();
      const score = tokens.reduce((score, token) => 
        text.includes(token) ? score + 1 : score, 0);
      return { ...faq, score };
    }).filter(faq => faq.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scoredFAQs.length > 0) {
      const bestMatch = scoredFAQs[0];
      // Calculate confidence based on match score and question length
      const confidence = Math.min(0.9, 0.5 + (bestMatch.score / tokens.length) * 0.4);
      
      return {
        source: 'faq',
        content: bestMatch.answer,
        confidence,
        metadata: { 
          faqId: bestMatch._id,
          question: bestMatch.question 
        }
      };
    }
    return null;
  } catch (error) {
    console.error('Error searching FAQs:', error);
    return null;
  }
}

async function searchEvents(question, lang = 'en') {
  try {
    const events = await Event.find({ 
      $or: [
        { title: { $regex: question, $options: 'i' } },
        { description: { $regex: question, $options: 'i' } }
      ]
    }).limit(3);

    if (events.length > 0) {
      return {
        source: 'events',
        content: events.map(e => `${e.title}: ${e.description}`).join('\n\n'),
        confidence: 0.7,
        metadata: { eventIds: events.map(e => e._id) }
      };
    }
    return null;
  } catch (error) {
    console.error('Error searching events:', error);
    return null;
  }
}

async function searchChatLogs(question, userId, sessionId) {
  try {
    // Get recent chat history with context
    const logs = await ChatLog.aggregate([
      { 
        $match: { 
          userId: userId,
          sessionId: sessionId || 'default'
        } 
      },
      { $sort: { timestamp: -1 } },
      { $limit: 20 },
      { $unwind: '$messages' },
      { 
        $project: {
          role: '$messages.role',
          content: '$messages.content',
          timestamp: '$messages.timestamp'
        }
      },
      { $sort: { timestamp: -1 } },
      { $limit: 50 } // Get more messages for better context
    ]);

    // Extract and clean question tokens
    const questionTokens = new Set(
      question.toLowerCase()
        .replace(/[^\w\s]|_/g, '')
        .split(/\s+/)
        .filter(t => t.length > 2)
    );

    // Find relevant message pairs (user + assistant)
    const relevantPairs = [];
    let currentPair = [];
    
    for (const msg of logs) {
      if (msg.role === 'user') {
        if (currentPair.length === 2) {
          // Calculate relevance score for the pair
          const pairText = currentPair.map(m => m.content).join(' ').toLowerCase();
          const score = Array.from(questionTokens).filter(t => 
            pairText.includes(t)
          ).length / questionTokens.size;
          
          if (score > 0.3) { // Only include relevant pairs
            relevantPairs.push({
              question: currentPair[1].content,
              answer: currentPair[0].content,
              score
            });
          }
        }
        currentPair = [msg];
      } else if (msg.role === 'assistant' && currentPair.length === 1) {
        currentPair.push(msg);
      }
    }

    if (relevantPairs.length > 0) {
      // Sort by relevance and take top 3 pairs
      const topPairs = relevantPairs
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      
      return {
        source: 'chat_history',
        content: topPairs.map(p => 
          `Q: ${p.question}\nA: ${p.answer}`
        ).join('\n\n'),
        confidence: 0.7 * topPairs[0].score, // Scale confidence by match quality
        metadata: { 
          pairCount: topPairs.length,
          bestScore: topPairs[0].score
        }
      };
    }
    return null;
  } catch (error) {
    console.error('Error searching chat logs:', error);
    return null;
  }
}

async function searchWebResults(question, lang = 'en') {
  try {
    // First try academic search
    const academicResults = await searchAcademicInfo(question);
    if (academicResults) {
      console.log('Found academic results for:', question);
      return {
        source: 'web_search',
        content: academicResults,
        confidence: 0.8,
        metadata: { 
          searchType: 'academic',
          timestamp: new Date().toISOString()
        }
      };
    }
    
    // Try general web search with enhanced context
    const searchQuery = `site:vignan.ac.in OR site:vignanuniversity.org ${question}`;
    const webResults = await webSearch(searchQuery, 3);
    
    if (webResults && webResults.length > 0) {
      console.log('Found web results for:', question);
      return {
        source: 'web_search',
        content: webResults.map(r => `${r.title}\n${r.snippet}`).join('\n\n'),
        confidence: 0.7,
        metadata: {
          searchType: 'general',
          resultCount: webResults.length,
          timestamp: new Date().toISOString()
        }
      };
    }
    
    // Fallback to Gemini AI with better context
    console.log('Falling back to Gemini AI for:', question);
    const context = `You are a helpful assistant for Vignan University. 
    Provide a concise and accurate answer to the student's question. 
    If you don't know the answer, say so honestly.
    
    Question: ${question}`;
    
    const geminiResponse = await generateChatResponse({
      context,
      messages: [{ role: 'user', content: question }],
      temperature: 0.3 // Lower temperature for more focused responses
    });
    
    if (geminiResponse) {
      return {
        source: 'gemini_ai',
        content: geminiResponse,
        confidence: 0.65, // Slightly lower confidence for AI-generated content
        metadata: { 
          model: 'gemini-pro',
          timestamp: new Date().toISOString()
        }
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error in web search:', error);
    return null;
  }
}

async function handlePersonalQuestion(question, userId, sessionId, lang = 'en') {
  try {
    // Get user context for better personalization
    const user = await User.findById(userId).lean() || {};
    const userContext = {
      department: user.department,
      year: user.year,
      name: user.name,
      email: user.email
    };

    // Enhanced question with user context
    const enhancedQuestion = `[User: ${userContext.name || 'Student'}, ` +
      `${userContext.department || 'Unknown Department'}, ` +
      `${userContext.year || 'Unknown Year'}] ` +
      question;

    // 1. Check FAQs first (fastest)
    const [faqResult, kbResult] = await Promise.all([
      searchFAQs(enhancedQuestion, lang),
      // 2. Search knowledge base in parallel
      retrieveRelevantKnowledge(enhancedQuestion, 3)
    ]);

    // Check FAQ results
    if (faqResult && faqResult.confidence >= 0.7) {
      return formatResponse(faqResult, 'faq', userContext);
    }

    // Check knowledge base results
    const bestKbMatch = kbResult?.[0];
    if (bestKbMatch?.score > 0.65) {
      return {
        answer: bestKbMatch.content,
        source: 'knowledge_base',
        confidence: bestKbMatch.score,
        metadata: { 
          source: bestKbMatch.metadata?.source,
          userContext
        }
      };
    }

    // 3. Check events and chat history in parallel
    const [eventResult, chatResult] = await Promise.all([
      searchEvents(enhancedQuestion, lang),
      searchChatLogs(enhancedQuestion, userId, sessionId)
    ]);

    // Check event results
    if (eventResult?.confidence >= 0.6) {
      return formatResponse(eventResult, 'events', userContext);
    }

    // Check chat history results
    if (chatResult?.confidence >= 0.6) {
      return formatResponse({
        ...chatResult,
        content: `Based on our previous conversation:\n\n${chatResult.content}`
      }, 'chat_history', userContext);
    }

    // 4. Fallback to web search (most expensive)
    const webResult = await searchWebResults(enhancedQuestion, lang);
    if (webResult) {
      return formatResponse(webResult, webResult.source, userContext);
    }

    // If no good results found, try to be helpful
    return {
      answer: `I couldn't find specific information about "${question}". ` +
        `Would you like me to help you find ${userContext.department ? 'department-specific ' : ''}information ` +
        `or connect you with someone who can assist you?`,
      source: 'fallback',
      confidence: 0,
      metadata: { userContext }
    };
  } catch (error) {
    console.error('Error in personal question handler:', error);
    return {
      answer: "I'm having trouble processing your request right now. " +
        "Please try again in a moment or contact support if the issue persists.",
      source: 'error',
      confidence: 0,
      metadata: { 
        error: error.message,
        timestamp: new Date().toISOString()
      }
    };
  }
}

// Helper function to format consistent responses
function formatResponse(result, source, userContext) {
  return {
    answer: result.content,
    source,
    confidence: result.confidence,
    metadata: {
      ...result.metadata,
      userContext,
      timestamp: new Date().toISOString()
    }
  };
}

module.exports = {
  handlePersonalQuestion,
  searchFAQs,
  searchEvents,
  searchChatLogs,
  searchWeb: searchWebResults
};
