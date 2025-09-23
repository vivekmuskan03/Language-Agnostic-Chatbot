/**
 * Learning Integration Service
 * 
 * This service integrates all learning sources for the chatbot:
 * - FAQs
 * - PDF files
 * - Events
 * - Chat logs
 * - User profiles
 * - URLs
 * - Internet data
 */

const { embedText, embedMany } = require('./gemini');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { detectLanguage, translateText } = require('./translate');
const { enhanceMultilingualUnderstanding, generateMultilingualResponse, detectAndEnhanceQuery } = require('./geminiMultilingual');
const KnowledgeItem = require('../models/KnowledgeItem');
const FAQ = require('../models/FAQ');
const Event = require('../models/Event');
const ChatLog = require('../models/ChatLog');
const User = require('../models/User');
const UserSession = require('../models/UserSession');
const { searchWeb } = require('./webSearch');
const { extractFromUrl } = require('./extract');

// Cache for vector stores
let knowledgeStorePromise = null;
let faqStorePromise = null;
let eventStorePromise = null;
let chatLogStorePromise = null;
let userProfileStorePromise = null;

/**
 * Get embeddings model
 */
function getEmbeddings() {
  const apiKey = process.env.GEMINI_API_KEY || '';
  return new GoogleGenerativeAIEmbeddings({ apiKey, modelName: 'text-embedding-004' });
}

/**
 * Build or retrieve knowledge item vector store
 */
async function getKnowledgeStore() {
  if (knowledgeStorePromise) return knowledgeStorePromise;
  
  knowledgeStorePromise = (async () => {
    const embeddings = getEmbeddings();
    const docs = await KnowledgeItem.find().lean();
    
    if (docs.length === 0) {
      return await MemoryVectorStore.fromTexts([], [], embeddings);
    }
    
    const texts = docs.map(d => `${d.title}\n\n${d.content}`);
    const metadatas = docs.map(d => ({
      id: String(d._id),
      title: d.title,
      sourceType: d.sourceType,
      language: d.language,
      category: d.metadata?.category || d.category,
      userId: d.metadata?.userId ? String(d.metadata.userId) : undefined
    }));
    
    return await MemoryVectorStore.fromTexts(texts, metadatas, embeddings);
  })();
  
  return knowledgeStorePromise;
}

/**
 * Build or retrieve FAQ vector store
 */
async function getFAQStore() {
  if (faqStorePromise) return faqStorePromise;
  
  faqStorePromise = (async () => {
    const embeddings = getEmbeddings();
    const docs = await FAQ.find().lean();
    
    if (docs.length === 0) {
      return await MemoryVectorStore.fromTexts([], [], embeddings);
    }
    
    const texts = docs.map(d => `Question: ${d.question}\nAnswer: ${d.answer}`);
    const metadatas = docs.map(d => ({
      id: String(d._id),
      category: d.category,
      language: d.language
    }));
    
    return await MemoryVectorStore.fromTexts(texts, metadatas, embeddings);
  })();
  
  return faqStorePromise;
}

/**
 * Build or retrieve event vector store
 */
async function getEventStore() {
  if (eventStorePromise) return eventStorePromise;
  
  eventStorePromise = (async () => {
    const embeddings = getEmbeddings();
    const docs = await Event.find().lean();
    
    if (docs.length === 0) {
      return await MemoryVectorStore.fromTexts([], [], embeddings);
    }
    
    const texts = docs.map(d => `Event: ${d.title}\n\nDescription: ${d.description || ''}\n\nCategory: ${d.category || 'general'}\n\nDate: ${d.startsAt ? new Date(d.startsAt).toLocaleDateString() : 'Not specified'}`);
    const metadatas = docs.map(d => ({
      id: String(d._id),
      title: d.title,
      category: d.category
    }));
    
    return await MemoryVectorStore.fromTexts(texts, metadatas, embeddings);
  })();
  
  return eventStorePromise;
}

/**
 * Build or retrieve chat log vector store
 */
