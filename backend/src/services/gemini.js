const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

async function generateChatResponse(messages) {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    }
  });
  
  // Filter out system messages and convert to Gemini format
  const history = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ 
      role: m.role === 'assistant' ? 'model' : 'user', 
      parts: [{ text: m.content }] 
    }));
  
  // If there was a system message, prepend it to the first user message
  const systemMessage = messages.find((m) => m.role === 'system');
  if (systemMessage && history.length > 0 && history[0].role === 'user') {
    history[0].parts[0].text = `${systemMessage.content}\n\n${history[0].parts[0].text}`;
  }
  
  const result = await model.generateContent({ contents: history });
  const text = result?.response?.text?.() || '';
  return text;
}

async function embedText(text) {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const safe = String(text || '').substring(0, 8000);
  const result = await model.embedContent(safe);
  const embedding = result?.embedding?.values || [];
  return embedding;
}

async function embedMany(chunks) {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const inputs = (chunks || []).map(c => ({ content: String(c || '').substring(0, 8000) }));
  if (inputs.length === 0) return [];
  const result = await model.batchEmbedContents({ requests: inputs });
  const vectors = result?.embeddings?.map(e => e.values) || [];
  return vectors;
}

module.exports = { generateChatResponse, embedText, embedMany };


