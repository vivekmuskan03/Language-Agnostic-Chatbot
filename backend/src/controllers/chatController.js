const ChatLog = require('../models/ChatLog');
const KnowledgeItem = require('../models/KnowledgeItem');
const FAQ = require('../models/FAQ');
const User = require('../models/User');
const UserSession = require('../models/UserSession');
const ConcerningConversation = require('../models/ConcerningConversation');
const File = require('../models/File');
const { generateChatResponse, embedText, embedMany } = require('../services/gemini');
const { detectLanguage, translateText } = require('../services/translate');
const { searchAcademicInfo, searchCurrentInfo } = require('../services/webSearch');
const Todo = require('../models/Todo');
const Event = require('../models/Event');
const { retrieveRelevantKnowledge } = require('../services/learningIntegration');
const { handlePersonalQuestion } = require('../services/personalQuestionHandler');

function parseTodosFromText(text) {
  const t = String(text || '');

  // Define the specific course codes we want to filter for
  const courseCodes = ['CD', 'CN', 'DMT'];

  // Check if the text mentions any of our specific course codes
  const mentionedCourseCodes = [];
  for (const code of courseCodes) {
    if (new RegExp('\\b' + code + '\\b', 'i').test(t)) {
      mentionedCourseCodes.push(code);
    }
  }

  const hasCourseKeywords = mentionedCourseCodes.length > 0;

  // Prefer quoted items: "item1", "item2"
  const quoted = Array.from(t.matchAll(/"([^"]{1,120})"/g)).map(m => m[1].trim());
  if (quoted.length > 0) {
    // Filter for specific todo items if they are mentioned
    if (hasCourseKeywords) {
      const regex = new RegExp('^\\s*(' + mentionedCourseCodes.join('|') + ')\\s*$', 'i');
      return quoted.filter(s => s.length > 0 && regex.test(s));
    }
    return quoted.filter(s => s.length > 0);
  }

  // After keywords like homework:, tasks:
  const after = t.split(/homework\s*[:\-]|tasks?\s*[:\-]|to-?do\s*[:\-]|assignments?\s*[:\-]/i);
  const payload = after.length > 1 ? after.slice(1).join(' ') : t;
  // Split by commas/newlines/and
  const items = payload
    .split(/\band\b|,|\n|;|\u2022|\-/i)
    .map(s => s.trim())
    .filter(s => s.length >= 2 && s.length <= 140);

  // Filter for specific todo items if they are mentioned
  if (hasCourseKeywords) {
    const regex = new RegExp('^\\s*(' + mentionedCourseCodes.join('|') + ')\\s*$', 'i');
    return items.filter(s => regex.test(s));
  }

  return items;
}

const SUPPORTED_LANGS = ['en', 'hi', 'te', 'gu', 'ta', 'kn'];

function mapDetected(lang) {
  // Map locale codes from LibreTranslate to required ones if needed
  const map = { en: 'en', hi: 'hi', te: 'te', gu: 'gu', ta: 'ta', kn: 'kn' };
  return map[lang] || 'en';
}

function normalizeLanguage(input) {
  if (!input) return null;
  const value = String(input).trim().toLowerCase();
  const map = {
    'en': 'en', 'english': 'en',
    'hi': 'hi', 'hindi': 'hi',
    'te': 'te', 'telugu': 'te',
    'gu': 'gu', 'gujarati': 'gu',
    'ta': 'ta', 'tamil': 'ta',
    'kn': 'kn', 'kannada': 'kn'
  };
  return map[value] || null;
}

function languageName(code) {
  const names = { en: 'English', hi: 'Hindi', te: 'Telugu', gu: 'Gujarati', ta: 'Tamil', kn: 'Kannada' };
  return names[code] || code;
}