async function getChatLogStore() {
  if (chatLogStorePromise) return chatLogStorePromise;
  
  chatLogStorePromise = (async () => {
    const embeddings = getEmbeddings();
    const docs = await ChatLog.find().lean();
    
    if (docs.length === 0) {
      return await MemoryVectorStore.fromTexts([], [], embeddings);
    }
    
    // Process chat logs to extract meaningful conversations
    const processedLogs = [];
    const processedMetadata = [];
    
    for (const log of docs) {
      if (!log.turns || log.turns.length < 2) continue;
      
      // Group turns into conversation chunks (user + assistant pairs)
      for (let i = 0; i < log.turns.length - 1; i++) {
        if (log.turns[i].role === 'user' && log.turns[i+1].role === 'assistant') {
          const userMessage = log.turns[i].content;
          const assistantResponse = log.turns[i+1].content;
          
          processedLogs.push(`User: ${userMessage}\n\nAssistant: ${assistantResponse}`);
          processedMetadata.push({
            id: `${log._id}-${i}`,
            userId: String(log.userId),
            timestamp: log.turns[i].createdAt || log.createdAt
          });
        }
      }
    }
    
    if (processedLogs.length === 0) {
      return await MemoryVectorStore.fromTexts([], [], embeddings);
    }
    
    return await MemoryVectorStore.fromTexts(processedLogs, processedMetadata, embeddings);
  })();
  
  return chatLogStorePromise;
}

/**
 * Build or retrieve user profile vector store
 */
async function getUserProfileStore() {
  if (userProfileStorePromise) return userProfileStorePromise;
  
  userProfileStorePromise = (async () => {
    const embeddings = getEmbeddings();
    const docs = await User.find().lean();
    
    if (docs.length === 0) {
      return await MemoryVectorStore.fromTexts([], [], embeddings);
    }
    
    const texts = docs.map(d => {
      const interests = d.conversationContext?.interests?.join(', ') || '';
      const lastTopics = d.conversationContext?.lastTopics?.join(', ') || '';
      
      return `User: ${d.name || d.registrationNumber}\n\nDepartment: ${d.department || 'Not specified'}\nCourse: ${d.course || 'Not specified'}\nYear: ${d.year || 'Not specified'}\nInterests: ${interests}\nRecent Topics: ${lastTopics}\nCurrent Semester: ${d.conversationContext?.currentSemester || 'Not specified'}\nAcademic Year: ${d.conversationContext?.academicYear || 'Not specified'}`;
    });
    
    const metadatas = docs.map(d => ({
      id: String(d._id),
      registrationNumber: d.registrationNumber,
      department: d.department,
      course: d.course,
      year: d.year
    }));
    
    return await MemoryVectorStore.fromTexts(texts, metadatas, embeddings);
  })();
  
  return userProfileStorePromise;
}

/**
 * Process multilingual queries by detecting language, translating, and training
 * @param {string} query - The user query
 * @param {string} userId - User ID for training
 * @returns {Promise<Object>} - Processed query with translations and training data
 */
async function processMultilingualQuery(query, userId = null) {
  try {
    // Use Gemini AI for enhanced query understanding
    const geminiAnalysis = await detectAndEnhanceQuery(query);
    const detectedLang = geminiAnalysis.language || await detectLanguage(query);
    
    console.log(`Detected language: ${detectedLang} for query: ${query}`);
    console.log(`Gemini analysis:`, geminiAnalysis);
    
    const supportedLanguages = ['en', 'hi', 'te', 'gu', 'ta', 'kn'];
    let translations = {};
    let isNonEnglish = false;
    
    // Generate translations for all supported languages
    for (const targetLang of supportedLanguages) {
      if (targetLang === detectedLang) {
        translations[targetLang] = query;
      } else {
        try {
          const translated = await translateText(query, detectedLang, targetLang);
          translations[targetLang] = translated;
          console.log(`Translated ${detectedLang} to ${targetLang}: ${translated}`);
        } catch (translateError) {
          console.log(`Translation ${detectedLang} to ${targetLang} failed:`, translateError.message);
          translations[targetLang] = query; // Fallback to original
        }
      }
    }
    
    // Mark if query is in a non-English language
    isNonEnglish = detectedLang !== 'en';
    
    // Train on the words if user is provided and query is non-English
    if (userId && isNonEnglish) {
      try {
        await trainOnMultilingualWords(query, detectedLang, userId);
      } catch (trainingError) {
        console.error('Training error:', trainingError.message);
      }
    }
    
    return {
      originalQuery: query,
      detectedLang,
      isNonEnglish,
      translations,
      englishQuery: translations.en || query,
      targetLanguageQuery: translations[detectedLang] || query,
      geminiAnalysis // Include Gemini analysis for enhanced understanding
    };
  } catch (error) {
    console.error('Error processing multilingual query:', error);
    return {
      originalQuery: query,
      detectedLang: 'en',
      isNonEnglish: false,
      translations: { en: query },
      englishQuery: query,
      targetLanguageQuery: query,
      geminiAnalysis: {
        intent: "General inquiry",
        entities: [],
        language: "en",
        searchTerms: [query],
        category: "general"
      }
    };
  }
}

/**
 * Train on multilingual words by creating knowledge items
 * @param {string} text - Text to train on
 * @param {string} language - Language code
 * @param {string} userId - User ID
 */
async function trainOnMultilingualWords(text, language, userId) {
  try {
    // Language-specific Unicode ranges
    const languageRanges = {
      'hi': /[\u0900-\u097F]/,
      'te': /[\u0C00-\u0C7F]/,
      'gu': /[\u0A80-\u0AFF]/,
      'ta': /[\u0B80-\u0BFF]/,
      'kn': /[\u0C80-\u0CFF]/
    };
    
    const languageNames = {
      'hi': 'Hindi',
      'te': 'Telugu', 
      'gu': 'Gujarati',
      'ta': 'Tamil',
      'kn': 'Kannada'
    };
    
    const range = languageRanges[language];
    if (!range) return;
    
    // Extract words in the specific language
    const words = text.split(/\s+/).filter(word => 
      word.length > 2 && range.test(word)
    );
    
    if (words.length > 0) {
      // Create a knowledge item for language learning
      const trainingData = {
        title: `${languageNames[language]} Language Training - ${words.slice(0, 3).join(' ')}`,
        content: `${languageNames[language]} words learned: ${words.join(', ')}`,
        type: 'language_training',
        source: 'user_input',
        metadata: {
          language: language,
          words: words,
          userId: userId,
          timestamp: new Date()
        }
      };
      
      // Store in knowledge base
      const knowledgeItem = new KnowledgeItem(trainingData);
      await knowledgeItem.save();
      console.log(`Trained on ${languageNames[language]} words: ${words.join(', ')}`);
    }
  } catch (error) {
    console.error(`Error training on ${language} words:`, error);
  }
}

/**
 * Retrieve relevant knowledge from all sources
 * @param {string} query - The user query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} - Combined relevant knowledge
 */