// Allow limited, safe real-life intents useful for students
function isRealLifeIntent(message) {
  const text = String(message || '').toLowerCase().trim();
  const intents = [
    { pattern: /(what'?s|what is).*time|time now|current time/, type: 'time' },
    { pattern: /(what'?s|what is).*date|today'?s date|current date/, type: 'date' },
    { pattern: /(study tips|how to study|focus better|time management|motivation)/, type: 'study_tips' }
  ];
  for (const intent of intents) {
    if (intent.pattern.test(text)) return intent.type;
  }
  return null;
}
// Detect timetable/schedule intent
function isScheduleIntent(text) {
  const t = String(text || '').toLowerCase();
  return /(what'?s|what is|show|tell).*\b(schedule|timetable|routine)\b.*(today|now)|\b(today'?s|today)\b.*\b(schedule|timetable|routine)\b/.test(t);
}

// Extract lines for a given weekday from timetable text (robust to tables and abbreviations)
function extractDaySection(text, weekday) {
  if (!text) return [];
  const rawLines = String(text).split(/\r?\n/);
  const lines = rawLines.map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);

  const full = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const abbr = ['sun','mon','tue','tues','wed','thu','thur','thurs','fri','sat'];
  const targetFull = String(weekday || '').toLowerCase();
  const targetAbbr = targetFull.slice(0,3);

  const dayTokenRe = /\b(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;
  const isDayOnly = (s) => {
    const t = s.toLowerCase().replace(/:$/, '');
    return full.includes(t) || abbr.includes(t);
  };

  // 1) Simple block form: a line that is only the day name, followed by sessions until next day header
  let collecting = false;
  const out1 = [];
  for (const line of lines) {
    const l = line.toLowerCase();
    if (isDayOnly(line)) {
      collecting = l.includes(targetFull) || l.startsWith(targetAbbr);
      continue;
    }
    if (collecting) {
      if (isDayOnly(line) || dayTokenRe.test(l)) break;
      out1.push(line);
    }
  }
  if (out1.length) return out1;

  // 2) Table header form: a line containing multiple day tokens (e.g., "Time Mon Tue Wed Thu Fri Sat")
  //    We pick the column for today's day and read cells from subsequent rows.
  const headerIdx = lines.findIndex(l => (l.match(dayTokenRe) || []).length >= 1 && /(mon|tue|wed|thu|fri|sat|sun)/i.test(l) && l.replace(/[^a-z]/gi,'').length > 9);
  if (headerIdx !== -1) {
    const header = lines[headerIdx];
    // Split by 2+ spaces, tabs, or pipe
    const cells = header.split(/\s{2,}|\t+|\s*\|\s*/).map(c => c.trim()).filter(Boolean);
    // Find index of today's token among cells
    let dayCol = -1;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i].toLowerCase();
      if (c === targetFull || c === targetAbbr || c.startsWith(targetAbbr)) { dayCol = i; break; }
      if (c.includes(targetFull)) { dayCol = i; break; }
    }
    if (dayCol !== -1) {
      const picked = [];
      for (let r = headerIdx + 1; r < Math.min(lines.length, headerIdx + 40); r++) {
        const row = lines[r];
        if (!row || dayTokenRe.test(row)) break;
        const rcells = row.split(/\s{2,}|\t+|\s*\|\s*/).map(c => c.trim());
        if (rcells.length <= dayCol) continue;
        const cell = rcells[dayCol];
        if (cell && cell.length > 1) picked.push(cell);
      }
      if (picked.length) return picked;
    }
  }

  // 3) Fallback: any line containing the day (full or abbr). Remove the day token and return the rest.
  const anyTokenRe = new RegExp(`(^|.*?)(\\b${targetFull}\\b|\\b${targetAbbr}\\b)(.*$)`, 'i');
  const out3 = lines
    .filter(l => anyTokenRe.test(l))
    .map(l => l.replace(new RegExp(`\\b${targetFull}\\b|\\b${targetAbbr}\\b`, 'ig'), '').trim())
    .filter(Boolean);
  if (out3.length) return out3;

  // 4) Last resort: try to return time-like lines for today by looking around day mentions in the raw text
  const joined = rawLines.join('\n');
  const idx = joined.search(new RegExp(`\\b${targetFull}\\b|\\b${targetAbbr}\\b`, 'i'));
  if (idx !== -1) {
    const window = joined.slice(Math.max(0, idx - 500), Math.min(joined.length, idx + 800));
    const maybe = window.split(/\r?\n/).map(s => s.trim()).filter(s => /\b(\d{1,2}[:\.][0-5]\d|period|slot)\b/i.test(s));
    if (maybe.length) return maybe.slice(0, 12);
  }

  return [];
}

async function getTodayScheduleForUser(userId) {
  const file = await File.findOne({ uploadedBy: String(userId), category: 'timetable', status: 'processed' }).sort({ updatedAt: -1 }).lean();
  if (!file || !file.extractedText) return null;
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const lines = extractDaySection(file.extractedText, weekday).filter(Boolean);
  if (!lines.length) return null;
  return { weekday, lines };
}


// Function to detect concerning content (suicide, self-harm, etc.)
function detectConcerningContent(message) {
  const text = String(message || '').toLowerCase().trim();

  // Suicide-related keywords and phrases
  const suicideKeywords = [
    'kill myself', 'end my life', 'suicide', 'suicidal', 'want to die', 'not worth living',
    'better off dead', 'end it all', 'take my life', 'hurt myself', 'self harm',
    'cut myself', 'overdose', 'jump off', 'hang myself', 'no point living',
    'life is meaningless', 'nothing matters', 'can\'t go on', 'give up',
    'hopeless', 'worthless', 'burden', 'everyone would be better without me'
  ];

  // Depression and mental health keywords
  const depressionKeywords = [
    'depressed', 'depression', 'sad all the time', 'crying', 'hopeless',
    'empty', 'numb', 'can\'t feel', 'lost', 'alone', 'isolated',
    'anxiety', 'panic', 'overwhelmed', 'stressed', 'can\'t cope',
    'mental health', 'therapy', 'counseling', 'medication'
  ];

  // Academic stress keywords
  const academicStressKeywords = [
    'failing', 'can\'t pass', 'academic probation', 'expelled', 'drop out',
    'parents will kill me', 'disappointed', 'shame', 'embarrassed',
    'waste of money', 'waste of time', 'not smart enough', 'stupid'
  ];

  const foundKeywords = [];
  let concernType = 'other';
  let severity = 'low';

  // Check for suicide-related content (highest priority)
  for (const keyword of suicideKeywords) {
    if (text.includes(keyword)) {
      foundKeywords.push(keyword);
      concernType = 'suicide';
      severity = 'critical';
      break;
    }
  }

  // Check for self-harm if no suicide content found
  if (concernType === 'other') {
    const selfHarmKeywords = ['cut myself', 'hurt myself', 'self harm', 'burn myself'];
    for (const keyword of selfHarmKeywords) {
      if (text.includes(keyword)) {
        foundKeywords.push(keyword);
        concernType = 'self_harm';
        severity = 'high';
        break;
      }
    }
  }

  // Check for depression/anxiety if no higher priority content found
  if (concernType === 'other') {
    for (const keyword of depressionKeywords) {
      if (text.includes(keyword)) {
        foundKeywords.push(keyword);
        concernType = 'depression';
        severity = 'medium';
        break;
      }
    }
  }

  // Check for academic stress if no higher priority content found
  if (concernType === 'other') {
    for (const keyword of academicStressKeywords) {
      if (text.includes(keyword)) {
        foundKeywords.push(keyword);
        concernType = 'academic_stress';
        severity = 'medium';
        break;
      }
    }
  }

  // If multiple keywords found, increase severity
  if (foundKeywords.length > 1) {
    if (severity === 'low') severity = 'medium';
    else if (severity === 'medium') severity = 'high';
  }

  return foundKeywords.length > 0 ? {
    detected: true,
    concernType,
    severity,
    keywords: foundKeywords
  } : { detected: false };
}

async function translateViaModel(text, fromCode, toCode) {
  const from = languageName(fromCode);
  const to = languageName(toCode);
  const prompt = `Translate the following text from ${from} to ${to}. Preserve numbers, dates, times (e.g., 8:00 A.M. to 10:00 P.M.), names, and acronyms exactly. Do not add extra commentary.

Text:
${text}`;
  const result = await generateChatResponse([
    { role: 'user', content: prompt }
  ]);
  return result || text;
}

async function safeTranslate(text, fromCode, toCode) {
  // Prefer model-based translation (Gemini) for speed and stability
  if (!text || fromCode === toCode) return text;
  try {
    const modelResult = await translateViaModel(text, fromCode, toCode);
    if (typeof modelResult === 'string' && modelResult.trim()) {
      return modelResult;
    }
  } catch (_) {}

  // Fallback to external translation services only if model fails
  try {
    const svcResult = await translateText(text, fromCode, toCode);
    return svcResult;
  } catch (_) {
    return text;
  }
}

async function semanticSearchEmbedding(queryEmbedding) {
  // naive similarity search in Mongo using cosine similarity computed in app layer
  const items = await KnowledgeItem.find({ embedding: { $exists: true, $ne: [] } }).limit(200);
  function cosine(a, b) {
    const dot = a.reduce((acc, v, i) => acc + v * (b[i] || 0), 0);
    const na = Math.sqrt(a.reduce((acc, v) => acc + v * v, 0));
    const nb = Math.sqrt(b.reduce((acc, v) => acc + v * v, 0));
    return na && nb ? dot / (na * nb) : 0;
  }
  let best = { score: 0, item: null };
  for (const item of items) {
    const score = cosine(queryEmbedding, item.embedding);
    if (score > best.score) best = { score, item };
  }
  return best;
}

async function chat(req, res) {
  try {
    const { message, sessionId, language = 'en' } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    // Get or create user session for persistent memory
    const userSession = await UserSession.findOrCreateActiveSession(
      userId,
      sessionId || 'default',
      {
        deviceInfo: req.headers['user-agent'] || 'Unknown',
        ipAddress: req.ip || 'Unknown'
      }
    );

    // Get user information
    const userInfo = await User.findById(userId);
    if (!userInfo) return res.status(404).json({ error: 'User not found' });

    // Resolve preferred and detected languages
    const preferredLang = normalizeLanguage(language || userInfo.preferences?.defaultLanguage || userInfo.languagePreference);
    const detectedLang = mapDetected(await detectLanguage(message));
    let sourceLang = SUPPORTED_LANGS.includes(detectedLang) ? detectedLang : 'en';
    // If message is ASCII and detected as English, bias to preferred language for romanized inputs
    if (/^[\x00-\x7F]+$/.test(message) && sourceLang === 'en' && SUPPORTED_LANGS.includes(preferredLang) && preferredLang !== 'en') {
      sourceLang = preferredLang;
    }
    const targetLang = SUPPORTED_LANGS.includes(preferredLang) ? preferredLang : sourceLang;

    // Translate message to English for processing
    let messageEn;
    try {
      messageEn = await safeTranslate(message, sourceLang, 'en');
    } catch (error) {
      console.log('Translation error, using original message:', error.message);
      messageEn = message; // Use original message if translation fails
    }
    
    // Define student data lookup variables
    let isAskingForStudentInfo = false;
    let student = null;

    // Check for concerning content first (highest priority)
    const concernDetection = detectConcerningContent(messageEn);


    // Handle timetable/schedule queries like "what's my schedule today"
    if (isScheduleIntent(messageEn)) {
      const schedule = await getTodayScheduleForUser(userId);
      let answer;
      if (schedule) {
        const list = schedule.lines.slice(0, 20).map((l, i) => `${i + 1}. ${l}`).join('\n');
        const msgEn = `Your schedule for ${schedule.weekday} is:\n\n${list}`;
        try { answer = await safeTranslate(msgEn, 'en', targetLang); } catch (_) { answer = msgEn; }
      } else {
        const msgEn = `I could not find a timetable for you yet. Please upload your timetable (PDF/DOCX/image) using the Timetable section in the sidebar, then ask again.`;
        try { answer = await safeTranslate(msgEn, 'en', targetLang); } catch (_) { answer = msgEn; }
      }
      await userSession.addConversationTurn('user', message, targetLang);
      await userSession.addConversationTurn('assistant', answer, targetLang);
      return res.json({ answer, source: 'timetable' });
    }

    // If no student data found, continue with hierarchical search
    if (isAskingForStudentInfo && !student) {
      // If student info was requested but not found, inform the user
      let notFoundMsg = `I couldn't find your student details. Please make sure your registration number is correct or contact the administrator.`;
      let answer = await safeTranslate(notFoundMsg, 'en', targetLang);
      
      // Add to session history
      await userSession.addConversationTurn('user', message, targetLang);
      await userSession.addConversationTurn('assistant', answer, targetLang);
      
      return res.json({ answer, source: 'student_data_not_found' });
    }

    // Create hierarchical search flow
    // First check for student data lookup, then proceed to other sources
    
    // Check for basic greetings and conversational patterns (expanded, multi-lingual & colloquial)
    const greetingPatterns = [
      /^(hi|hello|hey|yo|hola|namaste|namaskar|vanakkam|salaam|good (morning|afternoon|evening|night)|gm|gn)$/i,
      /^(how are you|how r u|hru|what'?s up|wass?up|sup|how'?s it going|how (is|are) it going|how are things|how you doing)$/i,
      /^(thank you|thanks|thx|ty|bye|goodbye|see you|take care|cya)$/i,
      /^(yes|no|ok|okay|sure|alright|k|kk|fine|great|cool)$/i
    ];

    const isGreeting = greetingPatterns.some(pattern => pattern.test(messageEn.trim()));

    // Check if the message is a personal question
    const personalQuestionPatterns = [
      /my (course|branch|department|semester|year|schedule|timetable|grades|marks|attendance)/i,
      /when is my (class|exam|test|assignment|project) due/i,
      /how do i (register|enroll|apply) for/i,
      /where is my (classroom|lab|faculty|mentor)/i,
      /who is my (teacher|professor|mentor|advisor)/i,
      /what are my (grades|marks|attendance|results)/i,
      /when is my (exam|test|quiz|viva)/i,
      /how to (apply|register|enroll) in/i,
      /(i need|i want) (information|details) about my/i,
      /(show|tell) me my/i,
      /(what|when|where|who|how) (is|are) my/i
    ];

    const isPersonalQuestion = personalQuestionPatterns.some(pattern => pattern.test(messageEn));
    const isUniversityRelated = await checkUniversityRelevance(messageEn);

    // Special handling for course-related questions
    const courseQuestionPatterns = [
      /do you know my course/i,
      /what is my course/i,
      /my course/i,
      /course details/i,
      /do you know my branch/i,
      /what is my branch/i,
      /my branch/i,
      /branch details/i,
      /which branch/i,
      /enrolled in/i
    ];

    const isCourseQuestion = courseQuestionPatterns.some(pattern => pattern.test(messageEn));
    const realLifeIntent = isRealLifeIntent(messageEn);
    const isTodoIntent = /\b(homework|todo|to-?do|task|tasks|assignments?)\b/i.test(messageEn);

    // Handle greetings and basic conversation
    if (isGreeting) {
      let answer;
      const userName = userInfo.name || 'Student';
      const department = userSession.userContext.department || '';
      const departmentText = department ? ` from the ${department} department` : '';

      if (/^(hi|hello|hey|good morning|good afternoon|good evening|namaste|namaskar)$/i.test(messageEn.trim())) {
        try {
          answer = await safeTranslate(
            `Hello ${userName}${departmentText}! 👋 I'm Vignan University's AI Assistant. I'm here to help you with anything related to your university experience - academics, campus life, admissions, or any questions you might have. How can I assist you today?`,
            'en',
            targetLang
          );
        } catch (error) {
          answer = `Hello ${userName}${departmentText}! 👋 I'm Vignan University's AI Assistant. I'm here to help you with anything related to your university experience - academics, campus life, admissions, or any questions you might have. How can I assist you today?`;
        }
      } else if (/^(how are you|how do you do|what's up|how's it going)$/i.test(messageEn.trim())) {
        try {
          answer = await safeTranslate(
            `I'm doing great, thank you for asking! 😊 I'm here and ready to help you with any university-related questions or concerns you might have. What would you like to know about Vignan University today?`,
            'en',
            targetLang
          );
        } catch (error) {
          answer = `I'm doing great, thank you for asking! 😊 I'm here and ready to help you with any university-related questions or concerns you might have. What would you like to know about Vignan University today?`;
        }
      } else if (/^(thank you|thanks)$/i.test(messageEn.trim())) {
        try {
          answer = await safeTranslate(
            `You're very welcome! 😊 I'm always happy to help. Is there anything else about Vignan University or your studies that you'd like to know?`,
            'en',
            targetLang
          );
        } catch (error) {
          answer = `You're very welcome! 😊 I'm always happy to help. Is there anything else about Vignan University or your studies that you'd like to know?`;
        }
      } else if (/^(bye|goodbye|see you|take care)$/i.test(messageEn.trim())) {
        try {
          answer = await safeTranslate(
            `Goodbye ${userName}! 👋 Take care and feel free to come back anytime if you have any questions about Vignan University. Have a great day!`,
            'en',
            targetLang
          );
        } catch (error) {
          answer = `Goodbye ${userName}! 👋 Take care and feel free to come back anytime if you have any questions about Vignan University. Have a great day!`;
        }
      } else {
        try {
          answer = await safeTranslate(
            `I understand! 👍 I'm here whenever you need help with anything related to Vignan University. What would you like to know about?`,
            'en',
            targetLang
          );
        } catch (error) {
          answer = `I understand! 👍 I'm here whenever you need help with anything related to Vignan University. What would you like to know about?`;
        }
      }

      // Add to session history
      await userSession.addConversationTurn('user', message, targetLang);
      await userSession.addConversationTurn('assistant', answer, targetLang);

      return res.json({ answer, source: 'greeting_response' });
    }

    // Check for student registration number lookup
    const regNumberPatterns = [
      /\b(reg|registration)(\s+|-|_|\.)?(?:no|num|number)?(\s+|-|_|\.)?(is)?(\s+|-|_|\.)?\s*([a-z0-9]+)\b/i,
      /\b([a-z0-9]{5,12})\b/i, // Common registration number format
      /\bmy\s+(reg|registration)(\s+|-|_|\.)?(?:no|num|number)?\b/i,
      /\bstudent\s+(details|info|information)\b/i,
      /\bmy\s+(details|info|information)\b/i,
      /\bfind\s+me\b/i,
      /\bwho\s+am\s+i\b/i
    ];
    
    // Patterns for personal information queries
    const personalInfoPatterns = [
      /\bmy\s+(fee|fees|tuition|payment|balance|due|outstanding)\b/i,
      /\bhow\s+much\s+(fee|fees|tuition|payment|balance|due|outstanding)\b/i,
      /\bwhat\s+(is|are)\s+my\s+(fee|fees|tuition|payment|balance|due|outstanding)\b/i,
      /\bmy\s+(department|faculty|school|college|course|program|batch|semester|year|section|class)\b/i,
      /\bwhat\s+(is|are)\s+my\s+(department|faculty|school|college|course|program|batch|semester|year|section|class)\b/i,
      /\bmy\s+(grade|grades|mark|marks|score|scores|result|results|performance|attendance|record|records)\b/i,
      /\bwhat\s+(is|are)\s+my\s+(grade|grades|mark|marks|score|scores|result|results|performance|attendance|record|records)\b/i,
      /\bmy\s+(profile|account|details|information|data|record)\b/i,
      /\bwhat\s+(is|are)\s+my\s+(profile|account|details|information|data|record)\b/i
    ];
    
    // Extract registration number from message if present
    let registrationNumber = null;
    for (const pattern of regNumberPatterns) {
      const match = messageEn.match(pattern);
      if (match && match[6]) {
        registrationNumber = match[6];
        break;
      }
    }
    
    // Check if user is asking about personal information (fees, department, etc.)
    const isAskingPersonalInfo = personalInfoPatterns.some(pattern => pattern.test(messageEn));
    
    // Check if user is asking about student information
    isAskingForStudentInfo = regNumberPatterns.some(pattern => pattern.test(messageEn)) || isAskingPersonalInfo;
    
    // If asking about student info, try to find student data
    if (isAskingForStudentInfo) {
      try {
        // First try with extracted registration number if available
        student = null;
        
        if (registrationNumber) {
          // Try to find student by registration number
          const Student = mongoose.model('Student');
          student = await Student.findOne({ registrationNumber: { $regex: new RegExp(registrationNumber, 'i') } });
        }
        
        // If no student found with extracted reg number, check if user has registration number in their profile
        if (!student && userInfo.registrationNumber) {
          const Student = mongoose.model('Student');
          student = await Student.findOne({ registrationNumber: { $regex: new RegExp(userInfo.registrationNumber, 'i') } });
        }
        
        if (student) {
          // Format student data for display
          let studentInfoEn = `Here are your student details:\n\n`;
          studentInfoEn += `📚 **Registration Number**: ${student.registrationNumber}\n`;
          studentInfoEn += `👤 **Name**: ${student.name}\n`;
          
          if (student.email) studentInfoEn += `📧 **Email**: ${student.email}\n`;
          if (student.course) studentInfoEn += `🎓 **Course**: ${student.course}\n`;
          if (student.batch) studentInfoEn += `🗓️ **Batch**: ${student.batch}\n`;
          if (student.semester) studentInfoEn += `📅 **Semester**: ${student.semester}\n`;
          if (student.department) studentInfoEn += `🏢 **Department**: ${student.department}\n`;
          
          // Add any additional data if available
          if (student.additionalData && student.additionalData.size > 0) {
            studentInfoEn += `\n**Additional Information**:\n`;
            for (const [key, value] of student.additionalData.entries()) {
              studentInfoEn += `- **${key}**: ${value}\n`;
            }
          }
          
          // Translate the response if needed
          let answer = studentInfoEn;
          try {
            answer = await safeTranslate(studentInfoEn, 'en', targetLang);
          } catch (error) {
            console.error('Translation error:', error);
          }
          
          // Add to session history
          await userSession.addConversationTurn('user', message, targetLang);
          await userSession.addConversationTurn('assistant', answer, targetLang);
          
          return res.json({ answer, source: 'student_data' });
        }
      } catch (error) {
        console.error('Error finding student data:', error);
      }
    }

    // Handle concerning content with special care and support
    if (concernDetection.detected) {
      let answer;
      const userName = userInfo.name || 'Student';

      try {
        if (concernDetection.concernType === 'suicide') {
          answer = await safeTranslate(
            `I'm really concerned about what you're sharing, ${userName}. 😔 Your life has value and meaning, even when it doesn't feel that way right now.

**Please know that you're not alone in this struggle.**

Here are some resources that can help:
• **Crisis Helpline (India):** 9152987821 (24/7)
• **National Suicide Prevention Helpline:** 1800-599-0019
• **Vignan University Counseling Center:** Available on campus
• **Your family and friends** care about you deeply

**What you're feeling is temporary, even if it doesn't feel that way.** There are people who want to help you through this difficult time.

Would you like to talk about what's making you feel this way? I'm here to listen without judgment. Sometimes just sharing what's on your mind can help. 💙`,
            'en',
            targetLang
          );
        } else if (concernDetection.concernType === 'self_harm') {
          answer = await safeTranslate(
            `I'm worried about you, ${userName}. 💙 I can hear that you're going through a really tough time right now.

**Your safety is the most important thing.** Hurting yourself won't solve the problems you're facing, and there are better ways to cope with these feelings.

**You deserve support and care:**
• Talk to someone you trust - a friend, family member, or counselor
• Vignan University has counseling services available
• Consider reaching out to a mental health professional
• Remember that these feelings are temporary

**What's really bothering you?** Sometimes talking about what's causing these feelings can help. I'm here to listen and support you. 🤗

You don't have to face this alone.`,
            'en',
            targetLang
          );
        } else if (concernDetection.concernType === 'depression' || concernDetection.concernType === 'anxiety') {
          answer = await safeTranslate(
            `I can hear that you're struggling with some really difficult emotions, ${userName}. 😔 It takes courage to share these feelings, and I want you to know that you're not alone.

**What you're experiencing is valid and treatable.** Many students go through similar challenges, and there are effective ways to work through them.

**Here are some things that might help:**
• **Talk to someone:** A trusted friend, family member, or counselor
• **University resources:** Vignan has counseling services for students
• **Professional help:** Consider speaking with a mental health professional
• **Self-care:** Try to maintain a routine, get some fresh air, and be gentle with yourself

**What's been weighing on your mind lately?** Sometimes just talking about what's bothering you can provide some relief. I'm here to listen and support you. 💙

Remember, seeking help is a sign of strength, not weakness.`,
            'en',
            targetLang
          );
        } else if (concernDetection.concernType === 'academic_stress') {
          answer = await safeTranslate(
            `I completely understand how you're feeling, ${userName}. 😔 Academic pressure is one of the most common challenges students face, and it's absolutely normal to feel overwhelmed sometimes.

**First, let me tell you this - you're not alone, and your feelings are completely valid.** Many successful people, including your professors and university staff, have been exactly where you are now.

**Let's tackle this together step by step:**

🎯 **Immediate Relief:**
• Take a deep breath - you've already taken the first step by reaching out
• Remember that one difficult period doesn't define your entire academic journey
• Your worth is not determined by grades or performance

📚 **Academic Support Available:**
• **Vignan's Academic Support Center** - free tutoring and study groups
• **Professor Office Hours** - they want to help you succeed
• **Study Skills Workshops** - learn effective study techniques
• **Peer Study Groups** - connect with classmates facing similar challenges

💡 **Let's Problem-Solve Together:**
• What specific subjects are causing the most stress?
• Are you struggling with time management, understanding concepts, or exam anxiety?
• What study methods have you tried so far?

**I'm here to help you find practical solutions.** Whether it's breaking down complex topics, creating a study schedule, or finding the right resources, we can work through this together.

What would you like to focus on first? 🤝`,
            'en',
            targetLang
          );
        } else {
          answer = await safeTranslate(
            `I can sense that you're going through a difficult time, ${userName}. 😔 Whatever you're facing, please know that you don't have to handle it alone.

**It's okay to not be okay sometimes.** Everyone goes through tough periods, and reaching out for support is a sign of strength.

**Here are some ways to get help:**
• **Talk to someone you trust** - friends, family, or a counselor
• **University resources** - Vignan has support services available
• **Professional help** - Consider speaking with a mental health professional
• **Take care of yourself** - Even small acts of self-care can help

**What's on your mind?** I'm here to listen and support you through whatever you're going through. Sometimes just talking about it can help. 💙

You're valued and important, even when it doesn't feel that way.`,
            'en',
            targetLang
          );
        }
      } catch (error) {
        console.log('Concerning content response translation error:', error.message);
        // Fallback to English response
        answer = `I'm really concerned about what you're sharing, ${userName}. Your life has value and meaning. Please reach out to someone you trust or contact a crisis helpline. I'm here to listen and support you.`;
      }

      // Save the concerning conversation to database
      try {
        const fullConversation = userSession.getRecentHistory(10);
        await ConcerningConversation.create({
          userId: userId,
          registrationNumber: userInfo.registrationNumber,
          sessionId: sessionId || 'default',
          concernType: concernDetection.concernType,
          severity: concernDetection.severity,
          originalMessage: message,
          aiResponse: answer,
          fullConversation: fullConversation.map(turn => ({
            role: turn.role,
            content: turn.content,
            timestamp: new Date()
          })),
          keywords: concernDetection.keywords
        });
        console.log(`Concerning conversation logged for user ${userInfo.registrationNumber}: ${concernDetection.concernType}`);
      } catch (logError) {
        console.error('Error logging concerning conversation:', logError);
      }

      // Add to session history
      await userSession.addConversationTurn('user', message, targetLang);
      await userSession.addConversationTurn('assistant', answer, targetLang);

      return res.json({
        answer,
        source: 'concerning_content',
        concernDetected: true,
        concernType: concernDetection.concernType,
        severity: concernDetection.severity
      });
    }

    // Handle allowed real-life utilities first (time/date/study tips)
    if (realLifeIntent) {
      let answer;
      try {
        if (realLifeIntent === 'time') {
          const now = new Date();
          const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
          answer = await safeTranslate(`The current time is ${timeStr}.`, 'en', targetLang);
        } else if (realLifeIntent === 'date') {
          const now = new Date();
          const dateStr = now.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
          answer = await safeTranslate(`Today's date is ${dateStr}.`, 'en', targetLang);
        } else if (realLifeIntent === 'study_tips') {
          const tips = `Here are some study tips:\n1. Set a clear goal for each session.\n2. Use 25–30 minute focus blocks with 5-minute breaks.\n3. Practice active recall and spaced repetition.\n4. Summarize what you learned in your own words.\n5. Reduce distractions: notifications off, quiet space.\n6. Sleep well and stay hydrated.`;
          answer = await safeTranslate(tips, 'en', targetLang);
        }
      } catch (_) {
        answer = 'Here to help!';
      }

      // Friendly greeting on first turn of the session
      if (userSession.conversationHistory.length === 0) {
        const userName = userInfo.name || userSession.userContext.preferredName || 'Student';
        answer = `Hello ${userName}! 👋 ${answer}`;
      }

      await userSession.addConversationTurn('user', message, targetLang);
      await userSession.addConversationTurn('assistant', answer, targetLang);
      return res.json({ answer, source: 'real_life' });
    }

    // Allow more personal and general conversations while maintaining university focus
    const isEventQuery = /\b(upcoming events?|events?)\b/i.test(messageEn) || /tell me about the event\s*:?.+/i.test(messageEn);

    // Check if it's a general question that we can handle
    const isGeneralQuestion = /\b(what is|what are|how does|why|when|where|who)\b/i.test(messageEn) &&
                             !/\b(vignan|university|college|campus|admission|course|program|academic|faculty|student|exam|semester|degree|bachelor|master|phd|research|thesis|assignment|project|lab|laboratory|department|engineering|management|pharmacy|science|technology|education|study|scholarship|fee|tuition|registration|enrollment|graduation|convocation|alumni|career|job|internship|training|r22|r25|regulation|regulations|syllabus|curriculum|jntu|jntuk|jntua|jntuh|autonomous|affiliated|ugc|aicte|credit|credits|cgpa|sgpa|grade|grades|marking|scheme|evaluation|assessment|internal|external|midterm|final|practical|theory|tutorial|seminar|workshop|industrial|training|internship|project|viva|defense|submission)\b/i.test(messageEn);

    if (!isUniversityRelated && !isCourseQuestion && !isGreeting && !realLifeIntent && !isTodoIntent && !isEventQuery && !isPersonalQuestion && !isGeneralQuestion) {
      let answer;
      try {
        const decline = (
          "I'm Vignan University's AI Assistant! 😊 I'm here to help you with university-related questions, but I'm also happy to chat about general topics and provide support.\n\n" +
          "**I can help you with:**\n" +
          "• Academic programs, syllabus, and regulations (R22, R25)\n" +
          "• Admissions, fees, scholarships, placements\n" +
          "• Campus facilities: library, hostels, labs, timings\n" +
          "• Departments, faculty, student services\n" +
          "• General questions and friendly conversation\n" +
          "• Study tips and academic support\n\n" +
          "**What would you like to know?** Feel free to ask me anything - I'm here to help! 💙"
        );
        answer = await safeTranslate(decline, 'en', targetLang);
      } catch (error) {
        console.log('University focus translation error, using English:', error.message);
        answer = (
          "I'm Vignan University's AI Assistant! 😊 I'm here to help you with university-related questions, but I'm also happy to chat about general topics and provide support.\n\n" +
          "I can help with academic programs, admissions, campus facilities, departments, student services, and general questions. What would you like to know? 💙"
        );
      }

      // Add to session history
      await userSession.addConversationTurn('user', message, targetLang);
      await userSession.addConversationTurn('assistant', answer, targetLang);

      return res.json({ answer, source: 'university_focus' });
    }

    // Extract and update user context from the message
    const contextData = await extractUserContext(messageEn);
    if (Object.keys(contextData).length > 0) {
      await userSession.updateUserContext(contextData);
      console.log('Updated user context:', contextData);
    }

    // Special response for course questions when we have department info
    if (isCourseQuestion && userSession.userContext.department) {
      const department = userSession.userContext.department;
      const year = userSession.userContext.year || '';
      const yearText = year ? ` (${year})` : '';

      let answer;
      try {
        answer = await safeTranslate(
          `Yes, I know your course! You're from the **${department}** department${yearText} at Vignan University. ` +
          `As a ${department} student, I can help you with information about your program, courses, faculty, ` +
          `and other department-specific details. What would you like to know about your ${department} program?`,
          'en',
          targetLang
        );
      } catch (error) {
        console.log('Course question translation error, using English:', error.message);
        answer = `Yes, I know your course! You're from the **${department}** department${yearText} at Vignan University. ` +
          `As a ${department} student, I can help you with information about your program, courses, faculty, ` +
          `and other department-specific details. What would you like to know about your ${department} program?`;
      }

      console.log(`Responding to course question with department: ${department}`);

      // Add to session history
      await userSession.addConversationTurn('user', message, targetLang);
      await userSession.addConversationTurn('assistant', answer, targetLang);

      return res.json({
        answer,
        source: 'user_context',
        userContext: userSession.userContext
      });
    }

    // Handle personal questions
    if (isPersonalQuestion) {
      const personalResponse = await handlePersonalQuestion(
        messageEn,
        userId,
        sessionId || 'default',
        targetLang
      );

      // Translate response if needed
      let finalResponse = personalResponse.answer;
      if (targetLang !== 'en') {
        try {
          finalResponse = await safeTranslate(personalResponse.answer, 'en', targetLang);
        } catch (translateError) {
          console.error('Error translating response:', translateError);
        }
      }

      // Add source attribution
      const sourceMap = {
        'faq': 'university FAQ',
        'knowledge_base': 'university documents',
        'events': 'university events',
        'chat_history': 'our previous conversation',
        'web_search': 'web search',
        'gemini_ai': 'general knowledge'
      };

      const sourceText = sourceMap[personalResponse.source] || 'university resources';
      const sourceAttribution = `\n\n[Source: ${sourceText}]`;

      // Only add source if not from fallback or error
      if (personalResponse.source !== 'fallback' && personalResponse.source !== 'error') {
        finalResponse += sourceAttribution;
      }

      // Add to session history
      await userSession.addConversationTurn('user', message, targetLang);
      await userSession.addConversationTurn('assistant', finalResponse, targetLang);

      return res.json({
        answer: finalResponse,
        source: personalResponse.source,
        confidence: personalResponse.confidence,
        sessionId: sessionId || 'default'
      });
    }

    // Get conversation history from session
    const conversationHistory = userSession.getRecentHistory(10);
    // If conversation is long, create a brief memory summary and store on user
    try {
      if (userSession.conversationHistory.length > 40) {
        const recent = conversationHistory.map(t => `${t.role}: ${t.content}`).join('\n');
        const memPrompt = `Create a concise, user-centric memory for future personalization. Capture department, interests, goals, tone, and recurring topics in <= 60 words.\n\nConversation:\n${recent}`;
        const summary = await generateChatResponse([{ role: 'user', content: memPrompt }]);
        if (summary && summary.trim()) {
          userInfo.memories = userInfo.memories || [];
          userInfo.memories.push({ title: 'Session summary', summary: summary.trim() });
          // Also propagate into session userContext.lastTopics if we can infer topics
          await userInfo.save();
        }
      }
    } catch (e) {
      console.log('Memory summarize error:', e.message);
    }

    console.log('=== DEBUG INFO ===');
    console.log('User ID:', userId);
    console.log('Session ID:', sessionId);
    console.log('User Session Context:', JSON.stringify(userSession.userContext, null, 2));
    console.log('Conversation History:', JSON.stringify(conversationHistory, null, 2));
    console.log('Message:', messageEn);
    console.log('==================');

    // Check for specific academic regulation queries
    const regulationQuery = checkRegulationQuery(messageEn);
    if (regulationQuery) {
      const answer = await handleRegulationQuery(regulationQuery, targetLang);
      if (answer) {
        // Add conversation to session history
        await userSession.addConversationTurn('user', message, targetLang);
        await userSession.addConversationTurn('assistant', answer, targetLang);

        return res.json({
          answer,
          source: 'regulation_knowledge',
          userContext: userSession.userContext
        });
      }
    }

    // Mark items completed based on natural language (handle before creation to avoid accidental adds)
    if (/(mark|set) .* (complete|completed|done)|\b(completed|finished|done)\b|\b(tick off|check off|i finished|i have finished|i am done with)\b/i.test(messageEn)) {
      let candidates = parseTodosFromText(messageEn);
      // Fallback: allow direct course-code mentions like CD/CN/DMT
      if (!candidates.length) {
        const codeMatches = Array.from(messageEn.matchAll(/\b(CD|CN|DMT)\b/gi)).map(m => m[1]);
        if (codeMatches.length) candidates = codeMatches;
      }
      const now = new Date();
      const open = await Todo.find({ userId, expiresAt: { $gte: now }, isCompleted: { $ne: true } }).lean();
      let updated = 0;
      const clearAllIntent = /(delete|clear|complete|finish|mark)\s+(all|everything).*(todo|to-?do|task|tasks)/i.test(messageEn)
        || /(today|for today).*(delete|clear|complete|finish).*(todo|to-?do|task|tasks)/i.test(messageEn);
      const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (clearAllIntent && open.length) {
        await Todo.updateMany({ _id: { $in: open.map(t => t._id) }, userId }, { $set: { isCompleted: true } });
        updated = open.length;
      } else {
        // Try matching each candidate against open todos using fuzzy rules
        for (const name of candidates) {
          const n = norm(name);
          const hit = open.find(t => {
            const tt = norm(t.title);
            return tt === n || tt.includes(n) || n.includes(tt) || new RegExp(`\\b${name}\\b`, 'i').test(t.title);
          });
          if (hit) {
            await Todo.updateOne({ _id: hit._id, userId }, { $set: { isCompleted: true } });
            updated += 1;
          }
        }
        // If still nothing, pick the best fuzzy match from message once
        if (updated === 0 && open.length) {
          const msgN = norm(messageEn);
          const scored = open.map(t => ({ t, score: msgN.includes(norm(t.title)) ? norm(t.title).length : 0 }))
                            .sort((a, b) => b.score - a.score);
          if (scored[0] && scored[0].score >= 2) {
            await Todo.updateOne({ _id: scored[0].t._id, userId }, { $set: { isCompleted: true } });
            updated = 1;
          }
        }
      }
      // Always return the full refreshed list after updates
      const refreshed = await Todo.find({ userId, expiresAt: { $gte: now } })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      // Check if all todos are completed and provide a congratulatory message
      const allCompleted = refreshed.length > 0 && refreshed.every(t => t.isCompleted);
      let answer;
      if (updated > 0) {
        if (allCompleted) {
          answer = await safeTranslate(
            `Congratulations! 🎉 You've completed all your tasks for today. Great job!`,
            'en',
            targetLang
          );
        } else {
          const remainingCount = refreshed.filter(t => !t.isCompleted).length;
          answer = await safeTranslate(
            clearAllIntent
              ? `Marked all ${updated} item(s) as completed for today.`
              : `Marked ${updated} item(s) as completed. You have ${remainingCount} task(s) remaining.`,
            'en',
            targetLang
          );
        }
      } else {
        answer = await safeTranslate(
          `I couldn't match those items to your to-dos. Try quoting exact names like: "Maths", "DSA".`,
          'en',
          targetLang
        );
      }

      await userSession.addConversationTurn('user', message, targetLang);
      await userSession.addConversationTurn('assistant', answer, targetLang);
      return res.json({ answer, source: 'todo_update', updated, todos: refreshed.map(t => ({ id: t._id, title: t.title, done: !!t.isCompleted })) });
    }

    // If user mentions homework/todo, create items
    if (isTodoIntent) {
      // Check if the message specifically mentions our target course codes
      const courseCodes = ['CD', 'CN', 'DMT'];

      // Check if the message is specifically about creating todos for CD, CN, DMT
      const isSpecificCourseRequest = /\b(cd|cn|dmt)\b.*\b(cd|cn|dmt)\b/i.test(messageEn);

      // If the message mentions specific course codes, use only those
      let items = [];

      if (isSpecificCourseRequest) {
        // Force include all three course codes if the message mentions at least two of them
        items = ['CD', 'CN', 'DMT'];
      } else {
        items = parseTodosFromText(messageEn).filter(s => !/homework|todo|to-?do|tasks?|assignments?/i.test(s));
      }

      const created = [];
      for (const s of items) {
        const expires = new Date();
        // expire next midnight
        expires.setDate(expires.getDate() + 1);
        expires.setHours(0,0,0,0);
        const todo = await Todo.create({ userId, title: s.substring(0, 120), description: s, sessionId: sessionId || 'default', sourceMessage: message, expiresAt: expires });
        created.push({ id: todo._id, title: todo.title });
      }
      const count = created.length;

      // Return full list so UI can merge without losing existing items
      const now = new Date();
      const refreshed = await Todo.find({ userId, expiresAt: { $gte: now } })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      // Prepare response with more detailed information
      let answer;
      if (count) {
        const remainingCount = refreshed.filter(t => !t.isCompleted).length;
        answer = await safeTranslate(
          `I created ${count} to-do item(s) for you. They will reset after midnight. You have ${remainingCount} task(s) for today. Say "show my to-dos" to review them.`,
          'en',
          targetLang
        );
      } else {
        answer = await safeTranslate(
          `Please list your homework or tasks, for example: homework: "Maths Unit 3", "DSA Sheet 2", "CN lab record".`,
          'en',
          targetLang
        );
      }

      await userSession.addConversationTurn('user', message, targetLang);
      await userSession.addConversationTurn('assistant', answer, targetLang);
      return res.json({ answer, source: 'todo', todos: refreshed.map(t => ({ id: t._id, title: t.title, done: !!t.isCompleted })) });
    }

    if (/\b(show|list) my (todos?|to-dos?|tasks)\b/i.test(messageEn)) {
      const now = new Date();
      const todos = await Todo.find({ userId, expiresAt: { $gte: now } }).sort({ createdAt: -1 }).limit(50).lean();

      let answer;
      if (todos.length) {
        const list = todos.map((t, i) => `${i + 1}. ${t.isCompleted ? '✅' : '⬜'} ${t.title}`).join('\n');
        const completedCount = todos.filter(t => t.isCompleted).length;
        const remainingCount = todos.length - completedCount;

        let statusMessage = '';
        if (completedCount === todos.length) {
          statusMessage = '\n\nCongratulations! 🎉 You have completed all your tasks for today!';
        } else if (remainingCount > 0) {
          statusMessage = `\n\nYou have ${remainingCount} task(s) remaining for today.`;
        }

        answer = await safeTranslate(
          `Here are your to-dos for today:\n${list}${statusMessage}`,
          'en',
          targetLang
        );
      } else {
        answer = await safeTranslate(
          'No active to-dos for today. You can create new tasks by saying something like "Add homework: Math assignment, Physics lab report".',
          'en',
          targetLang
        );
      }

      await userSession.addConversationTurn('user', message, targetLang);
      await userSession.addConversationTurn('assistant', answer, targetLang);
      return res.json({ answer, source: 'todo', todos: todos.map(t => ({ id: t._id, title: t.title, done: !!t.isCompleted })) });
    }

    // (Handled earlier)

    // Surface recent events on request, specific event by title, or follow-ups without the word 'event'
    if (/\b(upcoming events?|events?)\b/i.test(messageEn) || /tell me about the event\s*:?\s*([^\n]+)/i.test(messageEn) || /\b(give|explain|details|description|more about|tell me more)\b/i.test(messageEn)) {
      const { retrieverQuery } = require('../services/langchainEvents');
      const events = await Event.find().sort({ createdAt: -1 }).limit(5).lean();
      let answer;
      const match = messageEn.match(/tell me about the event\s*:?\s*([^\n]+)/i);
      if (match) {
        const title = match[1].trim();
        // Use retriever to allow fuzzy titles
        let [ev] = await retrieverQuery(title, 1);
        if (!ev) {
          ev = events.find(e => e.title.toLowerCase().includes(title.toLowerCase())) || await Event.findOne({ title: new RegExp(title, 'i') }).lean();
        }
        if (ev) {
          // Translate event details if needed
          let eventTitle = ev.title;
          let eventDescription = (ev.description || '').trim();

          if (targetLang && targetLang !== 'en') {
            eventTitle = await safeTranslate(eventTitle, 'en', targetLang);
            eventDescription = await safeTranslate(eventDescription, 'en', targetLang);
          }

          answer = `## ${eventTitle}\n\n${eventDescription}\n\n${ev.startsAt ? `Starts: ${new Date(ev.startsAt).toLocaleString()}` : ''}${ev.endsAt ? `\nEnds: ${new Date(ev.endsAt).toLocaleString()}` : ''}`.trim();
          // Track last referenced event to support follow-ups like "give about this description"
          try { await UserSession.updateOne({ _id: userSession._id }, { $set: { 'sessionMetadata.lastEventTitle': ev.title } }); } catch (_) {}
        } else {
          answer = await safeTranslate(
            'I could not find that event. Here are the latest events:\n' + (events.length ? events.map((e, i) => `${i + 1}. ${e.title} - ${e.description.substring(0, 120)}...`).join('\n') : 'No events available yet.'),
            'en',
            targetLang
          );
        }
      } else {
        // If there's a remembered last event and user is asking for details without naming it
        let ev = null;
        if (userSession.sessionMetadata?.lastEventTitle) {
          ev = await Event.findOne({ title: new RegExp(userSession.sessionMetadata.lastEventTitle, 'i') }).lean();
        }
        if (ev) {
          // Translate event details if needed
          let eventTitle = ev.title;
          let eventDescription = (ev.description || '').trim();

          if (targetLang && targetLang !== 'en') {
            eventTitle = await safeTranslate(eventTitle, 'en', targetLang);
            eventDescription = await safeTranslate(eventDescription, 'en', targetLang);
          }

          answer = `## ${eventTitle}\n\n${eventDescription}\n\n${ev.startsAt ? `Starts: ${new Date(ev.startsAt).toLocaleString()}` : ''}${ev.endsAt ? `\nEnds: ${new Date(ev.endsAt).toLocaleString()}` : ''}`.trim();
        } else {
          // Use retriever on the whole message to pull best matching event
          const hits = await retrieverQuery(messageEn, 1);
          if (hits && hits.length) {
            const e = hits[0];

            // Translate event details if needed
            let eventTitle = e.title;
            let eventDescription = (e.description || '').trim();

            if (targetLang && targetLang !== 'en') {
              eventTitle = await safeTranslate(eventTitle, 'en', targetLang);
              eventDescription = await safeTranslate(eventDescription, 'en', targetLang);
            }

            answer = `## ${eventTitle}\n\n${eventDescription}\n\n${e.startsAt ? `Starts: ${new Date(e.startsAt).toLocaleString()}` : ''}${e.endsAt ? `\nEnds: ${new Date(e.endsAt).toLocaleString()}` : ''}`.trim();
            try { await UserSession.updateOne({ _id: userSession._id }, { $set: { 'sessionMetadata.lastEventTitle': e.title } }); } catch (_) {}
          } else {
            answer = await safeTranslate(
              events.length
                ? 'Upcoming events:\n' + events.map((e, i) => `${i + 1}. ${e.title} - ${e.description.substring(0, 120)}...`).join('\n')
                : 'No events available yet.',
              'en',
              targetLang
            );
          }
        }
      }
      await userSession.addConversationTurn('user', message, targetLang);
      await userSession.addConversationTurn('assistant', answer, targetLang);
      return res.json({ answer, source: 'events' });
    }

    // Use the unified knowledge retrieval system to gather relevant information from all sources
    const knowledgeResults = await retrieveRelevantKnowledge(messageEn, {
      userId,
      maxKnowledgeItems: 3,
      maxFAQs: 2,
      maxEvents: 2,
      maxChatLogs: 2,
      maxUserProfiles: 1,
      includeWebSearch: true,
      maxWebResults: 3,
      targetLang: targetLang
    });

    // Initialize variables
    let answerEn = '';
    let knowledgeHit = null;
    let best = null;
    let webSearchResults = [];

    // Use enhanced multilingual response if available
    if (knowledgeResults.enhancedResponse) {
      console.log('Using Gemini AI enhanced response');
      answerEn = knowledgeResults.enhancedResponse;
    } else {

    console.log('Knowledge retrieval results:', {
      knowledgeItems: knowledgeResults.knowledgeItems?.length || 0,
      faqs: knowledgeResults.faqs?.length || 0,
      events: knowledgeResults.events?.length || 0,
      chatLogs: knowledgeResults.chatLogs?.length || 0,
      userProfiles: knowledgeResults.userProfiles?.length || 0,
      webSearchResults: knowledgeResults.webSearchResults?.length || 0,
      urlContents: knowledgeResults.urlContents?.length || 0
    });

    // PRIORITY 1: Check FAQs first (as requested)

    if (knowledgeResults.faqs && knowledgeResults.faqs.length > 0) {
      const faqHit = knowledgeResults.faqs[0];
      knowledgeHit = {
        content: `Question: ${faqHit.question}\n\nAnswer: ${faqHit.answer}`,
        title: faqHit.question
      };
      console.log('Found FAQ match:', faqHit.question);
    }
    // PRIORITY 2: Check knowledge items if no FAQ found
    else if (knowledgeResults.knowledgeItems && knowledgeResults.knowledgeItems.length > 0) {
      best = { item: knowledgeResults.knowledgeItems[0], score: 0.8 };
      knowledgeHit = best.item;
      console.log('Found knowledge item match:', best.item.title);
    }
    // PRIORITY 3: Check events if no FAQ or knowledge item found
    else if (knowledgeResults.events && knowledgeResults.events.length > 0) {
      const eventHit = knowledgeResults.events[0];
      knowledgeHit = {
        content: `Event: ${eventHit.title}\n\nDescription: ${eventHit.description || 'No description available'}\nDate: ${eventHit.startsAt ? new Date(eventHit.startsAt).toLocaleDateString() : 'Not specified'}`,
        title: eventHit.title
      };
      console.log('Found event match:', eventHit.title);
    }
    // PRIORITY 4: Check chat logs if no other sources found
    else if (knowledgeResults.chatLogs && knowledgeResults.chatLogs.length > 0) {
      const chatHit = knowledgeResults.chatLogs[0];
      knowledgeHit = {
        content: chatHit.content,
        title: 'Previous Conversation'
      };
      console.log('Found chat log match');
    }

    // Retrieve long-term user memories from ChatLog and User.memories
    let retrievedContext = '';
    try {
      const logs = await ChatLog.find({ userId }).sort({ createdAt: -1 }).limit(20).lean();
      const pastTurns = logs.flatMap(l => (l.turns || []).map(t => `${t.role}: ${t.content}`));
      const memorySummaries = (userInfo.memories || []).map(m => `Memory: ${m.title} — ${m.summary}`);
      const corpus = [...memorySummaries, ...pastTurns].slice(-100);
      if (corpus.length > 0) {
        const vectors = await embedMany(corpus);
        // naive cosine similarity to current query embedding
        const scored = vectors.map((v, i) => ({
          i,
          score: v && v.length ? v.reduce((acc, val, idx) => acc + val * (embedding[idx] || 0), 0) /
            (Math.sqrt(v.reduce((a, val) => a + val * val, 0)) * Math.sqrt(embedding.reduce((a, val) => a + val * val, 0) || 1) || 1) : 0
        }));
        const top = scored.sort((a,b)=>b.score-a.score).slice(0,5).map(s => corpus[s.i]);
        if (top.length) {
          retrievedContext = `Relevant past info:\n${top.join('\n')}`;
        }
      }
    } catch (memErr) {
      console.log('Memory retrieval error:', memErr.message);
    }

    if (knowledgeHit) {
      answerEn = knowledgeHit.content;
      console.log('Using knowledge hit from priority sources');
    } else {
      // Only if no FAQs, knowledge items, events, or chat logs found, then check web search
      console.log('No matches found in FAQs, knowledge items, events, or chat logs. Checking web search...');

      // Check if this is a technical academic question that needs specific handling
      const technicalKeywords = ['r22', 'r25', 'regulation', 'syllabus', 'curriculum', 'credit', 'cgpa', 'semester', 'evaluation'];
      const isTechnicalQuestion = technicalKeywords.some(keyword => messageEn.toLowerCase().includes(keyword));

      // Check if we need web search for current information
      const needsWebSearch = messageEn.toLowerCase().includes('latest') ||
                           messageEn.toLowerCase().includes('current') ||
                           messageEn.toLowerCase().includes('recent') ||
                           messageEn.toLowerCase().includes('2024') ||
                           messageEn.toLowerCase().includes('2025') ||
                           messageEn.toLowerCase().includes('update') ||
                           messageEn.toLowerCase().includes('hod') ||
                           messageEn.toLowerCase().includes('head of department');

      if (needsWebSearch) {
        try {
          webSearchResults = await searchAcademicInfo(messageEn);
          console.log('Web search results:', webSearchResults);

          // If web search found results, use them
          if (webSearchResults && webSearchResults.length > 0) {
            const webResult = webSearchResults[0];
            answerEn = `${webResult.title}\n\n${webResult.snippet}`;
            console.log('Using web search result:', webResult.title);
          }
        } catch (error) {
          console.log('Web search failed:', error.message);
        }
      }

      if (isTechnicalQuestion) {
        // Provide a more helpful response for technical questions
        answerEn = `I understand you're asking about academic regulations and curriculum details. While I have general knowledge about JNTU academic frameworks (R22, R25), I may not have the most current specific details for your exact query.

**What I can help you with:**
- General information about R22 and R25 regulations
- Credit system and evaluation criteria
- Project and internship requirements
- CGPA and graduation criteria

**For specific details about:**
- Your exact course curriculum
- Current semester-wise subjects
- Department-specific requirements
- Latest regulation updates

I recommend contacting:
- Your academic advisor or department head
- The academic affairs office
- Checking the official Vignan University website
- Referring to your student handbook

Would you like me to provide general information about academic regulations, or do you have questions about a specific aspect I can help with?`;
      } else {
        // Create context-aware system prompt with user session data
        const systemPrompt = createSystemPromptWithSession(userInfo, userSession, conversationHistory);

        // Build enhanced context from all knowledge sources
        let enhancedContext = '';

        // Add FAQ information if available
        if (knowledgeResults.faqs && knowledgeResults.faqs.length > 0) {
          enhancedContext += '\n\nRelevant FAQs:\n' + knowledgeResults.faqs.map(faq =>
            `Q: ${faq.question}\nA: ${faq.answer}`
          ).join('\n\n');
        }

        // Add event information if available
        if (knowledgeResults.events && knowledgeResults.events.length > 0) {
          enhancedContext += '\n\nRelevant Events:\n' + knowledgeResults.events.map(event =>
            `Event: ${event.title}\nDescription: ${event.description || 'No description'}\nDate: ${event.startsAt ? new Date(event.startsAt).toLocaleDateString() : 'Not specified'}`
          ).join('\n\n');
        }

        // Add knowledge items if available
        if (knowledgeResults.knowledgeItems && knowledgeResults.knowledgeItems.length > 0) {
          enhancedContext += '\n\nRelevant Knowledge:\n' + knowledgeResults.knowledgeItems.map(item =>
            `${item.title}:\n${item.content.substring(0, 500)}${item.content.length > 500 ? '...' : ''}`
          ).join('\n\n');
        }

        // Add chat log information if available
        if (knowledgeResults.chatLogs && knowledgeResults.chatLogs.length > 0) {
          enhancedContext += '\n\nRelevant Past Conversations:\n' + knowledgeResults.chatLogs.map(log =>
            log.content.substring(0, 300) + (log.content.length > 300 ? '...' : '')
          ).join('\n\n');
        }

        // Add user profile information if available
        if (knowledgeResults.userProfiles && knowledgeResults.userProfiles.length > 0) {
          enhancedContext += '\n\nUser Context:\n' + knowledgeResults.userProfiles.map(profile =>
            profile.content.substring(0, 300) + (profile.content.length > 300 ? '...' : '')
          ).join('\n\n');
        }

        // Add web search results if available
        if (knowledgeResults.webSearchResults && knowledgeResults.webSearchResults.length > 0) {
          enhancedContext += '\n\nWeb Search Results:\n' + knowledgeResults.webSearchResults.map(result =>
            `- ${result.title}: ${result.snippet}`
          ).join('\n');
        }

        // Add URL content if available
        if (knowledgeResults.urlContents && knowledgeResults.urlContents.length > 0) {
          enhancedContext += '\n\nExtracted URL Content:\n' + knowledgeResults.urlContents.map(url =>
            `From ${url.url}:\n${url.content.substring(0, 300)}${url.content.length > 300 ? '...' : ''}`
          ).join('\n\n');
        }

        // Add the original message
        let enhancedMessage = messageEn;

        // Build conversation history for AI
        const history = [
          { role: 'system', content: systemPrompt }
        ];

        // Add conversation history
        if (conversationHistory.length > 0) {
          history.push(...conversationHistory.slice(-8));
        }

        // Combine all context sources
        const combinedContext = [
          enhancedMessage,
          retrievedContext,
          enhancedContext
        ].filter(Boolean).join('\n\n');

        // Add the enhanced message with all context
        history.push({ role: 'user', content: combinedContext });

        console.log('Final History for AI:', history);

        try {
          answerEn = await generateChatResponse(history);
        } catch (error) {
          console.error('Error generating chat response:', error);
          // Fallback response
          answerEn = `I'm here to help you, ${userInfo.name || 'Student'}! 😊 I understand you're going through some challenges, and I want to support you through this.

Could you tell me more about what's on your mind? Whether it's academic stress, personal concerns, or anything else, I'm here to listen and help you find solutions.

Remember, reaching out for help is a sign of strength, not weakness. Let's work through this together! 💙`;
        }
      }
    }
    } // Close the else block for enhanced response

    // Format the response for better readability and apply user preferences
    answerEn = formatResponse(answerEn);
    // Apply answer length preference by truncating or expanding guidance
    const lengthPref = userInfo.preferences?.answerLength || 'medium';
    if (lengthPref === 'short') {
      // Keep first ~2-3 sentences
      const parts = answerEn.split(/(?<=\.)\s+/).slice(0, 3);
      if (parts.length > 0) answerEn = parts.join(' ');
    } else if (lengthPref === 'long') {
      // Add a gentle follow-up section
      if (!answerEn.includes('Would you like')) {
        answerEn += '\n\nWould you like more details on any section?';
      }
    }

    // Translate response back to user's language
    let answer;
    try {
      // Respect response style preference
      const style = userInfo.preferences?.responseStyle || 'friendly';
      const styled = style === 'formal'
        ? answerEn.replace(/\u{1F44B}|\u{1F60A}|\u{1F389}|\u{2705}|\u{26A0}\u{FE0F}|\u{1F4DD}|\u{1F4A1}|\u{1F91D}/gu, '')
        : answerEn;
      answer = await safeTranslate(styled, 'en', targetLang);
    } catch (error) {
      console.log('Response translation error, using English:', error.message);
      answer = answerEn; // Use English response if translation fails
    }

    // Friendly greeting on first interaction of a session
    if (userSession.conversationHistory.length === 0) {
      const userName = userInfo.name || userSession.userContext.preferredName || 'Student';
      const department = userSession.userContext.department ? ` from the ${userSession.userContext.department} department` : '';
      answer = `Hello ${userName}${department}! 👋 ${answer}`;
    }

    // Add conversation to session history
    await userSession.addConversationTurn('user', message, targetLang);
    await userSession.addConversationTurn('assistant', answer, targetLang);

    // Also log to ChatLog with upsert and append per user+session
    try {
      await ChatLog.updateOne(
        { userId, sessionId },
        {
          $push: {
            turns: {
              $each: [
                { role: 'user', content: message, language: targetLang },
                { role: 'assistant', content: answer, language: targetLang }
              ],
              $slice: -200
            }
          }
        },
        { upsert: true }
      );
    } catch (logErr) {
      console.error('ChatLog save error:', logErr);
    }

    res.json({
      answer,
      source: knowledgeHit ? 'knowledge_base' : (webSearchResults.length > 0 ? 'web_search' : 'gemini'),
      userContext: userSession.userContext
    });
  } catch (e) {
    console.error('Chat error:', e);
    res.status(500).json({ error: e.message });
  }
}

// Function to check if message is university-related
async function checkUniversityRelevance(message) {
  const universityKeywords = [
    'vignan', 'university', 'college', 'student', 'admission', 'course', 'program',
    'academic', 'faculty', 'campus', 'library', 'hostel', 'placement', 'exam',
    'semester', 'degree', 'bachelor', 'master', 'phd', 'research', 'thesis',
    'assignment', 'project', 'lab', 'laboratory', 'department', 'engineering',
    'management', 'pharmacy', 'science', 'technology', 'education', 'study',
    'scholarship', 'fee', 'tuition', 'registration', 'enrollment', 'graduation',
    'convocation', 'alumni', 'career', 'job', 'internship', 'training',
    // Academic regulations and technical terms
    'r22', 'r25', 'regulation', 'regulations', 'syllabus', 'curriculum', 'jntu',
    'jntuk', 'jntua', 'jntuh', 'autonomous', 'affiliated', 'ugc', 'aicte',
    'credit', 'credits', 'cgpa', 'sgpa', 'grade', 'grades', 'marking', 'scheme',
    'evaluation', 'assessment', 'internal', 'external', 'midterm', 'final',
    'practical', 'theory', 'tutorial', 'seminar', 'workshop', 'industrial',
    'training', 'internship', 'project', 'viva', 'defense', 'submission'
  ];

  const messageLower = message.toLowerCase();
  return universityKeywords.some(keyword => messageLower.includes(keyword));
}

// Function to extract user context from message
async function extractUserContext(message) {
  const messageLower = message.toLowerCase();
  const contextData = {};

  // Extract department/course information
  const departmentKeywords = {
    'computer science engineering': 'Computer Science Engineering',
    'computer science': 'Computer Science',
    'cse': 'Computer Science',
    'computer science and engineering': 'Computer Science',
    'electronics': 'Electronics and Communication',
    'ece': 'Electronics and Communication',
    'mechanical': 'Mechanical Engineering',
    'civil': 'Civil Engineering',
    'electrical': 'Electrical Engineering',
    'management': 'Management',
    'mba': 'Management',
    'pharmacy': 'Pharmacy',
    'b.pharm': 'Pharmacy',
    'm.pharm': 'Pharmacy'
  };

  for (const [keyword, department] of Object.entries(departmentKeywords)) {
    if (messageLower.includes(keyword)) {
      contextData.department = department;
      console.log(`Detected department: ${department}`);
      break;
    }
  }

  // Extract year information
  const yearPatterns = [
    { pattern: /first year|1st year|1 year/i, year: 'First Year' },
    { pattern: /second year|2nd year|2 year/i, year: 'Second Year' },
    { pattern: /third year|3rd year|3 year/i, year: 'Third Year' },
    { pattern: /fourth year|4th year|4 year/i, year: 'Fourth Year' },
    { pattern: /final year|last year/i, year: 'Final Year' }
  ];

  for (const { pattern, year } of yearPatterns) {
    if (pattern.test(message)) {
      contextData.year = year;
      console.log(`Detected year: ${year}`);
      break;
    }
  }

  // Extract personal information
  const namePattern = /(?:my name is|i am|i'm|call me)\s+([a-zA-Z\s]+)/i;
  const nameMatch = message.match(namePattern);
  if (nameMatch) {
    contextData.preferredName = nameMatch[1].trim();
    console.log(`Detected preferred name: ${contextData.preferredName}`);
  }

  // Extract interests and goals
  const interests = extractInterests(message);
  if (interests.length > 0) {
    contextData.interests = interests;
    contextData.lastTopics = interests;
  }

  // Extract academic goals
  const goals = extractAcademicGoals(message);
  if (goals.length > 0) {
    contextData.academicGoals = goals;
  }

  // Extract current challenges or concerns
  const challenges = extractChallenges(message);
  if (challenges.length > 0) {
    contextData.currentChallenges = challenges;
  }

  return contextData;
}

// Function to extract topics from message
function extractTopics(message) {
  const topics = [];
  const messageLower = message.toLowerCase();

  const topicKeywords = {
    'assignments': 'assignments',
    'exams': 'exams',
    'projects': 'projects',
    'courses': 'courses',
    'syllabus': 'syllabus',
    'grades': 'grades',
    'placement': 'placement',
    'internship': 'internship',
    'research': 'research',
    'library': 'library',
    'hostel': 'hostel',
    'fees': 'fees',
    'scholarship': 'scholarship'
  };

  for (const [keyword, topic] of Object.entries(topicKeywords)) {
    if (messageLower.includes(keyword)) {
      topics.push(topic);
    }
  }

  return topics;
}

// Function to extract interests from message
function extractInterests(message) {
  const interests = [];
  const messageLower = message.toLowerCase();

  const interestKeywords = {
    'programming': 'programming',
    'coding': 'programming',
    'software development': 'software development',
    'web development': 'web development',
    'mobile app': 'mobile development',
    'data science': 'data science',
    'machine learning': 'machine learning',
    'ai': 'artificial intelligence',
    'cybersecurity': 'cybersecurity',
    'networking': 'networking',
    'database': 'database management',
    'cloud computing': 'cloud computing',
    'blockchain': 'blockchain',
    'gaming': 'game development',
    'design': 'design',
    'ui/ux': 'UI/UX design',
    'robotics': 'robotics',
    'iot': 'Internet of Things',
    'embedded systems': 'embedded systems',
    'management': 'management',
    'marketing': 'marketing',
    'finance': 'finance',
    'entrepreneurship': 'entrepreneurship'
  };

  for (const [keyword, interest] of Object.entries(interestKeywords)) {
    if (messageLower.includes(keyword)) {
      interests.push(interest);
    }
  }

  return interests;
}

// Function to extract academic goals
function extractAcademicGoals(message) {
  const goals = [];
  const messageLower = message.toLowerCase();

  const goalKeywords = {
    'higher studies': 'higher studies',
    'masters': 'masters degree',
    'phd': 'PhD',
    'research': 'research career',
    'placement': 'job placement',
    'internship': 'internship',
    'startup': 'startup/entrepreneurship',
    'government job': 'government job',
    'abroad': 'studying abroad',
    'scholarship': 'scholarship',
    'cgpa': 'improving CGPA',
    'skills': 'skill development',
    'certification': 'certifications'
  };

  for (const [keyword, goal] of Object.entries(goalKeywords)) {
    if (messageLower.includes(keyword)) {
      goals.push(goal);
    }
  }

  return goals;
}

// Function to extract current challenges
function extractChallenges(message) {
  const challenges = [];
  const messageLower = message.toLowerCase();

  const challengeKeywords = {
    'difficult': 'academic difficulty',
    'hard': 'academic difficulty',
    'struggling': 'academic struggle',
    'failing': 'academic performance',
    'low cgpa': 'low CGPA',
    'exam stress': 'exam stress',
    'time management': 'time management',
    'study': 'study issues',
    'assignment': 'assignment problems',
    'project': 'project difficulties',
    'placement': 'placement concerns',
    'fees': 'financial issues',
    'hostel': 'hostel problems',
    'language': 'language barriers'
  };

  for (const [keyword, challenge] of Object.entries(challengeKeywords)) {
    if (messageLower.includes(keyword)) {
      challenges.push(challenge);
    }
  }

  return challenges;
}

// Function to get conversation history
async function getConversationHistory(userId, sessionId) {
  if (!userId) return [];

  try {
    const chatLogs = await ChatLog.find({ userId, sessionId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const history = [];
    chatLogs.reverse().forEach(log => {
      if (log.turns && log.turns.length > 0) {
        log.turns.forEach(turn => {
          history.push({
            role: turn.role,
            content: turn.content
          });
        });
      }
    });

    return history;
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    return [];
  }
}

// Function to create context-aware system prompt with session data
function createSystemPromptWithSession(userInfo, userSession, conversationHistory = []) {
  let prompt = `You are Vignan University's AI Assistant - a warm, caring, and intelligent companion for students. Think of yourself as a knowledgeable friend who's always there to help, support, and guide students through their academic journey.

CORE PERSONALITY:
- Be extremely friendly, conversational, and empathetic like a caring mentor
- Always address students by their name and show genuine interest in their wellbeing
- Use a warm, supportive tone with appropriate emojis to make conversations engaging
- Ask thoughtful follow-up questions to better understand their needs and feelings
- Be proactive in offering help, resources, and emotional support
- Show genuine care and empathy for all student challenges, big or small
- Be patient, understanding, and non-judgmental, especially with academic or personal struggles
- Celebrate their successes and encourage them during difficult times

EXPERTISE AREAS:
- Vignan University programs, policies, and campus life
- JNTU academic regulations (R22, R25)
- Engineering, Management, Pharmacy programs
- Study tips, career guidance, and academic support
- Campus facilities, admissions, and student services
- General knowledge and friendly conversation
- Emotional support and mental health awareness
- Problem-solving and practical advice

CONVERSATION STYLE:
- Use natural, friendly language that students can easily understand
- Structure information clearly with bullet points and headers when helpful
- Be conversational and engaging, never robotic or formal
- Always end with helpful follow-up questions or encouragement
- Show empathy and understanding for all student challenges
- Use appropriate emojis to make conversations more engaging and friendly
- Be encouraging and supportive, especially during difficult times
- If you don't know something, admit it and offer to help find the answer

PROBLEM-SOLVING APPROACH:
- Always listen first and understand the student's specific situation
- Break down complex problems into manageable steps
- Provide practical, actionable advice
- Offer multiple solutions and let students choose what works for them
- Follow up on previous conversations and check on their progress
- Use web search when needed to find current, relevant information
- Explain things in simple terms that students can easily understand

UNIVERSITY INFO:
- Vignan University: Guntur, Andhra Pradesh, India
- Programs: Engineering, Management, Pharmacy
- JNTU-affiliated with modern facilities and strong industry connections

IMPORTANT: You can have friendly, personal conversations while maintaining your role as a university assistant. You're not just limited to academic topics - you can chat about general topics, provide emotional support, and be a caring companion to students. Always prioritize their wellbeing and offer practical help.`;

  // Add user information
  prompt += `\n\nCURRENT USER CONTEXT:
- Name: ${userInfo.name || 'Student'}
- Registration Number: ${userInfo.registrationNumber}
- Course: ${userInfo.course || 'Not specified'}
- Branch: ${userInfo.branch || 'Not specified'}
- Section: ${userInfo.section || 'Not specified'}
- Year: ${userInfo.year || 'Not specified'}
- Semester: ${userInfo.semester || 'Not specified'}
- Academic Year: ${userInfo.academicYear || 'Not specified'}
- Email: ${userInfo.email || 'Not provided'}
- Phone: ${userInfo.phoneNumber || 'Not provided'}
- Language Preference: ${userInfo.languagePreference || 'English'}`;

  // Add session-specific context
  if (userSession.userContext) {
    if (userSession.userContext.department) {
      prompt += `\n- Department: ${userSession.userContext.department}`;
    }
    if (userSession.userContext.year) {
      prompt += `\n- Academic Year: ${userSession.userContext.year}`;
    }
    if (userSession.userContext.preferredName) {
      prompt += `\n- Preferred Name: ${userSession.userContext.preferredName}`;
    }
    if (userSession.userContext.interests?.length > 0) {
      prompt += `\n- Interests: ${userSession.userContext.interests.join(', ')}`;
    }
    if (userSession.userContext.academicGoals?.length > 0) {
      prompt += `\n- Academic Goals: ${userSession.userContext.academicGoals.join(', ')}`;
    }
  }

  // Add conversation context
  if (conversationHistory.length > 0) {
    prompt += `\n\nCONVERSATION CONTEXT:
- Remember what the user has told you in previous messages
- Reference their department, year, interests when relevant
- Build upon previous conversations naturally
- Don't ask for information they've already provided

RECENT CONVERSATION:
${conversationHistory.slice(-4).map(msg => `${msg.role}: ${msg.content}`).join('\n')}`;
  }

  prompt += `\n\nINSTRUCTIONS:
- Always reference the user's context when relevant
- Be helpful and encouraging
- Provide specific, actionable advice
- Use their name and department information naturally
- End responses with a helpful follow-up question`;

  return prompt;
}

// Function to format responses for better readability and friendliness
function formatResponse(text) {
  // Add proper formatting for common patterns
  let formatted = text;

  // Format lists
  formatted = formatted.replace(/(\d+\.\s)/g, '\n$1');
  formatted = formatted.replace(/([•-]\s)/g, '\n$1');

  // Format headers
  formatted = formatted.replace(/(\n|^)([A-Z][^.!?]*:)/g, '\n\n## $2');

  // Clean up extra newlines
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  // Add proper spacing around important sections
  formatted = formatted.replace(/(Important|Note|Remember|Please note):/gi, '\n\n**$1:**');

  // Add friendly touches
  formatted = addFriendlyTouches(formatted);

  return formatted.trim();
}

// Function to add friendly touches to responses
function addFriendlyTouches(text) {
  let friendly = text;

  // Add encouraging phrases for academic topics
  const encouragingPhrases = [
    'Great question!',
    'I\'m here to help!',
    'That\'s a wonderful question!',
    'I\'d be happy to help with that!',
    'Excellent question!',
    'I\'m glad you asked!'
  ];

  // Add helpful closing phrases
  const closingPhrases = [
    'Feel free to ask if you need more details!',
    'I\'m here whenever you need help!',
    'Don\'t hesitate to ask if you have more questions!',
    'I hope this helps! Let me know if you need anything else!',
    'Is there anything specific you\'d like to know more about?',
    'I\'m always here to support your academic journey!'
  ];

  // Add emojis for better engagement
  const emojiMap = {
    'congratulations': '🎉',
    'good luck': '🍀',
    'study': '📚',
    'exam': '📝',
    'project': '💻',
    'placement': '💼',
    'internship': '🏢',
    'research': '🔬',
    'programming': '💻',
    'coding': '💻',
    'success': '✅',
    'important': '⚠️',
    'note': '📝',
    'remember': '💡',
    'help': '🤝',
    'support': '🤝'
  };

  // Add appropriate emojis
  for (const [keyword, emoji] of Object.entries(emojiMap)) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    friendly = friendly.replace(regex, `${emoji} $&`);
  }

  // Add encouraging opening if the response is helpful
  if (friendly.includes('help') || friendly.includes('information') || friendly.includes('details')) {
    const randomPhrase = encouragingPhrases[Math.floor(Math.random() * encouragingPhrases.length)];
    if (!friendly.startsWith(randomPhrase)) {
      friendly = `${randomPhrase} ${friendly}`;
    }
  }

  // Add friendly closing if appropriate
  if (friendly.length > 100 && !friendly.includes('Feel free') && !friendly.includes('Don\'t hesitate')) {
    const randomClosing = closingPhrases[Math.floor(Math.random() * closingPhrases.length)];
    friendly += `\n\n${randomClosing}`;
  }

  return friendly;
}

// Get user session information
async function getUserSession(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const sessionId = req.params.sessionId || 'default';
    const userSession = await UserSession.findOne({ userId, sessionId, isActive: true });

    if (!userSession) {
      return res.json({
        userContext: {},
        conversationHistory: [],
        message: 'No active session found'
      });
    }

    res.json({
      userContext: userSession.userContext,
      conversationHistory: userSession.getRecentHistory(20),
      sessionInfo: {
        lastActivity: userSession.lastActivity,
        messageCount: userSession.conversationHistory.length,
        isActive: userSession.isActive
      }
    });
  } catch (e) {
    console.error('Get user session error:', e);
    res.status(500).json({ error: e.message });
  }
}

// Debug endpoint to check all user sessions
async function debugUserSessions(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const sessions = await UserSession.find({ userId }).sort({ lastActivity: -1 });

    res.json({
      userId,
      sessions: sessions.map(session => ({
        sessionId: session.sessionId,
        isActive: session.isActive,
        userContext: session.userContext,
        lastActivity: session.lastActivity,
        messageCount: session.conversationHistory.length
      }))
    });
  } catch (e) {
    console.error('Debug user sessions error:', e);
    res.status(500).json({ error: e.message });
  }
}

// Function to check if message is asking about academic regulations
function checkRegulationQuery(message) {
  const messageLower = message.toLowerCase();

  // Check for regulation patterns
  const regulationPatterns = [
    /r22|r 22|regulation 22/i,
    /r25|r 25|regulation 25/i,
    /regulation/i,
    /syllabus.*r22|syllabus.*r25/i,
    /curriculum.*r22|curriculum.*r25/i,
    /jntu.*regulation/i,
    /academic.*regulation/i
  ];

  for (const pattern of regulationPatterns) {
    if (pattern.test(messageLower)) {
      return {
        type: 'regulation',
        message: messageLower,
        regulation: messageLower.includes('r22') || messageLower.includes('r 22') ? 'R22' :
                   messageLower.includes('r25') || messageLower.includes('r 25') ? 'R25' : 'general'
      };
    }
  }

  return null;
}

// Function to handle regulation queries with specific knowledge
async function handleRegulationQuery(query, sourceLang) {
  const { regulation, message } = query;

  let answer = '';

  if (regulation === 'R22') {
    answer = `## R22 Regulations (2022) - JNTU Academic Framework

**Overview:**
R22 refers to the 2022 academic regulations for undergraduate programs at JNTU-affiliated institutions, including Vignan University.

**Key Features:**
- **Duration:** 4 years (8 semesters) for B.Tech programs
- **Credit System:** Choice Based Credit System (CBCS)
- **Total Credits:** 160 credits minimum for graduation
- **CGPA Requirement:** Minimum 5.0 CGPA for graduation

**Credit Distribution:**
- **Mathematics & Basic Sciences:** 25-30 credits
- **Engineering Sciences:** 25-30 credits
- **Professional Core:** 50-60 credits
- **Professional Electives:** 15-20 credits
- **Open Electives:** 10-15 credits
- **Project Work:** 8-12 credits
- **Internship/Industrial Training:** 2-4 credits

**Evaluation System:**
- **Internal Assessment:** 30% (assignments, quizzes, mid-term exams)
- **External Assessment:** 70% (end-semester examinations)
- **Grading:** 10-point scale (O, A+, A, B+, B, C, P, F)

**Project Requirements:**
- **Minor Project:** 6th semester (2 credits)
- **Major Project:** 7th & 8th semesters (6 credits each)

Would you like to know more about specific aspects of R22 regulations, such as course structure for your department or evaluation criteria?`;
  } else if (regulation === 'R25') {
    answer = `## R25 Regulations (2025) - JNTU Academic Framework

**Overview:**
R25 refers to the 2025 academic regulations for undergraduate programs at JNTU-affiliated institutions, including Vignan University. This is the newer curriculum framework.

**Key Features:**
- **Duration:** 4 years (8 semesters) for B.Tech programs
- **Credit System:** Enhanced Choice Based Credit System (CBCS)
- **Total Credits:** 160-170 credits for graduation
- **CGPA Requirement:** Minimum 5.0 CGPA for graduation

**Enhanced Features:**
- **Industry Integration:** More emphasis on industry-relevant skills
- **Research Component:** Mandatory research methodology course
- **Skill Enhancement:** Additional skill development courses
- **Flexible Electives:** More choice in professional and open electives

**Credit Distribution:**
- **Mathematics & Basic Sciences:** 25-30 credits
- **Engineering Sciences:** 25-30 credits
- **Professional Core:** 50-60 credits
- **Professional Electives:** 20-25 credits
- **Open Electives:** 15-20 credits
- **Project Work:** 10-15 credits
- **Internship/Industrial Training:** 3-5 credits
- **Skill Development:** 5-8 credits

**Evaluation System:**
- **Continuous Assessment:** 40% (assignments, quizzes, mid-term exams, lab work)
- **End-Semester Examination:** 60%
- **Grading:** 10-point scale with enhanced criteria

Would you like specific details about R25 regulations for your Computer Science program or any particular aspect?`;
  } else {
    answer = `## Academic Regulations at Vignan University

**Current Regulation Frameworks:**
- **R22 (2022):** Traditional 4-year B.Tech programs with 160 credits
- **R25 (2025):** Enhanced curriculum with industry focus and 160-170 credits

**Key Differences:**
- R25 has more industry integration and skill development
- R25 includes mandatory research methodology
- R25 offers more flexible elective choices
- R25 has enhanced evaluation criteria

**Common Features:**
- Choice Based Credit System (CBCS)
- Minimum 5.0 CGPA for graduation
- 4-year duration (8 semesters)
- Project work and internship requirements

**For Your Computer Science Program:**
- Follows the same credit structure as other engineering programs
- Includes programming, algorithms, data structures, and software engineering
- Project work focuses on software development and system design

Which specific regulation (R22 or R25) would you like to know more about, or do you have questions about your Computer Science curriculum?`;
  }

  // Translate if needed
  if (sourceLang !== 'en') {
    try {
      answer = await translateText(answer, 'en', sourceLang);
    } catch (error) {
      console.log('Regulation answer translation error:', error.message);
    }
  }

  return answer;
}

module.exports = { chat, getUserSession, debugUserSessions };