async function retrieveRelevantKnowledge(query, options = {}) {
  const {
    userId = null,
    maxKnowledgeItems = 3,
    maxFAQs = 2,
    maxEvents = 2,
    maxChatLogs = 2,
    maxUserProfiles = 1,
    includeWebSearch = true,
    maxWebResults = 3,
    includeURLs = true,
    maxURLs = 2,
    targetLang = null
  } = options;
  
  // Process multilingual query first
  const queryProcessing = await processMultilingualQuery(query, userId);
  const searchQuery = queryProcessing.englishQuery; // Use English for better search results
  
  // Run searches in parallel for efficiency using the processed English query
  // Note: We prioritize FAQs first, then other sources
  const [
    faqResults,
    knowledgeResults,
    eventResults,
    chatLogResults,
    userProfileResults,
    webSearchResults
  ] = await Promise.all([
    searchFAQs(searchQuery, maxFAQs), // PRIORITY 1: FAQs first
    searchKnowledgeItems(searchQuery, maxKnowledgeItems), // PRIORITY 2: Knowledge items
    searchEvents(searchQuery, maxEvents), // PRIORITY 3: Events
    searchChatLogs(searchQuery, userId, maxChatLogs), // PRIORITY 4: Chat logs
    searchUserProfiles(searchQuery, userId, maxUserProfiles), // PRIORITY 5: User profiles
    includeWebSearch ? performWebSearch(searchQuery, maxWebResults) : Promise.resolve([]) // PRIORITY 6: Web search (last resort)
  ]);
  
  // Web search fallback: If no results found in primary sources, try web search even if not initially requested
  let finalWebSearchResults = webSearchResults;
  if (includeWebSearch === false && knowledgeResults.length === 0 && faqResults.length === 0 && eventResults.length === 0) {
    console.log('No results found in knowledge base, trying web search fallback for:', searchQuery);
    try {
      finalWebSearchResults = await performWebSearch(searchQuery, maxWebResults);
    } catch (error) {
      console.error('Web search fallback error:', error);
      finalWebSearchResults = [];
    }
  }
  
  // Process URLs if requested
  let urlResults = [];
  if (includeURLs && finalWebSearchResults.length > 0) {
    const urlPromises = finalWebSearchResults
      .slice(0, maxURLs)
      .map(result => processURL(result.url));
    
    urlResults = (await Promise.allSettled(urlPromises))
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value)
      .filter(Boolean);
  }
  
  // Translate results if target language is specified
  if (targetLang && targetLang !== 'en') {
    const { safeTranslate } = require('./translate');
    
    // Translate knowledge items
    if (knowledgeResults.length > 0) {
      await Promise.all(knowledgeResults.map(async (item) => {
        if (item.content) {
          item.content = await safeTranslate(item.content, 'en', targetLang);
        }
        if (item.title) {
          item.title = await safeTranslate(item.title, 'en', targetLang);
        }
      }));
    }
    
    // Translate FAQs
    if (faqResults.length > 0) {
      await Promise.all(faqResults.map(async (faq) => {
        if (faq.question) {
          faq.question = await safeTranslate(faq.question, 'en', targetLang);
        }
        if (faq.answer) {
          faq.answer = await safeTranslate(faq.answer, 'en', targetLang);
        }
      }));
    }
    
    // Translate events
    if (eventResults.length > 0) {
      await Promise.all(eventResults.map(async (event) => {
        if (event.title) {
          event.title = await safeTranslate(event.title, 'en', targetLang);
        }
        if (event.description) {
          event.description = await safeTranslate(event.description, 'en', targetLang);
        }
      }));
    }
    
    // Translate URL contents
    if (urlResults.length > 0) {
      await Promise.all(urlResults.map(async (url) => {
        if (url.content) {
          url.content = await safeTranslate(url.content, 'en', targetLang);
        }
        if (url.title) {
          url.title = await safeTranslate(url.title, 'en', targetLang);
        }
      }));
    }
  }
  
  // Generate enhanced multilingual response using Gemini AI
  let enhancedResponse = null;
  try {
    const allContextData = [
      ...knowledgeResults,
      ...faqResults,
      ...eventResults,
      ...chatLogResults,
      ...userProfileResults,
      ...finalWebSearchResults,
      ...urlResults
    ];
    
    enhancedResponse = await generateMultilingualResponse(
      queryProcessing.originalQuery,
      queryProcessing.detectedLang,
      knowledgeResults,
      faqResults,
      eventResults
    );
  } catch (error) {
    console.error('Enhanced response generation failed:', error);
  }

  // Combine all results in priority order
  return {
    faqs: faqResults, // PRIORITY 1: FAQs first
    knowledgeItems: knowledgeResults, // PRIORITY 2: Knowledge items
    events: eventResults, // PRIORITY 3: Events
    chatLogs: chatLogResults, // PRIORITY 4: Chat logs
    userProfiles: userProfileResults, // PRIORITY 5: User profiles
    webSearchResults: finalWebSearchResults, // PRIORITY 6: Web search (last resort)
    urlContents: urlResults,
    queryProcessing: queryProcessing, // Include query processing information
    enhancedResponse: enhancedResponse // Include Gemini AI enhanced response
  };
}

/**
 * Search knowledge items
 */
async function searchKnowledgeItems(query, maxResults = 3) {
  try {
    const store = await getKnowledgeStore();
    const results = await store.similaritySearch(query, maxResults);
    
    const ids = results.map(r => r.metadata?.id).filter(Boolean);
    if (ids.length === 0) return [];
    
    const items = await KnowledgeItem.find({ _id: { $in: ids } }).lean();
    const byId = new Map(items.map(item => [String(item._id), item]));
    
    return results
      .map(r => byId.get(r.metadata.id))
      .filter(Boolean);
  } catch (error) {
    console.error('Error searching knowledge items:', error);
    return [];
  }
}

/**
 * Search FAQs with enhanced multilingual support
 */
async function searchFAQs(query, maxResults = 2) {
  try {
    const store = await getFAQStore();
    const supportedLanguages = ['en', 'hi', 'te', 'gu', 'ta', 'kn'];
    
    // Search with the provided query
    let results = await store.similaritySearch(query, maxResults);
    
    // If no results found, try searching with translations
    if (results.length === 0) {
      try {
        const detectedLang = await detectLanguage(query);
        
        // Try searching with English translation if not already English
        if (detectedLang !== 'en') {
          const englishQuery = await translateText(query, detectedLang, 'en');
          results = await store.similaritySearch(englishQuery, maxResults);
        }
        
        // If still no results, try searching with other language translations
        if (results.length === 0) {
          for (const targetLang of supportedLanguages) {
            if (targetLang !== detectedLang && targetLang !== 'en') {
              try {
                const translatedQuery = await translateText(query, detectedLang, targetLang);
                const translatedResults = await store.similaritySearch(translatedQuery, Math.floor(maxResults / 2));
                results = [...results, ...translatedResults].slice(0, maxResults);
                if (results.length >= maxResults) break;
              } catch (translateError) {
                console.log(`Translation ${detectedLang} to ${targetLang} for FAQ search failed:`, translateError.message);
              }
            }
          }
        }
      } catch (translateError) {
        console.log('Translation for FAQ search failed:', translateError.message);
      }
    }
    
    const ids = results.map(r => r.metadata?.id).filter(Boolean);
    if (ids.length === 0) return [];
    
    const faqs = await FAQ.find({ _id: { $in: ids } }).lean();
    const byId = new Map(faqs.map(faq => [String(faq._id), faq]));
    
    return results
      .map(r => byId.get(r.metadata.id))
      .filter(Boolean);
  } catch (error) {
    console.error('Error searching FAQs:', error);
    return [];
  }
}

/**
 * Search events
 */
async function searchEvents(query, maxResults = 2) {
  try {
    const store = await getEventStore();
    const results = await store.similaritySearch(query, maxResults);
    
    const ids = results.map(r => r.metadata?.id).filter(Boolean);
    if (ids.length === 0) return [];
    
    const events = await Event.find({ _id: { $in: ids } }).lean();
    const byId = new Map(events.map(event => [String(event._id), event]));
    
    return results
      .map(r => byId.get(r.metadata.id))
      .filter(Boolean);
  } catch (error) {
    console.error('Error searching events:', error);
    return [];
  }
}

/**
 * Search chat logs
 */
async function searchChatLogs(query, userId = null, maxResults = 2) {
  try {
    const store = await getChatLogStore();
    const results = await store.similaritySearch(query, maxResults * 2); // Get more to filter
    
    // If userId is provided, prioritize that user's chat logs
    let filteredResults = results;
    if (userId) {
      const userResults = results.filter(r => r.metadata?.userId === String(userId));
      const otherResults = results.filter(r => r.metadata?.userId !== String(userId));
      
      filteredResults = [...userResults, ...otherResults].slice(0, maxResults);
    } else {
      filteredResults = results.slice(0, maxResults);
    }
    
    return filteredResults.map(r => ({
      content: r.pageContent,
      userId: r.metadata?.userId,
      timestamp: r.metadata?.timestamp
    }));
  } catch (error) {
    console.error('Error searching chat logs:', error);
    return [];
  }
}

/**
 * Search user profiles
 */
async function searchUserProfiles(query, currentUserId = null, maxResults = 1) {
  try {
    const store = await getUserProfileStore();
    const results = await store.similaritySearch(query, maxResults + 1); // Get one extra to filter
    
    // If currentUserId is provided, ensure it's included and prioritized
    let filteredResults = results;
    if (currentUserId) {
      const currentUserResult = results.find(r => r.metadata?.id === String(currentUserId));
      const otherResults = results.filter(r => r.metadata?.id !== String(currentUserId));
      
      if (currentUserResult) {
        filteredResults = [currentUserResult, ...otherResults].slice(0, maxResults);
      } else {
        // Try to fetch current user directly if not in results
        try {
          const currentUser = await User.findById(currentUserId).lean();
          if (currentUser) {
            const interests = currentUser.conversationContext?.interests?.join(', ') || '';
            const lastTopics = currentUser.conversationContext?.lastTopics?.join(', ') || '';
            
            const userProfile = {
              pageContent: `User: ${currentUser.name || currentUser.registrationNumber}\n\nDepartment: ${currentUser.department || 'Not specified'}\nCourse: ${currentUser.course || 'Not specified'}\nYear: ${currentUser.year || 'Not specified'}\nInterests: ${interests}\nRecent Topics: ${lastTopics}\nCurrent Semester: ${currentUser.conversationContext?.currentSemester || 'Not specified'}\nAcademic Year: ${currentUser.conversationContext?.academicYear || 'Not specified'}`,
              metadata: {
                id: String(currentUser._id),
                registrationNumber: currentUser.registrationNumber,
                department: currentUser.department,
                course: currentUser.course,
                year: currentUser.year
              }
            };
            
            filteredResults = [userProfile, ...otherResults].slice(0, maxResults);
          } else {
            filteredResults = otherResults.slice(0, maxResults);
          }
        } catch (error) {
          console.error('Error fetching current user:', error);
          filteredResults = otherResults.slice(0, maxResults);
        }
      }
    } else {
      filteredResults = results.slice(0, maxResults);
    }
    
    return filteredResults.map(r => ({
      content: r.pageContent,
      userId: r.metadata?.id,
      registrationNumber: r.metadata?.registrationNumber,
      department: r.metadata?.department,
      course: r.metadata?.course,
      year: r.metadata?.year
    }));
  } catch (error) {
    console.error('Error searching user profiles:', error);
    return [];
  }
}

/**
 * Perform web search
 */
async function performWebSearch(query, maxResults = 3) {
  try {
    return await searchWeb(query, maxResults);
  } catch (error) {
    console.error('Error performing web search:', error);
    return [];
  }
}

/**
 * Process URL to extract content
 */
async function processURL(url) {
  try {
    const extractedData = await extractFromUrl(url);
    if (!extractedData || !extractedData.rawText) return null;
    
    return {
      url,
      content: extractedData.rawText.substring(0, 1000), // Limit content length
      sections: extractedData.sections?.slice(0, 3) || [] // Limit sections
    };
  } catch (error) {
    console.error(`Error processing URL ${url}:`, error);
    return null;
  }
}

/**
 * Reset all vector stores to force rebuild
 */
function resetVectorStores() {
  knowledgeStorePromise = null;
  faqStorePromise = null;
  eventStorePromise = null;
  chatLogStorePromise = null;
  userProfileStorePromise = null;
}

/**
 * Update a specific vector store when new data is added
 * @param {string} storeType - The type of store to update ('knowledge', 'faq', 'event', 'chatLog', 'userProfile')
 */
function updateVectorStore(storeType) {
  switch (storeType) {
    case 'knowledge':
      knowledgeStorePromise = null;
      break;
    case 'faq':
      faqStorePromise = null;
      break;
    case 'event':
      eventStorePromise = null;
      break;
    case 'chatLog':
      chatLogStorePromise = null;
      break;
    case 'userProfile':
      userProfileStorePromise = null;
      break;
    default:
      // Reset all stores if type not specified
      resetVectorStores();
  }
}

module.exports = {
  retrieveRelevantKnowledge,
  searchKnowledgeItems,
  searchFAQs,
  searchEvents,
  searchChatLogs,
  searchUserProfiles,
  performWebSearch,
  processURL,
  resetVectorStores,
  updateVectorStore,
  processMultilingualQuery,
  trainOnMultilingualWords
};